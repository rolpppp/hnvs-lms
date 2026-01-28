# HNVS-LMS Architecture (Target)

This repo currently behaves like an offline-first prototype (Dexie for local storage + manual Supabase inserts with RLS largely disabled). This document defines a production-ready architecture that preserves the offline experience while introducing proper authentication, authorization (RLS), and a scalable data model for teacher uploads, student downloads, quizzes, and tracking.

## 1) Goals / Non-goals

**Goals**
- Offline-first student experience (download once, learn offline; sync when online).
- Online-first teacher experience (create/update content and quizzes).
- Strong security by default: Supabase Auth + Row Level Security (RLS) enabled.
- Clear separation of concerns (UI vs domain vs data access vs sync).
- Support multiple users per device (important for shared tablets/PC labs).

**Non-goals (for the first production milestone)**
- Full real-time collaboration.
- High-scale video transcoding pipeline (can be added later).

## 2) Proposed High-level Architecture

### Frontend (Vite + React)
- **Routing + guards**: Student and Teacher routes require authentication, and role-based access.
- **State strategy**:
  - Local/offline: Dexie (already present) for course packs, downloaded assets, progress.
  - Remote/server state: Supabase queries/mutations.
  - Recommended addition: TanStack Query (React Query) to standardize loading/error/cache behavior.

### Backend (Supabase)
- **Auth**: Supabase Auth (email/password or magic link). Roles are stored in a `profiles` table.
- **Database**: Postgres tables for courses, lessons, assets, enrollments, quizzes, and submissions.
- **Storage**: Supabase Storage bucket(s) for files (PDF/video/etc.) with policies tied to enrollments.
- **Edge Functions (optional but recommended)**:
  - `pack-download` to generate a zip server-side for large packs.
  - `teacher-import` for bulk CSV imports.

### Sync Model (Offline-first)
- **Student pulls**: course pack manifest (lessons + asset metadata + version hash) then downloads assets.
- **Student pushes**: progress events + quiz attempts/submissions.
- **Conflict approach**:
  - Teacher is the source of truth for content/quizzes.
  - Student-generated data uses append-only/event logs where possible.

## 3) Folder Structure (Target)

Current code mixes “pages”, local DB types, and sync logic. The target structure keeps your existing pages but moves logic behind feature boundaries.

```
src/
  app/
    App.tsx
    router.tsx
    providers/
      AuthProvider.tsx
      QueryProvider.tsx
  shared/
    components/
    lib/
      supabase.ts
      env.ts
      logger.ts
    types/
  data/
    local/
      db.ts
      schema.ts
      migrations/
    remote/
      courses.api.ts
      lessons.api.ts
      quizzes.api.ts
      storage.api.ts
    sync/
      sync.service.ts
      sync.queue.ts
  features/
    auth/
      auth.service.ts
      RequireAuth.tsx
      RequireRole.tsx
      SignInPage.tsx
    student/
      courses/
      downloads/
      profile/
      progress/
      quizzes/
    teacher/
      courses/
      uploads/
      quiz-maker/
      tracker/
```

**Why this helps**
- UI stays simple; complex logic sits in `data/*` and `features/*`.
- It becomes much easier to unit-test or swap implementations.

## 4) Authentication & Authorization

### Auth
- Use Supabase Auth.
- After sign-in, fetch `profiles` row and cache it in memory.
- Persist session via Supabase (localStorage) so students can stay signed in offline after first login.

### Roles
- `profiles.role` in `('student','teacher','admin')`.
- Enforced by RLS policies (database is the enforcement point).

### Route Guards
- `RequireAuth`: redirects to sign-in.
- `RequireRole('teacher')`: blocks student access to teacher tools.

## 5) Supabase Data Model (Proposed)

This is a pragmatic schema that maps directly to your current concepts (`Course`, `Lesson`, `QuizAttempt`, etc.), but productionized with UUIDs and relationships.

### Core tables
- `profiles (id uuid pk = auth.users.id, role text, full_name text, school_id text, created_at timestamptz)`
- `courses (id uuid pk, code text unique, title text, description text, created_by uuid -> profiles.id, created_at timestamptz)`
- `course_teachers (course_id uuid, teacher_id uuid)`
- `enrollments (course_id uuid, student_id uuid, status text, enrolled_at timestamptz)`

### Lessons / modules
- `lessons (id uuid pk, course_id uuid, title text, description text, type text, order int, duration_minutes int, content_html text nullable)`
- `lesson_assets (id uuid pk, lesson_id uuid, kind text, storage_path text, mime_type text, size_bytes bigint, checksum_sha256 text, is_lite boolean, created_at timestamptz)`

