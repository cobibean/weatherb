import { NextResponse } from 'next/server';
import { createPublicClient, http, keccak256, toBytes, type Hex } from 'viem';
import { CITIES } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { verifyCronRequest, unauthorizedResponse, createContractClients } from '@/lib/cron';
import { recordProviderError, recordProviderSuccess } from '@/lib/provider-health';

type MarketStatus = 'Open' | 'Closed' | 'Resolved' | 'Cancelled';

type MarketOnChain = {
  marketId: bigint;
  cityId: Hex;
  resolveTimeSec: number;
  bettingDeadlineSec: number;
  thresholdTenths: bigint;
  currency: Hex;
  status: MarketStatus;
};

type SettleResult = {
  marketId: string;
  cityName: string;
  transactionHash: Hex;
  tempTenths: number;
  observedTimestamp: number;
};

const STATUS_MAP: readonly MarketStatus[] = ['Open', 'Closed', 'Resolved', 'Cancelled'] as const;

/**
 * Look up a city by its bytes32 hash.
 */
function findCityByBytes32(cityId: Hex): { id: string; name: string; latitude: number; longitude: number } | null {
  return CITIES.find((c) => keccak256(toBytes(c.id)) === cityId) ?? null;
}

/**
 * Fetch all pending (non-resolved, non-cancelled) markets from the contract.
 */
async function fetchPendingMarkets(params: {
  rpcUrl: string;
  contractAddress: Hex;
}): Promise<MarketOnChain[]> {
  const client = createPublicClient({ transport: http(params.rpcUrl) });
  
  const count = await client.readContract({
    address: params.contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });

  const pending: MarketOnChain[] = [];
  for (let i = 0n; i < count; i += 1n) {
    const market = await client.readContract({
      address: params.contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [i],
    });

    const statusIdx = Number(market.status);
    const status = STATUS_MAP[statusIdx] ?? 'Open';
    
    // Skip already resolved or cancelled markets
    if (status === 'Resolved' || status === 'Cancelled') continue;

    pending.push({
      marketId: i,
      cityId: market.cityId,
      resolveTimeSec: Number(market.resolveTime),
      bettingDeadlineSec: Number(market.bettingDeadline),
      thresholdTenths: market.thresholdTenths,
      currency: market.currency,
      status,
    });
  }

  return pending;
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
  const city = findCityByBytes32(params.market.cityId);
  if (!city) throw new Error(`Unknown cityId bytes32: ${params.market.cityId}`);

  // Get actual temperature from weather provider
  const provider = createWeatherProviderFromEnv();
  let reading: { tempF_tenths: number; observedTimestamp: number };
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

  return {
    marketId: params.market.marketId.toString(),
    cityName: city.name,
    transactionHash,
    tempTenths: reading.tempF_tenths,
    observedTimestamp: reading.observedTimestamp,
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

    // Filter to markets past their resolve time
    const nowSec = Math.floor(Date.now() / 1000);
    const readyMarkets = pendingMarkets.filter((m) => m.resolveTimeSec <= nowSec);

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
