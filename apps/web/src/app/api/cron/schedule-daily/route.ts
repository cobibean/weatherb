import { NextResponse } from 'next/server';
import { keccak256, toBytes, type Hex } from 'viem';
import { CITIES, type City } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import {
  verifyCronRequest,
  unauthorizedResponse,
  createContractClients,
  getUpstashRedis,
  REDIS_KEYS,
} from '@/lib/cron';

type MarketConfig = {
  city: City;
  cityIdBytes32: Hex;
  resolveTimeSec: number;
};

type CreateMarketResult = {
  cityId: string;
  cityName: string;
  marketId: string;
  transactionHash: Hex;
  thresholdTenths: number;
  forecastTempTenths: number;
};

/**
 * Convert forecast temperature (tenths of °F) to threshold (rounded to nearest whole degree).
 * E.g., 753 (75.3°F) → 750 (75°F threshold)
 */
function forecastTenthsToThresholdTenths(forecastTempF_tenths: number): number {
  return Math.round(forecastTempF_tenths / 10) * 10;
}

/**
 * Convert a city ID string to its keccak256 bytes32 representation.
 */
function cityIdToBytes32(cityId: string): Hex {
  return keccak256(toBytes(cityId));
}

/**
 * Select markets for today based on city rotation.
 * Uses Upstash Redis to persist the city index across runs.
 */
async function selectMarketsForDay(params: {
  dailyMarketCount: number;
  baseTimeSec: number;
  spacingSeconds: number;
  cities?: readonly City[];
}): Promise<MarketConfig[]> {
  const cities = params.cities ?? CITIES;
  if (cities.length === 0) throw new Error('No cities configured');
  if (params.dailyMarketCount > 5) throw new Error('DAILY_MARKET_COUNT must be <= 5');

  // Get city index from Upstash (or start at 0)
  const redis = getUpstashRedis();
  let startIndex = 0;

  if (redis) {
    const storedIndex = await redis.get<number>(REDIS_KEYS.CITY_INDEX);
    startIndex = storedIndex ?? 0;
  }

  const configs: MarketConfig[] = [];
  for (let i = 0; i < params.dailyMarketCount; i += 1) {
    const city = cities[(startIndex + i) % cities.length]!;
    const resolveTimeSec = params.baseTimeSec + (i + 1) * params.spacingSeconds;
    configs.push({
      city,
      cityIdBytes32: cityIdToBytes32(city.id),
      resolveTimeSec,
    });
  }

  // Update city index for next run
  if (redis) {
    await redis.set(REDIS_KEYS.CITY_INDEX, startIndex + params.dailyMarketCount);
  }

  return configs;
}

/**
 * Create a single market on-chain.
 */
async function createMarketOnChain(
  config: MarketConfig,
  params: {
    rpcUrl: string;
    contractAddress: Hex;
    privateKey: Hex;
  }
): Promise<CreateMarketResult> {
  // Get forecast temperature from weather provider
  const provider = createWeatherProviderFromEnv();
  const forecastTempTenths = await provider.getForecast(
    config.city.latitude,
    config.city.longitude,
    config.resolveTimeSec
  );
  const thresholdTenths = forecastTenthsToThresholdTenths(forecastTempTenths);

  const { publicClient, walletClient } = createContractClients({
    rpcUrl: params.rpcUrl,
    privateKey: params.privateKey,
  });

  // Simulate and execute the createMarket transaction
  const { request, result } = await publicClient.simulateContract({
    address: params.contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'createMarket',
    args: [
      config.cityIdBytes32,
      BigInt(config.resolveTimeSec),
      BigInt(thresholdTenths),
      '0x0000000000000000000000000000000000000000' as Hex, // FLR currency
    ],
    account: walletClient.account!,
  });

  const transactionHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: transactionHash });

  return {
    cityId: config.city.id,
    cityName: config.city.name,
    marketId: result.toString(),
    transactionHash,
    thresholdTenths,
    forecastTempTenths,
  };
}

/**
 * GET /api/cron/schedule-daily
 *
 * Vercel Cron job that creates daily weather markets.
 * Runs at 6:00 AM UTC by default (configured in vercel.json).
 *
 * Flow:
 * 1. Verify request is from Vercel Cron
 * 2. Get city rotation index from Upstash
 * 3. Select N cities for today's markets
 * 4. For each city: fetch forecast, create market on-chain
 * 5. Update city index in Upstash
 * 6. Return JSON response with results
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Verify the request is from Vercel Cron
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  // Parse environment variables
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SCHEDULER_PRIVATE_KEY as Hex | undefined;
  const dailyMarketCount = parseInt(process.env.DAILY_MARKET_COUNT ?? '5', 10);
  const marketSpacingHours = parseFloat(process.env.MARKET_SPACING_HOURS ?? '3');

  // Validate required env vars
  if (!rpcUrl || !contractAddress || !privateKey) {
    console.error('Missing required environment variables: RPC_URL, CONTRACT_ADDRESS, SCHEDULER_PRIVATE_KEY');
    return NextResponse.json(
      { success: false, error: 'Missing configuration' },
      { status: 500 }
    );
  }

  try {
    // Calculate base time (now) and spacing
    const nowSec = Math.floor(Date.now() / 1000);
    const spacingSeconds = Math.round(marketSpacingHours * 3600);

    // Select markets for today
    const marketConfigs = await selectMarketsForDay({
      dailyMarketCount,
      baseTimeSec: nowSec,
      spacingSeconds,
    });

    const results: CreateMarketResult[] = [];
    const errors: { cityId: string; error: string }[] = [];

    // Create markets sequentially (to avoid nonce issues)
    for (const config of marketConfigs) {
      try {
        console.log(`Creating market for ${config.city.name} at ${new Date(config.resolveTimeSec * 1000).toISOString()}`);
        
        const result = await createMarketOnChain(config, {
          rpcUrl,
          contractAddress,
          privateKey,
        });
        
        console.log(`Created market ${result.marketId} for ${result.cityName}: ${result.thresholdTenths / 10}°F`);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to create market for ${config.city.name}:`, errorMessage);
        errors.push({ cityId: config.city.id, error: errorMessage });
        // Continue to next market, don't fail the entire job
      }
    }

    return NextResponse.json({
      success: true,
      created: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Schedule daily cron failed:', errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

