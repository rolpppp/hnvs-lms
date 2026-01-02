// src/pages/Dashboard.tsx
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

function Dashboard() {
  const { isOnline } = useSync();
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
    <>
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

        {/* Course Grid */}
        {!courses ? (
          <div className="text-center py-10 sm:py-16 text-slate-400">
            Loading courses...
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
