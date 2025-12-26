'use client';

import { formatEther } from 'viem';
import { DollarSign, Clock, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserStats } from '@/types/positions';

interface StatsCardsProps {
  stats: UserStats;
  onClaimAll?: (() => void) | undefined;
}

export function StatsCards({ stats, onClaimAll }: StatsCardsProps) {
  const totalClaimableFLR = Number(formatEther(stats.totalClaimable));
  const netProfitFLR = Number(formatEther(stats.netProfit));
  const isProfit = netProfitFLR >= 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Claimable */}
      <div className="card-hero">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          {totalClaimableFLR > 0 && onClaimAll && (
            <button
              onClick={onClaimAll}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Claim All
            </button>
          )}
        </div>
        <div className="mb-1">
          <div className="text-2xl font-bold text-neutral-800">
            {totalClaimableFLR.toFixed(3)} FLR
          </div>
          <div className="text-sm text-neutral-600">Total Claimable</div>
        </div>
        {totalClaimableFLR > 0 ? (
          <div className="mt-3">
            <button
              onClick={onClaimAll}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Claim Now
            </button>
          </div>
        ) : (
          <div className="text-xs text-neutral-500 mt-2">No winnings to claim</div>
        )}
      </div>

      {/* Active Bets */}
      <div className="card">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div className="mb-1">
          <div className="text-2xl font-bold text-neutral-800">{stats.activeBets}</div>
          <div className="text-sm text-neutral-600">Active Bets</div>
        </div>
        <div className="text-xs text-neutral-500 mt-2">
          {stats.activeBets === 0
            ? 'No pending bets'
            : `${stats.activeBets} market${stats.activeBets === 1 ? '' : 's'} awaiting resolution`}
        </div>
      </div>

      {/* Win Rate */}
      <div className="card">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Trophy className="w-5 h-5 text-purple-600" />
          </div>
        </div>
        <div className="mb-1">
          <div className="text-2xl font-bold text-neutral-800">
            {stats.resolvedBets > 0 ? `${stats.winRate.toFixed(0)}%` : '—'}
          </div>
          <div className="text-sm text-neutral-600">Win Rate</div>
        </div>
        <div className="text-xs text-neutral-500 mt-2">
          {stats.resolvedBets > 0
            ? `${stats.wins} win${stats.wins === 1 ? '' : 's'} / ${stats.resolvedBets} total`
            : 'No resolved bets yet'}
        </div>
      </div>

      {/* Total Profit */}
      <div className="card">
        <div className="flex items-start justify-between mb-2">
          <div className={cn('p-2 rounded-lg', isProfit ? 'bg-green-100' : 'bg-red-100')}>
            {isProfit ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
          </div>
        </div>
        <div className="mb-1">
          <div className={cn('text-2xl font-bold', isProfit ? 'text-green-600' : 'text-red-600')}>
            {isProfit ? '+' : ''}
            {netProfitFLR.toFixed(3)} FLR
          </div>
          <div className="text-sm text-neutral-600">Total Profit</div>
        </div>
        <div className="text-xs text-neutral-500 mt-2">
          {stats.totalWagered > 0n
            ? `ROI: ${isProfit ? '+' : ''}${stats.roi.toFixed(1)}%`
            : 'No bets placed yet'}
        </div>
      </div>
    </div>
  );
}
