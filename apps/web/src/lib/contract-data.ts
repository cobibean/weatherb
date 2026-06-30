import { createPublicClient, http, keccak256, toBytes, type Hex } from 'viem';
import { flareTestnet } from 'viem/chains';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { CITIES, type City } from '@weatherb/shared/constants';
import type { MarketStatus } from '@weatherb/shared/types';
import { toMarketStatus } from '@weatherb/shared/utils/market-status';
import prisma from '@/lib/prisma';

/**
 * Get contract address from environment variables.
 * Checks at runtime (not module load) to allow Next.js to load env vars first.
 */
function getContractAddress(): Hex {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  if (!address) {
    throw new Error('NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is required');
  }
  return address;
}

/**
 * Get RPC URL from environment variables.
 * Checks at runtime (not module load) to allow Next.js to load env vars first.
 */
function getRpcUrl(): string {
  const url = process.env.RPC_URL;
  if (!url) {
    throw new Error('RPC_URL environment variable is required');
  }
  return url;
}

/**
 * Create viem client lazily to ensure env vars are loaded, with batching enabled.
 */
function getClient() {
  return createPublicClient({
    chain: flareTestnet,
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
    dbCitiesCache = cities.map(c => ({
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
async function findCityByBytes32(cityIdHex: Hex): Promise<{ slug: string; name: string; latitude: number; longitude: number } | null> {
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


// Serializable version of Market (bigints as strings)
export type SerializedMarket = {
  id: string;
  cityId: string;
  cityName: string;
  latitude: number;
  longitude: number;
  resolveTime: number;
  thresholdF_tenths: number;
  currency: string;
  status: MarketStatus;
  yesPool: string;
  noPool: string;
  resolvedTempF_tenths?: number;
  observedTimestamp?: number;
  outcome?: boolean;
  resolutionTxHash?: string;
};

export type FetchMarketsResult = {
  markets: SerializedMarket[];
  error?: string;
};

/**
 * Fetch all markets from the WeatherMarket contract using multicall batching.
 * This runs server-side to avoid exposing RPC details.
 */
export async function fetchMarketsFromContract(): Promise<FetchMarketsResult> {
  try {
    const client = getClient();
    const contractAddress = getContractAddress();

    const count = await client.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarketCount',
    });

    if (count === 0n) {
      return { markets: [] };
    }

    // Batch all getMarket calls using Promise.all with batched transport
    const marketPromises = Array.from({ length: Number(count) }, (_, i) =>
      client.readContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarket',
        args: [BigInt(i)],
      })
    );

    const marketResults = await Promise.all(marketPromises);

    const markets: SerializedMarket[] = [];

    for (let i = 0; i < marketResults.length; i++) {
      const marketData = marketResults[i];
      if (!marketData) continue;

      const city = await findCityByBytes32(marketData.cityId);
      if (!city) {
        // Skip markets with unknown cities
        continue;
      }

      // DEFENSE-IN-DEPTH: Filter out test cities at the contract-data level
      // This catches test markets that slip through without DB records
      if (city.name.toLowerCase().includes('test')) {
        continue;
      }

      const status = toMarketStatus(marketData.status);

      const market: SerializedMarket = {
        id: i.toString(),
        cityId: city.slug,
        cityName: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
        resolveTime: Number(marketData.resolveTime) * 1000, // Convert to milliseconds
        thresholdF_tenths: Number(marketData.thresholdTenths),
        currency: 'FLR',
        status,
        yesPool: marketData.yesPool.toString(),
        noPool: marketData.noPool.toString(),
      };

      // Add resolution data if market is resolved OR noWinners
      if (status === 'resolved' || status === 'noWinners') {
        market.resolvedTempF_tenths = Number(marketData.resolvedTempTenths);
        market.observedTimestamp = Number(marketData.observedTimestamp) * 1000;
        if (status === 'resolved') {
          market.outcome = marketData.outcome;
        }
      }

      markets.push(market);
    }

    return { markets };
  } catch (error) {
    console.error('Failed to fetch markets from contract:', error);
    return {
      markets: [],
      error: error instanceof Error ? error.message : 'Failed to fetch markets',
    };
  }
}

