import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma from '@/lib/prisma';
import { reserveLiquidityPosition, holdOrRetireBelowMinimum } from '@/lib/liquidity/positions';
import { raiseLiquidityIncident, resolveLiquidityIncident, resolveTerminalSeedNotices } from '@/lib/liquidity/events';
import { runLiquidityTick } from '@/lib/liquidity/service';
import { recoverScheduledIntents } from '@/lib/liquidity/discovery';
import type { LiquidityIdentity } from '@/lib/liquidity/types';
import type { PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { TEST_PRIVATE_KEY_A } from '@/test/public-safe-fixtures';

const identity: LiquidityIdentity = {
  deploymentKey: '5042002:0x0000000000000000000000000000000000000001',
  contractAddress: '0x0000000000000000000000000000000000000001',
  walletAddress: privateKeyToAccount(TEST_PRIVATE_KEY_A).address,
};
const marketIds = [700010, 700011, 700012, 700013, 700014, 700015, 700016];
let cityId: string;

beforeAll(async () => {
  const city = await prisma.city.upsert({ where: { slug: 'liquidity-fixture' }, create: {
    slug: 'liquidity-fixture', name: 'Liquidity Fixture', latitude: 1, longitude: 1, timezone: 'UTC',
  }, update: {} });
  cityId = city.id;
  for (const id of marketIds) {
    await prisma.market.create({ data: { contractMarketId: id, cityId, cityName: city.name, latitude: 1, longitude: 1,
      timezone: 'UTC', thresholdTemp: 500, resolveTime: new Date(Date.now() + 86_400_000),
      liquidityClassification: 'PUBLIC', isTest: false } });
    await prisma.liquidityPosition.create({ data: { deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(), contractMarketId: id } });
  }
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  await prisma.liquidityConfig.update({ where: { id: 'default' }, data: { deploymentKey: identity.deploymentKey,
    walletAddress: identity.walletAddress.toLowerCase(), seedingEnabled: true,
    ...(config.firstEligibleMarketId === null ? { firstEligibleMarketId: 700000, activationBlockNumber: 100n, activatedAt: new Date() } : {}) } });
});
afterAll(async () => {
  await prisma.liquidityCreationIntent.deleteMany({ where: { deploymentKey: identity.deploymentKey } });
  await prisma.liquidityTransaction.deleteMany({ where: { deploymentKey: identity.deploymentKey } });
  await prisma.liquidityEvent.deleteMany({ where: { deploymentKey: identity.deploymentKey } });
  await prisma.liquidityPosition.deleteMany({ where: { deploymentKey: identity.deploymentKey } });
  await prisma.market.deleteMany({ where: { contractMarketId: { in: marketIds } } });
  await prisma.city.delete({ where: { id: cityId } });
});

describe('Liquidity capacity and storage constraints', () => {
  it('holds at most five slots across six concurrent reservations and snapshots the target', async () => {
    const results = await Promise.all(marketIds.slice(0, 6).map((id) => reserveLiquidityPosition(identity, id)));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(await prisma.liquidityPosition.count({ where: { deploymentKey: identity.deploymentKey, slotHeld: true } })).toBe(5);
    const held = await prisma.liquidityPosition.findMany({ where: { deploymentKey: identity.deploymentKey, slotHeld: true } });
    expect(held.every((p) => p.targetPerSideWei === '2500000000000000000')).toBe(true);
    await prisma.liquidityConfig.update({ where: { id: 'default' }, data: { seedAmountWei: '3000000000000000000', version: { increment: 1 } } });
    expect((await reserveLiquidityPosition(identity, marketIds[6]!))).toBeNull();
    await prisma.liquidityPosition.update({ where: { id: held[0]!.id }, data: { slotHeld: false, completedAt: new Date(), claimStatus: 'NO_PAYOUT' } });
    const next = await reserveLiquidityPosition(identity, marketIds[6]!);
    expect(next?.targetPerSideWei).toBe('3000000000000000000');
    expect(await prisma.liquidityPosition.count({ where: { deploymentKey: identity.deploymentKey, slotHeld: true } })).toBe(5);
  });

  it('keeps the activation boundary immutable in the database', async () => {
    await expect(prisma.liquidityConfig.update({ where: { id: 'default' }, data: { firstEligibleMarketId: 0 } })).rejects.toThrow();
    expect((await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } })).firstEligibleMarketId).toBe(700000);
  });

  it('releases an empty below-minimum slot but retains one with unresolved signed work', async () => {
    const held = await prisma.liquidityPosition.findMany({ where: { deploymentKey: identity.deploymentKey, slotHeld: true }, orderBy: { contractMarketId: 'asc' } });
    expect(held).toHaveLength(5);
    expect(await holdOrRetireBelowMinimum(held[0]!.id)).toBe(true);
    expect(await prisma.liquidityPosition.findUniqueOrThrow({ where: { id: held[0]!.id } })).toMatchObject({
      seedStatus: 'SKIPPED', waitReason: 'BELOW_MINIMUM', slotHeld: false,
    });
    const available = await prisma.liquidityPosition.findFirstOrThrow({ where: { deploymentKey: identity.deploymentKey,
      slotHeld: false, completedAt: null, seedStatus: 'QUEUED' } });
    expect(await reserveLiquidityPosition(identity, available.contractMarketId)).not.toBeNull();
    await prisma.liquidityTransaction.create({ data: {
      positionId: held[1]!.id, operation: 'YES_SEED', attempt: 1, deploymentKey: identity.deploymentKey,
      signerAddress: identity.walletAddress.toLowerCase(), nonce: 777, toAddress: identity.contractAddress,
      calldata: '0x1234', valueWei: '2500000000000000000', gasLimitWei: '100', maxFeePerGasWei: '1',
      maxPriorityFeePerGasWei: '0', signedTransaction: '0xfixture', transactionHash: `0x${'7'.repeat(64)}`,
    } });
    expect(await holdOrRetireBelowMinimum(held[1]!.id)).toBe(false);
    expect(await prisma.liquidityPosition.findUniqueOrThrow({ where: { id: held[1]!.id } })).toMatchObject({
      seedStatus: 'ATTENTION', waitReason: 'BELOW_MINIMUM', slotHeld: true,
    });
    await prisma.liquidityTransaction.deleteMany({ where: { positionId: held[1]!.id } });
  });

  it('resolves the exact action-scoped notice and retains recovery history', async () => {
    const args = { deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(),
      contractMarketId: marketIds[0]!, code: 'liquidity-claim-gas-required', action: 'CLAIM',
      severity: 'WARNING' as const, message: 'Needs gas' };
    await raiseLiquidityIncident(args);
    await raiseLiquidityIncident(args);
    expect(await prisma.liquidityEvent.count({ where: { deploymentKey: identity.deploymentKey, incidentKey: { not: null }, resolvedAt: null } })).toBe(1);
    await resolveLiquidityIncident(identity.deploymentKey, args.code, args.contractMarketId, args.action);
    expect(await prisma.liquidityEvent.count({ where: { deploymentKey: identity.deploymentKey, incidentKey: { not: null }, resolvedAt: null } })).toBe(0);
    expect(await prisma.liquidityEvent.count({ where: { deploymentKey: identity.deploymentKey, code: 'liquidity-claim-gas-required-recovered' } })).toBe(1);
  });

  it('retires partial and funding notices with a terminal reason after a position finishes', async () => {
    const common = { deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(),
      contractMarketId: marketIds[1]!, severity: 'WARNING' as const, message: 'Action required' };
    await raiseLiquidityIncident({ ...common, code: 'liquidity-partial-seed' });
    await raiseLiquidityIncident({ ...common, code: 'liquidity-funding-required', action: 'NO_SEED' });
    await resolveTerminalSeedNotices(identity.deploymentKey, marketIds[1]!);
    expect(await prisma.liquidityEvent.count({ where: { deploymentKey: identity.deploymentKey, contractMarketId: marketIds[1]!, incidentKey: { not: null }, resolvedAt: null } })).toBe(0);
    const history = await prisma.liquidityEvent.findMany({ where: { deploymentKey: identity.deploymentKey, contractMarketId: marketIds[1]!, code: { endsWith: '-recovered' } } });
    expect(history).toHaveLength(2);
    expect(history.every((event) => event.message.includes('completed on chain'))).toBe(true);
  });

  it('rotates past 25 unresolved creation intents and clears a failed recheck notice', async () => {
    await prisma.liquidityCreationIntent.createMany({ data: Array.from({ length: 26 }, (_, slot) => ({
      deploymentKey: identity.deploymentKey, intentKey: `scheduled:rotation-${slot}`, source: 'scheduled', isTest: false,
      slot: BigInt(slot),
    })) });
    let firstZero = true;
    const checked: bigint[] = [];
    const client = { readContract: async ({ args }: { args: [bigint] }) => {
      checked.push(args[0]);
      if (args[0] === 0n && firstZero) { firstZero = false; throw new Error('temporary scheduled lookup failure'); }
      return 0n;
    } } as unknown as PublicClient;
    expect(await recoverScheduledIntents(client, identity.contractAddress, identity)).toBe(0);
    expect(checked).toHaveLength(25);
    expect(await prisma.liquidityEvent.count({ where: { deploymentKey: identity.deploymentKey,
      code: 'liquidity-creation-recovery-failed', resolvedAt: null } })).toBe(1);
    expect(await recoverScheduledIntents(client, identity.contractAddress, identity)).toBe(0);
    expect(checked).toContain(25n);
    expect(await prisma.liquidityCreationIntent.count({ where: { deploymentKey: identity.deploymentKey, lastCheckedAt: { not: null } } })).toBe(26);
    expect(await prisma.liquidityEvent.count({ where: { deploymentKey: identity.deploymentKey,
      code: 'liquidity-creation-recovery-failed', resolvedAt: null } })).toBe(0);
  });

  it('rejects duplicate transaction hash, signer nonce, and unresolved signer envelopes', async () => {
    const position = await prisma.liquidityPosition.findFirstOrThrow({ where: { deploymentKey: identity.deploymentKey } });
    const base = { positionId: position.id, operation: 'YES_SEED' as const, attempt: 1,
      deploymentKey: identity.deploymentKey, signerAddress: identity.walletAddress.toLowerCase(), nonce: 42,
      toAddress: identity.contractAddress, calldata: '0x1234', valueWei: '1', gasLimitWei: '1',
      maxFeePerGasWei: '1', maxPriorityFeePerGasWei: '1', signedTransaction: '0xsigned', transactionHash: `0x${'1'.repeat(64)}` };
    await prisma.liquidityTransaction.create({ data: base });
    await expect(prisma.liquidityTransaction.create({ data: { ...base, attempt: 2 } })).rejects.toThrow();
    await expect(prisma.liquidityTransaction.create({ data: { ...base, attempt: 2, transactionHash: `0x${'2'.repeat(64)}` } })).rejects.toThrow();
    await expect(prisma.liquidityTransaction.create({ data: { ...base, attempt: 2, nonce: 43, transactionHash: `0x${'2'.repeat(64)}` } })).rejects.toThrow();
    await prisma.liquidityTransaction.update({ where: { transactionHash: base.transactionHash }, data: { status: 'REVERTED' } });
    await prisma.liquidityTransaction.create({ data: { ...base, attempt: 2, nonce: 43, transactionHash: `0x${'2'.repeat(64)}` } });
  });

  it('denies app access to signed envelopes and worker lifecycle writes while allowing worker access', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE weatherb_app');
      const grants = await tx.$queryRaw<Array<{ signed_read: boolean; position_write: boolean; config_read: boolean }>>`
        SELECT has_table_privilege(current_user, 'public."LiquidityTransaction"', 'SELECT') AS signed_read,
          has_table_privilege(current_user, 'public."LiquidityPosition"', 'UPDATE') AS position_write,
          has_table_privilege(current_user, 'public."LiquidityConfig"', 'SELECT') AS config_read`;
      expect(grants).toEqual([{ signed_read: false, position_write: false, config_read: true }]);
      expect(await tx.liquidityPosition.count()).toBeGreaterThan(0);
    });
    await expect(prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE weatherb_app');
      await tx.liquidityTransaction.count();
    })).rejects.toThrow();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE weatherb_worker');
      expect(await tx.liquidityTransaction.count()).toBeGreaterThan(0);
      expect(await tx.liquidityPosition.count()).toBeGreaterThan(0);
      const config = await tx.liquidityConfig.update({ where: { id: 'default' }, data: {
        deploymentKey: identity.deploymentKey, walletAddress: identity.walletAddress.toLowerCase(),
      } });
      expect(config.walletAddress).toBe(identity.walletAddress.toLowerCase());
    });
  });

  it('records an actionable incident when an enabled worker loses its key', async () => {
    const previous = process.env.MARKET_MAKER_PRIVATE_KEY;
    process.env.MARKET_MAKER_PRIVATE_KEY = '';
    try {
      await expect(runLiquidityTick('test:missing-key')).rejects.toThrow(/key unavailable/);
      expect(await prisma.liquidityEvent.count({ where: { deploymentKey: identity.deploymentKey,
        code: 'liquidity-worker-failed', resolvedAt: null } })).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.MARKET_MAKER_PRIVATE_KEY;
      else process.env.MARKET_MAKER_PRIVATE_KEY = previous;
    }
  });
});
