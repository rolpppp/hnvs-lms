import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../features/auth/AuthProvider';
import { ArrowLeft, Plus, BookOpen, Edit, Trash2, Loader } from 'lucide-react';

interface Course {
    id: string;
    code: string;
    title: string;
    description: string | null;
    created_at: string;
}

export default function CourseManager() {
    const { user } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [code, setCode] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [optError, setOptError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchCourses();
    }, [user]);

    const fetchCourses = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .eq('created_by', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCourses(data || []);
        } catch (err) {
            console.error('Error fetching courses:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        setOptError(null);

        try {
            const { data, error } = await supabase
                .from('courses')
                .insert({
                    code,
                    title,
                    description,
                    created_by: user.id
                })
                .select()
                .single();

            if (error) throw error;

            setCourses([data, ...courses]);
            setIsCreating(false);
            setCode('');
            setTitle('');
            setDescription('');
        } catch (err: any) {
            console.error('Error creating course:', err);
            // specific error for duplicate code
            if (err.code === '23505') {
                setOptError('Course code already exists. Please use a unique code.');
            } else {
                setOptError('Failed to create course. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) return;

        try {
            const { error } = await supabase
                .from('courses')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setCourses(courses.filter(c => c.id !== id));
        } catch (err) {
            console.error('Error deleting course:', err);
            alert('Failed to delete course');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-blue-900 text-white p-6">
                <div className="max-w-4xl mx-auto">
                    <Link
                        to="/teacher"
                        className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-4 transition-colors"
                    >
                        <ArrowLeft size={18} /> Back to Dashboard
                    </Link>
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">Course Management</h1>
                            <p className="text-blue-100 text-sm">Create and manage your course offerings</p>
                        </div>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="bg-white text-blue-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-blue-50 transition-colors"
                        >
                            <Plus size={18} /> New Course
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-4">
                {/* Create Modal / Form Area */}
                {isCreating && (
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-6 animate-in slide-in-from-top-4">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Create New Course</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Course Code</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={10}
                                        placeholder="e.g. AUTO-101"
                                        value={code}
                                        onChange={e => setCode(e.target.value.toUpperCase())}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Course Title</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Automotive Basics"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {optError && (
                                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                                    {optError}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? <Loader className="animate-spin" size={16} /> : 'Create Course'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Course List */}
                {loading ? (
                    <div className="text-center py-12">
                        <Loader className="animate-spin h-8 w-8 text-blue-900 mx-auto" />
                        <p className="text-slate-500 mt-2">Loading courses...</p>
                    </div>
                ) : courses.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
                        <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-slate-900">No courses yet</h3>
                        <p className="text-slate-500 mb-4">Get started by creating your first course.</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="text-blue-600 font-bold hover:underline"
                        >
                            Create a Course
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {courses.map(course => (
                            <div key={course.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-300 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded uppercase">
                                            {course.code}
                                        </span>
                                        <h3 className="text-lg font-bold text-slate-800">{course.title}</h3>
                                    </div>
                                    <p className="text-slate-500 text-sm line-clamp-2">{course.description || 'No description provided.'}</p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Link
                                        to={`/teacher/courses/${course.id}`} // Future detail/edit page
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit Course"
                                    >
                                        <Edit size={18} />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(course.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Course"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
