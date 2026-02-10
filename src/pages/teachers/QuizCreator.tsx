import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, CheckCircle, Circle, GripVertical, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Option {
    id: string; // "new-..." or uuid
    label: string;
    is_correct: boolean;
}

interface Question {
    id: string; // "new-..." or uuid
    prompt: string;
    order: number;
    options: Option[];
}

interface Quiz {
    id: string;
    title: string;
    published: boolean;
    course_id: string;
    allowed_attempts: number;
}

export default function QuizCreator() {
    const { courseId, quizId } = useParams();
    const navigate = useNavigate();

    // State
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
    const [toastMessage, setToastMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const autoSaveTimerRef = useRef<number | null>(null);
    const lastSavedDataRef = useRef<string>('');
    const deletedQuestionIdsRef = useRef<Set<string>>(new Set());
    const deletedOptionIdsRef = useRef<Set<string>>(new Set());

    const fetchQuizData = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Fetch Quiz
            const { data: quizData, error: quizError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', quizId)
                .single();

            if (quizError) throw quizError;
            setQuiz(quizData);

            // 2. Fetch Questions
            const { data: qData, error: qError } = await supabase
                .from('quiz_questions')
                .select('*')
                .eq('quiz_id', quizId)
                .order('order');

            if (qError) throw qError;

            // 3. Fetch Options for all questions
            // (A bit inefficient to fetch all options for quiz, but okay for small scale)
            // We can fetch options where question_id in (...)
            const qIds = qData.map(q => q.id);
            const optionsMap: Record<string, Option[]> = {};

            if (qIds.length > 0) {
                const { data: oData, error: oError } = await supabase
                    .from('quiz_options')
                    .select('*')
                    .in('question_id', qIds);

                if (oError) throw oError;

                // Group by question_id
                oData.forEach((opt: {question_id: string; id: string; label: string; is_correct: boolean}) => {
                    if (!optionsMap[opt.question_id]) optionsMap[opt.question_id] = [];
                    optionsMap[opt.question_id].push(opt);
                });
            }

            // Combine
            const fullQuestions = qData.map(q => ({
                ...q,
                options: optionsMap[q.id] || []
            }));

            setQuestions(fullQuestions);
            
            // Store initial state for change tracking
            lastSavedDataRef.current = JSON.stringify({ quiz: quizData, questions: fullQuestions });
            
            // Reset deletion trackers
            deletedQuestionIdsRef.current.clear();
            deletedOptionIdsRef.current.clear();

        } catch (err) {
            console.error('Error loading quiz:', err);
            setToastMessage({ type: 'error', message: 'Failed to load quiz data' });
            navigate(-1);
        } finally {
            setLoading(false);
        }
    }, [quizId, navigate]);

    // Helper function to process options with proper UPDATE/INSERT logic
    const processOptions = useCallback(async (questionId: string, options: Option[]) => {
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            
            if (opt.id.startsWith('new-opt-')) {
                // Insert new option
                const { data: newOpt, error: insertErr } = await supabase
                    .from('quiz_options')
                    .insert({
                        question_id: questionId,
                        label: opt.label,
                        is_correct: opt.is_correct
                    })
                    .select()
                    .single();
                    
                if (insertErr) throw insertErr;
                
                // Update option ID for future saves
                opt.id = newOpt.id;
            } else {
                // Update existing option (PUT)
                const { error: updateErr } = await supabase
                    .from('quiz_options')
                    .update({
                        label: opt.label,
                        is_correct: opt.is_correct
                    })
                    .eq('id', opt.id);
                    
                if (updateErr) throw updateErr;
            }
        }
    }, []);

    const handleSave = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!quiz) return;
        if (saveStatus === 'saving') return; // Prevent concurrent saves
        
        setSaveStatus('saving');
        setHasUnsavedChanges(false);
        try {
            // 1. Update Quiz
            const { error: quizErr } = await supabase
                .from('quizzes')
                .update({
                    title: quiz.title,
                    published: quiz.published,
                    allowed_attempts: quiz.allowed_attempts
                })
                .eq('id', quiz.id);
            if (quizErr) throw quizErr;

            // 2. Upsert Questions & Options
            // Detailed logic:
            // For now, let's implement a simpler "Delete all and Insert" or "Upsert"
            // Upsert is safer.

            // Step 2a: PROACTIVE FIX for Unique Constraint Violations "quiz_questions_quiz_id_order_key"
            // We temporarily flip all existing orders to negative values to clear the positive integer space (0, 1, 2...)
            // This prevents "duplicate key value" errors when swapping questions or inserting in the middle.
            try {
                const { error: rpcError } = await supabase.rpc('prepare_quiz_reorder', { p_quiz_id: quiz.id });
                
                if (rpcError) {
                    console.warn('RPC prepare_quiz_reorder failed/missing, falling back to client-side shuffle:', rpcError);
                    // Fallback: Manually updating existing questions to distinct negative orders
                    // Using -10000 - index ensures they are negative and unique
                    const existingQuestions = questions.filter(q => !q.id.startsWith('new-'));
                    for (let j = 0; j < existingQuestions.length; j++) {
                        const tempOrder = -10000 - j; 
                        await supabase
                            .from('quiz_questions')
                            .update({ order: tempOrder })
                            .eq('id', existingQuestions[j].id);
                    }
                }
            } catch (prepError) {
                console.error('Error preparing quiz order:', prepError);
                // Continue anyway, worst case we hit the original error
            }

            // Step 2b: Process all questions (now that space is clear)
            const updatedQuestions = [...questions]; // Create a copy to avoid mutation
            
            for (let i = 0; i < updatedQuestions.length; i++) {
                const q = updatedQuestions[i];
                let qId = q.id;

                // Handle New Question (INSERT)
                if (q.id.startsWith('new-')) {
                    const { data: newQ, error: newQErr } = await supabase
                        .from('quiz_questions')
                        .insert({
                            quiz_id: quiz.id,
                            prompt: q.prompt,
                            order: i
                        })
                        .select()
                        .single();
                    if (newQErr) throw newQErr;
                    qId = newQ.id;
                    
                    // Update the question ID in the copy
                    updatedQuestions[i] = { ...updatedQuestions[i], id: qId };
                } else {
                    // Update existing question (PUT)
                    const { error: updateErr } = await supabase
                        .from('quiz_questions')
                        .update({ prompt: q.prompt, order: i })
                        .eq('id', q.id);
                    if (updateErr) throw updateErr;
                }

                // Handle Options using proper UPDATE/INSERT pattern
                await processOptions(qId, q.options);
            }
            
            // Update state with new IDs only after successful save
            setQuestions(updatedQuestions);
            
            // Delete questions that were removed from the UI
            if (deletedQuestionIdsRef.current.size > 0) {
                const idsToDelete = Array.from(deletedQuestionIdsRef.current);
                const { error: deleteErr } = await supabase
                    .from('quiz_questions')
                    .delete()
                    .in('id', idsToDelete);
                if (deleteErr) console.error('Error deleting questions:', deleteErr);
                deletedQuestionIdsRef.current.clear();
            }
            
            // Delete options that were removed
            if (deletedOptionIdsRef.current.size > 0) {
                const idsToDelete = Array.from(deletedOptionIdsRef.current);
                const { error: deleteErr } = await supabase
                    .from('quiz_options')
                    .delete()
                    .in('id', idsToDelete);
                if (deleteErr) console.error('Error deleting options:', deleteErr);
                deletedOptionIdsRef.current.clear();
            }

            // Update last saved state without refetching (optimistic)
            lastSavedDataRef.current = JSON.stringify({ quiz, questions });
            setSaveStatus('saved');
            setToastMessage({ type: 'success', message: 'All changes saved' });

        } catch (err: unknown) {
            console.error('Save failed:', err);
            setSaveStatus('error');
            const errorMessage = err instanceof Error ? err.message : 'Save failed';
            setToastMessage({ type: 'error', message: errorMessage });
            setHasUnsavedChanges(true);
        }
    }, [quiz, questions, saveStatus, processOptions]);

    const handleTogglePublish = async () => {
        if (!quiz) return;
        const newStatus = !quiz.published;

        // Optimistic update
        setQuiz({ ...quiz, published: newStatus });

        try {
            // 1. Update Quiz
            const { error: quizError } = await supabase
                .from('quizzes')
                .update({ published: newStatus })
                .eq('id', quiz.id);

            if (quizError) throw quizError;

            // 2. Update Linked Lesson Visibility (Optional but recommended)
            // If we publish the quiz, we likely want the lesson to be visible too
            const { error: lessonError } = await supabase
                .from('lessons')
                .update({ is_visible: newStatus })
                .eq('quiz_id', quiz.id);

            if (lessonError) console.warn('Could not update lesson visibility:', lessonError);

        } catch (err: unknown) {
            console.error('Error updating publish status:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to update publish status';
            setToastMessage({ type: 'error', message: errorMessage });
            // Revert
            setQuiz({ ...quiz, published: !newStatus });
        }
    };

    // Effects
    useEffect(() => {
        if (quizId) fetchQuizData();
    }, [quizId, fetchQuizData]);

    // Keyboard shortcut for save (Cmd+S / Ctrl+S)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (hasUnsavedChanges) {
                    handleSave();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasUnsavedChanges, handleSave]);

    // Auto-hide toast after 3 seconds
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    // Track changes for auto-save
    useEffect(() => {
        if (!quiz || loading) return;

        const currentData = JSON.stringify({ quiz, questions });
        
        // Check if data has changed from last saved state
        if (lastSavedDataRef.current && currentData !== lastSavedDataRef.current) {
            setHasUnsavedChanges(true);
            setSaveStatus('unsaved');
            
            // Clear existing timer
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            
            // Set new auto-save timer (2 seconds after last change)
            autoSaveTimerRef.current = window.setTimeout(() => {
                handleSave();
            }, 2000);
        }

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [quiz, questions, loading, handleSave]);

    const addQuestion = () => {
        const newQ: Question = {
            id: `new-${Date.now()}`,
            prompt: 'New Question',
            order: questions.length,
            options: [
                { id: `new-opt-1-${Date.now()}`, label: 'Option 1', is_correct: false },
                { id: `new-opt-2-${Date.now()}`, label: 'Option 2', is_correct: true }
            ]
        };
        setQuestions([...questions, newQ]);
    };

    const deleteQuestion = async (qId: string) => {
        if (!confirm('Delete this question?')) return;

        // Track deletion if it's an existing question
        if (!qId.startsWith('new-')) {
            deletedQuestionIdsRef.current.add(qId);
            
            // Also track all its options for deletion
            const question = questions.find(q => q.id === qId);
            if (question) {
                question.options.forEach(opt => {
                    if (!opt.id.startsWith('new-')) {
                        deletedOptionIdsRef.current.add(opt.id);
                    }
                });
            }
        }
        
        // Remove from UI
        setQuestions(questions.filter(q => q.id !== qId));
    };

    if (loading || !quiz) return <div className="p-12 text-center text-slate-500">Loading Quiz...</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-14 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <Link to={`/teacher/courses/${courseId}`} className="text-slate-500 hover:text-blue-600 flex items-center gap-2 text-sm">
                            <ArrowLeft size={16} /> Back to Course
                        </Link>
                        <div className="flex items-center gap-3">
                            {/* Save Status Indicator */}
                            <div className="flex items-center gap-2 text-xs">
                                {saveStatus === 'saving' && (
                                    <span className="flex items-center gap-1.5 text-blue-600">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span className="font-medium">Saving...</span>
                                    </span>
                                )}
                                {saveStatus === 'saved' && (
                                    <span className="flex items-center gap-1.5 text-green-600">
                                        <Check size={14} />
                                        <span className="font-medium">All changes saved</span>
                                    </span>
                                )}
                                {saveStatus === 'unsaved' && (
                                    <span className="flex items-center gap-1.5 text-amber-600">
                                        <Circle size={8} className="fill-current" />
                                        <span className="font-medium">Unsaved changes</span>
                                    </span>
                                )}
                                {saveStatus === 'error' && (
                                    <span className="flex items-center gap-1.5 text-red-600">
                                        <AlertCircle size={14} />
                                        <span className="font-medium">Save failed</span>
                                    </span>
                                )}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${quiz.published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {quiz.published ? 'Published' : 'Draft'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={quiz.title}
                                onChange={e => setQuiz({ ...quiz, title: e.target.value })}
                                className="text-2xl font-bold border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full bg-transparent"
                                placeholder="Quiz Title"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">Attempts:</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={quiz.allowed_attempts || 1}
                                    onChange={e => setQuiz({ ...quiz, allowed_attempts: parseInt(e.target.value) || 1 })}
                                    className="w-12 bg-transparent font-medium text-center focus:outline-none border-b border-transparent focus:border-blue-500"
                                />
                            </div>
                            <button
                                onClick={handleTogglePublish}
                                className={`px-4 py-2 rounded-lg font-medium text-sm border ${quiz.published ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
                            >
                                {quiz.published ? 'Unpublish' : 'Publish'}
                            </button>
                            {hasUnsavedChanges && (
                                <button
                                    onClick={handleSave}
                                    disabled={saveStatus === 'saving'}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-all"
                                    title="Save now (Cmd+S)"
                                >
                                    {saveStatus === 'saving' ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    Save Now
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
                    <div className={`rounded-lg shadow-xl px-5 py-3.5 flex items-center gap-3 border-l-4 ${
                        toastMessage.type === 'success' 
                            ? 'bg-white border-green-500 text-green-800' 
                            : 'bg-white border-red-500 text-red-800'
                    }`}>
                        {toastMessage.type === 'success' ? (
                            <Check size={20} className="text-green-600 flex-shrink-0" />
                        ) : (
                            <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm">{toastMessage.message}</span>
                        <button
                            onClick={() => setToastMessage(null)}
                            className="ml-2 text-slate-400 hover:text-slate-600"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <form onSubmit={(e) => { e.preventDefault(); handleSave(e); }} className="max-w-3xl mx-auto px-4 py-8 space-y-6">

                {questions.map((q, qIndex) => (
                    <div key={q.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-start gap-3">
                            <div className="mt-1 cursor-grab text-slate-400">
                                <GripVertical size={20} />
                            </div>
                            <div className="flex-1">
                                <span className="text-xs font-bold text-slate-500 uppercase mb-1 block">Question {qIndex + 1}</span>
                                <textarea
                                    value={q.prompt}
                                    onChange={e => {
                                        const newQ = [...questions];
                                        newQ[qIndex].prompt = e.target.value;
                                        setQuestions(newQ);
                                    }}
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-800 font-medium resize-none"
                                    placeholder="Enter your question here..."
                                    rows={2}
                                />
                            </div>
                            <button onClick={() => deleteQuestion(q.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            {q.options.map((opt, oIndex) => (
                                <div key={oIndex} className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            const newQ = [...questions];
                                            newQ[qIndex].options.forEach((o, idx) => o.is_correct = (idx === oIndex));
                                            setQuestions(newQ);
                                        }}
                                        className={`transition-colors ${opt.is_correct ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'}`}
                                    >
                                        {opt.is_correct ? <CheckCircle size={20} /> : <Circle size={20} />}
                                    </button>
                                    <input
                                        type="text"
                                        value={opt.label}
                                        onChange={e => {
                                            const newQ = [...questions];
                                            newQ[qIndex].options[oIndex].label = e.target.value;
                                            setQuestions(newQ);
                                        }}
                                        className={`flex-1 border-b ${opt.is_correct ? 'border-green-200 bg-green-50/50' : 'border-slate-200'} focus:border-blue-500 focus:outline-none px-2 py-1 text-sm`}
                                        placeholder={`Option ${oIndex + 1}`}
                                    />
                                    <button
                                        onClick={() => {
                                            const newQ = [...questions];
                                            const removedOption = newQ[qIndex].options[oIndex];
                                            
                                            // Track deletion if it's an existing option
                                            if (!removedOption.id.startsWith('new-')) {
                                                deletedOptionIdsRef.current.add(removedOption.id);
                                            }
                                            
                                            newQ[qIndex].options = newQ[qIndex].options.filter((_, idx) => idx !== oIndex);
                                            setQuestions(newQ);
                                        }}
                                        className="text-slate-300 hover:text-red-400"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    const newQ = [...questions];
                                    newQ[qIndex].options.push({ id: `new-opt-${Date.now()}`, label: '', is_correct: false });
                                    setQuestions(newQ);
                                }}
                                className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-2"
                            >
                                <Plus size={14} /> Add Option
                            </button>
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addQuestion}
                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={20} /> Add New Question
                </button>
            </form>
        </div>
    );
}
