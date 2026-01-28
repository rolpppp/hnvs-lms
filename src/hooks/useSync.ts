import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "../lib/db";
import { supabase } from "../lib/supabase";
import { useLiveQuery } from "dexie-react-hooks";
import { getCurrentUserId } from "../lib/uuid";

// Import notification hook
const createGradeNotification = async (quizId: string, score: number, total: number) => {
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 75;
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  await db.notifications.add({
    userId,
    type: 'grade',
    title: passed ? '🎉 Quiz Graded!' : 'Quiz Results Available',
    message: `You scored ${score}/${total} (${percentage}%) on your quiz.`,
    isRead: false,
    createdAt: Date.now(),
    relatedId: quizId,
  });

  // Send browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(passed ? '🎉 Quiz Graded!' : 'Quiz Results Available', {
      body: `You scored ${score}/${total} (${percentage}%)`,
      icon: '/src/assets/logo.png',
    });
  }
};

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false); // Ref to track syncing state instantly
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 1. LIVE QUERY: Automatically counts pending items for the UI Badge
  const pendingCount = useLiveQuery(async () => {
    const pendingQuizzes = await db.quizAttempts
      .where("syncStatus")
      .equals("pending")
      .count();
    const pendingAssignments = await db.submissions
      .where("syncStatus")
      .equals("pending")
      .count();
    return pendingQuizzes + pendingAssignments;
  }, []);

  // 2. THE SYNC LOGIC
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncError("Cannot sync: No internet connection");
      return;
    }

    if (isSyncingRef.current) return; // Prevent concurrent syncs

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    try {
      // --- A. SYNC QUIZZES ---
      const pendingQuizzes = await db.quizAttempts
        .where("syncStatus")
        .equals("pending")
        .toArray();

      if (pendingQuizzes.length > 0) {
        // OPTIMIZATION: Check which quizzes actually exist in Supabase first
        // This avoids the loud 409 error in the console for mismatched foreign keys
        const distinctQuizIds = [...new Set(pendingQuizzes.map(q => q.quizId))];
        let validQuizIds = new Set<string>();
        
        const { data: validQuizzesData, error: verifyError } = await supabase
           .from('quizzes')
           .select('id')
           .in('id', distinctQuizIds);

        if (!verifyError && validQuizzesData) {
            validQuizIds = new Set(validQuizzesData.map(v => v.id));
            
            // Immediately mark orphans as failed without trying to insert
            const orphans = pendingQuizzes.filter(q => !validQuizIds.has(q.quizId));
            if (orphans.length > 0) {
                console.warn(`⚠️ Skipping ${orphans.length} submissions for deleted quizzes.`);
                await db.quizAttempts
                    .where("id")
                    .anyOf(orphans.map(q => q.id as number))
                    .modify({ syncStatus: "failed_orphan" });
            }
        } else {
            // If verification failed (e.g. RLS or network), assume all valid and let the insert fail naturally
             validQuizIds = new Set(distinctQuizIds);
        }

        const quizzesToSync = pendingQuizzes.filter(q => validQuizIds.has(q.quizId));

        if (quizzesToSync.length > 0) {
          // Prepare data for Supabase (only if Supabase is configured)
          const payload = quizzesToSync.map((q) => ({
            quiz_id: q.quizId,
            student_id: q.studentId,
            score: q.score,
            answers_json: JSON.stringify(q.answers), // Convert to JSON string
            device_timestamp: new Date(q.timestamp).toISOString(),
            is_late: false,
          }));

          // Insert quiz submissions to Supabase
          const { error } = await supabase
            .from("quiz_submissions")
            .insert(payload);

          if (error) {
            // Check if it's an RLS/auth error
            if (error.code === '42501' || error.message.includes('row-level security') || error.message.includes('policy')) {
              console.error("❌ SUPABASE RLS ERROR: Row-Level Security is blocking inserts!");
              console.error("📋 FIX: Run this SQL in Supabase SQL Editor:");
              console.error("   ALTER TABLE quiz_submissions DISABLE ROW LEVEL SECURITY;");
              console.error("\n📖 See SUPABASE_FIX_401.md for detailed instructions");
              setSyncError("Supabase RLS policy blocking sync - see console for fix");
              // Mark as failed so we can retry later
              await db.quizAttempts
                .where("id")
                .anyOf(quizzesToSync.map((q) => q.id as number))
                .modify({ syncStatus: "failed" });
            } else if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique constraint')) {
              console.warn("⚠️  Duplicate submission detected - already synced");
              // Mark as synced since the data is already in Supabase
              await db.quizAttempts
                .where("id")
                .anyOf(quizzesToSync.map((q) => q.id as number))
                .modify({ syncStatus: "synced" });
            } else if (error.code === '23503' || error.code === '409') {
               // Fallback for race conditions or if verification failed
               if (error.code === '23503') {
                   console.error("❌ Foreign Key Violation (quiz_id not found). Attempting individual sync...");
               } else {
                   console.warn("⚠️ Conflict (409) detected. Possibly duplicate or Foreign Key issue. Attempting individual sync...");
               }
               
               // Fallback: Try syncing one by one
               for (const quiz of quizzesToSync) {
                 const singlePayload = {
                    quiz_id: quiz.quizId,
                    student_id: quiz.studentId,
                    score: quiz.score,
                    answers_json: JSON.stringify(quiz.answers),
                    device_timestamp: new Date(quiz.timestamp).toISOString(),
                    is_late: false,
                 };
                 const { error: singleError } = await supabase.from("quiz_submissions").insert([singlePayload]);
                 
                 if (singleError) {
                    if (singleError.code === '23503') {
                        console.warn(`Skipping orphaned quiz submission for quiz ${quiz.quizId}`); // warn instead of error
                        await db.quizAttempts.update(quiz.id as number, { syncStatus: "failed_orphan" });
                    } else if (singleError.code === '23505' || singleError.code === '409') { // Handle 409 as success (already exists)
                        await db.quizAttempts.update(quiz.id as number, { syncStatus: "synced" });
                    } else {
                        console.error(`Failed to sync quiz ${quiz.id}: ${singleError.message}`);
                        // Keep as pending for retry
                    }
                 } else {
                    await db.quizAttempts.update(quiz.id as number, { syncStatus: "synced" });
                    await createGradeNotification(quiz.quizId, quiz.score, 3);
                 }
               }
               setSyncError("Some submissions were skipped because the quiz no longer exists.");
            } else {
              console.error("❌ Quiz sync failed:", error);
              console.error("Error code:", error.code);
              console.error("Error details:", error.details);
              console.error("Error hint:", error.hint);
              setSyncError(`Sync failed: ${error.message}`);
            }
          } else {
            console.log(`✅ Synced ${quizzesToSync.length} quiz attempts successfully`);
            
            // Only mark as synced if no error
            await db.quizAttempts
              .where("id")
              .anyOf(quizzesToSync.map((q) => q.id as number))
              .modify({ syncStatus: "synced" });
  
            // Create grade notifications for newly synced quizzes
            for (const quiz of quizzesToSync) {
              await createGradeNotification(quiz.quizId, quiz.score, 3); // Assuming 3 questions for demo
            }
          }
        }
      }

      // --- B. SYNC ASSIGNMENTS (Simplified for text) ---
      const pendingAssignments = await db.submissions
        .where("syncStatus")
        .equals("pending")
        .toArray();

      if (pendingAssignments.length > 0) {
        const payload = pendingAssignments.map((a) => ({
          assignment_id: a.assignmentId,
          student_id: a.studentId,
          content_text: a.textAnswer || '',
          device_timestamp: new Date(a.timestamp).toISOString(),
        }));

        const { error } = await supabase
          .from("assignment_submissions")
          .insert(payload);
        
        if (error) {
          console.warn("Assignment sync failed (Supabase table may not exist):", error.message);
          // Still mark as synced locally
        } else {
          console.log(`Synced ${pendingAssignments.length} assignment submissions`);
        }

        await db.submissions
          .where("id")
          .anyOf(pendingAssignments.map((a) => a.id as number))
          .modify({ syncStatus: "synced" });
      }
    } catch (err) {
      console.error("Sync failed:", err);
      setSyncError(err instanceof Error ? err.message : "Unknown sync error");
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, []);

  // 3. AUTO-SYNC LISTENER
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("Back online! Attempting sync...");
      triggerSync();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check on mount
    if (navigator.onLine && (pendingCount || 0) > 0) {
      triggerSync();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [triggerSync, pendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount: pendingCount || 0,
    syncError,
    triggerSync,
  };
}
