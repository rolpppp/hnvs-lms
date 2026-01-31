// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file."
  );
}

console.log('🔌 Supabase Config:', {
  url: supabaseUrl,
  keyLength: supabaseKey?.length,
  keyStart: supabaseKey?.substring(0, 10) + '...'
});

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Optimize: Minimal realtime configuration since we aren't using it
  // This helps prevent pending websocket connections from blocking auth
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
