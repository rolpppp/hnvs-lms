-- ⚡ QUICK FIX - Copy and paste this into Supabase SQL Editor
-- This will fix the 401 Unauthorized error immediately

ALTER TABLE quiz_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

SELECT 'RLS disabled - you can now sync data!' AS status;
