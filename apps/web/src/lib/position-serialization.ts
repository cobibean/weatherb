import type {
  UserPosition,
  UserStats,
  SerializedUserPosition,
  SerializedUserStats,
} from '@/types/positions';

/**
 * Serialize a UserPosition for JSON response
 */
export function serializePosition(position: UserPosition): SerializedUserPosition {
  const { betAmount, claimableAmount, claimedAmount, yesPool, noPool, ...rest } = position;

  const serialized: SerializedUserPosition = {
    ...rest,
    betAmount: betAmount.toString(),
    yesPool: yesPool.toString(),
    noPool: noPool.toString(),
  };

  if (claimableAmount !== undefined) {
    serialized.claimableAmount = claimableAmount.toString();
  }

  if (claimedAmount !== undefined) serialized.claimedAmount = claimedAmount.toString();

  return serialized;
}

/**
 * Serialize UserStats for JSON response
 */
export function serializeStats(stats: UserStats): SerializedUserStats {
  return {
    ...stats,
    totalWagered: stats.totalWagered.toString(),
    totalWinnings: stats.totalWinnings.toString(),
    totalClaimed: stats.totalClaimed.toString(),
    totalClaimable: stats.totalClaimable.toString(),
    netProfit: stats.netProfit.toString(),
  };
}

/**
 * Deserialize a position from API response
 */
export function deserializePosition(serialized: SerializedUserPosition): UserPosition {
  const { betAmount, claimableAmount, claimedAmount, yesPool, noPool, ...rest } = serialized;

  const deserialized: UserPosition = {
    ...rest,
    betAmount: BigInt(betAmount),
    yesPool: BigInt(yesPool),
    noPool: BigInt(noPool),
  };

  if (claimableAmount !== undefined) {
    deserialized.claimableAmount = BigInt(claimableAmount);
  }

  if (claimedAmount !== undefined) deserialized.claimedAmount = BigInt(claimedAmount);

  return deserialized;
}

/**
 * Deserialize stats from API response
 */
export function deserializeStats(serialized: SerializedUserStats): UserStats {
  return {
    ...serialized,
    totalWagered: BigInt(serialized.totalWagered),
    totalWinnings: BigInt(serialized.totalWinnings),
    totalClaimed: BigInt(serialized.totalClaimed),
    totalClaimable: BigInt(serialized.totalClaimable),
    netProfit: BigInt(serialized.netProfit),
  };
}
