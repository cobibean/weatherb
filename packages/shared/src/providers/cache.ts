type CacheEntry = {
  value: string;
  expiresAtMs: number;
};

export type CacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};

export function createMemoryCacheStore(): CacheStore {
  const store = new Map<string, CacheEntry>();

  return {
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() >= entry.expiresAtMs) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      store.set(key, { value, expiresAtMs: Date.now() + ttlSeconds * 1000 });
    },
  };
}
