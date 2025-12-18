import { describe, expect, it } from 'vitest';

import { exponentialBackoffMs } from './backoff';

describe('backoff', () => {
  it('matches 5s, 10s, 20s pattern', () => {
    expect(exponentialBackoffMs(1, 5000)).toBe(5000);
    expect(exponentialBackoffMs(2, 5000)).toBe(10000);
    expect(exponentialBackoffMs(3, 5000)).toBe(20000);
  });
});
