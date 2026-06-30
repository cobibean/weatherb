import { getUpstashRedis, REDIS_KEYS } from '@/lib/cron';
import { prisma } from '@/lib/prisma';

export async function claimSheetsLoggingRights(marketId: number): Promise<boolean> {
  try {
    const result = await prisma.market.updateMany({
      where: {
        contractMarketId: marketId,
        isTest: false,
        sheetsLoggedAt: null,
      },
      data: {
        sheetsLoggedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return false;
    }

    const redis = getUpstashRedis();
    if (redis) {
      const logKey = `${REDIS_KEYS.SHEETS_LOGGED}:${marketId}`;
      await redis.set(logKey, '1', { ex: 60 * 60 * 24 * 30 }).catch(() => {});
    }

    return true;
  } catch (error) {
    console.error(`[Sheets] Failed to claim logging rights for market ${marketId}:`, error);
    return false;
  }
}
