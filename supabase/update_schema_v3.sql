-- update_schema_v3.sql
-- Add quiz_id to lessons table to link lessons to quizzes

ALTER TABLE public.lessons 
ADD COLUMN IF NOT EXISTS quiz_id uuid REFERENCES public.quizzes(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lessons_quiz_id ON public.lessons(quiz_id);
