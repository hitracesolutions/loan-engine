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

const Button = ({ children, className = "", variant = "default", size = "default", ...props }: ButtonProps) => {
  const baseStyle = "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

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
    <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
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
      {/* Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <img src="/favicon.svg" alt="Gidfine" className="h-full w-full" />
            </div>
            <span className="font-display font-medium text-xl tracking-tight">
              Gidfine<span className="text-cyan-200/60">.gh</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#platform" className="text-sm text-white/60 hover:text-white transition-colors">Platform</a>
            <a href="#benefits" className="text-sm text-white/60 hover:text-white transition-colors">Benefits</a>
            <a href="#about" className="text-sm text-white/60 hover:text-white transition-colors">About</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleOpenAuth}>Sign In</Button>
            <Button onClick={handleOpenAuth} className="hidden sm:inline-flex">
              Apply Now <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-20">
        {/* Hero Section */}
        <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 px-6">
          <div className="container mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium tracking-widest text-white/70 uppercase">Ghana's Lending Platform</span>
            </div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-8 leading-[1.1] animate-slide-up opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              Fast loans for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">every Ghanaian</span>
            </h1>

            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 font-light tracking-wide leading-relaxed animate-slide-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
              Get instant loan decisions. Flexible repayment. No hidden charges. Gidfine connects you with Ghana's best lenders in seconds.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
              <Button size="lg" onClick={handleOpenAuth} className="w-full sm:w-auto min-w-[200px]">
                Get Started Today
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[200px]">
                Learn More <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 md:gap-8 mt-16 pt-8 border-t border-white/10 animate-slide-up opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
              <div>
                <div className="text-3xl md:text-4xl font-bold mb-2">50K+</div>
                <div className="text-sm text-white/50">Borrowers Served</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold mb-2">₵500M+</div>
                <div className="text-sm text-white/50">Loans Disbursed</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold mb-2">2 mins</div>
                <div className="text-sm text-white/50">Approval Time</div>
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
                <h3 className="text-xl font-semibold mb-2">Instant Decisions</h3>
                <p className="text-white/60">Get approved in 2 minutes with AI-powered evaluation. No waiting, no hassle.</p>
              </div>

              {/* Flexible Terms */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <TrendingUp className="w-10 h-10 mb-4 text-blue-400" />
                <h3 className="text-xl font-semibold mb-2">Flexible Repayment</h3>
                <p className="text-white/60">Choose repayment periods that fit your budget. Loan amounts from ₵100 to ₵10,000.</p>
              </div>

              {/* Transparent Pricing */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <Lock className="w-10 h-10 mb-4 text-purple-400" />
                <h3 className="text-xl font-semibold mb-2">No Hidden Charges</h3>
                <p className="text-white/60">Transparent pricing. Know your rate upfront. No surprises at repayment.</p>
              </div>

              {/* Multiple Lenders */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <Globe2 className="w-10 h-10 mb-4 text-yellow-400" />
                <h3 className="text-xl font-semibold mb-2">Best Offers</h3>
                <p className="text-white/60">Compare rates from Ghana's top lenders. Get the best deal every time.</p>
              </div>

              {/* Secure & Safe */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <ShieldCheck className="w-10 h-10 mb-4 text-red-400" />
                <h3 className="text-xl font-semibold mb-2">Bank-Level Security</h3>
                <p className="text-white/60">Your data is encrypted and protected. Trusted by major Ghanaian banks.</p>
              </div>

              {/* Mobile-First */}
              <div className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all hover:bg-white/10">
                <Clock className="w-10 h-10 mb-4 text-cyan-400" />
                <h3 className="text-xl font-semibold mb-2">Anytime, Anywhere</h3>
                <p className="text-white/60">Apply from your phone. Check status. Make payments. All in one app.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="relative py-24 px-6 border-t border-white/10">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">How It Works</h2>

            <div className="space-y-8">
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40">
                    <span className="text-emerald-400 font-bold">1</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Sign Up (1 minute)</h3>
                  <p className="text-white/60">Create your account with your email and phone number. Verify with OTP.</p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-blue-500/20 border border-blue-500/40">
                    <span className="text-blue-400 font-bold">2</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Complete Profile (2 minutes)</h3>
                  <p className="text-white/60">Add your employment details, salary info, and upload ID. Instant verification.</p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-500/40">
                    <span className="text-purple-400 font-bold">3</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Request Loan (1 minute)</h3>
                  <p className="text-white/60">Tell us the amount and repayment period. Get instant approval decision.</p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-yellow-500/20 border border-yellow-500/40">
                    <span className="text-yellow-400 font-bold">4</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Choose & Repay</h3>
                  <p className="text-white/60">Pick your lender. Funds reach your account in 24 hours. Start repaying on schedule.</p>
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
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Support All Major Banks
                </h3>
                <p className="text-white/60">Works with GCB, Access Bank, Fidelity, Zenith, Ecobank, First Atlantic, and more.</p>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Ghana Cedis
                </h3>
                <p className="text-white/60">All transactions in GHS. No foreign exchange risk or hidden conversion charges.</p>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Local Support
                </h3>
                <p className="text-white/60">Customer support in English and Twi. Help when you need it.</p>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Bank Partner Network
                </h3>
                <p className="text-white/60">Partnered with Ghana's leading financial institutions for reliable disbursals.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 px-6 border-t border-white/10">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Get a Loan?</h2>
            <p className="text-xl text-white/60 mb-12">Join thousands of Ghanaians who have received instant loans through Gidfine.</p>
            <Button size="lg" onClick={handleOpenAuth} className="inline-flex">
              Apply Now - It's Free <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative border-t border-white/10 py-12 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div>
                <h4 className="font-semibold mb-4">Gidfine</h4>
                <p className="text-white/60 text-sm">Lending for every Ghanaian.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="#" className="hover:text-white transition">About</a></li>
                  <li><a href="#" className="hover:text-white transition">Blog</a></li>
                  <li><a href="#" className="hover:text-white transition">Careers</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                  <li><a href="#" className="hover:text-white transition">Terms</a></li>
                  <li><a href="#" className="hover:text-white transition">Security</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Contact</h4>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="mailto:support@gidfine.com" className="hover:text-white transition">support@gidfine.com</a></li>
                  <li><a href="tel:+233(0)123456789" className="hover:text-white transition">+233 (0) 123 456 789</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-white/10 pt-8 text-center text-sm text-white/40">
              <p>&copy; 2024 Gidfine. Lending for Ghana. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
};

export default LandingPage;
