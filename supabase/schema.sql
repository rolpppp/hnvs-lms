-- supabase/schema.sql
-- Target production schema (starting point)
-- Notes:
-- - Requires pgcrypto for gen_random_uuid() on some Postgres setups.
-- - In Supabase, auth schema already exists.

-- =========================
-- Extensions
-- =========================
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- =========================
-- Profiles
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','teacher','admin')),
  full_name text,
  school_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Create indexes for performance
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_school_id on public.profiles(school_id);

-- Users can read/write their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Allow users to create their own profile (used after signup)
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

-- Allow admins to update any profile
create policy "profiles_update_admin"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Allow users to read other profiles (for displaying names, etc)
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- =========================
-- Courses
-- =========================
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses enable row level security;

-- Create indexes for performance
create index if not exists idx_courses_code on public.courses(code);
create index if not exists idx_courses_created_by on public.courses(created_by);

-- Teacher assignment
create table if not exists public.course_teachers (
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, teacher_id)
);

alter table public.course_teachers enable row level security;

-- Create indexes for performance
create index if not exists idx_course_teachers_course on public.course_teachers(course_id);
create index if not exists idx_course_teachers_teacher on public.course_teachers(teacher_id);

-- Enrollment
create table if not exists public.enrollments (
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  enrolled_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

alter table public.enrollments enable row level security;

-- Create indexes for performance
create index if not exists idx_enrollments_course on public.enrollments(course_id);
create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_status on public.enrollments(status);

-- =========================
-- Lessons & assets
-- =========================
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  type text not null check (type in ('pdf','video','text','quiz')),
  "order" int not null,
  duration_minutes int not null default 0,
  content_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, "order")
);

alter table public.lessons enable row level security;

-- Create indexes for performance
create index if not exists idx_lessons_course on public.lessons(course_id);
create index if not exists idx_lessons_type on public.lessons(type);
create index if not exists idx_lessons_course_order on public.lessons(course_id, "order");

create table if not exists public.lesson_assets (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  kind text not null check (kind in ('pdf','video','image','other')),
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  checksum_sha256 text,
  is_lite boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.lesson_assets enable row level security;

-- Create indexes for performance
create index if not exists idx_lesson_assets_lesson on public.lesson_assets(lesson_id);
create index if not exists idx_lesson_assets_kind on public.lesson_assets(kind);

-- =========================
-- Course pack versions
-- =========================
create table if not exists public.course_pack_versions (
  course_id uuid primary key references public.courses(id) on delete cascade,
  version int not null default 1,
  manifest_hash text,
  updated_at timestamptz not null default now()
);

alter table public.course_pack_versions enable row level security;

-- =========================
-- Quizzes
-- =========================
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  created_by uuid not null references public.profiles(id),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quizzes enable row level security;

-- Create indexes for performance
create index if not exists idx_quizzes_course on public.quizzes(course_id);
create index if not exists idx_quizzes_created_by on public.quizzes(created_by);
create index if not exists idx_quizzes_published on public.quizzes(published);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  prompt text not null,
  "order" int not null,
  created_at timestamptz not null default now(),
  unique (quiz_id, "order")
);

alter table public.quiz_questions enable row level security;

-- Create indexes for performance
create index if not exists idx_quiz_questions_quiz on public.quiz_questions(quiz_id);
create index if not exists idx_quiz_questions_quiz_order on public.quiz_questions(quiz_id, "order");

create table if not exists public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false
);

alter table public.quiz_options enable row level security;

-- Create indexes for performance
create index if not exists idx_quiz_options_question on public.quiz_options(question_id);

-- =========================
-- Student progress + submissions
-- =========================
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  time_spent_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_id)
);

alter table public.lesson_progress enable row level security;

-- Create indexes for performance
create index if not exists idx_lesson_progress_lesson on public.lesson_progress(lesson_id);
create index if not exists idx_lesson_progress_student on public.lesson_progress(student_id);
create index if not exists idx_lesson_progress_completed on public.lesson_progress(completed);

