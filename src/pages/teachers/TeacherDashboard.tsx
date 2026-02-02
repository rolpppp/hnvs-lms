// src/pages/teachers/TeacherDashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, Loader2, Users, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../features/auth/AuthProvider';

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  student_count?: number;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [optError, setOptError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCourses();
    }
  }, [user]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      // Fetch courses created by this teacher
      const { data: coursesData, error } = await supabase
        .from('courses')
        .select('*')
        .eq('created_by', user?.id) // Filter by creator
        .order('created_at', { ascending: false });

      if (error) throw error;

      // In a real app, we'd also fetch student counts per course
      // For now, we'll just map the raw data
      setCourses(coursesData || []);

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
          created_by: user.id,
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
      if (err.code === '23505') {
        setOptError('Subject code already exists. Please use a unique code.');
      } else {
        setOptError('Failed to create subject. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">My Subjects</h1>
              <p className="text-slate-500 mt-1">Manage your classes, content, and students</p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus size={20} />
              New Subject
            </button>
          </div>
        </div>
      </div>

      {/* Create Subject Form */}
      {isCreating && (
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Create New Subject</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject Code</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. AUTO-101"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Automotive Basics"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 size={32} className="animate-spin mb-4" />
            <p>Loading subjects...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen size={40} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">No subjects yet</h2>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">
              Get started by creating your first subject to share content and assignments with students.
            </p>
            <button className="text-blue-600 font-bold hover:underline">
              Create your first subject
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link
                key={course.id}
                to={`/teacher/courses/${course.id}`}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all overflow-hidden flex flex-col"
              >
                <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <BookOpen size={100} />
                  </div>
                  <span className="inline-block bg-white/20 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm w-fit">
                    {course.code}
                  </span>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-slate-500 text-sm line-clamp-2 mb-6 flex-1">
                    {course.description || "No description provided."}
                  </p>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Users size={16} />
                      <span>-- Students</span> {/* Placeholder for count */}
                    </div>
                    <span className="text-blue-600 text-sm font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Manage <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}