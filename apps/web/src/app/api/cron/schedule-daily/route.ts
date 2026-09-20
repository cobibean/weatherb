import { NextResponse } from 'next/server';
import { keccak256, toBytes, toEventSelector, type Hex } from 'viem';
import { Client as QStashClient } from '@upstash/qstash';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { automationReadinessResponse } from '@/lib/cron/readiness';
import { verifyCronRequest, unauthorizedResponse, createContractClients } from '@/lib/cron';
import {
  persistMarket,
  readMarket,
  reconcileMarkets,
  requireRestartContract,
} from '@/lib/cron/market-state';
import { recordProviderError, recordProviderSuccess } from '@/lib/provider-health';
import prisma from '@/lib/prisma';

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

/** One idempotent slot per UTC hour from 12 through 16; the contract enforces the limit. */
export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyCronRequest(request)) return unauthorizedResponse();
  const readiness = await automationReadinessResponse('scheduler');
  if (readiness) return readiness;
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SCHEDULER_PRIVATE_KEY as Hex | undefined;
  if (!rpcUrl || !contractAddress || !privateKey) {
    return NextResponse.json(
      { success: false, error: 'Missing scheduler configuration' },
      { status: 500 },
    );
  }
  try {
    const clients = createContractClients({ rpcUrl, privateKey });
    const { publicClient, walletClient } = clients;
    await requireRestartContract(publicClient, contractAddress);
    // Recover earlier writes before allowing more markets, including a failure in an earlier hour.
    await reconcileMarkets(publicClient, contractAddress);
    const now = Math.floor(Date.now() / 1000);
    const slot = Math.floor(now / 3600) * 3600;
    const hour = (slot % 86400) / 3600;
    if (hour < 12 || hour > 16) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: true,
        reason: 'Outside creation hours',
      });
    }
    const lookup = () =>
      publicClient.readContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getScheduledMarket',
        args: [BigInt(slot)],
      });
    let storedId = await lookup();
    let transactionHash: Hex | undefined;
    let created = 0;
    if (storedId === 0n) {
      const cities = await prisma.city.findMany({
        where: { isActive: true },
        orderBy: [{ createdAt: 'asc' }, { slug: 'asc' }],
      });
      if (cities.length === 0) throw new Error('No active cities configured');
      const count = await publicClient.readContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarketCount',
      });
      const city = cities[Number(count % BigInt(cities.length))]!;
      let forecast: number;
      try {
        forecast = await createWeatherProviderFromEnv().getForecast(
          city.latitude,
          city.longitude,
          now + 86400,
        );
        await recordProviderSuccess();
      } catch (error) {
        await recordProviderError();
        throw error;
      }
      const threshold = Math.round(forecast / 10) * 10;
      if (!Number.isSafeInteger(threshold) || threshold <= 0)
        throw new Error('Unsupported forecast threshold');
      const { request: txRequest } = await publicClient.simulateContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'createScheduledMarket',
        args: [keccak256(toBytes(city.slug)), BigInt(threshold), BigInt(slot)],
        account: walletClient.account!,
      });
      transactionHash = await walletClient.writeContract(txRequest);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
      if (receipt.status !== 'success')
        throw new Error(`Creation transaction reverted: ${transactionHash}`);
      created = receipt.logs.some(
        (log) =>
          log.address.toLowerCase() === contractAddress.toLowerCase() &&
          log.topics[0] ===
            toEventSelector('MarketCreated(uint256,bytes32,uint64,uint256,address)'),
      )
        ? 1
        : 0;
      storedId = await lookup(); // Simulation's predicted ID can be stale under concurrent creation.
      if (storedId === 0n) throw new Error(`Creation not confirmed: ${transactionHash}`);
    }
    const id = storedId - 1n;
    const confirmed = await readMarket(publicClient, contractAddress, id);
    await persistMarket(id, confirmed);
    let settlementSchedule: SettlementScheduleResult;
    try {
      settlementSchedule = await scheduleMarketSettlement({
        marketId: id.toString(),
        resolveTimeSec: Number(confirmed.resolveTime),
      });
    } catch {
      settlementSchedule = {
        scheduled: false,
        message: 'Queue unavailable; periodic settlement remains required',
      };
    }
    return NextResponse.json({
      success: true,
      created,
      market: {
        marketId: id.toString(),
        thresholdTenths: Number(confirmed.thresholdTenths),
        transactionHash,
      },
      settlementSchedule,
    });
  } catch (error) {
    console.error('[Scheduler] Creation/reconciliation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Creation or reconciliation failed; retry this endpoint to recover chain state',
      },
      { status: 503 },
    );
  }
}
