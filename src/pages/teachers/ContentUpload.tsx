// src/pages/teachers/ContentUpload.tsx
import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Image, Video, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../features/auth/AuthProvider';

type FileType = 'pdf' | 'video' | 'text';

interface Course {
  id: string;
  title: string;
  code: string;
}

export default function ContentUpload() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialCourseId = searchParams.get('courseId');


  // Data State
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Form State
  const [courseId, setCourseId] = useState(initialCourseId || '');
  const [title, setTitle] = useState('');
  const [fileType, setFileType] = useState<FileType>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [lessonOrder, setLessonOrder] = useState<number | ''>('');
  const [autoOrder, setAutoOrder] = useState(true);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCourses();
  }, [user]);

  // Update logic when URL changes
  useEffect(() => {
    if (initialCourseId) {
      setCourseId(initialCourseId);
    }
  }, [initialCourseId]);

  useEffect(() => {
    if (!courseId) return;
    const setSuggestedOrder = async () => {
      const nextOrder = await getNextOrder(courseId);
      if (autoOrder || lessonOrder === '') {
        setLessonOrder(nextOrder);
      }
    };
    setSuggestedOrder();
  }, [courseId, autoOrder, lessonOrder]);

  const fetchCourses = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, code')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
      setCourses(data || []);

      // Default to first course if no selection and no URL param
      if (data && data.length > 0) {
        if (initialCourseId && data.find(c => c.id === initialCourseId)) {
          setCourseId(initialCourseId);
        } else if (!courseId) {
          setCourseId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const getNextOrder = async (courseId: string): Promise<number> => {
    const { data, error } = await supabase
      .from('lessons')
      .select('order')
      .eq('course_id', courseId)
      .order('order', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Error fetching order, defaulting to 1', error);
      return 1;
    }
    return (data && data.length > 0) ? data[0].order + 1 : 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      alert('Please select a course first.');
      return;
    }

    const normalizedWeek = Number(weekNumber);
    if (!Number.isInteger(normalizedWeek) || normalizedWeek <= 0) {
      alert('Please enter a valid week number (1 or higher).');
      return;
    }

    const normalizedOrder = Number(lessonOrder);
    if (!Number.isInteger(normalizedOrder) || normalizedOrder <= 0) {
      alert('Please enter a valid lesson number (1 or higher).');
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');
    setStatusMessage('Preparing upload...');

    try {
      // 1. Create Lesson Record
      setStatusMessage('Creating lesson...');
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          course_id: courseId,
          title,
          type: fileType,
          order: normalizedOrder,
          week_number: normalizedWeek,
          content_html: fileType === 'text' ? textContent : null,
          duration_minutes: 15, // Default duration
        })
        .select()
        .single();

      if (lessonError) throw lessonError;
      const lessonId = lessonData.id;

      // 3. Upload File (if applicable) & Create Asset
      if (fileType !== 'text' && file) {
        setStatusMessage('Uploading file to storage...');

        // Path: courseId/lessonId/filename
        // Sanitize filename to avoid weird chars
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${courseId}/${lessonId}/${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('course-content')
          .upload(filePath, file);

        if (uploadError) {
          // Cleanup lesson if storage fails
          await supabase.from('lessons').delete().eq('id', lessonId);
          throw uploadError;
        }

        setStatusMessage('Linking asset to lesson...');

        // Add to lesson_assets
        const { error: assetError } = await supabase
          .from('lesson_assets')
          .insert({
            lesson_id: lessonId,
            kind: fileType === 'pdf' ? 'pdf' : 'video',
            storage_path: filePath,
            mime_type: file.type,
            size_bytes: file.size,
            is_lite: false
          });

        if (assetError) {
          // Cleanup lesson if asset DB insert fails
          await supabase.from('lessons').delete().eq('id', lessonId);
          throw assetError;
        }
      }

      setUploadStatus('success');
      setStatusMessage('Upload complete!');

      // Reset form / Redirect
      setTimeout(() => {
        // Option A: Stay here to upload more
        setTitle('');
        setFile(null);
        setTextContent('');
        setAutoOrder(true);
        setUploadStatus('idle');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);

    } catch (error: any) {
      console.error('Upload failed:', error);
      if (error?.code === '23505') {
        setStatusMessage('Lesson number already exists. Please choose a different lesson number.');
      } else {
        setStatusMessage(error.message || 'Upload failed');
      }
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const estimatedSize = file ? (file.size / (1024 * 1024)).toFixed(2) : '0';

  if (loadingCourses) {
    return <div className="p-12 text-center">Loading courses...</div>;
  }

  if (courses.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold mb-4">No Courses Found</h2>
        <p className="mb-4 text-slate-600">You need to create a course before uploading content.</p>
        <Link to="/teacher/courses" className="text-blue-600 hover:underline">Go to Course Manager</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-blue-900 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <Link
            to={courseId ? `/teacher/courses/${courseId}` : '/teacher'}
            className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={18} /> Back to Subject
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">Content Upload</h1>
          <p className="text-blue-100 text-sm">Upload materials to Supabase Storage</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Course Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Course</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.code} - {c.title}</option>
            ))}
          </select>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-900">
            <p className="font-medium">Storage Bucket Enabled</p>
            <p className="text-blue-700 mt-1">
              Files will be uploaded to the <strong>course-content</strong> bucket. Max 50MB per file.
            </p>
          </div>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Week Number
                </label>
                <input
                  type="number"
                  min={1}
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 1"
                />
                <p className="text-xs text-slate-500 mt-1">Group materials by week</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lesson Number
                </label>
                <input
                  type="number"
                  min={1}
                  value={lessonOrder}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLessonOrder(value === '' ? '' : Number(value));
                    setAutoOrder(value === '');
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 3"
                />
                <p className="text-xs text-slate-500 mt-1">You can override the default order</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Content Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Week 1 Module - Safety Procedures"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Content Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFileType('pdf')}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${fileType === 'pdf'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-slate-300'
                    }`}
                >
                  <FileText size={24} />
                  <span className="text-sm font-medium">PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFileType('video')}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${fileType === 'video'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-slate-300'
                    }`}
                >
                  <Video size={24} />
                  <span className="text-sm font-medium">Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFileType('text')}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${fileType === 'text'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-slate-300'
                    }`}
                >
                  <Image size={24} />
                  <span className="text-sm font-medium">Text</span>
                </button>
              </div>
            </div>

            {fileType !== 'text' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Upload File
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept={fileType === 'pdf' ? '.pdf' : 'video/*'}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="text-slate-400" size={40} />
                    <p className="text-sm text-slate-600">
                      {file ? file.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {fileType === 'pdf' ? 'PDF files only' : 'MP4, MOV, or AVI'}
                    </p>
                  </label>
                </div>
                {file && (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-slate-500 text-xs">FileSize</p>
                      <p className="font-bold text-slate-900">{estimatedSize} MB</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Text Content
                </label>
                <textarea
                  required
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Enter your lesson content here..."
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isUploading || (fileType !== 'text' && !file)}
              className="w-full bg-blue-900 text-white py-3 rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  {statusMessage}
                </>
              ) : uploadStatus === 'success' ? (
                <>
                  <CheckCircle size={20} />
                  Uploaded Successfully!
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload to Cloud
                </>
              )}
            </button>

            {uploadStatus === 'error' && (
              <div className="bg-red-50 p-3 rounded-lg text-red-600 text-sm text-center">
                <p className="font-bold">Error:</p>
                {statusMessage}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
