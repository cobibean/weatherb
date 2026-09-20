'use client';
import type { Market } from '@weatherb/shared/types';
import { formatUsdc } from '@weatherb/shared/utils/payout';
import { useArcSettings } from '@/lib/arc-wallet';
import { useClientClock } from '@/hooks/use-client-clock';
import { HowWeatherbWorksModal } from '@/components/home/how-weatherb-works-modal';
import { OutcomePanel } from './outcome-panel';
import { bettingCloseTime, marketTime } from './market-presentation';

export function HeroCard({
  market,
  onBetYes,
  onBetNo,
  className = '',
}: {
  market: Market;
  onBetYes: () => void;
  onBetNo: () => void;
  className?: string;
}): React.ReactElement {
  const now = useClientClock();
  const settings = useArcSettings();
  const threshold = Math.round(market.thresholdF_tenths / 10);
  const remaining = Math.max(0, Math.floor((bettingCloseTime(market) - now) / 1000));
  const closed = market.status !== 'open' || (now > 0 && remaining === 0);
  const time =
    now === 0
      ? '—'
      : remaining >= 3600
        ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`
        : `${Math.floor(remaining / 60)
            .toString()
            .padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
  return (
    <article
      className={`wb-hero-card ${className}`}
      aria-label={`${market.cityName} featured market`}
    >
      <div className="wb-hero-heading">
        <div>
          <p className="wb-eyebrow">{market.cityName}</p>
          <p className="wb-temperature">
            {threshold}°F <span>or higher</span>
          </p>
          <h1>
            Will {market.cityName} be {threshold}°F or higher?
          </h1>
          <p className="wb-resolves">Resolves {marketTime(market)}</p>
        </div>
        <div className="wb-deadline">
          <span>{closed ? 'Betting closed' : 'Betting closes in'}</span>
          <strong>{closed ? 'Awaiting resolution' : time}</strong>
        </div>
      </div>
      <OutcomePanel
        feeBps={settings?.feeBps}
        market={market}
        onBetYes={onBetYes}
        onBetNo={onBetNo}
      />
      <div className="wb-hero-meta">
        <p>
          Total pool <strong>{formatUsdc(market.yesPool + market.noPool, 2)} USDC</strong>
        </p>
        <HowWeatherbWorksModal />
      </div>
    </article>
  );
}
