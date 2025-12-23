// src/App.tsx
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  BookOpen,
  User,
  CheckCircle,
} from "lucide-react";
import { CourseCard } from "../components/CourseCard";
import { useSync } from "../hooks/useSync";
import { db, type Course } from "../lib/db";
import { useLiveQuery } from "dexie-react-hooks";

// --- DUMMY DATA SEEDER (Run once to populate DB) ---
const SEED_COURSES: Course[] = [
  {
    id: "1",
    code: "AUTO-NCII",
    title: "Automotive Servicing NC II",
    description:
      "Learn to inspect, clean, and repair mechanical or electrical parts of light-duty diesel or gasoline engines.",
    isDownloaded: false,
  },
  {
    id: "2",
    code: "COOK-NCII",
    title: "Commercial Cookery NC II",
    description:
      "Fundamental skills in preparing and cooking hot and cold meals in a commercial kitchen environment.",
    isDownloaded: false,
  },
  {
    id: "3",
    code: "EIM-NCII",
    title: "Electrical Installation & Maintenance",
    description:
      "Install and maintain electrical wiring, lighting, and related equipment and systems.",
    isDownloaded: false,
  },
];

function App() {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useSync();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // 1. Fetch courses from Local DB (Dexie)
  // This ensures that even if you refresh offline, the data persists!
  const courses = useLiveQuery(() => db.courses.toArray());

  // 2. Seeder Effect: If DB is empty, add dummy data
  useEffect(() => {
    const seed = async () => {
      const count = await db.courses.count();
      if (count === 0) {
        await db.courses.bulkAdd(SEED_COURSES);
        console.log("Seeded Dummy Data");
      }
    };
    seed();
  }, []);

  // 3. Simulate "Downloading" a Course Pack
  const handleDownload = async (courseId: string) => {
    if (!isOnline) {
      alert("You need internet to download the initial pack!");
      return;
    }

    setDownloadingId(courseId);

    // Fake a 2-second download delay
    setTimeout(async () => {
      await db.courses.update(courseId, { isDownloaded: true });
      setDownloadingId(null);
      alert("Course Pack Downloaded! You can now access this offline.");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* --- TOP HEADER (Network Status) --- */}
      <header
        className={`sticky top-0 z-50 text-white shadow-md transition-colors duration-300 ${
          isOnline ? "bg-blue-900" : "bg-yellow-600"
        }`}
      >
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
            <span className="text-sm font-semibold tracking-wide">
              {isOnline ? "HNVS Online" : "Offline Mode"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Pending Sync Badge */}
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount} Queued
              </span>
            )}

            <button
              onClick={triggerSync}
              disabled={!isOnline || isSyncing}
              className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={18}
                className={isSyncing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-md mx-auto px-4 py-6 pb-24">
        {/* User Greeting */}
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Courses</h1>
            <p className="text-slate-500 text-sm">Term 2, 2025</p>
          </div>
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
            <User size={20} />
          </div>
        </div>

        {/* Course Grid */}
        {!courses ? (
          <div className="text-center py-10 text-slate-400">
            Loading courses...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {courses.map((course: Course) => (
              <Link
                to={`/course/${course.id}`}
                key={course.id}
                className="block"
              >
                <CourseCard
                  course={course}
                  onDownload={(id: string) => {
                    handleDownload(id);
                  }}
                  isDownloading={downloadingId === course.id}
                />
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* --- BOTTOM NAVIGATION (Mobile) --- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-40 max-w-md mx-auto">
        <button className="flex flex-col items-center gap-1 text-blue-900">
          <BookOpen size={24} />
          <span className="text-[10px] font-medium">Courses</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <CheckCircle size={24} />
          <span className="text-[10px] font-medium">Grades</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <User size={24} />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
