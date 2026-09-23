import { describe, expect, it } from 'vitest';
import { formatSeedAmount, parseSeedAmount, safeConfig, updateConfigSchema } from '../config';

describe('market maker settings', () => {
  it('round-trips 18-decimal native USDC without floating point', () => {
    expect(parseSeedAmount('2.50')).toBe(2500000000000000000n);
    expect(formatSeedAmount('2500000000000000000')).toBe('2.50');
    expect(parseSeedAmount('30')).toBe(30000000000000000000n);
    expect(safeConfig({ version: 1, seedAmountWei: '2500000000000000000', seedingEnabled: false,
      claimsEnabled: true, walletAddress: null, firstEligibleMarketId: null, activationBlockNumber: null,
      activatedAt: null }, { canEdit: false, workerReady: false })).toMatchObject({ seedAmountUsdc: '2.50', maxActiveMarkets: 5 });
  });

  it.each(['0', '-1', '1e3', '2.', '.5', '1.0000000000000000001', '1,000', ' 2.5', '2.5 ',
    '115792089237316195423570985008687907853269984665640564039457584007913129639935'])('rejects invalid amount %s', (amount) => {
    expect(() => parseSeedAmount(amount)).toThrow();
  });

  it('permits only the scoped configuration fields', () => {
    expect(updateConfigSchema.safeParse({ expectedVersion: 1, seedAmountUsdc: '2.50', dailyBudget: '25' }).success).toBe(false);
    expect(updateConfigSchema.safeParse({ expectedVersion: 1, seedingEnabled: true }).success).toBe(true);
  });
});
