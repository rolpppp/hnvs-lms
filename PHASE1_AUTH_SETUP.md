# Phase 1: Authentication Setup - Instructions

## What was implemented

✅ **Authentication Infrastructure**
- Supabase Auth integration with email/password
- `AuthProvider` context for managing authentication state
- Role-based access control (student/teacher/admin)
- Route guards (`RequireAuth`, `RequireRole`)

✅ **Pages**
- Sign In page with demo credentials
- Sign Up page with role selection
- Protected routes for students and teachers

✅ **Migration from Mock to Real Auth**
- Replaced `getStudentUUID()` with `auth.uid()` across all components
- Updated all student-tracking code to use authenticated user IDs
- Removed mock "switch to teacher/student" button
- Added user info display and sign-out button in header

## Setup Instructions

### 1. Run the Schema in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and run the contents of `supabase/schema.sql`
4. Verify tables were created:
   - `profiles`
   - `courses`
   - `course_teachers`
   - `enrollments`
   - `lessons`
   - `lesson_assets`
   - `quizzes`, `quiz_questions`, `quiz_options`
   - `lesson_progress`
   - `quiz_submissions`
   - `course_pack_versions`

### 2. Create Demo Accounts

You can create demo accounts in two ways:

#### Option A: Using the Sign Up Page
1. Start your dev server: `npm run dev`
2. Navigate to the sign-up page
3. Create accounts with these credentials (or use your own):
   - **Student**: student@test.com / student123
   - **Teacher**: teacher@test.com / teacher123

#### Option B: Using Supabase Dashboard
1. Go to **Authentication** > **Users** in Supabase dashboard
2. Click **Add User** and create:
   - Email: `student@test.com`, Password: `student123`
   - Email: `teacher@test.com`, Password: `teacher123`
3. After creating users, note their UUIDs
4. Run this SQL to create profiles:

```sql
-- Replace USER_UUID_1 and USER_UUID_2 with actual UUIDs from Auth > Users
INSERT INTO public.profiles (id, role, full_name, school_id)
VALUES 
  ('USER_UUID_1', 'student', 'Test Student', '2024-001'),
  ('USER_UUID_2', 'teacher', 'Test Teacher', 'T-001');
```

### 3. Configure Environment Variables

Ensure your `.env` file has:
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Test Authentication Flow

1. **Start the app**: `npm run dev`
2. **Sign In**: You should be redirected to `/signin`
3. **Test Student Account**:
   - Sign in with student credentials
   - You should see the student dashboard (courses view)
   - Try accessing `/teacher` - should be blocked and redirected back
4. **Sign Out**: Click sign-out button in header
5. **Test Teacher Account**:
   - Sign in with teacher credentials
   - You should be redirected to `/teacher` (teacher dashboard)
   - Try accessing `/` - should be blocked and redirected to teacher dashboard
6. **Test Sign Up**:
   - Sign out
   - Go to sign-up page
   - Create a new account and verify role-based routing works

## What's Next (Phase 2+)

Now that authentication is working:
- ✅ Users can sign in/out
- ✅ Routes are protected by role
- ✅ All student data is tied to authenticated user IDs

**Phase 2** will focus on:
- Teacher uploads (content + quizzes) to Supabase Storage
- Student downloads (course packs from Storage to local Dexie)
- Enrollments (students subscribe to courses)
- Course pack versioning

**Phase 3**:
- Quiz maker for teachers
- Student tracker dashboard
- Real-time progress sync

## Troubleshooting

### "Row level security policy violation"
- Make sure you ran the schema.sql which includes RLS policies
- Verify `profiles` table has policies enabled

### "User not found" or profile is null
- Check that a `profiles` row exists for your auth user
- The user UUID in `profiles.id` must match `auth.users.id`

### Sign-in redirects to wrong page
- Students should go to `/` (Dashboard)
- Teachers should go to `/teacher` (TeacherDashboard)
- Check `profiles.role` is set correctly

### Can't create new users via sign-up
- Check Supabase Auth settings: email confirmation might be required
- For development, disable email confirmation in Supabase dashboard
- Go to **Authentication** > **Settings** > Disable "Enable email confirmations"
