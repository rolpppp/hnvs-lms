// src/features/auth/ResetPasswordPage.tsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { authService } from './auth.service';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';
import hnvsLogo from '../../assets/hnvs.png';
import hnvsBackground from '../../assets/hnvs_background.jpg';

type PageState = 'exchanging' | 'ready' | 'success' | 'error';

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('exchanging');
  const [exchangeError, setExchangeError] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const settled = useRef(false);
  const settle = (state: PageState, error?: string) => {
    if (settled.current) return;
    settled.current = true;
    if (error) setExchangeError(error);
    setPageState(state);
  };

  useEffect(() => {
    // AuthProvider already intercepted PASSWORD_RECOVERY and navigated us here,
    // so the recovery session is established before this component mounts.
    // We just need to confirm the session exists.

    // PRIMARY: session already exists (most common path)
    authService.supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) settle('ready');
    });

    // FALLBACK: PASSWORD_RECOVERY fires after we mount (slower devices / timing edge)
    const { data: { subscription } } = authService.supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        settle('ready');
      }
    });

    // TIMEOUT: no valid session after 8 s → the link was invalid or expired
    const expireTimer = setTimeout(() => {
      settle('error', 'Could not verify this reset link. It may have expired — please request a new one.');
    }, 8_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(expireTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.updatePassword(password);
      await authService.signOut();
      setPageState('success');
    } catch (err: any) {
      setFormError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4"
      style={{
        backgroundImage: `url(${hnvsBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-blue-900/70" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4 overflow-hidden">
            <img src={hnvsLogo} alt="HNVS LMS" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">HNVS LMS</h1>
          <p className="text-blue-200">Set a new password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {pageState === 'exchanging' && (
            <div className="text-center py-6">
              <div className="inline-block w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-600 text-sm">Verifying your reset link…</p>
            </div>
          )}

          {pageState === 'error' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <AlertCircle className="text-red-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-3">Link Invalid</h2>
              <p className="text-sm text-slate-600 mb-6">{exchangeError}</p>
              <Link
                to="/forgot-password"
                className="inline-block bg-blue-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-800 transition-colors text-sm"
              >
                Request New Reset Link
              </Link>
            </div>
          )}

          {pageState === 'ready' && (
            <>
              {formError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-red-800">{formError}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Minimum 6 characters</p>
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      id="confirm"
                      type="password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-900 text-white py-3 rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating Password…' : 'Update Password'}
                </button>
              </form>
            </>
          )}

          {pageState === 'success' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-3">Password Updated</h2>
              <p className="text-sm text-slate-600 mb-6">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <Link
                to="/signin"
                className="inline-block bg-blue-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-800 transition-colors text-sm"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
