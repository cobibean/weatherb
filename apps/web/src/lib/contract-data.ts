import { createPublicClient, http, keccak256, toBytes, type Hex } from 'viem';
import { flareTestnet } from 'viem/chains';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { CITIES } from '@weatherb/shared/constants';
import type { MarketStatus } from '@weatherb/shared/types';

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
 * Create viem client lazily to ensure env vars are loaded.
 */
function getClient() {
  return createPublicClient({
    chain: flareTestnet,
    transport: http(getRpcUrl()),
  });
}

// Map cityId bytes32 to city info
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

// Convert contract status (uint8) to our MarketStatus type
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
 * Fetch all markets from the WeatherMarket contract.
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

    const markets: SerializedMarket[] = [];

    for (let i = 0n; i < count; i++) {
      const marketData = await client.readContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarket',
        args: [i],
      });

      const city = findCityByBytes32(marketData.cityId);
      if (!city) {
        // Skip markets with unknown cities
        continue;
      }

      const status = toMarketStatus(marketData.status);

      const market: SerializedMarket = {
        id: i.toString(),
        cityId: city.id,
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

      // Only add resolution data if market is resolved
      if (status === 'resolved') {
        market.resolvedTempF_tenths = Number(marketData.resolvedTempTenths);
        market.observedTimestamp = Number(marketData.observedTimestamp) * 1000;
        market.outcome = marketData.outcome;
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

