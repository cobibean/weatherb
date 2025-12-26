import { fetchMarketsFromContract } from '@/lib/contract-data';
import { HomeClient } from '@/components/home';

// Revalidate every 30 seconds to pick up new markets/bets
export const revalidate = 30;

export default async function HomePage() {
  const { markets, error } = await fetchMarketsFromContract();
  // Active markets include both 'open' (can bet) and 'closed' (betting ended, waiting for resolution)
  const activeMarkets = markets.filter((market) => market.status === 'open' || market.status === 'closed');

  if (error) {
    console.error('Failed to fetch markets:', error);
  }

  return <HomeClient markets={activeMarkets} />;
}
