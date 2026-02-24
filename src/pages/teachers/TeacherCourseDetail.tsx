import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Users, Settings, Plus, Trash2, Edit, Save, FileText, Video, Eye, EyeOff, Search, Bell, Calendar, ExternalLink, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../features/auth/AuthProvider';
import AnnouncementManager from './AnnouncementManager';
import AssignmentManager from './AssignmentManager';

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
    week_number?: number | null;
    quiz_id?: string;
}

interface StudentMetric {
    id: string;
    name: string;
    joinedAt: string;
    quizzesTaken: number;
    avgScore: number;
}

export default function TeacherCourseDetail() {
    const { courseId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'content' | 'assignments' | 'announcements' | 'students' | 'settings'>('content');
    const [course, setCourse] = useState<Course | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [students, setStudents] = useState<StudentMetric[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');

    // Quiz Creation Form State
    const [showQuizForm, setShowQuizForm] = useState(false);
    const [quizFormData, setQuizFormData] = useState({
        title: '',
        weekNumber: 1,
        lessonOrder: 1
    });
    const [quizFormErrors, setQuizFormErrors] = useState<{title?: string; weekNumber?: string; lessonOrder?: string}>({});

    // Lesson Title Editing State
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
    const [editingLessonTitle, setEditingLessonTitle] = useState('');

    const fetchCourseData = useCallback(async () => {
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
    }, [courseId]);

    const fetchStudentData = useCallback(async () => {
        if (!courseId) return;
        try {
            // 1. Fetch Enrollments
            const { data: enrollments, error: enrollError } = await supabase
                .from('enrollments')
                .select('student_id, enrolled_at')
                .eq('course_id', courseId);

            if (enrollError) throw enrollError;
            if (!enrollments || enrollments.length === 0) {
                setStudents([]);
                return;
            }

            const studentIds = enrollments.map(e => e.student_id);

            // 2. Fetch Profiles
            const { data: profiles, error: profError } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .in('id', studentIds);

            if (profError) throw profError;

            // 3. Fetch Quizzes for this course (to filter submissions)
            const { data: quizzes } = await supabase.from('quizzes').select('id').eq('course_id', courseId);
            const quizIds = quizzes?.map(q => q.id) || [];

            // 4. Fetch Submissions
            interface Submission {
                student_id: string;
                score: number;
                quiz_id: string;
            }
            let submissions: Submission[] = [];
            if (quizIds.length > 0) {
                const { data: subs } = await supabase
                    .from('quiz_submissions')
                    .select('student_id, score, quiz_id')
                    .in('quiz_id', quizIds);
                submissions = subs || [];
            }

            // 5. Aggregate
            const metrics = enrollments.map(enroll => {
                const profile = profiles?.find(p => p.id === enroll.student_id);
                const studentSubs = submissions.filter(s => s.student_id === enroll.student_id);

                // Calculate Average
                const totalScore = studentSubs.reduce((acc: number, curr: Submission) => acc + curr.score, 0);
                const avg = studentSubs.length > 0 ? (totalScore / studentSubs.length).toFixed(1) : '0.0';

                return {
                    id: enroll.student_id,
                    name: profile?.full_name || 'Unknown Student',
                    joinedAt: new Date(enroll.enrolled_at).toLocaleDateString(),
                    quizzesTaken: studentSubs.length,
                    avgScore: parseFloat(avg)
                };
            });

            setStudents(metrics);

        } catch (err) {
            console.error("Error fetching students:", err);
        }
    }, [courseId]);

    useEffect(() => {
        if (courseId && user) {
            fetchCourseData();
        }
    }, [courseId, user, fetchCourseData]);

    // Fetch Student Data when tab changes to 'students'
    useEffect(() => {
        if (activeTab === 'students' && courseId) {
            fetchStudentData();
        }
    }, [activeTab, courseId, fetchStudentData]);

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
        } catch (err: unknown) {
            console.error('Error deleting course:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            alert('Failed to delete course: ' + errorMessage);
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

    // Get next available lesson order
    const getNextLessonOrder = () => {
        if (lessons.length === 0) return 1;
        const maxOrder = Math.max(...lessons.map(l => l.order));
        return maxOrder + 1;
    };

    // Get available lesson orders for a given week
    const getAvailableLessonOrders = (weekNumber: number) => {
        const lessonsInWeek = lessons.filter(l => l.week_number === weekNumber);
        const usedOrders = lessonsInWeek.map(l => l.order);
        const maxOrder = lessons.length > 0 ? Math.max(...lessons.map(l => l.order)) : 0;
        const availableOrders: number[] = [];
        
        // Suggest orders 1 through max+5
        for (let i = 1; i <= maxOrder + 5; i++) {
            if (!usedOrders.includes(i)) {
                availableOrders.push(i);
            }
        }
        return availableOrders;
    };

    // Get existing weeks
    const getExistingWeeks = () => {
        const weeks = new Set<number>();
        lessons.forEach(l => {
            if (l.week_number) weeks.add(l.week_number);
        });
        return Array.from(weeks).sort((a, b) => a - b);
    };

    const validateQuizForm = () => {
        const errors: {title?: string; weekNumber?: string; lessonOrder?: string} = {};
        
        if (!quizFormData.title.trim()) {
            errors.title = 'Quiz title is required';
        }
        
        if (quizFormData.weekNumber < 1) {
            errors.weekNumber = 'Week number must be at least 1';
        }
        
        if (quizFormData.lessonOrder < 1) {
            errors.lessonOrder = 'Lesson order must be at least 1';
        }
        
        // Check if lesson order already exists
        const existingLesson = lessons.find(l => l.order === quizFormData.lessonOrder);
        if (existingLesson) {
            errors.lessonOrder = `Lesson #${quizFormData.lessonOrder} already exists. Choose a different number.`;
        }
        
        setQuizFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !courseId) return;
        
        if (!validateQuizForm()) return;

        try {
            // 1. Create Quiz
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .insert({
                    course_id: courseId,
                    title: quizFormData.title,
                    created_by: user.id,
                    published: false
                })
                .select()
                .single();

            if (quizError) throw quizError;

            // 2. Create Lesson
            const { error: lessonError } = await supabase
                .from('lessons')
                .insert({
                    course_id: courseId,
                    title: quizFormData.title,
                    type: 'quiz',
                    order: quizFormData.lessonOrder,
                    week_number: quizFormData.weekNumber,
                    quiz_id: quiz.id,
                    duration_minutes: 10,
                    is_visible: false // Hidden by default until published
                });

            if (lessonError) throw lessonError;

            // 3. Reset and close form
            setQuizFormData({ title: '', weekNumber: 1, lessonOrder: getNextLessonOrder() });
            setShowQuizForm(false);

            // 4. Redirect
            navigate(`/teacher/courses/${courseId}/quiz/${quiz.id}`);

        } catch (err: unknown) {
            console.error('Error creating quiz:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            alert('Error creating quiz: ' + errorMessage);
        }
    };

    const handleStartQuizCreation = () => {
        setQuizFormData({
            title: '',
            weekNumber: Math.max(...getExistingWeeks(), 1),
            lessonOrder: getNextLessonOrder()
        });
        setQuizFormErrors({});
        setShowQuizForm(true);
    };

    const handleSaveLessonTitle = async (lessonId: string) => {
        if (!editingLessonTitle.trim()) {
            setEditingLessonId(null);
            return;
        }

        try {
            const { error } = await supabase
                .from('lessons')
                .update({ title: editingLessonTitle })
                .eq('id', lessonId);

            if (error) throw error;

            setLessons(prev => prev.map(l => 
                l.id === lessonId ? { ...l, title: editingLessonTitle } : l
            ));
            setEditingLessonId(null);
        } catch (err) {
            console.error('Error updating lesson title:', err);
            alert('Failed to update lesson title');
        }
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-500">Loading course details...</div>;
    }

    if (!course) {
        return <div className="p-12 text-center text-red-500">Course not found.</div>;
    }

    const sortedLessons = [...lessons].sort((a, b) => {
        const weekA = a.week_number ?? Number.MAX_SAFE_INTEGER;
        const weekB = b.week_number ?? Number.MAX_SAFE_INTEGER;
        if (weekA !== weekB) return weekA - weekB;
        return a.order - b.order;
    });

    const lessonsByWeek = sortedLessons.reduce<Record<string, Lesson[]>>((acc, lesson) => {
        const key = lesson.week_number ? `Week ${lesson.week_number}` : 'Unassigned';
        if (!acc[key]) acc[key] = [];
        acc[key].push(lesson);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-14 z-30">
                <div className="max-w-5xl mx-auto px-4 py-6">
                    <Link to="/teacher" className="text-slate-500 hover:text-blue-600 flex items-center gap-2 mb-2 text-sm">
                        <ArrowLeft size={16} /> Back to Subjects
                    </Link>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold uppercase">{course.code}</span>
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
                                <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
                                    <Edit size={16} /> Edit Info
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-6 mt-6 border-b border-transparent overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('content')}
                            className={`pb - 3 text - sm font - 2 transition - colors flex items - center gap - 2 whitespace - nowrap ${activeTab === 'content' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'} `}
                        >
                            <BookOpen size={18} /> Content ({lessons.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('announcements')}
                            className={`pb - 3 text - sm font - 2 transition - colors flex items - center gap - 2 whitespace - nowrap ${activeTab === 'announcements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'} `}
                        >
                            <Bell size={18} /> Announcements
                        </button>
                        <button
                            onClick={() => setActiveTab('assignments')}
                            className={`pb - 3 text - sm font - 2 transition - colors flex items - center gap - 2 whitespace - nowrap ${activeTab === 'assignments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'} `}
                        >
                            <Calendar size={18} /> Assignments
                        </button>
                        <button
                            onClick={() => setActiveTab('students')}
                            className={`pb - 3 text - sm font - 2 transition - colors flex items - center gap - 2 whitespace - nowrap ${activeTab === 'students' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'} `}
                        >
                            <Users size={18} /> Students
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`pb - 3 text - sm font - 2 transition - colors flex items - center gap - 2 whitespace - nowrap ${activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'} `}
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
                        <div className="flex justify-between items-center bg-gradient-to-r from-blue-800 to-blue-900 p-6 rounded-xl shadow-sm">
                            <div>
                                <h3 className="font-bold text-white text-lg">Subject Materials</h3>
                                <p className="text-sm text-blue-100">Manage lessons, videos, and quizzes.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Link to={`/teacher/upload?courseId=${courseId}`} className="px-4 py-2.5 bg-white/20 backdrop-blur-sm text-white rounded-lg font-medium hover:bg-white/30 transition-all flex items-center gap-2 text-sm">
                                    <Plus size={18} /> Add Media
                                </Link>
                                <button
                                    onClick={handleStartQuizCreation}
                                    className="px-4 py-2.5 bg-white text-blue-600 rounded-lg font-medium hover:shadow-md transition-all flex items-center gap-2 text-sm"
                                >
                                    <Plus size={18} /> Create Quiz
                                </button>
                            </div>
                        </div>

                        {/* Quiz Creation Form */}
                        {showQuizForm && (
                            <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        <Plus size={20} /> Create New Quiz
                                    </h3>
                                    <button
                                        onClick={() => setShowQuizForm(false)}
                                        className="text-white/80 hover:text-white transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <form onSubmit={handleCreateQuiz} className="p-6 space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Quiz Title <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={quizFormData.title}
                                            onChange={e => setQuizFormData({...quizFormData, title: e.target.value})}
                                            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                quizFormErrors.title ? 'border-red-300 bg-red-50' : 'border-slate-300'
                                            }`}
                                            placeholder="e.g., Chapter 1 Quiz"
                                            autoFocus
                                        />
                                        {quizFormErrors.title && (
                                            <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                                <span className="font-bold">!</span> {quizFormErrors.title}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Week Number <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={quizFormData.weekNumber}
                                                    onChange={e => setQuizFormData({
                                                        ...quizFormData,
                                                        weekNumber: parseInt(e.target.value)
                                                    })}
                                                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white ${
                                                        quizFormErrors.weekNumber ? 'border-red-300 bg-red-50' : 'border-slate-300'
                                                    }`}
                                                >
                                                    {getExistingWeeks().length === 0 && <option value={1}>Week 1 (New)</option>}
                                                    {getExistingWeeks().map(week => (
                                                        <option key={week} value={week}>Week {week}</option>
                                                    ))}
                                                    {(() => {
                                                        const maxWeek = Math.max(...getExistingWeeks(), 0);
                                                        return Array.from({ length: 3 }, (_, i) => maxWeek + i + 1).map(week => (
                                                            <option key={week} value={week}>Week {week} (New)</option>
                                                        ));
                                                    })()}
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <svg width="12" height="8" viewBox="0 0 12 8" fill="currentColor">
                                                        <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                                                    </svg>
                                                </div>
                                            </div>
                                            {quizFormErrors.weekNumber && (
                                                <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                                    <span className="font-bold">!</span> {quizFormErrors.weekNumber}
                                                </p>
                                            )}
                                            <p className="text-xs text-slate-500 mt-1">Existing weeks: {getExistingWeeks().join(', ') || 'None'}</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Lesson Order <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={quizFormData.lessonOrder}
                                                    onChange={e => setQuizFormData({
                                                        ...quizFormData,
                                                        lessonOrder: parseInt(e.target.value)
                                                    })}
                                                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white ${
                                                        quizFormErrors.lessonOrder ? 'border-red-300 bg-red-50' : 'border-slate-300'
                                                    }`}
                                                >
                                                    {getAvailableLessonOrders(quizFormData.weekNumber).slice(0, 10).map(order => (
                                                        <option key={order} value={order}>
                                                            Lesson #{order}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <svg width="12" height="8" viewBox="0 0 12 8" fill="currentColor">
                                                        <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                                                    </svg>
                                                </div>
                                            </div>
                                            {quizFormErrors.lessonOrder && (
                                                <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                                    <span className="font-bold">!</span> {quizFormErrors.lessonOrder}
                                                </p>
                                            )}
                                            <p className="text-xs text-slate-500 mt-1">
                                                Available slots shown (avoiding conflicts)
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="submit"
                                            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Check size={18} /> Create Quiz
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowQuizForm(false)}
                                            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {lessons.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-xl">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <BookOpen className="text-slate-400" size={28} />
                                </div>
                                <p className="text-slate-500 font-medium">No content uploaded yet</p>
                                <p className="text-slate-400 text-sm mt-1">Start by adding media or creating a quiz</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(lessonsByWeek).map(([weekLabel, weekLessons]) => (
                                    <div key={weekLabel} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-slate-700">{weekLabel}</h4>
                                            <span className="text-xs text-slate-400">{weekLessons.length} item(s)</span>
                                        </div>
                                        <div className="grid gap-3">
                                            {weekLessons.map((lesson) => (
                                                <div key={lesson.id} className={`bg-white p-5 rounded-xl shadow-sm hover:shadow-md flex items-center justify-between group transition-all ${!lesson.is_visible ? 'opacity-50' : ''}`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-xl ${lesson.type === 'video' ? 'bg-purple-500 text-white' : lesson.type === 'quiz' ? 'bg-green-500 text-white' : lesson.type === 'text' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}`}>
                                                            {lesson.type === 'video' && <Video size={20} />}
                                                            {lesson.type === 'pdf' && <FileText size={20} />}
                                                            {lesson.type === 'text' && <BookOpen size={20} />}
                                                            {lesson.type === 'quiz' && <BookOpen size={20} />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                {editingLessonId === lesson.id ? (
                                                                    <div className="flex items-center gap-2 flex-1">
                                                                        <input
                                                                            type="text"
                                                                            value={editingLessonTitle}
                                                                            onChange={e => setEditingLessonTitle(e.target.value)}
                                                                            onKeyDown={e => {
                                                                                if (e.key === 'Enter') handleSaveLessonTitle(lesson.id);
                                                                                if (e.key === 'Escape') setEditingLessonId(null);
                                                                            }}
                                                                            className="font-semibold text-slate-900 border-b-2 border-blue-500 focus:outline-none bg-blue-50 px-2 py-1 rounded"
                                                                            autoFocus
                                                                        />
                                                                        <button
                                                                            onClick={() => handleSaveLessonTitle(lesson.id)}
                                                                            className="text-green-600 hover:text-green-700 p-1"
                                                                            title="Save"
                                                                        >
                                                                            <Check size={18} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingLessonId(null)}
                                                                            className="text-slate-400 hover:text-slate-600 p-1"
                                                                            title="Cancel"
                                                                        >
                                                                            <X size={18} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {lesson.type !== 'quiz' ? (
                                                                            <Link
                                                                                to={`/teacher/lesson/${lesson.id}`}
                                                                                className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                                                                            >
                                                                                {lesson.title}
                                                                            </Link>
                                                                        ) : (
                                                                            <h4 className="font-semibold text-slate-900">{lesson.title}</h4>
                                                                        )}
                                                                        {!lesson.is_visible && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase font-bold">Hidden</span>}
                                                                    </>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-slate-500 capitalize">
                                                                {lesson.type} • {lesson.week_number ? `Week ${lesson.week_number}` : 'No week'} • Lesson {lesson.order}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleToggleVisibility(lesson)}
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title={lesson.is_visible ? "Hide from students" : "Show to students"}
                                                        >
                                                            {lesson.is_visible ? <EyeOff size={18} /> : <Eye size={18} />}
                                                        </button>
                                                        {lesson.type !== 'quiz' && (
                                                            <Link
                                                                to={`/teacher/lesson/${lesson.id}`}
                                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="View Material"
                                                            >
                                                                <ExternalLink size={18} />
                                                            </Link>
                                                        )}
                                                        {editingLessonId !== lesson.id && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingLessonId(lesson.id);
                                                                    setEditingLessonTitle(lesson.title);
                                                                }}
                                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit Title"
                                                            >
                                                                <Edit size={18} />
                                                            </button>
                                                        )}
                                                        {/* Quiz Edit Link */}
                                                        {lesson.type === 'quiz' && lesson.quiz_id && (
                                                            <Link
                                                                to={`/teacher/courses/${courseId}/quiz/${lesson.quiz_id}`}
                                                                className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                                title="Edit Quiz Content"
                                                            >
                                                                <BookOpen size={18} />
                                                            </Link>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteLesson(lesson.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete Lesson"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'announcements' && (
                    <AnnouncementManager courseId={courseId} />
                )}

                {activeTab === 'assignments' && (
                    <AssignmentManager courseId={courseId} />
                )}

                {activeTab === 'settings' && (
                    <div className="max-w-xl">
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <div className="bg-red-50 p-4 rounded-lg mb-4">
                                <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                                    <Trash2 size={20} /> Danger Zone
                                </h3>
                            </div>
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
                                className="w-full py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm hover:shadow-md"
                            >
                                Delete Course Permanently
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'students' && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-white p-5 rounded-xl shadow-sm">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search students..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                                />
                            </div>
                            <div className="text-sm text-slate-500 font-medium">
                                Total Students: <span className="text-slate-900">{students.length}</span>
                            </div>
                        </div>

                        {students.filter(s =>
                            s.name.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-xl">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Users className="text-slate-400" size={28} />
                                </div>
                                <p className="text-slate-500 font-medium">{searchQuery ? 'No students found matching your search' : 'No students enrolled yet'}</p>
                                <p className="text-slate-400 text-sm mt-1">{searchQuery ? 'Try a different search term' : 'Students will appear here once they enroll'}</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4">Student Name</th>
                                            <th className="px-6 py-4">Joined At</th>
                                            <th className="px-6 py-4 text-center">Quizzes Taken</th>
                                            <th className="px-6 py-4 text-right">Avg Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {students.filter(s =>
                                            s.name.toLowerCase().includes(searchQuery.toLowerCase())
                                        ).map(student => (
                                            <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-900">{student.name}</div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {student.joinedAt}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline - block px - 2 py - 1 rounded text - xs font - bold ${student.quizzesTaken > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'} `}>
                                                        {student.quizzesTaken}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-slate-900">
                                                    {student.avgScore > 0 ? student.avgScore : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
