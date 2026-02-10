// src/pages/teachers/TeacherLessonViewer.tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, PlayCircle, BookOpen, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface LessonRecord {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  type: 'pdf' | 'video' | 'text' | 'quiz';
  order: number;
  week_number: number | null;
  duration_minutes: number | null;
  content_html: string | null;
  quiz_id?: string | null;
}

export default function TeacherLessonViewer() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<LessonRecord | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLesson = async () => {
      if (!lessonId) return;
      try {
        setLoading(true);
        setError(null);

        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .single();

        if (lessonError) throw lessonError;
        setLesson(lessonData as LessonRecord);

        if (lessonData.type === 'pdf' || lessonData.type === 'video') {
          const { data: assetData, error: assetError } = await supabase
            .from('lesson_assets')
            .select('*')
            .eq('lesson_id', lessonId)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          if (!assetError && assetData?.storage_path) {
            const { data: publicData } = supabase
              .storage
              .from('course-content')
              .getPublicUrl(assetData.storage_path);
            setAssetUrl(publicData.publicUrl);
          }
        }
      } catch (err: unknown) {
        console.error('Error loading lesson:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load lesson';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadLesson();
  }, [lessonId]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading lesson...</div>;
  }

  if (error || !lesson) {
    return (
      <div className="p-8 text-center text-red-600">
        {error || 'Lesson not found'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(`/teacher/courses/${lesson.course_id}`)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Back to Course</span>
          </button>

          {lesson.type === 'quiz' && lesson.quiz_id && (
            <Link
              to={`/teacher/courses/${lesson.course_id}/quiz/${lesson.quiz_id}`}
              className="text-sm text-blue-600 font-medium hover:underline"
            >
              Edit Quiz
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 pb-24">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 text-slate-500 text-sm mb-2">
            {lesson.type === 'video' && <PlayCircle size={16} />}
            {lesson.type === 'pdf' && <FileText size={16} />}
            {lesson.type === 'text' && <BookOpen size={16} />}
            {lesson.type === 'quiz' && <BookOpen size={16} />}
            <span className="capitalize">{lesson.type}</span>
            <span>•</span>
            <span>Lesson {lesson.order}</span>
            {lesson.week_number && (
              <>
                <span>•</span>
                <span>Week {lesson.week_number}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            {lesson.title}
          </h1>
          {lesson.description && (
            <p className="text-slate-600">{lesson.description}</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {lesson.type === 'video' && (
            <div className="space-y-4">
              {assetUrl ? (
                <video controls className="w-full rounded-lg" src={assetUrl} />
              ) : (
                <div className="text-center text-slate-400 py-12">
                  <PlayCircle size={48} className="mx-auto mb-3" />
                  <p>Video not available</p>
                </div>
              )}
              {assetUrl && (
                <a
                  href={assetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline"
                >
                  Open video in new tab <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}

          {lesson.type === 'pdf' && (
            <div className="space-y-4">
              {assetUrl ? (
                <iframe
                  src={assetUrl}
                  className="w-full h-[70vh] rounded-lg"
                  title={lesson.title}
                />
              ) : (
                <div className="text-center text-slate-400 py-12">
                  <FileText size={48} className="mx-auto mb-3" />
                  <p>PDF not available</p>
                </div>
              )}
              {assetUrl && (
                <a
                  href={assetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline"
                >
                  Open PDF in new tab <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}

          {lesson.type === 'text' && (
            <div className="prose prose-slate max-w-none">
              {lesson.content_html ? (
                <div dangerouslySetInnerHTML={{ __html: lesson.content_html }} />
              ) : (
                <p className="text-slate-500">No content provided.</p>
              )}
            </div>
          )}

          {lesson.type === 'quiz' && (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen size={32} />
              </div>
              <p className="text-slate-600">This item is a quiz.</p>
              {lesson.quiz_id && (
                <Link
                  to={`/teacher/courses/${lesson.course_id}/quiz/${lesson.quiz_id}`}
                  className="inline-block mt-4 bg-purple-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-700"
                >
                  Edit Quiz
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
