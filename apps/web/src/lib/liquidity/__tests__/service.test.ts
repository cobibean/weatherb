import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiquidityTransactionContext } from '../transactions';

const mock = vi.hoisted(() => ({ readMarket: vi.fn(), reserve: vi.fn(), release: vi.fn(), belowMinimum: vi.fn(), reconcileUnresolved: vi.fn(),
  reconcile: vi.fn(), execute: vi.fn(), discover: vi.fn(), recover: vi.fn(), incident: vi.fn(), resolve: vi.fn(),
  getBalance: vi.fn(), read: vi.fn(), updatePosition: vi.fn(), count: vi.fn(), position: vi.fn() }));
vi.mock('@/lib/cron/market-state', () => ({ readMarket: mock.readMarket, requireRestartContract: vi.fn() }));
vi.mock('../positions', () => ({ reserveLiquidityPosition: mock.reserve, releaseUnfundedReservation: mock.release,
  holdOrRetireBelowMinimum: mock.belowMinimum }));
vi.mock('../transactions', () => ({ executeLiquidityOperation: mock.execute, reconcileTransaction: mock.reconcile,
  reconcileUnresolved: mock.reconcileUnresolved, isLiquidityFundingError: (error: unknown) => error instanceof Error && /insufficient funds/.test(error.message) }));
vi.mock('../discovery', () => ({ discoverLiquidityMarkets: mock.discover, recoverScheduledIntents: mock.recover }));
vi.mock('../events', () => ({ raiseLiquidityIncident: mock.incident, resolveLiquidityIncident: mock.resolve }));
vi.mock('../claims', () => ({ processLiquidityClaim: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: {
  liquidityConfig: { findUniqueOrThrow: async () => ({ seedingEnabled: true, firstEligibleMarketId: 7, seedAmountWei: '2500000000000000000' }) },
  liquidityWorkerState: { update: vi.fn(async () => ({})) },
  liquidityPosition: { findMany: mock.position, findUniqueOrThrow: async () => currentPosition, update: mock.updatePosition, upsert: vi.fn() },
  liquidityTransaction: { count: mock.count, findUniqueOrThrow: async () => ({ id: 'tx' }) },
  market: { findMany: async () => [], findUniqueOrThrow: async () => ({ liquidityClassification: 'PUBLIC', isTest: false }) },
} }));
import { assertMakerIsNotOnChainRole, runWithContext } from '../service';

const target = 2500000000000000000n;
let yes = 0n;
let no = 0n;
let transactionCount = 0;
let currentPosition: Record<string, unknown>;
const client = {
  getBlockNumber: async () => 100n,
  getBlock: async () => ({ timestamp: 100n }),
  getBalance: mock.getBalance,
  readContract: mock.read,
  estimateFeesPerGas: async () => ({ maxFeePerGas: 1n }),
  estimateContractGas: async () => 100n,
  waitForTransactionReceipt: async () => ({}),
};
const ctx = { client, identity: { deploymentKey: 'deployment', contractAddress: '0x0000000000000000000000000000000000000002',
  walletAddress: '0x0000000000000000000000000000000000000001' } } as unknown as LiquidityTransactionContext;

