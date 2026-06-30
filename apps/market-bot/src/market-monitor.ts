import { type Hex } from 'viem';
import { publicClient } from './clients.js';
import { config } from './config.js';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import type { CachedMarket, MarketStatus, NewMarketEvent } from './types.js';

const CONTRACT_ADDRESS = config.contractAddress as Hex;

// In-memory cache of markets
const marketCache = new Map<string, CachedMarket>();

// Track last known market count for new market detection
let lastKnownMarketCount = 0n;

// Status enum mapping
const STATUS_MAP: Record<number, MarketStatus> = {
  0: 'OPEN',
  1: 'CLOSED',
  2: 'RESOLVED',
  3: 'CANCELLED',
  4: 'NO_WINNERS',
};

/**
 * Fetch a single market from the contract
 */
async function fetchMarket(marketId: bigint): Promise<CachedMarket> {
  const market = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarket',
    args: [marketId],
  });

  return {
    id: marketId,
    status: STATUS_MAP[market.status] || 'CLOSED',
    bettingDeadline: Number(market.bettingDeadline),
    resolveTime: Number(market.resolveTime),
    yesPool: market.yesPool,
    noPool: market.noPool,
    thresholdTenths: market.thresholdTenths,
    cityId: market.cityId,
    lastUpdated: Math.floor(Date.now() / 1000),
  };
}

/**
 * Get current market count from contract
 */
export async function getMarketCount(): Promise<bigint> {
  return await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });
}

/**
 * Poll for new markets. Returns array of newly detected markets.
 */
export async function pollForNewMarkets(): Promise<NewMarketEvent[]> {
  const currentCount = await getMarketCount();
  const newMarkets: NewMarketEvent[] = [];

  if (currentCount > lastKnownMarketCount) {
    console.log(`[MarketMonitor] New markets detected: ${lastKnownMarketCount} → ${currentCount}`);

    // Fetch all new markets
    for (let id = lastKnownMarketCount; id < currentCount; id++) {
      try {
        const market = await fetchMarket(id);
        marketCache.set(id.toString(), market);
        newMarkets.push({ marketId: id, market });
        console.log(`[MarketMonitor] Cached new market #${id}`);
      } catch (error) {
        console.error(`[MarketMonitor] Failed to fetch market #${id}:`, error);
      }
    }

    lastKnownMarketCount = currentCount;
  }

  return newMarkets;
}

/**
 * Initialize market monitor - fetch recent markets only
 *
 * Instead of fetching all historical markets (could be 1000+),
 * we only fetch the most recent ones that could still be open.
 * New markets will be detected via polling.
 */
export async function initializeMarketMonitor(): Promise<void> {
  console.log('[MarketMonitor] Initializing...');

  const count = await getMarketCount();
  console.log(`[MarketMonitor] Total markets on-chain: ${count}`);

  // Only fetch recent markets (last 50 should cover any open markets)
  // Markets last 24h, with 5/day max = 5 open at any time
  // 50 gives us ~10 days of history buffer
  const RECENT_MARKETS_TO_FETCH = 50n;
  const startFrom = count > RECENT_MARKETS_TO_FETCH ? count - RECENT_MARKETS_TO_FETCH : 0n;

  console.log(`[MarketMonitor] Fetching markets from #${startFrom} to #${count - 1n}`);

  // Fetch in batches with delay to avoid rate limits
  const BATCH_SIZE = 5n;
  const BATCH_DELAY_MS = 500;

  for (let i = startFrom; i < count; i += BATCH_SIZE) {
    const batchEnd = i + BATCH_SIZE > count ? count : i + BATCH_SIZE;
    const promises: Promise<CachedMarket>[] = [];

    for (let id = i; id < batchEnd; id++) {
      promises.push(fetchMarket(id));
    }

    try {
      const markets = await Promise.all(promises);
      for (const market of markets) {
        marketCache.set(market.id.toString(), market);
      }
      console.log(`[MarketMonitor] Cached markets ${i} to ${batchEnd - 1n}`);
    } catch (error) {
      console.error(`[MarketMonitor] Failed to fetch batch ${i}-${batchEnd - 1n}:`, error);
      // Continue with next batch even if one fails
    }

    // Small delay between batches to avoid rate limiting
    if (batchEnd < count) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  lastKnownMarketCount = count;

  const openCount = getOpenMarkets().length;
  console.log(`[MarketMonitor] Initialization complete. ${marketCache.size} markets cached, ${openCount} currently open.`);
}

/**
 * Get all open markets that are still accepting bets
 */
export function getOpenMarkets(): CachedMarket[] {
  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = config.bettingBufferSeconds;

  return Array.from(marketCache.values()).filter((market) => {
    // Must be OPEN status
    if (market.status !== 'OPEN') return false;

    // Must not be past betting deadline (with buffer)
    if (now >= market.bettingDeadline - bufferSeconds) return false;

    return true;
  });
}

/**
 * Get a specific market from cache (or fetch if not cached)
 */
export async function getMarket(marketId: bigint): Promise<CachedMarket> {
  const key = marketId.toString();
  const cached = marketCache.get(key);

  // If cached and recent (within 60 seconds), return cached
  if (cached && Date.now() / 1000 - cached.lastUpdated < 60) {
    return cached;
  }

  // Fetch fresh data
  const market = await fetchMarket(marketId);
  marketCache.set(key, market);
  return market;
}

/**
 * Refresh market data for a specific market
 */
export async function refreshMarket(marketId: bigint): Promise<CachedMarket> {
  const market = await fetchMarket(marketId);
  marketCache.set(marketId.toString(), market);
  return market;
}

/**
 * Refresh all open markets (call periodically to keep pools up-to-date)
 */
export async function refreshOpenMarkets(): Promise<void> {
  const openMarkets = getOpenMarkets();

  console.log(`[MarketMonitor] Refreshing ${openMarkets.length} open markets...`);

  for (const market of openMarkets) {
    try {
      await refreshMarket(market.id);
    } catch (error) {
      console.error(`[MarketMonitor] Failed to refresh market #${market.id}:`, error);
    }
  }
}

/**
 * Get market cache stats for health checks
 */
export function getMonitorStats(): {
  totalCached: number;
  openMarkets: number;
  lastKnownCount: string;
} {
  return {
    totalCached: marketCache.size,
    openMarkets: getOpenMarkets().length,
    lastKnownCount: lastKnownMarketCount.toString(),
  };
}
