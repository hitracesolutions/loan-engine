import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import DashboardLayout from './components/workspace/layout/DashboardLayout';
import ProfileCompletionModal from './components/auth/ProfileCompletionModal';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import Docs from './pages/Docs';
import About from './pages/About';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { useLoanStore } from './store/useLoanStore';
import LanguagePicker from './components/LanguagePicker';

function App() {
  const { currentState, language } = useLoanStore();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    document.documentElement.lang = language === 'tw' ? 'ak' : language;
  }, [language]);

  useEffect(() => {
    const handleAuthInvalidated = () => {
      useLoanStore.getState().clearSession();
    };
    window.addEventListener('gidfine:auth-invalidated', handleAuthInvalidated);
    return () => {
      window.removeEventListener('gidfine:auth-invalidated', handleAuthInvalidated);
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleNavigate = (path: string) => {
    if (path.startsWith('/#')) {
      const hash = path.substring(1);
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/' + hash);
        setCurrentPath('/');
      } else {
        window.location.hash = hash;
      }
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return;
    }

    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth & Registration modal states take priority
  if (currentState === 'LOGIN') return <LoginPage />;
  if (currentState === 'REGISTER') return <RegisterPage />;

  // Route matching
  if (currentPath === '/about') {
    return <About onNavigate={handleNavigate} />;
  }

  if (currentPath === '/privacy') {
    return <Privacy onNavigate={handleNavigate} />;
  }

  if (currentPath === '/terms') {
    return <Terms onNavigate={handleNavigate} />;
  }

  // Docs route
  if (currentPath === '/docs') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
        <header className="border-b border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl flex items-center px-6 lg:px-10 h-16">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigate('/')}>
              <img src="/favicon.svg" alt="Gidfine" className="h-7 w-7 rounded-lg" />
              <span className="font-display font-bold text-xl">Gidfine<span className="text-cyan-200/60">.gh</span></span>
            </div>
            <LanguagePicker />
          </div>
        </header>
        <main className="py-24 px-6">
          <Docs />
        </main>
      </div>
    );
  }

  if (currentState === 'UNAUTHENTICATED') return <LandingPage onNavigate={handleNavigate} />;

  return (
    <>
      <ImpersonationBanner />
      <DashboardLayout />
      <ProfileCompletionModal isOpen={false} onCompleted={() => {}} />
    </>
  );
}

export default App;
