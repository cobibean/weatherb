'use client';

import { formatEther } from 'viem';
import type { UserStats } from '@/types/positions';

interface StatsCardsProps {
  stats: UserStats;
  onClaimAll?: (() => void) | undefined;
}

export function StatsCards({ stats, onClaimAll }: StatsCardsProps): React.ReactElement {
  const claimable = Number(formatEther(stats.totalClaimable));
  const profit = Number(formatEther(stats.netProfit));
  const positive = profit >= 0;
  return (
    <div className="wb-stats">
      <div className="wb-stat">
        <span>Total claimable</span>
        <strong>
          {claimable.toFixed(3)} <small>USDC</small>
        </strong>
        {stats.totalClaimable > 0n && onClaimAll ? (
          <button className="wb-outcome wb-outcome--compact" onClick={onClaimAll}>
            Claim all
          </button>
        ) : (
          <p>No available payouts</p>
        )}
      </div>
      <div className="wb-stat">
        <span>Active bets</span>
        <strong>{stats.activeBets}</strong>
        <p>
          {stats.activeBets === 0
            ? 'No pending bets'
            : `${stats.activeBets} market${stats.activeBets === 1 ? '' : 's'} awaiting resolution`}
        </p>
      </div>
      <div className="wb-stat">
        <span>Win rate</span>
        <strong>{stats.resolvedBets > 0 ? `${stats.winRate.toFixed(0)}%` : '—'}</strong>
        <p>
          {stats.resolvedBets > 0
            ? `${stats.wins} wins / ${stats.resolvedBets} resolved`
            : 'No resolved bets yet'}
        </p>
      </div>
      <div className="wb-stat">
        <span>Total profit (before gas)</span>
        <strong data-profit={positive}>
          {positive ? '+' : ''}
          {profit.toFixed(3)} <small>USDC</small>
        </strong>
        <p>
          {stats.totalWagered > 0n
            ? `ROI: ${positive ? '+' : ''}${stats.roi.toFixed(1)}%`
            : 'No bets placed yet'}
        </p>
      </div>
    </div>
  );
}
