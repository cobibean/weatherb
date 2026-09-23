import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiquidityPosition } from '@prisma/client';
import type { LiquidityTransactionContext } from '../transactions';
import { encodeAbiParameters, encodeEventTopics } from 'viem';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';

const mock = vi.hoisted(() => ({ readMarket: vi.fn(), noPayout: vi.fn(), execute: vi.fn(), reconcile: vi.fn(),
  read: vi.fn(), update: vi.fn(), findTx: vi.fn(), txById: vi.fn(), incident: vi.fn(), resolve: vi.fn(),
  logs: vi.fn(), receipt: vi.fn(), event: vi.fn(), balance: vi.fn(), gas: vi.fn() }));
vi.mock('@/lib/cron/market-state', () => ({ readMarket: mock.readMarket }));
vi.mock('../positions', () => ({ finishNoPayout: mock.noPayout }));
vi.mock('../transactions', () => ({ executeLiquidityOperation: mock.execute, reconcileTransaction: mock.reconcile,
  isLiquidityFundingError: (error: unknown) => error instanceof Error && /insufficient funds/.test(error.message) }));
vi.mock('../events', () => ({ raiseLiquidityIncident: mock.incident, resolveLiquidityIncident: mock.resolve,
  resolveTerminalSeedNotices: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: {
  liquidityConfig: { findUniqueOrThrow: async () => ({ claimsEnabled: true, activationBlockNumber: 0n }) },
  liquidityPosition: { update: mock.update },
  liquidityTransaction: { findFirst: mock.findTx, findUniqueOrThrow: mock.txById },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ liquidityPosition: {
    findUniqueOrThrow: async () => ({ ...position, gasSpentWei: '0', claimStatus: 'ATTENTION' }), update: mock.update,
  }, liquidityEvent: { create: mock.event } }),
} }));
import { processLiquidityClaim } from '../claims';

const position = { id: 'position', contractMarketId: 7, confirmedYesWei: '2500000000000000000',
  confirmedNoWei: '2500000000000000000', completedAt: null } as LiquidityPosition;
const chainPosition = (yesAmount: bigint, noAmount: bigint, claimed = false) => ({ yesAmount, noAmount, claimed });
const client = {
  getBlockNumber: async () => 100n,
  readContract: mock.read,
  getBalance: mock.balance,
  estimateFeesPerGas: async () => ({ maxFeePerGas: 1n }),
  estimateContractGas: mock.gas,
  waitForTransactionReceipt: async () => ({ status: 'success' }),
  getLogs: mock.logs,
  getTransactionReceipt: mock.receipt,
};
const ctx = { client, identity: { contractAddress: '0x0000000000000000000000000000000000000002',
  walletAddress: '0x0000000000000000000000000000000000000001', deploymentKey: 'deployment' } } as unknown as LiquidityTransactionContext;

