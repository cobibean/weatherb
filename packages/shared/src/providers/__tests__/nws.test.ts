import { afterEach, describe, expect, it, vi } from 'vitest';
import { NwsProvider } from '../nws';

// Helper to mock fetch responses in sequence
function mockFetchSequence(...responses: unknown[]): void {
  let callIndex = 0;
  // @ts-expect-error test shim
  globalThis.fetch = vi.fn(async () => {
    const json = responses[callIndex++];
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => json,
    };
  });
}

describe('NwsProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches forecast and returns temperature in tenths', async () => {
    const provider = new NwsProvider({ userAgent: 'WeatherB/0.0 (test)' });
    const targetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // Mock responses: points → forecastHourly
    mockFetchSequence(
      {
        properties: {
          forecastHourly: 'https://api.weather.gov/gridpoints/TEST/1,2/forecastHourly',
          observationStations: 'https://api.weather.gov/gridpoints/TEST/1,2/stations',
        },
      },
      {
        properties: {
          periods: [
            {
              startTime: new Date(targetTime * 1000).toISOString(),
              temperature: 75,
              temperatureUnit: 'F',
            },
          ],
        },
      }
    );

    const result = await provider.getForecast(40.7, -74.0, targetTime);
    expect(result).toBe(750); // 75F in tenths
  });

  it('fetches observation and returns reading', async () => {
    const provider = new NwsProvider({ userAgent: 'WeatherB/0.0 (test)' });
    const targetTime = Math.floor(Date.now() / 1000);

    // Mock responses: points → stations → observations
    mockFetchSequence(
      {
        properties: {
          forecastHourly: 'https://api.weather.gov/gridpoints/TEST/1,2/forecastHourly',
          observationStations: 'https://api.weather.gov/gridpoints/TEST/1,2/stations',
        },
      },
      {
        features: [{ id: 'https://api.weather.gov/stations/KNYC' }],
      },
      {
        features: [
          {
            properties: {
              timestamp: new Date(targetTime * 1000).toISOString(),
              temperature: { value: 25 },
            },
          },
        ],
      }
    );

    const result = await provider.getFirstReadingAtOrAfter(40.7, -74.0, targetTime);
    expect(result.tempF_tenths).toBe(770); // 25C = 77F = 770 tenths
    expect(result.observedTimestamp).toBeGreaterThanOrEqual(targetTime);
    expect(result.source).toBe('nws');
  });
});
