import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';

export type SchedulerMain = () => Promise<void>;

export const main: SchedulerMain = async () => {
  // Epic 4: implement market creation cadence.
  const provider = createWeatherProviderFromEnv();
  const health = await provider.healthCheck();
  console.log('scheduler: provider health', { provider: provider.name, ...health });
};

if (process.env['NODE_ENV'] !== 'test') {
  void main();
}
