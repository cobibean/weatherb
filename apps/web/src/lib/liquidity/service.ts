import { randomUUID } from 'node:crypto';
import { createPublicClient, http, zeroAddress, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ARC_TESTNET } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import type { LiquidityPosition } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRestartContract, readMarket } from '@/lib/cron/market-state';
import { withSignerLease } from '@/lib/cron/lease';
import { recordWorkerRun, redactError } from '@/lib/cron/worker-run';
import { deploymentKey } from './config';
import { discoverLiquidityMarkets, recoverScheduledIntents } from './discovery';
import { raiseLiquidityIncident, resolveLiquidityIncident } from './events';
import { reserveLiquidityPosition, releaseUnfundedReservation, holdOrRetireBelowMinimum } from './positions';
import { processLiquidityClaim } from './claims';
import { executeLiquidityOperation, isLiquidityFundingError, reconcileTransaction, reconcileUnresolved, type LiquidityTransactionContext } from './transactions';
import { LIQUIDITY_CANDIDATE_LIMIT, LIQUIDITY_DEADLINE_MARGIN_SECONDS, LIQUIDITY_LEASE_SECONDS, LIQUIDITY_TX_LIMIT, LIQUIDITY_WORK_SECONDS, type LiquidityIdentity, type LiquidityTickResult } from './types';

const empty = (status: LiquidityTickResult['status']): LiquidityTickResult => ({ status, reconciled: 0, seeded: 0, claimed: 0, blocked: 0, errors: 0 });

export async function assertMakerIsNotOnChainRole(client: PublicClient, contractAddress: Hex, makerAddress: Hex): Promise<void> {
  const [owner, scheduler, settler] = await Promise.all(['owner', 'scheduler', 'settler'].map((functionName) =>
    client.readContract({ address: contractAddress, abi: WEATHER_MARKET_ABI,
      functionName: functionName as 'owner' | 'scheduler' | 'settler' })));
  if ([owner, scheduler, settler].some((role) => !role || role.toLowerCase() === makerAddress.toLowerCase()))
    throw new Error('Market maker cannot share an on-chain owner, scheduler or settler role');
}

async function contextFromEnvironment(holder: string): Promise<LiquidityTransactionContext | null> {
  const key = process.env.MARKET_MAKER_PRIVATE_KEY as Hex | undefined;
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  if (!key) return null;
  if (!rpcUrl || !contractAddress) throw new Error('Market-maker chain configuration unavailable');
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('Invalid market-maker key syntax');
  const account = privateKeyToAccount(key);
  for (const role of ['SETTLER_PRIVATE_KEY', 'SCHEDULER_PRIVATE_KEY']) {
    const other = process.env[role] as Hex | undefined;
    if (other && /^0x[0-9a-fA-F]{64}$/.test(other) && privateKeyToAccount(other).address.toLowerCase() === account.address.toLowerCase())
      throw new Error('Market maker cannot share a scheduler or settler wallet');
  }
  const client = createPublicClient({ chain: ARC_TESTNET, transport: http(rpcUrl, { timeout: 12_000 }) });
  await requireRestartContract(client, contractAddress);
  await assertMakerIsNotOnChainRole(client, contractAddress, account.address);
  const identity: LiquidityIdentity = { deploymentKey: deploymentKey(contractAddress), contractAddress, walletAddress: account.address };
  const normalized = account.address.toLowerCase();
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  if (config.deploymentKey && config.deploymentKey !== identity.deploymentKey) throw new Error('Market maker deployment mismatch');
  if (config.walletAddress && config.walletAddress.toLowerCase() !== normalized) throw new Error('Market maker wallet mismatch');
  if (!!config.walletAddress !== !!config.deploymentKey) throw new Error('Incomplete market maker binding');
  if (!config.walletAddress && !config.deploymentKey) {
    const bound = await prisma.liquidityConfig.updateMany({ where: {
      id: 'default', deploymentKey: null, walletAddress: null, activatedAt: null,
    }, data: { deploymentKey: identity.deploymentKey, walletAddress: normalized } });
    if (bound.count !== 1) {
      const current = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
      if (current.deploymentKey !== identity.deploymentKey || current.walletAddress !== normalized)
        throw new Error('Market maker binding changed concurrently');
    }
  }
  const stateId = `${identity.deploymentKey}:${normalized}`;
  await prisma.liquidityWorkerState.upsert({ where: { id: stateId }, create: {
    id: stateId, deploymentKey: identity.deploymentKey, walletAddress: normalized,
    ready: true, lastHeartbeatAt: new Date(),
  }, update: { ready: true, lastHeartbeatAt: new Date(), currentFailure: null } });
  return { client, account, identity, leaseId: `liquidity:${ARC_TESTNET.id}:${normalized}`, holder };
}

