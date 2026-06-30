import { NextResponse } from 'next/server';
import { createPublicClient, http, keccak256, toBytes, type Hex } from 'viem';
import { CITIES, type City } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { calculateSettlement } from '@weatherb/shared/utils/settlement';
import { formatFlr } from '@weatherb/shared/utils/payout';
import type { WeatherReading } from '@weatherb/shared/types';
import { verifyCronRequest, unauthorizedResponse, createContractClients } from '@/lib/cron';
import { recordProviderError, recordProviderSuccess } from '@/lib/provider-health';
import { createGoogleSheetsClient, toSheetsStatusLabel } from '@/lib/google-sheets';
import { claimSheetsLoggingRights } from '@/lib/sheets-logging';
import prisma from '@/lib/prisma';

type MarketOnChain = {
  marketId: bigint;
  cityId: Hex;
  resolveTimeSec: number;
  bettingDeadlineSec: number;
  thresholdTenths: bigint;
  currency: Hex;
  status: 'Open' | 'Closed' | 'Resolved' | 'Cancelled' | 'NoWinners';
  yesPool?: bigint;
  noPool?: bigint;
};

type SettleResult = {
  marketId: string;
  cityName: string;
  transactionHash: Hex;
  tempTenths: number;
  observedTimestamp: number;
  primaryProvider: string;
  volume: string; // Total volume in FLR (yesPool + noPool)
};

const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled', 'NoWinners'] as const;

// Cache for database cities (loaded once per request)
let dbCitiesCache: City[] | null = null;

/**
 * Load cities from database (cached for the duration of the request).
 */
