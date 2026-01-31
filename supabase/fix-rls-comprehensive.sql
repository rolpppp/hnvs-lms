-- ============================================
-- SQL Script: Comprehensive RLS Fix for HNVS LMS
-- ============================================

-- 1. PROFILES
-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;

-- Create Policies
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (auth.role() = 'authenticated'); -- Needed for checking roles


-- 2. COURSES
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses_select_all" ON courses;
DROP POLICY IF EXISTS "courses_insert_teacher" ON courses;
DROP POLICY IF EXISTS "courses_update_teacher" ON courses;
DROP POLICY IF EXISTS "courses_delete_teacher" ON courses;

-- Everyone can view courses
CREATE POLICY "courses_select_all" ON courses FOR SELECT USING (true);

-- Only Teachers/Admins can create courses
CREATE POLICY "courses_insert_teacher" ON courses FOR INSERT WITH CHECK (
  auth.uid() = created_by 
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);

-- Only Owner Teacher (or Admin) can update/delete
CREATE POLICY "courses_update_teacher" ON courses FOR UPDATE USING (
  auth.uid() = created_by 
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "courses_delete_teacher" ON courses FOR DELETE USING (
  auth.uid() = created_by 
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- 3. ENROLLMENTS
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enrollments_select_own" ON enrollments;
DROP POLICY IF EXISTS "enrollments_insert_own" ON enrollments;
DROP POLICY IF EXISTS "enrollments_update_own" ON enrollments;

-- Students can see their own enrollments
CREATE POLICY "enrollments_select_own" ON enrollments FOR SELECT USING (student_id = auth.uid());

-- Students can enroll themselves
CREATE POLICY "enrollments_insert_own" ON enrollments FOR INSERT WITH CHECK (student_id = auth.uid());

-- Students can update their own status (optional, usually teacher action, but allowed for now)
CREATE POLICY "enrollments_update_own" ON enrollments FOR UPDATE USING (student_id = auth.uid());


-- 4. LESSONS
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lessons_select_all" ON lessons;
DROP POLICY IF EXISTS "lessons_insert_teacher" ON lessons;

-- Everyone can view lessons (or restrict to enrolled?) -> simplified to ALL for now
CREATE POLICY "lessons_select_all" ON lessons FOR SELECT USING (true);

-- Only Teachers linked to the course can create
-- (Simplified: Any teacher can create for any course they own)
CREATE POLICY "lessons_insert_teacher" ON lessons FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = course_id 
    AND c.created_by = auth.uid()
  )
);


-- 5. QUIZZES
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quizzes_select_all" ON quizzes;
DROP POLICY IF EXISTS "quizzes_insert_teacher" ON quizzes;

CREATE POLICY "quizzes_select_all" ON quizzes FOR SELECT USING (true);

CREATE POLICY "quizzes_insert_teacher" ON quizzes FOR INSERT WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);


-- 6. QUIZ SUBMISSIONS
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_submissions_select_own" ON quiz_submissions;
DROP POLICY IF EXISTS "quiz_submissions_insert_own" ON quiz_submissions;

-- View own submissions
CREATE POLICY "quiz_submissions_select_own" ON quiz_submissions FOR SELECT USING (student_id = auth.uid());

-- Submit own results
CREATE POLICY "quiz_submissions_insert_own" ON quiz_submissions FOR INSERT WITH CHECK (student_id = auth.uid());


-- 7. ASSIGNMENT SUBMISSIONS
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignment_submissions_select_own" ON assignment_submissions;
DROP POLICY IF EXISTS "assignment_submissions_insert_own" ON assignment_submissions;

CREATE POLICY "assignment_submissions_select_own" ON assignment_submissions FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "assignment_submissions_insert_own" ON assignment_submissions FOR INSERT WITH CHECK (student_id = auth.uid());


-- 8. NOTIFICATIONS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications; -- Mark as read

CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid());


-- ============================================
-- DIAGNOSTIC HELPER
-- ============================================
-- The common issue is that a user exists in auth.users but has NO entry in public.profiles.
-- This function fixes that for the CURRENT user if missing.

DO $$
DECLARE
  current_user_id UUID;
  user_email TEXT;
BEGIN
  current_user_id := auth.uid();
  
  -- If user is logged in
  IF current_user_id IS NOT NULL THEN
    -- Check if profile exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = current_user_id) THEN
      -- Try to get email (Note: accessing auth.users directly in DO block might be restricted/complex)
      -- So we insert a default profile.
      INSERT INTO profiles (id, role, full_name, school_id)
      VALUES (current_user_id, 'teacher', 'Restored User', 'fix-001'); 
      -- Note: Defaulting to 'teacher' to unblock you. Change to 'student' if needed.
    END IF;
  END IF;
END $$;
