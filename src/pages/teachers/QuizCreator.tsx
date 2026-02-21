import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, CheckCircle, Circle, GripVertical, Check, AlertCircle, Loader2, Eye, EyeOff, X } from 'lucide-react';
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

type UnsavedAction = 'navigate' | 'publish' | 'unpublish';

interface UnsavedChangesModal {
    show: boolean;
    action: UnsavedAction;
    onConfirmSave: () => Promise<void>;
    onDiscard: () => void;
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
    const [publishingStatus, setPublishingStatus] = useState<'idle' | 'loading'>('idle');
    const [unsavedModal, setUnsavedModal] = useState<UnsavedChangesModal>({
        show: false,
        action: 'navigate',
        onConfirmSave: async () => {},
        onDiscard: () => {},
    });
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
            const qIds = qData.map((q: { id: string }) => q.id);
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
            const fullQuestions = qData.map((q: Question & { id: string }) => ({
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

    // Validation helper
    const validateQuiz = useCallback((): string | null => {
        if (!quiz) return 'No quiz loaded.';
        if (!quiz.title.trim()) return 'Quiz title cannot be empty.';
        if (questions.length === 0) return 'Add at least one question before saving.';
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.prompt.trim()) return `Question ${i + 1} cannot be empty.`;
            if (q.options.length < 2) return `Question ${i + 1} must have at least 2 options.`;
            const hasCorrect = q.options.some(o => o.is_correct);
            if (!hasCorrect) return `Question ${i + 1} must have a correct answer selected.`;
            const hasEmptyOption = q.options.some(o => !o.label.trim());
            if (hasEmptyOption) return `All options in Question ${i + 1} must have text.`;
        }
        return null;
    }, [quiz, questions]);

    const handleSave = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!quiz) return;
        if (saveStatus === 'saving') return; // Prevent concurrent saves

        const validationError = validateQuiz();
        if (validationError) {
            setToastMessage({ type: 'error', message: validationError });
            return;
        }
        
