import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';

export type ProviderComparison = {
  provider: string;
  tempTenths: number | null;
  error?: string;
};

/**
 * Fetch temperature readings from the configured provider.
 * With Tomorrow.io as the single provider, this returns one reading.
 */
export async function fetchAllProviderReadings(
  latitude: number,
  longitude: number,
  timestamp: number,
): Promise<ProviderComparison[]> {
  const provider = createWeatherProviderFromEnv();
  try {
    const reading = await provider.getFirstReadingAtOrAfter(latitude, longitude, timestamp);
    return [
      {
        provider: reading.source,
        tempTenths: reading.tempF_tenths,
      },
    ];
  } catch (error) {
    return [
      {
        provider: provider.name,
        tempTenths: null,
        error: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}
