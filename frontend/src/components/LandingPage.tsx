import { useState, useEffect, useRef, useMemo, type ButtonHTMLAttributes, type ReactNode, type JSX } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownUp,
  ShieldCheck,
  Zap,
  Lock,
  TrendingUp,
  Globe2,
  Clock,
  CheckCircle2,
  Star,
  ChevronDown,
  User,
  Building2,
  Wallet,
  Smartphone,
  Sparkles,
  Plus,
  Mail,
  X,
  ExternalLink,
  QrCode,
} from 'lucide-react';
import LanguagePicker from './LanguagePicker';
import GidfineLogo from './GidfineLogo';
import { useTranslation } from '../lib/useTranslation';
import { useLoanStore } from '../store/useLoanStore';
import Footer from './Footer';

/* ─── tiny button primitive ───────────────────────────────────────────────── */
type BV = 'default' | 'outline' | 'ghost' | 'teal';
type BS = 'default' | 'sm' | 'lg';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { children: ReactNode; variant?: BV; size?: BS; }
const Btn = ({ children, className = '', variant = 'default', size = 'default', type = 'button', ...p }: BtnProps) => {
  const base = 'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38c9c0] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  const vs: Record<BV, string> = {
    default: 'bg-[#0d3d38] text-white hover:bg-[#0b3330]',
    teal:    'bg-[#38c9c0] text-[#0d3d38] hover:bg-[#2eb8b0]',
    outline: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
    ghost:   'text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md',
  };
  const ss: Record<BS, string> = { default: 'h-9 px-5', sm: 'h-8 px-3 text-xs', lg: 'h-12 px-7 text-[15px]' };
  return <button type={type} className={`${base} ${vs[variant]} ${ss[size]} ${className}`} {...p}>{children}</button>;
};

/* ─── data ─────────────────────────────────────────────────────────────────── */
const features = [
  { icon: Zap,        title: 'Fast credit review',      body: 'Your application reaches our credit team and partner lenders the same day. No waiting weeks for a first response.' },
  { icon: TrendingUp, title: 'Compare real offers',     body: 'Every offer shows monthly rate and total cost side by side so you pick the best deal before committing.' },
  { icon: Lock,       title: 'Bank-level encryption',   body: 'ID details are encrypted at rest, access is role-based, and lenders see only a masked summary — not your documents.' },
  { icon: Globe2,     title: 'Multiple lenders, one app', body: 'Send a single application to our entire partner network. No re-filling forms. No repeating yourself.' },
  { icon: ShieldCheck,title: 'Data Protection Act',     body: "Registered with Ghana\u2019s Data Protection Commission. Your data is handled under Act 843 \u2014 not sold, not shared without consent." },
  { icon: Clock,      title: 'No app required',         body: 'Apply, track your application and view your repayment schedule right here in your browser. Works on any phone.' },
];

const steps = [
  { n: '01', time: '60 secs', title: 'Create your account', body: 'Sign up with your phone and email. No paperwork or credit checks needed to start.' },
  { n: '02', time: '2 mins', title: 'Complete profile', body: 'Enter your basic employment and Ghana Card details once. Data is AES-256 encrypted under Act 843.' },
  { n: '03', time: 'Instant', title: 'Submit application', body: 'Select your desired loan amount and tenure. Your single submission routes to all verified lenders.' },
  { n: '04', time: '< 48 hours', title: 'Compare & disburse', body: 'Review real competing offers side-by-side. Accept the best rate and receive direct disbursement.' },
];

/* ── official Ghanaian financial institution brandmarks (real images/SVGs) ─── */
const PartnerLogos = [
  { id: 'gcb',      name: 'GCB Bank',      src: '/partners/gcb.png',          className: 'h-9 max-w-[110px]' },
  { id: 'ecobank',  name: 'Ecobank Ghana',  src: '/partners/ecobank.svg',      className: 'h-7 max-w-[125px]' },
  { id: 'absa',     name: 'Absa Bank',     src: '/partners/absa.svg',         className: 'h-7 max-w-[95px]' },
  { id: 'stanbic',  name: 'Stanbic Bank',  src: '/partners/standardbank.svg', className: 'h-7 max-w-[130px]' },
  { id: 'calbank',  name: 'CalBank',       src: '/partners/calbank.png',      className: 'h-7 max-w-[110px]' },
  { id: 'letshego', name: 'Letshego',      src: '/partners/letshego.png',     className: 'h-7 max-w-[110px]' },
  { id: 'zenith',   name: 'Zenith Bank',   src: '/partners/zenith.svg',       className: 'h-7 max-w-[110px]' },
  { id: 'access',   name: 'Access Bank',   src: '/partners/access.png',       className: 'h-8 max-w-[100px]' },
];

const testimonials = [
  {
    name: 'Efua Quartey',
    quote: "I'd been told getting a loan from a bank takes months. I submitted one application on Gidfine and received verified offers from Stanbic and Fidelity in 48 hours.",
  },
  {
    name: 'Nii Lamptey',
    quote: "Simple to follow from start to finish. I liked that every step told me what happens next, with zero hidden upfront deductions.",
  },
  {
    name: 'Ama Mensah',
    quote: "Transparent interest rates. I could compare monthly repayments and tenure side by side before committing. Vetted and completely reliable.",
  },
  {
    name: 'Kwesi Appiah',
    quote: "Our boutique needed quick inventory financing before the holidays. The loan was approved and disbursed without endless bank visits.",
  },
  {
    name: 'Abena Osei',
    quote: "Zero app downloads needed. I compared offers and tracked disbursement right in Chrome on my phone during lunch break.",
  },
  {
    name: 'Kofi Addo',
    quote: "Knowing my data is handled under Ghana's Data Protection Act gave me peace of mind. Vetted lenders, zero middleman extortion.",
  },
];

function MosaicAvatar({ seed = 0 }: { seed?: number }) {
  const palette = ['#0d3d38', '#38c9c0', '#0a2a26', '#4ade80'];
  return (
    <div className="h-9 w-9 rounded-full overflow-hidden grid grid-cols-3 border border-gray-200/60 shadow-xs shrink-0">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          style={{ backgroundColor: palette[(i * 3 + seed) % palette.length] }}
        />
      ))}
    </div>
  );
}

const faqs = [
  {
    q: 'What is Gidfine?',
    a: "We're a multi-lender credit intermediary platform connecting Ghanaian borrowers directly to licensed commercial banks and regulated microfinance institutions. Instead of applying to each bank separately, you complete one application and receive competitive, transparent offers side by side.",
  },
  {
    q: 'Is my personal data and money safe with Gidfine?',
    a: "Completely safe. We are registered with Ghana's Data Protection Commission under Act 843. Your data is encrypted with 256-bit AES encryption at rest and in transit. Lenders receive only sanitized, masked profiles until you accept their binding offer.",
  },
  {
    q: 'Do I need to visit a physical bank branch?',
    a: 'Never. Your entire loan journey — from eligibility check, document upload, offer comparison, to final agreement — happens directly in your browser on phone or desktop. Zero queues, zero physical paperwork.',
  },
  {
    q: 'How fast do I get loan offers?',
    a: 'Once your application is submitted, our automated pricing engine and partner credit desks review it within 24 to 48 hours. You will receive SMS and email notifications as real lender offers arrive in your portal.',
  },
  {
    q: 'Are there any upfront or hidden fees to use Gidfine?',
    a: 'Zero. Gidfine is 100% free for borrowers to compare and receive offers. You will never be asked for an upfront processing fee, inspection fee, or broker commission.',
  },
];

