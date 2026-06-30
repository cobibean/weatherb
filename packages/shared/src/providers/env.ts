import { z } from 'zod';

const envSchema = z.object({
  // Tomorrow.io API (current provider)
  TOMORROW_IO_API_KEY: z.string().optional(),

  // Redis for caching (supports both standard and Upstash)
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
});

export type SharedEnv = z.infer<typeof envSchema>;

export function getSharedEnv(): SharedEnv {
  return envSchema.parse(process.env);
}
