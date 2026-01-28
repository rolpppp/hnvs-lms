// Quick UUID Test Suite
// Copy and paste this into the browser console to test UUID functionality

console.log('🧪 Starting UUID Test Suite...\n');

// Test 1: Check Student UUID
console.log('📋 Test 1: Student UUID');
const studentUUID = localStorage.getItem('student_uuid');
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidStudentUUID = studentUUID && uuidRegex.test(studentUUID);
console.log(`Student UUID: ${studentUUID}`);
console.log(`Valid: ${isValidStudentUUID ? '✅' : '❌'}`);
console.log('');

// Test 2: Check Quiz ID Mappings
console.log('📋 Test 2: Quiz ID Mappings');
const quizMappings = [
  { simple: 'quiz-1', uuid: localStorage.getItem('uuid_map_quiz-1') },
  { simple: 'quiz-2', uuid: localStorage.getItem('uuid_map_quiz-2') }
];
quizMappings.forEach(mapping => {
  const isValid = mapping.uuid && uuidRegex.test(mapping.uuid);
  console.log(`${mapping.simple} -> ${mapping.uuid || 'Not generated yet'}`);
  console.log(`Valid: ${isValid ? '✅' : '⏳ (Will be generated on quiz attempt)'}`);
});
console.log('');

// Test 3: Inspect IndexedDB (Dexie)
console.log('📋 Test 3: IndexedDB Data');
console.log('Opening database...');

(async () => {
  try {
    // Import Dexie dynamically
    const Dexie = (await import('dexie')).default;
    
    // Open the database
    const db = new Dexie('hnvs-lms');
    await db.open();
    
    // Check quiz attempts
    const quizAttempts = await db.table('quizAttempts').toArray();
    console.log(`\n📊 Quiz Attempts (${quizAttempts.length} total):`);
    if (quizAttempts.length > 0) {
      quizAttempts.slice(-3).forEach((attempt, idx) => {
        console.log(`\nAttempt ${quizAttempts.length - 2 + idx}:`);
        console.log(`  Quiz ID: ${attempt.quizId}`);
        console.log(`  Valid UUID: ${uuidRegex.test(attempt.quizId) ? '✅' : '❌'}`);
        console.log(`  Student ID: ${attempt.studentId}`);
        console.log(`  Valid UUID: ${uuidRegex.test(attempt.studentId) ? '✅' : '❌'}`);
        console.log(`  Score: ${attempt.score}`);
        console.log(`  Sync Status: ${attempt.syncStatus}`);
        console.log(`  Timestamp: ${new Date(attempt.timestamp).toLocaleString()}`);
      });
    } else {
      console.log('  No quiz attempts found. Take a quiz to test!');
    }
    
    // Check lesson progress
    const lessonProgress = await db.table('lessonProgress').toArray();
    console.log(`\n📚 Lesson Progress (${lessonProgress.length} total):`);
    if (lessonProgress.length > 0) {
      lessonProgress.slice(-3).forEach((progress) => {
        console.log(`\nLesson ${progress.lessonId}:`);
        console.log(`  Student ID: ${progress.studentId}`);
        console.log(`  Valid UUID: ${uuidRegex.test(progress.studentId) ? '✅' : '❌'}`);
        console.log(`  Completed: ${progress.completed ? '✅' : '❌'}`);
      });
    } else {
      console.log('  No lesson progress found. Complete a lesson to test!');
    }
    
    // Check notifications
    const notifications = await db.table('notifications').toArray();
    console.log(`\n🔔 Notifications (${notifications.length} total):`);
    if (notifications.length > 0) {
      notifications.slice(-3).forEach((notif) => {
        console.log(`\nNotification ${notif.id}:`);
        console.log(`  User ID: ${notif.userId}`);
        console.log(`  Valid UUID: ${uuidRegex.test(notif.userId) ? '✅' : '❌'}`);
        console.log(`  Type: ${notif.type}`);
        console.log(`  Title: ${notif.title}`);
      });
    } else {
      console.log('  No notifications found.');
    }
    
    // Summary
    console.log('\n\n📊 SUMMARY:');
    console.log('═'.repeat(50));
    
    const allQuizUUIDsValid = quizAttempts.every(a => 
      uuidRegex.test(a.quizId) && uuidRegex.test(a.studentId)
    );
    const allProgressUUIDsValid = lessonProgress.every(p => 
      uuidRegex.test(p.studentId)
    );
    const allNotifUUIDsValid = notifications.every(n => 
      uuidRegex.test(n.userId)
    );
    
    console.log(`Student UUID: ${isValidStudentUUID ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Quiz Attempts UUIDs: ${allQuizUUIDsValid ? '✅ PASS' : (quizAttempts.length === 0 ? '⏳ NO DATA' : '❌ FAIL')}`);
    console.log(`Lesson Progress UUIDs: ${allProgressUUIDsValid ? '✅ PASS' : (lessonProgress.length === 0 ? '⏳ NO DATA' : '❌ FAIL')}`);
    console.log(`Notification UUIDs: ${allNotifUUIDsValid ? '✅ PASS' : (notifications.length === 0 ? '⏳ NO DATA' : '❌ FAIL')}`);
    
    const pendingSync = quizAttempts.filter(a => a.syncStatus === 'pending').length;
    console.log(`\nPending Sync: ${pendingSync} quiz attempts`);
    
    if (isValidStudentUUID && (quizAttempts.length === 0 || allQuizUUIDsValid)) {
      console.log('\n✅ All UUID tests PASSED! Ready for Supabase sync.');
    } else {
      console.log('\n⚠️  Some issues detected. Review details above.');
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error accessing database:', error);
    console.log('Make sure Dexie is loaded and the database exists.');
  }
})();

console.log('\n💡 Tips:');
console.log('  - Take a quiz to see quiz UUIDs in action');
console.log('  - Complete a lesson to see progress UUIDs');
console.log('  - Try syncing to test Supabase integration');
console.log('  - Clear localStorage to test fresh UUID generation');
console.log('\n🔄 To re-run this test, just paste it again!\n');