describe('maker payout lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.readMarket.mockResolvedValue({ status: 2, outcome: true });
    mock.read.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'getPosition') return chainPosition(2500000000000000000n, 2500000000000000000n);
      if (functionName === 'isPaused') return false;
      if (functionName === 'calculatePayout') return 4000000000000000000n;
      throw new Error(`unexpected read ${functionName}`);
    });
    mock.execute.mockResolvedValue({ id: 'transaction', transactionHash: '0x1234' });
    mock.txById.mockResolvedValue({ id: 'transaction' });
    mock.reconcile.mockResolvedValue('confirmed');
    mock.update.mockResolvedValue({});
    mock.noPayout.mockResolvedValue({});
    mock.findTx.mockResolvedValue(null);
    mock.logs.mockResolvedValue([]);
    mock.event.mockResolvedValue({});
    mock.balance.mockResolvedValue(1000000000000000000n);
    mock.gas.mockResolvedValue(100n);
  });

  it.each([true, false])('claims an actual winning payout for outcome %s', async (outcome) => {
    mock.readMarket.mockResolvedValue({ status: 2, outcome });
    expect(await processLiquidityClaim(ctx, position)).toBe('claimed');
    expect(mock.execute).toHaveBeenCalledWith(ctx, position, 'CLAIM', 0n);
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ claimableWei: '4000000000000000000' }) }));
  });

  it.each([3, 4])('claims a refund in terminal status %i', async (status) => {
    mock.readMarket.mockResolvedValue({ status, outcome: false });
    expect(await processLiquidityClaim(ctx, position)).toBe('claimed');
    expect(mock.execute).toHaveBeenCalledTimes(1);
  });

  it('completes a partial losing position without signing a zero-payout claim', async () => {
    const partial = { ...position, confirmedNoWei: '0' } as LiquidityPosition;
    mock.readMarket.mockResolvedValue({ status: 2, outcome: false });
    mock.read.mockImplementation(async ({ functionName }: { functionName: string }) => functionName === 'getPosition'
      ? chainPosition(2500000000000000000n, 0n) : false);
    expect(await processLiquidityClaim(ctx, partial)).toBe('no_payout');
    expect(mock.noPayout).toHaveBeenCalledWith(partial.id, 100n);
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it('never resends an already verified claim', async () => {
    mock.read.mockImplementation(async ({ functionName }: { functionName: string }) => functionName === 'getPosition'
      ? chainPosition(2500000000000000000n, 2500000000000000000n, true) : false);
    mock.findTx.mockResolvedValue({ id: 'prior' });
    expect(await processLiquidityClaim(ctx, position)).toBe('claimed');
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it('retains an unproven already-claimed slot and raises an incident', async () => {
    mock.read.mockImplementation(async ({ functionName }: { functionName: string }) => functionName === 'getPosition'
      ? chainPosition(2500000000000000000n, 2500000000000000000n, true) : false);
    expect(await processLiquidityClaim(ctx, position)).toBe('blocked');
    expect(mock.incident).toHaveBeenCalledWith(expect.objectContaining({ code: 'liquidity-claim-evidence-missing' }));
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ claimStatus: 'ATTENTION' }) }));
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it('recovers a verified payout event and releases the already-claimed slot', async () => {
    mock.read.mockImplementation(async ({ functionName }: { functionName: string }) => functionName === 'getPosition'
      ? chainPosition(2500000000000000000n, 2500000000000000000n, true) : false);
    const address = ctx.identity.walletAddress;
    const log = { address: ctx.identity.contractAddress, transactionHash: `0x${'a'.repeat(64)}`,
      logIndex: 0, topics: encodeEventTopics({ abi: WEATHER_MARKET_ABI, eventName: 'WinningsClaimed', args: { marketId: 7n, claimer: address } }),
      data: encodeAbiParameters([{ type: 'uint256' }], [4000000000000000000n]) };
    mock.logs.mockResolvedValue([log]);
    mock.receipt.mockResolvedValue({ status: 'success', from: address, to: ctx.identity.contractAddress,
      logs: [log], gasUsed: 100n, effectiveGasPrice: 2n, blockNumber: 100n });
    expect(await processLiquidityClaim(ctx, position)).toBe('claimed');
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      claimedAmountWei: '4000000000000000000', slotHeld: false, claimStatus: 'CLAIMED',
    }) }));
    expect(mock.event).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ code: 'liquidity-claim-recovered' }) }));
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it('waits for the signed 120 percent gas allowance and resumes after manual funding', async () => {
    mock.balance.mockResolvedValueOnce(110n).mockResolvedValue(1000n);
    expect(await processLiquidityClaim(ctx, position)).toBe('blocked');
    expect(mock.execute).not.toHaveBeenCalled();
    expect(mock.incident).toHaveBeenCalledWith(expect.objectContaining({ code: 'liquidity-claim-gas-required', action: 'CLAIM' }));
    expect(await processLiquidityClaim(ctx, position)).toBe('claimed');
    expect(mock.execute).toHaveBeenCalledTimes(1);
  });

  it('classifies an insufficient-funds gas-estimate error as a funding notice', async () => {
    mock.gas.mockRejectedValue(new Error('insufficient funds for gas'));
    expect(await processLiquidityClaim(ctx, position)).toBe('blocked');
    expect(mock.incident).toHaveBeenCalledWith(expect.objectContaining({ code: 'liquidity-claim-gas-required' }));
  });
});
