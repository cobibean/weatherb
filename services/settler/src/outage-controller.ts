import type IORedis from 'ioredis';
import type { WeatherProvider } from '@weatherb/shared/providers';

export type OutageState = {
  isOutage: boolean;
};

export function nextOutageState(
  prev: OutageState,
  healthStatus: 'green' | 'yellow' | 'red',
): { next: OutageState; changed: boolean } {
  const next: OutageState = { isOutage: healthStatus === 'red' };
  return { next, changed: next.isOutage !== prev.isOutage };
}

export class OutageController {
  private state: OutageState = { isOutage: false };

  public constructor(
    private readonly redis: IORedis,
    private readonly provider: WeatherProvider,
  ) {}

  public async tick(): Promise<{
    changed: boolean;
    isOutage: boolean;
    status: 'green' | 'yellow' | 'red';
  }> {
    const health = await this.provider.healthCheck();
    const { next, changed } = nextOutageState(this.state, health.status);
    if (!changed) return { changed: false, isOutage: this.state.isOutage, status: health.status };

    this.state = next;
    if (next.isOutage) {
      await this.redis.set('weatherb:outage', 'red');
    } else {
      await this.redis.del('weatherb:outage');
    }

    return { changed: true, isOutage: next.isOutage, status: health.status };
  }
}
