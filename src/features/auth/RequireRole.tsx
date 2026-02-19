// src/features/auth/RequireRole.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface RequireRoleProps {
  role: 'student' | 'teacher' | 'admin';
  children: React.ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, profile, loading, profileLoading, error } = useAuth();

  // Wait for BOTH auth + profile to be ready.
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // If profile couldn't be loaded, show stable error instead of redirect loops.
  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Unable to load your profile</h2>
            <p className="text-red-700 mb-4">
              {error ?? 'Your account profile could not be loaded. Please refresh the page.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors w-full font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Role mismatch -> redirect to the correct dashboard for the ACTUAL role.
  if (profile.role !== role) {
    if (profile.role === 'student') return <Navigate to="/" replace />;
    if (profile.role === 'teacher') return <Navigate to="/teacher" replace />;
    if (profile.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}