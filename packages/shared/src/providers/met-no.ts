import { z } from 'zod';

import type { ProviderHealth, WeatherProvider, WeatherReading } from '../types/provider';
import { celsiusToFahrenheitTenths } from '../utils/temperature';
import { fetchJson } from './http';

export type MetNoOptions = {
  userAgent: string;
};

const timeSeriesItemSchema = z.object({
  time: z.string(),
  data: z.object({
    instant: z.object({
      details: z.object({
        air_temperature: z.number(),
      }),
    }),
  }),
});

const metNoResponseSchema = z.object({
  properties: z.object({
    timeseries: z.array(timeSeriesItemSchema),
  }),
});

function firstTimeSeriesAtOrAfter(
  timeseries: readonly z.infer<typeof timeSeriesItemSchema>[],
  ms: number,
) {
  const targetIso = new Date(ms).toISOString();
  const item = timeseries.find((t) => t.time >= targetIso);
  if (!item) throw new Error('No timeseries item at/after requested time');
  return item;
}

export class MetNoProvider implements WeatherProvider {
  public readonly name = 'met-no';
  private readonly userAgent: string;

  public constructor(options: MetNoOptions) {
    this.userAgent = options.userAgent;
  }

  public async getForecast(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<number> {
    const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));

    const data = await fetchJson(url.toString(), metNoResponseSchema, {
      headers: { 'user-agent': this.userAgent },
    });

    const item = firstTimeSeriesAtOrAfter(data.properties.timeseries, timestamp * 1000);
    return celsiusToFahrenheitTenths(item.data.instant.details.air_temperature);
  }

  public async getFirstReadingAtOrAfter(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<WeatherReading> {
    const url = new URL('https://api.met.no/weatherapi/nowcast/2.0/complete');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));

    const data = await fetchJson(url.toString(), metNoResponseSchema, {
      headers: { 'user-agent': this.userAgent },
    });

    const item = firstTimeSeriesAtOrAfter(data.properties.timeseries, timestamp * 1000);
    return {
      tempF_tenths: celsiusToFahrenheitTenths(item.data.instant.details.air_temperature),
      observedTimestamp: Math.floor(new Date(item.time).getTime() / 1000),
      source: this.name,
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/status');
      await fetchJson(url.toString(), z.unknown(), { headers: { 'user-agent': this.userAgent } });
      return { status: 'green', latencyMs: Date.now() - start, lastCheck: Date.now() };
    } catch (error) {
      return {
        status: 'red',
        latencyMs: Date.now() - start,
        lastCheck: Date.now(),
        errorMessage: String(error),
      };
    }
  }
}
