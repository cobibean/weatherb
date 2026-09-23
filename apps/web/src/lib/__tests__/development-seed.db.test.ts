import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedDevelopmentDatabase } from '@/lib/development-seed';
import { readDatabaseReadiness } from '@/lib/database-readiness';
import { CITIES } from '@weatherb/shared/constants';

describe('Development database baseline', () => {
  it('seeds all canonical cities, a paused config, and no markets; reruns preserve IDs and settings', async () => {
    await prisma.systemConfig.deleteMany();
    const beforeMarkets = await prisma.market.count();
    await seedDevelopmentDatabase(prisma);
    const initial = await prisma.city.findMany({
      where: { slug: { in: CITIES.map((c) => c.slug) } },
      orderBy: { slug: 'asc' },
    });
    expect(initial).toHaveLength(8);
    for (const city of CITIES)
      expect(initial.find((row) => row.slug === city.slug)).toMatchObject({
        slug: city.slug,
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
        timezone: city.timezone,
      });
    expect(await prisma.systemConfig.findUnique({ where: { id: 'default' } })).toMatchObject({
      testMode: true,
      dailyCount: 5,
      bettingBuffer: 600,
      isPaused: true,
      settlerPaused: true,
    });
    await prisma.city.update({ where: { slug: 'nyc' }, data: { isActive: false } });
    await prisma.systemConfig.update({ where: { id: 'default' }, data: { cadence: 7 } });
    await seedDevelopmentDatabase(prisma);
    expect(
      (
        await prisma.city.findMany({
          where: { slug: { in: CITIES.map((c) => c.slug) } },
          orderBy: { slug: 'asc' },
        })
      ).map((row) => row.id),
    ).toEqual(initial.map((row) => row.id));
    expect(await prisma.city.findUnique({ where: { slug: 'nyc' } })).toMatchObject({
      isActive: false,
    });
    expect(await prisma.systemConfig.findUnique({ where: { id: 'default' } })).toMatchObject({
      cadence: 7,
      isPaused: true,
      settlerPaused: true,
    });
    expect(await prisma.market.count()).toBe(beforeMarkets);
    expect(await readDatabaseReadiness()).toEqual({
      status: 'ready',
      scheduler: 'paused',
      settler: 'paused',
    });
    await prisma.city.update({ where: { slug: 'nyc' }, data: { isActive: true } });
  });

  it('grants the runtime role only active tables and no schema creation', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE weatherb_app');
      expect(await tx.city.count()).toBeGreaterThanOrEqual(8);
      expect(await tx.systemConfig.count()).toBe(1);
      const rights = await tx.$queryRaw<
        Array<{ ddl: boolean; deferred: boolean; migrations: boolean; bypass: boolean }>
      >`
        SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS ddl,
        has_table_privilege(current_user, 'public."BotWallet"', 'SELECT') AS deferred,
        has_table_privilege(current_user, 'public._prisma_migrations', 'SELECT') AS migrations,
        (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass`;
      expect(rights).toEqual([{ ddl: false, deferred: false, migrations: false, bypass: false }]);
      await tx.systemConfig.update({ where: { id: 'default' }, data: { isPaused: true } });
    });
    const tables = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`
      SELECT relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace
      WHERE nspname='public' AND relkind='r'`;
    expect(tables).toHaveLength(25);
    expect(tables.every((table) => table.relrowsecurity)).toBe(true);
  });
});
