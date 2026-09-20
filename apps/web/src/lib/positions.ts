import { createPublicClient, http, keccak256, toBytes, type Hex } from 'viem';
import { ARC_TESTNET, assertArcChain } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { CITIES, type City } from '@weatherb/shared/constants';
import type { MarketStatus } from '@weatherb/shared/types';
import { toMarketStatus } from '@weatherb/shared/utils/market-status';
import type { UserPosition, UserStats, PositionStatus } from '@/types/positions';
import prisma from '@/lib/prisma';

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
 * Create viem client lazily with batching enabled
 */
function getClient() {
  return createPublicClient({
    chain: ARC_TESTNET,
    transport: http(getRpcUrl(), {
      batch: {
        wait: 50, // Wait up to 50ms to collect requests for batching
        batchSize: 100, // Maximum requests per batch (most RPC providers support up to 100)
      },
    }),
  });
}

// Cache for database cities (loaded once per request)
let dbCitiesCache: City[] | null = null;

/**
 * Load cities from database (cached for module lifetime).
 */
async function loadDbCities(): Promise<City[]> {
  if (dbCitiesCache !== null) return dbCitiesCache;

  try {
    const cities = await prisma.city.findMany();
    dbCitiesCache = cities.map((c) => ({
      slug: c.slug,
      name: c.name,
      latitude: c.latitude,
      longitude: c.longitude,
      timezone: c.timezone,
    }));
    return dbCitiesCache;
  } catch (error) {
    console.error('Failed to load cities from database:', error);
    return [];
  }
}

/**
 * Look up a city by its bytes32 hash (keccak256 of slug).
 * Checks both hardcoded CITIES and database cities.
 */
async function findCityByBytes32(
  cityIdHex: Hex,
): Promise<{ slug: string; name: string; latitude: number; longitude: number } | null> {
  // First check hardcoded cities (fast path)
  for (const city of CITIES) {
    const hash = keccak256(toBytes(city.slug));
    if (hash.toLowerCase() === cityIdHex.toLowerCase()) {
      return {
        slug: city.slug,
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
      };
    }
  }

  // Then check database cities
  const dbCities = await loadDbCities();
  for (const city of dbCities) {
    const hash = keccak256(toBytes(city.slug));
    if (hash.toLowerCase() === cityIdHex.toLowerCase()) {
      return {
        slug: city.slug,
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
      };
    }
  }

  return null;
}

/**
 * Determine position status based on market status and position data
 */
function determinePositionStatus(
  marketStatus: MarketStatus,
  position: { yesAmount: bigint; noAmount: bigint; claimed: boolean },
  market: { outcome: boolean },
  payout: bigint,
): PositionStatus {
  // Cancelled or NoWinners markets → refundable
  if (marketStatus === 'cancelled' || marketStatus === 'noWinners') {
    return position.claimed ? 'refunded' : 'refundable';
  }

  // Unresolved markets
  if (marketStatus !== 'resolved') {
    return 'active';
  }

  // Resolved markets
  // Check if user has any winnings (handles betting both sides)
  if (payout === 0n) {
    // No payout means user lost (or already claimed)
    return position.claimed ? 'claimed' : 'lost';
  }

  // User has winnings
  if (position.claimed) {
    return 'claimed';
  }

  return 'claimable';
}

/**
 * Fetch all positions for a specific wallet address using multicall batching
 */
