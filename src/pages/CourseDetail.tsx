import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, PlayCircle, CheckCircle } from "lucide-react";
import { db, type Course } from "../lib/db";

// DUMMY MODULE DATA (In real app, this comes from Supabase/Dexie)
const MOCK_MODULES = [
  { id: 1, title: "Week 1: Safety Procedures", type: "pdf", isCompleted: true },
  {
    id: 2,
    title: "Week 2: Engine Parts Identification",
    type: "video",
    isCompleted: false,
  },
  { id: 3, title: "Quiz 1: Safety & Tools", type: "quiz", isCompleted: false },
];

export default function CourseDetail() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<Course | null>(null);

  useEffect(() => {
    // Fetch course metadata from local DB
    if (courseId) {
      db.courses.get(courseId).then((data) => {
        if (data) setCourse(data);
      });
    }
  }, [courseId]);

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
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{course.title}</h1>
          <p className="opacity-80 text-sm sm:text-base mt-1">{course.code}</p>

          <div className="mt-4 flex items-center gap-2">
            <span
              className={`text-xs sm:text-sm px-3 py-1 sm:py-1.5 rounded font-medium ${
                course.isDownloaded ? "bg-green-500" : "bg-white/20"
              }`}
            >
              {course.isDownloaded ? "Available Offline" : "Online Only"}
            </span>
          </div>
        </div>
      </div>

      {/* MODULE LIST */}
      <div className="p-4 sm:p-6 lg:p-8 container mx-auto max-w-7xl">
        <h2 className="font-bold text-slate-800 mb-4 sm:mb-6 text-lg sm:text-xl lg:text-2xl">
          Course Modules
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
          {MOCK_MODULES.map((module) =>
            // Conditional Link: Only link if it is a quiz for now
            module.type === "quiz" ? (
              <Link to={`/quiz/${module.id}`} key={module.id}>
                <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md active:scale-[0.98] transition-all cursor-pointer">
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Icon based on Type */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 bg-purple-100 text-purple-600">
                      <PlayCircle size={20} className="sm:w-6 sm:h-6" />
                    </div>

                    <div>
                      <h3 className="font-medium text-slate-800 text-sm sm:text-base">
                        {module.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 capitalize">
                        {module.type} • 15 mins
                      </p>
                    </div>
                  </div>

                  {/* Status Icon */}
                  {module.isCompleted && (
                    <CheckCircle size={18} className="text-green-500 shrink-0 sm:w-5 sm:h-5" />
                  )}
                </div>
              </Link>
            ) : (
              // Non-clickable div for videos/PDFs (for this prototype step)
              <div
                key={module.id}
                className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Icon based on Type */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                    <FileText size={20} className="sm:w-6 sm:h-6" />
                  </div>

                  <div>
                    <h3 className="font-medium text-slate-800 text-sm sm:text-base">
                      {module.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 capitalize">
                      {module.type} • 15 mins
                    </p>
                  </div>
                </div>

                {/* Status Icon */}
                {module.isCompleted && (
                  <CheckCircle size={18} className="text-green-500 shrink-0 sm:w-5 sm:h-5" />
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
