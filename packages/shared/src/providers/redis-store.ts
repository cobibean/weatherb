import Redis from 'ioredis';

import type { CacheStore } from './cache';

export function createRedisCacheStore(redisUrl: string): CacheStore {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });

  return {
    async get(key: string): Promise<string | null> {
      return await redis.get(key);
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      await redis.set(key, value, 'EX', ttlSeconds);
    },
  };
}
