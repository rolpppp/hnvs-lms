// src/features/auth/RequireRole.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface RequireRoleProps {
  role: 'student' | 'teacher' | 'admin';
  children: React.ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== role) {
    // Redirect to appropriate dashboard based on actual role
    if (profile?.role === 'student') {
      return <Navigate to="/" replace />;
    } else if (profile?.role === 'teacher') {
      return <Navigate to="/teacher" replace />;
    }
    // If no profile or admin trying to access student/teacher routes
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
