import { z } from 'zod';

const configSchema = z.object({
  REDIS_URL: z.string().min(1),
  RPC_URL: z.string().url(),
  CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  SCHEDULER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  DAILY_MARKET_COUNT: z.coerce.number().int().positive().max(5).default(5),
  MARKET_SPACING_HOURS: z.coerce.number().positive().optional(),
  SCHEDULE_TIME_CRON: z.string().min(1).default('0 0 * * *'),
  WEATHER_PROVIDER: z.enum(['met-no', 'nws', 'open-meteo']).optional(),
  WEATHER_USER_AGENT: z.string().optional(),
});

export type SchedulerConfig = z.infer<typeof configSchema>;

export function getSchedulerConfig(): SchedulerConfig {
  return configSchema.parse(process.env);
}
