import { Zap, Shield, BarChart3, Lock, FileText, ArrowRight, Globe, UserPlus, HandCoins, ScrollText } from 'lucide-react';

export default function Docs() {
  return (
    <div className="max-w-5xl mx-auto space-y-16 py-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white tracking-tight">Gidfine Help Centre</h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto">
          Gidfine is a licensed loan arranger. We match you with partner lenders,
          show you the full borrower rate before you accept, and service your
          repayments — all in Ghana cedis.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Zap, label: 'Getting Started', desc: 'Apply in 4 steps' },
          { icon: HandCoins, label: 'Repayments', desc: 'Schedules & balances' },
          { icon: BarChart3, label: 'Your Dashboard', desc: 'Track applications' },
          { icon: Shield, label: 'Security', desc: 'How we protect you' },
        ].map((item, i) => (
          <div key={i} className="border border-white/10 bg-white/[0.02] rounded-lg p-4 text-center">
            <item.icon className="w-6 h-6 text-emerald-400 mb-2 mx-auto" />
            <p className="text-xs font-medium text-white/70">{item.label}</p>
            <p className="text-xs text-white/40">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Workflow */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-white tracking-tight">How borrowing works</h2>
        <div className="border border-white/10 bg-[#0d0d0d] rounded-lg p-6">
          <ol className="space-y-6 ml-0">
            {[
              { step: 1, title: 'Create your account', icon: UserPlus, description: 'Register with your email and set a password to secure your account.' },
              { step: 2, title: 'Complete your profile', icon: FileText, description: 'Add your phone number, city and monthly income so we can assess affordability.' },
              { step: 3, title: 'Apply for a loan', icon: ScrollText, description: 'Tell us how much you need and over how long. Our team reviews your request with a partner lender.' },
              { step: 4, title: 'Accept & repay', icon: ArrowRight, description: 'Review your rate and repayment schedule, accept the offer, and track every repayment in your dashboard.' },
            ].map((s) => (
              <li key={s.step} className="flex items-start gap-4">
                <div className="mt-1 w-10 h-10 flex-shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-xs font-mono text-emerald-300">{s.step}</span>
                </div>
                <div>
                  <p className="font-medium text-white">{s.title}</p>
                  <p className="text-sm text-white/50 mt-0.5">{s.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Security & Compliance */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">Security & your data</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Lock, title: 'Encrypted in transit', description: 'All traffic between you and Gidfine is protected with TLS.' },
            { icon: Shield, title: 'Data protection', description: 'Gidfine is registered with the Data Protection Commission of Ghana and shares your data with a lender only when you proceed with their offer.' },
            { icon: BarChart3, title: 'Audit trail', description: 'Every decision on your application is recorded so it can be reviewed if you ever query it.' },
          ].map((item, i) => (
            <div key={i} className="border border-white/10 rounded-lg p-4 bg-[#0d0d0d]">
              <item.icon className="w-6 h-6 text-blue-400 mb-2" />
              <p className="font-medium text-white text-sm">{item.title}</p>
              <p className="text-xs text-white/50 mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">FAQ</h2>
        {[
          { q: 'How are interest rates determined?', a: 'Each lender sets its own rate. Gidfine adds a transparent agency margin and shows you the full borrower rate and repayment schedule before you accept.' },
          { q: 'Can I prepay my loan?', a: 'Yes. Early settlement is permitted. Visit Active Loans to see your outstanding balance.' },
          { q: 'What is the maximum loan amount?', a: 'Loan limits are set in Ghana cedis according to the approved product, affordability policy and your credit assessment.' },
          { q: 'Which currency does Gidfine use?', a: 'All amounts are shown and repaid in Ghana cedis (GH₵).' },
        ].map((item, i) => (
          <div key={i} className="border-b border-white/10 pb-4 last:border-0">
            <p className="text-white font-medium text-sm">{item.q}</p>
            <p className="text-white/50 text-sm mt-1">{item.a}</p>
          </div>
        ))}
      </section>

      {/* Bottom CTA */}
      <div className="text-center pb-12">
        <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors">
          <Globe className="w-4 h-4" />
          Back to Gidfine
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
