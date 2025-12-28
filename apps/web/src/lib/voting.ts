import { isolatedTransaction } from './prisma';

/**
 * Cast a vote for a suggestion
 * Uses Serializable isolation to prevent race conditions (Issue #3)
 * Automatically retries on serialization failures
 */
export async function castVote(wallet: string, suggestionId: string): Promise<void> {
  const maxRetries = 5;  // Increased for high concurrency scenarios
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await isolatedTransaction(async (tx) => {
    // Lock the suggestion row first to prevent race conditions
    const suggestion = await tx.suggestion.findUnique({
      where: { id: suggestionId },
      select: { id: true, status: true },
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion is not open for voting');
    }

    // Create vote (will fail if duplicate due to unique constraint)
    await tx.vote.create({
      data: {
        wallet: wallet.toLowerCase(),
        suggestionId,
      },
    });

        // Increment counts atomically
        await tx.suggestion.update({
          where: { id: suggestionId },
          data: {
            voteCount: { increment: 1 },
            recentVoteCount: { increment: 1 },
            lastVoteAt: new Date(),
          },
        });
      });
      return; // Success, exit retry loop
    } catch (error: any) {
      lastError = error;
      // Check if it's a serialization failure that should be retried
      const isSerializationError =
        error.code === 'P2034' ||
        error.message?.toLowerCase().includes('write conflict') ||
        error.message?.toLowerCase().includes('deadlock') ||
        error.message?.toLowerCase().includes('serialization');

      if (isSerializationError && attempt < maxRetries - 1) {
        // Wait before retrying (exponential backoff: 50ms, 100ms, 200ms, 400ms)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 50));
        continue;
      }
      // For other errors (e.g., unique constraint violation), throw immediately
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Failed to cast vote after multiple retries');
}

/**
 * Remove a vote from a suggestion
 * Uses Serializable isolation to prevent race conditions (Issue #3)
 * Automatically retries on serialization failures
 */
export async function removeVote(wallet: string, suggestionId: string): Promise<void> {
  const maxRetries = 5;  // Increased for high concurrency scenarios
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await isolatedTransaction(async (tx) => {
    const vote = await tx.vote.findUnique({
      where: {
        wallet_suggestionId: {
          wallet: wallet.toLowerCase(),
          suggestionId,
        },
      },
    });

    if (!vote) {
      throw new Error('Vote not found');
    }

    await tx.vote.delete({
      where: { id: vote.id },
    });

        await tx.suggestion.update({
          where: { id: suggestionId },
          data: {
            voteCount: { decrement: 1 },
            // Don't decrement recentVoteCount here - handle in scheduled job
          },
        });
      });
      return; // Success, exit retry loop
    } catch (error: any) {
      lastError = error;
      // Check if it's a serialization failure that should be retried
      const isSerializationError =
        error.code === 'P2034' ||
        error.message?.toLowerCase().includes('write conflict') ||
        error.message?.toLowerCase().includes('deadlock') ||
        error.message?.toLowerCase().includes('serialization');

      if (isSerializationError && attempt < maxRetries - 1) {
        // Wait before retrying (exponential backoff: 50ms, 100ms, 200ms, 400ms)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 50));
        continue;
      }
      // For other errors, throw immediately
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Failed to remove vote after multiple retries');
}
