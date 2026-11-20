import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ScrollScrubText from '../components/ScrollScrubText';
import { useTranslation } from '../lib/useTranslation';
import { useLoanStore } from '../store/useLoanStore';
import { ShieldCheck, ArrowRight, Building2, Smartphone, CheckCircle2, Users, FileText, LayoutGrid, Scale } from 'lucide-react';

interface AboutProps {
  onNavigate?: (path: string) => void;
}

export default function About({ onNavigate }: AboutProps) {
  const { tx } = useTranslation();
  const { setAppState } = useLoanStore();

  const handleApply = () => {
    if (onNavigate) {
      onNavigate('/');
    }
    setAppState('REGISTER');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">
      
      {/* Top Banner (ChainOA style) */}
      <div className="bg-[#0d3d38] px-4 py-2 text-center text-xs font-medium text-emerald-100/90 flex items-center justify-center gap-2">
        <span>🇬🇭 {tx('Registered with Ghana Data Protection Commission (Act 843)')}</span>
        <span className="hidden sm:inline opacity-40">&middot;</span>
        <span className="hidden sm:inline text-white font-semibold">{tx('Zero Upfront Borrower Fees')}</span>
      </div>

      <Navbar onNavigate={onNavigate} />

      <main>
        {/* ══════════════════════════════════════════
            HERO — ChainOA Asymmetric Photo Mosaic Hero
        ══════════════════════════════════════════ */}
        <section className="px-5 pt-12 pb-16 md:pt-16 md:pb-24 border-b border-gray-100 bg-white">
          <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Column (Typography & Call to Action) */}
            <div className="lg:col-span-6 xl:col-span-6 text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold tracking-tight text-gray-950 leading-[1.08]">
                {tx('Building fair, transparent credit infrastructure for Ghana.')}
              </h1>
              <p className="mt-6 text-base sm:text-lg text-gray-600 leading-relaxed max-w-lg">
                {tx('We eliminate the endless bank queues, opaque interest markups, and repetitive paperwork. One secure digital application connects you to competitive offers from licensed Ghanaian banks and microfinance institutions.')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleApply}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0d3d38] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#092824] transition-all group"
                >
                  <span>{tx('Compare Verified Rates')}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <span className="text-xs font-medium text-gray-500">
                  {tx('Direct BoG-Regulated Lenders')}
                </span>
              </div>
            </div>

            {/* Right Column (ChainOA Exact Staggered Photo Mosaic) */}
            <div className="lg:col-span-6 xl:col-span-6 relative">
              <div className="relative grid grid-cols-12 gap-3 sm:gap-4 max-w-[520px] mx-auto lg:ml-auto">
                
                {/* Photo 1: Top-Right Landscape (Tech co-founders / Young couple on sunlit terrace) */}
                <div className="col-span-7 col-start-6 overflow-hidden rounded-[24px] sm:rounded-[28px] bg-gray-100 shadow-md">
                  <img
                    src="/community/about-hero-1.jpg"
                    alt="Young Ghanaian tech founders comparing loan options on terrace in Accra"
                    className="h-32 sm:h-44 w-full object-cover object-center transition-transform duration-500 hover:scale-105"
                  />
                </div>

                {/* Photo 2: Center-Left Vertical Card (Radiant woman in emerald knit on tree-lined street) */}
                <div className="col-span-6 sm:col-span-5 col-start-1 -mt-12 sm:-mt-16 z-10 overflow-hidden rounded-[24px] sm:rounded-[30px] bg-gray-100 shadow-lg border-2 border-white">
                  <img
                    src="/community/about-hero-2.jpg"
                    alt="Ghanaian retail borrower accessing credit on mobile in Accra"
                    className="h-44 sm:h-56 w-full object-cover object-top transition-transform duration-500 hover:scale-105"
                  />
                </div>

                {/* Photo 3: Bottom Landscape (Three partners celebrating at outdoor garden cafe) */}
                <div className="col-span-10 sm:col-span-9 col-start-3 -mt-6 sm:-mt-10 overflow-hidden rounded-[24px] sm:rounded-[28px] bg-gray-100 shadow-md">
                  <img
                    src="/community/about-hero-3.jpg"
                    alt="Young Ghanaian entrepreneurs celebrating business expansion loan approval"
                    className="h-32 sm:h-44 w-full object-cover object-center transition-transform duration-500 hover:scale-105"
                  />
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════
            CHAINOA-STYLE SCROLL-SCRUBBED MANIFESTO
        ══════════════════════════════════════════ */}
        <ScrollScrubText
          text={tx("You don't need to visit five bank branches to get fair terms on a loan. Start with one application. Compare real quotes side by side. That's how we think credit access should work in Ghana, and it's what we built Gidfine to do.")}
          bgClassName="bg-[#f0f4f8]"
        />

        {/* ══════════════════════════════════════════
            THE SIGNATURE 3D ASSET CARDS (ChainOA /about Style)
        ══════════════════════════════════════════ */}
        <section className="px-5 py-20 md:py-28 bg-[#fafcfb] border-b border-gray-100">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 md:mb-16 max-w-xl">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-950 leading-tight">
                {tx('Credit solutions tailored for you')}
              </h2>
              <p className="mt-3 text-base text-gray-500">
                {tx('Underwritten directly by Bank of Ghana regulated institutions, settled in Ghana Cedis.')}
              </p>
            </div>

            {/* 3 Pastel Rounded Cards with 3D Coin Discs (ChainOA Exact Architecture) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              
              {/* Card 1: Personal Loans (Lavender/Blue Wash) */}
              <div className="group relative flex flex-col justify-start overflow-hidden rounded-[32px] sm:rounded-[36px] bg-[#edf0ff] p-7 sm:p-8 h-[410px] sm:h-[430px] border border-indigo-200/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10">
                <div className="z-10">
                  <h3 className="text-2xl font-bold text-gray-950 tracking-tight">
                    {tx('Personal Loans')}
                  </h3>
                  <p className="mt-2.5 text-sm text-gray-600 leading-relaxed font-normal max-w-xs">
                    {tx('Unsecured personal financing starting from 21.6% p.a. Flexible 3 to 24-month tenures with transparent reducing-balance repayment schedules.')}
                  </p>
                </div>

                {/* 3D Asset Disc rising from bottom edge (ChainOA exact anchoring) */}
                <img
                  src="/features/asset-disc-personal.png"
                  alt="Personal Loan Asset Disc"
                  className="absolute -bottom-16 sm:-bottom-20 left-1/2 -translate-x-1/2 w-64 sm:w-72 max-w-none h-auto object-contain pointer-events-none transition-transform duration-500 group-hover:-translate-y-2 drop-shadow-xl"
                />
              </div>

              {/* Card 2: SME & Business (Mint/Green Wash) */}
              <div className="group relative flex flex-col justify-start overflow-hidden rounded-[32px] sm:rounded-[36px] bg-[#eefbf3] p-7 sm:p-8 h-[410px] sm:h-[430px] border border-emerald-200/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10">
                <div className="z-10">
                  <h3 className="text-2xl font-bold text-gray-950 tracking-tight">
                    {tx('Business & Working Capital')}
                  </h3>
                  <p className="mt-2.5 text-sm text-gray-600 leading-relaxed font-normal max-w-xs">
                    {tx('Working capital, inventory financing, and equipment credit for registered Ghanaian SMEs and retail entrepreneurs in Accra, Kumasi, and Takoradi.')}
                  </p>
                </div>

                {/* 3D Asset Disc rising from bottom edge (ChainOA exact anchoring) */}
                <img
                  src="/features/asset-disc-business.png"
                  alt="Business Loan Asset Disc"
                  className="absolute -bottom-16 sm:-bottom-20 left-1/2 -translate-x-1/2 w-64 sm:w-72 max-w-none h-auto object-contain pointer-events-none transition-transform duration-500 group-hover:-translate-y-2 drop-shadow-xl"
                />
              </div>

              {/* Card 3: Salary Advances (Gold/Yellow Wash) */}
              <div className="group relative flex flex-col justify-start overflow-hidden rounded-[32px] sm:rounded-[36px] bg-[#fff8e7] p-7 sm:p-8 h-[410px] sm:h-[430px] border border-amber-200/50 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10">
                <div className="z-10">
                  <h3 className="text-2xl font-bold text-gray-950 tracking-tight">
                    {tx('Salary Advances')}
                  </h3>
                  <p className="mt-2.5 text-sm text-gray-600 leading-relaxed font-normal max-w-xs">
                    {tx('Emergency payroll-backed credit from 18% p.a. flat rate. Approved same-day with direct disbursement into Mobile Money or bank accounts.')}
                  </p>
                </div>

                {/* 3D Asset Disc rising from bottom edge (ChainOA exact anchoring) */}
                <img
                  src="/features/asset-disc-salary.png"
                  alt="Salary Advance Gold Asset Disc"
                  className="absolute -bottom-16 sm:-bottom-20 left-1/2 -translate-x-1/2 w-64 sm:w-72 max-w-none h-auto object-contain pointer-events-none transition-transform duration-500 group-hover:-translate-y-2 drop-shadow-xl"
                />
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            HOW WE WORK (ChainOA Style Sticky Layout)
        ══════════════════════════════════════════ */}
        <section className="px-5 py-24 md:py-32 bg-white border-b border-gray-100">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              
              {/* Left Column: Sticky Title */}
              <div className="lg:col-span-5 lg:sticky lg:top-32">
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-950 leading-[1.08]">
                  {tx('How we work')}
                </h2>
                <p className="mt-6 text-lg text-gray-600 leading-relaxed font-normal max-w-md">
                  {tx('We believe credit should be an empowering catalyst, not a predatory trap. Designed from the ground up for Ghanaian borrowers with complete transparency.')}
                </p>
                <div className="mt-8 hidden lg:block">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="inline-flex items-center justify-center rounded-full bg-[#0d3d38] hover:bg-[#072421] text-white text-sm font-semibold h-12 px-7 shadow-sm transition-all"
                  >
                    {tx('Start an application')} <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: Stacked Signature Teal Cards */}
              <div className="lg:col-span-7 space-y-6 sm:space-y-8">
                
                {/* Card 1: Credit is for everyone */}
                <div className="rounded-[32px] sm:rounded-[36px] bg-[#0d3d38] p-8 sm:p-10 md:p-12 text-white shadow-xl shadow-[#0d3d38]/10 border border-[#38c9c0]/20 transition-all duration-300 hover:scale-[1.01]">
                  <Users className="h-8 w-8 sm:h-9 sm:w-9 text-[#38c9c0] mb-6" strokeWidth={2.2} />
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {tx('Fair credit is for everyone')}
                  </h3>
                  <p className="mt-3 text-base sm:text-lg text-emerald-100/80 leading-relaxed font-normal">
                    {tx('Starting small is still starting. You don’t need executive connections or collateral to get fair, transparent financing in Ghana.')}
                  </p>
                </div>

                {/* Card 2: Plain words, always */}
                <div className="rounded-[32px] sm:rounded-[36px] bg-[#0d3d38] p-8 sm:p-10 md:p-12 text-white shadow-xl shadow-[#0d3d38]/10 border border-[#38c9c0]/20 transition-all duration-300 hover:scale-[1.01]">
                  <FileText className="h-8 w-8 sm:h-9 sm:w-9 text-[#38c9c0] mb-6" strokeWidth={2.2} />
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {tx('Plain words, always')}
                  </h3>
                  <p className="mt-3 text-base sm:text-lg text-emerald-100/80 leading-relaxed font-normal">
                    {tx('If a money word needs subtitles, we explain it or we drop it. Every fee, interest rate, and repayment cedis total is spelled out before you sign.')}
                  </p>
                </div>

                {/* Card 3: Proof over promises */}
                <div className="rounded-[32px] sm:rounded-[36px] bg-[#0d3d38] p-8 sm:p-10 md:p-12 text-white shadow-xl shadow-[#0d3d38]/10 border border-[#38c9c0]/20 transition-all duration-300 hover:scale-[1.01]">
                  <Scale className="h-8 w-8 sm:h-9 sm:w-9 text-[#38c9c0] mb-6" strokeWidth={2.2} />
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {tx('Proof over promises')}
                  </h3>
                  <p className="mt-3 text-base sm:text-lg text-emerald-100/80 leading-relaxed font-normal">
                    {tx('We show you what’s real. Registered under Act 843 with Bank of Ghana regulated lending partners. What you see in your portal is what lenders agreed to.')}
                  </p>
                </div>

                {/* Card 4: Progress, one piece at a time */}
                <div className="rounded-[32px] sm:rounded-[36px] bg-[#0d3d38] p-8 sm:p-10 md:p-12 text-white shadow-xl shadow-[#0d3d38]/10 border border-[#38c9c0]/20 transition-all duration-300 hover:scale-[1.01]">
                  <LayoutGrid className="h-8 w-8 sm:h-9 sm:w-9 text-[#38c9c0] mb-6" strokeWidth={2.2} />
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {tx('Progress, one piece at a time')}
                  </h3>
                  <p className="mt-3 text-base sm:text-lg text-emerald-100/80 leading-relaxed font-normal">
                    {tx('Financial stability is built in pieces. We care about helping you build a verifiable credit track record, not trapping you in rollover debt.')}
                  </p>
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            HEROIC CTA BANNER (ChainOA "Built In Pieces" Style)
        ══════════════════════════════════════════ */}
        <section className="px-5 py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-[36px] sm:rounded-[44px] md:rounded-[48px] bg-[#0d3d38] p-10 sm:p-16 md:p-24 text-center text-white shadow-2xl shadow-[#0d3d38]/20 border border-[#38c9c0]/20 min-h-[380px] sm:min-h-[440px] flex flex-col items-center justify-center">
              
              {/* 3D Disintegrated Coin Particles Background */}
              <div className="absolute inset-0 z-0">
                <img
                  src="/features/cta-banner-bg.jpg"
                  alt=""
                  className="h-full w-full object-cover object-center opacity-85"
                />
                <div className="absolute inset-0 bg-[#0d3d38]/30" />
              </div>

              {/* Content Overlay */}
              <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
                <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.08]">
                  {tx('Big things are built in pieces.')}
                </h2>
                <p className="mt-4 sm:mt-5 text-base sm:text-xl text-emerald-100/90 font-normal">
                  {tx('Start with one.')}
                </p>

                <div className="mt-8 sm:mt-10">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="inline-flex items-center justify-center rounded-full bg-white hover:bg-emerald-50 text-gray-950 font-bold text-sm sm:text-base px-8 sm:px-10 py-3.5 sm:py-4 shadow-xl transition-all hover:scale-105 active:scale-95"
                  >
                    {tx('Own Your First Piece')}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            MONUMENTAL BRAND & REGULATORY DISCLOSURE (ChainOA Exact Placement)
        ══════════════════════════════════════════ */}
        <section className="px-5 pt-8 pb-24 md:pb-32 bg-white">
          <div className="mx-auto max-w-6xl">
            {/* Monumental Wordmark */}
            <h2 className="text-[15vw] sm:text-[13vw] md:text-[130px] lg:text-[160px] font-extrabold tracking-tighter leading-[0.92] text-[#0d3d38] select-none mb-10 md:mb-14">
              Gidfine<span className="text-[#38c9c0]">.</span>
            </h2>

            {/* Authoritative Regulatory Pedigree */}
            <div className="max-w-4xl space-y-6 text-base sm:text-lg text-gray-600 leading-relaxed font-normal">
              <p>
                {tx('Gidfine is a credit intermediary platform operating at the core of Ghana’s digital retail credit infrastructure, designed to connect retail borrowers and emerging SMEs with verified, licensed financial institutions.')}
              </p>
              <p>
                {tx('Gidfine operates in strict compliance with the Data Protection Act, 2012 (Act 843) under the regulatory oversight of the Data Protection Commission (DPC) of Ghana. All borrower profiles, Ghana Card identifications, and financial records are safeguarded using AES-256 bank-grade cryptography at rest and TLS 1.3 in transit.')}
              </p>
              <p>
                {tx('Credit facilities, annual percentage rates (APR), and loan disbursements are determined and issued exclusively by partner commercial banks and licensed microfinance institutions operating under the regulatory supervision of the Bank of Ghana. Gidfine charges zero upfront fees to loan applicants.')}
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
