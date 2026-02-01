-- Add allowed_attempts to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS allowed_attempts int NOT NULL DEFAULT 1;

-- Update existing quizzes to have 1 attempt allowed by default
UPDATE public.quizzes SET allowed_attempts = 1 WHERE allowed_attempts IS NULL;
