import { Download, CheckCircle, Clock } from "lucide-react";
import type { Course } from "../lib/db";

interface CourseCardProps {
  course: Course;
  onDownload: (id: string) => void;
  isDownloading: boolean;
}

export function CourseCard({
  course,
  onDownload,
  isDownloading,
}: CourseCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow">
      {/* 1. Card Header / Cover */}
      <div className="h-32 sm:h-36 lg:h-40 bg-gradient-to-r from-blue-900 to-blue-700 p-4 sm:p-5 relative">
        <span className="bg-white/20 text-white text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 rounded backdrop-blur-sm">
          {course.code}
        </span>
        <h3 className="text-white font-bold text-base sm:text-lg lg:text-xl mt-2 leading-tight">
          {course.title}
        </h3>
      </div>

      {/* 2. Card Body */}
      <div className="p-4 sm:p-5 lg:p-6 flex-1 flex flex-col justify-between">
        <p className="text-slate-600 text-sm sm:text-base mb-4 line-clamp-3">
          {course.description}
        </p>

        {/* 3. Action Area */}
        <div className="pt-4 border-t border-slate-100">
          {course.isDownloaded ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg justify-center font-medium text-sm sm:text-base">
              <CheckCircle size={18} className="sm:w-5 sm:h-5" />
              <span>Ready Offline</span>
            </div>
          ) : (
            <button
              onClick={() => onDownload(course.id)}
              disabled={isDownloading}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base font-medium transition-all ${
                isDownloading
                  ? "bg-slate-100 text-slate-400 cursor-wait"
                  : "bg-blue-900 text-white hover:bg-blue-800 active:scale-[0.98]"
              }`}
            >
              {isDownloading ? (
                <>
                  <Clock size={18} className="animate-spin sm:w-5 sm:h-5" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={18} className="sm:w-5 sm:h-5" />
                  Download Pack
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
