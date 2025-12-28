import type { Market } from '@weatherb/shared/types';
import type { UserPosition } from './positions';

// Base type for all market summaries
export type MarketSummaryData = {
  market: Market;
  totalPool: bigint;
  userPosition?: UserPosition;
};

// Settled market specific data
export type SettledMarketSummary = MarketSummaryData & {
  type: 'settled';
  winningPool: bigint;
  losingPool: bigint;
  winnerSide: 'YES' | 'NO' | 'NONE';
  feeAmount: bigint;
  winningPoolPercentage: number;
  numberOfBettors?: {
    yes: number;
    no: number;
  };
};

// Live market specific data
export type LiveMarketSummary = MarketSummaryData & {
  type: 'live';
  bettingDeadline: number;
  timeUntilClose: number;
  timeUntilResolve: number;
  impliedProbability: {
    yes: number;
    no: number;
  };
  currentMultiplier: {
    yes: number;
    no: number;
  };
};

// Combined type
export type MarketSummary = SettledMarketSummary | LiveMarketSummary;
