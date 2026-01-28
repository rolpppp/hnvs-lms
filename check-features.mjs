#!/usr/bin/env node

/**
 * Quick Feature Check Script
 * Verifies that all main features are properly configured
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Running Feature Check...\n');

let allPassed = true;

// Test 1: UUID utility exists
console.log('📋 Test 1: UUID Utility File');
const uuidPath = path.join(__dirname, 'src', 'lib', 'uuid.ts');
if (fs.existsSync(uuidPath)) {
  const content = fs.readFileSync(uuidPath, 'utf8');
  const hasGenerateUUID = content.includes('generateUUID');
  const hasGetStudentUUID = content.includes('getStudentUUID');
  const hasGetOrCreateUUID = content.includes('getOrCreateUUIDForId');
  
  if (hasGenerateUUID && hasGetStudentUUID && hasGetOrCreateUUID) {
    console.log('✅ UUID utility complete with all functions');
  } else {
    console.log('❌ UUID utility missing functions');
    allPassed = false;
  }
} else {
  console.log('❌ UUID utility file not found');
  allPassed = false;
}

// Test 2: Files import UUID utilities
console.log('\n📋 Test 2: UUID Import in Key Files');
const filesToCheck = [
  'src/pages/QuizPlayer.tsx',
  'src/hooks/useSync.ts',
  'src/hooks/useNotifications.ts',
  'src/pages/CourseDetail.tsx',
  'src/pages/LessonViewer.tsx',
  'src/pages/StudentProgress.tsx'
];

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes("from '../lib/uuid'") || content.includes('from "../lib/uuid"')) {
      console.log(`✅ ${file} imports UUID utilities`);
    } else {
      console.log(`❌ ${file} missing UUID import`);
      allPassed = false;
    }
  } else {
    console.log(`⚠️  ${file} not found`);
  }
});

// Test 3: No hardcoded student IDs remain
console.log('\n📋 Test 3: No Hardcoded Student IDs');
const searchPaths = [
  'src/pages/QuizPlayer.tsx',
  'src/hooks/useSync.ts',
  'src/hooks/useNotifications.ts',
  'src/pages/CourseDetail.tsx',
  'src/pages/LessonViewer.tsx',
  'src/pages/StudentProgress.tsx'
];

let foundHardcoded = false;
searchPaths.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes("'student-1'") || content.includes('"student-1"')) {
      console.log(`❌ ${file} still has hardcoded 'student-1'`);
      foundHardcoded = true;
      allPassed = false;
    }
  }
});

if (!foundHardcoded) {
  console.log('✅ No hardcoded student IDs found');
}

// Test 4: QuizPlayer uses UUID conversion
console.log('\n📋 Test 4: QuizPlayer UUID Conversion');
const quizPlayerPath = path.join(__dirname, 'src', 'pages', 'QuizPlayer.tsx');
if (fs.existsSync(quizPlayerPath)) {
  const content = fs.readFileSync(quizPlayerPath, 'utf8');
  const hasGetStudentUUID = content.includes('getStudentUUID()');
  const hasGetOrCreateUUID = content.includes('getOrCreateUUIDForId');
  
  if (hasGetStudentUUID && hasGetOrCreateUUID) {
    console.log('✅ QuizPlayer properly converts IDs to UUIDs');
  } else {
    console.log('❌ QuizPlayer missing UUID conversion');
    allPassed = false;
  }
} else {
  console.log('❌ QuizPlayer file not found');
  allPassed = false;
}

// Test 5: Database schema has UUID comments
console.log('\n📋 Test 5: Database Schema Documentation');
const dbPath = path.join(__dirname, 'src', 'lib', 'db.ts');
if (fs.existsSync(dbPath)) {
  const content = fs.readFileSync(dbPath, 'utf8');
  if (content.includes('UUID') || content.includes('uuid')) {
    console.log('✅ Database schema has UUID documentation');
  } else {
    console.log('⚠️  Consider adding UUID documentation to db.ts');
  }
} else {
  console.log('❌ Database file not found');
  allPassed = false;
}

// Test 6: Sync hook uses UUIDs
console.log('\n📋 Test 6: Sync Hook Configuration');
const syncPath = path.join(__dirname, 'src', 'hooks', 'useSync.ts');
if (fs.existsSync(syncPath)) {
  const content = fs.readFileSync(syncPath, 'utf8');
  const hasGetStudentUUID = content.includes('getStudentUUID');
  
  if (hasGetStudentUUID) {
    console.log('✅ Sync hook uses UUID utilities');
  } else {
    console.log('❌ Sync hook missing UUID usage');
    allPassed = false;
  }
} else {
  console.log('❌ Sync hook file not found');
  allPassed = false;
}

// Test 7: Environment file exists
console.log('\n📋 Test 7: Environment Configuration');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const hasSupabaseUrl = content.includes('VITE_SUPABASE_URL');
  const hasSupabaseKey = content.includes('VITE_SUPABASE_ANON_KEY');
  
  if (hasSupabaseUrl && hasSupabaseKey) {
    console.log('✅ Environment file configured');
  } else {
    console.log('⚠️  Environment file missing Supabase credentials');
  }
} else {
  console.log('⚠️  .env file not found (expected for Supabase sync)');
}

// Summary
console.log('\n' + '═'.repeat(60));
console.log('📊 SUMMARY');
console.log('═'.repeat(60));

if (allPassed) {
  console.log('✅ All critical checks PASSED!');
  console.log('\n📝 Next Steps:');
  console.log('  1. Start the dev server: npm run dev');
  console.log('  2. Open http://localhost:5174 in browser');
  console.log('  3. Open DevTools Console');
  console.log('  4. Run: copy(require("./test-uuid-console.js"))');
  console.log('  5. Take a quiz to test UUID generation');
  console.log('  6. Try syncing to Supabase');
  console.log('\n💡 See MANUAL_TEST_PLAN.md for detailed test steps');
} else {
  console.log('❌ Some checks FAILED - review output above');
  console.log('\n🔧 Fix the issues and run this script again');
}

console.log('');
process.exit(allPassed ? 0 : 1);
