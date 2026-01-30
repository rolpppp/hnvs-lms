// src/features/auth/auth.service.ts
import { supabase } from '../../lib/supabase';

export interface UserProfile {
  id: string;
  role: 'student' | 'teacher' | 'admin';
  full_name: string | null;
  school_id: string | null;
  created_at: string;
}

export const authService = {
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign-in authentication error:', error);
        throw error;
      }

      // Fetch profile
      if (data.user) {
        const profile = await this.getProfile(data.user.id);

        if (!profile) {
          console.error('Profile not found for user:', data.user.id);
          throw new Error('User profile not found. Please contact support or try signing up again.');
        }

        return { user: data.user, session: data.session, profile };
      }

      throw new Error('Sign-in failed: No user data returned');
    } catch (err) {
      console.error('Sign-in error:', err);
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

      console.log('Profile created successfully, fetching profile...');
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

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Get user profile from database
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // PGRST116 = 'No rows found' - this is expected for new users before profile creation
        if (error.code === 'PGRST116') {
          console.warn('Profile not found for user:', userId);
          return null;
        }

        console.error('Failed to fetch profile:', error);
        throw new Error(`Failed to fetch profile: ${error.message}`);
      }

      console.log('Profile loaded successfully:', data);
      return data;
    } catch (err) {
      console.error('Error in getProfile:', err);
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
