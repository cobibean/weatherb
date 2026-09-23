import { Client as QStashClient } from '@upstash/qstash';

/** Best-effort wake-up. Durable discovery in the periodic tick is the recovery path. */
export async function ensureLiquidityScheduled(marketId: bigint, deploymentKey: string): Promise<boolean> {
  const token = process.env.QSTASH_TOKEN;
  const baseUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!token || !baseUrl || !secret) return false;
  await new QStashClient({ token }).publishJSON({
    url: new URL(`/api/markets/${marketId}/liquidity`, baseUrl).toString(),
    method: 'POST', retries: 3,
    headers: { Authorization: `Bearer ${secret}` },
    deduplicationId: `liquidity:${deploymentKey}:${marketId}`,
    body: {},
  });
  return true;
}
