// src/features/auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { authService, type UserProfile } from './auth.service';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;

  /** True while we are establishing the auth session (first load or auth events). */
  loading: boolean;

  /** True while we are fetching the user's profile after a session exists. */
  profileLoading: boolean;

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
  const [profileLoading, setProfileLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    let timeoutId: number | undefined;
    let authSubscription: { unsubscribe: () => void } | undefined;

    let sessionCheckInterval: number | undefined;
    let visibilityCheckTimeout: number | undefined;

    const stopSessionMonitoring = () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = undefined;
      }
    };

    const startSessionMonitoring = () => {
      stopSessionMonitoring();
      sessionCheckInterval = window.setInterval(refreshSessionIfNeeded, 4 * 60 * 1000);
    };

    const loadProfile = async (userId: string) => {
      setProfileLoading(true);
      try {
        const p = await authService.getProfile(userId);
        if (!mounted) return;

        if (p) {
          setProfile(p);
          setError(null);
        } else {
          console.error('No profile found for authenticated user');
          setProfile(null);
          setError('Profile not found. Please contact support.');
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const e = err as Error;
        console.error('Error loading profile:', e);
        setProfile(null);
        setError(e.message || 'Failed to load profile');
      } finally {
        if (mounted) setProfileLoading(false);
      }
    };

    const refreshSessionIfNeeded = async () => {
      if (!mounted) return;

      try {
        const { data: { session: currentSession }, error: sessionError } =
          await authService.supabase.auth.getSession();

        if (sessionError) {
          console.warn('Session check error:', sessionError);
          return;
        }

        if (!currentSession) return;

        const expiresAt = currentSession.expires_at;
        if (!expiresAt) return;

        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;

        if (timeUntilExpiry < 300) {
          console.log('🔄 Token expiring soon, refreshing session...');
          const { data, error: refreshError } = await authService.supabase.auth.refreshSession();

          if (refreshError) {
            console.error('Failed to refresh session:', refreshError);
            return;
          }

          if (data.session && mounted) {
            console.log('✓ Session refreshed successfully');
            setSession(data.session);
            setUser(data.session.user);
          }
        }
      } catch (err) {
        console.error('Error in session refresh:', err);
      }
    };

    const handleVisibilityChange = async () => {
      if (!mounted) return;
      if (document.visibilityState === 'visible') {
        console.log('Tab visible, checking session validity...');
        await refreshSessionIfNeeded();
      }
    };

    const applySessionState = async (incomingSession: Session | null) => {
      setSession(incomingSession);
      setUser(incomingSession?.user ?? null);

      if (incomingSession?.user) {
        await loadProfile(incomingSession.user.id);
        startSessionMonitoring();
      } else {
        setProfile(null);
        setError(null);
        stopSessionMonitoring();
      }
    };

    const initAuth = async () => {
      try {
        setLoading(true);

        const { data: { subscription } } = authService.onAuthStateChange(async (_event, s) => {
          if (!mounted) return;

          if (timeoutId) clearTimeout(timeoutId);

          // Keep loading=true until profile is loaded (prevents RequireRole redirect loops).
          setLoading(true);
          await applySessionState(s);
          if (mounted) setLoading(false);
        });

        authSubscription = subscription;
        if (!mounted) {
          subscription.unsubscribe();
          return;
        }

        // Existing session on reload / initial load
        // const existingSession = await authService.getSession();
        // if (!mounted) return;

        // if (timeoutId) clearTimeout(timeoutId);

        // await applySessionState(existingSession);
        // if (mounted) setLoading(false);

        // if (document.visibilityState === 'visible') {
        //   visibilityCheckTimeout = window.setTimeout(refreshSessionIfNeeded, 2000);
        // }
      } catch (err: unknown) {
        if (!mounted) return;
        const e = err as Error;
        console.error('Error loading session:', e);
        setError(e.message || 'Failed to load session');
        setLoading(false);
        setProfileLoading(false);
      }
    };

    timeoutId = window.setTimeout(() => {
      if (!mounted) return;
      if (loading || profileLoading) {
        console.error('Auth initialization timed out');
        setError('Connection timed out while initializing authentication. Please refresh the page.');
        setLoading(false);
        setProfileLoading(false);
      }
    }, 30000);

    initAuth();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (visibilityCheckTimeout) clearTimeout(visibilityCheckTimeout);
      stopSessionMonitoring();
      if (authSubscription) authSubscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { user, session, profile } = await authService.signIn(email, password);
    setUser(user);
    setSession(session);
    setProfile(profile);
    setError(null);
  };

  const signUp = async (email: string, password: string, fullName: string, role: 'student' | 'teacher', schoolId?: string) => {
    const { user, session, profile } = await authService.signUp(email, password, fullName, role, schoolId);
    setUser(user);
    setSession(session);
    setProfile(profile);
    setError(null);
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setError(null);
  };

  const clearError = () => setError(null);

  const value: AuthContextType = useMemo(() => ({
    user,
    session,
    profile,
    loading,
    profileLoading,
    error,
    signIn,
    signUp,
    signOut,
    clearError,
    isStudent: profile?.role === 'student',
    isTeacher: profile?.role === 'teacher',
    isAdmin: profile?.role === 'admin',
  }), [user, session, profile, loading, profileLoading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}