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
  X,
} from 'lucide-react';
import { gidfineAPI } from '../../lib/api-gidfine';
import { useLoanStore } from '../../store/useLoanStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
      {children}
    </label>
  );
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { setUser } = useLoanStore();
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
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
      if (!response?.token) {
        throw new Error('Invalid credentials');
      }

      setUser({
        name: response.user.fullName?.trim() || response.user.email,
        email: response.user.email,
        picture: '',
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
      if (!response?.token) {
        throw new Error('Registration failed');
      }

      setUser({
        name: response.user.fullName?.trim() || regName.trim(),
        email: response.user.email,
        picture: '',
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[#111] p-6 text-white shadow-2xl shadow-black/50 sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-cyan-400/10 to-transparent" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="absolute right-4 top-4 rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Gidfine</p>
            <h2 id="auth-modal-title" className="font-display text-xl font-medium tracking-tight">
              {mode === 'LOGIN' ? 'Welcome back' : 'Create your account'}
            </h2>
          </div>
        </div>

        <div className="mb-6 flex rounded-xl border border-white/10 bg-[#0A0A0A] p-1" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'LOGIN'}
            onClick={() => switchMode('LOGIN')}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${mode === 'LOGIN' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'REGISTER'}
            onClick={() => switchMode('REGISTER')}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${mode === 'REGISTER' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white'}`}
          >
            Create account
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs font-medium text-red-300" role="alert">
            {error}
          </div>
        )}

        {mode === 'LOGIN' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
            <div>
              <FieldLabel htmlFor="login-email">Email address</FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
                <input
                  id="login-email"
                  name="email"
                  required
                  type="email"
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
                <input
                  id="login-password"
                  name="password"
                  required
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] py-3 pl-10 pr-11 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((visible) => !visible)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-3 rounded-md p-0.5 text-white/35 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black shadow-lg shadow-white/10 transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Signing you in…</> : <>Sign in to dashboard <ArrowRight className="h-4 w-4" /></>}
            </button>
            <p className="text-center text-[11px] text-white/35">Secure access to your lending workspace.</p>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
            <div>
              <FieldLabel htmlFor="register-name">Full name</FieldLabel>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
                <input
                  id="register-name"
                  name="name"
                  required
                  type="text"
                  autoComplete="name"
                  value={regName}
                  onChange={(event) => setRegName(event.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="register-email">Email</FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
                  <input
                    id="register-email"
                    name="email"
                    required
                    type="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(event) => setRegEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="register-phone">Phone</FieldLabel>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
                  <input
                    id="register-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={regPhone}
                    onChange={(event) => setRegPhone(event.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                  />
                </div>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="register-password">Password</FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-white/30" />
                <input
                  id="register-password"
                  name="password"
                  required
                  type={showRegistrationPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(event) => setRegPassword(event.target.value)}
                  placeholder="At least 10 characters"
                  className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] py-3 pl-10 pr-11 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                />
                <button
                  type="button"
                  onClick={() => setShowRegistrationPassword((visible) => !visible)}
                  aria-label={showRegistrationPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-3 rounded-md p-0.5 text-white/35 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
                >
                  {showRegistrationPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black shadow-lg shadow-white/10 transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Creating account…</> : <>Create account <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
