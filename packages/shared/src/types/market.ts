export type MarketStatus = 'open' | 'resolved' | 'cancelled';
export type BetSide = 'yes' | 'no';

export type Market = {
  id: string;
  cityId: string;
  cityName: string;
  latitude: number;
  longitude: number;
  resolveTime: number;
  thresholdF_tenths: number;
  currency: string;
  status: MarketStatus;
  yesPool: bigint;
  noPool: bigint;
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
