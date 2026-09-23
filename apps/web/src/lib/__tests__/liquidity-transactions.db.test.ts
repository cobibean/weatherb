import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import prisma from '@/lib/prisma';
import { TEST_PRIVATE_KEY_A } from '@/test/public-safe-fixtures';
import { broadcastSavedTransaction, executeLiquidityOperation, prepareLiquidityTransaction, reconcileUnresolved, type LiquidityTransactionContext } from '@/lib/liquidity/transactions';
import { raiseLiquidityIncident } from '@/lib/liquidity/events';

const account = privateKeyToAccount(TEST_PRIVATE_KEY_A);
const contractAddress = '0x0000000000000000000000000000000000000001' as Hex;
const deploymentKey = `5042002:${contractAddress}`;
const marketId = 700100;
const leaseId = `liquidity:5042002:${account.address.toLowerCase()}`;
const holder = 'journal-db-test';
let cityId: string;
let positionId: string;
const sent: Hex[] = [];
let failFirst = true;
const market = { cityId: `0x${'1'.repeat(64)}` as Hex, resolveTime: 3000n, bettingDeadline: 2000n,
  thresholdTenths: 500n, currency: '0x0000000000000000000000000000000000000000' as Hex,
  status: 0, yesPool: 0n, noPool: 0n, totalFees: 0n, resolvedTempTenths: 0n, observedTimestamp: 0n, outcome: false };
const fakeClient = {
  getTransactionCount: vi.fn(async () => 7),
  estimateGas: vi.fn(async () => 50000n),
  estimateFeesPerGas: vi.fn(async () => ({ maxFeePerGas: 1000000000n, maxPriorityFeePerGas: 100000000n })),
  getBalance: vi.fn(async () => 10000000000000000000n),
  readContract: vi.fn(async ({ functionName }: { functionName: string }) => functionName === 'getMarket' ? market : false),
  getBlock: vi.fn(async () => ({ timestamp: 1000n })),
  getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => { throw new TransactionReceiptNotFoundError({ hash }); }),
  getTransaction: vi.fn(async ({ hash }: { hash: Hex }) => { throw new TransactionNotFoundError({ hash }); }),
  sendRawTransaction: vi.fn(async ({ serializedTransaction }: { serializedTransaction: Hex }) => {
    sent.push(serializedTransaction);
    if (failFirst) { failFirst = false; throw new Error('RPC timeout after accepting the bytes'); }
    return '0xaccepted';
  }),
} as unknown as PublicClient;
const ctx: LiquidityTransactionContext = {
  client: fakeClient, account,
  identity: { deploymentKey, contractAddress, walletAddress: account.address }, leaseId, holder,
};

beforeAll(async () => {
  const city = await prisma.city.upsert({ where: { slug: 'liquidity-journal-fixture' }, create: {
    slug: 'liquidity-journal-fixture', name: 'Journal Fixture', latitude: 1, longitude: 1, timezone: 'UTC',
  }, update: {} });
  cityId = city.id;
  await prisma.market.create({ data: { contractMarketId: marketId, cityId, cityName: city.name,
    latitude: 1, longitude: 1, timezone: 'UTC', thresholdTemp: 500,
    resolveTime: new Date(Date.now() + 86_400_000), liquidityClassification: 'PUBLIC' } });
  const position = await prisma.liquidityPosition.create({ data: { deploymentKey, walletAddress: account.address.toLowerCase(), contractMarketId: marketId,
    slotHeld: true, targetPerSideWei: '2500000000000000000', seedStatus: 'SEEDING' } });
  positionId = position.id;
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  await prisma.liquidityConfig.update({ where: { id: 'default' }, data: { deploymentKey, walletAddress: account.address.toLowerCase(), seedingEnabled: true,
    ...(config.firstEligibleMarketId === null ? { firstEligibleMarketId: 700000, activationBlockNumber: 100n, activatedAt: new Date() } : {}) } });
  await prisma.workerLease.upsert({ where: { id: leaseId }, create: { id: leaseId, holder, expiresAt: new Date(Date.now() + 60_000) },
    update: { holder, expiresAt: new Date(Date.now() + 60_000) } });
});
afterAll(async () => {
  await prisma.liquidityTransaction.deleteMany({ where: { positionId } });
  await prisma.liquidityEvent.deleteMany({ where: { positionId } });
  await prisma.liquidityPosition.delete({ where: { id: positionId } });
  await prisma.market.delete({ where: { contractMarketId: marketId } });
  await prisma.city.delete({ where: { id: cityId } });
  await prisma.workerLease.delete({ where: { id: leaseId } });
});

