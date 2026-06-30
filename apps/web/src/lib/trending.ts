import prisma, { paginationParams } from './prisma';

/**
 * Update trending scores for all pending suggestions
 * This should be run daily via cron job
 *
 * Calculates recentVoteCount as votes in the last 7 days
 */
export async function updateTrendingScores(): Promise<{
  updated: number;
  duration: number;
}> {
  const startTime = Date.now();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Use raw SQL for efficiency with large datasets
  const result = await prisma.$executeRaw`
    UPDATE "Suggestion"
    SET "recentVoteCount" = (
      SELECT COUNT(*)
      FROM "Vote"
      WHERE "Vote"."suggestionId" = "Suggestion"."id"
      AND "Vote"."createdAt" > ${sevenDaysAgo}
    )
    WHERE "status" = 'PENDING'
  `;

  const duration = Date.now() - startTime;

  return {
    updated: Number(result),
    duration,
  };
}

/**
 * Get suggestions by sorting criteria
 * Implements pagination (Issue #9)
 */
export type SortType = 'votes' | 'recent' | 'trending';

export async function getSuggestions(
  sort: SortType = 'votes',
  page: number = 1,
  limit: number = 50
) {
  const orderBy =
    sort === 'votes' ? { voteCount: 'desc' as const } :
    sort === 'trending' ? { recentVoteCount: 'desc' as const } :
    { createdAt: 'desc' as const };

  return prisma.suggestion.findMany({
    where: { status: 'PENDING' },
    orderBy,
    ...paginationParams(page, limit),
    include: {
      city: true,
      _count: {
        select: { votes: true },
      },
    },
  });
}
