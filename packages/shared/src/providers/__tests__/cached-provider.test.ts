import { describe, expect, it, vi } from 'vitest';

import type { WeatherProvider } from '../../types/provider';
import { CachedProvider } from '../cached-provider';

describe('CachedProvider', () => {
  it('caches forecast calls', async () => {
    const inner: WeatherProvider = {
      name: 'inner',
      getForecast: vi.fn(async () => 123),
      getFirstReadingAtOrAfter: vi.fn(async () => ({
        tempF_tenths: 123,
        observedTimestamp: 1,
        source: 'inner',
      })),
      healthCheck: vi.fn(async () => ({
        status: 'green' as const,
        latencyMs: 1,
        lastCheck: Date.now(),
      })),
    };

    const cached = new CachedProvider(inner, { forecastTtlSeconds: 60, readingTtlSeconds: 60 });
    await expect(cached.getForecast(1, 2, 3)).resolves.toBe(123);
    await expect(cached.getForecast(1, 2, 3)).resolves.toBe(123);
    expect(inner.getForecast).toHaveBeenCalledTimes(1);
  });
});
