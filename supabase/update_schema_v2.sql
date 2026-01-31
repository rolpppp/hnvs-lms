-- Update is_teacher_for_course to Check for Course Creator
-- This fixes the issue where a teacher creates a course but isn't explicitly in course_teachers yet,
-- preventing them from adding lessons/assets due to RLS.

CREATE OR REPLACE FUNCTION public.is_teacher_for_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(
    -- Check if user is in course_teachers
    SELECT 1 FROM public.course_teachers ct
    WHERE ct.course_id = p_course_id AND ct.teacher_id = auth.uid()
  ) OR EXISTS(
    -- Check if user IS the creator of the course
    SELECT 1 FROM public.courses c
    WHERE c.id = p_course_id AND c.created_by = auth.uid()
  );
$$;

-- Add is_visible column to lessons for "Hide/Unhide" feature
ALTER TABLE public.lessons 
ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

-- Update RLS policies for lessons to allow teachers to update
-- (Existing policies might already cover 'all' or 'update', but let's ensure it)

-- Ensure we can update visibility
-- The existing policy "lessons_write_teacher" cover ALL operations (INSERT, UPDATE, DELETE)
-- so we just need to make sure the function update above is applied.