async function checkAndSeed(ctx: LiquidityTransactionContext, candidate: LiquidityPosition): Promise<'seeded' | 'partial' | 'blocked' | 'in_flight' | 'skipped'> {
  const id = BigInt(candidate.contractMarketId);
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  if (!config.seedingEnabled) {
    await prisma.liquidityPosition.update({ where: { id: candidate.id }, data: { waitReason: 'PAUSED' } });
    return 'blocked';
  }
  if (config.firstEligibleMarketId === null || candidate.contractMarketId < config.firstEligibleMarketId) return 'skipped';
  const dbMarket = await prisma.market.findUniqueOrThrow({ where: { contractMarketId: candidate.contractMarketId } });
  if (dbMarket.liquidityClassification !== 'PUBLIC' || dbMarket.isTest) return 'skipped';
  const [market, paused, block] = await Promise.all([
    readMarket(ctx.client, ctx.identity.contractAddress, id),
    ctx.client.readContract({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'isPaused' }),
    ctx.client.getBlock(),
  ]);
  if (!paused) await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-contract-paused', candidate.contractMarketId, 'SEED');
  if (market.currency.toLowerCase() !== zeroAddress || market.status !== 0 || block.timestamp >= market.bettingDeadline - LIQUIDITY_DEADLINE_MARGIN_SECONDS) {
    const hasStake = BigInt(candidate.confirmedYesWei) + BigInt(candidate.confirmedNoWei) > 0n;
    await prisma.liquidityPosition.update({ where: { id: candidate.id }, data: {
      seedStatus: 'SKIPPED', waitReason: market.currency.toLowerCase() !== zeroAddress ? 'NON_NATIVE' : 'DEADLINE',
      slotHeld: hasStake, completedAt: hasStake ? null : new Date(),
    } });
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: candidate.id,
      contractMarketId: candidate.contractMarketId, code: 'liquidity-market-skipped', severity: 'WARNING', message: `Market ${candidate.contractMarketId} is no longer eligible for new maker bets.` });
    return 'skipped';
  }
  if (paused) {
    await prisma.liquidityPosition.update({ where: { id: candidate.id }, data: { waitReason: 'CONTRACT_PAUSED' } });
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: candidate.id,
      contractMarketId: candidate.contractMarketId, code: 'liquidity-contract-paused', severity: 'WARNING', action: 'SEED', message: 'Contract pause prevents maker deposits.' });
    return 'blocked';
  }
  const reserved = await reserveLiquidityPosition(ctx.identity, candidate.contractMarketId);
  if (!reserved) return 'blocked';
  const target = BigInt(reserved.targetPerSideWei!);
  const minimum = await ctx.client.readContract({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'minBetWei' });
  const chain = await ctx.client.readContract({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI,
    functionName: 'getPosition', args: [id, ctx.identity.walletAddress] });
  if (chain.claimed || chain.yesAmount !== BigInt(reserved.confirmedYesWei) || chain.noAmount !== BigInt(reserved.confirmedNoWei) || chain.yesAmount > target || chain.noAmount > target) {
    await prisma.liquidityPosition.update({ where: { id: reserved.id }, data: { seedStatus: 'ATTENTION', lastErrorCode: 'POSITION_MISMATCH' } });
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: reserved.id,
      contractMarketId: reserved.contractMarketId, code: 'liquidity-transaction-unknown', severity: 'CRITICAL', action: 'POSITION', message: 'Maker position differs from verified receipt totals; no new stake signed.' });
    return 'blocked';
  }
  if (target < minimum) {
    const retired = await holdOrRetireBelowMinimum(reserved.id);
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: reserved.id,
      contractMarketId: reserved.contractMarketId, code: 'liquidity-below-minimum', severity: 'WARNING',
      message: `Reserved target ${target} is below the contract minimum ${minimum} for market ${reserved.contractMarketId}. ${retired ? 'No stake was sent and its capacity slot was released. Increase the configured amount for future markets.' : 'Existing stake or an unresolved transaction retains its slot for recovery and settlement; do not change this target.'}` });
    return 'blocked';
  }
  if (chain.yesAmount === target && chain.noAmount === target) {
    await prisma.liquidityPosition.update({ where: { id: reserved.id }, data: { seedStatus: 'SEEDED', waitReason: null } });
    return 'seeded';
  }
  const operation = chain.yesAmount < target ? 'YES_SEED' : 'NO_SEED';
  const value = target - (operation === 'YES_SEED' ? chain.yesAmount : chain.noAmount);
  // Only exact zero/target states are valid for v1; no top-up or rebalance.
  if ((operation === 'YES_SEED' && chain.yesAmount !== 0n) || (operation === 'NO_SEED' && chain.noAmount !== 0n)) {
    await prisma.liquidityPosition.update({ where: { id: reserved.id }, data: { seedStatus: 'ATTENTION', lastErrorCode: 'UNEXPECTED_PARTIAL_SIDE' } });
    return 'blocked';
  }
  const balance = await ctx.client.getBalance({ address: ctx.identity.walletAddress });
  const principal = value * (chain.yesAmount === 0n && chain.noAmount === 0n ? 2n : 1n);
  if (balance < principal) {
    await prisma.liquidityPosition.update({ where: { id: reserved.id }, data: { waitReason: 'INSUFFICIENT_FUNDS', lastErrorCode: 'INSUFFICIENT_FUNDS', lastAttemptAt: new Date(), seedStatus: principal === value ? 'PARTIAL' : 'QUEUED' } });
    if (principal !== value) await releaseUnfundedReservation(reserved.id);
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: reserved.id,
      contractMarketId: reserved.contractMarketId, code: 'liquidity-funding-required', severity: 'WARNING', action: operation,
      message: `Maker wallet balance ${balance} cannot cover ${operation} principal for market ${reserved.contractMarketId}; shortfall ${principal - balance} base units plus gas.` });
    return 'blocked';
  }
  const fees = await ctx.client.estimateFeesPerGas();
  let gas: bigint;
  try {
    gas = await ctx.client.estimateContractGas({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI,
      functionName: 'placeBet', args: [id, operation === 'YES_SEED'], account: ctx.identity.walletAddress, value });
  } catch (error) {
    if (!isLiquidityFundingError(error)) throw error;
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: reserved.id,
      contractMarketId: reserved.contractMarketId, code: 'liquidity-funding-required', severity: 'WARNING', action: operation,
      message: `Maker wallet cannot afford the ${operation} transaction on market ${reserved.contractMarketId}.` });
    if (principal !== value) await releaseUnfundedReservation(reserved.id);
    return 'blocked';
  }
  const remainingSides = chain.yesAmount === 0n && chain.noAmount === 0n ? 2n : 1n;
  const needed = value * remainingSides + gas * fees.maxFeePerGas * remainingSides * 120n / 100n;
  if (balance < needed) {
    await prisma.liquidityPosition.update({ where: { id: reserved.id }, data: { waitReason: 'INSUFFICIENT_FUNDS', lastErrorCode: 'INSUFFICIENT_FUNDS', lastAttemptAt: new Date(), seedStatus: remainingSides === 1n ? 'PARTIAL' : 'QUEUED' } });
    if (remainingSides === 2n) await releaseUnfundedReservation(reserved.id);
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: reserved.id,
      contractMarketId: reserved.contractMarketId, code: 'liquidity-funding-required', severity: 'WARNING', action: operation,
      message: `Maker wallet balance ${balance} cannot cover market ${reserved.contractMarketId} ${operation}; estimated shortfall ${needed - balance} base units.` });
    if (remainingSides === 1n) await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: reserved.id,
      contractMarketId: reserved.contractMarketId, code: 'liquidity-partial-seed', severity: 'WARNING', message: `Only one side of market ${reserved.contractMarketId} is confirmed; missing ${operation}.` });
    return 'blocked';
  }
  await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-funding-required', reserved.contractMarketId, operation);
  await prisma.liquidityPosition.update({ where: { id: reserved.id }, data: { seedStatus: remainingSides === 1n ? 'PARTIAL' : 'SEEDING', lastAttemptAt: new Date() } });
  let transaction;
  try { transaction = await executeLiquidityOperation(ctx, reserved, operation, value); }
  catch (error) {
    if (!isLiquidityFundingError(error)) throw error;
    await prisma.liquidityPosition.update({ where: { id: reserved.id }, data: { waitReason: 'INSUFFICIENT_FUNDS', lastErrorCode: 'INSUFFICIENT_FUNDS', lastAttemptAt: new Date(), seedStatus: remainingSides === 1n ? 'PARTIAL' : 'QUEUED' } });
    if (remainingSides === 2n) await releaseUnfundedReservation(reserved.id);
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: reserved.id,
      contractMarketId: reserved.contractMarketId, code: 'liquidity-funding-required', severity: 'WARNING', action: operation,
      message: `Maker wallet cannot afford ${operation} on market ${reserved.contractMarketId} after a fresh gas check.` });
    return 'blocked';
  }
  try { await ctx.client.waitForTransactionReceipt({ hash: transaction.transactionHash as Hex, timeout: 10_000 }); } catch { /* Keep the saved envelope. */ }
  const result = await reconcileTransaction(ctx, await prisma.liquidityTransaction.findUniqueOrThrow({ where: { id: transaction.id } }));
  if (result === 'confirmed' && operation === 'YES_SEED') {
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: reserved.id,
      contractMarketId: reserved.contractMarketId, code: 'liquidity-partial-seed', severity: 'WARNING', message: `YES confirmed for market ${reserved.contractMarketId}; NO remains to be placed.` });
  }
  return result === 'confirmed' ? operation === 'YES_SEED' ? 'partial' : 'seeded' : 'in_flight';
}

