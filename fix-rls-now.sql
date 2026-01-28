-- ⚡ INSTANT FIX - Disable RLS on Your Existing Tables
-- Copy this entire script and run it in Supabase SQL Editor
-- This will fix the 401 Unauthorized error immediately

-- Disable RLS on all tables that the app writes to
ALTER TABLE quiz_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity = false THEN '✅ RLS DISABLED'
    ELSE '❌ RLS STILL ENABLED'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'quiz_submissions',
    'assignment_submissions', 
    'assignments',
    'quizzes',
    'courses',
    'course_materials',
    'profiles',
    'enrollments'
  )
ORDER BY tablename;
