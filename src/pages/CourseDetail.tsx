import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, PlayCircle, CheckCircle, BookOpen, HelpCircle, Download, RefreshCw, Bell, AlertCircle } from "lucide-react";
import { db, type Course, type Lesson, type LessonProgress, type Announcement } from "../lib/db";
import { useAuth } from '../features/auth/AuthProvider';
import { useDownloadCourse } from '../hooks/useDownloadCourse';

export default function CourseDetail() {
  const { user } = useAuth();
  const { courseId } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [progress, setProgress] = useState<Map<string, LessonProgress>>(new Map());
  const [completionRate, setCompletionRate] = useState(0);

  const { downloadCourse, downloading, progress: downloadProgress, status: downloadStatus } = useDownloadCourse();

  useEffect(() => {
    const loadCourseData = async () => {
      if (!courseId) return;

      // Fetch course
      const courseData = await db.courses.get(courseId);
      if (courseData) setCourse(courseData);

      // Fetch lessons
      const lessonsData = await db.lessons
        .where({ courseId })
        .filter(l => l.isVisible !== false)
        .sortBy('order');
      setLessons(lessonsData);

      // Fetch Announcements
      const announcementsData = await db.announcements
        .where({ courseId })
        .reverse() // Newest first
        .sortBy('createdAt');
      setAnnouncements(announcementsData);

      // Fetch progress
      if (!user?.id) return;
      const progressData = await db.lessonProgress
        .where({ courseId, studentId: user.id })
        .toArray();

      const progressMap = new Map<string, LessonProgress>();
      progressData.forEach(p => progressMap.set(p.lessonId, p));
      setProgress(progressMap);

      // Calculate completion rate
      const completed = progressData.filter(p => p.completed).length;
      const rate = lessonsData.length > 0 ? (completed / lessonsData.length) * 100 : 0;
      setCompletionRate(Math.round(rate));
    };

    loadCourseData();
  }, [courseId, downloading, user?.id]);

  const getLessonIcon = (type: string) => {
    switch (type) {
      case 'video': return PlayCircle;
      case 'pdf': return FileText;
      case 'quiz': return HelpCircle;
      case 'text': return BookOpen;
      default: return FileText;
    }
  };

  if (!course) return <div className="p-8 text-center">Loading Course...</div>;

  return (
    <div className="pb-24 lg:pb-8 bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="bg-blue-900 text-white p-6 sm:p-8 lg:p-10 pt-8 rounded-b-3xl shadow-lg">
        <div className="container mx-auto max-w-7xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" /> Back to Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{course.title}</h1>
              <p className="opacity-80 text-sm sm:text-base mt-1">{course.code}</p>
            </div>

            <button
              onClick={() => downloadCourse(course.id)}
              disabled={downloading || course.isDownloaded}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${course.isDownloaded
                ? 'bg-green-500/20 text-green-200 cursor-default'
                : downloading
                  ? 'bg-blue-800 text-blue-200 cursor-wait'
                  : 'bg-white text-blue-900 hover:bg-blue-50'
                }`}
            >
              {downloading ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  {downloadProgress}%
                </>
              ) : course.isDownloaded ? (
                <>
                  <CheckCircle size={20} />
                  Offline Ready
                </>
              ) : (
                <>
                  <Download size={20} />
                  Download Course
                </>
              )}
            </button>
          </div>

          {downloading && (
            <p className="text-xs text-blue-300 mt-2 text-right animate-pulse">{downloadStatus}</p>
          )}

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <span
              className={`text-xs sm:text-sm px-3 py-1 sm:py-1.5 rounded font-medium ${course.isDownloaded ? "bg-green-500 text-white" : "bg-white/20"
                }`}
            >
              {course.isDownloaded ? "Available Offline" : "Online Only"}
            </span>
            <span className="text-xs sm:text-sm px-3 py-1 sm:py-1.5 rounded font-medium bg-white/20">
              {lessons.length} Lessons • {course.estimatedHours || 0}h
            </span>
            <span className="text-xs sm:text-sm px-3 py-1 sm:py-1.5 rounded font-medium bg-white/20">
              {completionRate}% Complete
            </span>
          </div>

          {/* Progress Bar */}
          {completionRate > 0 && (
            <div className="mt-4 w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6">
        {/* ANNOUNCEMENTS SECTION */}
        {announcements.length > 0 && (
          <div className="mb-8 relative z-10">
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="bg-orange-50 px-6 py-3 border-b border-orange-100 flex items-center gap-2">
                <Bell className="text-orange-600" size={18} />
                <h3 className="font-bold text-orange-900 text-sm uppercase tracking-wide">Latest Announcements</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {announcements.map(announcement => (
                  <div key={announcement.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {announcement.isUrgent && (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                              <AlertCircle size={10} /> Urgent
                            </span>
                          )}
                          <h4 className="font-bold text-slate-900">{announcement.title}</h4>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">{announcement.content}</p>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(announcement.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODULE LIST */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="font-bold text-slate-800 mb-6 text-xl flex items-center gap-2">
            <BookOpen className="text-blue-600" size={24} />
            Course Curriculum
          </h2>

          {lessons.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <p>No lessons available yet.</p>
              <p className="text-sm mt-1">Check back later for content updates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {lessons.map((lesson) => {
                const isCompleted = progress.get(lesson.id)?.completed || false;
                const Icon = getLessonIcon(lesson.type);
                const linkPath = lesson.type === 'quiz'
                  ? `/quiz/${lesson.quizId || 'quiz-1'}`
                  : `/lesson/${lesson.id}`;

                return (
                  <Link to={linkPath} key={lesson.id}>
                    <div className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-center gap-4">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isCompleted
                        ? 'bg-green-100 text-green-600'
                        : lesson.type === 'quiz' ? 'bg-purple-100 text-purple-600'
                          : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                        }`}>
                        {isCompleted ? <CheckCircle size={24} /> : <Icon size={24} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Lesson {lesson.order}
                          </span>
                          {lesson.type === 'quiz' && (
                            <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">QUIZ</span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors truncate">
                          {lesson.title}
                        </h3>
                        <p className="text-sm text-slate-500 capitalize flex items-center gap-2">
                          {lesson.duration} mins • {lesson.type}
                        </p>
                      </div>

                      <div className="hidden sm:block">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isCompleted ? 'border-green-500 bg-green-50 text-green-600' : 'border-slate-200 text-slate-300 group-hover:border-blue-300 group-hover:text-blue-300'
                          }`}>
                          <ArrowLeft className="rotate-180" size={16} strokeWidth={3} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
