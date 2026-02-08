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
    let mounted = true;
    let timeoutId: number;
    let authSubscription: any;
    let sessionCheckInterval: number;
    let visibilityCheckInterval: number;

    const loadProfile = async (userId: string) => {
      try {
        const profile = await authService.getProfile(userId);
        if (!mounted) return;

        if (profile) {
          setProfile(profile);
          setError(null);
        } else {
          console.error('No profile found for authenticated user');
          setError('Profile not found. Please contact support.');
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const error = err as Error;
        console.error('Error loading profile:', error);
        setError(error.message || 'Failed to load profile');
      }
    };

    // Proactive session refresh - checks and refreshes if needed
    const refreshSessionIfNeeded = async () => {
      if (!mounted) return;
      
      try {
        const { data: { session: currentSession }, error: sessionError } = await authService.supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('Session check error:', sessionError);
          return;
        }

        if (!currentSession) {
          console.log('No session found during refresh check');
          return;
        }

        // Check if token is close to expiry (within 5 minutes)
        const expiresAt = currentSession.expires_at;
        if (expiresAt) {
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = expiresAt - now;
          
          // Refresh if less than 5 minutes remaining
          if (timeUntilExpiry < 300) {
            console.log('🔄 Token expiring soon, refreshing session...');
            const { data, error: refreshError } = await authService.supabase.auth.refreshSession();
            
            if (refreshError) {
              console.error('Failed to refresh session:', refreshError);
              // Don't set error state here, let auth state handler deal with it
            } else if (data.session) {
              console.log('✓ Session refreshed successfully');
              setSession(data.session);
              setUser(data.session.user);
            }
          }
        }
      } catch (err) {
        console.error('Error in session refresh:', err);
        // Don't throw or set error - this is a background operation
      }
    };

    // Handle visibility change - refresh session when tab becomes visible
    const handleVisibilityChange = async () => {
      if (!mounted) return;
      
      if (document.visibilityState === 'visible') {
        console.log('Tab visible, checking session validity...');
        await refreshSessionIfNeeded();
      }
    };

    const initAuth = async () => {
      try {
        // Set up auth state listener FIRST
        const { data: { subscription } } = authService.onAuthStateChange(
          async (event, session) => {
            if (!mounted) return;

            console.log('Auth state changed:', event, session?.user?.id ? 'User ID: ' + session.user.id : 'No user');

            // Clear timeout on any auth event
            if (timeoutId) clearTimeout(timeoutId);

            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            if (session?.user) {
              await loadProfile(session.user.id);
              
              // Start session monitoring when user signs in
              if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                console.log('✓ Starting session monitoring');
                
                // Clear any existing intervals
                if (sessionCheckInterval) clearInterval(sessionCheckInterval);
                
                // Check session every 4 minutes
                sessionCheckInterval = window.setInterval(refreshSessionIfNeeded, 4 * 60 * 1000);
              }
            } else {
              setProfile(null);
              setError(null);
              
              // Clear monitoring when user signs out
              if (sessionCheckInterval) {
                clearInterval(sessionCheckInterval);
                sessionCheckInterval = 0;
              }
            }
          }
        );

        authSubscription = subscription;

        // Check if unmounted during async operation
        if (!mounted) {
          subscription.unsubscribe();
          return;
        }

        // Now check for existing session
        const session = await authService.getSession();

        if (!mounted) {
          subscription.unsubscribe();
          return;
        }

        // Clear timeout on successful session check
        if (timeoutId) clearTimeout(timeoutId);

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          // No session, clear loading immediately
          setLoading(false);
        }

        // Only set loading false after profile loads or no session
        if (mounted && session?.user) {
          setLoading(false);
        }

      } catch (err: unknown) {
        if (!mounted) return;
        const error = err as Error;
        console.error('Error loading session:', error);
        setError(error.message || 'Failed to load session');
        setLoading(false);
      }
    };

    // Safety timeout - extended for better reliability
    timeoutId = window.setTimeout(() => {
      if (mounted && loading) {
        console.error('Auth initialization timed out');
        setError('Connection timed out. Please refresh the page.');
        setLoading(false);
      }
    }, 15000); // Extended to 15s for better reliability

    // Start initialization
    initAuth();

    // Set up visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial check when component mounts (if already visible)
    if (document.visibilityState === 'visible') {
      visibilityCheckInterval = window.setTimeout(refreshSessionIfNeeded, 2000);
    }

    // Cleanup
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (sessionCheckInterval) clearInterval(sessionCheckInterval);
      if (visibilityCheckInterval) clearTimeout(visibilityCheckInterval);
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
