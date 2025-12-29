import prisma from './prisma';
import type { TestRun } from '@prisma/client';

/**
 * Start a test window for a suggestion (stub implementation)
 *
 * This is a placeholder that creates a TestRun record in the database.
 * The full implementation will be completed in Task 7 and will include:
 * - Wallet generation and encryption
 * - Funding allocation
 * - Test market creation scheduling
 *
 * @param suggestionId - The suggestion to test
 * @returns The created TestRun record
 *
 * @example
 * ```ts
 * const testRun = await startTestWindow('suggestion-123');
 * console.log(`Test started: ${testRun.id}`);
 * ```
 */
export async function startTestWindow(suggestionId: string): Promise<TestRun> {
  // TODO (Task 7): Full implementation will include:
  // 1. Generate 3 ephemeral wallets
  // 2. Encrypt private keys with AES-256
  // 3. Fund wallets from treasury
  // 4. Schedule test market creation
  // 5. Update suggestion status to APPROVED

  // For now, just create a TestRun record as a stub
  const testRun = await prisma.testRun.create({
    data: {
      suggestionId,
      walletKeys: 'PLACEHOLDER_ENCRYPTED_KEYS', // Will be real encrypted keys in Task 7
      walletCount: 3,
      marketsCreated: 0,
      marketsSettled: 0,
      fundingAmount: 0, // Will be calculated in Task 7
      recoveredAmount: 0,
      netCost: 0,
      status: 'RUNNING',
      payoutVerified: false,
    },
  });

  // Also update the suggestion status to APPROVED
  await prisma.suggestion.update({
    where: { id: suggestionId },
    data: { status: 'APPROVED' },
  });

  return testRun;
}
