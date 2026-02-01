-- Create announcements table
create table if not exists announcements (
  id uuid default gen_random_uuid() primary key,
  course_id uuid references courses(id) on delete cascade,
  teacher_id uuid references auth.users(id),
  title text not null,
  content text not null,
  is_urgent boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table announcements enable row level security;

-- Policies
-- Teachers can insert their own announcements
create policy "Teachers can insert announcements"
  on announcements for insert
  with check (auth.uid() = teacher_id);

-- Teachers can update their own announcements
create policy "Teachers can update own announcements"
  on announcements for update
  using (auth.uid() = teacher_id);

-- Teachers can delete their own announcements
create policy "Teachers can delete own announcements"
  on announcements for delete
  using (auth.uid() = teacher_id);

-- Everyone (students and teachers) can view announcements
-- Optionally filter by enrollment if strict privacy needed, but public for now is okay for course context
create policy "Announcements are viewable by authenticated users"
  on announcements for select
  using (auth.role() = 'authenticated');

-- Indexes
create index announcements_course_id_idx on announcements(course_id);
