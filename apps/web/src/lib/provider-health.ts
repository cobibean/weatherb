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

/**
 * Log prefix for provider health operations.
 * Makes it easy to grep logs for health-related issues.
 */
const LOG_PREFIX = '[ProviderHealth]';

/**
 * Parse provider health from Redis value.
 * Handles both string (if stored as string) and object (Upstash auto-deserializes JSON).
 */
function parseProviderHealth(raw: unknown): ProviderHealth | null {
  try {
    // Upstash Redis client auto-deserializes JSON, so raw might already be an object
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const result = ProviderHealthSchema.safeParse(data);
    if (!result.success) {
      console.warn(`${LOG_PREFIX} Failed to validate health data: ${result.error.message}`);
      return null;
    }
    return result.data;
  } catch (error) {
    console.warn(
      `${LOG_PREFIX} Failed to parse health data:`,
      error instanceof Error ? error.message : 'Unknown error',
    );
    return null;
  }
}

async function updateProviderHealth(
  updater: (current: ProviderHealth) => ProviderHealth,
  operation: 'success' | 'error',
): Promise<void> {
  const redis = getUpstashRedis();
  if (!redis) {
    // This is a critical configuration issue - log at error level
    console.error(
      `${LOG_PREFIX} Cannot record provider ${operation}: Upstash Redis not configured. ` +
        'Ensure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.',
    );
    return;
  }

  try {
    // Use generic type to get whatever Upstash returns (could be string or object)
    const raw = await redis.get<unknown>(REDIS_KEYS.PROVIDER_HEALTH);
    const current = raw ? (parseProviderHealth(raw) ?? DEFAULT_HEALTH) : DEFAULT_HEALTH;
    const updated = updater(current);

    // Store as object - Upstash will serialize it
    await redis.set(REDIS_KEYS.PROVIDER_HEALTH, updated);

    console.log(`${LOG_PREFIX} Recorded ${operation}: recentErrors=${updated.recentErrors}`);
  } catch (error) {
    // Log the error but don't expose connection details
    console.error(
      `${LOG_PREFIX} Failed to update health (${operation}):`,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

export async function readProviderHealth(): Promise<ProviderHealth | null> {
  const redis = getUpstashRedis();
  if (!redis) {
    console.warn(`${LOG_PREFIX} Cannot read health: Upstash Redis not configured`);
    return null;
  }

  try {
    // Use generic type to get whatever Upstash returns (could be string or object)
    const raw = await redis.get<unknown>(REDIS_KEYS.PROVIDER_HEALTH);
    if (!raw) {
      console.warn(`${LOG_PREFIX} Health key not found: ${REDIS_KEYS.PROVIDER_HEALTH}`);
      return null;
    }

    const parsed = parseProviderHealth(raw);
    if (parsed) {
      console.log(
        `${LOG_PREFIX} Read health: lastSuccess=${parsed.lastSuccessAt ?? 'never'}, ` +
          `lastError=${parsed.lastErrorAt ?? 'never'}, recentErrors=${parsed.recentErrors}`,
      );
    }
    return parsed;
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Failed to read health:`,
      error instanceof Error ? error.message : 'Unknown error',
    );
    return null;
  }
}

export async function recordProviderSuccess(): Promise<void> {
  const now = new Date().toISOString();
  await updateProviderHealth(
    (current) => ({
      ...current,
      lastSuccessAt: now,
      recentErrors: 0,
    }),
    'success',
  );
}

export async function recordProviderError(): Promise<void> {
  const now = new Date().toISOString();
  await updateProviderHealth(
    (current) => ({
      ...current,
      lastErrorAt: now,
      recentErrors: current.recentErrors + 1,
    }),
    'error',
  );
}
