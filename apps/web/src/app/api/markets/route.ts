import { NextResponse } from 'next/server';
import { fetchMarketsFromContract } from '@/lib/contract-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const { markets, error } = await fetchMarketsFromContract();
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  let filteredMarkets = markets;
  if (status === 'past') {
    filteredMarkets = markets.filter(
      (market) => market.status === 'resolved' || market.status === 'cancelled'
    );
  } else if (status === 'active') {
    // Active markets include both 'open' (can bet) and 'closed' (betting ended, waiting for resolution)
    filteredMarkets = markets.filter((market) => market.status === 'open' || market.status === 'closed');
  }

  return NextResponse.json({ markets: filteredMarkets });
}
