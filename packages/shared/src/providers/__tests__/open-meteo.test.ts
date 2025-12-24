import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenMeteoProvider } from '../open-meteo';

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

describe('OpenMeteoProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches forecast and returns temperature in tenths', async () => {
    const provider = new OpenMeteoProvider();
    const targetTime = Math.floor(Date.now() / 1000) + 3600;
    const targetHour = new Date(targetTime * 1000).toISOString().slice(0, 13) + ':00';

    mockFetchOnce({
      hourly: {
        time: [targetHour],
        temperature_2m: [75.5],
      },
    });

    const result = await provider.getForecast(40.7, -74.0, targetTime);
    expect(result).toBe(755); // 75.5F in tenths
  });

  it('fetches historical data for past timestamps', async () => {
    const provider = new OpenMeteoProvider();
    const targetTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const targetHour = new Date(targetTime * 1000).toISOString().slice(0, 13) + ':00';

    mockFetchOnce({
      hourly: {
        time: [targetHour],
        temperature_2m: [68.0],
      },
    });

    const result = await provider.getFirstReadingAtOrAfter(40.7, -74.0, targetTime);
    expect(result.tempF_tenths).toBe(680);
    expect(result.source).toBe('open-meteo');
  });
});
