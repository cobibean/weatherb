import { z } from 'zod';

import type { ProviderHealth, WeatherProvider, WeatherReading } from '../types/provider';
import { createMemoryCacheStore, type CacheStore } from './cache';
import { createRedisCacheStore } from './redis-store';

export type CachedProviderOptions = {
  cachePrefix?: string;
  forecastTtlSeconds?: number; // default 180
  readingTtlSeconds?: number; // default 86400
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
    this.cachePrefix = options.cachePrefix ?? 'weatherb';
    this.forecastTtlSeconds = options.forecastTtlSeconds ?? 180;
    this.readingTtlSeconds = options.readingTtlSeconds ?? 60 * 60 * 24;

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
    const key = stableKey([
      this.cachePrefix,
      this.inner.name,
      'forecast',
      latitude,
      longitude,
      timestamp,
    ]);
    const cached = await this.cache.get(key);
    if (cached) return numberSchema.parse(JSON.parse(cached));

    const value = await this.inner.getForecast(latitude, longitude, timestamp);
    await this.cache.set(key, JSON.stringify(value), this.forecastTtlSeconds);
    return value;
  }

  public async getFirstReadingAtOrAfter(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<WeatherReading> {
    const key = stableKey([
      this.cachePrefix,
      this.inner.name,
      'reading',
      latitude,
      longitude,
      timestamp,
    ]);
    const cached = await this.cache.get(key);
    if (cached) return readingSchema.parse(JSON.parse(cached));

    const value = await this.inner.getFirstReadingAtOrAfter(latitude, longitude, timestamp);
    await this.cache.set(key, JSON.stringify(value), this.readingTtlSeconds);
    return value;
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return await this.inner.healthCheck();
  }
}