/** Internal dependency-injection seam for failure-injection tests. */
export async function runWithContext(ctx: LiquidityTransactionContext, startedAt: number): Promise<LiquidityTickResult> {
  const result = empty('ready');
  const stateId = `${ctx.identity.deploymentKey}:${ctx.identity.walletAddress.toLowerCase()}`;
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  const block = await ctx.client.getBlockNumber();
  const balance = await ctx.client.getBalance({ address: ctx.identity.walletAddress, blockNumber: block });
  await prisma.liquidityWorkerState.update({ where: { id: stateId }, data: {
    balanceWei: balance.toString(), balanceBlockNumber: block, balanceObservedAt: new Date(), lastHeartbeatAt: new Date(), currentFailure: null,
  } });
  const unresolved = await reconcileUnresolved(ctx);
  await prisma.liquidityWorkerState.update({ where: { id: stateId }, data: { lastReconciledAt: new Date() } });
  if (unresolved !== 'clear') return { ...result, status: unresolved === 'unknown' ? 'blocked' : 'in_flight' };
  let prepared = 0;
  const positions = await prisma.liquidityPosition.findMany({ where: { deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), slotHeld: true }, orderBy: { contractMarketId: 'asc' }, take: LIQUIDITY_CANDIDATE_LIMIT });
  for (const position of positions) {
    if (Date.now() - startedAt > LIQUIDITY_WORK_SECONDS) break;
    if (BigInt(position.confirmedYesWei) + BigInt(position.confirmedNoWei) === 0n) continue;
    const market = await readMarket(ctx.client, ctx.identity.contractAddress, BigInt(position.contractMarketId));
    if (market.status < 2) continue;
    if (prepared >= LIQUIDITY_TX_LIMIT) break;
    const before = await prisma.liquidityTransaction.count({ where: { positionId: position.id } });
    let outcome: Awaited<ReturnType<typeof processLiquidityClaim>>;
    try { outcome = await processLiquidityClaim(ctx, position); }
    catch (error) {
      const safe = redactError(error);
      await prisma.liquidityPosition.update({ where: { id: position.id }, data: { lastErrorCode: 'CLAIM_CHECK_FAILED', lastError: safe, lastAttemptAt: new Date() } });
      await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
        contractMarketId: position.contractMarketId, code: 'liquidity-worker-failed', severity: 'WARNING', action: 'CLAIM', message: `Claim check failed for market ${position.contractMarketId}: ${safe}` });
      result.errors++;
      return { ...result, status: 'failed' };
    }
    const afterFirst = await prisma.liquidityTransaction.count({ where: { positionId: position.id } });
    prepared += afterFirst - before;
    await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-worker-failed', position.contractMarketId, 'CLAIM');
    if (outcome === 'claimed' || outcome === 'no_payout') result.claimed++;
    else if (outcome === 'blocked') result.blocked++;
    else if (outcome === 'in_flight') return { ...result, status: 'in_flight' };
  }
  if (config.firstEligibleMarketId !== null) {
    await recoverScheduledIntents(ctx.client, ctx.identity.contractAddress, ctx.identity);
    result.reconciled += await discoverLiquidityMarkets(ctx.client, ctx.identity, config.firstEligibleMarketId);
    const known = await prisma.market.findMany({ where: { contractMarketId: { gte: config.firstEligibleMarketId }, liquidityClassification: 'PUBLIC', isTest: false,
      liquidityPositions: { none: { deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase() } } },
      orderBy: { contractMarketId: 'asc' }, take: LIQUIDITY_CANDIDATE_LIMIT });
    for (const market of known) await prisma.liquidityPosition.upsert({ where: { deploymentKey_walletAddress_contractMarketId: {
      deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), contractMarketId: market.contractMarketId,
    } }, create: { deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), contractMarketId: market.contractMarketId }, update: {} });
  }
  if (!config.seedingEnabled || config.firstEligibleMarketId === null) return { ...result, status: 'disabled' };
  if (balance < BigInt(config.seedAmountWei) * 2n) {
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), code: 'liquidity-funding-required', severity: 'WARNING',
      message: `Maker wallet has ${balance} base units; the next pair requires ${BigInt(config.seedAmountWei) * 2n} principal plus gas.` });
  } else await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-funding-required');
  const candidates = await prisma.liquidityPosition.findMany({ where: { deploymentKey: ctx.identity.deploymentKey,
    walletAddress: ctx.identity.walletAddress.toLowerCase(), completedAt: null, seedStatus: { in: ['QUEUED', 'SEEDING', 'PARTIAL'] } },
    orderBy: [{ slotHeld: 'desc' }, { contractMarketId: 'asc' }], take: LIQUIDITY_CANDIDATE_LIMIT });
  for (const position of candidates) {
    if (prepared >= LIQUIDITY_TX_LIMIT || Date.now() - startedAt > LIQUIDITY_WORK_SECONDS) break;
    const before = await prisma.liquidityTransaction.count({ where: { positionId: position.id } });
    let outcome: Awaited<ReturnType<typeof checkAndSeed>>;
    try { outcome = await checkAndSeed(ctx, position); }
    catch (error) {
      const safe = redactError(error);
      await prisma.liquidityPosition.update({ where: { id: position.id }, data: { lastErrorCode: 'SEED_CHECK_FAILED', lastError: safe, lastAttemptAt: new Date() } });
      await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
        contractMarketId: position.contractMarketId, code: 'liquidity-worker-failed', severity: 'WARNING', action: 'SEED', message: `Seed check failed for market ${position.contractMarketId}: ${safe}` });
      result.errors++;
      return { ...result, status: 'failed' };
    }
    const afterFirst = await prisma.liquidityTransaction.count({ where: { positionId: position.id } });
    prepared += afterFirst - before;
    if (outcome === 'partial' && prepared < LIQUIDITY_TX_LIMIT && Date.now() - startedAt <= LIQUIDITY_WORK_SECONDS) {
      try {
        const fresh = await prisma.liquidityPosition.findUniqueOrThrow({ where: { id: position.id } });
        outcome = await checkAndSeed(ctx, fresh);
      } catch (error) {
        const safe = redactError(error);
        await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
          contractMarketId: position.contractMarketId, code: 'liquidity-worker-failed', severity: 'WARNING', action: 'SEED', message: `Second-side check failed for market ${position.contractMarketId}: ${safe}` });
        result.errors++;
        return { ...result, status: 'failed' };
      }
      prepared += (await prisma.liquidityTransaction.count({ where: { positionId: position.id } })) - afterFirst;
    }
    await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-worker-failed', position.contractMarketId, 'SEED');
    if (outcome === 'seeded') result.seeded++;
    else if (outcome === 'blocked' || outcome === 'skipped') result.blocked++;
    else if (outcome === 'in_flight') return { ...result, status: 'in_flight' };
  }
  await prisma.liquidityWorkerState.update({ where: { id: stateId }, data: { lastReconciledAt: new Date(), currentFailure: null } });
  return result;
}

