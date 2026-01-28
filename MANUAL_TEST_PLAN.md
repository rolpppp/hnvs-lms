# Manual Test Plan - UUID Migration & Main Features

**Test Date:** January 14, 2026  
**App URL:** http://localhost:5174  
**Purpose:** Verify UUID implementation fixes Supabase sync errors and all features work correctly

---

## Pre-Test Setup

### Check localStorage for UUID Generation
Open browser DevTools Console and run:
```javascript
// Check student UUID
console.log('Student UUID:', localStorage.getItem('student_uuid'));

// Check quiz ID mappings
console.log('Quiz-1 UUID:', localStorage.getItem('uuid_map_quiz-1'));
console.log('Quiz-2 UUID:', localStorage.getItem('uuid_map_quiz-2'));
```

**Expected:** UUIDs should be generated on first use and persist across sessions.

---

## Test 1: Student UUID Generation ✓

**Steps:**
1. Open app in browser (first time or after clearing localStorage)
2. Open DevTools Console
3. Check: `localStorage.getItem('student_uuid')`

**Expected Result:**
- A valid UUID is generated (format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
- Same UUID persists across page refreshes
- UUID is used in all student-related operations

**Validation:**
```javascript
const uuid = localStorage.getItem('student_uuid');
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
console.log('Valid UUID:', uuidRegex.test(uuid));
```

---

## Test 2: Course Navigation & Display ✓

**Steps:**
1. From Dashboard, view all 3 courses:
   - Automotive Servicing NC II
   - Cookery NC II  
   - Electrical Installation & Maintenance NC II
2. Click on "Automotive Servicing NC II"
3. Verify course details page loads
4. Check lesson list displays correctly

**Expected Result:**
- All courses display with correct titles, codes, and metadata
- Course detail page shows lessons in order
- Lesson types are correctly indicated (video, PDF, text, quiz)

---

## Test 3: Lesson Progress Tracking ✓

**Steps:**
1. Navigate to any text or video lesson
2. Scroll through content
3. Click "Mark as Complete"
4. Return to course detail page
5. Open DevTools Console and check:
```javascript
// Open IndexedDB > hnvs-lms > lessonProgress
// Verify studentId is a UUID
```

**Expected Result:**
- Lesson marked complete with green checkmark
- Progress bar updates on course detail page
- `studentId` in IndexedDB is a UUID (not 'student-1')
- Completion persists across page refreshes

---

## Test 4: Quiz Taking & UUID Storage ✓

**Steps:**
1. Navigate to "Lesson 4: Safety & Tools Quiz"
2. Click to start quiz
3. Answer all 3 questions
4. Submit quiz
5. Open DevTools > Application > IndexedDB > hnvs-lms > quizAttempts
6. Inspect the latest entry

**Expected Result:**
- Quiz interface loads correctly
- Questions display with radio options
- Submit button works
- Score is calculated and displayed
- In IndexedDB, verify:
  - `quizId` is a UUID (not "quiz-1")
  - `studentId` is a UUID (not "student-1")
  - `syncStatus` is "pending"

**Validation Commands:**
```javascript
// Check quiz attempt
const db = await window.indexedDB.open('hnvs-lms');
// Inspect quizAttempts table
```

---

## Test 5: Offline Functionality ✓

**Steps:**
1. Open DevTools > Network tab
2. Check "Offline" mode
3. Navigate between pages
4. Take a quiz
5. Check quiz is saved with `syncStatus: 'pending'`
6. Uncheck "Offline" mode

**Expected Result:**
- App continues to work offline
- Quiz submissions are saved locally
- No errors in console
- Data persists in IndexedDB

---

## Test 6: Sync to Supabase (Critical UUID Test) ✓

**Prerequisites:**
- Ensure `.env` has valid Supabase credentials
- Ensure Supabase tables exist with UUID columns

**Steps:**
1. Take a quiz (ensure it saves with `syncStatus: 'pending'`)
2. Go online (if offline)
3. Click sync button or wait for auto-sync
4. Open DevTools Console
5. Watch for sync messages

**Expected Result:**
- Console shows: "Synced X quiz attempts"
- NO error: "invalid input syntax for type uuid"
- Quiz attempts marked as `syncStatus: 'synced'` in IndexedDB
- Supabase `quiz_submissions` table contains new records with UUID values

**Check Supabase:**
```sql
-- Run in Supabase SQL Editor
SELECT quiz_id, student_id, score, device_timestamp 
FROM quiz_submissions 
ORDER BY device_timestamp DESC 
LIMIT 5;
```

**Verify:**
- `quiz_id` and `student_id` are valid UUIDs
- Data matches what was submitted locally

---

## Test 7: Notification System ✓

**Steps:**
1. Take and sync a quiz
2. Navigate to Notification Center
3. Check for grade notification

**Expected Result:**
- Grade notification appears
- Shows correct score
- `userId` in IndexedDB notifications table is a UUID
- Notification can be marked as read
- Browser notification appears (if permission granted)

---

## Test 8: Student Progress Dashboard ✓

**Steps:**
1. Navigate to "My Progress" page
2. Verify all progress data displays
3. Open DevTools Console

**Expected Result:**
- Progress shows completed lessons
- Quiz scores display
- Charts/stats are accurate
- All queries use UUID for studentId (check console for any errors)

---

## Test 9: Multiple Quiz Attempts ✓

**Steps:**
1. Take the same quiz multiple times
2. Verify each attempt is saved separately
3. Check IndexedDB for multiple entries

**Expected Result:**
- Each attempt has unique local ID
- All attempts use same UUID for `studentId` and `quizId`
- Latest score is displayed in progress view

---

## Test 10: Cross-Session Persistence ✓

**Steps:**
1. Take a quiz and complete a lesson
2. Close browser tab
3. Open new tab and navigate to app
4. Check progress is preserved

**Expected Result:**
- Same student UUID is used
- Quiz attempts persist
- Lesson progress persists
- No duplicate data created

---

## Test 11: UUID Mapping Consistency ✓

**Steps:**
1. Clear localStorage completely
2. Take "quiz-1" 
3. Check generated UUID: `localStorage.getItem('uuid_map_quiz-1')`
4. Refresh page
5. Take "quiz-1" again
6. Check UUID again

**Expected Result:**
- Same UUID is used for "quiz-1" across sessions
- No new UUIDs created for same quiz
- Mapping is stable and persistent

---

## Error Scenarios to Test

### Test 12: Network Failure During Sync
1. Start syncing
2. Disable network mid-sync
3. Check `syncStatus` remains "pending"
4. Re-enable network and retry

### Test 13: Invalid Supabase Credentials
1. Temporarily break Supabase URL in `.env`
2. Try syncing
3. Verify graceful error handling

---

## Success Criteria

- ✅ No "invalid input syntax for type uuid" errors
- ✅ All IDs sent to Supabase are valid UUIDs
- ✅ Student UUID is consistent across sessions
- ✅ Quiz ID mappings are stable
- ✅ Offline functionality works correctly
- ✅ Sync completes successfully
- ✅ Data integrity maintained
- ✅ No console errors related to UUID format

---

## Troubleshooting

### If UUID errors persist:
1. Check Supabase table column types are `uuid` not `text`
2. Verify `.env` has correct Supabase credentials
3. Clear browser data and test fresh
4. Check console for specific error messages

### To inspect data:
```javascript
// Get all quiz attempts
const db = await window.indexedDB.open('hnvs-lms');
// Check structure in DevTools

// Or use Dexie
import('dexie').then(async ({Dexie}) => {
  const db = new Dexie('hnvs-lms');
  await db.open();
  const attempts = await db.table('quizAttempts').toArray();
  console.table(attempts);
});
```

---

## Report Template

**Test Results:**
- Test 1-11: [PASS/FAIL]
- Critical Issues: [None/List]
- UUID Format: [Valid/Invalid]
- Sync Status: [Success/Failed]
- Errors Found: [None/List]

**Notes:**
[Any observations or recommendations]
