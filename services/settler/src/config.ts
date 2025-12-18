import { z } from 'zod';

const configSchema = z.object({
  REDIS_URL: z.string().min(1),
  RPC_URL: z.string().url(),
  CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  SETTLER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  SETTLEMENT_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  MAX_SETTLEMENT_RETRIES: z.coerce.number().int().positive().max(5).default(5),
  SETTLEMENT_BACKOFF_MS: z.coerce.number().int().positive().default(5000),
  SETTLEMENT_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(3),
  FDC_HUB_URL: z.string().url().optional(),
});

export type SettlerConfig = z.infer<typeof configSchema>;

export function getSettlerConfig(): SettlerConfig {
  return configSchema.parse(process.env);
}
