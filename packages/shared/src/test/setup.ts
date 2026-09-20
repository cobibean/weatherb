import { afterEach, expect } from 'vitest';
import { takeBlockedAttempts } from '../../../../scripts/verification/network-guard.mjs';

afterEach(() => {
  expect(takeBlockedAttempts()).toBe(0);
});
