import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

if (process.env.WEATHERB_VERIFY !== '1' && process.env.WEATHERB_ENV_FILE !== 'none')
  config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

// Generation needs no database. Migration commands require a configured URL.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(url ? { datasource: { url } } : {}),
});
