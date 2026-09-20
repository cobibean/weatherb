'use client';
import type { Market } from '@weatherb/shared/types';
import { useClientClock } from '@/hooks/use-client-clock';
import { OutcomePanel } from './outcome-panel';
import { bettingCloseTime, canBet, marketTime } from './market-presentation';

export function MarketCard({
  market,
  onBetYes,
  onBetNo,
  featured = false,
  className = '',
}: {
  market: Market;
  onBetYes: () => void;
  onBetNo: () => void;
  featured?: boolean;
  className?: string;
}): React.ReactElement {
  const now = useClientClock();
  return (
    <article className={`wb-market-card ${className}`} data-featured={featured || undefined}>
      <div className="wb-card-top">
        <p className="wb-eyebrow">{market.cityName}</p>
        {featured && <span className="wb-featured-tag">Featured above</span>}
      </div>
      <h3>
        Will {market.cityName} be {Math.round(market.thresholdF_tenths / 10)}°F or higher?
      </h3>
      <p className="wb-card-time">
        {now > 0 && !canBet(market, now)
          ? `Resolves ${marketTime(market)}`
          : `Betting closes ${marketTime(market, bettingCloseTime(market))}`}
      </p>
      <OutcomePanel market={market} onBetYes={onBetYes} onBetNo={onBetNo} compact />
    </article>
  );
}
