import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, CheckCircle, Circle, GripVertical, Settings } from 'lucide-react';
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
}

export default function QuizCreator() {
    const { courseId, quizId } = useParams();
    const navigate = useNavigate();

    // State
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (quizId) fetchQuizData();
    }, [quizId]);

    const fetchQuizData = async () => {
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
            let optionsMap: Record<string, Option[]> = {};

            if (qIds.length > 0) {
                const { data: oData, error: oError } = await supabase
                    .from('quiz_options')
                    .select('*')
                    .in('question_id', qIds);

                if (oError) throw oError;

                // Group by question_id
                oData.forEach((opt: any) => {
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

        } catch (err) {
            console.error('Error loading quiz:', err);
            alert('Failed to load quiz data');
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!quiz) return;
        setSaving(true);
        try {
            // 1. Update Quiz
            const { error: quizErr } = await supabase
                .from('quizzes')
                .update({ title: quiz.title, published: quiz.published })
                .eq('id', quiz.id);
            if (quizErr) throw quizErr;

            // 2. Upsert Questions & Options
            // Detailed logic:
            // For now, let's implement a simpler "Delete all and Insert" or "Upsert"
            // Upsert is safer.

            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                let qId = q.id;

                // Handle New Question
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
                } else {
                    // Update existing
                    await supabase
                        .from('quiz_questions')
                        .update({ prompt: q.prompt, order: i })
                        .eq('id', q.id);
                }

                // Handle Options
                // We'll delete existing options for this question and re-insert to handle deletions easily
                if (!q.id.startsWith('new-')) {
                    await supabase.from('quiz_options').delete().eq('question_id', qId);
                }

                const optionsToInsert = q.options.map(opt => ({
                    question_id: qId,
                    label: opt.label,
                    is_correct: opt.is_correct
                }));

                if (optionsToInsert.length > 0) {
                    const { error: optErr } = await supabase.from('quiz_options').insert(optionsToInsert);
                    if (optErr) throw optErr;
                }
            }

            // Handle Deleted Questions? 
            // We need to track deletions or just fetch fresh after save.
            // For MVP, tracking deletions is better, but fetching fresh is robust.

            await fetchQuizData(); // Refresh IDs
            alert('Quiz saved successfully!');

        } catch (err: any) {
            console.error('Save failed:', err);
            alert('Save failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

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

        if (!qId.startsWith('new-')) {
            await supabase.from('quiz_questions').delete().eq('id', qId);
        }
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
                        <div className="flex items-center gap-2">
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
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setQuiz({ ...quiz, published: !quiz.published })}
                                className={`px-4 py-2 rounded-lg font-medium text-sm border ${quiz.published ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
                            >
                                {quiz.published ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
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
                    onClick={addQuestion}
                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={20} /> Add New Question
                </button>
            </div>
        </div>
    );
}

function RefreshCw({ size, className }: { size: number, className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
        </svg>
    )
}
