import { useEffect, useRef, useState } from 'react';

interface ScrollScrubTextProps {
  text: string;
  className?: string;
  bgClassName?: string;
}

export default function ScrollScrubText({
  text,
  className = '',
  bgClassName = 'bg-[#edf3f2]',
}: ScrollScrubTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Start illuminating when top enters 80% of screen
      // Finish when top reaches 20% of screen
      const start = windowHeight * 0.82;
      const end = windowHeight * 0.22;

      const rawProgress = (start - rect.top) / (start - end);
      const clamped = Math.min(Math.max(rawProgress, 0), 1);
      setProgress(clamped);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const words = text.split(/\s+/);
  const total = words.length;

  return (
    <section className={`px-6 py-24 sm:py-32 md:py-40 transition-colors duration-500 border-y border-gray-200/60 ${bgClassName}`}>
      <div ref={containerRef} className="mx-auto max-w-4xl">
        <p className={`text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-bold tracking-tight leading-[1.18] select-none ${className}`}>
          {words.map((word, i) => {
            // Word activation window
            const startPoint = i / total;
            const endPoint = (i + 1) / total;

            let wordOpacity = 0.18;
            if (progress >= endPoint) {
              wordOpacity = 1;
            } else if (progress > startPoint) {
              wordOpacity = 0.18 + ((progress - startPoint) / (endPoint - startPoint)) * 0.82;
            }

            return (
              <span
                key={i}
                className="inline-block transition-opacity duration-150 mr-[0.26em] will-change-transform"
                style={{
                  opacity: wordOpacity,
                  color: wordOpacity > 0.6 ? '#0a2220' : '#143834',
                }}
              >
                {word}
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
