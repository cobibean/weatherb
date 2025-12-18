import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';

export type SettlerMain = () => Promise<void>;

export const main: SettlerMain = async () => {
  // Epic 4: iterate markets, request FDC proof, and call resolveMarket().
  const provider = createWeatherProviderFromEnv();
  const health = await provider.healthCheck();
  console.log('settler: provider health', { provider: provider.name, ...health });
};

if (process.env['NODE_ENV'] !== 'test') {
  void main();
}
