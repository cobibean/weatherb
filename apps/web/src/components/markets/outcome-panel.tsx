'use client';
import type { Market } from '@weatherb/shared/types';
import { formatMultiplier, getImpliedMultipliers } from '@weatherb/shared/utils/payout';
import { useClientClock } from '@/hooks/use-client-clock';
import { canBet } from './market-presentation';

export function OutcomePanel({
  market,
  onBetYes,
  onBetNo,
  compact = false,
  feeBps,
}: {
  market: Market;
  onBetYes: () => void;
  onBetNo: () => void;
  compact?: boolean;
  feeBps?: bigint | undefined;
}): React.ReactElement {
  const now = useClientClock();
  const enabled = canBet(market, now);
  const total = market.yesPool + market.noPool;
  const yes = total === 0n ? 50 : Number((market.yesPool * 100n + total / 2n) / total);
  const multipliers =
    feeBps !== undefined ? getImpliedMultipliers(market.yesPool, market.noPool, feeBps) : null;
  return (
    <div className={compact ? 'wb-outcomes wb-outcomes--compact' : 'wb-outcomes'}>
      {!compact && <p className="wb-pool-label">Pool share</p>}
      <div className="wb-pool-bar" aria-hidden="true">
        <span style={{ width: `${yes}%` }} />
      </div>
      <div className="wb-pool-labels">
        <span className="wb-yes">
          <strong>{total === 0n ? '—' : `${yes}%`}</strong> YES
        </span>
        <span className="wb-no">
          <strong>{total === 0n ? '—' : `${100 - yes}%`}</strong> NO
        </span>
      </div>
      {total === 0n && <p className="wb-empty-pool">No bets yet. Be the first.</p>}
      <div className="wb-outcome-actions">
        {(['yes', 'no'] as const).map((side) => (
          <div key={side}>
            {!compact && (
              <p className="wb-return">
                Est. return{' '}
                <strong className={side === 'yes' ? 'wb-yes' : 'wb-no'}>
                  {multipliers
                    ? formatMultiplier(
                        side === 'yes' ? multipliers.yesMultiplier : multipliers.noMultiplier,
                      )
                    : '—'}
                </strong>
              </p>
            )}
            <button
              type="button"
              className={`wb-outcome${compact ? ' wb-outcome--compact' : ''}`}
              data-side={side}
              disabled={!enabled}
              onClick={() => {
                if (canBet(market, Date.now())) (side === 'yes' ? onBetYes : onBetNo)();
              }}
            >
              Bet {side.toUpperCase()}
            </button>
          </div>
        ))}
      </div>
      {now > 0 && !enabled && <p className="wb-closed">Betting closed · Awaiting resolution</p>}
    </div>
  );
}
