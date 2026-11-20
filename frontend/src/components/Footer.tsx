import { useTranslation } from '../lib/useTranslation';
import GidfineLogo from './GidfineLogo';

interface FooterProps {
  onNavigate?: (path: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  const { tx } = useTranslation();

  const handleLink = (path: string, e?: React.MouseEvent) => {
    if (onNavigate) {
      if (e) e.preventDefault();
      onNavigate(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.href = path;
    }
  };

  return (
    <footer className="border-t border-gray-100 bg-[#f8faf9] px-5 pt-16 pb-12 font-sans">
      <div className="mx-auto max-w-6xl">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 pb-14 border-b border-gray-200/80">
          
          {/* Left Column: ChainOA Signature QR Pill Container */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              {/* Brand */}
              <div 
                className="mb-3 cursor-pointer w-fit"
                onClick={() => handleLink('/')}
              >
                <GidfineLogo size={28} />
              </div>
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm mb-6">
                {tx('Ghana’s multi-lender credit intermediary. Compare verified loan offers from Bank of Ghana regulated institutions in minutes.')}
              </p>
            </div>

            {/* Clean Standalone QR Card */}
            <div className="inline-flex flex-col items-center rounded-[24px] bg-white border border-gray-200/90 p-3 shadow-xs w-fit">
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl overflow-hidden bg-white p-1">
                <img
                  src="/gidfine-qr.png"
                  alt="Gidfine QR"
                  className="h-full w-full object-contain"
                />
              </div>
              <a
                href="https://gidfin.dekacentral.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono font-medium text-gray-500 hover:text-gray-900 mt-2 tracking-tight transition-colors"
              >
                gidfin.dekacentral.com
              </a>
            </div>

          </div>

          {/* Right Column: Navigation Columns */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            
            {/* Column 1: Resources & Product */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">{tx('Resources')}</p>
              <ul className="space-y-3 text-[14px] text-gray-600">
                <li><a href="/#faq" onClick={(e) => handleLink('/#faq', e)} className="hover:text-gray-950 transition-colors">{tx('FAQs')}</a></li>
                <li><a href="/#how-it-works" onClick={(e) => handleLink('/#how-it-works', e)} className="hover:text-gray-950 transition-colors">{tx('How it Works')}</a></li>
                <li><a href="/#partners" onClick={(e) => handleLink('/#partners', e)} className="hover:text-gray-950 transition-colors">{tx('Lender Partners')}</a></li>
                <li><a href="/#platform" onClick={(e) => handleLink('/#platform', e)} className="hover:text-gray-950 transition-colors">{tx('Security & Act 843')}</a></li>
                <li><a href="/docs" onClick={(e) => handleLink('/docs', e)} className="hover:text-gray-950 transition-colors">{tx('Documentation')}</a></li>
              </ul>
            </div>

            {/* Column 2: Company & Contact */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">{tx('Company')}</p>
              <ul className="space-y-3 text-[14px] text-gray-600">
                <li>
                  <a
                    href="/about"
                    onClick={(e) => handleLink('/about', e)}
                    className="hover:text-gray-950 transition-colors font-medium text-gray-900"
                  >
                    {tx('About Gidfine')}
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:support@gidfin.dekacentral.com"
                    className="hover:text-gray-950 transition-colors"
                  >
                    {tx('Contact Support')}
                  </a>
                </li>
                <li>
                  <span className="text-xs text-gray-400">
                    Accra, Greater Accra, Ghana
                  </span>
                </li>
              </ul>
            </div>

            {/* Column 3: Legal & Regulatory */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">{tx('Legal')}</p>
              <ul className="space-y-3 text-[14px] text-gray-600">
                <li>
                  <a
                    href="/privacy"
                    onClick={(e) => handleLink('/privacy', e)}
                    className="hover:text-gray-950 transition-colors font-medium text-gray-900"
                  >
                    {tx('Privacy Policy')}
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    onClick={(e) => handleLink('/terms', e)}
                    className="hover:text-gray-950 transition-colors font-medium text-gray-900"
                  >
                    {tx('Terms of Service')}
                  </a>
                </li>
                <li className="pt-2 text-xs text-gray-400 leading-snug">
                  <span className="font-semibold text-gray-700">DPC Registered</span>
                  <br />Data Protection Act (Act 843)
                </li>
              </ul>
            </div>

          </div>

        </div>

        {/* Bottom Row: Legal Disclaimers & Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>
            &copy; {new Date().getFullYear()} Gidfine.gh &middot; {tx('All rights reserved.')}
          </p>
          <p className="text-center sm:text-right max-w-xl text-gray-400 leading-relaxed">
            {tx('Gidfine is a credit intermediary platform registered in Ghana under Act 843. Loans are originated and disbursed exclusively by partner commercial banks and licensed microfinance institutions.')}
          </p>
        </div>

      </div>
    </footer>
  );
}
