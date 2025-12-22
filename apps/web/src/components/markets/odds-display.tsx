'use client';

import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type OddsVariant = 'liquid-scale' | 'compact';

interface OddsDisplayProps {
  yesPool: bigint;
  noPool: bigint;
  variant?: OddsVariant;
  size?: 'compact' | 'wide';
  showLabels?: boolean;
  className?: string;
}

/**
 * Liquid Scale Odds Visualization
 * 
 * A dynamic balance visualization where:
 * - Center = 50/50 equilibrium
 * - Left side = YES pool (fills with blue gradient)
 * - Right side = NO pool (fills with pink/orange gradient)
 * - Fulcrum shifts based on which side has more weight
 */
export function OddsDisplay({
  yesPool,
  noPool,
  variant = 'liquid-scale',
  size = 'wide',
  showLabels = true,
  className,
}: OddsDisplayProps) {
  // Calculate pool ratio (0 = all NO, 1 = all YES)
  const { yesPercent, noPercent, ratio } = useMemo(() => {
    const totalPool = yesPool + noPool;
    if (totalPool === 0n) {
      return { yesPercent: 50, noPercent: 50, ratio: 0.5 };
    }
    
    // Convert to numbers for percentage calculation
    // Safe for pools up to ~9 quadrillion (Number.MAX_SAFE_INTEGER)
    const yesNum = Number(yesPool);
    const totalNum = Number(totalPool);
    const ratioVal = yesNum / totalNum;
    
    return {
      yesPercent: Math.round(ratioVal * 100),
      noPercent: Math.round((1 - ratioVal) * 100),
      ratio: ratioVal,
    };
  }, [yesPool, noPool]);

  // Animate the ratio with spring physics
  const animatedRatio = useSpring(ratio, {
    stiffness: 100,
    damping: 20,
    mass: 0.5,
  });

  // Transform ratio to percentage for positioning (0% = far left, 100% = far right)
  const fulcrumPosition = useTransform(animatedRatio, [0, 1], [0, 100]);

  if (variant === 'compact') {
    return (
      <CompactOdds
        yesPercent={yesPercent}
        noPercent={noPercent}
        {...(className !== undefined && { className })}
      />
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-sky-medium">YES</span>
          <span className="text-sm font-semibold text-sunset-coral">NO</span>
        </div>
      )}

      {/* Scale Container */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl',
          size === 'wide' ? 'h-16' : 'h-10'
        )}
      >
        {/* Background gradient bar */}
        <div className="absolute inset-0 flex">
          {/* YES side (left) - blue gradient */}
          <motion.div
            className="h-full origin-left bg-gradient-to-r from-sky-medium to-sky-light"
            initial={{ width: '50%' }}
            animate={{ width: `${yesPercent}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
          
          {/* NO side (right) - pink/orange gradient */}
          <div className="h-full flex-1 bg-gradient-to-r from-sunset-orange to-sunset-pink" />
        </div>

        {/* Glass overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />

        {/* Fulcrum indicator */}
        <motion.div
          className="absolute top-0 bottom-0 w-1 -ml-0.5"
          initial={{ left: '50%' }}
          animate={{ left: `${yesPercent}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-4 h-4 bg-white rounded-full shadow-lg border-2 border-neutral-200" />
          </div>
        </motion.div>

        {/* Percentage labels inside bar */}
        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
          <motion.span
            className={cn(
              'font-mono font-bold text-white drop-shadow-md',
              size === 'wide' ? 'text-lg' : 'text-sm'
            )}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
          >
            {yesPercent}%
          </motion.span>
          <motion.span
            className={cn(
              'font-mono font-bold text-white drop-shadow-md',
              size === 'wide' ? 'text-lg' : 'text-sm'
            )}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
          >
            {noPercent}%
          </motion.span>
        </div>

        {/* Flowing particles toward heavier side */}
        <FlowingParticles direction={yesPercent >= 50 ? 'left' : 'right'} />
      </div>
    </div>
  );
}

/**
 * Compact variant for grid cards
 */
function CompactOdds({
  yesPercent,
  noPercent,
  className,
}: {
  yesPercent: number;
  noPercent: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* YES percentage */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-sky-medium to-sky-light" />
        <span className="font-mono text-sm font-semibold text-sky-deep">
          {yesPercent}%
        </span>
      </div>

      {/* Mini bar */}
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-neutral-200">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-sky-medium to-sky-light"
          initial={{ width: '50%' }}
          animate={{ width: `${yesPercent}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
      </div>

      {/* NO percentage */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm font-semibold text-sunset-coral">
          {noPercent}%
        </span>
        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-sunset-orange to-sunset-pink" />
      </div>
    </div>
  );
}

/**
 * Animated particles that flow toward the heavier side
 * SSR-safe: Only renders on client to avoid hydration mismatch
 */
function FlowingParticles({ direction }: { direction: 'left' | 'right' }) {
  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState<Array<{
    id: number;
    y: number;
    delay: number;
    duration: number;
    size: number;
  }>>([]);

  useEffect(() => {
    setMounted(true);
    setParticles(
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        y: 20 + Math.random() * 60,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 2,
        size: 3 + Math.random() * 4,
      }))
    );
  }, []);

  // Don't render particles on server
  if (!mounted) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-white/60"
          style={{
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            x: direction === 'left' ? ['100%', '0%'] : ['0%', '100%'],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}
