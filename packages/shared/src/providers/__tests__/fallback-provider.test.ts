import { describe, expect, it } from 'vitest';

import type { WeatherProvider } from '../../types/provider';
import { FallbackProvider } from '../fallback-provider';

describe('FallbackProvider', () => {
  it('falls back on errors', async () => {
    const failing: WeatherProvider = {
      name: 'fail',
      getForecast: async () => {
        throw new Error('nope');
      },
      getFirstReadingAtOrAfter: async () => {
        throw new Error('nope');
      },
      healthCheck: async () => ({ status: 'red', latencyMs: 1, lastCheck: Date.now() }),
    };

    const ok: WeatherProvider = {
      name: 'ok',
      getForecast: async () => 456,
      getFirstReadingAtOrAfter: async () => ({
        tempF_tenths: 456,
        observedTimestamp: 100,
        source: 'ok',
      }),
      healthCheck: async () => ({ status: 'green', latencyMs: 1, lastCheck: Date.now() }),
    };

    const provider = new FallbackProvider([failing, ok]);
    await expect(provider.getForecast(0, 0, 0)).resolves.toBe(456);
  });
});