describe('liquidity service pair progression', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    yes = 0n; no = 0n; transactionCount = 0;
    currentPosition = { id: 'position', contractMarketId: 7, confirmedYesWei: '0', confirmedNoWei: '0',
      targetPerSideWei: target.toString(), seedStatus: 'QUEUED', slotHeld: false };
    mock.getBalance.mockResolvedValue(20n * 10n ** 18n);
    mock.readMarket.mockResolvedValue({ status: 0, bettingDeadline: 1000n,
      currency: '0x0000000000000000000000000000000000000000' });
    mock.read.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'isPaused') return false;
      if (functionName === 'minBetWei') return 10000000000000000n;
      if (functionName === 'getPosition') return { yesAmount: yes, noAmount: no, claimed: false };
      throw new Error(`unexpected ${functionName}`);
    });
    mock.reserve.mockImplementation(async () => currentPosition);
    mock.belowMinimum.mockResolvedValue(true);
    mock.position.mockImplementation(async ({ where }: { where: { slotHeld?: boolean } }) => where.slotHeld ? [] : [currentPosition]);
    mock.updatePosition.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { Object.assign(currentPosition, data); return currentPosition; });
    mock.count.mockImplementation(async () => transactionCount);
    mock.execute.mockImplementation(async (_ctx: unknown, _position: unknown, operation: string) => { transactionCount++; return { id: `tx-${transactionCount}`, transactionHash: `0x${transactionCount}` , operation }; });
    mock.reconcile.mockImplementation(async (_ctx: unknown, transaction: { operation?: string }) => {
      const operation = transaction.operation ?? (transactionCount === 1 ? 'YES_SEED' : 'NO_SEED');
      if (operation === 'YES_SEED') yes = target; else no = target;
      currentPosition.confirmedYesWei = yes.toString(); currentPosition.confirmedNoWei = no.toString();
      currentPosition.seedStatus = no > 0n ? 'SEEDED' : 'PARTIAL';
      return 'confirmed';
    });
    mock.reconcileUnresolved.mockResolvedValue('clear');
    mock.discover.mockResolvedValue(0); mock.recover.mockResolvedValue(0);
  });

  it('places both exact sides in one tick and counts a complete pair once', async () => {
    const result = await runWithContext(ctx, Date.now());
    expect(result).toMatchObject({ status: 'ready', seeded: 1, errors: 0 });
    expect(mock.execute.mock.calls.map((call) => [call[2], call[3]])).toEqual([['YES_SEED', target], ['NO_SEED', target]]);
    expect(transactionCount).toBe(2);
  });

  it('retains a partial position when funds vanish after YES, then completes after funding', async () => {
    mock.getBalance.mockResolvedValueOnce(20n * 10n ** 18n).mockResolvedValueOnce(20n * 10n ** 18n).mockResolvedValueOnce(1n);
    const first = await runWithContext(ctx, Date.now());
    expect(first).toMatchObject({ seeded: 0, blocked: 1 });
    expect(transactionCount).toBe(1);
    expect(currentPosition.seedStatus).toBe('PARTIAL');
    mock.getBalance.mockResolvedValue(20n * 10n ** 18n);
    const second = await runWithContext(ctx, Date.now());
    expect(second.seeded).toBe(1);
    expect(mock.execute.mock.calls.map((call) => call[2])).toEqual(['YES_SEED', 'NO_SEED']);
  });

  it('rejects a maker that holds an on-chain scheduler role despite distinct local keys', async () => {
    mock.read.mockImplementation(async ({ functionName }: { functionName: string }) => functionName === 'scheduler'
      ? ctx.identity.walletAddress : '0x0000000000000000000000000000000000000003');
    await expect(assertMakerIsNotOnChainRole(ctx.client, ctx.identity.contractAddress, ctx.identity.walletAddress)).rejects.toThrow(/on-chain/);
  });

  it('retires an unfunded below-minimum reservation so a later valid market can use the fifth slot', async () => {
    const first = currentPosition;
    const second: Record<string, unknown> = { ...first, id: 'later', contractMarketId: 8 };
    let held = 4;
    mock.position.mockImplementation(async ({ where }: { where: { slotHeld?: boolean } }) => where.slotHeld ? [] : [first, second]);
    mock.reserve.mockImplementation(async (_identity: unknown, marketId: number) => {
      if (marketId === 8 && second.slotHeld) return second;
      if (held >= 5) return null;
      held++;
      const reserved = marketId === 7 ? first : second;
      reserved.slotHeld = true;
      currentPosition = reserved;
      return reserved;
    });
    mock.belowMinimum.mockImplementation(async (id: string) => {
      expect(id).toBe('position');
      first.seedStatus = 'SKIPPED'; first.slotHeld = false; held--;
      return true;
    });
    mock.read.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'isPaused') return false;
      if (functionName === 'minBetWei') return mock.belowMinimum.mock.calls.length === 0 ? target + 1n : 1n;
      if (functionName === 'getPosition') return { yesAmount: yes, noAmount: no, claimed: false };
      throw new Error(`unexpected ${functionName}`);
    });
    const result = await runWithContext(ctx, Date.now());
    expect(result).toMatchObject({ blocked: 1, seeded: 1, errors: 0 });
    expect(mock.belowMinimum).toHaveBeenCalledOnce();
    expect(mock.reserve.mock.calls.map((call) => call[1])).toEqual([7, 8, 8]);
    expect(held).toBe(5);
    expect(mock.incident).toHaveBeenCalledWith(expect.objectContaining({ code: 'liquidity-below-minimum', contractMarketId: 7 }));
  });
});
