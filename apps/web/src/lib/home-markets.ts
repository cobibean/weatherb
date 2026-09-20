import type { SerializedMarket } from './contract-data';
import { readDatabaseReadiness } from './database-readiness';

export interface HomeMarkets {
  markets: SerializedMarket[];
  error?: string;
}

export async function loadHomeMarkets(): Promise<HomeMarkets> {
  const unavailable = {
    markets: [],
    error: 'Markets are temporarily unavailable. Please try again shortly.',
  };
  if ((await readDatabaseReadiness()).status !== 'ready') return unavailable;
  try {
    const [{ fetchMarketsFromContract }, { prisma }] = await Promise.all([
      import('./contract-data'),
      import('./prisma'),
    ]);
    const { markets, error } = await fetchMarketsFromContract();
    if (error) return unavailable;
    const testMarkets = await prisma.market.findMany({
      where: { isTest: true },
      select: { contractMarketId: true },
    });
    const testIds = new Set(testMarkets.map((market) => String(market.contractMarketId)));
    return {
      markets: markets.filter(
        (market) =>
          !testIds.has(market.id) && (market.status === 'open' || market.status === 'closed'),
      ),
    };
  } catch {
    return unavailable;
  }
}
