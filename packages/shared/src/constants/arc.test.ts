import { describe, it, expect } from 'vitest';
import { ARC_TESTNET, assertArcChain, parseNativeUsdc } from './arc';
import { formatUsdc, calculatePotentialPayout } from '../utils/payout';
describe('Arc native USDC', () => {
  it('rejects legacy and mainnet chains', () => {
    expect(() => assertArcChain(114)).toThrow();
    expect(() => assertArcChain(14)).toThrow();
    expect(() => assertArcChain(ARC_TESTNET.id)).not.toThrow();
  });
  it('keeps 18-decimal values exact without rounding', () => {
    const s = '9007199254740993.000000000000000001';
    expect(formatUsdc(parseNativeUsdc(s), 18)).toBe(s);
    expect(parseNativeUsdc('0.01')).toBe(10n ** 16n);
  });
  it.each(['1e3', '-1', '.1', '1.0000000000000000001', 'NaN', 'Infinity', ''])(
    'rejects invalid amount %s',
    (value) => expect(() => parseNativeUsdc(value)).toThrow(),
  );
  it('uses a nondefault deployed fee in estimates', () => {
    expect(calculatePotentialPayout(0n, 10000n, 10000n, 'yes', 500n).payout).toBe(19500n);
    expect(calculatePotentialPayout(0n, 10000n, 10000n, 'yes', 0n).payout).toBe(20000n);
  });
});
