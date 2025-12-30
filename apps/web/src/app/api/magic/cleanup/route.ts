import { NextResponse } from 'next/server';
import { cleanupExpiredMagicLinks, getMagicLinkStats } from '@/lib/magic-links';

/**
 * Magic Link Cleanup Endpoint
 *
 * GET: Returns statistics about magic links
 * POST: Cleans up expired magic links (admin only)
 *
 * This can be called periodically to clean up expired tokens.
 * In production, this could be a cron job.
 */

export async function GET() {
  try {
    const stats = await getMagicLinkStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[MagicLink Cleanup] Error getting stats:', error);
    return NextResponse.json(
      { error: 'Failed to get magic link statistics' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Check for admin authorization
    // In production, this should verify admin authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Simple auth check - in production use proper admin auth
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const deletedCount = await cleanupExpiredMagicLinks();

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} expired magic links`,
    });
  } catch (error) {
    console.error('[MagicLink Cleanup] Error cleaning up:', error);
    return NextResponse.json(
      { error: 'Failed to clean up magic links' },
      { status: 500 }
    );
  }
}