'use client';
import type { Market } from '@weatherb/shared/types';
import { MarketCard } from './market-card';
export function MarketGrid({
  markets,
  onBetYes,
  onBetNo,
  selectedId,
  className = '',
}: {
  markets: Market[];
  onBetYes: (market: Market) => void;
  onBetNo: (market: Market) => void;
  selectedId?: string | undefined;
  className?: string;
}): React.ReactElement | null {
  if (markets.length <= 1) return null;
  return (
    <section id="active-markets" className={`wb-shell wb-market-collection ${className}`}>
      <div className="wb-collection-title">
        <h2>All active markets</h2>
        <span>{markets.length} markets</span>
      </div>
      <div className="wb-market-grid">
        {markets.map((market) => (
          <MarketCard
            key={market.id}
            market={market}
            featured={market.id === selectedId}
            onBetYes={() => onBetYes(market)}
            onBetNo={() => onBetNo(market)}
          />
        ))}
      </div>
    </section>
  );
}
