import { useEffect, useState } from 'react';
import LandingPage from './components/LandingPage';
import DashboardLayout from './components/workspace/layout/DashboardLayout';
import ProfileCompletionModal from './components/auth/ProfileCompletionModal';
import Docs from './pages/Docs';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { useLoanStore } from './store/useLoanStore';

function App() {
  const { currentState } = useLoanStore();
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);

  useEffect(() => {
    const handleAuthInvalidated = () => {
      useLoanStore.getState().clearSession();
    };
    window.addEventListener('gidfine:auth-invalidated', handleAuthInvalidated);
    return () => {
      window.removeEventListener('gidfine:auth-invalidated', handleAuthInvalidated);
    };
  }, []);

  // Public routes accessible without authentication
  const isDocsPath = window.location.pathname === '/docs';
  if (isDocsPath) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
        <header className="border-b border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl flex items-center px-6 lg:px-10 h-16">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
            <img src="/favicon.svg" alt="Gidfine" className="h-7 w-7 rounded-lg" />
            <span className="font-display font-bold text-xl">Gidfine<span className="text-cyan-200/60">.gh</span></span>
          </div>
        </header>
        <main className="py-24 px-6">
          <Docs />
        </main>
      </div>
    );
  }

  if (currentState === 'UNAUTHENTICATED') {
    return <LandingPage />;
  }

  return (
    <>
      <ImpersonationBanner />
      <DashboardLayout />
      <ProfileCompletionModal
        isOpen={showProfileCompletion}
        onCompleted={() => setShowProfileCompletion(false)}
      />
    </>
  );
}

export default App;
