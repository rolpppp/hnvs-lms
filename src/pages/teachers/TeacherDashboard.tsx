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
            <Link
              to="/teacher/courses"
              // Note: Ideally /teacher/courses/new or a modal. 
              // For now, linking to existing CourseManager might be redundant if this IS the dashboard.
              // Let's assume CourseManager IS the list, so we might want a "Create Course" button here 
              // that opens a modal or navigates to a create page.
              // Since CourseManager likely has create logic, let's keep it simple for now.
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
              onClick={(e) => {
                e.preventDefault();
                // For prototype, just alert or navigate if we have a create page
                const title = prompt("Enter Course Title:");
                if (title) alert("Imagine this created a course: " + title);
              }}
            >
              <Plus size={20} />
              New Course
            </Link>
          </div>
        </div>
      </div>

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