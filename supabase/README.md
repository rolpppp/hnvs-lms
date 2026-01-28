# Supabase setup (target)

This folder contains the proposed production schema and RLS policies.

## Apply

1. Create a Supabase project.
2. In Supabase SQL editor, run:
   - `supabase/schema.sql`

## Storage

Create a private bucket:
- `course-assets`

Then add Storage policies matching `enrollments` / `course_teachers`.

## Notes

The current app prototype disables RLS for speed of testing. For production, keep RLS enabled and rely on policies.
