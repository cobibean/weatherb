'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type LoadingSpinnerSize = 'sm' | 'md' | 'lg';
type LoadingSpinnerVariant = 'default' | 'sunset' | 'sky' | 'minimal';

interface LoadingSpinnerProps {
  size?: LoadingSpinnerSize;
  variant?: LoadingSpinnerVariant;
  className?: string;
  label?: string;
}

const sizeConfig = {
  sm: {
    container: 'w-8 h-8',
    strokeWidth: 2,
    label: 'text-xs',
  },
  md: {
    container: 'w-12 h-12',
    strokeWidth: 2.5,
    label: 'text-sm',
  },
  lg: {
    container: 'w-16 h-16',
    strokeWidth: 3,
    label: 'text-base',
  },
};

/**
 * Premium loading spinner with subtle animations
 * Inspired by Apple's clean, minimal design language
 * Matches weatherB's sky/sunset aesthetic
 */
export function LoadingSpinner({
  size = 'md',
  variant = 'default',
  className,
  label,
}: LoadingSpinnerProps) {
  const config = sizeConfig[size];

  // Variant color configurations
  const variantStyles = {
    default: {
      gradient: ['#5BA5E5', '#87CEEB', '#FFB347'],
      glow: 'rgba(91, 165, 229, 0.2)',
    },
    sunset: {
      gradient: ['#FF9AB3', '#FFB347', '#FF8C94'],
      glow: 'rgba(255, 154, 179, 0.25)',
    },
    sky: {
      gradient: ['#87CEEB', '#5BA5E5', '#4A90D9'],
      glow: 'rgba(135, 206, 235, 0.2)',
    },
    minimal: {
      gradient: ['#B0B8C0', '#6B7280', '#374151'],
      glow: 'rgba(107, 114, 128, 0.15)',
    },
  };

  const colors = variantStyles[variant];

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      {/* Spinner with gradient stroke */}
      <div className={cn('relative', config.container)}>
        {/* Background glow effect */}
        <motion.div
          className="absolute inset-0 rounded-full blur-xl opacity-40"
          style={{
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0.3, 0.5, 0.3],
            scale: [0.95, 1.05, 0.95],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Main spinner */}
        <svg
          className={config.container}
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradient definition for stroke */}
            <linearGradient id={`gradient-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.gradient[0]} />
              <stop offset="50%" stopColor={colors.gradient[1]} />
              <stop offset="100%" stopColor={colors.gradient[2]} />
            </linearGradient>
          </defs>

          {/* Animated circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={`url(#gradient-${variant})`}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray="180 70"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              transformOrigin: '50% 50%',
            }}
          />
        </svg>
      </div>

      {/* Optional label */}
      {label && (
        <motion.p
          className={cn(
            'text-neutral-600 font-medium tracking-tight',
            config.label
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}

/**
 * Pulsing dots animation - alternative loading indicator
 * Perfect for inline loading states
 */
export function LoadingDots({
  className,
  variant = 'default',
}: {
  className?: string;
  variant?: LoadingSpinnerVariant;
}) {
  const variantStyles = {
    default: '#5BA5E5',
    sunset: '#FF9AB3',
    sky: '#87CEEB',
    minimal: '#6B7280',
  };

  const color = variantStyles[variant];

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton pulse for content loading
 * Mimics the shape of content while loading
 */
export function LoadingSkeleton({
  className,
  variant = 'default',
}: {
  className?: string;
  variant?: 'default' | 'card' | 'text';
}) {
  const baseClasses = 'rounded-xl bg-gradient-to-r from-cloud-soft via-neutral-100 to-cloud-soft bg-[length:200%_100%]';

  const variants = {
    default: 'h-4 w-full',
    card: 'h-32 w-full',
    text: 'h-3 w-3/4',
  };

  return (
    <motion.div
      className={cn(baseClasses, variants[variant], className)}
      animate={{
        backgroundPosition: ['0% 0%', '100% 0%'],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

/**
 * Full-page loading overlay
 * For global loading states
 */
export function LoadingOverlay({
  isLoading,
  label = 'Loading',
  variant = 'default',
}: {
  isLoading: boolean;
  label?: string;
  variant?: LoadingSpinnerVariant;
}) {
  if (!isLoading) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="rounded-2xl bg-white/95 backdrop-blur-xl px-8 py-10 shadow-glass-lg border border-white/50"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        <LoadingSpinner size="lg" variant={variant} label={label} />
      </motion.div>
    </motion.div>
  );
}

/**
 * Inline loading state
 * For buttons and small UI elements
 * Simple, contained spinner without glow effects
 */
export function InlineLoader({
  variant = 'minimal',
  size = 'sm',
}: {
  variant?: LoadingSpinnerVariant;
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  // Simplified color mapping for inline use
  const variantStyles = {
    default: '#5BA5E5',    // Sky blue - for light backgrounds
    sunset: '#FF9AB3',      // Sunset pink - for light backgrounds
    sky: '#87CEEB',         // Light blue - for light backgrounds
    minimal: '#FFFFFF',     // White - for colored button backgrounds (primary, sunset, etc)
  };

  const color = variantStyles[variant];

  return (
    <svg
      className={cn('inline-block', sizeClass)}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="42 14"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          transformOrigin: '50% 50%',
        }}
      />
    </svg>
  );
}
