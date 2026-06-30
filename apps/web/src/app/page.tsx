import { fetchMarketsFromContract } from '@/lib/contract-data';
import { prisma } from '@/lib/prisma';
import { HomeClient } from '@/components/home';

// Revalidate every 30 seconds to pick up new markets/bets
export const revalidate = 30;

export default async function HomePage() {
  const { markets, error } = await fetchMarketsFromContract();

  if (error) {
    console.error('Failed to fetch markets:', error);
  }

  // CRITICAL: Filter out test markets by cross-referencing with database
  const testMarkets = await prisma.market.findMany({
    where: { isTest: true },
    select: { contractMarketId: true }
  });

  const testMarketIds = new Set(testMarkets.map(m => m.contractMarketId.toString()));

  // Filter out test markets, then filter to active status
  const nonTestMarkets = markets.filter(market => !testMarketIds.has(market.id));
  const activeMarkets = nonTestMarkets.filter(
    (market) => market.status === 'open' || market.status === 'closed'
  );

  return <HomeClient markets={activeMarkets} />;
}
