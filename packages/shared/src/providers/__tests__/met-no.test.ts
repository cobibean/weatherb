import { afterEach, describe, expect, it, vi } from 'vitest';

import { MetNoProvider } from '../met-no';

function mockFetchOnce(json: unknown): void {
  // @ts-expect-error test shim
  globalThis.fetch = vi.fn(async () => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => json,
    };
  });
}

describe('MetNoProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns first reading at/after timestamp', async () => {
    const provider = new MetNoProvider({ userAgent: 'WeatherB/0.0 (test)' });

    const t0 = 1_700_000_000; // seconds
    const before = new Date((t0 - 60) * 1000).toISOString();
    const at = new Date(t0 * 1000).toISOString();

    mockFetchOnce({
      properties: {
        timeseries: [
          {
            time: before,
            data: { instant: { details: { air_temperature: 0 } } },
          },
          {
            time: at,
            data: { instant: { details: { air_temperature: 0 } } },
          },
        ],
      },
    });

    const reading = await provider.getFirstReadingAtOrAfter(0, 0, t0);
    expect(reading.tempF_tenths).toBe(320);
    expect(reading.observedTimestamp).toBe(t0);
    expect(reading.source).toBe('met-no');
  });
});
