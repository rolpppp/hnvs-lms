-- ============================================
-- Supabase Setup: Quiz Submissions Table & RLS Policies
-- ============================================
-- Run this in Supabase SQL Editor to fix the 401 Unauthorized error
-- ============================================

-- 1. CREATE TABLE (if it doesn't exist)
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL,
  student_id UUID NOT NULL,
  score INTEGER NOT NULL,
  answers_json JSONB NOT NULL,
  device_timestamp TIMESTAMPTZ NOT NULL,
  is_late BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE INDEXES for better query performance
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_id 
  ON quiz_submissions(quiz_id);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student_id 
  ON quiz_submissions(student_id);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_device_timestamp 
  ON quiz_submissions(device_timestamp);

-- 3. DISABLE RLS (Option A - Quick fix for development)
-- Use this if you want to allow all operations without authentication
ALTER TABLE quiz_submissions DISABLE ROW LEVEL SECURITY;

-- ============================================
-- OR (Option B - Enable RLS with permissive policies for development)
-- Use this if you want basic security while testing
-- ============================================

-- Uncomment these lines if you want RLS enabled:
/*
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to INSERT quiz submissions
CREATE POLICY "Allow anonymous insert quiz submissions"
  ON quiz_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to SELECT their own submissions
CREATE POLICY "Allow anonymous select quiz submissions"
  ON quiz_submissions
  FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated users full access"
  ON quiz_submissions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
*/

-- ============================================
-- VERIFY THE SETUP
-- ============================================
-- Run these queries to verify everything is set up correctly:

-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'quiz_submissions'
) AS table_exists;

-- Check RLS status
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'quiz_submissions';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'quiz_submissions';

-- ============================================
-- ASSIGNMENT SUBMISSIONS TABLE (Same fixes)
-- ============================================

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  student_id UUID NOT NULL,
  content_text TEXT,
  device_timestamp TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id 
  ON assignment_submissions(assignment_id);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id 
  ON assignment_submissions(student_id);

-- Disable RLS for development
ALTER TABLE assignment_submissions DISABLE ROW LEVEL SECURITY;

-- ============================================
-- NOTIFICATIONS TABLE FIX (for the warning you saw)
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at BIGINT NOT NULL,
  related_id VARCHAR(255)
);

-- Add the compound index that was suggested in the warning
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, is_read);

-- Disable RLS for development
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE! Your tables are now ready.
-- ============================================

SELECT 'Setup complete! Tables created with RLS disabled for development.' AS status;
