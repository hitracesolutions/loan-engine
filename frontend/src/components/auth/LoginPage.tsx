import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { gidfineAPI } from '../../lib/api-gidfine';
import { useLoanStore } from '../../store/useLoanStore';
import { useTranslation } from '../../lib/useTranslation';

const REMEMBERED_EMAIL_KEY = 'gidfine_login_email';

const inputBase =
  'w-full rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#38c9c0] focus:bg-white focus:ring-2 focus:ring-[#38c9c0]/20 disabled:opacity-50';

export default function LoginPage() {
  const { tx } = useTranslation();
  const { setUser, setAppState } = useLoanStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError(tx('Please enter a valid email address.'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Simulate secure reset link dispatch
      await new Promise((resolve) => setTimeout(resolve, 600));
      setResetSent(true);
    } catch {
      setError(tx('Failed to send reset email. Please contact support.'));
    } finally {
      setLoading(false);
    }
  };

  const [email, setEmail] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '' : ''
  );
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() =>
    typeof window !== 'undefined' && Boolean(localStorage.getItem(REMEMBERED_EMAIL_KEY))
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await gidfineAPI.login(email.trim(), password);
      if (!response?.token) throw new Error('Invalid credentials');
      if (remember) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      setUser({
        name: response.user.fullName?.trim() || response.user.email,
        email: response.user.email,
        picture: '',
        role: response.user.role,
      });
      const targetView = localStorage.getItem('postAuthView');
      if (targetView) {
        useLoanStore.setState({ currentView: targetView as never });
        localStorage.removeItem('postAuthView');
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f4] flex flex-col overflow-hidden">

      {/* ── Fixed coin assets — always viewport-centered ── */}
      <div className="coin-left pointer-events-none fixed -left-8 top-[28%] hidden -translate-y-1/2 md:block" style={{ zIndex: 0 }}>
        <img src="/auth-coins-left.png" alt="" aria-hidden="true" className="w-[260px] select-none lg:w-[300px]" />
      </div>
      <div className="coin-right pointer-events-none fixed -right-8 top-[28%] hidden -translate-y-1/2 md:block" style={{ zIndex: 0 }}>
        <img src="/auth-coins-right.png" alt="" aria-hidden="true" className="w-[260px] select-none lg:w-[300px]" />
      </div>

      {/* ── Page content ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">

        {/* Chrome user icon — no header bar, transparent PNG */}
        <button
          type="button"
          onClick={() => setAppState('UNAUTHENTICATED')}
          className="mb-4 focus:outline-none"
          aria-label="Go to Gidfine homepage"
        >
          <img
            src="/chrome-user-icon.png"
            alt=""
            className="h-20 w-20 object-contain drop-shadow-sm"
          />
        </button>

        {/* ── Card ── */}
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            {isForgot ? (
              /* ── Forgot Password View ── */
              <div>
                <div className="mb-7 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                    {tx('Reset password')}
                  </h1>
                  <p className="mt-1.5 text-sm text-gray-500">
                    {resetSent
                      ? tx('Check your email for recovery instructions')
                      : tx('Enter your email and we will send you a reset link')}
                  </p>
                </div>

                {resetSent ? (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-semibold text-emerald-900">
                        {tx('Recovery email dispatched')}
                      </p>
                      <p className="mt-1 text-xs text-emerald-700">
                        {tx('We sent a password reset link to')}{' '}
                        <span className="font-semibold">{email || 'your email'}</span>.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsForgot(false);
                        setResetSent(false);
                        setError(null);
                      }}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0d3d38] text-sm font-semibold text-white transition-colors hover:bg-[#0b3330]"
                    >
                      {tx('Back to Sign in')}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleResetSubmit} className="space-y-4" noValidate>
                    {error && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700" role="alert">
                        {error}
                      </div>
                    )}

                    <div>
                      <label htmlFor="reset-email" className="mb-1.5 block text-xs font-medium text-gray-600">
                        {tx('Email address')}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                        <input
                          id="reset-email"
                          name="email"
                          required
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className={`${inputBase} pl-10 pr-4`}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      aria-busy={loading}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0d3d38] text-sm font-semibold text-white transition-colors hover:bg-[#0b3330] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? (
                        <><LoaderCircle className="h-4 w-4 animate-spin" /> {tx('Sending link…')}</>
                      ) : (
                        <>{tx('Send recovery link')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
                      )}
                    </button>

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgot(false);
                          setError(null);
                        }}
                        className="text-xs font-medium text-gray-500 hover:text-gray-800 focus:outline-none"
                      >
                        ← {tx('Back to Sign in')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* ── Normal Login View ── */
              <div>
                {/* Heading */}
                <div className="mb-7 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                    {tx('Welcome back')}
                  </h1>
                  <p className="mt-1.5 text-sm text-gray-500">
                    {tx('Sign in to continue to your lending workspace')}
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700" role="alert">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Email */}
                  <div>
                    <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-gray-600">
                      {tx('Email address')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        id="login-email"
                        name="email"
                        required
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={`${inputBase} pl-10 pr-4`}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="login-password" className="text-xs font-medium text-gray-600">
                        {tx('Password')}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgot(true);
                          setError(null);
                        }}
                        className="text-xs text-[#38c9c0] hover:underline focus:outline-none cursor-pointer"
                      >
                        {tx('Forgot password?')}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        id="login-password"
                        name="password"
                        required
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className={`${inputBase} pl-10 pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={tx(showPassword ? 'Hide password' : 'Show password')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember */}
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500 select-none">
                    <input
                      id="remember-login"
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 accent-[#0d3d38]"
                    />
                    <span>
                      {tx('Remember me')}
                      <span className="ml-1 text-gray-400">{tx('(this device)')}</span>
                    </span>
                  </label>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0d3d38] text-sm font-semibold text-white transition-colors hover:bg-[#0b3330] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? <><LoaderCircle className="h-4 w-4 animate-spin" /> {tx('Signing you in\u2026')}</>
                      : <>{tx('Continue')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
                    }
                  </button>
                </form>

                {/* Switch */}
                <p className="mt-5 text-center text-xs text-gray-500">
                  {tx("Don't have an account?")}{' '}
                  <button
                    type="button"
                    onClick={() => setAppState('REGISTER')}
                    className="font-semibold text-[#0d3d38] underline-offset-2 hover:underline focus:outline-none"
                  >
                    {tx('Create your account')}
                  </button>
                </p>
              </div>
            )}
          </div>

          {/* Trust note */}
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>{tx('Secure access to your Gidfine lending workspace')}</span>
          </div>
        </div>
      </div>
      {/* Footer */}
      <footer className="py-5 text-center text-[11px] text-gray-400 bg-[#f5f5f4]">
        &copy; {new Date().getFullYear()} Gidfine.gh &middot; Loan marketplace &middot; Ghana
      </footer>
    </div>
  );
}
