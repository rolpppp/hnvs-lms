// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

const globalForSupabase = globalThis as any;

export const supabase =
  globalForSupabase.__hnvs_supabase ??
  createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: window.localStorage,
      storageKey: 'hnvs-lms-auth',
      // ✅ remove flowType
    },
    global: { headers: { 'X-Client-Info': 'hnvs-lms' } },
  });

if (import.meta.env.DEV) globalForSupabase.__hnvs_supabase = supabase;

// ✅ remove removeAllChannels()
// ✅ remove config console.log (or gate it)
if (import.meta.env.DEV) {
  console.log('🔌 Supabase Config:', {
    url: supabaseUrl,
    keyLength: supabaseKey.length,
    keyStart: supabaseKey.slice(0, 10) + '...',
  });
}