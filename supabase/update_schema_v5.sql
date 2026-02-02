-- update_schema_v5.sql
-- Assignments + submissions + grading

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignments_course on public.assignments(course_id);
create index if not exists idx_assignments_created_by on public.assignments(created_by);

alter table public.assignments enable row level security;

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  text_answer text,
  file_path text,
  file_name text,
  mime_type text,
  score numeric,
  feedback text,
  graded_by uuid references public.profiles(id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index if not exists idx_assignment_submissions_assignment on public.assignment_submissions(assignment_id);
create index if not exists idx_assignment_submissions_student on public.assignment_submissions(student_id);

alter table public.assignment_submissions enable row level security;

-- Policies
create policy "assignments_select_authenticated"
  on public.assignments for select
  using (auth.role() = 'authenticated');

create policy "assignments_insert_teacher"
  on public.assignments for insert
  with check (public.is_teacher_for_course(course_id));

create policy "assignments_update_teacher"
  on public.assignments for update
  using (public.is_teacher_for_course(course_id));

create policy "assignments_delete_teacher"
  on public.assignments for delete
  using (public.is_teacher_for_course(course_id));

create policy "submissions_select_own_or_teacher"
  on public.assignment_submissions for select
  using (
    student_id = auth.uid()
    or public.is_teacher_for_course((select a.course_id from public.assignments a where a.id = assignment_id))
  );

create policy "submissions_insert_own"
  on public.assignment_submissions for insert
  with check (student_id = auth.uid());

create policy "submissions_update_own_or_teacher"
  on public.assignment_submissions for update
  using (
    student_id = auth.uid()
    or public.is_teacher_for_course((select a.course_id from public.assignments a where a.id = assignment_id))
  );
