import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Save, Settings } from 'lucide-react';
import { db, type Quiz } from '../lib/db';
import { useSync } from '../hooks/useSync';
import { getCurrentUserId } from '../lib/uuid';

export default function QuizPlayer() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  // const { user } = useAuth(); // Not needed if we use getCurrentUserId()
  const { triggerSync } = useSync();

  const { isOnline } = useSync();

  // State
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [previousAttempts, setPreviousAttempts] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number | null>(null);

  useEffect(() => {
    if (quizId) {
      loadQuiz();
    }
  }, [quizId]);

  const loadQuiz = async () => {
    if (!quizId) return;
    try {
      setLoading(true);
      const studentId = await getCurrentUserId();
      if (!studentId) return; // Should be handled by Auth guard

      const [q, existingAttempts] = await Promise.all([
        db.quizzes.get(quizId),
        db.quizAttempts
          .where('quizId')
          .equals(quizId)
          .filter(a => a.studentId === studentId)
          .toArray()
      ]);

      if (q) {
        setQuiz(q);
        setPreviousAttempts(existingAttempts.length);

        if (existingAttempts.length > 0) {
          // Calculate best score
          const maxScore = Math.max(...existingAttempts.map(a => a.score));
          setBestScore(maxScore);
        }
      }
      else console.warn("Quiz not found in local DB", quizId);
    } catch (e) {
      console.error("Error loading quiz", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Loading quiz...</div>;
  if (!quiz) return (
    <div className="p-12 text-center">
      <h2 className="text-xl font-bold text-slate-800">Quiz Not Found</h2>
      <p className="text-slate-500 mb-4">You may need to sync your courses.</p>
      <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">Go Back</button>
    </div>
  );

  const question = quiz.questions[currentQIndex];
  const totalQ = quiz.questions.length;
  const allowed = quiz.allowedAttempts || 1;
  const remaining = allowed - previousAttempts;

  if (totalQ === 0) return <div className="p-12 text-center">This quiz has no questions yet.</div>;

  if (remaining <= 0 && !isFinished) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm border border-red-100">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Maximum Attempts Reached</h2>
          <p className="text-slate-500 mt-2">
            You have used all {allowed} allowed attempts for this quiz.
          </p>

          {bestScore !== null && (
            <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Your Best Score</div>
              <div className="text-3xl font-black text-slate-800">
                {bestScore} <span className="text-lg text-slate-400 font-medium">/ {totalQ}</span>
              </div>
            </div>
          )}
          <button
            onClick={() => navigate(-1)}
            className="mt-6 w-full bg-slate-900 text-white py-3 rounded-xl font-medium"
          >
            Back to Course
          </button>
        </div>
      </div>
    );
  }

  // Handle Answer Selection
  const handleSelect = (optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [question.id]: optionIndex }));
  };

  // Handle Next / Submit
  const handleNext = async () => {
    if (currentQIndex < totalQ - 1) {
      setCurrentQIndex(prev => prev + 1);
    } else {
      await finishQuiz();
    }
  };

  // Grading & Saving Logic
  const finishQuiz = async () => {
    if (!quiz) return;
    setIsSaving(true);

    // 1. Grade Locally
    let finalScore = 0;
    quiz.questions.forEach(q => {
      if (answers[q.id] === q.correctOption) {
        finalScore++;
      }
    });
    setScore(finalScore);

    // 2. Save to Offline DB (Dexie)
    try {
      const studentId = await getCurrentUserId();
      if (!studentId) throw new Error("No user logged in");

      await db.quizAttempts.add({
        quizId: quiz.id,
        studentId: studentId,
        answers: answers,
        score: finalScore,
        totalQuestions: quiz.questions.length,
        timestamp: Date.now(),
        syncStatus: 'pending'
      });

      setIsFinished(true);

      // 3. Try to sync immediately if online
      if (isOnline) {
        triggerSync();
      }

      // 4. Mark Lesson as Completed
      try {
        const lesson = await db.lessons.where('quizId').equals(quiz.id).first();
        if (lesson) {
          const existingProgress = await db.lessonProgress
            .where({ lessonId: lesson.id, studentId: studentId })
            .first();

          if (existingProgress) {
            await db.lessonProgress.update(existingProgress.id!, {
              completed: true,
              completedAt: Date.now(),
              lastAccessed: Date.now(),
              // We don't track timeSpent for quizzes yet, but could add that later
            });
          } else {
            await db.lessonProgress.add({
              lessonId: lesson.id,
              courseId: quiz.courseId,
              studentId: studentId,
              completed: true,
              completedAt: Date.now(),
              timeSpent: 0,
              lastAccessed: Date.now(),
            });
          }
        }
      } catch (err) {
        console.error("Failed to update lesson progress", err);
        // Don't block the user if this fails
      }

    } catch (e) {
      console.error("Failed to save quiz", e);
      alert("Error saving quiz. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDER: RESULT SCREEN ---
  if (isFinished) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Quiz Completed!</h2>
          <p className="text-slate-500 mt-2">Your score has been recorded.</p>

          <div className="my-6 text-4xl font-black text-blue-900">
            {score} / {totalQ}
          </div>

          <div className={`text-sm p-3 rounded-lg mb-6 flex items-center justify-center gap-2 ${isOnline ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>
            {isOnline ? (
              <><span>Synced to Cloud</span> <CheckCircle size={14} /></>
            ) : (
              <><span>Saved to Sync Queue</span> <Save size={14} /></>
            )}
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER: QUESTION SCREEN ---
  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-slate-100 sticky top-0 bg-white z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <div className="font-bold text-slate-700">{quiz.title}</div>
          <div className="text-xs text-slate-400 font-medium ml-2">
            Attempt {previousAttempts + 1} of {allowed}
          </div>
        </div>
        <div className="w-8" />
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-1">
        <div
          className="bg-blue-600 h-1 transition-all duration-300"
          style={{ width: `${((currentQIndex + 1) / totalQ) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="p-6 max-w-md mx-auto mt-4">
        <h2 className="text-xl font-bold text-slate-900 mb-8 leading-snug">
          {question.text}
        </h2>

        <div className="flex flex-col gap-3">
          {question.options.map((opt, idx) => {
            const isSelected = answers[question.id] === idx;
            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected
                  ? 'border-blue-600 bg-blue-50 text-blue-800 font-medium'
                  : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-600' : 'border-slate-300'
                    }`}>
                    {isSelected && <div className="w-3 h-3 bg-blue-600 rounded-full" />}
                  </div>
                  {opt}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white z-50">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleNext}
            disabled={answers[question.id] === undefined || isSaving}
            className="w-full bg-blue-900 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none active:scale-[0.98] transition-transform"
          >
            {isSaving ? 'Saving...' : (currentQIndex === totalQ - 1 ? 'Submit Quiz' : 'Next Question')}
          </button>
        </div>
      </div>
    </div>
  );
}