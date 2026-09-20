import { ARC_TESTNET, assertArcChain } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { formatUsdc } from '@weatherb/shared/utils/payout';
import { SETTLEMENT_WINDOW_SECONDS } from '@weatherb/shared/utils/weather-timing';
import { createPublicClient, http, type Hex } from 'viem';
import prisma from './prisma';
import { getSystemConfig } from './admin-data';
import { readWorkerStatus, type WorkerStatus } from './worker-status';

export type OperationsAlert = { level: 'critical' | 'warning'; code: string; message: string };
export type OutstandingMarket = {
  contractMarketId: number;
  cityName: string;
  thresholdTemp: number;
  resolveTime: string;
  windowClosesAt: string;
  status: string;
  settlementAttempts: number;
  lastSettlementAttemptAt: string | null;
  lastSettlementError: string | null;
  settlementTxHash: string | null;
  settlementSubmittedAt: string | null;
  isTest: boolean;
};
export type OperationsRun = {
  id: string;
  kind: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  summary: unknown;
  error: string | null;
};
export type OperationsSnapshot = {
  checkedAt: string;
  settlerPaused: boolean;
  schedulerPaused: boolean;
  settlerAddress: string | null;
  settlerBalance: string | null;
  worker: WorkerStatus;
  runs: OperationsRun[];
  outstanding: OutstandingMarket[];
  alerts: OperationsAlert[];
};

const STALE_WORKER_MS = 6 * 60 * 1000;
const LOW_BALANCE_WEI = 2n * 10n ** 17n; // 0.2 USDC covers many testnet settlements.

export function deriveOperationsAlerts(input: {
  now: Date;
  settlerPaused: boolean;
  worker: WorkerStatus;
  outstanding: OutstandingMarket[];
  settlerBalanceWei: bigint | null;
}): OperationsAlert[] {
  const alerts: OperationsAlert[] = [];
  const nowMs = input.now.getTime();
  const overdue = input.outstanding.filter((m) => Date.parse(m.windowClosesAt) < nowMs);
  const due = input.outstanding.filter(
    (m) => Date.parse(m.resolveTime) <= nowMs && Date.parse(m.windowClosesAt) >= nowMs,
  );
  if (overdue.length)
    alerts.push({
      level: 'critical',
      code: 'market-overdue',
      message: `${overdue.length} market(s) passed the observation window without settlement or cancellation: ${overdue.map((m) => `#${m.contractMarketId}`).join(', ')}`,
    });
  const retrying = due.filter((m) => m.settlementAttempts > 0 && m.lastSettlementError);
  if (retrying.length)
    alerts.push({
      level: 'warning',
      code: 'settlement-retrying',
      message: `${retrying.length} market(s) retrying inside the window: ${retrying.map((m) => `#${m.contractMarketId}`).join(', ')}`,
    });
  if (input.settlerPaused) {
    if (due.length || overdue.length)
      alerts.push({
        level: 'warning',
        code: 'settler-paused',
        message: 'Settlement is paused while markets are due',
      });
  } else {
    const lastOk = input.worker.lastSuccessfulSweepAt
      ? Date.parse(input.worker.lastSuccessfulSweepAt)
      : null;
    if (lastOk === null || nowMs - lastOk > STALE_WORKER_MS)
      alerts.push({
        level: 'critical',
        code: 'worker-stale',
        message: lastOk === null ? 'No successful worker sweep recorded' : `Last successful sweep ${Math.round((nowMs - lastOk) / 60000)} min ago`,
      });
  }
  if (input.worker.lastSweepStatus === 'failed')
    alerts.push({ level: 'warning', code: 'worker-failed', message: 'The most recent sweep failed' });
  if (input.settlerBalanceWei !== null && input.settlerBalanceWei < LOW_BALANCE_WEI)
    alerts.push({
      level: 'warning',
      code: 'settler-low-balance',
      message: `Settler balance ${formatUsdc(input.settlerBalanceWei)} USDC is below ${formatUsdc(LOW_BALANCE_WEI)} USDC`,
    });
  return alerts;
}

async function readSettler(): Promise<{ address: string | null; balanceWei: bigint | null }> {
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const rpcUrl = process.env.RPC_URL;
  if (!contract || !rpcUrl) return { address: null, balanceWei: null };
  try {
    const client = createPublicClient({ chain: ARC_TESTNET, transport: http(rpcUrl) });
    assertArcChain(await client.getChainId());
    const address = await client.readContract({ address: contract, abi: WEATHER_MARKET_ABI, functionName: 'settler' });
    return { address, balanceWei: await client.getBalance({ address }) };
  } catch (error) {
    console.error('[Operations] Settler read failed:', error instanceof Error ? error.message : error);
    return { address: null, balanceWei: null };
  }
}

export async function getOperationsSnapshot(now: Date = new Date()): Promise<OperationsSnapshot> {
  const [config, worker, settler, runs, markets] = await Promise.all([
    getSystemConfig(),
    readWorkerStatus(now),
    readSettler(),
    prisma.workerRun.findMany({ orderBy: { startedAt: 'desc' }, take: 25 }),
    prisma.market.findMany({
      where: { isSettled: false },
      orderBy: { resolveTime: 'asc' },
      select: {
        contractMarketId: true, cityName: true, thresholdTemp: true, resolveTime: true, status: true,
        settlementAttempts: true, lastSettlementAttemptAt: true, lastSettlementError: true,
        settlementTxHash: true, settlementSubmittedAt: true, isTest: true,
      },
    }),
  ]);
  const outstanding: OutstandingMarket[] = markets.map((m) => ({
    ...m,
    resolveTime: m.resolveTime.toISOString(),
    windowClosesAt: new Date(m.resolveTime.getTime() + SETTLEMENT_WINDOW_SECONDS * 1000).toISOString(),
    lastSettlementAttemptAt: m.lastSettlementAttemptAt?.toISOString() ?? null,
    settlementSubmittedAt: m.settlementSubmittedAt?.toISOString() ?? null,
  }));
  return {
    checkedAt: now.toISOString(),
    settlerPaused: config.settlerPaused,
    schedulerPaused: config.isPaused,
    settlerAddress: settler.address,
    settlerBalance: settler.balanceWei === null ? null : formatUsdc(settler.balanceWei),
    worker,
    runs: runs.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    outstanding,
    alerts: deriveOperationsAlerts({
      now,
      settlerPaused: config.settlerPaused,
      worker,
      outstanding,
      settlerBalanceWei: settler.balanceWei,
    }),
  };
}
