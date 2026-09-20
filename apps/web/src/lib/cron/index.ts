import { Redis } from '@upstash/redis';

/**
 * Log prefix for Upstash Redis operations.
 */
const LOG_PREFIX = '[UpstashRedis]';

/**
 * Upstash Redis client for serverless cron job state management.
 * Used to track city rotation index for market scheduling.
 *
 * Note: Weather provider caching is disabled for MVP to avoid ioredis dependency.
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env.
 */
export function getUpstashRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Provide detailed diagnostic info without exposing secrets
    const missing: string[] = [];
    if (!url) missing.push('UPSTASH_REDIS_REST_URL');
    if (!token) missing.push('UPSTASH_REDIS_REST_TOKEN');

    console.error(
      `${LOG_PREFIX} Not configured - missing: ${missing.join(', ')}. ` +
        'Provider health tracking and city rotation will not persist.',
    );
    return null;
  }

  // Validate URL format without exposing it
  if (!url.startsWith('https://')) {
    console.error(`${LOG_PREFIX} Invalid UPSTASH_REDIS_REST_URL format (must start with https://)`);
    return null;
  }

  return new Redis({ url, token });
}

// Redis keys used by cron jobs
export const REDIS_KEYS = {
  CITY_INDEX: 'weatherb:scheduler:cityIndex',
  PROVIDER_HEALTH: 'weatherb:provider:health',
  PAST_MARKETS: 'weatherb:markets:past:v1',
  SHEETS_LOGGED: 'weatherb:sheets:logged',
} as const;

// Re-export utilities
export { verifyCronRequest, verifyWorkerRequest, unauthorizedResponse } from './auth';
export { createContractClients, WEATHER_MARKET_ABI } from './contract';
