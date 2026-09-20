import { NextResponse } from 'next/server';
import { keccak256, toBytes, toEventSelector, type Hex } from 'viem';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { automationReadinessResponse } from '@/lib/cron/readiness';
import { verifyWorkerRequest, unauthorizedResponse, createContractClients } from '@/lib/cron';
import { withSignerLease } from '@/lib/cron/lease';
import { persistMarket, readMarket, reconcileOutstandingMarkets, requireRestartContract } from '@/lib/cron/market-state';
import { ensureSettlementScheduled, type SettlementScheduleResult } from '@/lib/cron/settlement-schedule';
import { recordWorkerRun, redactError, triggerFromRequest } from '@/lib/cron/worker-run';
import { recordProviderError, recordProviderSuccess } from '@/lib/provider-health';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const LEASE_SECONDS = 280;

type ScheduleSummary = {
  slot: number;
  created: number;
  skipped?: boolean;
  reason?: string;
  marketId?: string;
  thresholdTenths?: number;
  transactionHash?: Hex | undefined;
  settlementSchedule?: SettlementScheduleResult;
};

/** One idempotent slot per UTC hour from 12 through 16; the contract enforces the limit. */
export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyWorkerRequest(request)) return unauthorizedResponse();
  const readiness = await automationReadinessResponse('scheduler');
  if (readiness) {
    if (readiness.status === 200)
      await recordWorkerRun('schedule-daily', triggerFromRequest(request), async () => ({
        status: 'skipped',
        summary: await readiness.clone().json(),
      }));
    return readiness;
  }
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SCHEDULER_PRIVATE_KEY as Hex | undefined;
  if (!rpcUrl || !contractAddress || !privateKey)
    return NextResponse.json({ success: false, error: 'Missing scheduler configuration' }, { status: 500 });
  try {
    const clients = createContractClients({ rpcUrl, privateKey });
    const { publicClient, walletClient } = clients;
    const lease = `scheduler:${walletClient.account!.address.toLowerCase()}`;
    const outcome = await recordWorkerRun<ScheduleSummary | { busy: true }>(
      'schedule-daily',
      triggerFromRequest(request),
      async (runId) => {
        const held = await withSignerLease(lease, runId, LEASE_SECONDS, async (): Promise<ScheduleSummary> => {
          await requireRestartContract(publicClient, contractAddress);
          // Recover earlier writes before allowing more markets, including a failure in an earlier hour.
          await reconcileOutstandingMarkets(publicClient, contractAddress);
          const now = Math.floor(Date.now() / 1000);
          const slot = Math.floor(now / 3600) * 3600;
          const hour = (slot % 86400) / 3600;
          if (hour < 12 || hour > 16) return { slot, created: 0, skipped: true, reason: 'Outside creation hours' };
          const lookup = () =>
            publicClient.readContract({ address: contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'getScheduledMarket', args: [BigInt(slot)] });
          let storedId = await lookup();
          let transactionHash: Hex | undefined;
          let created = 0;
          if (storedId === 0n) {
            const cities = await prisma.city.findMany({ where: { isActive: true }, orderBy: [{ createdAt: 'asc' }, { slug: 'asc' }] });
            if (cities.length === 0) throw new Error('No active cities configured');
            const count = await publicClient.readContract({ address: contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'getMarketCount' });
            const city = cities[Number(count % BigInt(cities.length))]!;
            let forecast: number;
            try {
              forecast = await createWeatherProviderFromEnv().getForecast(city.latitude, city.longitude, now + 86400);
              await recordProviderSuccess();
            } catch (error) {
              await recordProviderError();
              throw error;
            }
            const threshold = Math.round(forecast / 10) * 10;
            if (!Number.isSafeInteger(threshold) || threshold <= 0) throw new Error('Unsupported forecast threshold');
            const { request: txRequest } = await publicClient.simulateContract({
              address: contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'createScheduledMarket',
              args: [keccak256(toBytes(city.slug)), BigInt(threshold), BigInt(slot)], account: walletClient.account!,
            });
            transactionHash = await walletClient.writeContract(txRequest);
            const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
            if (receipt.status !== 'success') throw new Error(`Creation transaction reverted: ${transactionHash}`);
            created = receipt.logs.some(
              (log) => log.address.toLowerCase() === contractAddress.toLowerCase() &&
                log.topics[0] === toEventSelector('MarketCreated(uint256,bytes32,uint64,uint256,address)'),
            ) ? 1 : 0;
            storedId = await lookup(); // Simulation's predicted ID can be stale under concurrent creation.
            if (storedId === 0n) throw new Error(`Creation not confirmed: ${transactionHash}`);
          }
          const id = storedId - 1n;
          const confirmed = await readMarket(publicClient, contractAddress, id);
          await persistMarket(id, confirmed);
          const settlementSchedule = await ensureSettlementScheduled(id, Number(confirmed.resolveTime)).catch(
            (): SettlementScheduleResult => ({ scheduled: false, message: 'Queue unavailable; periodic settlement remains required' }),
          );
          return { slot, created, marketId: id.toString(), thresholdTenths: Number(confirmed.thresholdTenths), transactionHash, settlementSchedule };
        });
        if (!held.acquired) return { status: 'busy', summary: { busy: true as const } };
        return { status: held.value.skipped ? 'skipped' : 'succeeded', summary: held.value };
      },
    );
    if ('busy' in outcome.summary) return NextResponse.json({ success: false, busy: true }, { status: 409 });
    const s = outcome.summary;
    if (s.skipped) return NextResponse.json({ success: true, created: 0, skipped: true, reason: s.reason });
    return NextResponse.json({
      success: true,
      created: s.created,
      market: { marketId: s.marketId, thresholdTenths: s.thresholdTenths, transactionHash: s.transactionHash },
      settlementSchedule: s.settlementSchedule,
    });
  } catch (error) {
    console.error('[Scheduler] Creation/reconciliation failed:', redactError(error));
    return NextResponse.json(
      { success: false, error: 'Creation or reconciliation failed; retry this endpoint to recover chain state' },
      { status: 503 },
    );
  }
}
