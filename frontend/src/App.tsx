import { useEffect, useState } from 'react';
import LandingPageGH from './components/LandingPageGH';
import DashboardLayout from './components/workspace/layout/DashboardLayout';
import ProfileCompletionModal from './components/auth/ProfileCompletionModal';
import Docs from './pages/Docs';
import { useLoanStore } from './store/useLoanStore';
import { ShieldCheck } from 'lucide-react';
import { api } from './lib/api';

function App() {
  const { currentState, setUser, setSessionId } = useLoanStore();
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);

  useEffect(() => {
    // OAuth/OIDC handoff: the provider returns a session_id that only the server
    // can resolve. Query parameters are never trusted as identity — the user is
    // populated exclusively from the verified session payload.
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;

    setSessionId(sessionId);
    window.history.replaceState({}, document.title, window.location.pathname);

    void api.verifySession(sessionId).then((res) => {
      const cust = res.success ? res.data?.customer_data : undefined;
      if (!cust?.name) return;

      const userObj = {
        name: cust.name,
        email: cust.email || '',
        picture: cust.picture || '',
        phone: cust.phone || '',
        salary: cust.salary || 5000,  // GHS per month
        city: cust.city || 'Accra',   // Ghana
        creditScore: cust.credit_score || 750,
        preApprovedLimit: cust.pre_approved_limit || 50000,  // GHS
      };
      setUser(userObj);

      // Prompt for profile completion only when the phone is missing or a placeholder.
      setShowProfileCompletion(
        !userObj.phone || userObj.phone.startsWith('g_') || userObj.phone.length < 10,
      );
    });
  }, [setUser, setSessionId]);

  // Public routes accessible without authentication
  const isDocsPath = window.location.pathname === '/docs';
  if (isDocsPath) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
        <header className="border-b border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl flex items-center px-6 lg:px-10 h-16">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/'}>
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span className="font-display font-bold text-xl">Gidfine<span className="text-white/40">.gh</span></span>
          </div>
        </header>
        <main className="py-24 px-6">
          <Docs />
        </main>
      </div>
    );
  }

  if (currentState === 'UNAUTHENTICATED') {
    return <LandingPageGH />;
  }

  return (
    <>
      <DashboardLayout />
      <ProfileCompletionModal
        isOpen={showProfileCompletion}
        onCompleted={() => setShowProfileCompletion(false)}
      />
    </>
  );
}

export default App;
