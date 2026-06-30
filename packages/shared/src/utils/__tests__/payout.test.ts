import { describe, it, expect } from 'vitest';
import {
  feeFromLosingPool,
  calculatePayoutForWinner,
  calculatePotentialPayout,
  getImpliedMultipliers,
  formatMultiplier,
  formatFlr,
} from '../payout';

describe('feeFromLosingPool', () => {
  it('calculates 1% fee correctly', () => {
    expect(feeFromLosingPool(100n * 10n ** 18n)).toBe(1n * 10n ** 18n);
  });

  it('handles small amounts without rounding errors', () => {
    // 0.01 ETH losing pool = 0.0001 ETH fee
    const losingPool = 10n ** 16n; // 0.01 ETH
    const fee = feeFromLosingPool(losingPool);
    expect(fee).toBe(10n ** 14n); // 0.0001 ETH
  });

  it('returns 0 for zero pool', () => {
    expect(feeFromLosingPool(0n)).toBe(0n);
  });
});

describe('calculatePayoutForWinner', () => {
  const ETH = 10n ** 18n;

  it('returns stake + proportional share of net losing pool', () => {
    // 1 ETH YES wins, 2 ETH NO loses
    // Fee: 0.02 ETH, net losing: 1.98 ETH
    // Payout: 1 + 1.98 = 2.98 ETH
    const payout = calculatePayoutForWinner(1n * ETH, 2n * ETH, 1n * ETH);
    expect(payout).toBe(2_980000000000000000n);
  });

  it('returns 0 if stake is 0', () => {
    expect(calculatePayoutForWinner(1n * ETH, 1n * ETH, 0n)).toBe(0n);
  });

  it('returns 0 if winning pool is 0', () => {
    expect(calculatePayoutForWinner(0n, 1n * ETH, 0n)).toBe(0n);
  });

  it('handles equal pools correctly', () => {
    // 1 ETH each side, stake 1 ETH
    // Fee: 0.01 ETH, net losing: 0.99 ETH
    // Payout: 1 + 0.99 = 1.99 ETH
    const payout = calculatePayoutForWinner(1n * ETH, 1n * ETH, 1n * ETH);
    expect(payout).toBe(1_990000000000000000n);
  });

  it('calculates proportional share for partial stake', () => {
    // 4 ETH YES pool, 4 ETH NO pool, stake 1 ETH (25% of YES)
    // Fee: 0.04 ETH, net losing: 3.96 ETH
    // Payout: 1 + (3.96 * 0.25) = 1 + 0.99 = 1.99 ETH
    const payout = calculatePayoutForWinner(4n * ETH, 4n * ETH, 1n * ETH);
    expect(payout).toBe(1_990000000000000000n);
  });

  it('matches Solidity PayoutMath exactly', () => {
    // Test case from contract: 1 ETH YES, 2 ETH NO, YES wins
    // Expected: 2.98 ETH payout
    const payout = calculatePayoutForWinner(
      1000000000000000000n,  // 1 ETH
      2000000000000000000n,  // 2 ETH
      1000000000000000000n   // 1 ETH stake
    );
    expect(payout).toBe(2980000000000000000n); // 2.98 ETH
  });
});

describe('calculatePotentialPayout', () => {
  const ETH = 10n ** 18n;

  it('calculates payout including new bet in pool', () => {
    // Existing: 1 ETH YES, 1 ETH NO
    // Bet 1 ETH on YES → new YES pool = 2 ETH
    // If YES wins: stake 1 + (0.99 * 1/2) = 1.495 ETH
    const result = calculatePotentialPayout(1n * ETH, 1n * ETH, 1n * ETH, 'yes');
    expect(result.payout).toBe(1_495000000000000000n);
    expect(result.multiplier).toBeCloseTo(1.495, 2);
  });

  it('returns 50/50 odds for empty pools', () => {
    const result = calculatePotentialPayout(0n, 0n, 0n, 'yes');
    expect(result.newYesPercent).toBe(50);
    expect(result.newNoPercent).toBe(50);
  });

  it('updates odds correctly after bet', () => {
    // 1 ETH YES, 1 ETH NO, bet 1 ETH YES → 2 ETH YES, 1 ETH NO
    // 2 / 3 = 66.666... % YES, 1/3 = 33.333...% NO
    // The implementation uses Number((yesPool * 100n) / totalPool) which truncates
    const result = calculatePotentialPayout(1n * ETH, 1n * ETH, 1n * ETH, 'yes');
    expect(result.newYesPercent).toBe(66); // Truncated from 66.666...
    expect(result.newNoPercent).toBe(34); // 100 - 66
  });
});

describe('getImpliedMultipliers', () => {
  const ETH = 10n ** 18n;

  it('returns 2x for equal pools', () => {
    // Equal pools = 2x multiplier for either side (minus 1% fee)
    const result = getImpliedMultipliers(1n * ETH, 1n * ETH);
    expect(result.yesMultiplier).toBeCloseTo(1.99, 2);
    expect(result.noMultiplier).toBeCloseTo(1.99, 2);
    expect(result.yesPercent).toBe(50);
    expect(result.noPercent).toBe(50);
  });

  it('returns 2x each for empty pools', () => {
    const result = getImpliedMultipliers(0n, 0n);
    expect(result.yesMultiplier).toBe(2.0);
    expect(result.noMultiplier).toBe(2.0);
  });

  it('returns high multiplier for underdog', () => {
    // 9 ETH YES, 1 ETH NO → NO is underdog with ~10x multiplier
    const result = getImpliedMultipliers(9n * ETH, 1n * ETH);
    expect(result.noMultiplier).toBeCloseTo(9.91, 1); // 1 + (9 * 0.99) / 1
    expect(result.yesMultiplier).toBeCloseTo(1.11, 1); // 1 + (1 * 0.99) / 9
    expect(result.yesPercent).toBe(90);
    expect(result.noPercent).toBe(10);
  });

  it('caps multiplier at 99x', () => {
    const result = getImpliedMultipliers(1000n * ETH, 1n * ETH);
    expect(result.noMultiplier).toBe(99.0);
  });
});

describe('formatMultiplier', () => {
  it('formats small multipliers with 2 decimals', () => {
    expect(formatMultiplier(1.5)).toBe('1.50x');
    expect(formatMultiplier(2.34)).toBe('2.34x');
  });

  it('formats 10+ without decimals', () => {
    expect(formatMultiplier(15.7)).toBe('16x');
  });

  it('shows 99x+ for capped values', () => {
    expect(formatMultiplier(99)).toBe('99x+');
    expect(formatMultiplier(150)).toBe('99x+');
  });
});

describe('formatFlr', () => {
  const ETH = 10n ** 18n;

  it('formats whole ETH correctly', () => {
    expect(formatFlr(5n * ETH)).toBe('5.00');
  });

  it('formats fractional ETH correctly', () => {
    expect(formatFlr(1_500000000000000000n)).toBe('1.50');
  });

  it('handles custom decimal places', () => {
    expect(formatFlr(1_234567890000000000n, 4)).toBe('1.2345');
  });

  it('handles zero decimals', () => {
    expect(formatFlr(5n * ETH, 0)).toBe('5');
  });
});
