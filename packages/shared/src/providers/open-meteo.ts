import { z } from 'zod';

import type { ProviderHealth, WeatherProvider, WeatherReading } from '../types/provider';

export class OpenMeteoProvider implements WeatherProvider {
  public readonly name = 'open-meteo';

  public async getForecast(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<number> {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('hourly', 'temperature_2m');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('timezone', 'UTC');

    const data = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!data.ok) throw new Error(`HTTP ${data.status} ${data.statusText}`);
    const json = (await data.json()) as unknown;

    const schema = z.object({
      hourly: z.object({
        time: z.array(z.string()),
        temperature_2m: z.array(z.number()),
      }),
    });

    const parsed = schema.parse(json);
    const targetMs = timestamp * 1000;
    const idx = parsed.hourly.time.findIndex((t) => new Date(t).getTime() >= targetMs);
    if (idx === -1) throw new Error('No forecast at/after requested time');
    const tempF = parsed.hourly.temperature_2m[idx];
    if (tempF === undefined) throw new Error('Forecast missing temperature');
    return Math.round(tempF * 10);
  }

  public async getFirstReadingAtOrAfter(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<WeatherReading> {
    const d = new Date(timestamp * 1000);
    const date = d.toISOString().slice(0, 10);
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('start_date', date);
    url.searchParams.set('end_date', date);
    url.searchParams.set('hourly', 'temperature_2m');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('timezone', 'UTC');

    const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const json = (await response.json()) as unknown;

    const schema = z.object({
      hourly: z.object({
        time: z.array(z.string()),
        temperature_2m: z.array(z.number()),
      }),
    });
    const parsed = schema.parse(json);

    const targetMs = timestamp * 1000;
    const idx = parsed.hourly.time.findIndex((t) => new Date(t).getTime() >= targetMs);
    if (idx === -1) throw new Error('No historical reading at/after requested time');
    const time = parsed.hourly.time[idx];
    const tempF = parsed.hourly.temperature_2m[idx];
    if (!time || tempF === undefined) throw new Error('Historical data missing');

    return {
      tempF_tenths: Math.round(tempF * 10),
      observedTimestamp: Math.floor(new Date(time).getTime() / 1000),
      source: this.name,
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', '0');
      url.searchParams.set('longitude', '0');
      url.searchParams.set('hourly', 'temperature_2m');
      url.searchParams.set('temperature_unit', 'fahrenheit');
      url.searchParams.set('timezone', 'UTC');
      const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
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
