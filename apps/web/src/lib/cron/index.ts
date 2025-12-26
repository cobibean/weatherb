import { Redis } from '@upstash/redis';

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
    console.warn('Upstash Redis not configured - city rotation will not persist');
    return null;
  }

  return new Redis({ url, token });
}

// Redis keys used by cron jobs
export const REDIS_KEYS = {
  CITY_INDEX: 'weatherb:scheduler:cityIndex',
  PROVIDER_HEALTH: 'weatherb:provider:health',
} as const;

// Re-export utilities
export { verifyCronRequest, unauthorizedResponse } from './auth';
export { createContractClients, WEATHER_MARKET_ABI } from './contract';
