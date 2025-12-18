import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

export type SettlerQueues = {
  connection: IORedis;
  settlementQueue: Queue;
  settlementWorker: Worker;
};

export function createSettlerQueues(params: {
  redisUrl: string;
  concurrency: number;
  processor: (payload: unknown) => Promise<void>;
}): SettlerQueues {
  const connectionOptions: ConnectionOptions = { url: params.redisUrl };
  const redis = new IORedis(params.redisUrl, { maxRetriesPerRequest: 3 });

  const settlementQueue = new Queue('settlement', { connection: connectionOptions });
  const settlementWorker = new Worker(
    'settlement',
    async (job) => {
      await params.processor(job.data);
    },
    {
      connection: connectionOptions,
      concurrency: params.concurrency,
    },
  );

  return { connection: redis, settlementQueue, settlementWorker };
}
