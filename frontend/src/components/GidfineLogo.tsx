interface GidfineLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  onDark?: boolean;
  variant?: 'duotone' | 'mint' | 'teal' | 'white';
}

export default function GidfineLogo({
  className = '',
  size = 28,
  showWordmark = true,
  onDark = false,
  variant = 'duotone',
}: GidfineLogoProps) {
  // Determine block colors based on variant and onDark
  let baseColor = onDark ? '#ffffff' : '#0d3d38';
  let spurColor = '#38c9c0'; // signature electric mint gateway

  if (variant === 'mint') {
    baseColor = '#38c9c0';
    spurColor = '#38c9c0';
  } else if (variant === 'teal') {
    baseColor = '#0d3d38';
    spurColor = '#0d3d38';
  } else if (variant === 'white') {
    baseColor = '#ffffff';
    spurColor = '#ffffff';
  } else if (variant === 'duotone') {
    baseColor = onDark ? '#ffffff' : '#0d3d38';
    spurColor = '#38c9c0';
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Gidfine Precision Geometric "G" Mark (ChainOA Modular Block System) */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
        aria-hidden="true"
      >
        {/* Top Bar: Speed & Accessibility */}
        <rect x="14" y="3" width="20" height="8" rx="2.8" fill={baseColor} />
        
        {/* Left Spine: Infrastructure & Multi-lender Tenancy */}
        <rect x="2" y="14" width="9" height="8" rx="2.8" fill={baseColor} />
        
        {/* Inward Spur: The Signature "G" Credit Gateway */}
        <rect x="19" y="14" width="15" height="8" rx="2.8" fill={spurColor} />
        
        {/* Bottom Bar: Institutional Foundation */}
        <rect x="14" y="25" width="20" height="8" rx="2.8" fill={baseColor} />
      </svg>

      {/* Wordmark */}
      {showWordmark && (
        <span
          className={`text-[20px] font-bold tracking-tight font-sans ${
            onDark ? 'text-white' : 'text-gray-950'
          }`}
        >
          Gidfine<span className={onDark ? 'text-[#38c9c0]' : 'text-[#0d3d38]'}>.gh</span>
        </span>
      )}
    </div>
  );
}
