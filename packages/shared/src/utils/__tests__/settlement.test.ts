import { describe, expect, it } from 'vitest';
import { calculateSettlement } from '../settlement';

describe('calculateSettlement', () => {
  it('resolves YES when temp equals threshold', () => {
    const result = calculateSettlement({
      tempTenths: 850,
      thresholdTenths: 850,
      yesPool: 100n,
      noPool: 50n,
    });
    expect(result.outcome).toBe('YES');
    expect(result.status).toBe('RESOLVED');
  });

  it('resolves YES when temp exceeds threshold', () => {
    const result = calculateSettlement({
      tempTenths: 851,
      thresholdTenths: 850,
      yesPool: 100n,
      noPool: 50n,
    });
    expect(result.outcome).toBe('YES');
  });

  it('resolves NO when temp is below threshold', () => {
    const result = calculateSettlement({
      tempTenths: 849,
      thresholdTenths: 850,
      yesPool: 100n,
      noPool: 50n,
    });
    expect(result.outcome).toBe('NO');
  });

  it('returns NO_WINNERS when winning side has no bets', () => {
    const result = calculateSettlement({
      tempTenths: 851,
      thresholdTenths: 850,
      yesPool: 0n,
      noPool: 50n,
    });
    expect(result.outcome).toBe('YES');
    expect(result.status).toBe('NO_WINNERS');
  });

  it('converts pools to strings', () => {
    const result = calculateSettlement({
      tempTenths: 850,
      thresholdTenths: 850,
      yesPool: 123456789012345678901234567890n,
      noPool: 987654321098765432109876543210n,
    });
    expect(result.yesPool).toBe('123456789012345678901234567890');
    expect(result.noPool).toBe('987654321098765432109876543210');
  });
});
