-- Make the course-content bucket public so getPublicUrl works
update storage.buckets
set public = true
where id = 'course-content';

-- Ensure the policy allows public read if needed, though 'public' buckets 
-- bypass RLS for GET requests to /object/public/
-- But we should ensure the policy "Give everyone read access" exists just in case
-- actually, storage.buckets.public = true is the key.

-- Just in case, grant select to anon if not already covered (usually implied by public bucket)
-- We can add a policy for anon/public read
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'course-content' );
