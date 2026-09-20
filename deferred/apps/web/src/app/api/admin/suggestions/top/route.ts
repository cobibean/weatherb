import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

/**
 * GET /api/admin/suggestions/top
 * Get top suggestions for admin review (Epic 8 integration)
 *
 * Returns top suggestions by votes and trending for weekly admin emails
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Verify admin authentication
    const auth = await requireAdminAuth();
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    // Get top 10 by votes
    const topByVotes = await prisma.suggestion.findMany({
      where: { status: 'PENDING' },
      orderBy: { voteCount: 'desc' },
      take: 10,
      include: {
        city: true,
        _count: {
          select: { votes: true },
        },
      },
    });

    // Get top 10 trending
    const trending = await prisma.suggestion.findMany({
      where: { status: 'PENDING' },
      orderBy: { recentVoteCount: 'desc' },
      take: 10,
      include: {
        city: true,
        _count: {
          select: { votes: true },
        },
      },
    });

    return NextResponse.json({
      topByVotes,
      trending,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching top suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top suggestions' },
      { status: 500 }
    );
  }
}