        setSaveStatus('saving');
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
            lastSavedDataRef.current = JSON.stringify({ quiz, questions: updatedQuestions });
            setSaveStatus('saved');
            setHasUnsavedChanges(false);
            setToastMessage({ type: 'success', message: 'All changes saved' });

        } catch (err: unknown) {
            console.error('Save failed:', err);
            setSaveStatus('error');
            const errorMessage = err instanceof Error ? err.message : 'Save failed';
            setToastMessage({ type: 'error', message: errorMessage });
            setHasUnsavedChanges(true);
        }
    }, [quiz, questions, saveStatus, processOptions, validateQuiz]);

    const doTogglePublish = useCallback(async (targetQuiz: Quiz, newStatus: boolean) => {
        setPublishingStatus('loading');
        setQuiz(prev => prev ? { ...prev, published: newStatus } : prev);
        try {
            const { error: quizError } = await supabase
                .from('quizzes')
                .update({ published: newStatus })
                .eq('id', targetQuiz.id);

            if (quizError) throw quizError;

            const { error: lessonError } = await supabase
                .from('lessons')
                .update({ is_visible: newStatus })
                .eq('quiz_id', targetQuiz.id);

            if (lessonError) console.warn('Could not update lesson visibility:', lessonError);

            setToastMessage({
                type: 'success',
                message: newStatus ? 'Quiz published — students can now see it.' : 'Quiz unpublished — hidden from students.',
            });
        } catch (err: unknown) {
            console.error('Error updating publish status:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to update publish status';
            setToastMessage({ type: 'error', message: errorMessage });
            setQuiz(prev => prev ? { ...prev, published: !newStatus } : prev);
        } finally {
            setPublishingStatus('idle');
        }
    }, []);

    const handleTogglePublish = useCallback(async () => {
        if (!quiz) return;
        const newStatus = !quiz.published;
        const currentQuiz = quiz;

        if (newStatus) {
            const err = validateQuiz();
            if (err) {
                setToastMessage({ type: 'error', message: `Cannot publish: ${err}` });
                return;
            }
        }

        if (hasUnsavedChanges) {
            setUnsavedModal({
                show: true,
                action: newStatus ? 'publish' : 'unpublish',
                onConfirmSave: async () => {
                    setUnsavedModal(prev => ({ ...prev, show: false }));
                    await handleSave();
                    await doTogglePublish(currentQuiz, newStatus);
                },
                onDiscard: async () => {
                    setUnsavedModal(prev => ({ ...prev, show: false }));
                    await fetchQuizData();
                    await doTogglePublish(currentQuiz, newStatus);
                },
            });
            return;
        }

        await doTogglePublish(currentQuiz, newStatus);
    }, [quiz, hasUnsavedChanges, validateQuiz, handleSave, fetchQuizData, doTogglePublish]);

    // Effects
    useEffect(() => {
        if (quizId) fetchQuizData();
    }, [quizId, fetchQuizData]);

    // Keyboard shortcut (Cmd+S / Ctrl+S)
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

    // Auto-hide toast after 4 seconds
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    // Track unsaved changes (NO autosave — just flags the state)
    useEffect(() => {
        if (!quiz || loading) return;
        const currentData = JSON.stringify({ quiz, questions });
        if (lastSavedDataRef.current && currentData !== lastSavedDataRef.current) {
            setHasUnsavedChanges(true);
            setSaveStatus('unsaved');
        } else if (lastSavedDataRef.current && currentData === lastSavedDataRef.current) {
            setHasUnsavedChanges(false);
            setSaveStatus('saved');
        }
    }, [quiz, questions, loading]);

    // Browser tab / window close guard
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // Safe in-app navigation — shows unsaved-changes modal before leaving
    // (useBlocker requires a data-router; HashRouter doesn't support it)
    const safeNavigate = useCallback((to: string | number) => {
        const go = () => {
            if (typeof to === 'number') navigate(to);
            else navigate(to);
        };
        if (!hasUnsavedChanges) {
            go();
            return;
        }
        setUnsavedModal({
            show: true,
            action: 'navigate',
            onConfirmSave: async () => {
                setUnsavedModal(prev => ({ ...prev, show: false }));
                await handleSave();
                go();
            },
            onDiscard: () => {
                setUnsavedModal(prev => ({ ...prev, show: false }));
                setHasUnsavedChanges(false);
                go();
            },
        });
    }, [hasUnsavedChanges, navigate, handleSave]);

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

if (loading || !quiz) return (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <span>Loading quiz…</span>
        </div>
    );

    const validationError = validateQuiz();
    const canPublish = !validationError;

    return (
        <div className="min-h-screen bg-slate-50 pb-32">

            {/* Unsaved Changes Modal */}
            {unsavedModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-fade-in">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <AlertCircle size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 text-base">Unsaved Changes</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {unsavedModal.action === 'navigate'
                                        ? 'You have unsaved changes. What would you like to do before leaving?'
                                        : `You have unsaved changes. Save them before ${unsavedModal.action === 'publish' ? 'publishing' : 'unpublishing'}?`}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 pt-1">
                            <button
                                onClick={unsavedModal.onConfirmSave}
                                disabled={saveStatus === 'saving'}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                            >
                                {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Save Changes
                            </button>
                            <button
                                onClick={unsavedModal.onDiscard}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors"
                            >
                                {unsavedModal.action === 'navigate' ? 'Discard & Leave' : 'Discard Changes'}
                            </button>
                            <button
                                onClick={() => setUnsavedModal(prev => ({ ...prev, show: false }))}
                                className="w-full py-2.5 text-slate-500 hover:text-slate-700 rounded-lg font-medium text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-14 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    {/* Top row */}
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => safeNavigate(`/teacher/courses/${courseId}`)}
                            className="text-slate-500 hover:text-blue-600 flex items-center gap-2 text-sm transition-colors"
                        >
                            <ArrowLeft size={16} /> Back to Course
                        </button>

                        {/* Save status */}
                        <div className="flex items-center gap-2 text-xs select-none">
                            {saveStatus === 'saving' && (
                                <span className="flex items-center gap-1.5 text-blue-600">
                                    <Loader2 size={13} className="animate-spin" />
                                    <span className="font-medium">Saving…</span>
                                </span>
                            )}
                            {saveStatus === 'saved' && !hasUnsavedChanges && (
                                <span className="flex items-center gap-1.5 text-green-600">
                                    <Check size={13} />
                                    <span className="font-medium">All changes saved</span>
                                </span>
                            )}
                            {saveStatus === 'unsaved' && (
                                <span className="flex items-center gap-1.5 text-amber-600">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                                    <span className="font-medium">Unsaved changes</span>
                                </span>
                            )}
                            {saveStatus === 'error' && (
                                <span className="flex items-center gap-1.5 text-red-600">
                                    <AlertCircle size={13} />
                                    <span className="font-medium">Save failed</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Bottom row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <input
                                type="text"
                                value={quiz.title}
                                onChange={e => setQuiz({ ...quiz, title: e.target.value })}
                                className="text-xl font-bold border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full bg-transparent truncate"
                                placeholder="Quiz Title"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Attempts */}
                            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">Attempts:</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={quiz.allowed_attempts || 1}
                                    onChange={e => setQuiz({ ...quiz, allowed_attempts: parseInt(e.target.value) || 1 })}
                                    className="w-10 bg-transparent font-medium text-center focus:outline-none border-b border-transparent focus:border-blue-500 text-sm"
                                />
                            </div>

                            {/* Publish / Unpublish */}
                            <button
                                onClick={handleTogglePublish}
                                disabled={publishingStatus === 'loading' || (!quiz.published && !canPublish && !hasUnsavedChanges)}
                                title={!quiz.published && !canPublish ? `Cannot publish: ${validationError}` : undefined}
                                className={`px-4 py-2 rounded-lg font-medium text-sm border flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    quiz.published
                                        ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                                        : canPublish
                                            ? 'border-green-300 text-green-700 hover:bg-green-50'
                                            : 'border-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                {publishingStatus === 'loading' ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : quiz.published ? (
                                    <EyeOff size={14} />
                                ) : (
                                    <Eye size={14} />
                                )}
                                {quiz.published ? 'Unpublish' : 'Publish'}
                            </button>

                            {/* Save Changes — always visible */}
                            <button
                                onClick={() => handleSave()}
                                disabled={saveStatus === 'saving' || !hasUnsavedChanges}
                                title={hasUnsavedChanges ? 'Save changes (⌘S)' : 'No unsaved changes'}
                                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                                    hasUnsavedChanges
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                } disabled:opacity-70`}
                            >
                                {saveStatus === 'saving' ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <Save size={16} />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </div>

                    {/* Publish hint bar */}
                    {!quiz.published && !canPublish && questions.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <AlertCircle size={13} className="flex-shrink-0" />
                            <span>{validationError} — fix it to enable publishing.</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-20 right-4 z-50 max-w-xs w-full">
                    <div className={`rounded-xl shadow-xl px-4 py-3 flex items-start gap-3 border-l-4 ${
                        toastMessage.type === 'success'
                            ? 'bg-white border-green-500 text-green-800'
                            : 'bg-white border-red-500 text-red-800'
                    }`}>
                        {toastMessage.type === 'success' ? (
                            <Check size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <span className="font-medium text-sm flex-1">{toastMessage.message}</span>
                        <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600 ml-1">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <form onSubmit={(e) => { e.preventDefault(); handleSave(e); }} className="max-w-3xl mx-auto px-4 py-8 space-y-6">

                {questions.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <Circle size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-slate-500">No questions yet</p>
                        <p className="text-sm mt-1">Add your first question below to get started.</p>
                    </div>
                )}

                {questions.map((q, qIndex) => {
                    const hasCorrectAnswer = q.options.some(o => o.is_correct);
                    const hasEmptyOptions = q.options.some(o => !o.label.trim());
                    const hasIssue = !q.prompt.trim() || !hasCorrectAnswer || hasEmptyOptions || q.options.length < 2;

                    return (
                        <div
                            key={q.id}
                            className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                                hasIssue ? 'border-amber-300' : 'border-slate-200'
                            }`}
                        >
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-start gap-3">
                                <div className="mt-1 cursor-grab text-slate-400">
                                    <GripVertical size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Question {qIndex + 1}</span>
                                        {hasIssue && (
                                            <span className="text-xs text-amber-600 flex items-center gap-1">
                                                <AlertCircle size={11} />
                                                {!q.prompt.trim() ? 'Missing question text' : !hasCorrectAnswer ? 'No correct answer' : q.options.length < 2 ? 'Need ≥2 options' : 'Empty option'}
                                            </span>
                                        )}
                                    </div>
                                    <textarea
                                        value={q.prompt}
                                        onChange={e => {
                                            const newQ = [...questions];
                                            newQ[qIndex].prompt = e.target.value;
                                            setQuestions(newQ);
                                        }}
                                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-800 font-medium resize-none"
                                        placeholder="Enter your question here…"
                                        rows={2}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => deleteQuestion(q.id)}
                                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                                    title="Delete question"
                                >
                                    <Trash2 size={17} />
                                </button>
                            </div>

                            <div className="p-4 space-y-2.5">
                                {q.options.map((opt, oIndex) => (
                                    <div key={opt.id} className={`flex items-center gap-3 rounded-lg px-2 py-1 transition-colors ${opt.is_correct ? 'bg-green-50' : ''}`}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newQ = [...questions];
                                                newQ[qIndex].options.forEach((o, idx) => { o.is_correct = (idx === oIndex); });
                                                setQuestions(newQ);
                                            }}
                                            className={`flex-shrink-0 transition-colors ${opt.is_correct ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'}`}
                                            title={opt.is_correct ? 'Correct answer' : 'Mark as correct'}
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
                                            className={`flex-1 border-b ${opt.is_correct ? 'border-green-300' : 'border-slate-200'} focus:border-blue-500 focus:outline-none px-2 py-1 text-sm bg-transparent`}
                                            placeholder={`Option ${oIndex + 1}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newQ = [...questions];
                                                const removedOption = newQ[qIndex].options[oIndex];
                                                if (!removedOption.id.startsWith('new-')) {
                                                    deletedOptionIdsRef.current.add(removedOption.id);
                                                }
                                                newQ[qIndex].options = newQ[qIndex].options.filter((_, idx) => idx !== oIndex);
                                                setQuestions(newQ);
                                            }}
                                            className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                                            title="Remove option"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newQ = [...questions];
                                        newQ[qIndex].options.push({ id: `new-opt-${Date.now()}`, label: '', is_correct: false });
                                        setQuestions(newQ);
                                    }}
                                    className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-1 pl-1"
                                >
                                    <Plus size={13} /> Add Option
                                </button>
                            </div>
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={addQuestion}
                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={20} /> Add New Question
                </button>
            </form>

            {/* Sticky bottom save bar (mobile-friendly) */}
            {hasUnsavedChanges && (
                <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-lg px-4 py-3 flex items-center justify-between gap-3 sm:hidden">
                    <span className="text-sm text-amber-600 font-medium flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        Unsaved changes
                    </span>
                    <button
                        onClick={() => handleSave()}
                        disabled={saveStatus === 'saving'}
                        className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-60"
                    >
                        {saveStatus === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save
                    </button>
                </div>
            )}
        </div>
    );
}
