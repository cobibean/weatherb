'use client';

import { motion } from 'framer-motion';
import type { Market } from '@weatherb/shared/types';
import { cn } from '@/lib/utils';
import { MarketCard } from './market-card';

interface MarketGridProps {
  markets: Market[];
  onBetYes: (market: Market) => void;
  onBetNo: (market: Market) => void;
  className?: string;
}

/**
 * Responsive grid layout for market cards
 * Staggered animation on initial load
 */
export function MarketGrid({ markets, onBetYes, onBetNo, className }: MarketGridProps) {
  if (markets.length === 0) {
    return (
      <div className={cn('py-16 text-center', className)}>
        <p className="text-neutral-500 text-lg">No active markets available</p>
      </div>
    );
  }

  return (
    <section className={cn('py-12', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold text-neutral-800">All Markets</h2>
          <p className="text-neutral-600 mt-1">
            {markets.length} active {markets.length === 1 ? 'market' : 'markets'}
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
        >
          {markets.map((market, index) => (
            <motion.div
              key={market.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <MarketCard
                market={market}
                onBetYes={() => onBetYes(market)}
                onBetNo={() => onBetNo(market)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