const stats = [
  { val: 'GH₵', label: 'Quoted & settled in Ghana cedis' },
  { val: '4+',  label: 'Partner lenders competing for your app' },
  { val: '48h', label: 'Average time to first offer' },
];

/* ── 3D pillar cards (ChainOA rotating pillars) ────────────────────────── */
const pillars = [
  {
    id: 'regulated',
    title: 'Regulated',
    badge: 'Ghana Data Protection Act (Act 843)',
    desc: 'Operated under Ghana\u2019s Data Protection Commission, routing applications exclusively through vetted, licensed partner institutions.',
    image: '/pillars/pillar-shield.png',
  },
  {
    id: 'secure',
    title: 'Secure',
    badge: 'AES-256 Bank-Grade Encryption',
    desc: 'Bank-grade 256-bit encryption at rest and in transit. Lenders review masked summaries rather than unredacted documents.',
    image: '/pillars/pillar-fingerprint.png',
  },
  {
    id: 'accessible',
    title: 'Accessible',
    badge: 'Any Device \u00b7 Zero App Installs',
    desc: 'Pure browser-based borrowing designed for mobile. Review and compare loan offers across Ghana from any smartphone.',
    image: '/pillars/pillar-globe.png',
  },
];

/* ── 3D Magnetic Badge Component (ChainOA spring tilt style) ─────────────── */
function MagneticBadge({ text }: { text: string }) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [transform, setTransform] = useState('perspective(800px) rotateZ(0deg)');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const normX = Math.max(-1, Math.min(1, x / (rect.width / 2)));
    const normY = Math.max(-1, Math.min(1, y / (rect.height / 2)));

    // Dynamic 3D tilt & slant during flick/hover
    const rotX = -normY * 20;
    const rotY = normX * 24;
    const rotZ = normX * 16; // slants and tilts in response to cursor direction
    const transX = normX * 8;
    const transY = normY * 8;

    setIsSettling(false);
    setTransform(`perspective(800px) translate3d(${transX}px, ${transY}px, 20px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(1.08)`);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsSettling(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsSettling(true);
  };

  return (
    <div className="relative inline-block py-6 select-none" style={{ perspective: '800px' }}>
      <div
        ref={badgeRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onAnimationEnd={() => setIsSettling(false)}
        className={`inline-flex items-center gap-3 rounded-full bg-[#044b41] px-7 py-3.5 text-[15px] font-bold text-[#4ade80] shadow-xl shadow-[#044b41]/25 cursor-pointer will-change-transform ${
          isSettling ? 'badge-spring-settle' : ''
        }`}
        style={{
          transform: isSettling ? undefined : (isHovered ? transform : 'perspective(800px) rotateZ(0deg)'),
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <span className="tracking-tight">{text}</span>
        <Globe2 className="h-5 w-5 text-[#4ade80]" strokeWidth={2.2} />
      </div>
    </div>
  );
}

/* ─── Loan Products conforming strictly to pricingEngine.ts ─────────────── */
interface LoanProductConfig {
  id: 'personal' | 'business' | 'salary';
  name: string;
  icon: typeof User;
  minAmount: number;
  maxAmount: number;
  step: number;
  defaultAmount: number;
  tenures: number[];
  defaultTenure: number;
  nominalAnnualRateBps: number;
  strategy: 'FLAT_SIMULATION' | 'REDUCING_BALANCE_SIMULATION';
  tag: string;
}

const LOAN_PRODUCTS: LoanProductConfig[] = [
  {
    id: 'personal',
    name: 'Personal',
    icon: User,
    minAmount: 500,
    maxAmount: 50000,
    step: 500,
    defaultAmount: 5000,
    tenures: [6, 12, 18, 24],
    defaultTenure: 12,
    nominalAnnualRateBps: 2400, // 24% p.a. (2.0% / mo)
    strategy: 'REDUCING_BALANCE_SIMULATION',
    tag: '2.0% / mo',
  },
  {
    id: 'business',
    name: 'Business',
    icon: Building2,
    minAmount: 5000,
    maxAmount: 250000,
    step: 2500,
    defaultAmount: 25000,
    tenures: [6, 12, 24, 36],
    defaultTenure: 24,
    nominalAnnualRateBps: 2160, // 21.6% p.a. (1.8% / mo)
    strategy: 'REDUCING_BALANCE_SIMULATION',
    tag: '1.8% / mo',
  },
  {
    id: 'salary',
    name: 'Salary',
    icon: Wallet,
    minAmount: 300,
    maxAmount: 15000,
    step: 100,
    defaultAmount: 2000,
    tenures: [1, 2, 3, 6],
    defaultTenure: 3,
    nominalAnnualRateBps: 1800, // 18.0% p.a. (1.5% / mo)
    strategy: 'FLAT_SIMULATION',
    tag: '1.5% / mo',
  },
];

/**
 * Deterministic pricing calculation conforming directly to workers/api/src/domain/pricingEngine.ts
 */
function calculateDeterministicQuote(
  principalGhs: number,
  tenureMonths: number,
  rateBps: number,
  strategy: 'FLAT_SIMULATION' | 'REDUCING_BALANCE_SIMULATION',
) {
  const principalPesewas = Math.round(principalGhs * 100);

  if (strategy === 'FLAT_SIMULATION') {
    // Flat Rate Formula: (P * RateBps * TenureMonths) / 120000
    const totalInterestPesewas = Math.round((principalPesewas * rateBps * tenureMonths) / 120000);
    const totalRepayablePesewas = principalPesewas + totalInterestPesewas;
    const monthlyPesewas = Math.round(totalRepayablePesewas / tenureMonths);
    return {
      monthlyRepaymentGhs: monthlyPesewas / 100,
      totalRepayableGhs: totalRepayablePesewas / 100,
      totalInterestGhs: totalInterestPesewas / 100,
      monthlyRatePct: (rateBps / 1200).toFixed(2),
    };
  } else {
    // Reducing balance annuity simulation
    const monthlyRate = rateBps / 120000;
    if (monthlyRate === 0) {
      return {
        monthlyRepaymentGhs: principalGhs / tenureMonths,
        totalRepayableGhs: principalGhs,
        totalInterestGhs: 0,
        monthlyRatePct: '0.00',
      };
    }
    const pmt =
      (principalPesewas * (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths))) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    const roundedPmt = Math.round(pmt);

    let balance = principalPesewas;
    let totalInterestPesewas = 0;
    for (let i = 1; i <= tenureMonths; i++) {
      const monthlyInterest = Math.round(balance * monthlyRate);
      totalInterestPesewas += monthlyInterest;
      const principalPortion = Math.min(balance, roundedPmt - monthlyInterest);
      balance -= principalPortion;
    }
    const totalRepayablePesewas = principalPesewas + totalInterestPesewas;
    return {
      monthlyRepaymentGhs: roundedPmt / 100,
      totalRepayableGhs: totalRepayablePesewas / 100,
      totalInterestGhs: totalInterestPesewas / 100,
      monthlyRatePct: (rateBps / 1200).toFixed(2),
    };
  }
}

/* ── Interactive Loan Calculator Section (ChainOA Style) ─────────────────── */
function LoanCalculatorSection({ onApply }: { onApply: () => void }) {
  const [activeProduct, setActiveProduct] = useState<LoanProductConfig>(LOAN_PRODUCTS[0]);
  const [amount, setAmount] = useState<number>(LOAN_PRODUCTS[0].defaultAmount);
  const [tenure, setTenure] = useState<number>(LOAN_PRODUCTS[0].defaultTenure);

  const quote = useMemo(() => {
    return calculateDeterministicQuote(
      amount,
      tenure,
      activeProduct.nominalAnnualRateBps,
      activeProduct.strategy,
    );
  }, [amount, tenure, activeProduct]);

  return (
    <section className="border-b border-gray-100 bg-white px-5 py-20 md:py-28 overflow-hidden">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: ChainOA style headline & zero app install note */}
          <div className="lg:col-span-6">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-950 leading-[1.1]">
              Borrow From Verified Ghanaian Lenders For As Low As{' '}
              <span className="inline-flex items-center px-4 py-1 rounded-full bg-[#0d3d38] text-[#a8f07a] font-bold tracking-tight text-2xl sm:text-3xl md:text-4xl shadow-md align-middle my-1">
                GHS 500
              </span>
            </h2>

            <p className="mt-6 text-base sm:text-lg text-gray-600 leading-relaxed font-normal max-w-xl">
              Our marketplace of regulated financial institutions allows you to submit one application, compare transparent offers, and secure credit with zero upfront paperwork.
            </p>

            {/* Single unified sleek badge */}
            <div className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-gray-50/90 border border-gray-200 px-4 py-2 text-xs sm:text-[13px] text-gray-700 shadow-xs whitespace-nowrap">
              <Smartphone className="h-4 w-4 text-[#0d3d38] shrink-0" strokeWidth={1.8} />
              <span className="font-semibold text-gray-900">Zero App Install Required</span>
              <span className="text-gray-300 font-light select-none">|</span>
              <span className="text-gray-500 font-medium hidden sm:inline">Works on Chrome, Safari, Android & iOS</span>
              <span className="text-gray-500 font-medium sm:hidden">100% Web Access</span>
            </div>
          </div>

          {/* Right Column: ChainOA Interactive Card with Gidfine brand palette */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md relative">
              
              {/* Outer decorative textured frame in brand teal */}
              <div className="rounded-[36px] p-3 sm:p-4 bg-gradient-to-br from-[#38c9c0]/30 via-[#0d3d38]/10 to-[#a8f07a]/20 border border-[#38c9c0]/30 shadow-2xl shadow-[#0d3d38]/10">
                <div className="rounded-[28px] bg-white p-6 sm:p-7 shadow-sm border border-white">
                  
                  {/* Top Segmented Category Tabs */}
                  <div className="flex items-center gap-1.5 rounded-2xl bg-gray-100/80 p-1.5 mb-6">
                    {LOAN_PRODUCTS.map((prod) => {
                      const Icon = prod.icon;
                      const isActive = activeProduct.id === prod.id;
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => {
                            setActiveProduct(prod);
                            setAmount(prod.defaultAmount);
                            setTenure(prod.defaultTenure);
                          }}
                          className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-xl px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                            isActive
                              ? 'bg-[#0d3d38] text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{prod.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Input Box: "You Borrow" */}
                  <div className="rounded-2xl bg-gray-50/90 border border-gray-100 p-4 transition-colors focus-within:border-[#38c9c0]/50">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-medium mb-1.5">
                      <span>You Borrow</span>
                      <div className="flex items-center gap-1">
                        <span>Tenure:</span>
                        <div className="flex gap-1 ml-1">
                          {activeProduct.tenures.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTenure(t)}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                                tenure === t
                                  ? 'bg-[#0d3d38] text-white shadow-xs'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {t}m
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-bold text-gray-900">GH₵</span>
                        <input
                          type="number"
                          value={amount}
                          step={activeProduct.step}
                          min={activeProduct.minAmount}
                          max={activeProduct.maxAmount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val)) setAmount(val);
                          }}
                          className="w-36 bg-transparent text-2xl sm:text-3xl font-bold text-gray-950 focus:outline-none"
                        />
                      </div>
                      <span className="text-xs font-semibold text-[#0d3d38] bg-[#38c9c0]/20 px-2.5 py-0.5 rounded-full">
                        {activeProduct.tag}
                      </span>
                    </div>

                    {/* Smooth Amount Slider */}
                    <div className="mt-3">
                      <input
                        type="range"
                        min={activeProduct.minAmount}
                        max={activeProduct.maxAmount}
                        step={activeProduct.step}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0d3d38]"
                      />
                    </div>
                  </div>

                  {/* Swap Badge in between cards */}
                  <div className="flex justify-center -my-3 relative z-10">
                    <div className="h-8 w-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center">
                      <ArrowDownUp className="h-3.5 w-3.5 text-[#0d3d38]" />
                    </div>
                  </div>

                  {/* Output Box: "Estimated Monthly Repayment" */}
                  <div className="rounded-2xl bg-gray-50/90 border border-gray-100 p-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-medium mb-1">
                      <span>Estimated monthly repayment</span>
                      <span>over {tenure} months</span>
                    </div>

                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold text-gray-900">GH₵</span>
                      <span className="text-2xl sm:text-3xl font-bold text-gray-950 tabular-nums">
                        {quote.monthlyRepaymentGhs.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-xs text-gray-500 ml-1 font-medium">/ month</span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-500">
                      <span>Total repayable:</span>
                      <span className="font-semibold text-gray-900 tabular-nums">
                        GH₵ {quote.totalRepayableGhs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Primary Call to Action Button */}
                  <button
                    type="button"
                    onClick={onApply}
                    className="mt-6 w-full h-13 py-3.5 px-6 rounded-full bg-[#0d3d38] hover:bg-[#072421] text-white font-bold text-base shadow-lg shadow-[#0d3d38]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Start Application</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {/* Compliance note */}
                  <p className="mt-3.5 text-center text-[11px] text-gray-400">
                    Estimates based on verified partner rates. Subject to lender assessment.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* ── Community Impact Section (ChainOA photo banner in Gidfine deep teal) ─ */
function CommunityImpactSection({ onApply }: { onApply: () => void }) {
  const { tx } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-[#0d3d38] text-white py-20 md:py-28 px-5">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-[#38c9c0]/15 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#a8f07a]/15 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          
          {/* Left Column: Bold statement + CTA */}
          <div className="lg:col-span-5 z-10">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.08]">
              Empowering Everyday Ghanaians With Fair Credit
            </h2>

            <p className="mt-6 text-base sm:text-lg text-emerald-100/80 leading-relaxed font-normal">
              From expanding local businesses to meeting personal milestones, Gidfine connects borrowers directly to vetted, Bank of Ghana regulated lenders — eliminating paperwork, informal extortion, and hidden fees.
            </p>

            <div className="mt-10 flex items-center">
              <button
                type="button"
                onClick={onApply}
                className="inline-flex items-center justify-center rounded-full bg-white px-9 py-4 text-[17px] font-bold text-gray-950 tracking-tight transition-all hover:bg-gray-50 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/10 cursor-pointer"
              >
                <span>{tx('Start Borrowing')}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Staggered Rounded Photo Collage (ChainOA visual rhythm) */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-2 gap-4 sm:gap-5 items-center">
              
              {/* Column 1: Staggered center/bottom */}
              <div className="space-y-4 sm:space-y-5">
                <div className="relative rounded-[28px] sm:rounded-[36px] overflow-hidden shadow-2xl border border-white/10 group">
                  <img
                    src="/community/photo-professionals.jpg"
                    alt="Young Ghanaian professionals in Accra"
                    className="w-full h-56 sm:h-72 object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-3.5 left-4 right-4">
                    <span className="inline-block rounded-full bg-black/40 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-white/90">
                      Accra · Instant Offer Reviews
                    </span>
                  </div>
                </div>

                <div className="relative rounded-[28px] sm:rounded-[36px] overflow-hidden shadow-2xl border border-white/10 group">
                  <img
                    src="/community/photo-entrepreneur.jpg"
                    alt="Ghanaian retail entrepreneur in her boutique"
                    className="w-full h-44 sm:h-56 object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-3.5 left-4 right-4">
                    <span className="inline-block rounded-full bg-black/40 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-white/90">
                      Kumasi · SME Working Capital
                    </span>
                  </div>
                </div>
              </div>

              {/* Column 2: Taller hero celebration image */}
              <div className="space-y-4 sm:space-y-5 -mt-6 sm:-mt-10">
                <div className="relative rounded-[28px] sm:rounded-[36px] overflow-hidden shadow-2xl border border-white/10 group">
                  <img
                    src="/community/photo-celebration.jpg"
                    alt="Joyful Ghanaian entrepreneurs celebrating"
                    className="w-full h-72 sm:h-96 object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-sm font-bold text-white leading-snug">
                      100% Regulated Lending
                    </p>
                    <p className="text-[11px] text-emerald-200/80 mt-0.5">
                      Act 843 compliant data protection
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* ─── component ─────────────────────────────────────────────────────────────── */
export default function LandingPage({ onNavigate }: { onNavigate?: (path: string) => void } = {}) {
  const { tx } = useTranslation();
  const { setAppState } = useLoanStore();
  const [activePillar, setActivePillar] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [newsletterMessage, setNewsletterMessage] = useState('');

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes('@')) return;
    setNewsletterStatus('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewsletterStatus('success');
        setNewsletterMessage(tx("You're subscribed! Welcome to our weekly Ghana lending rate digest."));
        setNewsletterEmail('');
      } else {
        setNewsletterStatus('error');
        setNewsletterMessage(data.message || tx('Something went wrong. Please try again.'));
      }
    } catch {
      setNewsletterStatus('success');
      setNewsletterMessage(tx("You're in! Welcome to the Gidfine community."));
      setNewsletterEmail('');
    }
  };

  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setActivePillar((prev) => (prev + 1) % pillars.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [isHovered]);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden font-sans">

      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[#0d3d38] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white">
        Skip to content
      </a>

      {/* ══════════════════════════════════════════
          NAVBAR — Spacious ChainOA style header
      ══════════════════════════════════════════ */}
      <nav aria-label={tx('Main')} className="sticky top-0 z-50 h-20 border-b border-gray-100 bg-white/95 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-5">
          
          {/* Left: Brand + Audience Toggle */}
          <div className="flex items-center gap-5">
            {/* Logo */}
            <a href="#main-content" className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38c9c0]">
              <GidfineLogo size={30} />
            </a>

            {/* Segmented Audience Toggle (ChainOA style) */}
            <div className="hidden lg:flex items-center rounded-full bg-gray-100/90 p-1 text-xs font-semibold text-gray-600">
              <span className="rounded-full bg-white px-3.5 py-1.5 text-gray-900 shadow-sm">
                {tx('Borrowers')}
              </span>
              <a
                href="#partners"
                className="flex items-center gap-1 px-3.5 py-1.5 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <span>{tx('Lenders')}</span>
                <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2} />
              </a>
            </div>
          </div>

          {/* Center: Nav links */}
          <div className="hidden items-center gap-8 md:flex">
            <a href="#platform"    className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">{tx('Platform')}</a>
            <a href="#how-it-works" className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">{tx('How it works')}</a>
            <a href="#partners"    className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">{tx('Partners')}</a>
            <a href="#faq"         className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">{tx('FAQ')}</a>
            <a
              href="/about"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate('/about');
                }
              }}
              className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {tx('About')}
            </a>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <LanguagePicker />
            <Btn variant="ghost" onClick={() => setAppState('LOGIN')} className="text-[15px] font-medium text-gray-600 hover:text-gray-900">
              {tx('Sign in')}
            </Btn>
            <Btn variant="default" onClick={() => setAppState('REGISTER')} className="h-11 px-6 text-sm font-semibold shadow-sm">
              {tx('Apply now')} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Btn>
          </div>
        </div>
      </nav>

      <main id="main-content">

        {/* ══════════════════════════════════════════
            HERO — ChainOA style left-aligned typography with pastel marker highlights
        ══════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-white px-5 pb-16 pt-16 md:pb-24 md:pt-24 border-b border-gray-100">
          <div className="mx-auto max-w-6xl">

            {/* headline */}
            <h1 className="mb-8 text-5xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-bold tracking-tight text-gray-900 leading-[1.06]">
              {tx('One application for')}<br />
              <span className="relative inline-block z-10 mr-3">
                <span>{tx('Any lender,')}</span>
                <span className="absolute left-0 bottom-1.5 -z-10 h-3.5 sm:h-4 md:h-5 w-full bg-[#fed7aa]/80 rounded-sm" aria-hidden="true" />
              </span>
              <span className="relative inline-block z-10 mr-3">
                <span>{tx('Anytime')}</span>
                <span className="absolute left-0 bottom-1.5 -z-10 h-3.5 sm:h-4 md:h-5 w-full bg-[#cffafe] rounded-sm" aria-hidden="true" />
              </span>
              <span className="text-gray-900">{tx('and')}</span><br />
              <span className="relative inline-block z-10">
                <span>{tx('Anywhere')}</span>
                <span className="absolute left-0 bottom-1.5 -z-10 h-3.5 sm:h-4 md:h-5 w-full bg-[#dcfce7] rounded-sm" aria-hidden="true" />
              </span>
            </h1>

            {/* sub-bar: ChainOA style pill + CTAs */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between pt-2">
              <div className="inline-flex items-center gap-3 rounded-full bg-gray-50 border border-gray-200/80 px-4 py-2 text-sm text-gray-700 shadow-sm w-fit">
                <span className="font-medium">{tx('Compare verified loan offers across Ghana')}</span>
                <div className="flex -space-x-1.5 items-center">
                  <div className="h-5 w-5 rounded-full border border-white bg-[#0d3d38] flex items-center justify-center text-[9px] font-bold text-white">₵</div>
                  <div className="h-5 w-5 rounded-full border border-white bg-[#38c9c0] flex items-center justify-center text-[9px] font-bold text-[#0d3d38]">G</div>
                  <div className="h-5 w-5 rounded-full border border-white bg-amber-400 flex items-center justify-center text-[9px] font-bold text-gray-900">★</div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex items-center gap-3">
                <Btn size="lg" variant="default" onClick={() => setAppState('REGISTER')} className="shadow-sm">
                  {tx('Start an application')} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Btn>
                <a
                  href="#how-it-works"
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-6 text-[15px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 shadow-sm"
                >
                  {tx('See how it works')} <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
                </a>
              </div>
            </div>

            {/* stat row */}
            <div className="mt-16 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 shadow-sm">
              {stats.map(({ val, label }) => (
                <div key={label} className="bg-gray-50/80 px-4 py-6 text-center">
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">{val}</p>
                  <p className="mt-1 text-xs text-gray-500 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            PARTNERS MARQUEE
        ══════════════════════════════════════════ */}
        <section id="partners" className="border-b border-gray-100 bg-white py-10">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
            {tx('Our partner lenders')}
          </p>
          <div className="relative overflow-hidden">
            {/* fade edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10" aria-hidden="true" />
            <div className="flex items-center gap-14 px-12" style={{ animation: 'marquee 30s linear infinite', width: 'max-content' }}>
              {[...PartnerLogos, ...PartnerLogos].map((partner, i) => (
                <div
                  key={`${partner.id}-${i}`}
                  className="flex items-center justify-center opacity-40 grayscale contrast-125 transition-all hover:opacity-100 hover:grayscale-0 cursor-default"
                  title={partner.name}
                >
                  <img
                    src={partner.src}
                    alt={partner.name}
                    className={`${partner.className} object-contain select-none`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>



        {/* ══════════════════════════════════════════
            MISSION STATEMENT (ChainOA Real Wealth Creation Style)
        ══════════════════════════════════════════ */}
        <section className="border-b border-gray-100 bg-white px-5 py-20 md:py-28 overflow-hidden">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              <div className="max-w-3xl">
                <h2 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-gray-950 leading-[1.05]">
                  {tx('Fair Credit For Ghana')}
                </h2>
                <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed font-normal">
                  {tx("We\u2019re making transparent, reliable credit accessible to individuals and growing businesses across Ghana. With Gidfine, anyone, anywhere can submit one application, compare real offers from verified institutions, and borrow with complete clarity.")}
                </p>
              </div>

              {/* 3D Magnetic Spring Flick Badge */}
              <div className="md:mb-3 flex-shrink-0 self-start md:self-end">
                <MagneticBadge text={tx('Borrow Confidently')} />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            INTERACTIVE LOAN CALCULATOR (ChainOA Widget Style)
        ══════════════════════════════════════════ */}
        <LoanCalculatorSection onApply={() => setAppState('REGISTER')} />

        {/* ══════════════════════════════════════════
            COMMUNITY IMPACT & SOCIAL PROOF (ChainOA Photo Banner Style)
        ══════════════════════════════════════════ */}
        <CommunityImpactSection onApply={() => setAppState('REGISTER')} />

        {/* ══════════════════════════════════════════
            WHY GIDFINE — ChainOA Asymmetric Bento Matrix
        ══════════════════════════════════════════ */}
        <section id="platform" className="border-b border-gray-100 bg-[#fbfcfc] px-5 py-24">
          <div className="mx-auto max-w-6xl">
            
            {/* Header */}
            <div className="mb-14 max-w-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#0d3d38]">
                {tx('Why Gidfine')}
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-5xl leading-tight">
                {tx('Everything a borrower')} <span className="text-[#0d3d38]">{tx('actually needs.')}</span>
              </h2>
              <p className="mt-4 text-base sm:text-lg text-gray-500 leading-relaxed">
                {tx('No bank queues. No opaque interest rates. Compare transparent, verified credit facilities issued directly by Bank of Ghana regulated institutions.')}
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* CARD 1: Hero Large Bento (Spans 8 cols) - Multi-Lender Match Engine */}
              <div className="lg:col-span-8 rounded-[32px] border border-gray-200/80 bg-white p-7 sm:p-9 shadow-xs hover:shadow-md transition-all flex flex-col justify-between font-sans">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">
                      {tx('Real-Time Comparison')}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 font-sans">
                      {tx('One Application · Multiple Offers')}
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-950 mb-3 font-sans">
                    {tx('Compare verified loan quotes side by side')}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 max-w-xl leading-relaxed mb-8 font-sans">
                    {tx('Instead of filling five different loan forms, submit once. Regulated lenders compete for your loan, giving you clear monthly payments, total repayment, and APR side-by-side.')}
                  </p>
                </div>

                {/* Micro-UI: Clean Loan Comparison Ticker */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-gray-100 font-sans">
                  {/* Quote 1 */}
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-900 tracking-tight font-sans">Commercial Bank</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#0d3d38] font-sans">
                          Lowest APR
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-gray-950 tracking-tight font-sans tabular-nums my-1 flex items-baseline gap-0.5">
                        <span className="text-base font-bold text-gray-600">GH₵</span>
                        <span>468</span>
                        <span className="text-xs font-normal text-gray-500 ml-0.5">/mo</span>
                      </div>
                      <div className="text-xs text-emerald-800 font-semibold font-sans tracking-tight mb-2">21.5% APR · 12 mos</div>
                    </div>
                    <div className="text-[11px] font-medium text-gray-400 font-sans tabular-nums pt-1 border-t border-gray-200/50">Total: GH₵ 5,616</div>
                  </div>

                  {/* Quote 2 */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 transition-all opacity-90 hover:opacity-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-900 tracking-tight font-sans">Licensed MFI</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-sans">
                          Fast Payout
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-gray-950 tracking-tight font-sans tabular-nums my-1 flex items-baseline gap-0.5">
                        <span className="text-base font-bold text-gray-600">GH₵</span>
                        <span>479</span>
                        <span className="text-xs font-normal text-gray-500 ml-0.5">/mo</span>
                      </div>
                      <div className="text-xs text-gray-700 font-semibold font-sans tracking-tight mb-2">24.0% APR · 12 mos</div>
                    </div>
                    <div className="text-[11px] font-medium text-gray-400 font-sans tabular-nums pt-1 border-t border-gray-100">Total: GH₵ 5,748</div>
                  </div>

                  {/* Quote 3 */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 transition-all opacity-90 hover:opacity-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-900 tracking-tight font-sans">Tier-2 Savings</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-sans">
                          Flexible
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-gray-950 tracking-tight font-sans tabular-nums my-1 flex items-baseline gap-0.5">
                        <span className="text-base font-bold text-gray-600">GH₵</span>
                        <span>472</span>
                        <span className="text-xs font-normal text-gray-500 ml-0.5">/mo</span>
                      </div>
                      <div className="text-xs text-gray-700 font-semibold font-sans tracking-tight mb-2">22.8% APR · 12 mos</div>
                    </div>
                    <div className="text-[11px] font-medium text-gray-400 font-sans tabular-nums pt-1 border-t border-gray-100">Total: GH₵ 5,664</div>
                  </div>
                </div>
              </div>

              {/* CARD 2: Deep Forest Speed & Turnaround (Spans 4 cols) */}
              <div className="lg:col-span-4 rounded-[32px] bg-[#0d3d38] p-7 sm:p-9 text-white shadow-xs flex flex-col justify-between relative overflow-hidden group">
                
                {/* 3D Metallic Corner Bleed Asset (Single Cedis Coin) */}
                <div className="absolute -bottom-8 -right-8 w-36 sm:w-44 pointer-events-none select-none opacity-45 transition-transform duration-700 ease-out group-hover:scale-105 group-hover:-translate-y-1">
                  <img
                    src="/features/coin-cedis-single.png"
                    alt=""
                    aria-hidden="true"
                    className="w-full h-auto object-contain drop-shadow-2xl"
                  />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-200/80">
                      {tx('Speed')}
                    </span>
                    <span className="text-xs font-medium text-emerald-200/80">
                      {tx('Direct Routing')}
                    </span>
                  </div>

                  <div className="mt-4 mb-2">
                    <span className="text-5xl sm:text-6xl font-bold tracking-tight text-white">&lt; 48h</span>
                  </div>
                  <h3 className="text-xl font-semibold text-emerald-100 mb-3">
                    {tx('Average time to your first verified offer')}
                  </h3>
                  <p className="text-sm text-emerald-100/70 leading-relaxed max-w-[280px]">
                    {tx('Your loan request reaches credit underwriting desks the exact same day. No waiting weeks in branch queues to know where you stand.')}
                  </p>
                </div>

                <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-emerald-200/80 font-medium">
                  <span>{tx('Paperless underwriting')}</span>
                  <span className="text-[#38c9c0]">100% Digital &rarr;</span>
                </div>
              </div>

              {/* CARD 3: Privacy & Act 843 Masked Underwriting (Spans 4 cols) */}
              <div className="lg:col-span-4 rounded-[32px] border border-gray-200/80 bg-white p-7 sm:p-9 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      {tx('Privacy')}
                    </span>
                  </div>

                  {/* Masked ID Mockup */}
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 mb-6">
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
                      <span>{tx('Ghana Card Identity')}</span>
                      <span className="text-emerald-800 font-semibold">Masked</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-gray-800 tracking-wider">
                      GHA-•••••••••-7
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">
                      {tx('AES-256 encrypted · DPC Act 843 Protected')}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-2">
                    {tx('Bank-grade masked underwriting')}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {tx('Lenders evaluate only anonymized credit scores and debt-to-income metrics. Your actual documents are never shared without your consent.')}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 text-xs font-semibold text-gray-600">
                  {tx('Registered with Ghana DPC (Act 843)')}
                </div>
              </div>

              {/* CARD 4: Zero App Store Installs (Spans 4 cols) */}
              <div className="lg:col-span-4 rounded-[32px] border border-gray-200/80 bg-white p-7 sm:p-9 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      {tx('Accessibility')}
                    </span>
                  </div>

                  {/* Browser Address Bar Pill */}
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <Lock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs font-mono font-medium text-gray-700 truncate">
                        gidfin.dekacentral.com
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-medium text-gray-400 shrink-0">
                      Instant Web App
                    </span>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-2">
                    {tx('Zero App Store downloads required')}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {tx('Apply, upload payslips, review repayment amortization, and sign agreements directly inside your mobile browser. Fast, lightweight, zero storage used.')}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 text-xs font-semibold text-gray-600">
                  {tx('Sub-second load times on MTN & Telecel')}
                </div>
              </div>

              {/* CARD 5: Zero Upfront Fees Guarantee (Spans 4 cols) */}
              <div className="lg:col-span-4 rounded-[32px] border border-gray-200/80 bg-[#f8fbfb] p-7 sm:p-9 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0d3d38]">
                      {tx('Transparent')}
                    </span>
                    <span className="text-xs font-semibold text-[#0d3d38]">
                      {tx('Guaranteed')}
                    </span>
                  </div>

                  <div className="mt-2 mb-2">
                    <span className="text-5xl font-black tracking-tight text-[#0d3d38]">GH₵ 0</span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-2">
                    {tx('Zero upfront applicant fees')}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {tx('Gidfine charges borrowers nothing to compare quotes or submit applications. We earn only from institutional lenders upon successful loan disbursement.')}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200/60 text-xs font-bold text-[#0d3d38]">
                  {tx('No hidden origination or search surcharges')}
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════
            HOW IT WORKS — ChainOA Progression Pipeline
        ══════════════════════════════════════════ */}
        <section id="how-it-works" className="border-b border-gray-100 bg-[#fafcfb] px-5 py-24 font-sans">
          <div className="mx-auto max-w-6xl">
            
            {/* Header */}
            <div className="mb-16 max-w-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0d3d38] font-sans">
                {tx('The Process')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-950 mt-3 font-sans">
                {tx('From sign-up to offer')} <span className="text-[#0d3d38]">{tx('in four steps.')}</span>
              </h2>
              <p className="mt-3 text-base text-gray-500 font-sans leading-relaxed">
                {tx('A streamlined digital credit application designed for clarity, zero branch queues, and total rate transparency.')}
              </p>
            </div>

            {/* Connected Progression Pipeline */}
            <div className="relative">
              
              {/* Desktop Connecting Line behind cards */}
              <div className="hidden lg:block absolute top-[44px] left-[40px] right-[40px] h-[2px] bg-gradient-to-r from-[#0d3d38]/20 via-[#38c9c0]/30 to-[#0d3d38]/20 pointer-events-none z-0" />

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 relative z-10">
                {steps.map(({ n, title, body, time }, idx) => (
                  <div
                    key={n}
                    className="group relative rounded-[28px] border border-gray-200/80 bg-white p-7 shadow-xs hover:border-[#38c9c0]/50 hover:shadow-lg hover:shadow-emerald-950/5 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Step Number Badge & Timeline */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0d3d38] text-white text-sm font-extrabold tracking-tight font-sans shadow-xs transition-transform duration-300 group-hover:scale-105">
                          {n}
                        </div>
                        <span className="text-[11px] font-semibold text-gray-400 font-sans tracking-wide">
                          {time}
                        </span>
                      </div>

                      <h3 className="text-[17px] font-bold tracking-tight text-gray-950 mb-2.5 font-sans">
                        {tx(title)}
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-500 font-sans">
                        {tx(body)}
                      </p>
                    </div>

                    {/* Bottom Progress Indicator */}
                    <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-sans">
                      <span className="font-medium text-gray-400">{tx('Stage')} 0{idx + 1}/04</span>
                      <span className="text-[#0d3d38] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════
            3D ROTATING PILLARS (ChainOA Interactive Carousel)
        ══════════════════════════════════════════ */}
        <section
          id="about"
          className="border-b border-gray-100 bg-[#f8faf9] px-5 py-24 overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="mx-auto max-w-5xl text-center">

            {/* 3D Card Stage */}
            <div className="relative mx-auto flex items-center justify-center min-h-[420px] sm:min-h-[460px]">
              
              {/* Left background card (previous) */}
              <button
                type="button"
                onClick={() => setActivePillar((activePillar - 1 + pillars.length) % pillars.length)}
                className="absolute left-2 sm:left-8 md:left-14 z-10 hidden sm:flex flex-col items-center justify-center w-56 h-80 rounded-[28px] bg-white border border-gray-200/80 p-6 opacity-40 scale-90 blur-[0.2px] transition-all duration-700 hover:opacity-75 cursor-pointer shadow-sm focus:outline-none"
                aria-label={`Switch to ${pillars[(activePillar - 1 + pillars.length) % pillars.length].title}`}
              >
                <img
                  src={pillars[(activePillar - 1 + pillars.length) % pillars.length].image}
                  alt=""
                  className="w-36 h-36 object-contain select-none opacity-80"
                />
              </button>

              {/* Center active elevated card */}
              <div
                key={pillars[activePillar].id}
                className="relative z-20 flex flex-col items-center justify-center w-[290px] sm:w-[330px] md:w-[360px] h-[390px] sm:h-[430px] rounded-[36px] border-[5px] border-[#0d3d38] p-8 shadow-2xl transition-all duration-700 overflow-hidden"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, #f0fdfa 0%, #ffffff 85%)',
                }}
              >
                {/* Concentric radar rings texture (ChainOA style) */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: 'repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 9px, rgba(56,201,192,0.35) 10px, transparent 11px)',
                  }}
                  aria-hidden="true"
                />

                {/* 3D Image with calm subtle floating motion */}
                <div className="relative z-10 flex items-center justify-center h-60 w-60">
                  <img
                    src={pillars[activePillar].image}
                    alt={pillars[activePillar].title}
                    className="w-52 h-52 sm:w-56 sm:h-56 object-contain drop-shadow-2xl transition-all duration-700 select-none animate-float"
                  />
                </div>
              </div>

              {/* Right background card (next) */}
              <button
                type="button"
                onClick={() => setActivePillar((activePillar + 1) % pillars.length)}
                className="absolute right-2 sm:right-8 md:right-14 z-10 hidden sm:flex flex-col items-center justify-center w-56 h-80 rounded-[28px] bg-white border border-gray-200/80 p-6 opacity-40 scale-90 blur-[0.2px] transition-all duration-700 hover:opacity-75 cursor-pointer shadow-sm focus:outline-none"
                aria-label={`Switch to ${pillars[(activePillar + 1) % pillars.length].title}`}
              >
                <img
                  src={pillars[(activePillar + 1) % pillars.length].image}
                  alt=""
                  className="w-36 h-36 object-contain select-none opacity-80"
                />
              </button>
            </div>

            {/* Title & Description beneath card */}
            <div className="mt-8 text-center max-w-xl mx-auto px-4">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight transition-all duration-500">
                {tx(pillars[activePillar].title)}
              </h2>
              <p className="mt-3.5 text-base text-gray-500 leading-relaxed transition-all duration-500 min-h-[3rem]">
                {tx(pillars[activePillar].desc)}
              </p>

              {/* Pagination indicator dots */}
              <div className="mt-8 flex items-center justify-center gap-2">
                {pillars.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePillar(idx)}
                    className={`h-2 transition-all duration-300 rounded-full ${activePillar === idx ? 'w-8 bg-[#0d3d38]' : 'w-2 bg-gray-300 hover:bg-gray-400'}`}
                    aria-label={`Select ${p.title}`}
                  />
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════
            WHAT GETTING YOUR LOAN LOOKS LIKE (ChainOA Feature Showcase Style)
        ══════════════════════════════════════════ */}
        <section className="border-b border-gray-100 bg-white py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            {/* Headline */}
            <div className="mb-12 md:mb-16 max-w-xl">
              <h2 className="text-3xl sm:text-4xl md:text-[46px] font-bold tracking-tight text-gray-950 leading-[1.12]">
                {tx('What getting your loan looks like')}
              </h2>
            </div>

            {/* 2 Large Side-by-Side Visual Mockup Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7 lg:gap-8">
              {/* Card 1: Loan Offer Phone with 3D Cedi Coins */}
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-[32px] sm:rounded-[38px] bg-[#f0f8f7] border border-[#38c9c0]/20 p-7 sm:p-9 transition-all duration-300 hover:shadow-xl hover:shadow-[#0d3d38]/8 hover:border-[#38c9c0]/40">
                <div className="mb-6">
                  <h3 className="text-2xl sm:text-[28px] font-bold tracking-tight text-gray-950 leading-snug max-w-sm">
                    {tx('Begin with an amount that works for you.')}
                  </h3>
                </div>

                <div className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] border border-white/80 shadow-md shadow-[#0d3d38]/5 bg-white">
                  <img
                    src="/features/feature-loan-offer.jpg"
                    alt="Approved loan offer mobile screen with 3D cedi coins"
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Card 2: Disbursement Sheet with MoMo & Banks */}
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-[32px] sm:rounded-[38px] bg-[#f0f8f7] border border-[#38c9c0]/20 p-7 sm:p-9 transition-all duration-300 hover:shadow-xl hover:shadow-[#0d3d38]/8 hover:border-[#38c9c0]/40">
                <div className="mb-6">
                  <h3 className="text-2xl sm:text-[28px] font-bold tracking-tight text-gray-950 leading-snug max-w-sm">
                    {tx('Disburse funds however you like.')}
                  </h3>
                </div>

                <div className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] border border-white/80 shadow-md shadow-[#0d3d38]/5 bg-white">
                  <img
                    src="/features/feature-disbursement.jpg"
                    alt="Select disbursement method sheet modal with Mobile Money and Bank options"
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            REVIEWS & SOCIAL PROOF (ChainOA Right-to-Left Marquee Style)
        ══════════════════════════════════════════ */}
        <section className="border-b border-[#38c9c0]/15 bg-[#f0f8f7] py-20 md:py-28 overflow-hidden">
          <div className="mx-auto max-w-6xl px-5">
            {/* Header row with headline and trust avatar widget */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-950 leading-[1.15] max-w-lg">
                  {tx('See what people are saying about us')}
                </h2>
              </div>

              {/* Right trust pill & stars (ChainOA proportion & brand styling) */}
              <div className="flex flex-col items-start sm:items-end">
                {/* Big prominent pill with 3 distinct character headshots */}
                <div className="inline-flex items-center -space-x-3.5 sm:-space-x-4 rounded-full bg-[#0d3d38] p-2 sm:p-2.5 shadow-lg shadow-[#0d3d38]/20">
                  <img
                    src="/community/avatar-1.jpg?v=2"
                    alt="Ghanaian borrower portrait"
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover border-[2.5px] border-[#0d3d38] ring-1 ring-white/10"
                  />
                  <img
                    src="/community/avatar-2.jpg?v=2"
                    alt="Ghanaian borrower portrait"
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover border-[2.5px] border-[#0d3d38] ring-1 ring-white/10"
                  />
                  <img
                    src="/community/avatar-3.jpg?v=2"
                    alt="Ghanaian borrower portrait"
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover border-[2.5px] border-[#0d3d38] ring-1 ring-white/10"
                  />
                </div>

                {/* Rating & trust stack matching ChainOA in Gidfine teal palette */}
                <div className="mt-3.5 flex items-center gap-3">
                  <div className="flex flex-col items-start sm:items-end">
                    <div className="flex items-center gap-0.5 text-[#0d3d38]">
                      {[1, 2, 3, 4].map((i) => (
                        <Star key={i} className="h-4 w-4 fill-[#0d3d38] text-[#0d3d38]" />
                      ))}
                      {/* 5th half-filled star matching ChainOA */}
                      <div className="relative h-4 w-4">
                        <Star className="h-4 w-4 text-[#0d3d38]" strokeWidth={1.8} />
                        <div className="absolute inset-0 overflow-hidden w-[65%]">
                          <Star className="h-4 w-4 fill-[#0d3d38] text-[#0d3d38]" />
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-950 tracking-tight mt-1">4.8 Rating</span>
                  </div>

                  <div className="text-xs text-gray-500 leading-snug font-medium pl-2.5 border-l border-gray-200">
                    <p>{tx('Over thousands of')}</p>
                    <p>{tx('people trust us')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Continuous Right-to-Left Moving Marquee */}
          <div className="relative mt-12 overflow-hidden">
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-[#f0f8f7] to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-[#f0f8f7] to-transparent z-10" />

            <div className="flex w-max gap-5 animate-marquee-slow py-6">
              {[...testimonials, ...testimonials, ...testimonials].map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  className="relative shrink-0 w-[320px] sm:w-[370px] min-h-[200px] rounded-[30px] border border-gray-200/90 bg-white p-7 shadow-xs flex flex-col justify-between transition-all duration-300 ease-out cursor-default hover:-translate-y-2.5 hover:scale-[1.015] hover:z-20 hover:border-[#38c9c0]/60 hover:shadow-[0_22px_40px_-12px_rgba(13,61,56,0.14)]"
                >
                  <p className="text-[15px] leading-relaxed text-gray-800 font-normal">
                    {item.quote}
                  </p>

                  <div className="flex items-center gap-3 pt-4">
                    <MosaicAvatar seed={idx} />
                    <p className="text-[15px] font-bold text-gray-950 tracking-tight">{item.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            FAQ (ChainOA 2-Column Responsive Accordion)
        ══════════════════════════════════════════ */}
        <section id="faq" className="border-b border-gray-100 bg-white py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
              {/* Left Column: Bold Editorial Headline */}
              <div className="lg:col-span-5 lg:sticky lg:top-28">
                <h2 className="text-3xl sm:text-4xl md:text-[42px] font-bold tracking-tight text-gray-950 leading-[1.15]">
                  {tx("If you're curious about us, we've answered your questions here")}
                </h2>
                <p className="mt-4 text-base text-gray-500 max-w-md leading-relaxed">
                  {tx('Transparent terms, no hidden fees, and fully regulated under Ghanaian banking standards.')}
                </p>
              </div>

              {/* Right Column: Pill Accordion Stack */}
              <div className="lg:col-span-7 flex flex-col gap-3.5">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={faq.q}
                      className={`overflow-hidden transition-all duration-300 ${
                        isOpen
                          ? 'rounded-[26px] bg-[#0d3d38] p-6 sm:p-7 shadow-xl shadow-[#0d3d38]/20'
                          : 'rounded-[20px] bg-[#f0f4f8] hover:bg-[#e4ecf3] px-6 py-5 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isOpen) setOpenFaq(idx);
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFaq(isOpen ? null : idx);
                        }}
                        className="flex w-full items-center justify-between gap-4 text-left focus:outline-none"
                        aria-expanded={isOpen}
                      >
                        <span
                          className={`text-base sm:text-[17px] font-semibold tracking-tight transition-colors ${
                            isOpen ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {faq.q}
                        </span>
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-300 ${
                            isOpen
                              ? 'rotate-45 text-white'
                              : 'rotate-0 text-gray-700'
                          }`}
                        >
                          <Plus className="h-5 w-5" strokeWidth={2.2} />
                        </span>
                      </button>

                      <div
                        className={`grid transition-all duration-300 ease-in-out ${
                          isOpen ? 'grid-rows-[1fr] opacity-100 mt-3.5' : 'grid-rows-[0fr] opacity-0 mt-0'
                        }`}
                      >
                        <div className="overflow-hidden text-[15px] sm:text-base leading-relaxed text-emerald-50/90 font-normal">
                          {faq.a}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            NEWSLETTER / LEAD CAPTURE BANNER (ChainOA Inset Style)
        ══════════════════════════════════════════ */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-6xl px-5">
            <div className="relative rounded-[32px] sm:rounded-[38px] bg-[#0d3d38] p-8 sm:p-12 md:p-14 text-white overflow-hidden shadow-2xl shadow-[#0d3d38]/25">
              
              {/* Ambient radial teal background glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-[#38c9c0]/15 blur-3xl" />
              <div className="pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-[#38c9c0]/10 blur-3xl" />

              {/* Decorative subtle segmented arch in background */}
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 opacity-10 flex items-center justify-center">
                <svg viewBox="0 0 400 400" className="h-full w-auto">
                  <circle cx="200" cy="200" r="160" fill="none" stroke="#fff" strokeWidth="24" strokeDasharray="20 12" />
                </svg>
              </div>

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                {/* Left Side: Bold Editorial Copy */}
                <div className="lg:col-span-7">
                  <h2 className="text-3xl sm:text-4xl md:text-[44px] font-bold tracking-tight text-white leading-[1.12] max-w-lg">
                    {tx('Everyone loves to read what we write about money')}
                  </h2>
                  <p className="mt-4 text-base text-emerald-100/80 leading-relaxed max-w-md font-normal">
                    {tx('Weekly breakdowns on Bank of Ghana interest rate shifts, bank loan comparisons, and debt management guides delivered right to your inbox.')}
                  </p>
                </div>

                {/* Right Side: Clean White Inset Card */}
                <div className="lg:col-span-5">
                  <div className="rounded-[24px] sm:rounded-[28px] bg-white p-6 sm:p-8 text-gray-950 shadow-xl">
                    <h3 className="text-lg font-bold text-gray-950 tracking-tight mb-4">
                      {tx('Join our weekly money newsletter')}
                    </h3>

                    <form onSubmit={handleNewsletterSubmit} className="space-y-3">
                      <div className="relative flex items-center rounded-full bg-[#f4f7f6] p-1.5 focus-within:ring-2 focus-within:ring-[#38c9c0] focus-within:bg-white border border-gray-200 transition-all">
                        <input
                          type="email"
                          required
                          placeholder="name@email.com"
                          value={newsletterEmail}
                          onChange={(e) => setNewsletterEmail(e.target.value)}
                          className="w-full bg-transparent px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
                          disabled={newsletterStatus === 'loading'}
                        />
                        <button
                          type="submit"
                          disabled={newsletterStatus === 'loading'}
                          className="rounded-full bg-[#0d3d38] hover:bg-[#082b27] text-white text-xs sm:text-sm font-bold px-6 py-3 shadow-md shrink-0 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {newsletterStatus === 'loading' ? tx('Joining...') : tx('Subscribe')}
                        </button>
                      </div>

                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        {tx('By providing your information you consent to receive periodic emails including interest rate guides, lender updates, and market reports. Unsubscribe anytime.')}
                      </p>

                      {newsletterStatus === 'success' && (
                        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-900 border border-emerald-200 animate-in fade-in duration-300">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{newsletterMessage}</span>
                        </div>
                      )}

                      {newsletterStatus === 'error' && (
                        <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800 border border-red-200 animate-in fade-in duration-300">
                          {newsletterMessage}
                        </div>
                      )}
                    </form>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            FINAL CTA
        ══════════════════════════════════════════ */}
        <section className="bg-white px-5 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-6 flex justify-center">
              <GidfineLogo size={44} showWordmark={false} />
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {tx('Ready to compare')}<br />
              <span className="text-[#0d3d38]">{tx('real loan offers?')}</span>
            </h2>
            <p className="mb-9 text-base text-gray-500">
              {tx('One application. Multiple lender responses. No branch visits. Start in under three minutes.')}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Btn size="lg" onClick={() => setAppState('REGISTER')} className="w-full sm:w-auto">
                {tx('Start an application')} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Btn>
              <Btn size="lg" variant="outline" onClick={() => setAppState('LOGIN')} className="w-full sm:w-auto">
                {tx('Sign in')}
              </Btn>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <Footer onNavigate={onNavigate} />

    </div>
  );
}
