import { afterAll, afterEach, expect } from 'vitest';
import { assertDisposableDatabase } from '../../../../scripts/verification/test-database.mjs';
import { takeBlockedAttempts } from '../../../../scripts/verification/network-guard.mjs';

assertDisposableDatabase();
afterAll(async () => {
  const { prisma } = await import('@/lib/prisma');
  await prisma.$disconnect();
});

afterEach(() => {
  expect(takeBlockedAttempts()).toBe(0);
});
