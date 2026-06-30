'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountdownProps {
  resolveTime: number; // Unix timestamp in ms
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

function calculateTimeLeft(resolveTime: number, now: number): TimeLeft {
  const difference = resolveTime - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    isExpired: false,
  };
}

// Stable initial state for SSR - shows placeholder until client hydrates
const INITIAL_TIME_LEFT: TimeLeft = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  isExpired: false,
};

export function Countdown({ resolveTime, className, size = 'md' }: CountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(INITIAL_TIME_LEFT);

  useEffect(() => {
    setMounted(true);
    // Calculate initial time on mount
    setTimeLeft(calculateTimeLeft(resolveTime, Date.now()));
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(resolveTime, Date.now()));
    }, 1000);

    return () => clearInterval(timer);
  }, [resolveTime]);

  // Show loading placeholder on server
  if (!mounted) {
    return (
      <span className={cn('font-mono font-medium text-neutral-400', className)}>
        --:--
      </span>
    );
  }

  if (timeLeft.isExpired) {
    return (
      <span className={cn('font-medium text-sunset-coral', className)}>
        Resolving...
      </span>
    );
  }

  // Format the countdown based on time remaining
  const formatTime = (): string => {
    if (timeLeft.days > 0) {
      return `${timeLeft.days}d ${timeLeft.hours}h`;
    }
    if (timeLeft.hours > 0) {
      return `${timeLeft.hours}h ${timeLeft.minutes}m`;
    }
    if (timeLeft.minutes > 0) {
      return `${timeLeft.minutes}m ${timeLeft.seconds}s`;
    }
    return `${timeLeft.seconds}s`;
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <span className={cn('font-mono font-medium', sizeClasses[size], className)}>
      {formatTime()}
    </span>
  );
}

/**
 * Detailed countdown with individual units displayed
 */
export function CountdownDetailed({ resolveTime, className }: CountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(INITIAL_TIME_LEFT);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(calculateTimeLeft(resolveTime, Date.now()));
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(resolveTime, Date.now()));
    }, 1000);

    return () => clearInterval(timer);
  }, [resolveTime]);

  // Show loading placeholder on server
  if (!mounted) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {['hrs', 'min', 'sec'].map((label, index) => (
          <div key={label} className="flex items-baseline gap-1">
            <span className="font-mono text-lg font-bold text-neutral-400">--</span>
            <span className="text-xs uppercase text-neutral-500">{label}</span>
            {index < 2 && <span className="text-neutral-400 ml-1">:</span>}
          </div>
        ))}
      </div>
    );
  }

  if (timeLeft.isExpired) {
    return (
      <div className={cn('text-center text-sunset-coral font-medium', className)}>
        Resolving...
      </div>
    );
  }

  const units = [
    { value: timeLeft.days, label: 'days' },
    { value: timeLeft.hours, label: 'hrs' },
    { value: timeLeft.minutes, label: 'min' },
    { value: timeLeft.seconds, label: 'sec' },
  ].filter((unit, index) => {
    // Show days only if > 0, always show hours, minutes, seconds
    if (index === 0) return unit.value > 0;
    return true;
  });

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {units.map((unit, index) => (
        <div key={unit.label} className="flex items-baseline gap-1">
          <span className="font-mono text-lg font-bold text-neutral-800">
            {unit.value.toString().padStart(2, '0')}
          </span>
          <span className="text-xs uppercase text-neutral-500">{unit.label}</span>
          {index < units.length - 1 && (
            <span className="text-neutral-400 ml-1">:</span>
          )}
        </div>
      ))}
    </div>
  );
}
