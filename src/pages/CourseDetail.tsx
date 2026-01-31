import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, PlayCircle, CheckCircle, BookOpen, HelpCircle, Download, RefreshCw } from "lucide-react";
import { db, type Course, type Lesson, type LessonProgress } from "../lib/db";
import { useAuth } from '../features/auth/AuthProvider';
import { useDownloadCourse } from '../hooks/useDownloadCourse';

export default function CourseDetail() {
  const { user } = useAuth();
  const { courseId } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Map<string, LessonProgress>>(new Map());
  const [completionRate, setCompletionRate] = useState(0);

  const { downloadCourse, downloading, progress: downloadProgress, status: downloadStatus } = useDownloadCourse();

  useEffect(() => {
    loadCourseData();
  }, [courseId, downloading]); // Reload when downloading finishes

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
    <div className="pb-24 lg:pb-8">
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

      {/* MODULE LIST */}
      <div className="p-4 sm:p-6 lg:p-8 container mx-auto max-w-7xl">
        <h2 className="font-bold text-slate-800 mb-4 sm:mb-6 text-lg sm:text-xl lg:text-2xl">
          Course Lessons
        </h2>

        {lessons.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p>No lessons available yet. Download this course to access content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {lessons.map((lesson) => {
              const isCompleted = progress.get(lesson.id)?.completed || false;
              const Icon = getLessonIcon(lesson.type);
              const linkPath = lesson.type === 'quiz'
                ? `/quiz/${lesson.quizId || 'quiz-1'}`
                : `/lesson/${lesson.id}`;

              return (
                <Link to={linkPath} key={lesson.id}>
                  <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md active:scale-[0.98] transition-all cursor-pointer group">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1">
                      {/* Icon based on Type */}
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${lesson.type === 'quiz' ? 'bg-purple-100 text-purple-600' :
                          lesson.type === 'video' ? 'bg-blue-100 text-blue-600' :
                            lesson.type === 'pdf' ? 'bg-red-100 text-red-600' :
                              'bg-slate-100 text-slate-600'
                        } group-hover:scale-110 transition-transform`}>
                        <Icon size={20} className="sm:w-6 sm:h-6" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-400 font-medium">
                            Lesson {lesson.order}
                          </span>
                          {isCompleted && (
                            <CheckCircle size={14} className="text-green-500" />
                          )}
                        </div>
                        <h3 className="font-medium text-slate-800 text-sm sm:text-base line-clamp-1">
                          {lesson.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 capitalize line-clamp-1">
                          {lesson.type} • {lesson.duration} mins
                        </p>
                      </div>
                    </div>

                    {/* Status Icon */}
                    {isCompleted && (
                      <div className="ml-2 shrink-0">
                        <CheckCircle size={20} className="text-green-500 sm:w-6 sm:h-6" />
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