create table if not exists public.quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score int not null,
  answers_json jsonb not null,
  device_timestamp timestamptz not null,
  created_at timestamptz not null default now(),
  -- Prevent duplicate submissions from same device at same timestamp
  unique (quiz_id, student_id, device_timestamp)
);

alter table public.quiz_submissions enable row level security;

-- Create indexes for performance
create index if not exists idx_quiz_submissions_quiz on public.quiz_submissions(quiz_id);
create index if not exists idx_quiz_submissions_student on public.quiz_submissions(student_id);
create index if not exists idx_quiz_submissions_created on public.quiz_submissions(created_at desc);

-- =========================
-- Helper: is teacher for course
-- =========================
create or replace function public.is_teacher_for_course(p_course_id uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.course_teachers ct
    where ct.course_id = p_course_id and ct.teacher_id = auth.uid()
  );
$$;

-- =========================
-- RLS policies (minimal, safe defaults)
-- =========================

-- Profiles: users can read/write their own profile (already defined above near table)
-- Additional profile policy was added above for authenticated users to read all profiles

-- course_teachers: admin and teachers manage; students can see teachers of enrolled courses
create policy "course_teachers_select"
  on public.course_teachers for select
  using (
    teacher_id = auth.uid()
    or exists (select 1 from public.enrollments e where e.course_id = public.course_teachers.course_id and e.student_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "course_teachers_insert_admin"
  on public.course_teachers for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'teacher'))
    and exists (select 1 from public.profiles p where p.id = teacher_id and p.role = 'teacher')
  );

create policy "course_teachers_delete_admin"
  on public.course_teachers for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- enrollments: students can self-enroll or teachers can enroll; teachers can update
