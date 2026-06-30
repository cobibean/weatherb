import { afterEach, describe, expect, it, vi } from 'vitest';
import { TomorrowIoProvider } from '../tomorrow-io';

function mockFetchOnce(json: unknown): void {
  // @ts-expect-error test shim
  globalThis.fetch = vi.fn(async () => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  });
}

describe('TomorrowIoProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches current temperature and returns tenths', async () => {
    const provider = new TomorrowIoProvider({ apiKey: 'test-key' });
    const nowIso = new Date().toISOString();

    mockFetchOnce({
      data: {
        time: nowIso,
        values: { temperature: 20 },
      },
      location: { lat: 40.7, lon: -74.0 },
    });

    const result = await provider.getCurrentTemperature(40.7, -74.0);
    expect(result.tempF_tenths).toBe(680);
    expect(result.observedTimestamp).toBeGreaterThan(0);
    expect(result.source).toBe('tomorrow-io');
  });

  it('fetches forecast and returns temperature in tenths', async () => {
    const provider = new TomorrowIoProvider({ apiKey: 'test-key' });
    const targetTime = Math.floor(Date.now() / 1000) + 3600;

    mockFetchOnce({
      timelines: {
        hourly: [
          { time: new Date(targetTime * 1000).toISOString(), values: { temperature: 22 } },
        ],
      },
      location: { lat: 40.7, lon: -74.0 },
    });

    const result = await provider.getForecast(40.7, -74.0, targetTime);
    expect(result).toBe(716);
  });
});
