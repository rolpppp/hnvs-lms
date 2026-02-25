-- =============================================================
-- Migration: Fix course RLS policies + auto-enroll course creator
-- Date: 2026-02-24
-- Problem:
--   1. courses SELECT policy excluded the course creator (created_by)
--      unless they were also in course_teachers — meaning newly created
--      courses were invisible to the teacher who made them.
--   2. courses INSERT policy did not enforce created_by = auth.uid().
--   3. No DELETE policy existed for courses in the base schema.
--   4. No trigger to auto-add the creator into course_teachers, so
--      is_teacher_for_course() always returned false for new courses,
--      blocking lesson/quiz management for the creator.
-- =============================================================

-- ---------------------------------------------------------
-- 1. Fix the courses SELECT policy
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "courses_select_enrolled_students" ON public.courses;
DROP POLICY IF EXISTS "courses_select_all" ON public.courses;

CREATE POLICY "courses_select_enrolled_or_teacher_or_creator"
  ON public.courses FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.course_teachers ct WHERE ct.course_id = courses.id AND ct.teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = courses.id AND e.student_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------
-- 2. Fix the courses INSERT policy
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "courses_insert_teacher" ON public.courses;

CREATE POLICY "courses_insert_teacher"
  ON public.courses FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('teacher', 'admin'))
  );

-- ---------------------------------------------------------
-- 3. Fix courses UPDATE policy (re-apply clean version)
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "courses_update_teacher" ON public.courses;

CREATE POLICY "courses_update_teacher"
  ON public.courses FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.course_teachers ct WHERE ct.course_id = courses.id AND ct.teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.course_teachers ct WHERE ct.course_id = courses.id AND ct.teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------
-- 4. Add courses DELETE policy (was missing entirely)
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "courses_delete_teacher" ON public.courses;

CREATE POLICY "courses_delete_teacher"
  ON public.courses FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ---------------------------------------------------------
-- 5. Trigger: auto-insert creator into course_teachers
--    This ensures is_teacher_for_course() works immediately
--    for all downstream policies (lessons, quizzes, etc.)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_creator_to_course_teachers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.course_teachers (course_id, teacher_id)
  VALUES (NEW.id, NEW.created_by)
  ON CONFLICT (course_id, teacher_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_creator_to_course_teachers ON public.courses;

CREATE TRIGGER trg_add_creator_to_course_teachers
  AFTER INSERT ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.add_creator_to_course_teachers();

-- ---------------------------------------------------------
-- 6. Back-fill: add existing course creators to course_teachers
--    (fixes courses already in the database)
-- ---------------------------------------------------------
INSERT INTO public.course_teachers (course_id, teacher_id, created_at)
SELECT id, created_by, created_at
FROM public.courses
ON CONFLICT (course_id, teacher_id) DO NOTHING;
