import React, { useEffect, useRef, useState } from 'react';

interface DepthCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
}

/**
 * Subtle hardware-accelerated 3D perspective card.
 * Responds only to fine pointer hover on desktop and disables under prefers-reduced-motion.
 */
export const DepthCard: React.FC<DepthCardProps> = ({
  children,
  className = '',
  maxTilt = 4,
  glare = true,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [transform, setTransform] = useState(
    'perspective(1100px) rotateX(0deg) rotateY(0deg) translateZ(0px)'
  );
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, active: false });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || e.pointerType !== 'mouse') return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * maxTilt * 2;
    const rotateX = (0.5 - py) * maxTilt * 2;

    setTransform(
      `perspective(1100px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(6px)`
    );
    if (glare) {
      setGlarePos({ x: px * 100, y: py * 100, active: true });
    }
  };

  const handlePointerLeave = () => {
    setTransform('perspective(1100px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
    setGlarePos((prev) => ({ ...prev, active: false }));
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={
        reducedMotion
          ? undefined
          : {
              transform,
              transformStyle: 'preserve-3d',
              transition: glarePos.active
                ? 'transform 110ms cubic-bezier(0.16, 1, 0.3, 1)'
                : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
            }
      }
      className={`relative will-change-transform ${className}`}
    >
      {glare && !reducedMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-200 z-10"
          style={{
            opacity: glarePos.active ? 1 : 0,
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(14, 165, 233, 0.14), transparent 58%)`,
          }}
        />
      )}
      {children}
    </div>
  );
};
