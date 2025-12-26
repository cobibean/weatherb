import { createPublicClient, http, keccak256, toBytes, type Hex } from 'viem';
import { flareTestnet } from 'viem/chains';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { CITIES } from '@weatherb/shared/constants';
import type { MarketStatus } from '@weatherb/shared/types';
import type {
  UserPosition,
  UserStats,
  PositionStatus,
  SerializedUserPosition,
  SerializedUserStats,
} from '@/types/positions';

/**
 * Get contract address from environment variables
 */
function getContractAddress(): Hex {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  if (!address) {
    throw new Error('NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is required');
  }
  return address;
}

/**
 * Get RPC URL from environment variables
 */
function getRpcUrl(): string {
  const url = process.env.RPC_URL;
  if (!url) {
    throw new Error('RPC_URL environment variable is required');
  }
  return url;
}

/**
 * Create viem client lazily
 */
function getClient() {
  return createPublicClient({
    chain: flareTestnet,
    transport: http(getRpcUrl()),
  });
}

/**
 * Map cityId bytes32 to city info
 */
function findCityByBytes32(cityIdHex: Hex): { id: string; name: string; latitude: number; longitude: number } | null {
  for (const city of CITIES) {
    const hash = keccak256(toBytes(city.id));
    if (hash.toLowerCase() === cityIdHex.toLowerCase()) {
      return {
        id: city.id,
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
      };
    }
  }
  return null;
}

/**
 * Convert contract status (uint8) to MarketStatus type
 */
function toMarketStatus(statusNum: number): MarketStatus {
  switch (statusNum) {
    case 0:
      return 'open';
    case 1:
      return 'closed';
    case 2:
      return 'resolved';
    case 3:
      return 'cancelled';
    default:
      return 'open';
  }
}

/**
 * Determine position status based on market status and position data
 */
function determinePositionStatus(
  marketStatus: MarketStatus,
  position: { yesAmount: bigint; noAmount: bigint; claimed: boolean },
  market: { outcome: boolean },
  payout: bigint
): PositionStatus {
  // Cancelled markets
  if (marketStatus === 'cancelled') {
    return position.claimed ? 'refunded' : 'refundable';
  }

  // Unresolved markets
  if (marketStatus !== 'resolved') {
    return 'active';
  }

  // Resolved markets
  const userBetYes = position.yesAmount > 0n;
  const didUserWin = (userBetYes && market.outcome) || (!userBetYes && !market.outcome);

  if (!didUserWin) {
    return 'lost';
  }

  // User won
  if (position.claimed) {
    return 'claimed';
  }

  return payout > 0n ? 'claimable' : 'claimed';
}

/**
 * Fetch all positions for a specific wallet address
 */
export async function fetchUserPositions(walletAddress: string): Promise<UserPosition[]> {
  try {
    const client = getClient();
    const contractAddress = getContractAddress();

    // Get total market count
    const marketCount = await client.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarketCount',
    });

    const positions: UserPosition[] = [];

    // Check each market for user's position
    for (let i = 0n; i < marketCount; i++) {
      // Get user's position for this market
      const position = await client.readContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getPosition',
        args: [i, walletAddress as Hex],
      });

      // Skip if user has no position in this market
      if (position.yesAmount === 0n && position.noAmount === 0n) {
        continue;
      }

      // Get market details
      const market = await client.readContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarket',
        args: [i],
      });

      // Get city info
      const city = findCityByBytes32(market.cityId);
      if (!city) {
        continue; // Skip unknown cities
      }

      const marketStatus = toMarketStatus(market.status);
      const betSide = position.yesAmount > 0n ? 'YES' : 'NO';
      const betAmount = position.yesAmount > 0n ? position.yesAmount : position.noAmount;

      // Calculate payout if applicable
      let claimableAmount: bigint | undefined;
      if (marketStatus === 'resolved' && !position.claimed) {
        claimableAmount = await client.readContract({
          address: contractAddress,
          abi: WEATHER_MARKET_ABI,
          functionName: 'calculatePayout',
          args: [i, walletAddress as Hex],
        });
      } else if (marketStatus === 'cancelled' && !position.claimed) {
        // For cancelled markets, refund is the full bet amount
        claimableAmount = betAmount;
        console.log(`[DEBUG] Market ${i} cancelled - betAmount: ${betAmount.toString()}, claimableAmount: ${claimableAmount.toString()}`);
      }

      console.log(`[DEBUG] Market ${i} - status: ${marketStatus}, claimableAmount: ${claimableAmount?.toString()}, claimed: ${position.claimed}`);

      const status = determinePositionStatus(
        marketStatus,
        position,
        market,
        claimableAmount ?? 0n
      );

      // Calculate multiplier (odds at current pool state)
      const totalPool = market.yesPool + market.noPool;
      let multiplier: number | undefined;
      if (totalPool > 0n) {
        if (betSide === 'YES' && market.yesPool > 0n) {
          multiplier = Number(totalPool) / Number(market.yesPool);
        } else if (betSide === 'NO' && market.noPool > 0n) {
          multiplier = Number(totalPool) / Number(market.noPool);
        }
      }

      const userPosition: UserPosition = {
        marketId: i.toString(),
        cityName: city.name,
        cityId: city.id,
        latitude: city.latitude,
        longitude: city.longitude,
        thresholdTenths: Number(market.thresholdTenths),
        resolveTime: Number(market.resolveTime) * 1000, // Convert to milliseconds
        betSide,
        betAmount,
        status,
        claimed: position.claimed,
        yesPool: market.yesPool,
        noPool: market.noPool,
        ...(multiplier !== undefined && { multiplier }),
      };

      // Add resolution data if market is resolved
      if (marketStatus === 'resolved') {
        userPosition.outcome = market.outcome;
        userPosition.observedTempTenths = Number(market.resolvedTempTenths);
        if (claimableAmount !== undefined) {
          userPosition.claimableAmount = claimableAmount;
        }
      }

      positions.push(userPosition);
    }

    return positions;
  } catch (error) {
    console.error('Failed to fetch user positions:', error);
    throw error;
  }
}

