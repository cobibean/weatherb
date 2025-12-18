import { z } from 'zod';

const envSchema = z.object({
  WEATHER_PROVIDER: z.enum(['met-no', 'nws', 'open-meteo']).default('met-no'),
  WEATHER_USER_AGENT: z.string().optional(),
  MET_NO_USER_AGENT: z.string().optional(),
  NWS_USER_AGENT: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export type SharedEnv = z.infer<typeof envSchema>;

export function getSharedEnv(): SharedEnv {
  return envSchema.parse(process.env);
}
