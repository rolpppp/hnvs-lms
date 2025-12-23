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
    <div className="pb-24">
      {/* HEADER */}
      <div className="bg-blue-900 text-white p-6 pt-8 rounded-b-3xl shadow-lg">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-4"
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <p className="opacity-80 text-sm mt-1">{course.code}</p>

        <div className="mt-4 flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded font-medium ${
              course.isDownloaded ? "bg-green-500" : "bg-white/20"
            }`}
          >
            {course.isDownloaded ? "Available Offline" : "Online Only"}
          </span>
        </div>
      </div>

      {/* MODULE LIST */}
      <div className="p-4 max-w-md mx-auto">
        <h2 className="font-bold text-slate-800 mb-4 text-lg">
          Course Modules
        </h2>

        <div className="flex flex-col gap-3">
          {MOCK_MODULES.map((module) => (
            <div
              key={module.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                {/* Icon based on Type */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    module.type === "quiz"
                      ? "bg-purple-100 text-purple-600"
                      : "bg-blue-50 text-blue-600"
                  }`}
                >
                  {module.type === "quiz" ? (
                    <PlayCircle size={20} />
                  ) : (
                    <FileText size={20} />
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-slate-800 text-sm">
                    {module.title}
                  </h3>
                  <p className="text-xs text-slate-500 capitalize">
                    {module.type} • 15 mins
                  </p>
                </div>
              </div>

              {/* Status Icon */}
              {module.isCompleted && (
                <CheckCircle size={18} className="text-green-500" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
