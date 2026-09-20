export type MarketStatus = 'open' | 'closed' | 'resolved' | 'cancelled' | 'noWinners';
export type BetSide = 'yes' | 'no';

export type Market = {
  id: string;
  cityId: string;
  cityName: string;
  latitude: number;
  longitude: number;
  resolveTime: number;
  bettingDeadline?: number; // Frozen on-chain betting deadline, in milliseconds
  thresholdF_tenths: number;
  currency: string;
  status: MarketStatus;
  yesPool: bigint;
  noPool: bigint;
  totalFees?: bigint; // Immutable fee recorded at settlement
  resolvedTempF_tenths?: number;
  observedTimestamp?: number;
  outcome?: boolean;
  resolutionTxHash?: string;
};

export type Bet = {
  marketId: string;
  wallet: string;
  side: BetSide;
  amount: bigint;
  timestamp: number;
};

export type Position = {
  market: Market;
  bet: Bet;
  claimable: boolean;
  winnings?: bigint;
};