create policy "enrollments_select_own_or_teacher"
  on public.enrollments for select
  using (
    student_id = auth.uid()
    or public.is_teacher_for_course(course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "enrollments_insert_self_or_teacher"
  on public.enrollments for insert
  with check (
    (student_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student'))
    or public.is_teacher_for_course(course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "enrollments_update_teacher"
  on public.enrollments for update
  using (
    public.is_teacher_for_course(course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    public.is_teacher_for_course(course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- quiz_questions: students see published quiz questions; teachers manage
create policy "quiz_questions_select_with_quiz"
  on public.quiz_questions for select
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id
      and (
        (q.published = true and exists (select 1 from public.enrollments e where e.course_id = q.course_id and e.student_id = auth.uid()))
        or public.is_teacher_for_course(q.course_id)
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
    )
  );

create policy "quiz_questions_write_teacher"
  on public.quiz_questions for all
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id
      and (public.is_teacher_for_course(q.course_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  )
  with check (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id
      and (public.is_teacher_for_course(q.course_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- quiz_options: students see options for published quizzes; teachers manage
create policy "quiz_options_select_with_question"
  on public.quiz_options for select
  using (
    exists (
      select 1 
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = quiz_options.question_id
      and (
        (q.published = true and exists (select 1 from public.enrollments e where e.course_id = q.course_id and e.student_id = auth.uid()))
        or public.is_teacher_for_course(q.course_id)
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
    )
  );

create policy "quiz_options_write_teacher"
  on public.quiz_options for all
  using (
    exists (
      select 1 
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = quiz_options.question_id
      and (public.is_teacher_for_course(q.course_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  )
  with check (
    exists (
      select 1 
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = quiz_options.question_id
      and (public.is_teacher_for_course(q.course_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- courses: teachers can manage courses they own/teach; enrolled students can read
create policy "courses_select_enrolled_students"
  on public.courses for select
  using (
    exists (select 1 from public.enrollments e where e.course_id = courses.id and e.student_id = auth.uid())
    or exists (select 1 from public.course_teachers ct where ct.course_id = courses.id and ct.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "courses_insert_teacher"
  on public.courses for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher','admin'))
  );

create policy "courses_update_teacher"
  on public.courses for update
  using (
    created_by = auth.uid()
    or exists (select 1 from public.course_teachers ct where ct.course_id = courses.id and ct.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    created_by = auth.uid()
    or exists (select 1 from public.course_teachers ct where ct.course_id = courses.id and ct.teacher_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- enrollments: students can read their own; teachers can read for their courses
create policy "enrollments_select_own_or_teacher"
  on public.enrollments for select
  using (
    student_id = auth.uid()
    or public.is_teacher_for_course(course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- lessons + lesson_assets: enrolled students and course teachers can read; teachers can write
create policy "lessons_select_enrolled_or_teacher"
  on public.lessons for select
  using (
    exists (select 1 from public.enrollments e where e.course_id = lessons.course_id and e.student_id = auth.uid())
    or public.is_teacher_for_course(lessons.course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "lessons_write_teacher"
  on public.lessons for all
  using (
    public.is_teacher_for_course(lessons.course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    public.is_teacher_for_course(lessons.course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "lesson_assets_select_enrolled_or_teacher"
  on public.lesson_assets for select
  using (
    exists (
      select 1
      from public.lessons l
      where l.id = lesson_assets.lesson_id
      and (
        exists (select 1 from public.enrollments e where e.course_id = l.course_id and e.student_id = auth.uid())
        or public.is_teacher_for_course(l.course_id)
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
    )
  );

create policy "lesson_assets_write_teacher"
  on public.lesson_assets for insert
  with check (
    exists (
      select 1
      from public.lessons l
      where l.id = lesson_assets.lesson_id
      and (public.is_teacher_for_course(l.course_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- lesson_progress: students can upsert their own; teachers can read for their courses
create policy "lesson_progress_select_own_or_teacher"
  on public.lesson_progress for select
  using (
    student_id = auth.uid()
    or exists (
      select 1
      from public.lessons l
      where l.id = lesson_progress.lesson_id
      and public.is_teacher_for_course(l.course_id)
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "lesson_progress_upsert_own"
  on public.lesson_progress for insert
  with check (student_id = auth.uid());

create policy "lesson_progress_update_own"
  on public.lesson_progress for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- quiz_submissions: students insert/select own; teachers read for their courses
create policy "quiz_submissions_select_own_or_teacher"
  on public.quiz_submissions for select
  using (
    student_id = auth.uid()
    or exists (
      select 1
      from public.quizzes q
      where q.id = quiz_submissions.quiz_id
      and public.is_teacher_for_course(q.course_id)
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "quiz_submissions_insert_own"
  on public.quiz_submissions for insert
  with check (student_id = auth.uid());

-- quizzes: teachers manage; enrolled students read only published
create policy "quizzes_select_enrolled_published_or_teacher"
  on public.quizzes for select
  using (
    (published = true and exists (select 1 from public.enrollments e where e.course_id = quizzes.course_id and e.student_id = auth.uid()))
    or public.is_teacher_for_course(quizzes.course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "quizzes_write_teacher"
  on public.quizzes for all
  using (
    public.is_teacher_for_course(quizzes.course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    public.is_teacher_for_course(quizzes.course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- course_pack_versions: students read for enrolled courses; teachers update for their courses
create policy "course_pack_versions_select_enrolled_or_teacher"
  on public.course_pack_versions for select
  using (
    exists (select 1 from public.enrollments e where e.course_id = course_pack_versions.course_id and e.student_id = auth.uid())
    or public.is_teacher_for_course(course_pack_versions.course_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "course_pack_versions_upsert_teacher"
  on public.course_pack_versions for insert
  with check (public.is_teacher_for_course(course_pack_versions.course_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "course_pack_versions_update_teacher"
  on public.course_pack_versions for update
  using (public.is_teacher_for_course(course_pack_versions.course_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (public.is_teacher_for_course(course_pack_versions.course_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