describe('Durable market-maker envelope', () => {
  it('does not broadcast when persistence rejects the signed envelope', async () => {
    const row = await prisma.liquidityPosition.findUniqueOrThrow({ where: { id: positionId } });
    await expect(executeLiquidityOperation(ctx, { ...row, id: 'missing-position' }, 'YES_SEED', 2500000000000000000n)).rejects.toThrow();
    expect(sent).toHaveLength(0);
    expect(await prisma.liquidityTransaction.count({ where: { positionId } })).toBe(0);
  });

  it('recovers timeout-after-broadcast using exactly the stored signed bytes and nonce', async () => {
    const row = await prisma.liquidityPosition.findUniqueOrThrow({ where: { id: positionId } });
    const transaction = await executeLiquidityOperation(ctx, row, 'YES_SEED', 2500000000000000000n);
    expect(sent).toHaveLength(1);
    const persisted = await prisma.liquidityTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
    expect(persisted.status).toBe('UNKNOWN');
    expect(persisted.signedTransaction).toBe(sent[0]);
    expect(persisted.nonce).toBe(7);
    expect(await reconcileUnresolved(ctx)).toBe('pending');
    expect(sent).toEqual([persisted.signedTransaction, persisted.signedTransaction]);
    expect(await prisma.liquidityTransaction.count({ where: { positionId } })).toBe(1);
    expect((await prisma.liquidityTransaction.findUniqueOrThrow({ where: { id: transaction.id } })).nonce).toBe(7);
  });

  it('shows a persistent notice after six minutes even when the saved hash is not found', async () => {
    const transaction = await prisma.liquidityTransaction.findFirstOrThrow({ where: { positionId, operation: 'YES_SEED' } });
    await prisma.liquidityTransaction.update({ where: { id: transaction.id }, data: { preparedAt: new Date(Date.now() - 361_000) } });
    expect(await reconcileUnresolved(ctx)).toBe('pending');
    expect(sent.at(-1)).toBe(transaction.signedTransaction);
    expect(await prisma.liquidityEvent.findFirst({ where: { deploymentKey, code: 'liquidity-transaction-pending', resolvedAt: null } })).toMatchObject({
      contractMarketId: marketId,
      message: expect.stringContaining('not currently found'),
    });
    expect(await prisma.liquidityTransaction.count({ where: { positionId } })).toBe(1);
  });

  it('closes pending and unknown notices after a proved reverted receipt', async () => {
    const common = { deploymentKey, walletAddress: account.address.toLowerCase(), contractMarketId: marketId,
      severity: 'WARNING' as const, message: 'Investigate', action: 'YES_SEED' };
    await raiseLiquidityIncident({ ...common, code: 'liquidity-transaction-pending' });
    await raiseLiquidityIncident({ ...common, code: 'liquidity-transaction-unknown' });
    vi.mocked(fakeClient.getTransactionReceipt).mockResolvedValue({ status: 'reverted', from: account.address, to: contractAddress,
      gasUsed: 100n, effectiveGasPrice: 2n, blockNumber: 101n, blockHash: `0x${'1'.repeat(64)}`, logs: [] } as never);
    expect(await reconcileUnresolved(ctx)).toBe('clear');
    expect(await prisma.liquidityEvent.count({ where: { deploymentKey, incidentKey: { not: null }, resolvedAt: null } })).toBe(0);
    expect(await prisma.liquidityEvent.count({ where: { deploymentKey, code: { endsWith: '-recovered' } } })).toBe(2);
  });

  it('accepts a zero priority fee but never broadcasts a saved claim while the contract is paused', async () => {
    const pausedClient = { ...fakeClient,
      getTransactionCount: async () => 8,
      estimateFeesPerGas: async () => ({ maxFeePerGas: 1000000000n, maxPriorityFeePerGas: 0n }),
      readContract: async ({ functionName }: { functionName: string }) => functionName === 'getMarket'
        ? { ...market, status: 2 } : functionName === 'isPaused' ? true : { yesAmount: 0n, noAmount: 0n, claimed: false },
    } as unknown as PublicClient;
    const pausedCtx = { ...ctx, client: pausedClient };
    const row = await prisma.liquidityPosition.findUniqueOrThrow({ where: { id: positionId } });
    const transaction = await prepareLiquidityTransaction(pausedCtx, row, 'CLAIM', 0n);
    expect(transaction.maxPriorityFeePerGasWei).toBe('0');
    await broadcastSavedTransaction(pausedCtx, transaction);
    expect(sent).toHaveLength(3);
    expect((await prisma.liquidityTransaction.findUniqueOrThrow({ where: { id: transaction.id } })).status).toBe('PREPARED');
  });
});
