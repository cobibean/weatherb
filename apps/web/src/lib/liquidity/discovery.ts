import { randomUUID } from 'node:crypto';
import type { PublicClient, Hex } from 'viem';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import prisma from '@/lib/prisma';
import { persistMarket, readMarket } from '@/lib/cron/market-state';
import { redactError } from '@/lib/cron/worker-run';
import { raiseLiquidityIncident, resolveLiquidityIncident } from './events';
import { LIQUIDITY_CANDIDATE_LIMIT, type LiquidityIdentity } from './types';

export async function registerCreationIntent(args: {
  deploymentKey: string; intentKey: string; slot?: bigint; isTest: boolean; source: 'scheduled' | 'manual';
}): Promise<string> {
  if ((args.source === 'scheduled') !== (args.slot !== undefined)) throw new Error('Creation intent slot mismatch');
  const existing = await prisma.liquidityCreationIntent.findUnique({ where: {
    deploymentKey_intentKey: { deploymentKey: args.deploymentKey, intentKey: args.intentKey },
  } });
  if (existing) {
    if (existing.isTest !== args.isTest || existing.source !== args.source || existing.slot !== (args.slot ?? null))
      throw new Error('Conflicting creation intent metadata');
    return existing.id;
  }
  const created = await prisma.liquidityCreationIntent.create({ data: { id: randomUUID(), ...args } });
  return created.id;
}

/** Keep UNKNOWN until classification and intent binding commit together. */
export async function confirmCreationIntent(args: {
  deploymentKey: string; intentKey: string; marketId: bigint; transactionHash?: Hex | undefined;
}): Promise<void> {
  const id = Number(args.marketId);
  if (!Number.isSafeInteger(id) || id < 0) throw new Error('Invalid market ID');
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${id}::bigint)`;
    const intent = await tx.liquidityCreationIntent.findUniqueOrThrow({ where: {
      deploymentKey_intentKey: { deploymentKey: args.deploymentKey, intentKey: args.intentKey },
    } });
    if (intent.contractMarketId !== null && intent.contractMarketId !== id) throw new Error('Intent already bound to another market');
    const market = await tx.market.findUniqueOrThrow({ where: { contractMarketId: id } });
    const classification = intent.isTest ? 'TEST' : 'PUBLIC';
    if (market.liquidityClassification !== 'UNKNOWN' && market.liquidityClassification !== classification)
      throw new Error('Conflicting market classification');
    await tx.market.update({ where: { contractMarketId: id }, data: { liquidityClassification: classification, liquidityUnknownSweeps: 0, isTest: intent.isTest } });
    await tx.liquidityCreationIntent.update({ where: { id: intent.id }, data: {
      contractMarketId: id, creationTxHash: args.transactionHash ?? intent.creationTxHash,
      reconciledAt: new Date(), lastError: null,
    } });
  });
  await resolveLiquidityIncident(args.deploymentKey, 'liquidity-market-unclassified', id);
}

export async function recoverScheduledIntents(client: PublicClient, address: Hex, identity: LiquidityIdentity): Promise<number> {
  const intents = await prisma.liquidityCreationIntent.findMany({ where: {
    deploymentKey: identity.deploymentKey, source: 'scheduled', reconciledAt: null,
  }, orderBy: [{ lastCheckedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }], take: LIQUIDITY_CANDIDATE_LIMIT });
  let recovered = 0;
  for (const intent of intents) {
    if (intent.slot === null) continue;
    try {
      const stored = await client.readContract({ address, abi: WEATHER_MARKET_ABI, functionName: 'getScheduledMarket', args: [intent.slot] });
      if (stored !== 0n) {
        const id = stored - 1n;
        await persistMarket(id, await readMarket(client, address, id));
        await confirmCreationIntent({ deploymentKey: identity.deploymentKey, intentKey: intent.intentKey, marketId: id });
        recovered++;
      }
      await prisma.liquidityCreationIntent.update({ where: { id: intent.id }, data: { lastCheckedAt: new Date(), lastError: null } });
      await resolveLiquidityIncident(identity.deploymentKey, 'liquidity-creation-recovery-failed', undefined, intent.intentKey);
    } catch (error) {
      await prisma.liquidityCreationIntent.update({ where: { id: intent.id }, data: { lastCheckedAt: new Date(), lastError: redactError(error) } });
      await raiseLiquidityIncident({ deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(),
        code: 'liquidity-creation-recovery-failed', severity: 'WARNING', action: intent.intentKey,
        message: `Could not recover scheduled creation intent ${intent.intentKey}; will retry.` });
    }
  }
  return recovered;
}

/** Persist every ID in order. A failed lower ID holds the cursor for the next sweep. */
export async function discoverLiquidityMarkets(client: PublicClient, identity: LiquidityIdentity, firstEligibleMarketId: number): Promise<number> {
  const stateId = `${identity.deploymentKey}:${identity.walletAddress.toLowerCase()}`;
  const state = await prisma.liquidityWorkerState.findUniqueOrThrow({ where: { id: stateId } });
  const count = await client.readContract({ address: identity.contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'getMarketCount' });
  const end = Number(count > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : count);
  let cursor = Math.max(firstEligibleMarketId, state.discoveryCursor ?? firstEligibleMarketId);
  let processed = 0;
  const priorUnknown = await prisma.market.findMany({ where: { liquidityClassification: 'UNKNOWN', contractMarketId: { gte: firstEligibleMarketId, lt: cursor } },
    orderBy: [{ liquidityUnknownSweeps: 'asc' }, { contractMarketId: 'asc' }], take: LIQUIDITY_CANDIDATE_LIMIT });
  for (const row of priorUnknown) {
    const updated = await prisma.market.update({ where: { contractMarketId: row.contractMarketId }, data: { liquidityUnknownSweeps: { increment: 1 } } });
    if (updated.liquidityUnknownSweeps >= 2)
      await raiseLiquidityIncident({ deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(),
        code: 'liquidity-market-unclassified', severity: 'WARNING', contractMarketId: row.contractMarketId,
        message: `Market ${row.contractMarketId} lacks authoritative public/test classification; funding is held.` });
  }
  while (cursor < end && processed < LIQUIDITY_CANDIDATE_LIMIT) {
    const market = await readMarket(client, identity.contractAddress, BigInt(cursor));
    await persistMarket(BigInt(cursor), market);
    const row = await prisma.market.findUniqueOrThrow({ where: { contractMarketId: cursor } });
    if (row.liquidityClassification === 'PUBLIC' && !row.isTest) {
      await prisma.liquidityPosition.upsert({ where: { deploymentKey_walletAddress_contractMarketId: {
        deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(), contractMarketId: cursor,
      } }, create: {
        deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(), contractMarketId: cursor,
      }, update: {} });
    } else if (row.liquidityClassification === 'UNKNOWN') {
      const updated = await prisma.market.update({ where: { contractMarketId: cursor }, data: { liquidityUnknownSweeps: { increment: 1 } } });
      if (updated.liquidityUnknownSweeps < 2) {
        cursor++;
        processed++;
        await prisma.liquidityWorkerState.update({ where: { id: stateId }, data: { discoveryCursor: cursor } });
        continue;
      }
      await raiseLiquidityIncident({ deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(),
        code: 'liquidity-market-unclassified', severity: 'WARNING', contractMarketId: cursor,
        message: `Market ${cursor} lacks authoritative public/test classification; funding is held.` });
    }
    cursor++;
    processed++;
    await prisma.liquidityWorkerState.update({ where: { id: stateId }, data: { discoveryCursor: cursor } });
  }
  return processed;
}
