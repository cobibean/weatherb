import type { Market } from '@weatherb/shared/types';
import type { MarketSummary, SettledMarketSummary, LiveMarketSummary } from '@/types/market-summary';

// 10 minutes before resolve time in seconds
const BETTING_CLOSE_BUFFER = 600;

export function calculateMarketSummary(
  market: Market,
  feePercentage: number = 0.01
): MarketSummary {
  const totalPool = market.yesPool + market.noPool;

  // Check if market is settled (resolved, cancelled, or noWinners)
  if (market.status === 'resolved' || market.status === 'cancelled' || market.status === 'noWinners') {
    let winnerSide: 'YES' | 'NO' | 'NONE' = 'NONE';
    let winningPool = BigInt(0);
    let losingPool = BigInt(0);
    let feeAmount = BigInt(0);

    if (market.status === 'resolved' && market.outcome !== undefined) {
      winnerSide = market.outcome ? 'YES' : 'NO';
      winningPool = market.outcome ? market.yesPool : market.noPool;
      losingPool = market.outcome ? market.noPool : market.yesPool;

      // Calculate fee from losing pool
      feeAmount = (losingPool * BigInt(Math.floor(feePercentage * 10000))) / BigInt(10000);
    } else if (market.status === 'cancelled' || market.status === 'noWinners') {
      // No winner, all funds refundable
      winnerSide = 'NONE';
    }

    const winningPoolPercentage = totalPool > 0
      ? Number((winningPool * BigInt(10000)) / totalPool) / 100
      : 0;

    const settled: SettledMarketSummary = {
      type: 'settled',
      market,
      totalPool,
      winningPool,
      losingPool,
      winnerSide,
      feeAmount,
      winningPoolPercentage
    };

    return settled;
  }

  // Market is live (open or closed)
  const now = Date.now() / 1000;
  const bettingDeadline = market.resolveTime - BETTING_CLOSE_BUFFER;
  const timeUntilClose = Math.max(0, bettingDeadline - now);
  const timeUntilResolve = Math.max(0, market.resolveTime - now);

  // Calculate implied probability and multipliers
  const yesAmount = Number(market.yesPool) / 1e18;
  const noAmount = Number(market.noPool) / 1e18;
  const total = yesAmount + noAmount;

  const impliedProbability = {
    yes: total > 0 ? Math.round((yesAmount / total) * 100) : 50,
    no: total > 0 ? Math.round((noAmount / total) * 100) : 50
  };

  const currentMultiplier = {
    yes: yesAmount > 0 ? total / yesAmount : 1,
    no: noAmount > 0 ? total / noAmount : 1
  };

  const live: LiveMarketSummary = {
    type: 'live',
    market,
    totalPool,
    bettingDeadline,
    timeUntilClose,
    timeUntilResolve,
    impliedProbability,
    currentMultiplier
  };

  return live;
}

export function formatTemperatureDisplay(tenths: number): string {
  const fahrenheit = Math.round(tenths / 10);
  return `${fahrenheit}°F`;
}

export function getMarketQuestion(cityName: string, thresholdTenths: number, resolveDate: Date): string {
  const threshold = Math.round(thresholdTenths / 10);
  const month = resolveDate.toLocaleDateString('en-US', { month: 'short' });
  const day = resolveDate.getDate();
  return `Will ${cityName} hit ≥${threshold}°F on ${month} ${day}?`;
}

export function getOutcomeMessage(status: Market['status'], outcome?: boolean): string {
  switch (status) {
    case 'resolved':
      return outcome ? 'YES Won' : 'NO Won';
    case 'cancelled':
      return 'Cancelled';
    case 'noWinners':
      return 'No Winners';
    case 'open':
      return 'Open for Betting';
    case 'closed':
      return 'Betting Closed';
    default:
      return 'Unknown';
  }
}
