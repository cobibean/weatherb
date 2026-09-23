import prisma from '@/lib/prisma';
import type { LiquidityPosition } from '@prisma/client';
import { MAX_ACTIVE_LIQUIDITY_MARKETS, type LiquidityIdentity } from './types';

export async function reserveLiquidityPosition(identity: LiquidityIdentity, marketId: number): Promise<LiquidityPosition | null> {
  return prisma.$transaction(async (tx) => {
    // Every reserve takes the singleton row lock before counting slots. Separate workers cannot create a sixth slot.
    await tx.$executeRaw`SELECT "id" FROM "LiquidityConfig" WHERE "id" = 'default' FOR UPDATE`;
    const config = await tx.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
    if (!config.seedingEnabled || config.deploymentKey !== identity.deploymentKey ||
        config.walletAddress?.toLowerCase() !== identity.walletAddress.toLowerCase() ||
        config.firstEligibleMarketId === null || marketId < config.firstEligibleMarketId) return null;
    const market = await tx.market.findUniqueOrThrow({ where: { contractMarketId: marketId } });
    if (market.liquidityClassification !== 'PUBLIC' || market.isTest) return null;
    const position = await tx.liquidityPosition.findUniqueOrThrow({ where: { deploymentKey_walletAddress_contractMarketId: {
      deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(), contractMarketId: marketId,
    } } });
    if (position.seedStatus === 'SKIPPED' || position.seedStatus === 'ATTENTION' || position.completedAt) return null;
    if (position.slotHeld) return position;
    const held = await tx.liquidityPosition.count({ where: { deploymentKey: identity.deploymentKey, slotHeld: true } });
    if (held >= MAX_ACTIVE_LIQUIDITY_MARKETS) {
      await tx.liquidityPosition.update({ where: { id: position.id }, data: { waitReason: 'CAPACITY' } });
      return null;
    }
    return tx.liquidityPosition.update({ where: { id: position.id }, data: {
      slotHeld: true, targetPerSideWei: position.targetPerSideWei ?? config.seedAmountWei,
      configVersionAtReservation: position.configVersionAtReservation ?? config.version,
      seedStatus: 'SEEDING', waitReason: null,
    } });
  });
}

export async function releaseUnfundedReservation(positionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const position = await tx.liquidityPosition.findUniqueOrThrow({ where: { id: positionId } });
    if (BigInt(position.confirmedYesWei) !== 0n || BigInt(position.confirmedNoWei) !== 0n) return;
    const unresolved = await tx.liquidityTransaction.count({ where: { positionId, status: { in: ['PREPARED', 'SUBMITTED', 'UNKNOWN'] } } });
    if (unresolved) return;
    await tx.liquidityPosition.update({ where: { id: positionId }, data: { slotHeld: false, seedStatus: 'QUEUED' } });
  });
}

/** A raised contract minimum never changes a previously reserved target. */
export async function holdOrRetireBelowMinimum(positionId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT "id" FROM "LiquidityPosition" WHERE "id" = ${positionId} FOR UPDATE`;
    const position = await tx.liquidityPosition.findUniqueOrThrow({ where: { id: positionId } });
    const unresolved = await tx.liquidityTransaction.count({ where: { positionId, status: { in: ['PREPARED', 'SUBMITTED', 'UNKNOWN'] } } });
    const empty = BigInt(position.confirmedYesWei) === 0n && BigInt(position.confirmedNoWei) === 0n && unresolved === 0;
    await tx.liquidityPosition.update({ where: { id: positionId }, data: {
      seedStatus: empty ? 'SKIPPED' : 'ATTENTION', waitReason: 'BELOW_MINIMUM', lastErrorCode: 'BELOW_MINIMUM',
      slotHeld: !empty, completedAt: empty ? new Date() : null,
    } });
    return empty;
  });
}

export async function finishNoPayout(positionId: string, block: bigint): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const pending = await tx.liquidityTransaction.count({ where: { positionId, status: { in: ['PREPARED', 'SUBMITTED', 'UNKNOWN'] } } });
    if (pending) return;
    await tx.liquidityPosition.update({ where: { id: positionId }, data: {
      slotHeld: false, claimStatus: 'NO_PAYOUT', completedAt: new Date(), lastCheckedBlock: block,
    } });
  });
}
