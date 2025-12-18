import { z } from 'zod';

import type { WeatherProvider } from '../types/provider';
import { MetNoProvider } from './met-no';
import { NwsProvider } from './nws';
import { OpenMeteoProvider } from './open-meteo';

const argsSchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  ts: z.coerce.number(),
});

async function timed<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<{ name: string; ms: number; value?: T; error?: string }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { name, ms: Date.now() - start, value };
  } catch (error) {
    return { name, ms: Date.now() - start, error: String(error) };
  }
}

async function run(): Promise<void> {
  const parsed = argsSchema.safeParse({
    lat: process.argv[2],
    lon: process.argv[3],
    ts: process.argv[4],
  });

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Usage: tsx compare.ts <lat> <lon> <unix_ts>');
    process.exit(1);
  }

  const { lat, lon, ts } = parsed.data;
  const userAgent = process.env['MET_NO_USER_AGENT'] ?? 'WeatherB/0.0 (dev)';

  const providers: WeatherProvider[] = [
    new MetNoProvider({ userAgent }),
    new NwsProvider({ userAgent }),
    new OpenMeteoProvider(),
  ];

  const results = await Promise.all(
    providers.flatMap((p) => [
      timed(`${p.name}.forecast`, () => p.getForecast(lat, lon, ts)),
      timed(`${p.name}.firstAtOrAfter`, () => p.getFirstReadingAtOrAfter(lat, lon, ts)),
    ]),
  );

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ lat, lon, ts, results }, null, 2));
}

void run();
