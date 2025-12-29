import { NextResponse } from 'next/server';
import { fetchMarketsFromContract } from '@/lib/contract-data';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/markets
 *
 * Public API to fetch markets from the blockchain.
 * SECURITY CRITICAL: Filters out test markets using database cross-reference.
 *
 * Query params:
 * - status: 'past' | 'active' | undefined (all)
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  // Fetch markets from blockchain
  const { markets, error } = await fetchMarketsFromContract();
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  // CRITICAL: Filter out test markets by cross-referencing with database
  // Get all test market IDs from database
  const testMarkets = await prisma.market.findMany({
    where: { isTest: true },
    select: { contractMarketId: true }
  });

  const testMarketIds = new Set(testMarkets.map(m => m.contractMarketId.toString()));

  // Filter out test markets from blockchain data
  let filteredMarkets = markets.filter(market => !testMarketIds.has(market.id));

  // Apply status filter
  if (status === 'past') {
    filteredMarkets = filteredMarkets.filter(
      (market) => market.status === 'resolved' || market.status === 'cancelled' || market.status === 'noWinners'
    );
  } else if (status === 'active') {
    // Active markets include both 'open' (can bet) and 'closed' (betting ended, waiting for resolution)
    filteredMarkets = filteredMarkets.filter((market) => market.status === 'open' || market.status === 'closed');
  }

  return NextResponse.json({ markets: filteredMarkets });
}