async function loadDbCities(): Promise<City[]> {
  if (dbCitiesCache !== null) return dbCitiesCache;
  
  try {
    const cities = await prisma.city.findMany({ where: { isActive: true } });
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
 * Look up a city by its bytes32 hash.
 * Checks both hardcoded CITIES and database cities.
 */
async function findCityByBytes32(cityIdHex: Hex): Promise<{ slug: string; name: string; latitude: number; longitude: number } | null> {
  // First check hardcoded cities
  const hardcodedCity = CITIES.find((c) => keccak256(toBytes(c.slug)) === cityIdHex);
  if (hardcodedCity) return hardcodedCity;
  
  // Then check database cities
  const dbCities = await loadDbCities();
  return dbCities.find((c) => keccak256(toBytes(c.slug)) === cityIdHex) ?? null;
}

/**
 * Fetch all pending (non-resolved, non-cancelled) markets from the contract using batched RPC calls.
 */
async function fetchPendingMarkets(params: {
  rpcUrl: string;
  contractAddress: Hex;
}): Promise<MarketOnChain[]> {
  const client = createPublicClient({
    transport: http(params.rpcUrl, {
      batch: {
        wait: 50, // Wait up to 50ms to collect requests for batching
        batchSize: 100, // Maximum requests per batch (most RPC providers support up to 100)
      },
    }),
  });

  const count = await client.readContract({
    address: params.contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });

  if (count === 0n) {
    return [];
  }

  // Batch all getMarket calls using Promise.all with batched transport
  const marketPromises = Array.from({ length: Number(count) }, (_, i) =>
    client.readContract({
      address: params.contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [BigInt(i)],
    })
  );

  const marketResults = await Promise.all(marketPromises);

  const pending: MarketOnChain[] = [];

  for (let i = 0; i < marketResults.length; i++) {
    const market = marketResults[i];
    if (!market) continue;

    const statusIdx = Number(market.status);
    const status = STATUS_MAP[statusIdx] ?? 'Open';

    // Skip already resolved, cancelled, or noWinners markets
    if (status === 'Resolved' || status === 'Cancelled' || status === 'NoWinners') continue;

    pending.push({
      marketId: BigInt(i),
      cityId: market.cityId,
      resolveTimeSec: Number(market.resolveTime),
      bettingDeadlineSec: Number(market.bettingDeadline),
      thresholdTenths: market.thresholdTenths,
      currency: market.currency,
      status,
      yesPool: market.yesPool,
      noPool: market.noPool,
    });
  }

  return pending;
}

/**
 * Fallback: Look up market coordinates from the database.
 * Used when city lookup by bytes32 hash fails (e.g., slug mismatch).
 */
async function findMarketCoordsFromDb(contractMarketId: bigint): Promise<{
  cityName: string;
  latitude: number;
  longitude: number;
  timezone: string;
} | null> {
  try {
    const market = await prisma.market.findFirst({
      where: { contractMarketId: Number(contractMarketId) },
      select: { cityName: true, latitude: true, longitude: true, timezone: true },
    });
    if (market && market.latitude !== null && market.longitude !== null) {
      return {
        cityName: market.cityName,
        latitude: market.latitude,
        longitude: market.longitude,
        timezone: market.timezone,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function findMarketLoggingDetailsFromDb(contractMarketId: bigint): Promise<{
  cityName: string;
  timezone: string;
} | null> {
  try {
    const market = await prisma.market.findFirst({
      where: { contractMarketId: Number(contractMarketId) },
      select: { cityName: true, timezone: true },
    });
    if (!market) return null;
    return {
      cityName: market.cityName,
      timezone: market.timezone,
    };
  } catch {
    return null;
  }
}

async function updateMarketSettlementInDb(params: {
  market: MarketOnChain;
  tempTenths: number;
  settlement: ReturnType<typeof calculateSettlement>;
}): Promise<void> {
  try {
    await prisma.market.updateMany({
      where: {
        contractMarketId: Number(params.market.marketId),
        isTest: false,
      },
      data: {
        status: params.settlement.status,
        isSettled: true,
        settledAt: new Date(),
        actualTemp: params.tempTenths,
        outcome: params.settlement.outcome,
        yesPool: params.settlement.yesPool,
        noPool: params.settlement.noPool,
      },
    });
  } catch (error) {
    console.error(`[Settler] Failed to persist market ${params.market.marketId} settlement:`, error);
  }
}

/**
 * Resolve a single market by fetching weather data and submitting to the contract.
 */
async function resolveMarket(params: {
  rpcUrl: string;
  contractAddress: Hex;
  privateKey: Hex;
  market: MarketOnChain;
}): Promise<SettleResult> {
  // Try to find city by bytes32 hash first
  let city = await findCityByBytes32(params.market.cityId);
  
  // Fallback: Use coordinates stored in the Market record
  // This handles cases where city lookup fails due to slug mismatch or inactive cities
  if (!city) {
    const dbMarket = await findMarketCoordsFromDb(params.market.marketId);
    if (dbMarket) {
      console.log(`[Settler] City lookup failed for ${params.market.cityId}, using DB market coords for ${dbMarket.cityName}`);
      city = {
        slug: 'db-fallback',
        name: dbMarket.cityName,
        latitude: dbMarket.latitude,
        longitude: dbMarket.longitude,
      };
    }
  }
  
  if (!city) throw new Error(`Unknown cityId bytes32: ${params.market.cityId} (and no DB fallback found)`);

  // Get actual temperature from weather provider
  const provider = createWeatherProviderFromEnv();
  let reading: WeatherReading;
  try {
    reading = await provider.getFirstReadingAtOrAfter(
      city.latitude,
      city.longitude,
      params.market.resolveTimeSec
    );
    await recordProviderSuccess();
  } catch (error) {
    await recordProviderError();
    throw error;
  }

  const { publicClient, walletClient } = createContractClients({
    rpcUrl: params.rpcUrl,
    privateKey: params.privateKey,
  });

  // Call resolveMarket(marketId, tempTenths, observedTimestamp)
  const { request } = await publicClient.simulateContract({
    address: params.contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'resolveMarket',
    args: [
      params.market.marketId,
      BigInt(reading.tempF_tenths),
      BigInt(reading.observedTimestamp),
    ],
    account: walletClient.account!,
  });

  const transactionHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: transactionHash });

  // Calculate market volume from pools (before settlement, pools represent total bets)
  const yesPool = params.market.yesPool ?? 0n;
  const noPool = params.market.noPool ?? 0n;
  const volumeFLR = formatFlr(yesPool + noPool);

  return {
    marketId: params.market.marketId.toString(),
    cityName: city.name,
    transactionHash,
    tempTenths: reading.tempF_tenths,
    observedTimestamp: reading.observedTimestamp,
    primaryProvider: reading.source,
    volume: volumeFLR,
  };
}

/**
 * GET /api/cron/settle-markets
 *
 * Vercel Cron job that settles mature weather markets.
 * Runs every 5 minutes by default (configured in vercel.json).
 *
 * Flow:
 * 1. Verify request is from Vercel Cron
 * 2. Fetch all pending markets from contract
 * 3. Filter to markets past their resolve time
 * 4. For each ready market: fetch temperature, resolve on-chain
 * 5. Return JSON response with results
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Reset cache for each request
  dbCitiesCache = null;
  
  // Verify the request is from Vercel Cron
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  // Parse environment variables
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SETTLER_PRIVATE_KEY as Hex | undefined;

  // Validate required env vars
  if (!rpcUrl || !contractAddress || !privateKey) {
    console.error('Missing required environment variables: RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS, SETTLER_PRIVATE_KEY');
    return NextResponse.json(
      { success: false, error: 'Missing configuration: RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS, SETTLER_PRIVATE_KEY' },
      { status: 500 }
    );
  }

  try {
    // Fetch all pending markets
    const pendingMarkets = await fetchPendingMarkets({
      rpcUrl,
      contractAddress,
    });

    console.log(`Found ${pendingMarkets.length} pending markets`);

    // Filter to markets within a tight window around resolve time (event-driven should handle the rest)
    const nowSec = Math.floor(Date.now() / 1000);
    const readyMarkets = pendingMarkets.filter((m) => {
      const timeUntilResolve = m.resolveTimeSec - nowSec;
      const isPastResolveTime = timeUntilResolve <= 0;
      const isWithinWindow = Math.abs(timeUntilResolve) <= 600; // 10 minutes

      if (isPastResolveTime && !isWithinWindow) {
        console.warn(
          `Market ${m.marketId} is ${Math.abs(timeUntilResolve)}s overdue - event settlement may have failed`
        );
      }

      return isPastResolveTime && isWithinWindow;
    });

    if (readyMarkets.length > 0) {
      console.warn(
        `Event-driven settlement should have handled ${readyMarkets.length} market(s), running fallback`
      );
    }

    console.log(`${readyMarkets.length} markets ready for settlement`);

    if (readyMarkets.length === 0) {
      return NextResponse.json({
        success: true,
        settled: 0,
        pending: pendingMarkets.length,
        message: 'No markets ready for settlement',
        timestamp: new Date().toISOString(),
      });
    }

    const results: SettleResult[] = [];
    const errors: { marketId: string; error: string }[] = [];
    const sheetsClient = createGoogleSheetsClient();

    // Settle markets sequentially (to avoid nonce issues)
    for (const market of readyMarkets) {
      try {
        console.log(`Settling market ${market.marketId}`);
        
        const result = await resolveMarket({
          rpcUrl,
          contractAddress,
          privateKey,
          market,
        });
        
        console.log(`Settled market ${result.marketId}: ${result.tempTenths / 10}°F at ${new Date(result.observedTimestamp * 1000).toISOString()}`);
        results.push(result);
        const settlement = calculateSettlement({
          tempTenths: result.tempTenths,
          thresholdTenths: Number(market.thresholdTenths),
          yesPool: market.yesPool ?? 0n,
          noPool: market.noPool ?? 0n,
        });
        await updateMarketSettlementInDb({
          market,
          tempTenths: result.tempTenths,
          settlement,
        });

        // Log to Google Sheets (non-blocking)
        if (sheetsClient) {
          try {
            const shouldLog = await claimSheetsLoggingRights(Number(market.marketId));
            if (!shouldLog) {
              continue;
            }

            const city = await findCityByBytes32(market.cityId);
            const loggingDetails = await findMarketLoggingDetailsFromDb(market.marketId);
            const cityName = city?.name ?? loggingDetails?.cityName ?? result.cityName;
            const timezone = loggingDetails?.timezone ?? null;
            if (cityName) {
              const statusLabel = toSheetsStatusLabel(settlement.status);

              await sheetsClient.appendRow({
                marketId: result.marketId,
                city: cityName,
                status: statusLabel,
                outcome: settlement.outcome,
                timezone,
                threshold: Number(market.thresholdTenths),
                resolvedTemp: result.tempTenths,
                primaryTemp: result.tempTenths,
                primaryProvider: result.primaryProvider,
                altTemp1: null,
                altTemp2: null,
                altTemp3: null,
                observedTimestamp: result.observedTimestamp,
                txHash: result.transactionHash,
                volume: result.volume,
              });
            }
          } catch (sheetsError) {
            console.error(`[GoogleSheets] Failed to log market ${result.marketId}:`, sheetsError);
            // Don't fail settlement if Sheets write fails
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to settle market ${market.marketId}:`, errorMessage);
        errors.push({ marketId: market.marketId.toString(), error: errorMessage });
        // Continue to next market, don't fail the entire job
      }
    }

    return NextResponse.json({
      success: true,
      settled: results.length,
      failed: errors.length,
      pending: pendingMarkets.length - readyMarkets.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Settle markets cron failed:', errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
