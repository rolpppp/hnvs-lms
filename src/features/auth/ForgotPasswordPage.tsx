// src/features/auth/ForgotPasswordPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from './auth.service';
import { Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import hnvsLogo from '../../assets/hnvs.png';
import hnvsBackground from '../../assets/hnvs_background.jpg';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
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
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4 overflow-hidden">
            <img src={hnvsLogo} alt="HNVS LMS" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">HNVS LMS</h1>
          <p className="text-blue-200">Reset your password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Mail className="text-green-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-3">Check Your Email</h2>
              <p className="text-slate-600 mb-2 text-sm">
                We've sent a password reset link to:
              </p>
              <p className="text-blue-900 font-semibold mb-4">{email}</p>
              <p className="text-sm text-slate-500 mb-6">
                Click the link in the email to set a new password. The link expires in 1 hour.
              </p>
              <div className="border-t pt-6">
                <Link
                  to="/signin"
                  className="inline-flex items-center gap-2 text-blue-900 font-medium hover:text-blue-700"
                >
                  <ArrowLeft size={16} />
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}

              <p className="text-sm text-slate-600 mb-6">
                Enter the email address for your account and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="your.email@example.com"
                      disabled={loading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-900 text-white py-3 rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/signin"
                  className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
                >
                  <ArrowLeft size={14} />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
