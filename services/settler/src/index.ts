import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import type { Hex } from 'viem';

import { getSettlerConfig } from './config';
import { logError, logInfo } from './log';
import { createSettlerQueues } from './queue';
import { fetchPendingMarkets } from './fetch-markets';
import { resolveMarketWithFdc } from './resolve';
import { OutageController } from './outage-controller';
import { createContractClients, WEATHER_MARKET_ABI } from './contract';
import { cancelEligibleMarkets } from './cancel-eligible';

dotenvConfig({ path: process.env['DOTENV_CONFIG_PATH'] ?? '../../.env.local' });
dotenvConfig({ path: process.env['DOTENV_CONFIG_PATH_FALLBACK'] ?? '../../.env' });

const hexAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const hexPrivateKeySchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

const settlePayloadSchema = z.object({
  marketId: z.coerce.bigint(),
});

export type SettlerMain = () => Promise<void>;

export const main: SettlerMain = async () => {
  const config = getSettlerConfig();
  const provider = createWeatherProviderFromEnv();

  const queues = createSettlerQueues({
    redisUrl: config.REDIS_URL,
    concurrency: config.SETTLEMENT_WORKER_CONCURRENCY,
    processor: async (raw) => {
      const payload = settlePayloadSchema.parse(raw);
      const marketId = payload.marketId;

      const pending = await fetchPendingMarkets({
        rpcUrl: config.RPC_URL,
        contractAddress: hexAddressSchema.parse(config.CONTRACT_ADDRESS) as Hex,
      });
      const market = pending.find((m) => m.marketId === marketId);
      if (!market) {
        logInfo('Market no longer pending; skipping', { marketId: marketId.toString() });
        return;
      }

      const result = await resolveMarketWithFdc({
        rpcUrl: config.RPC_URL,
        contractAddress: hexAddressSchema.parse(config.CONTRACT_ADDRESS) as Hex,
        privateKey: hexPrivateKeySchema.parse(config.SETTLER_PRIVATE_KEY) as Hex,
        market,
      });

      logInfo('Market resolved', {
        marketId: marketId.toString(),
        tx: result.transactionHash,
        observedTimestamp: result.observedTimestamp,
        tempTenths: result.tempTenths,
      });
    },
  });

  const outage = new OutageController(queues.connection, provider);
  setInterval(
    () => {
      void outage
        .tick()
        .then((r) => {
          if (!r.changed) return;
          if (r.isOutage) {
            logError('Entering outage mode (provider red)', { status: r.status });
            void cancelEligibleMarkets({
              rpcUrl: config.RPC_URL,
              contractAddress: hexAddressSchema.parse(config.CONTRACT_ADDRESS) as Hex,
              privateKey: hexPrivateKeySchema.parse(config.SETTLER_PRIVATE_KEY) as Hex,
            })
              .then((x) => {
                if (x.cancelled > 0) logInfo('Cancelled eligible markets due to outage', x);
              })
              .catch((e) => logError('Failed cancelling eligible markets during outage', e));
          } else {
            logInfo('Exiting outage mode (provider recovered)', { status: r.status });
          }
        })
        .catch((e) => logError('Outage tick failed', e));
    },
    5 * 60 * 1000,
  );

  queues.settlementWorker.on('failed', async (job, err) => {
    logError(`Settlement failed (jobId=${job?.id ?? 'unknown'})`, err);
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? config.MAX_SETTLEMENT_RETRIES;
    if (job.attemptsMade < maxAttempts) return;

    try {
      const { publicClient, walletClient } = createContractClients({
        rpcUrl: config.RPC_URL,
        privateKey: hexPrivateKeySchema.parse(config.SETTLER_PRIVATE_KEY) as Hex,
      });

      const { request } = await publicClient.simulateContract({
        address: hexAddressSchema.parse(config.CONTRACT_ADDRESS) as Hex,
        abi: WEATHER_MARKET_ABI,
        functionName: 'cancelMarketBySettler',
        args: [BigInt(job.data.marketId)],
        account: walletClient.account,
      });
      const tx = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      logInfo('Cancelled market after max retries', { marketId: String(job.data.marketId), tx });
    } catch (cancelError) {
      logError('Failed to cancel market after max retries', cancelError);
    }
  });

  setInterval(() => {
    void (async () => {
      try {
        const pending = await fetchPendingMarkets({
          rpcUrl: config.RPC_URL,
          contractAddress: hexAddressSchema.parse(config.CONTRACT_ADDRESS) as Hex,
        });

        const nowSec = Math.floor(Date.now() / 1000);
        const ready = pending.filter((m) => nowSec >= m.resolveTimeSec);

        for (const market of ready) {
          await queues.settlementQueue.add(
            'settle',
            { marketId: market.marketId.toString() },
            {
              jobId: `settle:${market.marketId.toString()}`,
              attempts: config.MAX_SETTLEMENT_RETRIES,
              backoff: { type: 'exponential', delay: config.SETTLEMENT_BACKOFF_MS },
              removeOnComplete: true,
              removeOnFail: false,
            },
          );
        }

        if (ready.length > 0) {
          logInfo('Enqueued settlement jobs', { count: ready.length });
        }
      } catch (error) {
        logError('Polling loop failed', error);
      }
    })();
  }, config.SETTLEMENT_POLL_INTERVAL_MS);

  logInfo('Settler started', {
    pollIntervalMs: config.SETTLEMENT_POLL_INTERVAL_MS,
    concurrency: config.SETTLEMENT_WORKER_CONCURRENCY,
  });
};

if (process.env['NODE_ENV'] !== 'test') {
  void main();
}
