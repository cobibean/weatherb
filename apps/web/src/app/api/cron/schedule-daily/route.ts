import { NextResponse } from 'next/server';
import { keccak256, toBytes, type Hex } from 'viem';
import { Client as QStashClient } from '@upstash/qstash';
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
import { recordProviderError, recordProviderSuccess } from '@/lib/provider-health';
import prisma from '@/lib/prisma';

/**
 * Fetch active cities from the database.
 * Falls back to hardcoded CITIES if database is empty or query fails.
 */
async function getActiveCities(): Promise<readonly City[]> {
  try {
    const dbCities = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }, // Consistent ordering for rotation
    });

    if (dbCities.length === 0) {
      console.log('No active cities in database, using hardcoded CITIES fallback');
      return CITIES;
    }

    // Map Prisma City to shared City type
    const cities: City[] = dbCities.map(c => ({
      slug: c.slug,
      name: c.name,
      latitude: c.latitude,
      longitude: c.longitude,
      timezone: c.timezone,
    }));

    console.log(`Using ${cities.length} active cities from database: ${cities.map(c => c.name).join(', ')}`);
    return cities;
  } catch (error) {
    console.error('Failed to fetch cities from database, using fallback:', error);
    return CITIES;
  }
}

async function upsertCityForMarket(city: City): Promise<{ id: string }> {
  return prisma.city.upsert({
    where: { slug: city.slug },
    update: {
      name: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      timezone: city.timezone ?? 'UTC',
      isActive: true,
    },
    create: {
      slug: city.slug,
      name: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      timezone: city.timezone || 'UTC',
      isActive: true,
    },
  });
}

async function upsertMarketRecord(params: {
  contractMarketId: number;
  city: City;
  resolveTimeSec: number;
  thresholdTenths: number;
}): Promise<void> {
  try {
    const dbCity = await upsertCityForMarket(params.city);
    const existing = await prisma.market.findFirst({
      where: { contractMarketId: params.contractMarketId },
    });

    const data = {
      cityId: dbCity.id,
      cityName: params.city.name,
      latitude: params.city.latitude,
      longitude: params.city.longitude,
      timezone: params.city.timezone || 'UTC',
      thresholdTemp: params.thresholdTenths,
      resolveTime: new Date(params.resolveTimeSec * 1000),
      status: 'OPEN' as const,
      yesPool: '0',
      noPool: '0',
      isTest: false,
    };

    if (existing) {
      await prisma.market.update({
        where: { id: existing.id },
        data,
      });
      return;
    }

    await prisma.market.create({
      data: {
        contractMarketId: params.contractMarketId,
        ...data,
      },
    });
  } catch (error) {
    console.error('[Scheduler] Failed to persist market in database:', error);
  }
}

type MarketConfig = {
  city: City;
  cityIdBytes32: Hex;
  resolveTimeSec: number;
};

