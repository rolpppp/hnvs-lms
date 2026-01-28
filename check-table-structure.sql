-- Check table structure and constraints for quiz_submissions
-- Run this in Supabase SQL Editor to see what's causing the 409 Conflict

-- 1. Show all columns and their types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'quiz_submissions'
ORDER BY ordinal_position;

-- 2. Show all constraints
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END AS constraint_description,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'quiz_submissions'::regclass
ORDER BY contype;

-- 3. Show all indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'quiz_submissions';

-- 4. Check if there's existing data that might conflict
SELECT 
  id,
  quiz_id,
  student_id,
  score,
  created_at
FROM quiz_submissions
ORDER BY created_at DESC
LIMIT 5;
