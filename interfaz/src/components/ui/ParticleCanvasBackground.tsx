import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ParticleCanvasBackgroundProps {
  className?: string;
  dotSize?: number;
  gap?: number;
}

export const ParticleCanvasBackground: React.FC<ParticleCanvasBackgroundProps> = ({
  className,
  dotSize = 1,
  gap = 3.5,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderStaticDots = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const width = rect.width;
      const height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Read current text color (from CSS)
      const style = getComputedStyle(canvas);
      ctx.fillStyle = style.color || 'currentColor';

      // Seeded/pseudo-random deterministic micro-stippling pattern
      const cols = Math.ceil(width / gap);
      const rows = Math.ceil(height / gap);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          // Pseudo-random distribution
          const seed = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
          const rand = seed - Math.floor(seed);

          // Render balanced subtle density
          if (rand > 0.38) {
            const alpha = 0.12 + (rand - 0.38) * 0.52; // Alpha between ~0.12 and ~0.44
            ctx.globalAlpha = Math.min(1, alpha);
            ctx.fillRect(i * gap, j * gap, dotSize, dotSize);
          }
        }
      }

      ctx.restore();
    };

    const resizeObserver = new ResizeObserver(() => {
      renderStaticDots();
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    renderStaticDots();

    // Listen for theme change class mutations on <html> or <body>
    const themeObserver = new MutationObserver(() => {
      renderStaticDots();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [dotSize, gap]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full text-zinc-900/60 dark:text-zinc-100/65',
        '[mask-image:linear-gradient(to_bottom,black_15%,transparent_70%)]',
        className
      )}
    />
  );
};
