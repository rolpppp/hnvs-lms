-- update_schema_v4.sql
-- Add week_number to lessons for week-based organization

ALTER TABLE public.lessons
ADD COLUMN IF NOT EXISTS week_number int;

CREATE INDEX IF NOT EXISTS idx_lessons_course_week
ON public.lessons(course_id, week_number);
