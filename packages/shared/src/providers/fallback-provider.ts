import type { ProviderHealth, WeatherProvider, WeatherReading } from '../types/provider';

export type FallbackAttempt = {
  provider: string;
  error: string;
};

export class FallbackProvider implements WeatherProvider {
  public readonly name: string;
  private readonly providers: readonly WeatherProvider[];

  public constructor(providers: readonly WeatherProvider[]) {
    if (providers.length === 0) throw new Error('FallbackProvider requires at least one provider');
    this.providers = providers;
    this.name = `fallback(${providers.map((p) => p.name).join(',')})`;
  }

  public async getForecast(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<number> {
    const result = await this.firstSuccessful((p) => p.getForecast(latitude, longitude, timestamp));
    return result;
  }

  public async getFirstReadingAtOrAfter(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<WeatherReading> {
    const result = await this.firstSuccessful((p) =>
      p.getFirstReadingAtOrAfter(latitude, longitude, timestamp),
    );
    return result;
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const results = await Promise.allSettled(this.providers.map((p) => p.healthCheck()));
    const healthy = results
      .map((r, index) => ({ r, p: this.providers[index] }))
      .filter(
        (x): x is { r: PromiseFulfilledResult<ProviderHealth>; p: WeatherProvider } =>
          x.r.status === 'fulfilled',
      )
      .map((x) => x.r.value);

    if (healthy.length === 0) {
      return {
        status: 'red',
        latencyMs: 0,
        lastCheck: Date.now(),
        errorMessage: 'All providers healthCheck failed',
      };
    }

    const best = healthy.reduce((acc, cur) => (acc.latencyMs <= cur.latencyMs ? acc : cur));
    const statusRank = (s: ProviderHealth['status']) =>
      s === 'green' ? 0 : s === 'yellow' ? 1 : 2;
    const overallStatus = healthy.reduce<ProviderHealth['status']>(
      (acc, cur) => (statusRank(acc) >= statusRank(cur.status) ? acc : cur.status),
      'green',
    );

    return { ...best, status: overallStatus };
  }

  private async firstSuccessful<T>(fn: (p: WeatherProvider) => Promise<T>): Promise<T> {
    const attempts: FallbackAttempt[] = [];
    for (const provider of this.providers) {
      try {
        return await fn(provider);
      } catch (error) {
        attempts.push({ provider: provider.name, error: String(error) });
      }
    }
    throw new Error(`All providers failed: ${JSON.stringify(attempts)}`);
  }
}
