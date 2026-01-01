import type { WeatherReading } from '@weatherb/shared/types';
import { MetNoProvider, NwsProvider, OpenMeteoProvider } from '@weatherb/shared/providers';

export type ProviderComparison = {
  provider: string;
  tempTenths: number | null;
  error?: string;
};

/**
 * Fetch temperature readings from all available providers individually
 * (bypassing the fallback mechanism to get all comparisons)
 */
export async function fetchAllProviderReadings(
  latitude: number,
  longitude: number,
  timestamp: number,
  userAgent?: string,
): Promise<ProviderComparison[]> {
  const results: ProviderComparison[] = [];
  const defaultUserAgent = userAgent ?? 'WeatherB/0.0 (dev)';

  // Fetch from NWS (Alt Temp 1)
  try {
    const nwsProvider = new NwsProvider({ userAgent: defaultUserAgent });
    const nwsReading = await nwsProvider.getFirstReadingAtOrAfter(latitude, longitude, timestamp);
    results.push({
      provider: 'nws',
      tempTenths: nwsReading.tempF_tenths,
    });
  } catch (error) {
    results.push({
      provider: 'nws',
      tempTenths: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fetch from Open-Meteo (Alt Temp 2)
  try {
    const openMeteoProvider = new OpenMeteoProvider();
    const openMeteoReading = await openMeteoProvider.getFirstReadingAtOrAfter(
      latitude,
      longitude,
      timestamp,
    );
    results.push({
      provider: 'open-meteo',
      tempTenths: openMeteoReading.tempF_tenths,
    });
  } catch (error) {
    results.push({
      provider: 'open-meteo',
      tempTenths: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fetch from MET Norway if user agent is available (Alt Temp 3, or primary if not already used)
  if (userAgent || process.env.MET_NO_USER_AGENT || process.env.WEATHER_USER_AGENT) {
    try {
      const metNoUserAgent =
        userAgent ?? process.env.MET_NO_USER_AGENT ?? process.env.WEATHER_USER_AGENT ?? defaultUserAgent;
      const metNoProvider = new MetNoProvider({ userAgent: metNoUserAgent });
      const metNoReading = await metNoProvider.getFirstReadingAtOrAfter(
        latitude,
        longitude,
        timestamp,
      );
      results.push({
        provider: 'met-no',
        tempTenths: metNoReading.tempF_tenths,
      });
    } catch (error) {
      results.push({
        provider: 'met-no',
        tempTenths: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
