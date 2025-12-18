import { config as dotenvConfig } from 'dotenv';
import { CronJob } from 'cron';
import { z } from 'zod';

import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import type { Hex } from 'viem';

import { getSchedulerConfig } from './config';
import { logError, logInfo } from './log';
import { selectMarketsForDay } from './market-selector';
import { createMarketOnChain } from './create-market';
import { createSchedulerQueues } from './queue';

dotenvConfig({ path: process.env['DOTENV_CONFIG_PATH'] ?? '../../.env.local' });
dotenvConfig({ path: process.env['DOTENV_CONFIG_PATH_FALLBACK'] ?? '../../.env' });

const hexAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const hexPrivateKeySchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

type CreateJobPayload = {
  cityId: string;
  cityName: string;
  latitude: number;
  longitude: number;
  cityIdBytes32: string;
  resolveTimeSec: number;
};

const createJobPayloadSchema = z.object({
  cityId: z.string().min(1),
  cityName: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  cityIdBytes32: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  resolveTimeSec: z.number().int().positive(),
});

export type SchedulerMain = () => Promise<void>;

export const main: SchedulerMain = async () => {
  const config = getSchedulerConfig();
  const provider = createWeatherProviderFromEnv();

  const spacingHours =
    config.MARKET_SPACING_HOURS ?? 24 / Math.min(5, Math.max(1, config.DAILY_MARKET_COUNT));
  const spacingSeconds = Math.round(spacingHours * 3600);

  const queues = createSchedulerQueues({
    redisUrl: config.REDIS_URL,
    processor: async (rawPayload) => {
      const payload = createJobPayloadSchema.parse(rawPayload);
      logInfo('Creating market job started', payload);

      const health = await provider.healthCheck();
      if (health.status === 'red') {
        throw new Error(`Provider health is red: ${health.errorMessage ?? 'unknown'}`);
      }

      const result = await createMarketOnChain(
        {
          rpcUrl: config.RPC_URL,
          contractAddress: hexAddressSchema.parse(config.CONTRACT_ADDRESS) as Hex,
          privateKey: hexPrivateKeySchema.parse(config.SCHEDULER_PRIVATE_KEY) as Hex,
        },
        {
          city: {
            id: payload.cityId,
            name: payload.cityName,
            latitude: payload.latitude,
            longitude: payload.longitude,
          },
          cityIdBytes32: payload.cityIdBytes32 as `0x${string}`,
          resolveTimeSec: payload.resolveTimeSec,
        },
      );

      logInfo('Market created (tx sent)', {
        marketId: result.marketId.toString(),
        cityId: payload.cityId,
        resolveTimeSec: payload.resolveTimeSec,
        tx: result.transactionHash,
        thresholdTenths: result.thresholdTenths,
        forecastTenths: result.forecastTempTenths,
      });
    },
  });

  queues.marketCreationWorker.on('failed', (job, err) => {
    logError(`Market creation failed (jobId=${job?.id ?? 'unknown'})`, err);
  });

  const cron = new CronJob(config.SCHEDULE_TIME_CRON, async () => {
    try {
      logInfo('Starting daily market creation');

      const outage = await queues.connection.get('weatherb:outage');
      if (outage === 'red') {
        logError('Outage mode active; skipping daily market creation');
        return;
      }

      const health = await provider.healthCheck();
      if (health.status === 'red') {
        logError('Provider health is red; skipping daily market creation', health);
        return;
      }

      const baseTimeSec = Math.floor(Date.now() / 1000);
      const markets = await selectMarketsForDay({
        redis: queues.connection,
        dailyMarketCount: config.DAILY_MARKET_COUNT,
        baseTimeSec,
        spacingSeconds,
      });

      for (const [i, m] of markets.entries()) {
        const payload: CreateJobPayload = {
          cityId: m.city.id,
          cityName: m.city.name,
          latitude: m.city.latitude,
          longitude: m.city.longitude,
          cityIdBytes32: m.cityIdBytes32,
          resolveTimeSec: m.resolveTimeSec,
        };
        await queues.marketCreationQueue.add('create', payload, {
          jobId: `create:${new Date(baseTimeSec * 1000).toISOString().slice(0, 10)}:${i}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false,
        });
      }

      logInfo('Enqueued daily market creation jobs', { count: markets.length, spacingSeconds });
    } catch (error) {
      logError('Daily cron run failed', error);
    }
  });

  cron.start();
  logInfo('Scheduler started', { cron: config.SCHEDULE_TIME_CRON });
};

if (process.env['NODE_ENV'] !== 'test') {
  void main();
}
