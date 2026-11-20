import { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { gidfineAPI } from '../../lib/api-gidfine';
import { useLoanStore } from '../../store/useLoanStore';
import { useTranslation } from '../../lib/useTranslation';

const inputBase =
  'w-full rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#38c9c0] focus:bg-white focus:ring-2 focus:ring-[#38c9c0]/20 disabled:opacity-50';

export default function RegisterPage() {
  const { tx } = useTranslation();
  const { setUser, setAppState } = useLoanStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await gidfineAPI.register(email.trim(), password, name.trim(), phone.trim());
      if (!response?.token) throw new Error('Registration failed');
      setUser({
        name: response.user.fullName?.trim() || name.trim(),
        email: response.user.email,
        picture: '',
        role: response.user.role,
      });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f4] flex flex-col overflow-hidden">

      {/* ── Fixed coin assets ── */}
      <div className="coin-left pointer-events-none fixed -left-8 top-[28%] hidden -translate-y-1/2 md:block" style={{ zIndex: 0 }}>
        <img src="/auth-coins-left.png" alt="" aria-hidden="true" className="w-[260px] select-none lg:w-[300px]" />
      </div>
      <div className="coin-right pointer-events-none fixed -right-8 top-[28%] hidden -translate-y-1/2 md:block" style={{ zIndex: 0 }}>
        <img src="/auth-coins-right.png" alt="" aria-hidden="true" className="w-[260px] select-none lg:w-[300px]" />
      </div>

      {/* ── Page content ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">

        {/* Chrome user icon — transparent PNG, no blend mode needed */}
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
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            {/* Heading */}
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {tx('Create your account')}
              </h1>
              <p className="mt-1.5 text-sm text-gray-500">
                {tx('Get started with Gidfine in minutes')}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full name */}
              <div>
                <label htmlFor="register-name" className="mb-1.5 block text-xs font-medium text-gray-600">
                  {tx('Full name')}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="register-name"
                    name="name"
                    required
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className={`${inputBase} pl-10 pr-4`}
                  />
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="register-email" className="mb-1.5 block text-xs font-medium text-gray-600">
                    {tx('Email')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input
                      id="register-email"
                      name="email"
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`${inputBase} pl-10 pr-3`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="register-phone" className="mb-1.5 block text-xs font-medium text-gray-600">
                    {tx('Phone')}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input
                      id="register-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Optional"
                      className={`${inputBase} pl-10 pr-3`}
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="register-password" className="mb-1.5 block text-xs font-medium text-gray-600">
                  {tx('Password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="register-password"
                    name="password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 10 characters"
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

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0d3d38] text-sm font-semibold text-white transition-colors hover:bg-[#0b3330] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? <><LoaderCircle className="h-4 w-4 animate-spin" /> {tx('Creating account\u2026')}</>
                  : <>{tx('Create account')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
                }
              </button>

              <p className="text-center text-[11px] text-gray-400">
                {tx('By continuing you agree to Gidfine\u2019s Terms of Service and Privacy Policy.')}
              </p>
            </form>

            {/* Switch to login */}
            <p className="mt-5 text-center text-xs text-gray-500">
              {tx('Already have an account?')}{' '}
              <button
                type="button"
                onClick={() => setAppState('LOGIN')}
                className="font-semibold text-[#0d3d38] underline-offset-2 hover:underline focus:outline-none"
              >
                {tx('Sign in')}
              </button>
            </p>
          </div>

          {/* Trust note */}
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>{tx('256-bit encrypted \u00b7 Bank-level security \u00b7 Ghana')}</span>
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
