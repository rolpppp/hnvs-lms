-- ============================================
-- STORAGE SETUP: course-content Bucket
-- ============================================

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-content', 'course-content', false)
ON CONFLICT (id) DO NOTHING;

-- 2. ENABLE RLS (It's usually enabled by default on storage.objects, but good to ensure)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Give teachers write access" ON storage.objects;
DROP POLICY IF EXISTS "Give everyone read access" ON storage.objects;

-- POLICY: Teachers/Admins can upload/edit/delete
CREATE POLICY "Give teachers write access"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'course-content' 
  AND (
    auth.role() = 'authenticated' 
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  )
)
WITH CHECK (
  bucket_id = 'course-content' 
  AND (
    auth.role() = 'authenticated' 
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  )
);

-- POLICY: Authenticated users (Students & Teachers) can download/read
CREATE POLICY "Give authenticated read access"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'course-content' 
  AND auth.role() = 'authenticated'
);

-- Note: In a real "offline-first" (public download) scenario, we might need public read,
-- or use signed URLs. For now, authenticated read is safer.
