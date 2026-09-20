import { it, expect } from 'vitest';
import net from 'node:net';
import { takeBlockedAttempts } from '../../../../../scripts/verification/network-guard.mjs';

it('records even a swallowed connection attempt so setup can fail the test', () => {
  try {
    net.connect({ host: '127.0.0.1', port: 5432 });
  } catch {
    /* Simulate a swallowed SDK error. */
  }
  expect(takeBlockedAttempts()).toBe(1);
});

it('runs without production credentials and without a database target', () => {
  expect(process.env.SETTLER_PRIVATE_KEY).toBeUndefined();
  expect(process.env.QSTASH_TOKEN).toBeUndefined();
  expect(process.env.DATABASE_URL).toContain('127.0.0.1:1/weatherb_unavailable');
});
