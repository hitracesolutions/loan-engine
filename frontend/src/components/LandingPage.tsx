import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ArrowRight, ShieldCheck, Zap, Lock, ChevronRight, TrendingUp, Globe2, Clock, CheckCircle2 } from 'lucide-react';
import AuthModal from './auth/AuthModal';

type ButtonVariant = 'default' | 'outline' | 'ghost';
type ButtonSize = 'default' | 'sm' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = ({ children, className = "", variant = "default", size = "default", type = "button", ...props }: ButtonProps) => {
  const baseStyle = "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] disabled:pointer-events-none disabled:opacity-50";

  const variants: Record<ButtonVariant, string> = {
    default: "bg-white text-black shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02]",
    outline: "border border-white/10 bg-transparent text-white hover:bg-white/5",
    ghost: "text-white/70 hover:text-white hover:bg-white/5"
  };

  const sizes: Record<ButtonSize, string> = {
    default: "h-11 px-6",
    sm: "h-9 px-4 text-xs",
    lg: "h-14 px-8 text-base",
  };

  return (
    <button type={type} className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const LandingPage = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const handleOpenAuth = () => {
    setIsAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-white/20 overflow-x-hidden font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
      >
        Skip to content
      </a>

      {/* Decorative background. CSS only — no remote assets. */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav aria-label="Main" className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#main-content" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <img src="/favicon.svg" alt="" className="h-full w-full" />
            </div>
            <span className="font-display font-medium text-xl tracking-tight">
              Gidfine<span className="text-cyan-200/60">.gh</span>
            </span>
          </a>
          <div className="hidden md:flex items-center gap-8">
            <a href="#platform" className="text-sm text-white/60 hover:text-white transition-colors">Platform</a>
            <a href="#benefits" className="text-sm text-white/60 hover:text-white transition-colors">How it works</a>
            <a href="#about" className="text-sm text-white/60 hover:text-white transition-colors">About</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleOpenAuth}>Sign in</Button>
            <Button onClick={handleOpenAuth} className="hidden sm:inline-flex">
              Apply now <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </nav>

      <main id="main-content" className="relative z-10 pt-20">
        {/* Hero Section */}
        <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 px-6">
          <div className="container mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="text-xs font-medium tracking-widest text-white/70 uppercase">Loans arranged in Ghana</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-medium tracking-tight mb-8 leading-[1.1] animate-slide-up opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              One application, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">several lender offers</span>
            </h1>

            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 font-light tracking-wide leading-relaxed animate-slide-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
              Apply once and Gidfine takes it to partner lenders. Every offer shows its
              monthly and annual rate side by side, so you can compare the real cost
              before you agree to anything.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
              <Button size="lg" onClick={handleOpenAuth} className="w-full sm:w-auto min-w-[200px]">
                Start an application
              </Button>
              <a
                href="#benefits"
                className="inline-flex h-14 w-full sm:w-auto min-w-[200px] items-center justify-center rounded-lg border border-white/10 px-8 text-base text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
              >
                See how it works <ChevronRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </a>
            </div>

            {/* Product facts — no performance claims */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8 mt-16 pt-8 border-t border-white/10 animate-slide-up opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
              <div>
                <div className="text-2xl md:text-3xl font-semibold mb-2">GH&#8373;</div>
                <div className="text-sm text-white/50">Quoted and settled in Ghana cedis</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-semibold mb-2">Multiple offers</div>
                <div className="text-sm text-white/50">Partner lenders compete for your application</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-semibold mb-2">Human review</div>
                <div className="text-sm text-white/50">Checked by our credit team before approval</div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Features */}
        <section id="platform" className="relative py-24 px-6 border-t border-white/10">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Why Choose Gidfine?</h2>
              <p className="text-white/60 text-lg max-w-2xl mx-auto">Everything you need for seamless lending, all in one place.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Fast Approval */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <Zap className="w-10 h-10 mb-4 text-emerald-400" />
                <h3 className="text-xl font-semibold mb-2">Fast credit review</h3>
                <p className="text-white/60">Your application is assessed by our credit team against each partner lender's criteria, so the decision you get is one a lender can stand behind.</p>
              </div>

              {/* Flexible Terms */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <TrendingUp className="w-10 h-10 mb-4 text-blue-400" />
                <h3 className="text-xl font-semibold mb-2">Terms that fit</h3>
                <p className="text-white/60">Tenure and repayment frequency come from the lender's product, so the schedule matches how you actually get paid.</p>
              </div>

              {/* Transparent Pricing */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <Lock className="w-10 h-10 mb-4 text-purple-400" />
                <h3 className="text-xl font-semibold mb-2">See the real cost</h3>
                <p className="text-white/60">Every offer shows the monthly and annual rate side by side, so the cost is comparable before you agree to it.</p>
              </div>

              {/* Multiple Lenders */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <Globe2 className="w-10 h-10 mb-4 text-yellow-400" />
                <h3 className="text-xl font-semibold mb-2">Compare lender offers</h3>
                <p className="text-white/60">Send one application to our partner lenders and choose between the terms that come back.</p>
              </div>

              {/* Secure & Safe */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <ShieldCheck className="w-10 h-10 mb-4 text-red-400" />
                <h3 className="text-xl font-semibold mb-2">Your identity stays yours</h3>
                <p className="text-white/60">ID details are encrypted at rest, access is role-based, and lenders see a masked summary rather than your documents.</p>
              </div>

              {/* Mobile-First */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <Clock className="w-10 h-10 mb-4 text-cyan-400" />
                <h3 className="text-xl font-semibold mb-2">Works on your phone</h3>
                <p className="text-white/60">Apply, follow your application status and see your repayment schedule in the browser — no app install.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="benefits" aria-labelledby="how-it-works-heading" className="relative py-24 px-6 border-t border-white/10">
          <div className="container mx-auto max-w-4xl">
            <h2 id="how-it-works-heading" className="text-3xl md:text-5xl font-bold text-center mb-16">How it works</h2>

            <div className="space-y-8">
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40">
                    <span className="text-emerald-400 font-bold">1</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Create your account</h3>
                  <p className="text-white/60">Sign up with your email and phone number. No documents are needed to get started.</p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-blue-500/20 border border-blue-500/40">
                    <span className="text-blue-400 font-bold">2</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Add your details</h3>
                  <p className="text-white/60">Tell us your employer, income and ID details. Identity data is encrypted before it is stored.</p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-500/40">
                    <span className="text-purple-400 font-bold">3</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Apply once</h3>
                  <p className="text-white/60">Choose the amount and a tenure that suits you. That single application goes to our partner lenders.</p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-yellow-500/20 border border-yellow-500/40">
                    <span className="text-yellow-400 font-bold">4</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Accept an offer and repay</h3>
                  <p className="text-white/60">Pick the offer you want and accept its terms. Repayments are recorded by our cashier team against your schedule.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ghana Focus */}
        <section id="about" className="relative py-24 px-6 border-t border-white/10 bg-white/5">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">Built for Ghana</h2>
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  Ghana cedis throughout
                </h3>
                <p className="text-white/60">Amounts are quoted, agreed and repaid in GHS, so there is no exchange rate to absorb mid-loan.</p>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  Registered data handling
                </h3>
                <p className="text-white/60">Gidfine is registered with the Data Protection Commission and handles your data under the Data Protection Act, 2012 (Act 843).</p>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  A licensed intermediary
                </h3>
                <p className="text-white/60">Gidfine arranges credit rather than lending its own money, so your contract is with the lender and the final terms are theirs.</p>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  Repayments checked daily
                </h3>
                <p className="text-white/60">Payments are recorded by our cashier team and reconciled against the ledger every business day.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 px-6 border-t border-white/10">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to apply?</h2>
            <p className="text-lg md:text-xl text-white/60 mb-12">Start one application and compare the offers that come back from our partner lenders.</p>
            <Button size="lg" onClick={handleOpenAuth} className="inline-flex">
              Start an application <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-3 mb-12">
            <div>
              <h2 className="font-semibold mb-4">Gidfine</h2>
              <p className="text-white/60 text-sm max-w-xs">
                Loan applications arranged with partner lenders in Ghana.
              </p>
            </div>
            <nav aria-label="Product">
              <h2 className="font-semibold mb-4">Product</h2>
              <ul className="space-y-2 text-sm text-white/60">
                <li><a href="#platform" className="hover:text-white transition">Platform</a></li>
                <li><a href="#benefits" className="hover:text-white transition">How it works</a></li>
                <li><a href="/docs" className="hover:text-white transition">Documentation</a></li>
              </ul>
            </nav>
            <nav aria-label="Account">
              <h2 className="font-semibold mb-4">Account</h2>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <button type="button" onClick={handleOpenAuth} className="hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                    Sign in or apply
                  </button>
                </li>
              </ul>
            </nav>
          </div>
          <div className="border-t border-white/10 pt-8 space-y-2 text-center text-sm text-white/40">
            <p>&copy; {new Date().getFullYear()} Gidfine. All rights reserved.</p>
            <p>Gidfine is a credit intermediary: loans are provided by partner lenders and final terms are set by the lender.</p>
          </div>
        </div>
      </footer>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
};

export default LandingPage;
