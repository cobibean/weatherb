/**
 * Position status types for user bets
 */
export type PositionStatus =
  | 'active' // Market is open or closed for betting, awaiting resolution
  | 'won' // User won but hasn't claimed yet
  | 'lost' // User lost the bet
  | 'claimable' // Same as won, ready to claim (used for UI filtering)
  | 'claimed' // User already claimed their winnings
  | 'refundable' // Market was cancelled, refund available
  | 'refunded'; // User already refunded from cancelled market

/**
 * Complete user position for a single market
 */
export type UserPosition = {
  marketId: string;
  cityName: string;
  cityId: string;
  latitude: number;
  longitude: number;
  thresholdTenths: number; // 850 = 85.0°F
  resolveTime: number; // Unix timestamp in milliseconds
  betSide: 'YES' | 'NO' | 'BOTH';
  betAmount: bigint; // Amount user staked in wei
  status: PositionStatus;
  outcome?: boolean; // true = YES won, false = NO won (only if resolved)
  observedTempTenths?: number; // Actual temperature in tenths (only if resolved)
  claimableAmount?: bigint; // Unclaimed payout in wei
  claimedAmount?: bigint; // Historical payout/refund in wei after claiming
  multiplier?: number; // Odds at time of bet (for display)
  claimed: boolean; // Whether user has claimed
  yesPool: bigint; // Total YES pool at time of fetch
  noPool: bigint; // Total NO pool at time of fetch
};

/**
 * Aggregated user statistics across all positions
 */
export type UserStats = {
  totalBets: number; // Total number of bets placed
  activeBets: number; // Currently pending bets
  resolvedBets: number; // Total resolved bets (won + lost)
  wins: number; // Number of winning bets
  losses: number; // Number of losing bets
  winRate: number; // Percentage (0-100)
  totalWagered: bigint; // Total amount bet across all markets in wei
  totalWinnings: bigint; // Total amount won (claimed + claimable) in wei
  totalClaimed: bigint; // Amount already claimed in wei
  totalClaimable: bigint; // Amount ready to claim now in wei
  netProfit: bigint; // Settled returns minus settled stakes, before gas
  roi: number; // (netProfit / settled stakes) * 100, before gas
};

/**
 * Serialized version of UserPosition for API responses
 * Converts bigints to strings for JSON serialization
 */
export type SerializedUserPosition = Omit<
  UserPosition,
  'betAmount' | 'claimableAmount' | 'claimedAmount' | 'yesPool' | 'noPool'
> & {
  betAmount: string;
  claimableAmount?: string;
  claimedAmount?: string;
  yesPool: string;
  noPool: string;
};

/**
 * Serialized version of UserStats for API responses
 */
export type SerializedUserStats = Omit<
  UserStats,
  'totalWagered' | 'totalWinnings' | 'totalClaimed' | 'totalClaimable' | 'netProfit'
> & {
  totalWagered: string;
  totalWinnings: string;
  totalClaimed: string;
  totalClaimable: string;
  netProfit: string;
};

/**
 * API response format for positions endpoint
 */
export type PositionsResponse = {
  positions: SerializedUserPosition[];
  stats: SerializedUserStats;
  error?: string;
};
