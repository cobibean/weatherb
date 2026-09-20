import type { TestRun } from '@prisma/client';

/**
 * Get test run progress for a suggestion
 */
export function getTestProgress(testRun?: TestRun): {
  marketsCreated: number;
  marketsSettled: number;
  percentage: number;
} {
  if (!testRun) {
    return {
      marketsCreated: 0,
      marketsSettled: 0,
      percentage: 0,
    };
  }

  const percentage =
    testRun.marketsCreated > 0
      ? Math.round((testRun.marketsSettled / testRun.marketsCreated) * 100)
      : 0;

  return {
    marketsCreated: testRun.marketsCreated,
    marketsSettled: testRun.marketsSettled,
    percentage,
  };
}
