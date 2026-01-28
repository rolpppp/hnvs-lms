# UUID Migration Guide

## Problem Fixed
Previously, the app was sending simple string IDs (like `"quiz-1"` and `"student-1"`) to Supabase, which expects UUID format. This caused the error:
```
Error code 22P02: "invalid input syntax for type uuid: "3""
```

## Solution Implemented

### 1. UUID Utility Created
A new utility file `src/lib/uuid.ts` provides:
- `generateUUID()` - Generates v4 UUIDs
- `getStudentUUID()` - Returns a consistent UUID for the current student (stored in localStorage)
- `getOrCreateUUIDForId(simpleId)` - Maps simple IDs like "quiz-1" to persistent UUIDs

### 2. Updated Files

#### Student ID Updates
All hardcoded `'student-1'` references have been replaced with `getStudentUUID()` calls in:
- `src/pages/QuizPlayer.tsx` - Quiz submissions now use UUID
- `src/hooks/useSync.ts` - Sync notifications use UUID
- `src/hooks/useNotifications.ts` - All notification queries use UUID
- `src/pages/CourseDetail.tsx` - Progress tracking uses UUID
- `src/pages/LessonViewer.tsx` - Lesson progress uses UUID
- `src/pages/StudentProgress.tsx` - All progress queries use UUID

#### Quiz ID Updates
- `src/pages/QuizPlayer.tsx` - Converts quiz IDs to UUIDs using `getOrCreateUUIDForId()` before saving

### 3. How It Works

#### For Students
The first time a student uses the app:
1. A UUID is generated and stored in localStorage
2. This UUID is used consistently for all student actions
3. All progress, quiz submissions, and notifications are tied to this UUID

#### For Quiz IDs
When a quiz is taken:
1. The simple ID (e.g., "quiz-1") is converted to a UUID
2. This mapping is stored in localStorage
3. The same UUID is used for all future references to that quiz
4. This ensures consistency across app restarts

### 4. Data Sync
When syncing to Supabase:
- Quiz submissions include `quiz_id` and `student_id` as proper UUIDs
- Assignment submissions include `assignment_id` and `student_id` as proper UUIDs
- Supabase tables accept these UUID values without errors

### 5. Backward Compatibility
- The UUID mapping is persisted in localStorage
- Existing simple IDs are automatically converted to UUIDs
- No data loss occurs during migration
- The app continues to work both online and offline

## Testing
After this fix:
1. Clear browser data to test fresh UUID generation
2. Take a quiz - it should save with UUID IDs
3. Sync to Supabase - no more UUID errors should appear
4. Check browser console - sync should succeed

## Future Authentication
When real authentication is added:
- Replace `getStudentUUID()` with the actual user ID from auth provider
- Ensure auth provider returns UUIDs (Supabase Auth does this by default)
- Remove the localStorage UUID generation
