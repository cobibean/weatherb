'use client';

import { motion } from 'framer-motion';
import type { Market } from '@weatherb/shared/types';
import { cn } from '@/lib/utils';
import { OddsDisplay } from './odds-display';
import { CountdownDetailed } from './countdown';
import { formatEther } from 'viem';
import { ThresholdTooltip } from '@/components/ui/threshold-tooltip';
import { TemperatureDisplay } from '@/components/ui/temperature-display';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';

interface HeroCardProps {
  market: Market;
  onBetYes: () => void;
  onBetNo: () => void;
  className?: string;
}

/**
 * Wide hero card for carousel display
 * Shows detailed market info with large Liquid Scale odds
 */
export function HeroCard({ market, onBetYes, onBetNo, className }: HeroCardProps) {
  const thresholdDisplay = Math.round(market.thresholdF_tenths / 10);
  const totalPool = market.yesPool + market.noPool;
  const totalPoolFormatted = Number(formatEther(totalPool)).toFixed(0);
  
  // Format resolve time
  const resolveDate = new Date(market.resolveTime);
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <motion.div
      className={cn(
        'card-hero relative overflow-hidden grain-overlay',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* City name */}
      <h2 className="font-display text-3xl md:text-4xl font-extrabold text-neutral-800 mb-1 tracking-tight">
        {market.cityName}
      </h2>

      {/* Question */}
      <p className="font-body text-base md:text-lg text-neutral-600 mb-0.5">
        Will it be <ThresholdTooltip threshold={thresholdDisplay} />{' '}
        <TemperatureDisplay fahrenheit={thresholdDisplay} size="lg" className="font-bold" />?
      </p>

      {/* Resolve time */}
      <p className="font-body text-xs md:text-sm text-neutral-500 mb-4">
        Resolves: {timeFormatter.format(resolveDate)}
      </p>

      {/* Countdown */}
      <div className="mb-4">
        <span className="font-body text-xs uppercase tracking-widest text-neutral-500 mb-1 block font-semibold">
          Time Remaining
        </span>
        <CountdownDetailed resolveTime={market.resolveTime} />
      </div>

      {/* Odds Display with multipliers */}
      <div className="mb-5">
        <OddsDisplay
          yesPool={market.yesPool}
          noPool={market.noPool}
          variant="liquid-scale"
          size="wide"
          showMultipliers
        />
      </div>

      {/* Bottom row: Pool info + Bet buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Total pool */}
        <div className="flex items-center gap-2">
          <span className="text-xs md:text-sm text-neutral-500">Total Pool:</span>
          <span className="font-mono font-bold text-base md:text-lg text-neutral-800">
            {totalPoolFormatted} FLR
          </span>
        </div>

        {/* Bet buttons */}
        <div className="flex gap-3 w-full sm:w-auto">
          <InteractiveHoverButton
            text="Bet YES"
            variant="yes"
            size="md"
            onClick={onBetYes}
            className="flex-1 sm:flex-none"
          />
          <InteractiveHoverButton
            text="Bet NO"
            variant="no"
            size="md"
            onClick={onBetNo}
            className="flex-1 sm:flex-none"
          />
        </div>
      </div>
    </motion.div>
  );
}

