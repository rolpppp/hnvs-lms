// src/features/auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { authService, type UserProfile } from './auth.service';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: 'student' | 'teacher', schoolId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  isStudent: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check active session
    const initAuth = async () => {
      try {
        const session = await authService.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            const profile = await authService.getProfile(session.user.id);
            if (profile) {
              setProfile(profile);
            } else {
              console.error('No profile found for authenticated user');
              // Don't sign out immediately on profile error, just set error state
              // This allows for retrying without relogin
              setError('Profile not found. Please contact support.');
            }
          } catch (err: any) {
            console.error('Error loading profile:', err);
            setError(err.message || 'Failed to load profile');
            // Do NOT sign out here. Let the user retry.
          }
        }
      } catch (err: any) {
        console.error('Error loading session:', err);
        setError(err.message || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.error('Auth initialization timed out');
        // Don't completely stop loading, just show error
        // This allows the actual request to potentially finish if it's just very slow
        setError('Connection timed out. Please check your internet connection.');
        setLoading(false);
      }
    }, 60000); // 10 seconds timeout

    initAuth();

    return () => {
      clearTimeout(timeoutId);
    };

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setError(null); // Clear errors on auth state change
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            const profile = await authService.getProfile(session.user.id);
            if (profile) {
              setProfile(profile);
            } else {
              setProfile(null);
            }
          } catch (err: any) {
            console.error('Error loading profile on auth change:', err);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { user, session, profile } = await authService.signIn(email, password);
    setUser(user);
    setSession(session);
    setProfile(profile);
  };

  const signUp = async (email: string, password: string, fullName: string, role: 'student' | 'teacher', schoolId?: string) => {
    const { user, session, profile } = await authService.signUp(email, password, fullName, role, schoolId);
    setUser(user);
    setSession(session);
    setProfile(profile);
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    clearError,
    isStudent: profile?.role === 'student',
    isTeacher: profile?.role === 'teacher',
    isAdmin: profile?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
