import { NextRequest, NextResponse } from 'next/server';
import { updateTrendingScores } from '@/lib/trending';

/**
 * GET /api/cron/update-trending
 * Daily cron job to update trending scores
 *
 * Updates recentVoteCount for all pending suggestions
 * based on votes in the last 7 days
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a Vercel Cron request in production
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      const cronSecret = process.env.CRON_SECRET;

      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[Cron] Starting trending score update...');
    const result = await updateTrendingScores();

    console.log(`[Cron] Updated ${result.updated} suggestions in ${result.duration}ms`);

    return NextResponse.json({
      success: true,
      updated: result.updated,
      duration: result.duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error updating trending scores:', error);
    return NextResponse.json(
      { error: 'Failed to update trending scores' },
      { status: 500 }
    );
  }
}
