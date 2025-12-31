import prisma from './prisma';
import type { Suggestion, TestRun, Vote } from '@prisma/client';

/**
 * TestRun with Decimal fields converted to strings for client components
 */
export type SerializedTestRun = Omit<TestRun, 'fundingAmount' | 'recoveredAmount' | 'netCost'> & {
  fundingAmount: string;
  recoveredAmount: string;
  netCost: string;
};

/**
 * Suggestion with its votes and test runs, plus computed fields
 */
export type SuggestionWithVotes = Suggestion & {
  votes: Vote[];
  testRuns: SerializedTestRun[];
  recentVotes7d?: number; // Computed: votes in last 7 days
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

  // Calculate 7-day cutoff date
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Group by status with additional logic for testing state
  const grouped: GroupedSuggestions = {
    pending: [],
    testing: [],
    live: [],
    rejected: [],
  };

  for (const suggestion of suggestions) {
    // Calculate recent votes (last 7 days)
    const recentVotes7d = suggestion.votes.filter(
      (vote) => vote.createdAt >= sevenDaysAgo
    ).length;

    // Convert Decimal fields to strings for client components
    const serializedTestRuns: SerializedTestRun[] = suggestion.testRuns.map((tr) => ({
      ...tr,
      fundingAmount: tr.fundingAmount.toString(),
      recoveredAmount: tr.recoveredAmount.toString(),
      netCost: tr.netCost.toString(),
    }));

    const suggestionWithComputed: SuggestionWithVotes = {
      ...suggestion,
      testRuns: serializedTestRuns,
      recentVotes7d,
    };

    // Check if suggestion has an active test run
    const hasActiveTest = suggestion.testRuns.length > 0 &&
      suggestion.testRuns[0]?.status === 'RUNNING';

    if (hasActiveTest) {
      grouped.testing.push(suggestionWithComputed);
    } else if (suggestion.status === 'PENDING') {
      grouped.pending.push(suggestionWithComputed);
    } else if (suggestion.status === 'IMPLEMENTED') {
      grouped.live.push(suggestionWithComputed);
    } else if (suggestion.status === 'REJECTED') {
      grouped.rejected.push(suggestionWithComputed);
    }
    // APPROVED status cities go to pending until test starts
    else if (suggestion.status === 'APPROVED') {
      grouped.pending.push(suggestionWithComputed);
    }
  }

  return grouped;
}

/**
 * Approve a suggestion - starts test window via API
 *
 * @param id - Suggestion ID to approve
 * @returns Test run ID on success
 * @throws Error if approval fails
 */
export async function approveSuggestion(id: string): Promise<{ testRunId: string }> {
  const response = await fetch('/api/admin/suggestions/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ suggestionId: id }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to approve suggestion');
  }

  return response.json();
}

/**
 * Deny a suggestion - marks as rejected via API
 *
 * @param id - Suggestion ID to deny
 * @param reason - Optional reason for denial (stored in admin log)
 * @throws Error if denial fails
 */
export async function denySuggestion(id: string, reason?: string): Promise<void> {
  const response = await fetch('/api/admin/suggestions/deny', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ suggestionId: id, reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to deny suggestion');
  }
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
