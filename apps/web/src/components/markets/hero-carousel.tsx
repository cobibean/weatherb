'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { Market } from '@weatherb/shared/types';
import { cn } from '@/lib/utils';
import { HeroCard } from './hero-card';
import { ParticleSystem } from '@/components/ui/particle-system';

interface HeroCarouselProps {
  markets: Market[];
  onBetYes: (market: Market) => void;
  onBetNo: (market: Market) => void;
  autoPlayInterval?: number;
  className?: string;
}

/**
 * Hero section carousel showcasing featured markets
 * Cycles through markets with smooth transitions and cloud particles
 */
export function HeroCarousel({
  markets,
  onBetYes,
  onBetNo,
  autoPlayInterval = 8000,
  className,
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % markets.length);
  }, [markets.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + markets.length) % markets.length);
  }, [markets.length]);

  // Auto-play
  useEffect(() => {
    if (isPaused || markets.length <= 1) return;

    const timer = setInterval(goToNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isPaused, autoPlayInterval, goToNext, markets.length]);

  if (markets.length === 0) {
    return (
      <div className={cn('relative min-h-[500px] flex items-center justify-center', className)}>
        <p className="text-neutral-500">No markets available</p>
      </div>
    );
  }

  const currentMarket = markets[currentIndex];
  
  // Guard against undefined market (shouldn't happen, but TypeScript needs assurance)
  if (!currentMarket) {
    return (
      <div className={cn('relative min-h-[500px] flex items-center justify-center', className)}>
        <p className="text-neutral-500">Loading market...</p>
      </div>
    );
  }

  return (
    <section
      className={cn('relative overflow-hidden', className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/backgrounds/hero-clouds.jpg"
          alt="Sky background"
          fill
          className="object-cover"
          priority
          quality={85}
        />
        {/* Dark gradient overlay at top for hero text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-transparent" />
        {/* Light gradient at bottom for card readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent" />
      </div>

      {/* Floating cloud particles */}
      <ParticleSystem
        count={6}
        type="cloud"
        animate
        className="opacity-40"
      />

      {/* Content container - fits in viewport */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-24 pb-8 md:pt-28 md:pb-12 min-h-screen flex flex-col justify-center">
        {/* Hero title */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 
            className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold mb-3 tracking-tight"
            style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)' }}
          >
            <span className="text-white">Call the</span>
            {' '}
            <span 
              style={{ 
                color: '#FF9AB3',
                textShadow: '0 0 30px rgba(255,154,179,0.6), 0 4px 20px rgba(0,0,0,0.5)' 
              }}
            >
              Temp
            </span>
          </h1>
          <p 
            className="font-body text-lg md:text-xl text-white max-w-lg mx-auto font-semibold"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)' }}
          >
            YES/NO bets on weather.
          </p>
        </motion.div>

        {/* Carousel */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMarket.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <HeroCard
                market={currentMarket}
                onBetYes={() => onBetYes(currentMarket)}
                onBetNo={() => onBetNo(currentMarket)}
              />
            </motion.div>
          </AnimatePresence>

          {/* Navigation arrows - positioned outside the card with breathing room */}
          {markets.length > 1 && (
            <>
              <button
                onClick={goToPrev}
                className="absolute -left-6 md:-left-20 top-1/2 -translate-y-1/2 p-3 rounded-full glass hover:bg-white/80 transition-colors focus-ring"
                aria-label="Previous market"
              >
                <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNext}
                className="absolute -right-6 md:-right-20 top-1/2 -translate-y-1/2 p-3 rounded-full glass hover:bg-white/80 transition-colors focus-ring"
                aria-label="Next market"
              >
                <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Dot indicators */}
        {markets.length > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {markets.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-300 focus-ring',
                  index === currentIndex
                    ? 'bg-sky-medium w-8'
                    : 'bg-neutral-300 hover:bg-neutral-400'
                )}
                aria-label={`Go to market ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
