import { ArrowRight, ChevronDown } from 'lucide-react';
import LanguagePicker from './LanguagePicker';
import GidfineLogo from './GidfineLogo';
import { useTranslation } from '../lib/useTranslation';
import { useLoanStore } from '../store/useLoanStore';

interface NavbarProps {
  onNavigate?: (path: string) => void;
}

export default function Navbar({ onNavigate }: NavbarProps) {
  const { tx } = useTranslation();
  const { setAppState } = useLoanStore();

  const handleNav = (path: string, e?: React.MouseEvent) => {
    if (onNavigate) {
      if (e) e.preventDefault();
      onNavigate(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.href = path;
    }
  };

  return (
    <nav aria-label={tx('Main')} className="sticky top-0 z-50 h-20 border-b border-gray-100 bg-white/95 backdrop-blur-md transition-all font-sans">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-5">
        
        {/* Left: Brand + Audience Toggle */}
        <div className="flex items-center gap-5">
          {/* Logo */}
          <a
            href="/"
            onClick={(e) => handleNav('/', e)}
            className="group flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38c9c0]"
          >
            <GidfineLogo size={30} />
          </a>

          {/* Segmented Audience Toggle (ChainOA style) */}
          <div className="hidden lg:flex items-center rounded-full bg-gray-100/90 p-1 text-xs font-semibold text-gray-600">
            <span className="rounded-full bg-white px-3.5 py-1.5 text-gray-900 shadow-sm">
              {tx('Borrowers')}
            </span>
            <a
              href="/#partners"
              onClick={(e) => handleNav('/#partners', e)}
              className="flex items-center gap-1 px-3.5 py-1.5 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <span>{tx('Lenders')}</span>
              <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2} />
            </a>
          </div>
        </div>

        {/* Center: Nav links */}
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="/#platform"
            onClick={(e) => handleNav('/#platform', e)}
            className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {tx('Platform')}
          </a>
          <a
            href="/#how-it-works"
            onClick={(e) => handleNav('/#how-it-works', e)}
            className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {tx('How it works')}
          </a>
          <a
            href="/#partners"
            onClick={(e) => handleNav('/#partners', e)}
            className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {tx('Partners')}
          </a>
          <a
            href="/#faq"
            onClick={(e) => handleNav('/#faq', e)}
            className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {tx('FAQ')}
          </a>
          <a
            href="/about"
            onClick={(e) => handleNav('/about', e)}
            className="text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {tx('About')}
          </a>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <LanguagePicker />
          <button
            type="button"
            onClick={() => setAppState('LOGIN')}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full text-[15px] font-medium text-gray-600 hover:text-gray-900 px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            {tx('Sign in')}
          </button>
          <button
            type="button"
            onClick={() => setAppState('REGISTER')}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-[#0d3d38] text-white text-sm font-semibold h-11 px-6 shadow-sm hover:bg-[#072522] transition-colors"
          >
            {tx('Apply now')} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </button>
        </div>

      </div>
    </nav>
  );
}
