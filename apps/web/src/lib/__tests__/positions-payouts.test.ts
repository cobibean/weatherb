import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keccak256, toBytes } from 'viem';
import {
  fetchUserPositions,
  serializePosition,
  deserializePosition,
  calculateUserStats,
} from '@/lib/positions';
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('viem', async (original) => ({
  ...(await original<typeof import('viem')>()),
  createPublicClient: () => ({ getChainId: async () => 5042002, readContract: mocks.read }),
}));
vi.mock('@/lib/prisma', () => ({ default: { city: { findMany: vi.fn() } } }));
beforeEach(() => {
  vi.resetAllMocks();
});
const wallet = '0x0000000000000000000000000000000000000002';
function fixture(status: number, claimed = false): void {
  mocks.read.mockImplementation(async ({ functionName }) => {
    if (functionName === 'getMarketCount') return 1n;
    if (functionName === 'getPosition')
      return { yesAmount: 1000000000000000001n, noAmount: 2000000000000000002n, claimed };
    if (functionName === 'getMarket')
      return {
        cityId: keccak256(toBytes('nyc')),
        resolveTime: 1800000000n,
        status,
        yesPool: 1000000000000000001n,
        noPool: 2000000000000000002n,
        thresholdTenths: 850n,
        resolvedTempTenths: 850n,
        outcome: true,
      };
    if (functionName === 'calculatePayout') return 0n; // The zero that previously bypassed fallback.
    throw new Error('Unexpected RPC');
  });
}
describe('Refund position amounts', () => {
  it.each([3, 4])(
    'shows the entire refund for terminal status %i even with a zero getter',
    async (status) => {
      fixture(status);
      const [position] = await fetchUserPositions(wallet);
      expect(position).toMatchObject({
        status: 'refundable',
        betSide: 'BOTH',
        betAmount: 3000000000000000003n,
        claimableAmount: 3000000000000000003n,
      });
      expect(serializePosition(position!).claimableAmount).toBe('3000000000000000003');
      expect(calculateUserStats([position!]).totalClaimable).toBe(3000000000000000003n);
    },
  );
  it('does not present an already-refunded position as payable', async () => {
    fixture(3, true);
    const [position] = await fetchUserPositions(wallet);
    expect(position?.status).toBe('refunded');
    expect(position?.claimableAmount).toBeUndefined();
  });
  it('does not turn a losing resolved position into a refund', async () => {
    fixture(2);
    expect((await fetchUserPositions(wallet))[0]).toMatchObject({
      status: 'lost',
      claimableAmount: 0n,
    });
  });
});

describe('Historical payouts and profit', () => {
  it.each([true, false])('keeps exact winnings across claiming (claimed=%s)', async (claimed) => {
    const payout = 606764705882352941n;
    mocks.read.mockImplementation(async ({ functionName }) => {
      if (functionName === 'getMarketCount') return 1n;
      if (functionName === 'getPosition')
        return { yesAmount: 100000000000000000n, noAmount: 500000000000000000n, claimed };
      if (functionName === 'getMarket')
        return {
          cityId: keccak256(toBytes('austin')),
          resolveTime: 1800000000n,
          status: 2,
          yesPool: 110000000000000000n,
          noPool: 510000000000000000n,
          totalFees: 1100000000000000n,
          thresholdTenths: 960n,
          resolvedTempTenths: 958n,
          outcome: false,
        };
      if (functionName === 'calculatePayout') return claimed ? 0n : payout;
      throw new Error('Unexpected RPC');
    });
    const [position] = await fetchUserPositions(wallet);
    expect(position).toBeDefined();
    expect(claimed ? position!.claimedAmount : position!.claimableAmount).toBe(payout);
    expect(deserializePosition(serializePosition(position!))).toEqual(position);
    const stats = calculateUserStats([position!]);
    expect(stats.totalWinnings).toBe(payout);
    expect(stats.totalClaimed).toBe(claimed ? payout : 0n);
    expect(stats.totalClaimable).toBe(claimed ? 0n : payout);
    expect(stats.netProfit).toBe(6764705882352941n);
    expect(stats.roi).toBeCloseTo(1.12745098);
    // Unresolved stakes must not turn a settled winner into a loss.
    const mixed = calculateUserStats([
      position!,
      {
        ...position!,
        marketId: '9',
        status: 'active',
        claimed: false,
        claimedAmount: 0n,
        claimableAmount: 0n,
        betAmount: 1000000000000000000n,
      },
    ]);
    expect(mixed.netProfit).toBe(stats.netProfit);
    expect(mixed.roi).toBe(stats.roi);
  });
  it.each([3, 4])('preserves claimed refunds without a false loss (status=%s)', async (status) => {
    fixture(status, true);
    const [position] = await fetchUserPositions(wallet);
    const stats = calculateUserStats([position!]);
    expect(position!.claimableAmount).toBeUndefined();
    expect(stats.totalClaimed).toBe(3000000000000000003n);
    expect(stats.totalClaimable).toBe(0n);
    expect(stats.netProfit).toBe(0n);
    expect(stats.roi).toBe(0);
    expect(stats.wins).toBe(0);
  });
});
