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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Fetch profile
    if (data.user) {
      const profile = await this.getProfile(data.user.id);
      return { user: data.user, session: data.session, profile };
    }

    return { user: data.user, session: data.session, profile: null };
  },

  /**
   * Sign up with email, password, and role
   */
  async signUp(email: string, password: string, fullName: string, role: 'student' | 'teacher', schoolId?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // Create profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          role,
          full_name: fullName,
          school_id: schoolId || null,
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        throw new Error('Failed to create user profile');
      }

      const profile = await this.getProfile(data.user.id);
      return { user: data.user, session: data.session, profile };
    }

    return { user: data.user, session: data.session, profile: null };
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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }

    return data;
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
