import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Save } from 'lucide-react';
import { db, type Quiz } from '../lib/db';
import { useSync } from '../hooks/useSync';
import { getCurrentUserId } from '../lib/uuid';
import { useAuth } from '../features/auth/AuthProvider';

export default function QuizPlayer() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { triggerSync, isOnline } = useSync();

  // State
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (quizId) {
      loadQuiz();
    }
  }, [quizId]);

  const loadQuiz = async () => {
    if (!quizId) return;
    try {
      setLoading(true);
      const q = await db.quizzes.get(quizId);
      if (q) setQuiz(q);
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

  if (totalQ === 0) return <div className="p-12 text-center">This quiz has no questions yet.</div>;

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
        <div className="flex-1 text-center font-bold text-slate-700">
          {quiz.title} - Q{currentQIndex + 1}
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