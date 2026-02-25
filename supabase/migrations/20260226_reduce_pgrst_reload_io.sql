-- =============================================================
-- Migration: Reduce PostgREST schema-reload Disk IO
-- Date: 2026-02-26
--
-- DIAGNOSIS
-- ---------
-- pg_stat_statements shows these 3 queries dominate exec time:
--
--   1. SELECT name FROM pg_timezone_names        → 4842ms total (4 calls)
--   2. WITH base_types AS (...) [schema CTE]      → 749ms  total (4 calls)
--   3. Functions introspection CTE                → 381ms  total (4 calls)
--
-- All three are PostgREST internal queries that run on every
-- schema cache reload.  They scan large pg_catalog tables that
-- exceed the free-tier shared_buffers (~128 MB on Micro compute),
-- causing physical disk reads — exactly what drives up Disk IO.
--
-- Cache hit rates confirm this:
--   index hit rate : 76%   (should be >99%)
--   table hit rate : 88%   (should be >99%)
--
-- FIXES (in order of impact)
-- --------------------------
-- 1. Pin timezone at DB level    → eliminates query #1 entirely
-- 2. Pin pgrst.db_schemas        → narrows schema introspection scope
-- 3. Indexes + VACUUM reminder   → reduce pages read per user query
-- 4. pg_stat_statements reset    → clean baseline after deploy
-- =============================================================


-- ---------------------------------------------------------
-- 1. PIN TIMEZONE — eliminates the #1 offender entirely
--
-- PostgREST calls `SELECT name FROM pg_timezone_names` when
-- the DB timezone is set to a symbolic name it needs to resolve.
-- Pinning it to 'UTC' at the database (and role) level means
-- PostgREST finds an exact match immediately and skips the scan.
-- All app timestamps are stored as timestamptz, so this is safe.
-- ---------------------------------------------------------
ALTER DATABASE postgres SET timezone = 'UTC';

-- Belt-and-suspenders: also pin it for the PostgREST authenticator role.
-- (If the role name differs on your project leave the second line out.)
ALTER ROLE authenticator SET timezone = 'UTC';


-- ---------------------------------------------------------
-- 2. NARROW PGRST SCHEMA SCOPE
--
-- PostgREST introspects every schema it is configured to expose.
-- By explicitly pinning it to just 'public' we prevent it from
-- scanning extensions / internal schemas if the default ever
-- drifts.  This is a no-op if already set, but makes it explicit.
-- ---------------------------------------------------------
ALTER ROLE authenticator SET pgrst.db_schemas = 'public';


-- ---------------------------------------------------------
-- 3. EXTRA INDEXES FOR USER QUERIES
--    (complement the 20260224_reduce_disk_io migration)
--
-- These target the RLS sub-queries that run on every request
-- and currently do sequential scans on profiles.
-- ---------------------------------------------------------

-- Speed up "is this user a teacher/admin/student?" RLS sub-selects
CREATE INDEX IF NOT EXISTS idx_profiles_id_role
  ON public.profiles (id, role);

-- Speed up is_teacher_for_course() which joins course_teachers on both cols
-- (the PK already covers this, but for partial RLS scans having a plain
--  covering index on (teacher_id, course_id) helps the planner.)
CREATE INDEX IF NOT EXISTS idx_course_teachers_teacher_course
  ON public.course_teachers (teacher_id, course_id);

-- Speed up enrollment RLS checks that filter (course_id, student_id, status)
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course_status
  ON public.enrollments (student_id, course_id, status);


-- ---------------------------------------------------------
-- 4. RESET pg_stat_statements
--
-- Gets a clean baseline so the next monitoring snapshot
-- reflects the state AFTER these fixes, not before.
--
-- Run this AFTER applying the migration:
--   SELECT pg_stat_statements_reset();
--
-- (Listed as a comment because it is a volatile call that
--  discards history — only run it once intentionally.)
-- ---------------------------------------------------------


-- ---------------------------------------------------------
-- 5. VACUUM ANALYZE REMINDER
--
-- Run each line SEPARATELY in the Supabase SQL Editor
-- (VACUUM cannot run inside a transaction):
--
--   VACUUM ANALYZE public.profiles;
--   VACUUM ANALYZE public.courses;
--   VACUUM ANALYZE public.lessons;
--   VACUUM ANALYZE public.enrollments;
--   VACUUM ANALYZE public.course_teachers;
--   VACUUM ANALYZE public.quiz_submissions;
--   VACUUM ANALYZE public.lesson_progress;
--   VACUUM ANALYZE public.assignment_submissions;
--
-- After vacuuming, restart the DB once from:
--   Supabase Dashboard → Project Settings → Database → Restart
-- This re-warms shared_buffers with the now-smaller, vacuumed pages.
-- ---------------------------------------------------------
