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
import { db, type Course, type Lesson } from "../lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { supabase } from "../lib/supabase";

// --- DUMMY DATA SEEDER (Run once to populate DB) ---
const SEED_COURSES: Course[] = [
  {
    id: "1",
    code: "AUTO-NCII",
    title: "Automotive Servicing NC II",
    description:
      "Learn to inspect, clean, and repair mechanical or electrical parts of light-duty diesel or gasoline engines.",
    isDownloaded: false,
    totalLessons: 8,
    estimatedHours: 12,
  },
  {
    id: "2",
    code: "COOK-NCII",
    title: "Commercial Cookery NC II",
    description:
      "Master the skills to prepare, cook, and present a variety of dishes for commercial food operations.",
    isDownloaded: false,
    totalLessons: 10,
    estimatedHours: 15,
  },
  {
    id: "3",
    code: "ELEC-NCII",
    title: "Electrical Installation & Maintenance NC II",
    description:
      "Develop competency in installing, maintaining, and troubleshooting electrical wiring systems.",
    isDownloaded: false,
    totalLessons: 12,
    estimatedHours: 18,
  },
];

const SEED_LESSONS: Lesson[] = [
  // AUTO-NCII Lessons
  { id: 'lesson-1-1', courseId: '1', title: 'Introduction to Automotive Safety', description: 'Learn fundamental safety protocols for automotive work', type: 'text', order: 1, duration: 15 },
  { id: 'lesson-1-2', courseId: '1', title: 'Safety Equipment Demonstration', description: 'Video guide on proper use of safety equipment', type: 'video', order: 2, duration: 20 },
  { id: 'lesson-1-3', courseId: '1', title: 'Basic Hand Tools', description: 'Introduction to common automotive hand tools', type: 'pdf', order: 3, duration: 25 },
  { id: 'lesson-1-4', courseId: '1', title: 'Safety & Tools Quiz', description: 'Test your knowledge', type: 'quiz', order: 4, duration: 15, quizId: 'quiz-1' },
  { id: 'lesson-1-5', courseId: '1', title: 'Engine Components Overview', description: 'Understanding engine parts and their functions', type: 'video', order: 5, duration: 30 },
  { id: 'lesson-1-6', courseId: '1', title: 'Engine Inspection Procedures', description: 'Step-by-step guide to engine inspection', type: 'text', order: 6, duration: 20 },
  // Course 1 Lessons (AUTO-NCII)
  {
    id: '101', courseId: '1', title: 'Introduction to Safety', description: 'Basic safety protocols', type: 'text', order: 1, duration: 10, isVisible: true
  },
  {
    id: '102', courseId: '1', title: 'Safety Equipment', description: 'Overview of PPE', type: 'video', order: 2, duration: 15, isVisible: true
  },
  {
    id: '103', courseId: '1', title: 'Safety Procedures PDF', description: 'Downloadable guide', type: 'pdf', order: 3, duration: 5, isVisible: true
  },
  {
    id: '104', courseId: '1', title: 'Module 1 Quiz', description: 'Test your knowledge', type: 'quiz', order: 4, duration: 10, quizId: 'quiz-1', isVisible: true
  },
  {
    id: '105', courseId: '1', title: 'Emergency Response', description: 'What to do in emergencies', type: 'video', order: 5, duration: 20, isVisible: true
  },
  {
    id: '106', courseId: '1', title: 'Emergency Contacts', description: 'Important numbers', type: 'text', order: 6, duration: 5, isVisible: true
  },
  {
    id: '107', courseId: '1', title: 'Evacuation Plan', description: 'Map and routes', type: 'pdf', order: 7, duration: 5, isVisible: true
  },
  {
    id: '108', courseId: '1', title: 'Emergency Quiz', description: 'Assessment', type: 'quiz', order: 8, duration: 10, quizId: 'quiz-2', isVisible: true
  },

  // Course 2 Lessons (COOK-NCII)
  {
    id: '201', courseId: '2', title: 'Leadership Fundamentals', description: 'What makes a leader', type: 'text', order: 1, duration: 15, isVisible: true
  },
  {
    id: '202', courseId: '2', title: 'Team Building', description: 'Building effective teams', type: 'video', order: 2, duration: 20, isVisible: true
  },
  {
    id: '203', courseId: '2', title: 'Leadership Styles', description: 'Different approaches', type: 'pdf', order: 3, duration: 10, isVisible: true
  },
  {
    id: '204', courseId: '2', title: 'Leadership Assessment', description: 'Quiz', type: 'quiz', order: 4, duration: 15, quizId: 'quiz-3', isVisible: true
  },
  {
    id: '205', courseId: '2', title: 'Conflict Resolution', description: 'Managing conflict', type: 'video', order: 5, duration: 25, isVisible: true
  },
  {
    id: '206', courseId: '2', title: 'Communication Skills', description: 'Effective communication', type: 'pdf', order: 6, duration: 15, isVisible: true
  },
  {
    id: '207', courseId: '2', title: 'Feedback Mechanisms', description: 'Giving and receiving feedback', type: 'text', order: 7, duration: 10, isVisible: true
  },
  {
    id: '208', courseId: '2', title: 'Negotiation', description: 'Basics of negotiation', type: 'video', order: 8, duration: 20, isVisible: true
  },
  {
    id: '209', courseId: '2', title: 'Ethics in Leadership', description: 'Ethical considerations', type: 'pdf', order: 9, duration: 10, isVisible: true
  },
  {
    id: '210', courseId: '2', title: 'Management vs Leadership', description: 'Key differences', type: 'text', order: 10, duration: 10, isVisible: true
  },
  {
    id: '211', courseId: '2', title: 'Strategic Planning', description: 'Long term goals', type: 'pdf', order: 11, duration: 15, isVisible: true
  },
  {
    id: '212', courseId: '2', title: 'Final Exam', description: 'Comprehensive assessment', type: 'quiz', order: 12, duration: 30, quizId: 'quiz-4', isVisible: true
  },

  // Course 3 Lessons (ELEC-NCII) - Keeping original structure for these, adding isVisible
  { id: 'lesson-3-1', courseId: '3', title: 'Electrical Safety Protocols', description: 'Critical safety rules for electrical work', type: 'text', order: 1, duration: 20, isVisible: true },
  { id: 'lesson-3-2', courseId: '3', title: 'Understanding Electricity', description: 'Voltage, current, and resistance basics', type: 'video', order: 2, duration: 30, isVisible: true },
  { id: 'lesson-3-3', courseId: '3', title: 'Circuit Theory', description: 'Series and parallel circuits explained', type: 'pdf', order: 3, duration: 25, isVisible: true },
  { id: 'lesson-3-4', courseId: '3', title: 'Theory Quiz', description: 'Test your understanding', type: 'quiz', order: 4, duration: 15, quizId: 'quiz-1', isVisible: true },
  { id: 'lesson-3-5', courseId: '3', title: 'Wiring Tools & Materials', description: 'Guide to electrical tools', type: 'video', order: 5, duration: 25, isVisible: true },
  { id: 'lesson-3-6', courseId: '3', title: 'Reading Electrical Plans', description: 'Understanding blueprints and schematics', type: 'pdf', order: 6, duration: 30, isVisible: true },
  { id: 'lesson-3-7', courseId: '3', title: 'Basic Wiring Installation', description: 'Step-by-step wiring procedures', type: 'text', order: 7, duration: 35, isVisible: true },
  { id: 'lesson-3-8', courseId: '3', title: 'Installation Demo', description: 'Video walkthrough of installation', type: 'video', order: 8, duration: 40, isVisible: true },
  { id: 'lesson-3-9', courseId: '3', title: 'Troubleshooting Techniques', description: 'Finding and fixing electrical problems', type: 'pdf', order: 9, duration: 30, isVisible: true },
  { id: 'lesson-3-10', courseId: '3', title: 'Maintenance Procedures', description: 'Regular electrical maintenance', type: 'text', order: 10, duration: 25, isVisible: true },
  { id: 'lesson-3-11', courseId: '3', title: 'Code Compliance', description: 'Understanding electrical codes', type: 'pdf', order: 11, duration: 20, isVisible: true },
  { id: 'lesson-3-12', courseId: '3', title: 'Final Certification Exam', description: 'Comprehensive assessment', type: 'quiz', order: 12, duration: 30, quizId: 'quiz-2', isVisible: true },
];

