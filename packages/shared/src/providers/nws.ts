import { z } from 'zod';

import type { ProviderHealth, WeatherProvider, WeatherReading } from '../types/provider';
import { celsiusToFahrenheitTenths } from '../utils/temperature';
import { fetchJson } from './http';

export type NwsOptions = {
  userAgent: string;
};

const pointsSchema = z.object({
  properties: z.object({
    forecastHourly: z.string().url(),
    observationStations: z.string().url(),
  }),
});

const stationsSchema = z.object({
  features: z.array(
    z.object({
      id: z.string().url(),
    }),
  ),
});

const observationsSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        timestamp: z.string(),
        temperature: z
          .object({
            value: z.number().nullable(),
          })
          .nullable(),
      }),
    }),
  ),
});

const hourlyForecastSchema = z.object({
  properties: z.object({
    periods: z.array(
      z.object({
        startTime: z.string(),
        temperature: z.number(),
        temperatureUnit: z.string(),
      }),
    ),
  }),
});

export class NwsProvider implements WeatherProvider {
  public readonly name = 'nws';
  private readonly userAgent: string;

  public constructor(options: NwsOptions) {
    this.userAgent = options.userAgent;
  }

  public async getForecast(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<number> {
    const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
    const points = await fetchJson(pointsUrl, pointsSchema, {
      headers: { 'user-agent': this.userAgent },
    });

    const hourly = await fetchJson(points.properties.forecastHourly, hourlyForecastSchema, {
      headers: { 'user-agent': this.userAgent },
    });

    const targetIso = new Date(timestamp * 1000).toISOString();
    const period = hourly.properties.periods.find((p) => p.startTime >= targetIso);
    if (!period) throw new Error('No forecast at/after requested time');
    if (period.temperatureUnit !== 'F')
      throw new Error(`Unexpected NWS temp unit: ${period.temperatureUnit}`);
    return Math.round(period.temperature * 10);
  }

  public async getFirstReadingAtOrAfter(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<WeatherReading> {
    const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
    const points = await fetchJson(pointsUrl, pointsSchema, {
      headers: { 'user-agent': this.userAgent },
    });

    const stations = await fetchJson(points.properties.observationStations, stationsSchema, {
      headers: { 'user-agent': this.userAgent },
    });
    const stationUrl = stations.features[0]?.id;
    if (!stationUrl) throw new Error('No observation stations found');

    const startIso = new Date(timestamp * 1000).toISOString();
    const observationsUrl = new URL(`${stationUrl}/observations`);
    observationsUrl.searchParams.set('start', startIso);
    observationsUrl.searchParams.set('limit', '10');

    const observations = await fetchJson(observationsUrl.toString(), observationsSchema, {
      headers: { 'user-agent': this.userAgent },
    });
    const feature = observations.features.find((f) => f.properties.timestamp >= startIso);
    if (!feature) throw new Error('No observation at/after requested time');

    const celsius = feature.properties.temperature?.value;
    if (celsius === null || celsius === undefined)
      throw new Error('Observation missing temperature');

    return {
      tempF_tenths: celsiusToFahrenheitTenths(celsius),
      observedTimestamp: Math.floor(new Date(feature.properties.timestamp).getTime() / 1000),
      source: this.name,
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const url = 'https://api.weather.gov/';
      const response = await fetch(url, { headers: { 'user-agent': this.userAgent } });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
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
