import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Users, Settings, Plus, Trash2, Edit, Save, FileText, Video, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../features/auth/AuthProvider';

interface Course {
    id: string;
    code: string;
    title: string;
    description: string;
}

interface Lesson {
    id: string;
    title: string;
    type: 'pdf' | 'video' | 'text' | 'quiz';
    order: number;
    is_visible: boolean;
    quiz_id?: string;
}

export default function TeacherCourseDetail() {
    const { courseId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'content' | 'students' | 'settings'>('content');
    const [course, setCourse] = useState<Course | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');

    useEffect(() => {
        if (courseId && user) {
            fetchCourseData();
        }
    }, [courseId, user]);

    const fetchCourseData = async () => {
        try {
            setLoading(true);
            // Fetch Course
            const { data: courseData, error: courseError } = await supabase
                .from('courses')
                .select('*')
                .eq('id', courseId)
                .single();

            if (courseError) throw courseError;
            setCourse(courseData);
            setEditTitle(courseData.title);
            setEditDesc(courseData.description || '');

            // Fetch Lessons
            const { data: lessonData, error: lessonError } = await supabase
                .from('lessons')
                .select('*')
                .eq('course_id', courseId)
                .order('order', { ascending: true });

            if (lessonError) throw lessonError;
            setLessons(lessonData || []);

        } catch (err) {
            console.error('Error loading course:', err);
            // navigate('/teacher/courses'); 
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateCourse = async () => {
        if (!courseId) return;
        try {
            const { error } = await supabase
                .from('courses')
                .update({ title: editTitle, description: editDesc })
                .eq('id', courseId);

            if (error) throw error;
            setCourse(prev => prev ? ({ ...prev, title: editTitle, description: editDesc }) : null);
            setIsEditing(false);
        } catch (err) {
            alert('Failed to update course');
            console.error(err);
        }
    };

    const handleDeleteCourse = async () => {
        if (!confirm('Are you ABSOLUTELY SURE? This will delete the course, all lessons, and student enrollments. This cannot be undone.')) return;

        try {
            // Note: RLS policies must allow delete. 
            // Cascading delete in Postgres should handle related tables (lessons, enrollments).
            const { error } = await supabase
                .from('courses')
                .delete()
                .eq('id', courseId);

            if (error) {
                console.error('Delete error details:', error);
                throw error;
            }

            // Force local cleanup if needed?

            alert('Course deleted successfully');
            navigate('/teacher/courses');
        } catch (err: any) {
            console.error('Error deleting course:', err);
            alert('Failed to delete course: ' + (err.message || 'Unknown error'));
        }
    };

    const handleToggleVisibility = async (lesson: Lesson) => {
        try {
            // Optimistic Update
            setLessons(lessons.map(l => l.id === lesson.id ? { ...l, is_visible: !l.is_visible } : l));

            const { error } = await supabase
                .from('lessons')
                .update({ is_visible: !lesson.is_visible })
                .eq('id', lesson.id);

            if (error) throw error;
        } catch (err) {
            console.error('Error toggling visibility:', err);
            // Revert on error
            setLessons(lessons.map(l => l.id === lesson.id ? { ...l, is_visible: lesson.is_visible } : l));
            alert('Failed to update visibility');
        }
    };

    const handleDeleteLesson = async (lessonId: string) => {
        if (!confirm('Are you sure you want to delete this lesson? This cannot be undone.')) return;

        try {
            // Optimistic Update
            setLessons(lessons.filter(l => l.id !== lessonId));

            const { error } = await supabase
                .from('lessons')
                .delete()
                .eq('id', lessonId);

            if (error) throw error;
        } catch (err) {
            console.error('Error deleting lesson:', err);
            fetchCourseData(); // Revert by fetching
            alert('Failed to delete lesson');
        }
    };

    const handleCreateQuiz = async () => {
        if (!user || !courseId) return;
        const title = prompt("Enter Quiz Title:", "New Quiz");
        if (!title) return;

        try {
            // 1. Create Quiz
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .insert({
                    course_id: courseId,
                    title: title,
                    created_by: user.id,
                    published: false
                })
                .select()
                .single();

            if (quizError) throw quizError;

            // 2. Get Next Order
            const { data: lastLesson } = await supabase
                .from('lessons')
                .select('order')
                .eq('course_id', courseId)
                .order('order', { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextOrder = (lastLesson?.order || 0) + 1;

            // 3. Create Lesson
            const { error: lessonError } = await supabase
                .from('lessons')
                .insert({
                    course_id: courseId,
                    title: title,
                    type: 'quiz',
                    order: nextOrder,
                    quiz_id: quiz.id,
                    duration_minutes: 10,
                    is_visible: false // Hidden by default until published
                });

            if (lessonError) throw lessonError;

            // 4. Redirect
            navigate(`/teacher/courses/${courseId}/quiz/${quiz.id}`);

        } catch (err: any) {
            console.error('Error creating quiz:', err);
            alert('Error creating quiz: ' + (err.message || 'Unknown error'));
        }
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-500">Loading course details...</div>;
    }

    if (!course) {
        return <div className="p-12 text-center text-red-500">Course not found.</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* ... Header & Tabs omitted for brevity in replace, but matched by context ... */}
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-14 z-30">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <Link to="/teacher/courses" className="text-slate-500 hover:text-blue-600 flex items-center gap-2 mb-2 text-sm">
                        <ArrowLeft size={16} /> Back to Courses
                    </Link>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase">{course.code}</span>
                                {!isEditing ? (
                                    <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
                                ) : (
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        className="text-2xl font-bold border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                            </div>
                            {!isEditing ? (
                                <p className="text-slate-500 mt-1 max-w-2xl">{course.description || 'No description'}</p>
                            ) : (
                                <textarea
                                    className="mt-1 w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editDesc}
                                    onChange={e => setEditDesc(e.target.value)}
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-slate-600 text-sm hover:bg-slate-100 rounded-lg">Cancel</button>
                                    <button onClick={handleUpdateCourse} className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center gap-1">
                                        <Save size={16} /> Save
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 flex items-center gap-2">
                                    <Edit size={16} /> Edit Info
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-6 mt-6 border-b border-transparent">
                        <button
                            onClick={() => setActiveTab('content')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'content' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <BookOpen size={18} /> Content ({lessons.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('students')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'students' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <Users size={18} /> Students
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <Settings size={18} /> Settings
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                {activeTab === 'content' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <div>
                                <h3 className="font-bold text-blue-900">Course Materials</h3>
                                <p className="text-sm text-blue-700">Manage lessons, videos, and quizzes.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link to={`/teacher/upload?courseId=${courseId}`} className="px-3 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg font-medium hover:bg-blue-50 flex items-center gap-2 text-sm">
                                    <Plus size={16} /> Add Media
                                </Link>
                                <button
                                    onClick={handleCreateQuiz}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm"
                                >
                                    <Plus size={16} /> Create Quiz
                                </button>
                            </div>
                        </div>

                        {lessons.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                                <p className="text-slate-400">No content uploaded yet.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {lessons.map((lesson) => (
                                    <div key={lesson.id} className={`bg-white p-4 rounded-lg border shadow-sm flex items-center justify-between group transition-all ${!lesson.is_visible ? 'opacity-60 border-slate-200 bg-slate-50' : 'border-slate-200 hover:border-blue-300'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${lesson.type === 'video' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {lesson.type === 'video' ? <Video size={20} /> : <FileText size={20} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium text-slate-900">{lesson.title}</h4>
                                                    {!lesson.is_visible && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded uppercase font-bold">Hidden</span>}
                                                </div>
                                                <p className="text-xs text-slate-500 capitalize">{lesson.type} • Lesson {lesson.order}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleToggleVisibility(lesson)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title={lesson.is_visible ? "Hide from students" : "Show to students"}
                                            >
                                                {lesson.is_visible ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const newTitle = prompt('Edit Lesson Title:', lesson.title);
                                                    if (newTitle && newTitle !== lesson.title) {
                                                        supabase.from('lessons').update({ title: newTitle }).eq('id', lesson.id).then(({ error }) => {
                                                            if (!error) {
                                                                setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, title: newTitle } : l));
                                                            } else {
                                                                alert('Failed to update title');
                                                            }
                                                        });
                                                    }
                                                }}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Edit Title"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            {/* Quiz Edit Link */}
                                            {lesson.type === 'quiz' && lesson.quiz_id && (
                                                <Link
                                                    to={`/teacher/courses/${courseId}/quiz/${lesson.quiz_id}`}
                                                    className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                                    title="Edit Quiz Content"
                                                >
                                                    <BookOpen size={18} />
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => handleDeleteLesson(lesson.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Delete Lesson"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="max-w-xl">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Trash2 size={20} className="text-red-500" /> Danger Zone
                            </h3>
                            <p className="text-sm text-slate-600 mb-4">
                                Deleting this course will permanently remove:
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>All uploaded lessons and files</li>
                                    <li>Student enrollments and progress</li>
                                    <li>Quiz scores and submissions</li>
                                </ul>
                            </p>
                            <button
                                onClick={handleDeleteCourse}
                                className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-100 transition-colors"
                            >
                                Delete Course Permanently
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'students' && (
                    <div className="text-center py-12 text-slate-400">
                        Student management coming soon...
                    </div>
                )}
            </div>
        </div>
    );
}
