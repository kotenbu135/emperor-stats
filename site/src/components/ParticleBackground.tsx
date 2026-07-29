import React from 'react';

interface Particle {
  id: number;
  size: number;
  left: number;
  duration: number;
  delay: number;
}

// Pre-generate particles deterministically to avoid useEffect state re-renders
const STATIC_PARTICLES: Particle[] = Array.from({ length: 24 }, (_, i) => {
  // Use pseudo-random algorithm seeded by index for consistency
  const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  };

  return {
    id: i,
    size: Number((pseudoRandom(i * 1.1) * 3.5 + 1.5).toFixed(1)),
    left: Number((pseudoRandom(i * 2.3) * 100).toFixed(1)),
    duration: Number((pseudoRandom(i * 3.7) * 16 + 14).toFixed(1)),
    delay: -Number((pseudoRandom(i * 4.9) * 20).toFixed(1)),
  };
});

export const ParticleBackground: React.FC = React.memo(() => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Pattern Grid Overlay */}
      <div className="pattern-overlay" />

      {/* Floating Particles */}
      <div className="absolute inset-0">
        {STATIC_PARTICLES.map((p) => (
          <div
            key={p.id}
            className="absolute bg-[#cca72f] rounded-full opacity-30"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}vw`,
              bottom: `-20px`,
              animation: `floatUp ${p.duration}s infinite linear`,
              animationDelay: `${p.delay}s`,
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>
    </div>
  );
});

ParticleBackground.displayName = 'ParticleBackground';