/**
 * Calculate total claimable winnings across all markets
 */
export async function calculateTotalClaimable(walletAddress: string): Promise<bigint> {
  try {
    const positions = await fetchUserPositions(walletAddress);
    return positions.reduce((total, position) => {
      if (position.status === 'claimable' && position.claimableAmount) {
        return total + position.claimableAmount;
      }
      return total;
    }, 0n);
  } catch (error) {
    console.error('Failed to calculate total claimable:', error);
    return 0n;
  }
}

/**
 * Calculate performance statistics from user positions
 */
export function calculateUserStats(positions: UserPosition[]): UserStats {
  const stats: UserStats = {
    totalBets: positions.length,
    activeBets: 0,
    resolvedBets: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalWagered: 0n,
    totalWinnings: 0n,
    totalClaimed: 0n,
    totalClaimable: 0n,
    netProfit: 0n,
    roi: 0,
  };

  for (const position of positions) {
    // Count by status
    if (position.status === 'active') {
      stats.activeBets++;
    } else if (['won', 'lost', 'claimed', 'claimable'].includes(position.status)) {
      stats.resolvedBets++;
    }

    if (['won', 'claimable', 'claimed'].includes(position.status)) {
      stats.wins++;
    } else if (position.status === 'lost') {
      stats.losses++;
    }

    // Sum amounts
    stats.totalWagered += position.betAmount;

    if (position.claimableAmount) {
      stats.totalWinnings += position.claimableAmount;

      if (position.status === 'claimed') {
        stats.totalClaimed += position.claimableAmount;
      } else if (position.status === 'claimable') {
        stats.totalClaimable += position.claimableAmount;
      }
    }
  }

  // Calculate derived metrics
  if (stats.resolvedBets > 0) {
    stats.winRate = (stats.wins / stats.resolvedBets) * 100;
  }

  stats.netProfit = stats.totalWinnings - stats.totalWagered;

  if (stats.totalWagered > 0n) {
    stats.roi = (Number(stats.netProfit) / Number(stats.totalWagered)) * 100;
  }

  return stats;
}

/**
 * Check if user has any claimable winnings
 */
export async function hasClaimableWinnings(walletAddress: string): Promise<boolean> {
  try {
    const total = await calculateTotalClaimable(walletAddress);
    return total > 0n;
  } catch (error) {
    console.error('Failed to check claimable winnings:', error);
    return false;
  }
}

/**
 * Serialize a UserPosition for JSON response
 */
export function serializePosition(position: UserPosition): SerializedUserPosition {
  const { betAmount, claimableAmount, yesPool, noPool, ...rest } = position;

  const serialized: SerializedUserPosition = {
    ...rest,
    betAmount: betAmount.toString(),
    yesPool: yesPool.toString(),
    noPool: noPool.toString(),
  };

  if (claimableAmount !== undefined) {
    serialized.claimableAmount = claimableAmount.toString();
  }

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
  const { betAmount, claimableAmount, yesPool, noPool, ...rest } = serialized;

  const deserialized: UserPosition = {
    ...rest,
    betAmount: BigInt(betAmount),
    yesPool: BigInt(yesPool),
    noPool: BigInt(noPool),
  };

  if (claimableAmount !== undefined) {
    deserialized.claimableAmount = BigInt(claimableAmount);
  }

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
