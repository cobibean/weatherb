import type { WeatherProvider } from '../types/provider';

import { CachedProvider } from './cached-provider';
import { getSharedEnv } from './env';
import { TomorrowIoProvider } from './tomorrow-io';

/**
 * Create a Tomorrow.io weather provider from environment variables.
 *
 * Replaces the old multi-provider fallback system with a single, reliable provider.
 * Caching is applied automatically to stay within Tomorrow.io's 50 calls/day free tier.
 *
 * Required environment variables:
 * - TOMORROW_IO_API_KEY: Your Tomorrow.io API key
 *
 * Optional environment variables:
 * - REDIS_URL: Redis cache for distributed caching (must be redis:// URL, not https://)
 *
 * @returns Cached Tomorrow.io weather provider
 * @throws Error if TOMORROW_IO_API_KEY is missing
 */
export function createWeatherProviderFromEnv(): WeatherProvider {
  const env = getSharedEnv();

  // Get Tomorrow.io API key
  const apiKey = env.TOMORROW_IO_API_KEY ?? process.env['TOMORROW_IO_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'TOMORROW_IO_API_KEY is required. Get your API key from https://www.tomorrow.io/weather-api/'
    );
  }

  // Create Tomorrow.io provider
  const provider = new TomorrowIoProvider({ apiKey });

  // Wrap with caching (24h forecast TTL, 1h reading TTL)
  // Only use REDIS_URL for ioredis (TCP client). UPSTASH_REDIS_REST_URL is https:// and incompatible.
  // When REDIS_URL is not set, CachedProvider falls back to in-memory cache automatically.
  const redisUrl = env.REDIS_URL;

  const cacheOptions = {
    forecastTtlSeconds: 86400, // 24 hours (forecasts don't change much)
    readingTtlSeconds: 3600,   // 1 hour (realtime updates hourly)
    ...(redisUrl ? { redisUrl } : {}),
  };

  return new CachedProvider(provider, cacheOptions);
}
