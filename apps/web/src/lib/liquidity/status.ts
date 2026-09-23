import prisma from '@/lib/prisma';
import { formatSeedAmount, safeConfig } from './config';
import { liquidityAdminWritesEnabled } from './admin-config';
import { MAX_ACTIVE_LIQUIDITY_MARKETS } from './types';

const positionSelect = { id: true, contractMarketId: true, seedStatus: true, claimStatus: true, waitReason: true, slotHeld: true, targetPerSideWei: true,
  confirmedYesWei: true, confirmedNoWei: true, claimedAmountWei: true, claimableWei: true, gasSpentWei: true, discoveredAt: true, firstSeededAt: true,
  claimedAt: true, completedAt: true, lastErrorCode: true, lastError: true, lastAttemptAt: true, nextAttemptAt: true,
  lastTransactionHash: true, lastTransactionStatus: true, lastTransactionNonce: true, lastTransactionOperation: true } as const;

export async function getLiquidityStatus(cursor?: string, requestedLimit = 25, positionCursor?: string): Promise<object> {
  const limit = Math.min(100, Math.max(1, requestedLimit));
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  const key = config.deploymentKey;
  const wallet = config.walletAddress;
  const state = key && wallet ? await prisma.liquidityWorkerState.findUnique({ where: { id: `${key}:${wallet}` } }) : null;
  const [activePositions, terminalPositions, allAmounts, incidents, activity, held, lastRun] = await Promise.all([
    key && wallet ? prisma.liquidityPosition.findMany({ where: { deploymentKey: key, walletAddress: wallet, slotHeld: true }, orderBy: { contractMarketId: 'desc' }, select: positionSelect }) : [],
    key && wallet ? prisma.liquidityPosition.findMany({ where: { deploymentKey: key, walletAddress: wallet, slotHeld: false }, orderBy: { contractMarketId: 'desc' },
      ...(positionCursor ? { cursor: { id: positionCursor }, skip: 1 } : {}), take: limit + 1, select: positionSelect }) : [],
    key && wallet ? prisma.liquidityPosition.findMany({ where: { deploymentKey: key, walletAddress: wallet },
      select: { confirmedYesWei: true, confirmedNoWei: true, claimedAmountWei: true, claimableWei: true, gasSpentWei: true, slotHeld: true } }) : [],
    key ? prisma.liquidityEvent.findMany({ where: { deploymentKey: key, incidentKey: { not: null }, resolvedAt: null }, orderBy: { lastSeenAt: 'desc' }, take: 100,
      select: { id: true, code: true, severity: true, message: true, contractMarketId: true, transactionHash: true, firstSeenAt: true, lastSeenAt: true, occurrenceCount: true } }) : [],
    key ? prisma.liquidityEvent.findMany({ where: { deploymentKey: key }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: limit + 1,
      select: { id: true, code: true, severity: true, message: true, contractMarketId: true, transactionHash: true, createdAt: true, resolvedAt: true } }) : [],
    key ? prisma.liquidityPosition.count({ where: { deploymentKey: key, slotHeld: true } }) : 0,
    prisma.workerRun.findFirst({ where: { kind: 'liquidity-tick' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true, finishedAt: true, status: true, error: true } }),
  ]);
  const positions = [...activePositions, ...terminalPositions.slice(0, limit)].sort((a, b) => b.contractMarketId - a.contractMarketId);
  const workerReady = !!state?.ready && !!state.lastHeartbeatAt && Date.now() - state.lastHeartbeatAt.getTime() < 360_000;
  const principal = allAmounts.reduce((sum, p) => sum + BigInt(p.confirmedYesWei) + BigInt(p.confirmedNoWei), 0n);
  const recovered = allAmounts.reduce((sum, p) => sum + BigInt(p.claimedAmountWei), 0n);
  const claimable = allAmounts.some((p) => p.slotHeld && p.claimableWei === null)
    ? null : allAmounts.reduce((sum, p) => sum + BigInt(p.claimableWei ?? '0'), 0n);
  const gas = allAmounts.reduce((sum, p) => sum + BigInt(p.gasSpentWei), 0n);
  const stale = !!config.activatedAt && (config.seedingEnabled || held > 0) &&
    (!state?.lastReconciledAt || Date.now() - state.lastReconciledAt.getTime() > 360_000);
  return {
    config: safeConfig(config, { canEdit: liquidityAdminWritesEnabled(), workerReady }),
    worker: { ready: workerReady, lastHeartbeatAt: state?.lastHeartbeatAt?.toISOString() ?? null,
      lastReconciledAt: state?.lastReconciledAt?.toISOString() ?? null, currentFailure: state?.currentFailure ?? null,
      stale, lastRun: lastRun ? { startedAt: lastRun.startedAt.toISOString(), finishedAt: lastRun.finishedAt?.toISOString() ?? null,
        status: lastRun.status, error: lastRun.error } : null },
    balance: state?.balanceWei === null || state?.balanceWei === undefined ? null : {
      amountUsdc: formatSeedAmount(state.balanceWei), observedAt: state.balanceObservedAt?.toISOString() ?? null,
      blockNumber: state.balanceBlockNumber?.toString() ?? null,
    },
    slots: { held, maximum: MAX_ACTIVE_LIQUIDITY_MARKETS },
    totals: { principalWei: principal.toString(), recoveredWei: recovered.toString(), claimableWei: claimable?.toString() ?? null, gasWei: gas.toString() },
    incidents: [...(stale ? [{ id: 'stale', code: 'liquidity-worker-stale', severity: 'WARNING', message: 'No completed liquidity check in six minutes.',
      contractMarketId: null, transactionHash: null, firstSeenAt: state?.lastReconciledAt?.toISOString() ?? config.activatedAt?.toISOString() ?? null,
      lastSeenAt: new Date().toISOString(), occurrenceCount: 1 }] : []),
      ...incidents.map((i) => ({ ...i, firstSeenAt: i.firstSeenAt.toISOString(), lastSeenAt: i.lastSeenAt.toISOString() }))],
    positions: positions.map((p) => ({
      id: p.id, marketId: p.contractMarketId, seedStatus: p.seedStatus, claimStatus: p.claimStatus,
      waitReason: p.waitReason, slotHeld: p.slotHeld,
      targetPerSideWei: p.targetPerSideWei, confirmedYesWei: p.confirmedYesWei, confirmedNoWei: p.confirmedNoWei,
      claimedAmountWei: p.claimedAmountWei, claimableWei: p.claimableWei, gasSpentWei: p.gasSpentWei,
      netWei: p.completedAt ? (BigInt(p.claimedAmountWei) - BigInt(p.confirmedYesWei) - BigInt(p.confirmedNoWei) - BigInt(p.gasSpentWei)).toString() : null,
      lastErrorCode: p.lastErrorCode, lastError: p.lastError,
      discoveredAt: p.discoveredAt.toISOString(), lastAttemptAt: p.lastAttemptAt?.toISOString() ?? null,
      completedAt: p.completedAt?.toISOString() ?? null,
      lastTransactionHash: p.lastTransactionHash, lastTransactionStatus: p.lastTransactionStatus,
      lastTransactionNonce: p.lastTransactionNonce, lastTransactionOperation: p.lastTransactionOperation,
    })),
    activity: activity.slice(0, limit).map((event) => ({ ...event, createdAt: event.createdAt.toISOString(), resolvedAt: event.resolvedAt?.toISOString() ?? null })),
    nextCursor: activity.length > limit ? activity[limit - 1]?.id ?? null : null,
    nextPositionCursor: terminalPositions.length > limit ? terminalPositions[limit - 1]?.id ?? null : null,
  };
}
