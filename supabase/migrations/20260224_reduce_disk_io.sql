-- supabase/migrations/20260224_reduce_disk_io.sql
-- ============================================================
-- Goal: Reduce Disk IO on the free-tier Supabase instance
-- by adding composite indexes that cover the most frequent
-- query patterns and shrinking dead-tuple bloat.
-- ============================================================

-- ------------------------------------------------------------------
-- 1.  quiz_submissions: composite index on (student_id, quiz_id)
--     The sync code does a per-student lookup AND the uniqueness
--     constraint validates (quiz_id, student_id, device_timestamp).
--     A covering composite index avoids two separate index scans.
-- ------------------------------------------------------------------
create index if not exists idx_quiz_submissions_student_quiz
  on public.quiz_submissions (student_id, quiz_id);

-- ------------------------------------------------------------------
-- 2.  lesson_progress: composite (student_id, completed)
--     StudentProgress page queries progress by student AND filters
--     on completed=true to compute totals.
-- ------------------------------------------------------------------
create index if not exists idx_lesson_progress_student_completed
  on public.lesson_progress (student_id, completed);

-- ------------------------------------------------------------------
-- 3.  announcements: student-facing queries filter by course_id
--     and ORDER BY created_at DESC – a composite index removes
--     the sort step on disk.
-- ------------------------------------------------------------------
create index if not exists idx_announcements_course_created
  on public.announcements (course_id, created_at desc);

-- ------------------------------------------------------------------
-- 4.  assignment_submissions: grading view fetches by assignment_id
--     and optionally filters on graded_at IS NULL (ungraded).
--     Partial index to keep it small.
-- ------------------------------------------------------------------
create index if not exists idx_assignment_submissions_ungraded
  on public.assignment_submissions (assignment_id)
  where graded_at is null;

-- ------------------------------------------------------------------
-- 5.  VACUUM ANALYZE – reclaims dead-tuple space accumulated from
--     repeated upserts, shrinking the pages that must be read from
--     disk.  Run this ONCE manually in the Supabase SQL Editor
--     immediately after applying this migration:
--
--       VACUUM ANALYZE public.profiles;
--       VACUUM ANALYZE public.courses;
--       VACUUM ANALYZE public.lessons;
--       VACUUM ANALYZE public.quiz_submissions;
--       VACUUM ANALYZE public.lesson_progress;
--       VACUUM ANALYZE public.enrollments;
--
--     (VACUUM cannot run inside a transaction, so it is listed here
--      as a comment rather than an executable statement.)
-- ------------------------------------------------------------------
