import { NextRequest, NextResponse } from 'next/server';
import {
  fetchUserPositions,
  calculateUserStats,
  serializePosition,
  serializeStats,
} from '@/lib/positions';
import type { PositionsResponse } from '@/types/positions';

/**
 * GET /api/positions?wallet=0x...
 *
 * Fetches all positions and statistics for a given wallet address
 */
export async function GET(request: NextRequest) {
  try {
    // Get wallet address from query params
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        {
          positions: [],
          stats: {
            totalBets: 0,
            activeBets: 0,
            resolvedBets: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            totalWagered: '0',
            totalWinnings: '0',
            totalClaimed: '0',
            totalClaimable: '0',
            netProfit: '0',
            roi: 0,
          },
          error: 'Wallet address is required',
        } satisfies PositionsResponse,
        { status: 400 }
      );
    }

    // Validate wallet address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json(
        {
          positions: [],
          stats: {
            totalBets: 0,
            activeBets: 0,
            resolvedBets: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            totalWagered: '0',
            totalWinnings: '0',
            totalClaimed: '0',
            totalClaimable: '0',
            netProfit: '0',
            roi: 0,
          },
          error: 'Invalid wallet address format',
        } satisfies PositionsResponse,
        { status: 400 }
      );
    }

    // Fetch positions
    const positions = await fetchUserPositions(wallet);

    // Calculate stats
    const stats = calculateUserStats(positions);

    // Sort positions: claimable first, then active, then others by resolve time (newest first)
    const sortedPositions = [...positions].sort((a, b) => {
      // Priority order
      const statusPriority: Record<string, number> = {
        claimable: 0,
        refundable: 1,
        active: 2,
        won: 3,
        claimed: 4,
        refunded: 5,
        lost: 6,
      };

      const aPriority = statusPriority[a.status] ?? 999;
      const bPriority = statusPriority[b.status] ?? 999;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Within same status, sort by resolve time (newest first)
      return b.resolveTime - a.resolveTime;
    });

    // Serialize for JSON response
    const serializedPositions = sortedPositions.map(serializePosition);
    const serializedStats = serializeStats(stats);

    const response: PositionsResponse = {
      positions: serializedPositions,
      stats: serializedStats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching positions:', error);

    return NextResponse.json(
      {
        positions: [],
        stats: {
          totalBets: 0,
          activeBets: 0,
          resolvedBets: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          totalWagered: '0',
          totalWinnings: '0',
          totalClaimed: '0',
          totalClaimable: '0',
          netProfit: '0',
          roi: 0,
        },
        error: error instanceof Error ? error.message : 'Failed to fetch positions',
      } satisfies PositionsResponse,
      { status: 500 }
    );
  }
}
