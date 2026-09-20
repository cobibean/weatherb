import { Client as QStashClient } from '@upstash/qstash';
import prisma from '@/lib/prisma';

export type SettlementScheduleResult = {
  scheduled: boolean;
  messageId?: string | undefined;
  message?: string | undefined;
};

/** Publish at most one delayed delivery per market; the periodic sweep remains the safety net. */
export async function ensureSettlementScheduled(
  marketId: bigint,
  resolveTimeSec: number,
): Promise<SettlementScheduleResult> {
  const contractMarketId = Number(marketId);
  const token = process.env.QSTASH_TOKEN;
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!token || !baseUrl) return { scheduled: false, message: 'QStash not configured' };
  const row = await prisma.market.findUnique({
    where: { contractMarketId },
    select: { settlementMessageId: true },
  });
  if (row?.settlementMessageId) return { scheduled: true, messageId: row.settlementMessageId };
  const headers: Record<string, string> = {};
  if (process.env.CRON_SECRET) headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  const result = (await new QStashClient({ token }).publishJSON({
    url: new URL(`/api/markets/${contractMarketId}/settle`, baseUrl).toString(),
    method: 'POST',
    notBefore: resolveTimeSec,
    retries: 3, // Free-tier maximum; the two-minute sweep is the safety net beyond this.
    headers,
    body: {},
  })) as { messageId?: string };
  if (result.messageId)
    await prisma.market.update({
      where: { contractMarketId },
      data: { settlementMessageId: result.messageId },
    });
  return { scheduled: true, messageId: result.messageId };
}
