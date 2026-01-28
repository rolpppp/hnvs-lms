// Test Supabase Connection & Table Setup
// Run this in the browser console to diagnose Supabase issues

console.log('🔍 Testing Supabase Connection...\n');

(async () => {
  try {
    // Import Supabase client
    const { supabase } = await import('/src/lib/supabase.ts');
    
    console.log('✅ Supabase client loaded');
    console.log('📡 URL:', supabase.supabaseUrl);
    console.log('');
    
    // Test 1: Check if quiz_submissions table exists
    console.log('📋 Test 1: Check if quiz_submissions table exists');
    const { data: testRead, error: readError } = await supabase
      .from('quiz_submissions')
      .select('*')
      .limit(1);
    
    if (readError) {
      if (readError.code === '42P01') {
        console.error('❌ Table "quiz_submissions" does NOT exist!');
        console.log('📝 CREATE TABLE: Run supabase-setup.sql in Supabase SQL Editor');
      } else if (readError.message.includes('row-level security') || readError.message.includes('policy')) {
        console.error('❌ RLS is BLOCKING reads!');
        console.log('🔧 FIX: ALTER TABLE quiz_submissions DISABLE ROW LEVEL SECURITY;');
      } else {
        console.error('❌ Error reading table:', readError.message);
        console.error('Code:', readError.code);
      }
    } else {
      console.log('✅ Table exists and is readable');
      console.log(`📊 Found ${testRead?.length || 0} existing records`);
    }
    console.log('');
    
    // Test 2: Try to insert a test record
    console.log('📋 Test 2: Test INSERT permission');
    const testUUID = crypto.randomUUID();
    const { data: insertData, error: insertError } = await supabase
      .from('quiz_submissions')
      .insert({
        quiz_id: testUUID,
        student_id: testUUID,
        score: 0,
        answers_json: '{"test": true}',
        device_timestamp: new Date().toISOString(),
        is_late: false,
      })
      .select();
    
    if (insertError) {
      console.error('❌ INSERT FAILED!');
      console.error('Error:', insertError.message);
      console.error('Code:', insertError.code);
      
      if (insertError.code === '42501' || insertError.message.includes('row-level security') || insertError.message.includes('policy')) {
        console.log('');
        console.log('🚨 ROOT CAUSE: Row-Level Security Policy Violation');
        console.log('');
        console.log('⚡ QUICK FIX - Run this in Supabase SQL Editor:');
        console.log('━'.repeat(60));
        console.log('ALTER TABLE quiz_submissions DISABLE ROW LEVEL SECURITY;');
        console.log('ALTER TABLE assignment_submissions DISABLE ROW LEVEL SECURITY;');
        console.log('ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;');
        console.log('━'.repeat(60));
        console.log('');
        console.log('📖 Step-by-step:');
        console.log('1. Go to: https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Click "SQL Editor" in the left sidebar');
        console.log('4. Paste the SQL above');
        console.log('5. Click "RUN"');
        console.log('6. Refresh this page and try syncing again');
      } else if (insertError.code === '42P01') {
        console.log('');
        console.log('🚨 ROOT CAUSE: Table does not exist');
        console.log('');
        console.log('📝 Run the complete setup script:');
        console.log('Open: supabase-setup.sql');
        console.log('Copy all content and run in Supabase SQL Editor');
      }
    } else {
      console.log('✅ INSERT successful! (test record created)');
      console.log('📊 Test data:', insertData);
      
      // Clean up test record
      if (insertData && insertData[0]) {
        await supabase
          .from('quiz_submissions')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Test record cleaned up');
      }
    }
    console.log('');
    
    // Test 3: Check RLS status
    console.log('📋 Test 3: Check RLS status');
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('check_rls_status', { table_name: 'quiz_submissions' })
      .single();
    
    if (rlsError && rlsError.code !== '42883') {
      console.log('⚠️  Cannot check RLS status (function not available)');
    }
    console.log('');
    
    // Summary
    console.log('═'.repeat(60));
    console.log('📊 DIAGNOSIS SUMMARY');
    console.log('═'.repeat(60));
    
    if (!readError && !insertError) {
      console.log('✅ Everything is working! You can sync data.');
    } else if (readError?.code === '42P01' || insertError?.code === '42P01') {
      console.log('❌ ISSUE: Tables do not exist');
      console.log('📝 ACTION: Create tables using supabase-setup.sql');
    } else if (readError?.message.includes('policy') || insertError?.message.includes('policy')) {
      console.log('❌ ISSUE: Row-Level Security is blocking access');
      console.log('⚡ ACTION: Disable RLS using the SQL commands shown above');
    } else {
      console.log('❌ ISSUE: Unknown error - check details above');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.log('');
    console.log('💡 Make sure:');
    console.log('  - Your .env file has correct Supabase credentials');
    console.log('  - The dev server is running');
    console.log('  - You have internet connection');
  }
})();
