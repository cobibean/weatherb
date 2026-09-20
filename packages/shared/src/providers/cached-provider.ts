import { validateSettlementReading } from '../utils/weather-timing';
import { z } from 'zod';

import type { ProviderHealth, WeatherProvider, WeatherReading } from '../types/provider';
import { createMemoryCacheStore, type CacheStore } from './cache';
import { createRedisCacheStore } from './redis-store';

export type CachedProviderOptions = {
  cachePrefix?: string;
  forecastTtlSeconds?: number; // default 86400 (24 hours for forecasts)
  readingTtlSeconds?: number; // default 3600 (1 hour for realtime readings)
  redisUrl?: string;
  cacheStore?: CacheStore;
};

const numberSchema = z.number();
const readingSchema = z.object({
  tempF_tenths: z.number(),
  observedTimestamp: z.number(),
  source: z.string(),
});

function stableKey(parts: readonly (string | number)[]): string {
  return parts.join(':');
}

/**
 * Round timestamp to nearest hour for better cache hit rates.
 * This allows queries within the same hour to share cached results.
 */
function roundToHour(timestamp: number): number {
  return Math.floor(timestamp / 3600) * 3600;
}

/**
 * Round coordinates to 4 decimal places (~11m precision).
 * Prevents cache misses from tiny coordinate differences.
 */
function roundCoord(coord: number): number {
  return Math.round(coord * 10000) / 10000;
}

export class CachedProvider implements WeatherProvider {
  public readonly name: string;
  private readonly inner: WeatherProvider;
  private readonly cache: CacheStore;
  private readonly forecastTtlSeconds: number;
  private readonly readingTtlSeconds: number;
  private readonly cachePrefix: string;

  public constructor(inner: WeatherProvider, options: CachedProviderOptions = {}) {
    this.inner = inner;
    this.name = `cached(${inner.name})`;
    this.cachePrefix = options.cachePrefix ?? 'weatherB';
    // Tomorrow.io API budget: Forecasts change slowly (24h TTL), realtime updates hourly (1h TTL)
    this.forecastTtlSeconds = options.forecastTtlSeconds ?? 86400; // 24 hours
    this.readingTtlSeconds = options.readingTtlSeconds ?? 3600; // 1 hour

    if (options.cacheStore) {
      this.cache = options.cacheStore;
    } else if (options.redisUrl) {
      this.cache = createRedisCacheStore(options.redisUrl);
    } else {
      this.cache = createMemoryCacheStore();
    }
  }

  public async getForecast(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<number> {
    // Round coordinates and timestamp for better cache hit rates
    const roundedLat = roundCoord(latitude);
    const roundedLon = roundCoord(longitude);
    const roundedTime = roundToHour(timestamp);

    const key = stableKey([
      this.cachePrefix,
      this.inner.name,
      'forecast',
      roundedLat,
      roundedLon,
      roundedTime,
    ]);

    const cached = await this.cache.get(key);
    if (cached) {
      console.log(`[Cache HIT] Forecast: ${key}`);
      return numberSchema.parse(JSON.parse(cached));
    }

    console.log(`[Cache MISS] Forecast: ${key}`);
    const value = await this.inner.getForecast(latitude, longitude, timestamp);
    await this.cache.set(key, JSON.stringify(value), this.forecastTtlSeconds);
    return value;
  }

  public async getFirstReadingAtOrAfter(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<WeatherReading> {
    // Coordinates can be rounded, but each exact settlement target needs its own reading.
    const roundedLat = roundCoord(latitude);
    const roundedLon = roundCoord(longitude);
    const exactTarget = timestamp;

    const key = stableKey([
      this.cachePrefix,
      this.inner.name,
      'reading',
      roundedLat,
      roundedLon,
      exactTarget,
    ]);

    const cached = await this.cache.get(key);
    if (cached) {
      console.log(`[Cache HIT] Reading: ${key}`);
      const reading = readingSchema.parse(JSON.parse(cached));
      validateSettlementReading(reading, timestamp);
      return reading;
    }

    console.log(`[Cache MISS] Reading: ${key}`);
    const value = await this.inner.getFirstReadingAtOrAfter(latitude, longitude, timestamp);
    validateSettlementReading(value, timestamp);
    await this.cache.set(key, JSON.stringify(value), this.readingTtlSeconds);
    return value;
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return await this.inner.healthCheck();
  }
}
