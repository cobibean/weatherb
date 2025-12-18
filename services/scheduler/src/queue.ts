import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

export type SchedulerQueues = {
  connection: IORedis;
  marketCreationQueue: Queue;
  marketCreationWorker: Worker;
};

export function createSchedulerQueues(params: {
  redisUrl: string;
  processor: (payload: unknown) => Promise<void>;
}): SchedulerQueues {
  const connectionOptions: ConnectionOptions = { url: params.redisUrl };
  const redis = new IORedis(params.redisUrl, { maxRetriesPerRequest: 3 });

  const marketCreationQueue = new Queue('market-creation', { connection: connectionOptions });

  const marketCreationWorker = new Worker(
    'market-creation',
    async (job) => {
      await params.processor(job.data);
    },
    {
      connection: connectionOptions,
      concurrency: 1,
    },
  );

  return { connection: redis, marketCreationQueue, marketCreationWorker };
}
