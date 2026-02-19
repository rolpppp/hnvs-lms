// src/features/auth/auth.service.ts
import { supabase } from '../../lib/supabase';

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

const withTimeout = async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new TimeoutError(message)), ms);
  });

  try {
    return (await Promise.race([promise, timeout])) as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const isRetryable = (error: any) => {
  if (!error) return false;

  // Timeouts -> retryable
  if (error.name === 'TimeoutError') return true;

  // Supabase fetch/network-ish errors
  const msg = String(error.message ?? '');
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return true;

  // PostgREST 5xx
  if (typeof error.status === 'number' && error.status >= 500) return true;

  return false;
};

const isNonRetryable = (error: any) => {
  const msg = String(error.message ?? '');

  // Auth / validation -> don't retry
  if (
    msg.includes('Invalid login') ||
    msg.includes('Email') ||
    msg.includes('Password') ||
    error.status === 400 ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 422
  ) return true;

  // Expected "no rows found"
  if (error.code === 'PGRST116') return true;

  return false;
};

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 2, baseDelay = 800): Promise<T> => {
  let lastError: any = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (isNonRetryable(error)) throw error;
      if (!isRetryable(error)) throw error;

      const isLast = i === maxRetries - 1;
      if (!isLast) {
        const delay = baseDelay * Math.pow(2, i);
        if (import.meta.env.DEV) console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error('Operation failed after retries');
};

export interface UserProfile {
  id: string;
  role: 'student' | 'teacher' | 'admin';
  full_name: string | null;
  school_id: string | null;
  created_at: string;
}

export const authService = {
  // Expose supabase client for direct access (e.g., session refresh)
  supabase,
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    try {
      const signInResponse = await withRetry(() => 
        withTimeout(
          supabase.auth.signInWithPassword({
            email,
            password,
          }),
          15000, // Increased timeout
          'Sign in timed out. Please check your connection and try again.'
        ),
        2 // Retry once on network errors
      );
      const { data, error } = signInResponse;

      if (error) {
        console.error('Sign-in error:', error.message);
        throw error;
      }

      if (!data.user) {
        throw new Error('Sign-in failed: No user data returned');
      }

      // Check if email is verified (when email verification is enabled)
      if (data.user.email && !data.user.email_confirmed_at) {
        console.warn('Email not verified for user:', data.user.email);
        throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
      }

      // Fetch profile
      let profile = await this.getProfile(data.user.id);

      // If profile doesn't exist, create one with default role
      if (!profile) {
        console.log('Profile not found for user:', data.user.id, '- creating default profile');
        
        // Extract name from email as fallback
        const emailName = data.user.email?.split('@')[0] || 'User';
        const defaultFullName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              role: 'student', // Default to student role
              full_name: defaultFullName,
              school_id: null,
            });

          if (profileError) {
            console.error('Failed to create profile during sign-in:', profileError);
            throw new Error('Failed to create user profile. Please try signing up with a role selection.');
          }

          // Fetch the newly created profile
          profile = await this.getProfile(data.user.id);
          
          if (!profile) {
            throw new Error('Profile creation verification failed. Please try again.');
          }
          
          console.log('✓ Profile created successfully during sign-in with default role: student');
        } catch (err) {
          console.error('Error creating profile during sign-in:', err);
          throw err;
        }
      }

      console.log('✓ Sign in successful:', data.user.email);
      return { user: data.user, session: data.session, profile };
    } catch (err) {
      console.error('Sign-in failed:', err);
      throw err;
    }
  },


  /**
   * Sign up with email, password, and role
   */
  async signUp(email: string, password: string, fullName: string, role: 'student' | 'teacher', schoolId?: string) {
    try {
      // ===== VALIDATE ALL INPUTS BEFORE CREATING AUTH USER =====
      // This prevents orphaned auth users when validation fails

      // Validate email
      if (!email || !email.trim()) {
        throw new Error('Email is required');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error('Please enter a valid email address');
      }

      // Validate password
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Validate full name
      if (!fullName || !fullName.trim()) {
        throw new Error('Full name is required');
      }
      if (fullName.trim().length < 2) {
        throw new Error('Full name must be at least 2 characters long');
      }

      // Validate role
      if (!role || (role !== 'student' && role !== 'teacher')) {
        throw new Error('Please select a valid role (student or teacher)');
      }

      // Trim inputs
      const trimmedEmail = email.trim();
      const trimmedFullName = fullName.trim();
      const trimmedSchoolId = schoolId?.trim() || null;

      console.log('All validations passed, creating auth user...');

      // ===== CREATE AUTH USER =====
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (error) {
        console.error('Sign-up authentication error:', error);
        throw error;
      }

      if (!data.user) {
        throw new Error('Sign-up failed: No user data returned');
      }

      // ===== CREATE PROFILE =====
      console.log('Creating profile for user:', data.user.id);

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          role,
          full_name: trimmedFullName,
          school_id: trimmedSchoolId,
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError);

        // ===== CLEANUP: DELETE AUTH USER IF PROFILE CREATION FAILS =====
        console.error('Attempting to clean up auth user due to profile creation failure...');
        try {
          // Sign out to clean up session
          await supabase.auth.signOut();

          // Note: We cannot delete the user from the client side with the anon key.
          // The user will be orphaned in auth.users, but we've logged out the session.
          // In production, you should:
          // 1. Use Supabase Edge Functions to delete the user via admin API
          // 2. Or have a cleanup job that removes orphaned users
          // 3. Or enable email confirmation which prevents immediate login

          console.error('Auth user may be orphaned. User ID:', data.user.id);
        } catch (cleanupError) {
          console.error('Failed to clean up auth session:', cleanupError);
        }

        throw new Error(`Failed to create user profile: ${profileError.message}. Please contact support or try again.`);
      }

      console.log('Profile created successfully');
      
      // With email verification enabled, session might be null until email is confirmed
      if (!data.session) {
        console.log('Email verification required - no session created yet');
        return {
          user: data.user,
          session: null,
          profile: null,
          emailVerificationRequired: true,
        };
      }

      // If session exists (no email verification), fetch profile
      const profile = await this.getProfile(data.user.id);

      if (!profile) {
        console.error('Profile was created but could not be retrieved');
        throw new Error('Profile creation verification failed. Please try signing in.');
      }

      return { user: data.user, session: data.session, profile };
    } catch (err) {
      console.error('Sign-up error:', err);
      throw err;
    }
  },

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
  try {
    const sessionResponse = await withRetry(() =>
      withTimeout(
        supabase.auth.getSession(),
        25000, // ✅ bump: school Wi-Fi / cold start safe
        'Session check timed out.'
      ),
      2
    );

    const { data, error } = sessionResponse;
    if (error) throw error;

    return data.session;
  } catch (err: any) {
    // ✅ soft fail: not fatal; avoid noisy stack traces
    if (import.meta.env.DEV) console.warn('getSession soft-failed:', err?.message ?? err);
    return null;
  }
},

  /**
   * Refresh the current session
   */
  async refreshSession() {
    try {
      console.log('🔄 Manually refreshing session...');
      const { data, error } = await withTimeout(
        supabase.auth.refreshSession(),
        15000,
        'Session refresh timed out.'
      );
      
      if (error) {
        console.error('Session refresh error:', error);
        throw error;
      }
      
      if (data.session) {
        console.log('✓ Session refreshed successfully');
        return data.session;
      }
      
      return null;
    } catch (err) {
      console.error('Session refresh failed:', err);
      throw err;
    }
  },

  /**
   * Get user profile from database
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const profileResponse = await withRetry(() =>
      withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single() as unknown as Promise<any>,
        25000, // ✅ bump timeout
        'Profile request timed out.'
      ),
      2
    );

    const { data, error } = profileResponse as { data: UserProfile | null; error: any };

    if (error) {
      if (error.code === 'PGRST116') return null; // expected

      // RLS / forbidden should NOT be swallowed
      if (error.status === 401 || error.status === 403) {
        throw new Error(`Profile access denied (RLS/permissions): ${error.message}`);
      }

      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    return data;
  } catch (err: any) {
    // ✅ soft fail for timeouts/network only
    if (err?.name === 'TimeoutError' || isRetryable(err)) {
      if (import.meta.env.DEV) console.warn('getProfile soft-timeout:', err?.message ?? err);
      return null;
    }

    // Real errors still bubble up
    throw err;
  }
},

  /**
   * Check if current user has a specific role
   */
  async hasRole(role: 'student' | 'teacher' | 'admin'): Promise<boolean> {
    const session = await this.getSession();
    if (!session?.user) return false;

    const profile = await this.getProfile(session.user.id);
    return profile?.role === role;
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
