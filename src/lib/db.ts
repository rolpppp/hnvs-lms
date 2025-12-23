// src/lib/db.ts
import Dexie, { type Table } from "dexie";

// ---------------------------------------------------------
// 1. Interfaces (Type Definitions)
// ---------------------------------------------------------

export interface User {
  id: string; // UUID from Supabase
  name: string;
  role: "student" | "teacher" | "admin";
  email: string;
}

export interface Course {
  id: string;
  title: string;
  code: string; // e.g., "AUTO-NCII"
  description: string;
  isDownloaded: boolean; // Visual flag for UI
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
}

// THE MOST IMPORTANT TABLE FOR OFFLINE
export interface QuizAttempt {
  id?: number; // Auto-incrementing local ID
  quizId: string;
  studentId: string;
  answers: Record<string, number>; // { "questionId": selectedIndex }
  score: number;
  timestamp: number;
  syncStatus: "pending" | "synced" | "failed"; // The Magic Flag
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

// ---------------------------------------------------------
// 2. The Database Class
// ---------------------------------------------------------

class HNVSLocaldB extends Dexie {
  // Declare implicit table properties
  users!: Table<User>;
  courses!: Table<Course>;
  materials!: Table<Material>;
  quizzes!: Table<Quiz>;
  quizAttempts!: Table<QuizAttempt>;
  submissions!: Table<AssignmentSubmission>;

  constructor() {
    super("HNVS_LMS_DB");

    // DEFINE SCHEMA
    // Syntax: '++id' = auto-increment
    // 'id' = unique string key
    // 'courseId', 'syncStatus' = indexed for fast searching
    this.version(1).stores({
      users: "id",
      courses: "id, code",
      materials: "id, courseId",
      quizzes: "id, courseId",

      // Transactional Tables (What we need to Sync)
      quizAttempts: "++id, quizId, studentId, syncStatus",
      submissions: "++id, assignmentId, studentId, syncStatus",
    });
  }
}

export const db = new HNVSLocaldB();
