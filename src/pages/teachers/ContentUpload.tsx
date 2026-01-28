// src/pages/teachers/ContentUpload.tsx
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Image, Video, CheckCircle, AlertCircle } from 'lucide-react';
import { db, type Material } from '../../lib/db';

type FileType = 'pdf' | 'video' | 'text';

export default function ContentUpload() {
  const [courseId, setCourseId] = useState('1');
  const [title, setTitle] = useState('');
  const [fileType, setFileType] = useState<FileType>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const generateLiteVersion = async (file: File, type: FileType): Promise<Blob> => {
    // Simulated "Lite Version" generation
    // In production, you'd compress/optimize the file here
    
    if (type === 'pdf') {
      // For PDFs: reduce quality, remove images, keep text only
      // This is a simulation - real implementation would use PDF processing
      return new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
    }
    
    if (type === 'video') {
      // For videos: reduce resolution to 480p, lower bitrate
      // Real implementation would use ffmpeg.wasm or similar
      return new Blob([await file.arrayBuffer()], { type: 'video/mp4' });
    }

    return file;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadStatus('idle');

    try {
      let contentBlob: Blob;
      
      if (fileType === 'text') {
        // Text content - already lightweight
        contentBlob = new Blob([textContent], { type: 'text/plain' });
      } else if (file) {
        // Generate lite version for files
        contentBlob = await generateLiteVersion(file, fileType);
      } else {
        throw new Error('No file selected');
      }

      // Store in IndexedDB
      const material: Material = {
        id: `material-${Date.now()}`,
        courseId,
        title,
        type: fileType,
        content: contentBlob,
      };

      await db.materials.add(material);

      setUploadStatus('success');
      
      // Reset form
      setTimeout(() => {
        setTitle('');
        setFile(null);
        setTextContent('');
        setUploadStatus('idle');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const estimatedSize = file ? (file.size / (1024 * 1024)).toFixed(2) : '0';
  const liteSize = file ? ((file.size * 0.4) / (1024 * 1024)).toFixed(2) : '0'; // Estimate ~60% compression

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
          <h1 className="text-2xl sm:text-3xl font-bold">Content Upload</h1>
          <p className="text-blue-100 text-sm">Upload materials with automatic Lite Version generation</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-900">
            <p className="font-medium">Automatic Lite Version</p>
            <p className="text-blue-700 mt-1">
              We'll automatically create a lightweight version optimized for offline students with limited storage.
            </p>
          </div>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    fileType === 'pdf'
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
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    fileType === 'video'
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
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    fileType === 'text'
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
                      <p className="text-slate-500 text-xs">Original Size</p>
                      <p className="font-bold text-slate-900">{estimatedSize} MB</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-green-600 text-xs">Lite Version</p>
                      <p className="font-bold text-green-700">~{liteSize} MB</p>
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
                <p className="text-xs text-slate-500 mt-1">
                  Text content is already lightweight and mobile-friendly
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isUploading || (fileType !== 'text' && !file)}
              className="w-full bg-blue-900 text-white py-3 rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>Processing...</>
              ) : uploadStatus === 'success' ? (
                <>
                  <CheckCircle size={20} />
                  Uploaded Successfully!
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload & Generate Lite Version
                </>
              )}
            </button>

            {uploadStatus === 'error' && (
              <p className="text-red-600 text-sm text-center">
                Upload failed. Please try again.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
