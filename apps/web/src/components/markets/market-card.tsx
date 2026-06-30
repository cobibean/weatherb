'use client';

import { motion } from 'framer-motion';
import type { Market } from '@weatherb/shared/types';
import { cn } from '@/lib/utils';
import { OddsDisplay } from './odds-display';
import { Countdown } from './countdown';
import { ParticleSystem } from '@/components/ui/particle-system';
import { ThresholdTooltip } from '@/components/ui/threshold-tooltip';
import { TemperatureDisplay } from '@/components/ui/temperature-display';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';

interface MarketCardProps {
  market: Market;
  onBetYes: () => void;
  onBetNo: () => void;
  className?: string;
}

/**
 * Compact market card for grid display
 * Shows essential info with hover effects and particles
 */
export function MarketCard({ market, onBetYes, onBetNo, className }: MarketCardProps) {
  const thresholdDisplay = Math.round(market.thresholdF_tenths / 10);
  const isClosed = market.status === 'closed';

  return (
    <motion.article
      className={cn(
        'group relative card grain-overlay overflow-hidden',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Hover particles */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <ParticleSystem count={4} type="sparkle" animate />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header: City + Threshold */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display text-xl font-bold text-neutral-800 mb-1 tracking-tight">
              {market.cityName}
            </h3>
            <p className="font-body text-sm text-neutral-600">
              Will it be <ThresholdTooltip threshold={thresholdDisplay} />{' '}
              <TemperatureDisplay fahrenheit={thresholdDisplay} size="sm" />?
            </p>
          </div>
        </div>

        {/* Odds Display - Compact variant with multipliers */}
        <div className="mb-4">
          <OddsDisplay
            yesPool={market.yesPool}
            noPool={market.noPool}
            variant="compact"
            showMultipliers
          />
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-2 mb-5 text-neutral-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">Resolves in:</span>
          <Countdown resolveTime={market.resolveTime} size="sm" className="text-neutral-800" />
        </div>

        {/* Bet buttons or closed message */}
        {isClosed ? (
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs font-medium text-amber-800">Betting Closed</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <InteractiveHoverButton
              text="YES"
              variant="yes"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onBetYes();
              }}
              fullWidth
            />
            <InteractiveHoverButton
              text="NO"
              variant="no"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onBetNo();
              }}
              fullWidth
            />
          </div>
        )}
      </div>
    </motion.article>
  );
}

