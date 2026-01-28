-- Fix 409 Conflict Error - Multiple Options

-- ===========================================
-- OPTION 1: Allow Multiple Quiz Attempts (Recommended)
-- ===========================================
-- Drop the unique constraint so students can retake quizzes
-- This is the most common use case

-- First, find the constraint name
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'quiz_submissions'::regclass
  AND contype = 'u'; -- unique constraints only

-- If a constraint like "quiz_submissions_quiz_id_student_id_key" exists, drop it:
-- ALTER TABLE quiz_submissions DROP CONSTRAINT quiz_submissions_quiz_id_student_id_key;

-- Or drop by column (if the above doesn't work):
-- ALTER TABLE quiz_submissions DROP CONSTRAINT IF EXISTS unique_quiz_student;


-- ===========================================
-- OPTION 2: Keep Constraint but Update Schema
-- ===========================================
-- If you want to keep "one submission per student per quiz",
-- add an attempt_number or make the ID include timestamp

-- Add attempt number column
ALTER TABLE quiz_submissions 
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

-- Update the unique constraint to allow multiple attempts
-- (First drop the old one, then create new one)


-- ===========================================
-- OPTION 3: Clear Existing Test Data
-- ===========================================
-- If you just want to start fresh and remove test data

-- BE CAREFUL - this deletes all quiz submissions!
-- TRUNCATE TABLE quiz_submissions;


-- ===========================================
-- VERIFY THE FIX
-- ===========================================

-- Check current constraints
SELECT 
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'quiz_submissions'::regclass;

-- Check existing data
SELECT 
  quiz_id,
  student_id,
  score,
  device_timestamp,
  created_at
FROM quiz_submissions
ORDER BY created_at DESC
LIMIT 10;
