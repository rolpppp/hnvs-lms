// src/pages/StudentProgress.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Award, Clock, CheckCircle, Target } from 'lucide-react';
import { db, type Course, type QuizAttempt } from '../lib/db';
import { useAuth } from '../features/auth/AuthProvider';

interface CourseProgress {
  course: Course;
  completed: number;
  total: number;
  percentage: number;
  timeSpent: number; // in minutes
  quizScores: number[];
}

export default function StudentProgress() {
  const { user } = useAuth();
  const [coursesProgress, setCoursesProgress] = useState<CourseProgress[]>([]);
  const [recentQuizzes, setRecentQuizzes] = useState<QuizAttempt[]>([]);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [overallCompletion, setOverallCompletion] = useState(0);

  useEffect(() => {
    if (user?.id) {
      loadProgressData();
    }
  }, [user?.id]);

  const loadProgressData = async () => {
    if (!user?.id) return;
    // Get all courses
    const courses = await db.courses.toArray();

    // Calculate progress for each course
    const progressData: CourseProgress[] = [];
    let totalLessons = 0;
    let totalCompleted = 0;
    let totalTime = 0;

    for (const course of courses) {
      const lessons = await db.lessons.where({ courseId: course.id }).toArray();
      const progress = await db.lessonProgress
        .where({ courseId: course.id, studentId: user.id })
        .toArray();

      const completed = progress.filter(p => p.completed).length;
      const timeSpent = progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);

      // Get quiz attempts for this course
      const quizIds = lessons
        .filter(l => l.type === 'quiz' && l.quizId)
        .map(l => l.quizId!);
      
      const quizScores: number[] = [];
      for (const quizId of quizIds) {
        const attempts = await db.quizAttempts
          .where({ quizId, studentId: user.id })
          .toArray();
        if (attempts.length > 0) {
          quizScores.push(attempts[attempts.length - 1].score);
        }
      }

      progressData.push({
        course,
        completed,
        total: lessons.length,
        percentage: lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0,
        timeSpent: Math.round(timeSpent / 60), // convert to minutes
        quizScores,
      });

      totalLessons += lessons.length;
      totalCompleted += completed;
      totalTime += timeSpent;
    }

    setCoursesProgress(progressData);
    setTotalTimeSpent(Math.round(totalTime / 60));
    setOverallCompletion(totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0);

    // Get recent quiz attempts
    const recentAttempts = await db.quizAttempts
      .where({ studentId: user.id })
      .reverse()
      .limit(5)
      .toArray();
    setRecentQuizzes(recentAttempts);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">My Progress</h1>
          <p className="text-blue-100 text-sm sm:text-base">Track your learning journey</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{overallCompletion}%</p>
                <p className="text-xs text-slate-500">Overall Progress</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{coursesProgress.length}</p>
                <p className="text-xs text-slate-500">Active Courses</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalTimeSpent}</p>
                <p className="text-xs text-slate-500">Minutes Learned</p>
              </div>
            </div>
          </div>
        </div>

        {/* Course Progress Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Course Progress</h2>
          {coursesProgress.length === 0 ? (
            <div className="bg-white p-8 rounded-xl text-center text-slate-400">
              <p>No courses enrolled yet</p>
            </div>
          ) : (
            coursesProgress.map(({ course, completed, total, percentage, timeSpent, quizScores }) => (
              <div key={course.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">{course.title}</h3>
                    <p className="text-xs text-slate-500">{course.code}</p>
                  </div>
                  <Link
                    to={`/course/${course.id}`}
                    className="text-blue-600 text-sm font-medium hover:underline"
                  >
                    View
                  </Link>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">
                      {completed} of {total} lessons completed
                    </span>
                    <span className="font-bold text-blue-600">{percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>{timeSpent} mins</span>
                  </div>
                  {quizScores.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Award size={14} />
                      <span>
                        Avg: {Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)}/
                        {quizScores.length > 0 ? 3 : 0}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent Quiz Results */}
        {recentQuizzes.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Quiz Results</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
              {recentQuizzes.map((attempt) => (
                <div key={attempt.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Quiz {attempt.quizId}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(attempt.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-slate-900">{attempt.score}/3</p>
                    <p className={`text-xs ${
                      attempt.syncStatus === 'synced' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {attempt.syncStatus === 'synced' ? 'Synced' : 'Pending'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
