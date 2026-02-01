// src/lib/db.ts
import Dexie, { type Table } from "dexie";

// ---------------------------------------------------------
// 1. Interfaces (Type Definitions)
// ---------------------------------------------------------
// IMPORTANT: All IDs (studentId, quizId, courseId, etc.) should be UUIDs
// when syncing to Supabase. Use getOrCreateUUIDForId() from lib/uuid.ts
// to convert simple IDs (like 'quiz-1') to proper UUIDs before syncing.
// ---------------------------------------------------------

export interface User {
  id: string; // UUID from Supabase
  name: string;
  role: "student" | "teacher" | "admin";
  email: string;
}

export interface Course {
  id: string; // Can be simple string locally, converted to UUID on sync
  title: string;
  code: string; // e.g., "AUTO-NCII"
  description: string;
  isDownloaded: boolean; // Visual flag for UI
  totalLessons?: number;
  estimatedHours?: number;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  type: "pdf" | "video" | "text" | "quiz";
  order: number; // Sequence in the course
  duration: number; // in minutes
  content?: string; // For text lessons or embedded content
  videoUrl?: string; // For video lessons
  pdfUrl?: string; // For PDF lessons
  storage_path?: string; // Raw path in Supabase storage
  quizId?: string; // Reference to quiz if type is 'quiz'
  isLocked?: boolean; // Requires previous lesson completion
  isVisible: boolean; // Synced from Supabase
}

export interface LessonProgress {
  id?: number;
  lessonId: string;
  courseId: string;
  studentId: string;
  completed: boolean;
  completedAt?: number;
  timeSpent: number; // in seconds
  lastAccessed?: number;
}

export interface Material {
  id: string;
  courseId: string;
  title: string;
  type: "pdf" | "video" | "text";
  content: string | Blob; // The actual file or text data
  localPath?: string; // If using Blob, sometimes we store a URL reference
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  questions: Array<{
    id: string;
    text: string;
    options: string[];
    correctOption: number;
  }>;
  allowedAttempts?: number; // New field
}

// THE MOST IMPORTANT TABLE FOR OFFLINE
export interface QuizAttempt {
  id?: number; // Auto-incrementing local ID
  quizId: string;
  studentId: string;
  answers: Record<string, number>; // { "questionId": selectedIndex }
  score: number;
  totalQuestions?: number;
  timestamp: number;
  syncStatus: "pending" | "synced" | "failed" | "failed_orphan"; // The Magic Flag
}

export interface AssignmentSubmission {
  id?: number;
  assignmentId: string;
  studentId: string;
  textAnswer?: string;
  fileBlob?: Blob; // The uploaded image/doc
  fileName?: string;
  timestamp: number;
  syncStatus: "pending" | "synced" | "failed";
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  createdAt: number;
  syncDeadline?: number; // Timestamp for when students should sync by
  dueDate?: number; // Actual due date
  isPublished: boolean;
}

export interface Announcement {
  id: string;
  courseId?: string; // Optional - can be global
  teacherId: string;
  title: string;
  content: string;
  isUrgent: boolean;
  createdAt: number;
  expiresAt?: number;
  syncStatus: "pending" | "synced" | "failed";
}

export interface Notification {
  id?: number;
  userId: string;
  type: "grade" | "announcement" | "deadline" | "sync";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: number;
  relatedId?: string; // Link to quiz, assignment, etc.
}

export interface Enrollment {
  courseId: string;
  studentId: string;
  status: "active" | "inactive" | "blocked";
  enrolledAt: number;
}

// ---------------------------------------------------------
// 2. The Database Class
// ---------------------------------------------------------

class HNVSLocaldB extends Dexie {
  // Declare implicit table properties
  users!: Table<User>;
  courses!: Table<Course>;
  enrollments!: Table<Enrollment>;
  lessons!: Table<Lesson>;
  lessonProgress!: Table<LessonProgress>;
  materials!: Table<Material>;
  quizzes!: Table<Quiz>;
  quizAttempts!: Table<QuizAttempt>;
  submissions!: Table<AssignmentSubmission>;
  assignments!: Table<Assignment>;
  announcements!: Table<Announcement>;
  notifications!: Table<Notification>;

  constructor() {
    super("HNVS_LMS_DB");

    // DEFINE SCHEMA
    // Syntax: '++id' = auto-increment
    // 'id' = unique string key
    // 'courseId', 'syncStatus' = indexed for fast searching
    this.version(4).stores({
      users: "id",
      courses: "id, code",
      enrollments: "[courseId+studentId], courseId, studentId, status",
      lessons: "id, courseId, order",
      lessonProgress: "++id, lessonId, courseId, studentId",
      materials: "id, courseId",
      quizzes: "id, courseId",

      // Transactional Tables (What we need to Sync)
      quizAttempts: "++id, quizId, studentId, syncStatus",
      submissions: "++id, assignmentId, studentId, syncStatus",
      assignments: "id, courseId, syncDeadline",
      announcements: "id, courseId, isUrgent, syncStatus",
      notifications: "++id, userId, type, isRead, createdAt", // Reverted compound index to avoid boolean key issues
    });
  }
}

export const db = new HNVSLocaldB();
