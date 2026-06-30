export type MarketStatus = 'OPEN' | 'CLOSED' | 'RESOLVED' | 'CANCELLED' | 'NO_WINNERS';

export type CachedMarket = {
  id: bigint;
  status: MarketStatus;
  bettingDeadline: number; // Unix timestamp (seconds)
  resolveTime: number; // Unix timestamp (seconds)
  yesPool: bigint;
  noPool: bigint;
  thresholdTenths: bigint;
  cityId: string; // bytes32 hex
  lastUpdated: number; // Unix timestamp when we last fetched
};

export type NewMarketEvent = {
  marketId: bigint;
  market: CachedMarket;
};

export type WalletStatus = 'active' | 'low_balance' | 'disabled';

export type DecryptedWallet = {
  id: string;
  address: import('viem').Hex;
  privateKey: import('viem').Hex;
  status: WalletStatus;
};

export type BetResult = {
  success: boolean;
  txHash?: string;
  gasUsed?: bigint;
  error?: string;
  retryCount: number;
};

export type BetRequest = {
  marketId: bigint;
  isYes: boolean;
  amount: bigint; // in wei
  strategy: 'new_market' | 'rebalance';
  poolRatioBefore?: number;
};
