import { readFileSync } from 'node:fs';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { requireDatabaseUrl } from '@weatherb/shared/utils/database-url';
import { CITIES } from '@weatherb/shared/constants';
import { seedDevelopmentDatabase } from '../lib/development-seed';

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: requireDatabaseUrl(),
    connectionTimeoutMillis: 5000,
    max: 3,
  }),
});
try {
  const command = process.argv[2];
  if (command === 'access') {
    const client = new pg.Client({
      connectionString: requireDatabaseUrl(),
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      await client.query(
        readFileSync(
          new URL('../../../../scripts/development/access.sql', import.meta.url),
          'utf8',
        ),
      );
    } finally {
      await client.end();
    }
  } else if (command === 'settler') {
    const mode = process.argv[3];
    if (mode !== 'enable' && mode !== 'disable') throw new Error('Use settler enable|disable');
    await db.systemConfig.update({ where: { id: 'default' }, data: { settlerPaused: mode === 'disable' } });
    console.log(JSON.stringify({ settlerPaused: mode === 'disable' }));
  } else if (command === 'mark-test') {
    const contractMarketId = Number(process.argv[3]);
    if (!Number.isSafeInteger(contractMarketId) || contractMarketId < 0) throw new Error('Use mark-test <contractMarketId>');
    await db.market.update({ where: { contractMarketId }, data: { isTest: true } });
    console.log(JSON.stringify({ contractMarketId, isTest: true }));
  } else if (command === 'seed') await seedDevelopmentDatabase(db);
  else if (command !== 'check') throw new Error('Use seed, check, settler, or mark-test');
  if (command === 'access') {
    console.log('Server-only access profile applied.');
  } else if (command === 'seed' || command === 'check') {
    const [cities, config, markets, marketRecords] = await Promise.all([
      db.city.findMany({ orderBy: { slug: 'asc' }, select: { slug: true, isActive: true } }),
      db.systemConfig.findUnique({ where: { id: 'default' } }),
      db.market.count(),
      db.market.findMany({
        orderBy: { contractMarketId: 'asc' },
        select: {
          contractMarketId: true,
          cityName: true,
          resolveTime: true,
          thresholdTemp: true,
          status: true,
          yesPool: true,
          noPool: true,
          totalFees: true,
          actualTemp: true,
          outcome: true,
        },
      }),
    ]);
    const ready =
      Boolean(config) && CITIES.every((city) => cities.some((row) => row.slug === city.slug));
    console.log(
      JSON.stringify(
        {
          ready,
          cities,
          markets,
          marketRecords,
          schedulerPaused: config?.isPaused,
          settlerPaused: config?.settlerPaused,
        },
        null,
        2,
      ),
    );
    if (!ready) process.exitCode = 1;
  }
} catch {
  console.error(
    'Development database operation failed. Check configuration, migrations, and database availability.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
