import { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  Phone,
  User,
  X,
} from 'lucide-react';
import { gidfineAPI } from '../../lib/api-gidfine';
import { useLoanStore } from '../../store/useLoanStore';
import { useTranslation } from '../../lib/useTranslation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REMEMBERED_EMAIL_KEY = 'gidfine_login_email';

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-gray-600">
      {children}
    </label>
  );
}

const inputBase =
  'w-full rounded-lg border border-gray-200 bg-white py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50';

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { tx } = useTranslation();
  const { setUser } = useLoanStore();
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '' : ''
  );
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(() =>
    typeof window !== 'undefined' && Boolean(localStorage.getItem(REMEMBERED_EMAIL_KEY))
  );
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(false);

  if (!isOpen) return null;

  const switchMode = (nextMode: 'LOGIN' | 'REGISTER') => {
    setMode(nextMode);
    setError(null);
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await gidfineAPI.login(loginEmail.trim(), loginPassword);
      if (!response?.token) throw new Error('Invalid credentials');
      if (rememberLogin) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, loginEmail.trim());
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
      onClose();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await gidfineAPI.register(regEmail.trim(), regPassword, regName.trim(), regPhone.trim());
      if (!response?.token) throw new Error('Registration failed');
      setUser({
        name: response.user.fullName?.trim() || regName.trim(),
        email: response.user.email,
        picture: '',
        role: response.user.role,
      });
      onClose();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label={tx('Close sign in dialog')}
          className="absolute right-4 top-4 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <img
            src="/chrome-user-icon.jpg"
            alt=""
            aria-hidden="true"
            className="h-9 w-9 object-contain drop-shadow-sm"
          />
          <h2 id="auth-modal-title" className="text-xl font-semibold tracking-tight text-gray-900">
            {mode === 'LOGIN' ? tx('Welcome back') : tx('Create your account')}
          </h2>
        </div>

        {/* Tab switcher */}
        <div
          className="mb-5 flex rounded-lg border border-gray-200 bg-gray-50 p-1"
          role="tablist"
          aria-label={tx('Authentication mode')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'LOGIN'}
            onClick={() => switchMode('LOGIN')}
            className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${
              mode === 'LOGIN'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tx('Sign in')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'REGISTER'}
            onClick={() => switchMode('REGISTER')}
            className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${
              mode === 'REGISTER'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tx('Create account')}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700" role="alert">
            {error}
          </div>
        )}

        {/* Login form */}
        {mode === 'LOGIN' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
            <div>
              <FieldLabel htmlFor="login-email">{tx('Email address')}</FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="login-email"
                  name="email"
                  required
                  type="email"
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`${inputBase} pl-10 pr-4`}
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="login-password">{tx('Password')}</FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  required
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`${inputBase} pl-10 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  aria-label={tx(showLoginPassword ? 'Hide password' : 'Show password')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
              <input
                id="remember-login"
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => setRememberLogin(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-900 focus:ring-2 focus:ring-gray-900/20"
              />
              <span>
                {tx('Remember me')}
                <span className="ml-1 text-gray-400">{tx('(this device)')}</span>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? <><LoaderCircle className="h-4 w-4 animate-spin" /> {tx('Signing you in…')}</>
                : <>{tx('Sign in to dashboard')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
              }
            </button>
            <p className="text-center text-[11px] text-gray-400">{tx('Secure access to your lending workspace.')}</p>
          </form>
        ) : (
          /* Register form */
          <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
            <div>
              <FieldLabel htmlFor="register-name">{tx('Full name')}</FieldLabel>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="register-name"
                  name="name"
                  required
                  type="text"
                  autoComplete="name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Your full name"
                  className={`${inputBase} pl-10 pr-4`}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="register-email">{tx('Email')}</FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="register-email"
                    name="email"
                    required
                    type="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`${inputBase} pl-10 pr-3`}
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="register-phone">{tx('Phone')}</FieldLabel>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="register-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Optional"
                    className={`${inputBase} pl-10 pr-3`}
                  />
                </div>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="register-password">{tx('Password')}</FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="register-password"
                  name="password"
                  required
                  type={showRegistrationPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 10 characters"
                  className={`${inputBase} pl-10 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowRegistrationPassword((v) => !v)}
                  aria-label={tx(showRegistrationPassword ? 'Hide password' : 'Show password')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {showRegistrationPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? <><LoaderCircle className="h-4 w-4 animate-spin" /> {tx('Creating account…')}</>
                : <>{tx('Create account')} <ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
