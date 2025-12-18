import type { WeatherProvider } from '../types/provider';

import { CachedProvider } from './cached-provider';
import { getSharedEnv } from './env';
import { FallbackProvider } from './fallback-provider';
import { MetNoProvider } from './met-no';
import { NwsProvider } from './nws';
import { OpenMeteoProvider } from './open-meteo';

export function createWeatherProviderFromEnv(): WeatherProvider {
  const env = getSharedEnv();
  const redisUrl = env.REDIS_URL;

  const weatherUserAgent = env.WEATHER_USER_AGENT ?? process.env['WEATHER_USER_AGENT'];
  const metNoUserAgent =
    env.MET_NO_USER_AGENT ?? process.env['MET_NO_USER_AGENT'] ?? weatherUserAgent;
  const nwsUserAgent =
    env.NWS_USER_AGENT ?? process.env['NWS_USER_AGENT'] ?? weatherUserAgent ?? 'WeatherB/0.0 (dev)';

  const met = metNoUserAgent ? new MetNoProvider({ userAgent: metNoUserAgent }) : null;
  const nws = new NwsProvider({ userAgent: nwsUserAgent });
  const open = new OpenMeteoProvider();

  const providerStack: WeatherProvider[] = [];
  if (env.WEATHER_PROVIDER === 'met-no') {
    if (!met) throw new Error('MET_NO_USER_AGENT is required when WEATHER_PROVIDER=met-no');
    providerStack.push(met, nws, open);
  } else if (env.WEATHER_PROVIDER === 'nws') {
    providerStack.push(nws, open, ...(met ? [met] : []));
  } else {
    providerStack.push(open, nws, ...(met ? [met] : []));
  }

  const fallback = new FallbackProvider(providerStack);
  return new CachedProvider(fallback, redisUrl ? { redisUrl } : undefined);
}
