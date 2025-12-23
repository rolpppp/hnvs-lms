import { useState, useEffect, useCallback } from "react";
import { db } from "../lib/db";
import { supabase } from "../lib/supabase";
import { useLiveQuery } from "dexie-react-hooks";

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
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

    setIsSyncing(true);
    setSyncError(null);

    try {
      // --- A. SYNC QUIZZES ---
      const pendingQuizzes = await db.quizAttempts
        .where("syncStatus")
        .equals("pending")
        .toArray();

      if (pendingQuizzes.length > 0) {
        // Prepare data for Supabase
        const payload = pendingQuizzes.map((q) => ({
          quiz_id: q.quizId,
          student_id: q.studentId,
          score: q.score,
          answers_json: q.answers,
          device_timestamp: new Date(q.timestamp).toISOString(), // Proof of time
          is_late: false,
        }));

        const { error } = await supabase
          .from("quiz_submissions")
          .insert(payload);

        if (error) throw error;

        // If success, update local DB to 'synced'
        await db.quizAttempts
          .where("id")
          .anyOf(pendingQuizzes.map((q) => q.id as number))
          .modify({ syncStatus: "synced" });
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
          content_text: a.textAnswer,
          device_timestamp: new Date(a.timestamp).toISOString(),
        }));

        const { error } = await supabase
          .from("assignment_submissions")
          .insert(payload);
        if (error) throw error;

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
