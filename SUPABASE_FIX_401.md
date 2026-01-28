# Supabase 401 Unauthorized Error - Fix Guide

## The Problem

You're seeing these errors:
```
401 (Unauthorized)
Quiz sync failed: new row violates row-level security policy for table "quiz_submissions"
```

## Root Cause

**Row-Level Security (RLS)** is enabled on your Supabase tables, but there are no policies allowing the anonymous user (anon key) to insert data.

## Solution - Choose One Option

### Option 1: Disable RLS (Recommended for Development) ⚡

**Fastest fix - Run this in Supabase SQL Editor:**

```sql
-- Disable RLS on quiz_submissions table
ALTER TABLE quiz_submissions DISABLE ROW LEVEL SECURITY;

-- Disable RLS on assignment_submissions table (if exists)
ALTER TABLE assignment_submissions DISABLE ROW LEVEL SECURITY;

-- Disable RLS on notifications table (if exists)
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
```

**Steps:**
1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/kswztrreestgtbuozzuo
2. Click **SQL Editor** in the left sidebar
3. Paste the SQL above
4. Click **RUN**
5. Test your app again - sync should now work!

---

### Option 2: Enable RLS with Policies (For Production)

If you want to keep security enabled, create policies that allow inserts:

```sql
-- Enable RLS
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert quiz submissions
CREATE POLICY "Allow anon insert quiz_submissions"
  ON quiz_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to read quiz submissions
CREATE POLICY "Allow anon select quiz_submissions"
  ON quiz_submissions
  FOR SELECT
  TO anon
  USING (true);
```

---

### Option 3: Run Complete Setup Script

Use the comprehensive SQL script I created:

1. Open: [supabase-setup.sql](supabase-setup.sql)
2. Copy the entire file
3. Paste into Supabase SQL Editor
4. Run it

This will:
- Create all necessary tables
- Add proper indexes
- Disable RLS for development
- Fix the notification warning

---

## Quick Test Steps

After running the SQL:

1. **Clear your browser's IndexedDB:**
   - Open DevTools > Application > IndexedDB
   - Right-click "hnvs-lms" > Delete

2. **Take a new quiz:**
   - Navigate to any quiz
   - Answer the questions
   - Submit

3. **Watch the console:**
   - You should see: "Synced 1 quiz attempts" ✅
   - No more 401 errors!

4. **Verify in Supabase:**
   - Go to Table Editor
   - Open `quiz_submissions` table
   - You should see your submission with UUID values

---

## Additional Fixes

### Fix Notification Index Warning

The warning about `[userId+isRead]` index is already included in the setup script. If you want to run it separately:

```sql
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, is_read);
```

---

## Troubleshooting

### Still getting 401?

1. **Check your .env file:**
   ```bash
   cat .env
   ```
   Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct

2. **Restart dev server:**
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

3. **Check Supabase project status:**
   - Ensure your project isn't paused
   - Go to: https://supabase.com/dashboard/project/kswztrreestgtbuozzuo/settings/general

### Table doesn't exist?

Run the complete [supabase-setup.sql](supabase-setup.sql) script to create all tables.

---

## Understanding RLS

**Row-Level Security (RLS)** is a Supabase feature that restricts database access based on user identity. When enabled:

- Anonymous users (using anon key) have NO access by default
- You must create explicit policies to allow operations
- This is great for production but can block development

**For development:** Disable RLS  
**For production:** Enable RLS with proper policies based on user authentication

---

## Next Steps

1. ✅ Run Option 1 SQL (disable RLS)
2. ✅ Test quiz sync in your app
3. ✅ Verify data appears in Supabase Table Editor
4. ✅ Continue testing other features

Once you add real authentication (Supabase Auth), you can enable RLS and create user-specific policies.