/** Both periodic and immediate deliveries enter this lease-protected service. */
export async function runLiquidityTick(trigger: string, startedAt = Date.now()): Promise<LiquidityTickResult> {
  const holder = randomUUID(); // Never use WorkerRun's non-unique "unrecorded" fallback as a signer lease holder.
  return recordWorkerRun('liquidity-tick', trigger, async () => {
    const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
    try {
      if (!process.env.MARKET_MAKER_PRIVATE_KEY) {
        if (config.seedingEnabled) throw new Error('Enabled liquidity wallet key unavailable');
        return { status: 'skipped', summary: empty('disabled') };
      }
      const ctx = await contextFromEnvironment(holder);
      if (!ctx) return { status: 'skipped', summary: empty('disabled') };
      const held = await withSignerLease(ctx.leaseId, holder, LIQUIDITY_LEASE_SECONDS, () => runWithContext(ctx, startedAt));
      if (!held.acquired) return { status: 'busy', summary: empty('busy') };
      await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-worker-failed');
      return { status: held.value.status === 'failed' ? 'failed' : 'succeeded', summary: held.value };
    } catch (error) {
      const safe = redactError(error);
      if (config.walletAddress && config.deploymentKey) {
        await prisma.liquidityWorkerState.updateMany({ where: { deploymentKey: config.deploymentKey, walletAddress: config.walletAddress }, data: { currentFailure: safe, lastHeartbeatAt: new Date(), ready: false } }).catch(() => {});
        await raiseLiquidityIncident({ deploymentKey: config.deploymentKey, walletAddress: config.walletAddress,
          code: 'liquidity-worker-failed', severity: 'CRITICAL', message: `Liquidity worker failed: ${safe}` }).catch(() => {});
      }
      throw new Error(`Liquidity tick failed: ${safe}`);
    }
  }).then((outcome) => outcome.summary);
}
