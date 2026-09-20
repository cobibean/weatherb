import { readDatabaseReadiness } from '@/lib/database-readiness';
import { NextResponse } from 'next/server';
import { fetchMarketsFromContract, type SerializedMarket } from '@/lib/contract-data';
import { prisma } from '@/lib/prisma';
import { getUpstashRedis, REDIS_KEYS } from '@/lib/cron';
import type { MarketStatus as DbMarketStatus } from '@prisma/client';

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
  if ((await readDatabaseReadiness()).status !== 'ready') {
    return NextResponse.json({ error: 'Market database is unavailable' }, { status: 503 });
  }
  try {
    return await getMarkets(request);
  } catch {
    return NextResponse.json({ error: 'Markets are temporarily unavailable' }, { status: 503 });
  }
}

async function getMarkets(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limitParam = searchParams.get('limit');
  const cursorParam = searchParams.get('cursor');

  if (status === 'past') {
    const limit = Math.min(Math.max(Number(limitParam ?? 50) || 50, 1), 100);
    const cursor = parseCursor(cursorParam);
    const cacheKey = `${REDIS_KEYS.PAST_MARKETS}:${limit}:${cursorParam ?? 'start'}`;
    const redis = getUpstashRedis();

    if (redis) {
      try {
        const cached = await redis.get<{ markets: SerializedMarket[]; nextCursor: string | null }>(
          cacheKey,
        );
        if (cached?.markets) {
          return NextResponse.json(cached);
        }
      } catch (error) {
        console.warn('[PastMarkets] Cache read failed:', error);
      }
    }

    const where: {
      isTest: boolean;
      status: { in: DbMarketStatus[] };
      OR?: Array<
        { resolveTime: { lt: Date } } | { resolveTime: Date; contractMarketId: { lt: number } }
      >;
    } = {
      isTest: false,
      status: {
        in: ['RESOLVED', 'CANCELLED', 'NO_WINNERS'],
      },
    };

    if (cursor) {
      where.OR = [
        { resolveTime: { lt: cursor.resolveTime } },
        { resolveTime: cursor.resolveTime, contractMarketId: { lt: cursor.contractMarketId } },
      ];
    }

    const dbMarkets = await prisma.market.findMany({
      where,
      orderBy: [{ resolveTime: 'desc' }, { contractMarketId: 'desc' }],
      take: limit + 1,
      include: { city: true },
    });

    const hasMore = dbMarkets.length > limit;
    const results = hasMore ? dbMarkets.slice(0, limit) : dbMarkets;
    const last = results[results.length - 1];
    const nextCursor =
      hasMore && last ? `${last.resolveTime.getTime()}_${last.contractMarketId}` : null;

    const markets = results.map((market) => mapDbMarketToSerialized(market));
    const response = { markets, nextCursor };

    if (redis) {
      try {
        await redis.set(cacheKey, response, { ex: 300 });
      } catch (error) {
        console.warn('[PastMarkets] Cache write failed:', error);
      }
    }

    return NextResponse.json(response);
  }

  // Fetch markets from blockchain
  const { markets, error } = await fetchMarketsFromContract();
  if (error) {
    return NextResponse.json({ error: 'Market service is unavailable' }, { status: 503 });
  }

  // CRITICAL: Filter out test markets by cross-referencing with database
  // Get all test market IDs from database
  const testMarkets = await prisma.market.findMany({
    where: { isTest: true },
    select: { contractMarketId: true },
  });

  const testMarketIds = new Set(testMarkets.map((m) => m.contractMarketId.toString()));

  // Filter out test markets from blockchain data
  let filteredMarkets = markets.filter((market) => !testMarketIds.has(market.id));

  // Apply status filter
  if (status === 'past') {
    filteredMarkets = filteredMarkets.filter(
      (market) =>
        market.status === 'resolved' ||
        market.status === 'cancelled' ||
        market.status === 'noWinners',
    );
  } else if (status === 'active') {
    // Active markets include both 'open' (can bet) and 'closed' (betting ended, waiting for resolution)
    filteredMarkets = filteredMarkets.filter(
      (market) => market.status === 'open' || market.status === 'closed',
    );
  }

  return NextResponse.json({ markets: filteredMarkets });
}

function parseCursor(raw: string | null): { resolveTime: Date; contractMarketId: number } | null {
  if (!raw) return null;
  const [timePart, idPart] = raw.split('_');
  const timeMs = Number(timePart);
  const id = Number(idPart);
  if (!Number.isFinite(timeMs) || !Number.isInteger(id)) return null;
  return { resolveTime: new Date(timeMs), contractMarketId: id };
}

function mapDbMarketToSerialized(market: {
  contractMarketId: number;
  cityName: string;
  latitude: number;
  longitude: number;
  resolveTime: Date;
  thresholdTemp: number;
  status: DbMarketStatus;
  yesPool: string;
  noPool: string;
  totalFees: string;
  actualTemp: number | null;
  outcome: string | null;
  city: { slug: string };
}): SerializedMarket {
  const status = mapDbStatus(market.status);
  const outcome = market.outcome === null ? undefined : market.outcome === 'YES';

  return {
    id: market.contractMarketId.toString(),
    cityId: market.city.slug,
    cityName: market.cityName,
    latitude: market.latitude,
    longitude: market.longitude,
    resolveTime: market.resolveTime.getTime(),
    thresholdF_tenths: market.thresholdTemp,
    currency: 'USDC',
    status,
    yesPool: market.yesPool,
    noPool: market.noPool,
    totalFees: market.totalFees,
    ...(market.actualTemp !== null ? { resolvedTempF_tenths: market.actualTemp } : {}),
    ...(outcome !== undefined ? { outcome } : {}),
  };
}

function mapDbStatus(status: DbMarketStatus): SerializedMarket['status'] {
  switch (status) {
    case 'OPEN':
      return 'open';
    case 'CLOSED':
      return 'closed';
    case 'CANCELLED':
      return 'cancelled';
    case 'NO_WINNERS':
      return 'noWinners';
    case 'RESOLVED':
    default:
      return 'resolved';
  }
}