function Dashboard() {
  const { isOnline } = useSync();
  const { storageInfo, showWarning, setShowWarning, canDownload } = useStorageWarning();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // 1. Fetch courses from Local DB (Dexie)
  // This ensures that even if you refresh offline, the data persists!
  const courses = useLiveQuery(() => db.courses.toArray());

  // Data Sync Hooks
  const { syncCourses } = useCourseSync();

  // 2. Initial Data Load & Sync
  useEffect(() => {
    const initData = async () => {
      // Seed dummy data only if DB is completely empty (first run / offline demo)
      try {
        const courseCount = await db.courses.count();
        if (courseCount === 0) {
          await db.courses.bulkAdd(SEED_COURSES);
          await db.lessons.bulkAdd(SEED_LESSONS);
          console.log("Seeded Demo Data");
        }
      } catch (e) {
        console.warn("Seeding error (ignored):", e);
      }

      // Attempt to sync from server
      syncCourses();
    };

    initData();
  }, [syncCourses]);

  // 3. Simulate "Downloading" a Course Pack
  const handleDownload = async (courseId: string) => {
    // Prevent navigation to course detail when clicking download button
    // Note: The onClick in CourseCard should handle startPropagation if needed, 
    // but here we just handle logic.

    if (!isOnline) {
      alert("You need internet to download the initial pack!");
      return;
    }

    // Check storage before downloading
    const estimatedSizeMB = 20; // Estimate ~20MB per course pack

    const storageCheck = await canDownload(estimatedSizeMB);
    if (!storageCheck.canDownload) {
      alert(storageCheck.reason || "Not enough storage space");
      return;
    }

    setDownloadingId(courseId);

    // Auto-enroll in Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Upsert enrollment
        await supabase.from('enrollments').upsert({
          course_id: courseId,
          student_id: user.id,
          status: 'active'
        }, { onConflict: 'course_id, student_id' });

        // Also update local enrollment to match
        await db.enrollments.put({
          courseId: courseId,
          studentId: user.id,
          status: 'active',
          enrolledAt: Date.now()
        });
      }
    } catch (err) {
      console.error("Auto-enrollment warning:", err);
      // We continue with download even if enrollment fails provided we can get content? 
      // Strictly we might want to stop, but for now allow it.
    }

    // Fake a 2-second download delay (Simulation of fetching assets)
    setTimeout(async () => {
      await db.courses.update(courseId, { isDownloaded: true });
      setDownloadingId(null);
      alert("Course Pack Downloaded! You can now access this offline.");
    }, 2000);
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
