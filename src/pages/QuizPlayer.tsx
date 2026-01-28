// src/pages/QuizPlayer.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Save } from 'lucide-react';
import { db } from '../lib/db';
import { useSync } from '../hooks/useSync';
import { getStudentUUID, getOrCreateUUIDForId } from '../lib/uuid';

// --- MOCK DATA (Ideally this comes from db.quizzes) ---
const MOCK_QUIZ = {
  id: 'quiz-1',
  title: 'Safety Procedures & Tools',
  questions: [
    {
      id: 'q1',
      text: 'Which tool is primarily used for tightening hex bolts?',
      options: ['Screwdriver', 'Wrench', 'Hammer', 'Pliers'],
      correctIndex: 1 // Wrench
    },
    {
      id: 'q2',
      text: 'What is the first step before inspecting an engine?',
      options: ['Wash the car', 'Disconnect the battery', 'Check the tires', 'Turn on the radio'],
      correctIndex: 1 // Disconnect battery
    },
    {
      id: 'q3',
      text: 'PPE stands for Personal Protective ______.',
      options: ['Engine', 'Equipment', 'Energy', 'Electricity'],
      correctIndex: 1 // Equipment
    }
  ]
};

export default function QuizPlayer() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { triggerSync, isOnline } = useSync();

  // State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const question = MOCK_QUIZ.questions[currentQIndex];
  const totalQ = MOCK_QUIZ.questions.length;

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
    setIsSaving(true);
    
    // 1. Grade Locally
    let finalScore = 0;
    MOCK_QUIZ.questions.forEach(q => {
      if (answers[q.id] === q.correctIndex) {
        finalScore++;
      }
    });
    setScore(finalScore);

    // 2. Save to Offline DB (Dexie)
    try {
      await db.quizAttempts.add({
        quizId: getOrCreateUUIDForId(quizId || 'quiz-1'), // Convert to UUID
        studentId: getStudentUUID(), // Use consistent UUID for student
        answers: answers,
        score: finalScore,
        timestamp: Date.now(),
        syncStatus: 'pending' // <--- THE MAGIC FLAG
      });

      setIsFinished(true);

      // 3. Try to sync immediately if online (User Experience bonus)
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
               <><span>Synced to Cloud</span> <CheckCircle size={14}/></>
             ) : (
               <><span>Saved to Sync Queue</span> <Save size={14}/></>
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
          Question {currentQIndex + 1} of {totalQ}
        </div>
        <div className="w-8" /> {/* Spacer */}
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
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected 
                    ? 'border-blue-600 bg-blue-50 text-blue-800 font-medium' 
                    : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-blue-600' : 'border-slate-300'
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