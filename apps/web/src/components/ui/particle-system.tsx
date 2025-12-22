'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useMemo } from 'react';

type ParticleType = 'cloud' | 'sparkle';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface ParticleSystemProps {
  count?: number;
  type?: ParticleType;
  className?: string;
  /** Area width in pixels (default: 100% of container) */
  width?: number;
  /** Area height in pixels (default: 100% of container) */
  height?: number;
  /** Enable continuous floating animation */
  animate?: boolean;
}

/**
 * Particle system for ethereal micro-interactions
 * Displays floating clouds or sparkles with smooth animations
 */
export function ParticleSystem({
  count = 5,
  type = 'cloud',
  className = '',
  width = 100,
  height = 100,
  animate = true,
}: ParticleSystemProps) {
  // Generate random particles
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      size: type === 'cloud' ? 32 + Math.random() * 32 : 16 + Math.random() * 16,
      duration: 3 + Math.random() * 4, // 3-7 seconds
      delay: Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.4, // 0.3-0.7
    }));
  }, [count, width, height, type]);

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
            <CloudParticle size={particle.size} />
          ) : (
            <SparkleParticle size={particle.size} />
          )}
        </motion.div>
      ))}
    </div>
  );
}

function CloudParticle({ size }: { size: number }) {
  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
      }}
    >
      {/* Using the combined SVG for now - will optimize later */}
      <Image
        src="/particles/cloudsvg1.svg"
        alt=""
        width={size}
        height={size}
        className="opacity-60 blur-[0.5px]"
        priority={false}
      />
    </div>
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
      <div className="absolute inset-0 bg-gradient-to-br from-sky-300 to-orange-200 rounded-full blur-sm" />
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
