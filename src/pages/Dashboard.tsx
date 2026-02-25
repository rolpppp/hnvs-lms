// src/pages/Dashboard.tsx
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  BookOpen,
  User,
  CheckCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { CourseCard } from "../components/CourseCard";
import { useSync } from "../hooks/useSync";
import { useStorageWarning } from "../hooks/useStorageWarning";
import { useCourseSync } from "../hooks/useCourseSync";
import { useDownloadCourse } from "../hooks/useDownloadCourse";
import { db, type Course } from '../lib/db';
import { useLiveQuery } from "dexie-react-hooks";

function Dashboard() {
  const { isOnline } = useSync();
  const { storageInfo, showWarning, setShowWarning, canDownload } = useStorageWarning();
  const { downloadCourse, downloading, progress, status: downloadStatus } = useDownloadCourse();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // 1. Fetch courses from Local DB (Dexie)
  // This ensures that even if you refresh offline, the data persists!
  const courses = useLiveQuery(() => db.courses.toArray());

  // Data Sync Hooks
  const { syncCourses, loading: syncing, error: syncError } = useCourseSync();

  // 2. Initial Data Load & Sync
  useEffect(() => {
    const initData = async () => {
      // Seed dummy data only if DB is completely empty (first run / offline demo)
      try {
        const courseCount = await db.courses.count();
        if (courseCount === 0) {
          console.log("Seeded Demo Data");
        }
      } catch (e) {
        console.warn("Seeding error (ignored):", e);
      }

      // Attempt to sync from server – force=true bypasses the throttle so
      // students always see their current enrollments when the dashboard loads.
      syncCourses(true);
    };

    initData();
  }, [syncCourses]);

  // 3. Download a Course Pack (real asset download via useDownloadCourse)
  const handleDownload = async (courseId: string) => {
    if (!isOnline) {
      alert("You need internet to download the initial pack!");
      return;
    }

    const estimatedSizeMB = 20;
    const storageCheck = await canDownload(estimatedSizeMB);
    if (!storageCheck.canDownload) {
      alert(storageCheck.reason || "Not enough storage space");
      return;
    }

    setDownloadingId(courseId);
    await downloadCourse(courseId);
    setDownloadingId(null);
  };

  return (
    <>
      {/* Storage Warning Banner */}
      {showWarning && storageInfo && storageInfo.isLow && (
        <div className={`fixed top-14 left-0 right-0 z-50 ${storageInfo.isCritical ? 'bg-red-600' : 'bg-yellow-600'} text-white px-4 py-3 shadow-lg`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} />
              <div className="text-sm">
                <p className="font-bold">
                  {storageInfo.isCritical ? 'Storage Critically Low!' : 'Storage Running Low'}
                </p>
                <p className="text-xs opacity-90">
                  {storageInfo.used}MB used of {storageInfo.quota}MB ({100 - storageInfo.percentage}% remaining)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT --- */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-6 pb-24 lg:pb-8">
        {/* User Greeting */}
        <div className="mb-6 sm:mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800">My Courses</h1>
            <p className="text-slate-500 text-sm sm:text-base">Term 2, 2025</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
            <User size={20} className="sm:w-6 sm:h-6" />
          </div>
        </div>

        {syncError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>Could not load courses: {syncError}</span>
            <button
              onClick={() => syncCourses(true)}
              disabled={syncing}
              className="shrink-0 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {syncing ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        {/* Course Grid */}
        {!courses ? (
          <div className="text-center py-10 sm:py-16 text-slate-400">
            Loading courses...
          </div>
        ) : courses.length === 0 && !syncing ? (
          <div className="text-center py-10 sm:py-16 text-slate-400">
            <BookOpen size={48} className="mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">No courses yet</p>
            <p className="text-sm mt-1">You are not enrolled in any courses. Contact your teacher to get enrolled.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {courses.map((course: Course) => (
              <Link
                to={`/course/${course.id}`}
                key={course.id}
                className="block"
              >
                <CourseCard
                  course={course}
                  onDownload={(id: string) => { handleDownload(id); }}
                  isDownloading={downloadingId === course.id}
                  downloadProgress={downloadingId === course.id ? progress : undefined}
                  downloadStatus={downloadingId === course.id ? downloadStatus : undefined}
                />
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* --- BOTTOM NAVIGATION (Mobile & Tablet Only) --- */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-40 shadow-lg">
        <button className="flex flex-col items-center gap-1 text-blue-900">
          <BookOpen size={24} />
          <span className="text-[10px] sm:text-xs font-medium">Courses</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
          <CheckCircle size={24} />
          <span className="text-[10px] sm:text-xs font-medium">Grades</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
          <User size={24} />
          <span className="text-[10px] sm:text-xs font-medium">Profile</span>
        </button>
      </nav>
    </>
  );
}

export default Dashboard;
