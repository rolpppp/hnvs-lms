// src/pages/LessonViewer.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, FileText, PlayCircle, BookOpen } from 'lucide-react';
import { db, type Lesson, type LessonProgress } from '../lib/db';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';

export default function LessonViewer() {
  const { user } = useAuth();
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null);
  const [startTime] = useState(() => Date.now());
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    const loadLesson = async () => {
      if (!lessonId) return;

      const lessonData = await db.lessons.get(lessonId);
      if (!lessonData) {
        alert('Lesson not found');
        navigate(-1);
        return;
      }

      // 1. Check for Offline Material first
      const offlineMaterial = await db.materials.get(lessonId);

      if (offlineMaterial && offlineMaterial.content instanceof Blob) {
        const objectUrl = URL.createObjectURL(offlineMaterial.content);
        if (lessonData.type === 'video') lessonData.videoUrl = objectUrl;
        if (lessonData.type === 'pdf') lessonData.pdfUrl = objectUrl;
        console.log('Using offline content for:', lessonData.title);
      } else {
        // 2. Fallback to Online URL (Resolve Supabase Storage URLs)
        if (lessonData.type === 'video' && lessonData.videoUrl && !lessonData.videoUrl.startsWith('http') && !lessonData.videoUrl.startsWith('blob')) {
          const { data } = supabase.storage.from('course-content').getPublicUrl(lessonData.videoUrl);
          lessonData.videoUrl = data.publicUrl;
        }
        if (lessonData.type === 'pdf' && lessonData.pdfUrl && !lessonData.pdfUrl.startsWith('http') && !lessonData.pdfUrl.startsWith('blob')) {
          const { data } = supabase.storage.from('course-content').getPublicUrl(lessonData.pdfUrl);
          lessonData.pdfUrl = data.publicUrl;
        }
      }

      setLesson(lessonData);

      // Get or create progress
      if (!user?.id) return;
      const existingProgress = await db.lessonProgress
        .where({ lessonId, studentId: user.id })
        .first();

      if (existingProgress) {
        setProgress(existingProgress);
      }

      // Get next lesson
      const next = await db.lessons
        .where({ courseId: lessonData.courseId })
        .filter(l => l.order === lessonData.order + 1)
        .first();
      setNextLesson(next || null);
    };

    loadLesson();
  }, [lessonId, user?.id]);

  const handleComplete = async () => {
    if (!lesson || isCompleting || !user?.id) return;

    setIsCompleting(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    // Update or create progress
    const existingProgress = await db.lessonProgress
      .where({ lessonId: lesson.id, studentId: user.id })
      .first();

    if (existingProgress) {
      await db.lessonProgress.update(existingProgress.id!, {
        completed: true,
        completedAt: Date.now(),
        timeSpent: existingProgress.timeSpent + timeSpent,
        lastAccessed: Date.now(),
      });
    } else {
      await db.lessonProgress.add({
        lessonId: lesson.id,
        courseId: lesson.courseId,
        studentId: user.id,
        completed: true,
        completedAt: Date.now(),
        timeSpent,
        lastAccessed: Date.now(),
      });
    }

    // Navigate to next lesson or back to course
    if (nextLesson) {
      navigate(`/lesson/${nextLesson.id}`);
    } else {
      navigate(`/course/${lesson.courseId}`);
    }
  };

  if (!lesson) {
    return <div className="p-8 text-center">Loading lesson...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(`/course/${lesson.courseId}`)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Back to Course</span>
          </button>

          {progress?.completed && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle size={16} />
              <span className="hidden sm:inline">Completed</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 pb-24">
        {/* Lesson Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            {lesson.type === 'video' && <PlayCircle size={16} />}
            {lesson.type === 'pdf' && <FileText size={16} />}
            {lesson.type === 'text' && <BookOpen size={16} />}
            <span className="capitalize">{lesson.type}</span>
            <span>•</span>
            <Clock size={16} />
            <span>{lesson.duration} mins</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            {lesson.title}
          </h1>
          <p className="text-slate-600">{lesson.description}</p>
        </div>

        {/* Content Based on Type */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          {lesson.type === 'video' && (
            <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center mb-4">
              {lesson.videoUrl ? (
                <video
                  controls
                  className="w-full h-full rounded-lg"
                  src={lesson.videoUrl}
                >
                  Your browser does not support video playback.
                </video>
              ) : (
                <div className="text-center text-slate-400">
                  <PlayCircle size={64} className="mx-auto mb-2" />
                  <p>Video content will load here</p>
                  <p className="text-sm mt-1">Demo: Automotive Safety Procedures</p>
                </div>
              )}
            </div>
          )}

          {lesson.type === 'pdf' && (
            <div className="aspect-[8.5/11] bg-slate-100 rounded-lg flex items-center justify-center mb-4">
              {lesson.pdfUrl ? (
                <iframe
                  src={lesson.pdfUrl}
                  className="w-full h-full rounded-lg"
                  title={lesson.title}
                />
              ) : (
                <div className="text-center text-slate-400">
                  <FileText size={64} className="mx-auto mb-2" />
                  <p>PDF Document Preview</p>
                  <p className="text-sm mt-1">Safety Guidelines & Best Practices</p>
                </div>
              )}
            </div>
          )}

          {lesson.type === 'text' && (
            <div className="prose prose-slate max-w-none">
              {lesson.content ? (
                <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
              ) : (
                <div>
                  <h3>Introduction to Automotive Safety</h3>
                  <p>
                    Safety is the foundation of all automotive work. Before beginning any maintenance
                    or repair task, it's crucial to understand and follow proper safety protocols.
                  </p>
                  <h4>Key Safety Equipment:</h4>
                  <ul>
                    <li><strong>Safety Glasses:</strong> Protect your eyes from debris and chemicals</li>
                    <li><strong>Gloves:</strong> Prevent cuts and chemical exposure</li>
                    <li><strong>Steel-Toed Boots:</strong> Protect feet from falling parts</li>
                    <li><strong>Ear Protection:</strong> Required in high-noise environments</li>
                  </ul>
                  <h4>Workshop Rules:</h4>
                  <ol>
                    <li>Always disconnect the battery before electrical work</li>
                    <li>Use jack stands - never rely on a jack alone</li>
                    <li>Keep work area clean and organized</li>
                    <li>Know the location of fire extinguishers</li>
                    <li>Never work alone on heavy tasks</li>
                  </ol>
                  <p className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-400 my-4">
                    <strong>Important:</strong> If you're unsure about any procedure, always ask your
                    instructor before proceeding. Safety is never worth rushing.
                  </p>
                </div>
              )}
            </div>
          )}

          {lesson.type === 'quiz' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Quiz Assessment</h3>
              <p className="text-slate-600 mb-6">Test your knowledge of the material covered</p>
              <Link
                to={`/quiz/${lesson.quizId || 'quiz-1'}`}
                className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700"
              >
                Start Quiz
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-4">
          {!progress?.completed && lesson.type !== 'quiz' && (
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="flex-1 bg-blue-900 text-white py-3 px-6 rounded-xl font-medium hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle size={20} />
              {isCompleting ? 'Saving...' : 'Mark as Complete'}
            </button>
          )}

          {nextLesson && (
            <Link
              to={`/lesson/${nextLesson.id}`}
              className="flex-1 bg-slate-100 text-slate-900 py-3 px-6 rounded-xl font-medium hover:bg-slate-200 flex items-center justify-center gap-2"
            >
              Next Lesson
              <ArrowLeft size={20} className="rotate-180" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
