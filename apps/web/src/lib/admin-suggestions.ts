import prisma from './prisma';
import type { Suggestion, TestRun, Vote } from '@prisma/client';

/**
 * Suggestion with its votes and test runs
 */
export type SuggestionWithVotes = Suggestion & {
  votes: Vote[];
  testRuns: TestRun[];
};

/**
 * Grouped suggestions by status
 */
export interface GroupedSuggestions {
  pending: SuggestionWithVotes[];
  testing: SuggestionWithVotes[];
  live: SuggestionWithVotes[];
  rejected: SuggestionWithVotes[];
}

/**
 * Get all suggestions grouped by status for admin panel
 */
export async function getAdminSuggestions(): Promise<GroupedSuggestions> {
  const suggestions = await prisma.suggestion.findMany({
    include: {
      votes: true,
      testRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1, // Only get the latest test run
      },
    },
    orderBy: [
      { voteCount: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  // Group by status with additional logic for testing state
  const grouped: GroupedSuggestions = {
    pending: [],
    testing: [],
    live: [],
    rejected: [],
  };

  for (const suggestion of suggestions) {
    // Check if suggestion has an active test run
    const hasActiveTest = suggestion.testRuns.length > 0 &&
      suggestion.testRuns[0].status === 'RUNNING';

    if (hasActiveTest) {
      grouped.testing.push(suggestion);
    } else if (suggestion.status === 'PENDING') {
      grouped.pending.push(suggestion);
    } else if (suggestion.status === 'IMPLEMENTED') {
      grouped.live.push(suggestion);
    } else if (suggestion.status === 'REJECTED') {
      grouped.rejected.push(suggestion);
    }
    // APPROVED status cities go to pending until test starts
    else if (suggestion.status === 'APPROVED') {
      grouped.pending.push(suggestion);
    }
  }

  return grouped;
}

/**
 * Approve a suggestion (stub for now - will connect to API in Task 3)
 */
export async function approveSuggestion(id: string): Promise<void> {
  await prisma.suggestion.update({
    where: { id },
    data: { status: 'APPROVED' },
  });
}

/**
 * Deny a suggestion (stub for now - will connect to API in Task 3)
 */
export async function denySuggestion(id: string, reason?: string): Promise<void> {
  await prisma.suggestion.update({
    where: { id },
    data: { status: 'REJECTED' },
  });

  // TODO: Store denial reason in AdminLog or Suggestion model
  // This will be implemented in Task 3
}

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

  const percentage = testRun.marketsCreated > 0
    ? Math.round((testRun.marketsSettled / testRun.marketsCreated) * 100)
    : 0;

  return {
    marketsCreated: testRun.marketsCreated,
    marketsSettled: testRun.marketsSettled,
    percentage,
  };
}
