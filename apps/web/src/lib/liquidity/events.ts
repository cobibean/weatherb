import prisma from '@/lib/prisma';
import { redactError } from '@/lib/cron/worker-run';
import type { LiquiditySeverity } from '@prisma/client';

export async function recordLiquidityActivity(args: {
  deploymentKey: string; walletAddress: string; code: string; severity: LiquiditySeverity;
  message: string; positionId?: string; contractMarketId?: number; transactionHash?: string;
}): Promise<void> {
  await prisma.liquidityEvent.create({ data: { ...args, message: redactError(args.message) } });
}

export async function raiseLiquidityIncident(args: {
  deploymentKey: string; walletAddress: string; code: string; severity: LiquiditySeverity;
  message: string; positionId?: string; contractMarketId?: number; action?: string;
}): Promise<void> {
  const incidentKey = [args.code, args.contractMarketId ?? '', args.action ?? ''].join(':');
  const message = redactError(args.message);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${args.deploymentKey + ':' + incidentKey})::bigint)`;
    const current = await tx.liquidityEvent.findFirst({ where: { deploymentKey: args.deploymentKey, incidentKey, resolvedAt: null } });
    if (current) {
      await tx.liquidityEvent.update({ where: { id: current.id }, data: { message, lastSeenAt: new Date(), occurrenceCount: { increment: 1 } } });
    } else {
      await tx.liquidityEvent.create({ data: {
        deploymentKey: args.deploymentKey, walletAddress: args.walletAddress, code: args.code,
        severity: args.severity, message, ...(args.positionId ? { positionId: args.positionId } : {}),
        ...(args.contractMarketId !== undefined ? { contractMarketId: args.contractMarketId } : {}), incidentKey,
      } });
    }
  });
}

export async function resolveLiquidityIncident(deploymentKey: string, code: string, contractMarketId?: number, action?: string, recoveryMessage?: string): Promise<void> {
  const incidentKey = [code, contractMarketId ?? '', action ?? ''].join(':');
  await prisma.$transaction(async (tx) => {
    const active = await tx.liquidityEvent.findMany({ where: { deploymentKey, incidentKey, resolvedAt: null } });
    if (!active.length) return;
    const now = new Date();
    await tx.liquidityEvent.updateMany({ where: { deploymentKey, incidentKey, resolvedAt: null }, data: { resolvedAt: now } });
    for (const incident of active) await tx.liquidityEvent.create({ data: {
      deploymentKey, walletAddress: incident.walletAddress, positionId: incident.positionId,
      contractMarketId: incident.contractMarketId, code: `${code}-recovered`, severity: 'INFO',
      message: recoveryMessage ?? `${code} recovered after recheck.`,
    } });
  });
}

/** A terminal payout/refund or proven zero payout ends any remaining seed action. */
export async function resolveTerminalSeedNotices(deploymentKey: string, contractMarketId: number): Promise<void> {
  const reason = 'Maker position completed on chain; no further seed action is required for this market.';
  await resolveLiquidityIncident(deploymentKey, 'liquidity-partial-seed', contractMarketId, undefined, reason);
  for (const operation of ['YES_SEED', 'NO_SEED']) {
    await resolveLiquidityIncident(deploymentKey, 'liquidity-funding-required', contractMarketId, operation, reason);
  }
  await resolveLiquidityIncident(deploymentKey, 'liquidity-contract-paused', contractMarketId, 'SEED', reason);
}
