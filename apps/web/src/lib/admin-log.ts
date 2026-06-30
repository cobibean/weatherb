import prisma from './prisma';
import type { Prisma } from '@prisma/client';

/**
 * Log an admin action to the AdminLog table
 *
 * This helper provides a simple interface for recording admin actions
 * with optional structured details.
 *
 * @param wallet - Admin wallet address (will be normalized to lowercase)
 * @param action - Action type (e.g., 'APPROVE_SUGGESTION', 'DENY_SUGGESTION')
 * @param details - Optional structured data about the action
 *
 * @example
 * ```ts
 * await logAdminAction(wallet, 'APPROVE_SUGGESTION', {
 *   suggestionId: 'abc',
 *   testRunId: 'xyz',
 * });
 * ```
 */
export async function logAdminAction(
  wallet: string,
  action: string,
  details?: Prisma.InputJsonValue
): Promise<void> {
  await prisma.adminLog.create({
    data: {
      wallet: wallet.toLowerCase(),
      action,
      ...(details !== undefined && { details }),
    },
  });
}
