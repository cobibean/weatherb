import { describe, expect, it } from 'vitest';

import type { City } from '@weatherb/shared/constants';

import {
  cityIdToBytes32,
  forecastTenthsToThresholdTenths,
  selectMarketsForDay,
} from './market-selector';

type FakeRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

function createFakeRedis(): FakeRedis {
  const store = new Map<string, string>();
  return {
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
  };
}

describe('market-selector', () => {
  it('rounds forecast to whole degrees (tenths)', () => {
    expect(forecastTenthsToThresholdTenths(853)).toBe(850);
    expect(forecastTenthsToThresholdTenths(856)).toBe(860);
  });

  it('selects 5 markets evenly spaced with round-robin cities', async () => {
    const redis = createFakeRedis();
    const cities: City[] = [
      { id: 'a', name: 'A', latitude: 0, longitude: 0 },
      { id: 'b', name: 'B', latitude: 1, longitude: 1 },
      { id: 'c', name: 'C', latitude: 2, longitude: 2 },
    ];

    const baseTimeSec = 1_700_000_000;
    const spacingSeconds = 17_280; // 4.8h

    const markets = await selectMarketsForDay({
      // @ts-expect-error minimal redis stub for test
      redis,
      dailyMarketCount: 5,
      baseTimeSec,
      spacingSeconds,
      cities,
    });

    expect(markets).toHaveLength(5);
    expect(markets[0]?.resolveTimeSec).toBe(baseTimeSec + 1 * spacingSeconds);
    expect(markets[4]?.resolveTimeSec).toBe(baseTimeSec + 5 * spacingSeconds);

    expect(markets[0]?.city.id).toBe('a');
    expect(markets[1]?.city.id).toBe('b');
    expect(markets[2]?.city.id).toBe('c');
    expect(markets[3]?.city.id).toBe('a');
    expect(markets[4]?.city.id).toBe('b');

    expect(markets[0]?.cityIdBytes32).toBe(cityIdToBytes32('a'));
  });
});