type CreateMarketResult = {
  citySlug: string;
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
 * Convert a city slug to its keccak256 bytes32 representation for on-chain storage.
 */
function citySlugToBytes32(slug: string): Hex {
  return keccak256(toBytes(slug));
}

const SECONDS_PER_DAY = 86400; // 24 hours
const SETTLEMENT_SCHEDULE_WINDOW_SEC = 600; // 10 minutes

type SettlementScheduleResult = {
  scheduled: boolean;
  message?: string;
  messageId?: string;
};

async function scheduleMarketSettlement(params: {
  marketId: string;
  resolveTimeSec: number;
}): Promise<SettlementScheduleResult> {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    return { scheduled: false, message: 'QSTASH_TOKEN not set' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (!baseUrl) {
    return { scheduled: false, message: 'NEXT_PUBLIC_APP_URL or APP_URL not set' };
  }

  const settleUrl = new URL(`/api/markets/${params.marketId}/settle`, baseUrl).toString();
  const qstash = new QStashClient({ token });

  const headers: Record<string, string> = {};
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    headers.Authorization = `Bearer ${cronSecret}`;
  }

  const publishResult = await qstash.publishJSON({
    url: settleUrl,
    notBefore: params.resolveTimeSec,
    headers,
  });

  const messageId = (publishResult as { messageId?: string }).messageId;
  return messageId ? { scheduled: true, messageId } : { scheduled: true };
}

/**
 * Select the next market based on city rotation.
 * Uses Upstash Redis to persist the city index across runs.
 * Creates exactly 1 market per cron run, lasting 24 hours.
 */
async function selectNextMarket(params: {
  baseTimeSec: number;
  cities?: readonly City[];
}): Promise<MarketConfig> {
  const cities = params.cities ?? CITIES;
  if (cities.length === 0) throw new Error('No cities configured');

  // Get city index from Upstash (or start at 0)
  const redis = getUpstashRedis();
  let cityIndex = 0;

  if (redis) {
    const storedIndex = await redis.get<number>(REDIS_KEYS.CITY_INDEX);
    cityIndex = storedIndex ?? 0;
  }

  const city = cities[cityIndex % cities.length]!;
  const resolveTimeSec = params.baseTimeSec + SECONDS_PER_DAY; // Always 24 hours from now

  // Update city index for next run (advance by 1)
  if (redis) {
    await redis.set(REDIS_KEYS.CITY_INDEX, cityIndex + 1);
  }

  return {
    city,
    cityIdBytes32: citySlugToBytes32(city.slug),
    resolveTimeSec,
  };
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
  let forecastTempTenths: number;
  try {
    forecastTempTenths = await provider.getForecast(
      config.city.latitude,
      config.city.longitude,
      config.resolveTimeSec
    );
    await recordProviderSuccess();
  } catch (error) {
    await recordProviderError();
    throw error;
  }
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
    citySlug: config.city.slug,
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
 * Vercel Cron job that creates 1 weather market per hour.
 * Runs at 12:00, 13:00, 14:00, 15:00, 16:00 UTC daily (5 markets/day).
 * Each market lasts exactly 24 hours.
 *
 * Flow:
 * 1. Verify request is from Vercel Cron
 * 2. Fetch active cities from database (falls back to hardcoded if empty)
 * 3. Get city rotation index from Upstash Redis
 * 4. Select next city in round-robin rotation
 * 5. Fetch weather forecast, create market on-chain (resolves in 24h)
 * 6. Update city index in Upstash
 * 7. Return JSON response with results
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Verify the request is from Vercel Cron
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  // Parse environment variables
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SCHEDULER_PRIVATE_KEY as Hex | undefined;

  // Validate required env vars
  if (!rpcUrl || !contractAddress || !privateKey) {
    console.error('Missing required environment variables: RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS, SCHEDULER_PRIVATE_KEY');
    return NextResponse.json(
      { success: false, error: 'Missing configuration: RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS, SCHEDULER_PRIVATE_KEY' },
      { status: 500 }
    );
  }

  try {
    // Fetch active cities from database (falls back to hardcoded if empty)
    const activeCities = await getActiveCities();

    // Calculate base time (now)
    const nowSec = Math.floor(Date.now() / 1000);

    // Select next market (1 per cron run, 24h duration)
    const marketConfig = await selectNextMarket({
      baseTimeSec: nowSec,
      cities: activeCities,
    });

    console.log(`Creating market for ${marketConfig.city.name} at ${new Date(marketConfig.resolveTimeSec * 1000).toISOString()}`);
    
    const result = await createMarketOnChain(marketConfig, {
      rpcUrl,
      contractAddress,
      privateKey,
    });
    
    console.log(`Created market ${result.marketId} for ${result.cityName}: ${result.thresholdTenths / 10}°F (resolves in 24h)`);

    await upsertMarketRecord({
      contractMarketId: Number(result.marketId),
      city: marketConfig.city,
      resolveTimeSec: marketConfig.resolveTimeSec,
      thresholdTenths: result.thresholdTenths,
    });
    let settlementSchedule: SettlementScheduleResult = { scheduled: false, message: 'Not scheduled' };
    try {
      settlementSchedule = await scheduleMarketSettlement({
        marketId: result.marketId,
        resolveTimeSec: marketConfig.resolveTimeSec,
      });

      if (!settlementSchedule.scheduled) {
        console.warn(`[Scheduler] Settlement not scheduled for market ${result.marketId}: ${settlementSchedule.message}`);
        if (marketConfig.resolveTimeSec - nowSec <= SETTLEMENT_SCHEDULE_WINDOW_SEC) {
          console.warn(`[Scheduler] Market ${result.marketId} resolves soon; cron fallback will handle settlement.`);
        }
      } else {
        console.log(`[Scheduler] Settlement scheduled for market ${result.marketId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] Failed to schedule settlement for market ${result.marketId}:`, errorMessage);
      settlementSchedule = { scheduled: false, message: errorMessage };
    }

    return NextResponse.json({
      success: true,
      created: 1,
      market: result,
      settlementSchedule,
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
