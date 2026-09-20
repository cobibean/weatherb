import { describe, expect, it } from 'vitest';
import { validateSettlementReading } from '../weather-timing';
import { CachedProvider } from '../../providers/cached-provider';
import { TomorrowIoProvider } from '../../providers/tomorrow-io';
import { vi } from 'vitest';

describe('Settlement observation window', () => {
  it.each([1000, 1600])('accepts inclusive timestamp %i', (observedTimestamp) => {
    expect(() =>
      validateSettlementReading(
        { tempF_tenths: 850, source: 'fixture', observedTimestamp },
        1000,
        1600,
      ),
    ).not.toThrow();
  });
  it.each([999, 1601, NaN, Infinity, 1000.5])('rejects timestamp %s', (observedTimestamp) => {
    expect(() =>
      validateSettlementReading(
        { tempF_tenths: 850, source: 'fixture', observedTimestamp },
        1000,
        1600,
      ),
    ).toThrow();
  });
  it('rejects future data and unsupported temperatures', () => {
    expect(() =>
      validateSettlementReading(
        { tempF_tenths: 850, source: 'fixture', observedTimestamp: 1100 },
        1000,
        1050,
      ),
    ).toThrow();
    expect(() =>
      validateSettlementReading(
        { tempF_tenths: -10, source: 'fixture', observedTimestamp: 1000 },
        1000,
        1000,
      ),
    ).toThrow();
  });
  it('does not reuse readings for different target seconds in the same hour', async () => {
    const inner = {
      name: 'fixture',
      getForecast: vi.fn(),
      healthCheck: vi.fn(),
      getFirstReadingAtOrAfter: vi.fn(async (_lat: number, _lon: number, timestamp: number) => ({
        tempF_tenths: 850,
        observedTimestamp: timestamp,
        source: 'fixture',
      })),
    };
    const cached = new CachedProvider(inner);
    expect((await cached.getFirstReadingAtOrAfter(1, 2, 1000)).observedTimestamp).toBe(1000);
    expect((await cached.getFirstReadingAtOrAfter(1, 2, 1100)).observedTimestamp).toBe(1100);
    await cached.getFirstReadingAtOrAfter(1, 2, 1000);
    expect(inner.getFirstReadingAtOrAfter).toHaveBeenCalledTimes(2);
  });
  it('does not cache invalid observations that would poison retries', async () => {
    const reading = vi
      .fn()
      .mockResolvedValueOnce({ tempF_tenths: 850, observedTimestamp: 999, source: 'fixture' })
      .mockResolvedValue({ tempF_tenths: 850, observedTimestamp: 1000, source: 'fixture' });
    const cached = new CachedProvider({
      name: 'fixture',
      getForecast: vi.fn(),
      healthCheck: vi.fn(),
      getFirstReadingAtOrAfter: reading,
    });
    await expect(cached.getFirstReadingAtOrAfter(1, 2, 1000)).rejects.toThrow();
    await expect(cached.getFirstReadingAtOrAfter(1, 2, 1000)).resolves.toMatchObject({
      observedTimestamp: 1000,
    });
    expect(reading).toHaveBeenCalledTimes(2);
  });
  it('rejects old realtime requests before fetching current weather', async () => {
    const provider = new TomorrowIoProvider({ apiKey: 'fixture' });
    const current = vi.spyOn(provider, 'getCurrentTemperature');
    await expect(
      provider.getFirstReadingAtOrAfter(1, 2, Math.floor(Date.now() / 1000) - 601),
    ).rejects.toThrow();
    expect(current).not.toHaveBeenCalled();
  });
});
