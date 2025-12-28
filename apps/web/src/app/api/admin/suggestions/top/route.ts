import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/suggestions/top
 * Get top suggestions for admin review (Epic 8 integration)
 *
 * Returns top suggestions by votes and trending for weekly admin emails
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin auth check when Epic 6 admin auth is integrated
    // For now, allow anyone to access (will be called by Epic 8 email job)

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
