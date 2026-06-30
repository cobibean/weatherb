'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type ParticleType = 'cloud' | 'sparkle';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  cloudIndex: number; // Which cloud sprite to show (0-8)
}

interface ParticleSystemProps {
  count?: number;
  type?: ParticleType;
  className?: string;
  /** Area width in percentage (default: 100) */
  width?: number;
  /** Area height in percentage (default: 100) */
  height?: number;
  /** Enable continuous floating animation */
  animate?: boolean;
}

// Seeded random for deterministic SSR (particles generate client-side only)
function generateParticles(
  count: number,
  width: number,
  height: number,
  type: ParticleType
): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * width,
    y: Math.random() * height,
    size: type === 'cloud' ? 48 + Math.random() * 48 : 16 + Math.random() * 16,
    duration: 3 + Math.random() * 4, // 3-7 seconds
    delay: Math.random() * 2,
    opacity: 0.4 + Math.random() * 0.3, // 0.4-0.7
    cloudIndex: Math.floor(Math.random() * 9), // 9 cloud sprites available
  }));
}

/**
 * Particle system for ethereal micro-interactions
 * Displays floating clouds or sparkles with smooth animations
 * 
 * SSR-safe: Particles are generated client-side only to avoid hydration mismatch
 */
export function ParticleSystem({
  count = 5,
  type = 'cloud',
  className = '',
  width = 100,
  height = 100,
  animate = true,
}: ParticleSystemProps) {
  // Generate particles only on client to avoid hydration mismatch
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setParticles(generateParticles(count, width, height, type));
  }, [count, width, height, type]);

  // Don't render anything on server - particles are decorative
  if (!mounted) {
    return null;
  }

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={
            animate
              ? {
                  opacity: [particle.opacity, particle.opacity * 1.2, particle.opacity],
                  y: [0, -10, 0],
                  scale: [1, 1.05, 1],
                }
              : { opacity: particle.opacity, scale: 1 }
          }
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut',
          }}
        >
          {type === 'cloud' ? (
            <CloudParticle size={particle.size} cloudIndex={particle.cloudIndex} />
          ) : (
            <SparkleParticle size={particle.size} />
          )}
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Individual cloud particle using CSS-based cloud shape
 * No longer uses the SVG sprite sheet to avoid the rendering issue
 */
function CloudParticle({ size, cloudIndex }: { size: number; cloudIndex: number }) {
  // Use CSS to create soft cloud shapes with varying styles
  const cloudStyles = [
    'rounded-[40%_60%_60%_40%/60%_40%_60%_40%]',
    'rounded-[50%_50%_40%_60%/40%_60%_50%_50%]',
    'rounded-[60%_40%_50%_50%/50%_50%_40%_60%]',
    'rounded-[45%_55%_55%_45%/55%_45%_55%_45%]',
    'rounded-[55%_45%_45%_55%/45%_55%_45%_55%]',
    'rounded-[50%_60%_40%_50%/40%_50%_60%_50%]',
    'rounded-[40%_50%_60%_50%/50%_60%_50%_40%]',
    'rounded-[60%_50%_50%_40%/50%_40%_50%_60%]',
    'rounded-[45%_60%_55%_40%/55%_40%_45%_60%]',
  ];
  
  const cloudStyle = cloudStyles[cloudIndex % cloudStyles.length];
  
  return (
    <div
      className={`relative ${cloudStyle}`}
      style={{
        width: size,
        height: size * 0.6,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(248,251,255,0.7) 100%)',
        boxShadow: '0 4px 12px rgba(91, 165, 229, 0.15)',
        filter: 'blur(1px)',
      }}
    />
  );
}

function SparkleParticle({ size }: { size: number }) {
  return (
    <motion.div
      className="relative"
      style={{
        width: size,
        height: size,
      }}
      animate={{
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {/* Simple sparkle using CSS */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-light to-sunset-orange rounded-full blur-sm" />
      <div
        className="absolute inset-0 bg-white rounded-full"
        style={{
          transform: 'scale(0.6)',
          boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
        }}
      />
    </motion.div>
  );
}
