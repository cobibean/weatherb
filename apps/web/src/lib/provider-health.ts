import { z } from 'zod';
import { getUpstashRedis, REDIS_KEYS } from '@/lib/cron';

const ProviderHealthSchema = z.object({
  lastSuccessAt: z.string().datetime().optional(),
  lastErrorAt: z.string().datetime().optional(),
  recentErrors: z.number().int().nonnegative().default(0),
});

export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

const DEFAULT_HEALTH: ProviderHealth = {
  recentErrors: 0,
};

function parseProviderHealth(raw: string): ProviderHealth | null {
  try {
    const parsedJson = JSON.parse(raw);
    const result = ProviderHealthSchema.safeParse(parsedJson);
    if (!result.success) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

async function updateProviderHealth(
  updater: (current: ProviderHealth) => ProviderHealth
): Promise<void> {
  const redis = getUpstashRedis();
  if (!redis) return;

  const raw = await redis.get<string>(REDIS_KEYS.PROVIDER_HEALTH);
  const current = raw ? parseProviderHealth(raw) ?? DEFAULT_HEALTH : DEFAULT_HEALTH;
  const updated = updater(current);

  await redis.set(REDIS_KEYS.PROVIDER_HEALTH, JSON.stringify(updated));
}

export async function readProviderHealth(): Promise<ProviderHealth | null> {
  const redis = getUpstashRedis();
  if (!redis) return null;

  const raw = await redis.get<string>(REDIS_KEYS.PROVIDER_HEALTH);
  if (!raw) return null;

  return parseProviderHealth(raw);
}

export async function recordProviderSuccess(): Promise<void> {
  const now = new Date().toISOString();
  await updateProviderHealth((current) => ({
    ...current,
    lastSuccessAt: now,
    recentErrors: 0,
  }));
}

export async function recordProviderError(): Promise<void> {
  const now = new Date().toISOString();
  await updateProviderHealth((current) => ({
    ...current,
    lastErrorAt: now,
    recentErrors: current.recentErrors + 1,
  }));
}
