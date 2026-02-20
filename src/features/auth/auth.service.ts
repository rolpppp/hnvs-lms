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

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 1, baseDelay = 800): Promise<T> => {
  let lastError: any = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (isNonRetryable(error)) throw error;
      if (!isRetryable(error)) throw error;

      const isLast = i === maxRetries;
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
  // Expose supabase client for direct access
  supabase,

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

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

      // If profile doesn't exist, create one with default role AND retrieve it in the same network call
      if (!profile) {
        console.log('Profile not found for user:', data.user.id, '- creating default profile');
        
        const emailName = data.user.email?.split('@')[0] || 'User';
        const defaultFullName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        
        try {
          const { data: newProfile, error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              role: 'student', // Default to student role
              full_name: defaultFullName,
              school_id: null,
            })
            .select() // Return the inserted row immediately
            .single();

          if (profileError || !newProfile) {
            console.error('Failed to create profile during sign-in:', profileError);
            throw new Error('Failed to create user profile. Please try signing up with a role selection.');
          }

          profile = newProfile as UserProfile;
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
      // Validate inputs
      if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Please enter a valid email address');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters long');
      if (!fullName?.trim() || fullName.trim().length < 2) throw new Error('Full name must be at least 2 characters long');
      if (!role || (role !== 'student' && role !== 'teacher')) throw new Error('Please select a valid role');

      const trimmedEmail = email.trim();
      const trimmedFullName = fullName.trim();
      const trimmedSchoolId = schoolId?.trim() || null;

      // Create Auth User
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Sign-up failed: No user data returned');

      // Create Profile AND retrieve it in the same network call
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          role,
          full_name: trimmedFullName,
          school_id: trimmedSchoolId,
        })
        .select() // Return the inserted row immediately
        .single();

      if (profileError || !newProfile) {
        console.error('Failed to create profile:', profileError);
        try {
          await supabase.auth.signOut();
        } catch (cleanupError) {
          console.error('Failed to clean up auth session:', cleanupError);
        }
        throw new Error(`Failed to create user profile: ${profileError?.message}. Please contact support or try again.`);
      }

      console.log('Profile created successfully');
      
      // Handle email verification flow
      if (!data.session) {
        return {
          user: data.user,
          session: null,
          profile: null,
          emailVerificationRequired: true,
        };
      }

      return { user: data.user, session: data.session, profile: newProfile as UserProfile };
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
          8000, 
          'Session check timed out.'
        ),
        1 
      ) as { data: { session: any }; error: any }; // <-- Add explicit type assertion here

      const { data, error } = sessionResponse;
      if (error) throw error;

      return data.session;
    } catch (err: any) {
      if (import.meta.env.DEV) console.warn('getSession soft-failed:', err?.message ?? err);
      return null;
    }
  },

  /**
   * Refresh the current session
   */
  async refreshSession() {
    try {
      const { data, error } = (await withTimeout(
        supabase.auth.refreshSession(),
        8000, 
        'Session refresh timed out.'
      )) as { data: { session: any }; error: any }; 
      
      if (error) throw error;
      return data.session || null;
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
          8000, // Reduced from 25000ms for faster fail
          'Profile request timed out.'
        ),
        1 // Reduced maxRetries
      );

      const { data, error } = profileResponse as { data: UserProfile | null; error: any };

      if (error) {
        if (error.code === 'PGRST116') return null; 
        if (error.status === 401 || error.status === 403) {
          throw new Error(`Profile access denied: ${error.message}`);
        }
        throw new Error(`Failed to fetch profile: ${error.message}`);
      }

      return data;
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || isRetryable(err)) {
        if (import.meta.env.DEV) console.warn('getProfile soft-timeout:', err?.message ?? err);
        return null;
      }
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