### Course pack versioning (recommended)
- `course_pack_versions (course_id uuid pk, version int, manifest_hash text, updated_at timestamptz)`

### Quizzes
- `quizzes (id uuid pk, course_id uuid, title text, created_by uuid, published boolean, updated_at timestamptz)`
- `quiz_questions (id uuid pk, quiz_id uuid, prompt text, order int)`
- `quiz_options (id uuid pk, question_id uuid, label text, is_correct boolean)`

### Student data
- `lesson_progress (id uuid pk, lesson_id uuid, student_id uuid, completed boolean, completed_at timestamptz, time_spent_seconds int, updated_at timestamptz)`
- `quiz_submissions (id uuid pk, quiz_id uuid, student_id uuid, score int, answers_json jsonb, device_timestamp timestamptz, created_at timestamptz)`

### Tracker-friendly views
- `v_student_course_summary`: per student/course completion rate, last activity, avg quiz score.

## 6) Storage (Uploads + Downloads)

### Buckets
- `course-assets` (private)

### Storage paths
- `course-assets/{course_id}/{lesson_id}/{asset_id}/{filename}`

### Download patterns
- Individual download: signed URL for the asset.
- Course pack download:
  - **Small packs**: client downloads assets and zips with JSZip, then stores blobs in Dexie.
  - **Large packs**: Edge Function generates zip (streamed) with service role.

## 7) Offline Storage Strategy (Dexie)

Today Dexie is global; it should be **user-scoped** so a shared device can support multiple accounts.

Two viable approaches:
1) **Separate DB per user**: `HNVS_LMS_DB_${userId}` (simplest, clean isolation).
2) Single DB with `userId` column on every table (more complex migrations).

Recommended: **separate DB per user**.

Store locally:
- Downloaded course manifest + version.
- Lesson metadata.
- Asset blobs (or references) for offline viewing.
- Progress and quiz attempts with `syncStatus` queue.

## 8) Feature Mapping (How each feature works)

### Student-side

#### A) Authentication
- Sign-in page -> Supabase Auth.
- Fetch `profiles` -> ensure role is student.
- Store session; allow offline usage post-login.

#### B) Download pack + individual module download
- Student selects course.
- App checks `course_pack_versions` and local version.
- If outdated or not present:
  - Pull lessons + lesson_assets.
  - Download required assets (lite by default) and store as blobs locally.
- Individual download is just downloading one asset and storing it.

#### C) Student profile
- `profiles` table holds persistent profile data.
- Local UI can show cached profile offline.

### Teacher-side

#### A) Authentication
- Same sign-in, but enforce `profiles.role = 'teacher'`.

#### B) Upload modules
- Teacher creates/edits lessons in DB.
- Teacher uploads assets to Storage and inserts `lesson_assets` metadata.
- Update `course_pack_versions` (increment + new manifest hash).

#### C) Quiz maker
- Teacher creates quiz, questions, options.
- Publish quiz -> students can download quiz metadata on next pack update.

#### D) Student tracker
- Teacher dashboard queries:
  - progress (lesson_progress)
  - quiz submissions (quiz_submissions)
  - enrollment state
- Prefer a view or RPC to reduce client complexity.

## 9) Security (RLS principles)

**Always enable RLS** on all tables in production.

Rules of thumb:
- Students can only read content for courses they are enrolled in.
- Teachers can only manage courses they are assigned to.
- Students can only insert/update their own progress/submissions.
- Teachers can read aggregated student progress for their courses.

See `supabase/schema.sql` for a concrete starting point.

## 10) Implementation Roadmap (Recommended Order)

1) **Auth + Profiles + Roles (foundation)**
   - Add sign-in / sign-out UI.
   - Add `profiles` + RLS.
   - Replace `getStudentUUID()` usage with `auth.uid()`.

2) **Courses + Enrollment + Teacher assignment**
   - Courses table + enrollments + course_teachers.

3) **Uploads + Storage + Pack manifest**
   - Teacher upload -> Storage + lesson_assets.
   - Student download -> manifest + blobs.

4) **Quiz maker + submissions**
   - Normalize quiz schema.
   - Update offline attempt queue + sync.

5) **Tracker**
   - Views/RPCs for teacher dashboard.

---

If you want, the next step can be: implement Phase 1 (Auth + Profiles + route guards) in code, then move on to downloads and uploads.