export async function fetchUserPositions(walletAddress: string): Promise<UserPosition[]> {
  try {
    const client = getClient();
    assertArcChain(Number(process.env.NEXT_PUBLIC_CHAIN_ID));
    assertArcChain(await client.getChainId());
    const contractAddress = getContractAddress();

    // Get total market count
    const marketCount = await client.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarketCount',
    });

    if (marketCount === 0n) {
      return [];
    }

    // Batch 1: Get all positions using Promise.all with batched transport
    const positionPromises = Array.from({ length: Number(marketCount) }, (_, i) =>
      client.readContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getPosition',
        args: [BigInt(i), walletAddress as Hex],
      }),
    );

    const positionResults = await Promise.all(positionPromises);

    // Filter to only markets where user has a position
    const marketIndicesWithPositions: number[] = [];
    positionResults.forEach((position, index) => {
      if (position.yesAmount > 0n || position.noAmount > 0n) {
        marketIndicesWithPositions.push(index);
      }
    });

    if (marketIndicesWithPositions.length === 0) {
      return [];
    }

    // Batch 2: Get market details for positions we found using Promise.all
    const marketPromises = marketIndicesWithPositions.map((i) =>
      client.readContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarket',
        args: [BigInt(i)],
      }),
    );

    const marketResults = await Promise.all(marketPromises);

    // Batch 3: Get payouts for resolved/cancelled markets
    const payoutCalls: Array<{
      address: Hex;
      abi: typeof WEATHER_MARKET_ABI;
      functionName: 'calculatePayout';
      args: [bigint, Hex];
    }> = [];
    const payoutIndices: number[] = [];

    marketIndicesWithPositions.forEach((marketIndex, resultIndex) => {
      const market = marketResults[resultIndex];
      const position = positionResults[marketIndex];

      // Type guards
      if (!market || !position) return;

      const marketStatus = toMarketStatus(market.status);

      if (
        (marketStatus === 'resolved' ||
          marketStatus === 'cancelled' ||
          marketStatus === 'noWinners') &&
        !position.claimed
      ) {
        payoutCalls.push({
          address: contractAddress,
          abi: WEATHER_MARKET_ABI,
          functionName: 'calculatePayout',
          args: [BigInt(marketIndex), walletAddress as Hex],
        });
        payoutIndices.push(resultIndex);
      }
    });

    const payoutResults =
      payoutCalls.length > 0
        ? await Promise.all(
            payoutCalls.map((call) =>
              client.readContract({
                address: call.address,
                abi: call.abi,
                functionName: call.functionName,
                args: call.args,
              }),
            ),
          )
        : [];

    // Build the positions array
    const positions: UserPosition[] = [];
    let payoutResultIndex = 0;

    for (let i = 0; i < marketIndicesWithPositions.length; i++) {
      const marketIndex = marketIndicesWithPositions[i];
      if (marketIndex === undefined) continue;

      const position = positionResults[marketIndex];
      const market = marketResults[i];

      // Type guards
      if (!position || !market) continue;

      // Get city info
      const city = await findCityByBytes32(market.cityId);
      if (!city) {
        continue; // Skip unknown cities
      }

      const marketStatus = toMarketStatus(market.status);
      const betSide =
        position.yesAmount > 0n && position.noAmount > 0n
          ? 'BOTH'
          : position.yesAmount > 0n
            ? 'YES'
            : 'NO';
      const betAmount = position.yesAmount + position.noAmount;

      // Get claimable amount if this market had a payout call
      let claimableAmount: bigint | undefined;
      if (payoutIndices.includes(i)) {
        const payoutResult = payoutResults[payoutResultIndex];
        if (payoutResult !== undefined) {
          claimableAmount = payoutResult;
        }
        payoutResultIndex++;
      }

      // Refunds return both accumulated stakes, including when an older getter returns zero.
      if ((marketStatus === 'cancelled' || marketStatus === 'noWinners') && !position.claimed) {
        claimableAmount = betAmount;
      }

      // calculatePayout returns zero after claiming. Reconstruct the historical
      // amount using immutable settled pools and the recorded fee, never today's fee.
      let claimedAmount: bigint | undefined;
      if (position.claimed) {
        if (marketStatus === 'cancelled' || marketStatus === 'noWinners') {
          claimedAmount = betAmount;
        } else if (marketStatus === 'resolved') {
          const stake = market.outcome ? position.yesAmount : position.noAmount;
          const winningPool = market.outcome ? market.yesPool : market.noPool;
          const losingPool = market.outcome ? market.noPool : market.yesPool;
          claimedAmount =
            winningPool === 0n || stake === 0n
              ? 0n
              : stake + ((losingPool - market.totalFees) * stake) / winningPool;
        }
      }

      const status = determinePositionStatus(marketStatus, position, market, claimableAmount ?? 0n);

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
        marketId: marketIndex.toString(),
        cityName: city.name,
        cityId: city.slug,
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

      if (claimableAmount !== undefined) userPosition.claimableAmount = claimableAmount;
      if (claimedAmount !== undefined) userPosition.claimedAmount = claimedAmount;

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
      if (
        (position.status === 'claimable' || position.status === 'refundable') &&
        position.claimableAmount
      ) {
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

  let settledWagered = 0n;
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

    // Pending stakes are not losses. Refunds contribute equal cost and return.
    if (position.status !== 'active') settledWagered += position.betAmount;
    const returned = position.claimedAmount ?? position.claimableAmount ?? 0n;
    stats.totalWinnings += returned;
    if (position.status === 'claimed' || position.status === 'refunded') {
      stats.totalClaimed += returned;
    } else if (position.status === 'claimable' || position.status === 'refundable') {
      stats.totalClaimable += returned;
    }
  }

  // Calculate derived metrics
  if (stats.resolvedBets > 0) {
    stats.winRate = (stats.wins / stats.resolvedBets) * 100;
  }

  stats.netProfit = stats.totalWinnings - settledWagered;

  if (settledWagered > 0n) {
    stats.roi = (Number(stats.netProfit) / Number(settledWagered)) * 100;
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

export {
  serializePosition,
  serializeStats,
  deserializePosition,
  deserializeStats,
} from './position-serialization';
