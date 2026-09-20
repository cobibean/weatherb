import { CITIES } from '@weatherb/shared/constants';

export interface DatabaseReadiness {
  status: 'ready' | 'not_configured' | 'unavailable' | 'not_seeded';
  scheduler: 'paused' | 'enabled' | 'unknown';
  settler: 'paused' | 'enabled' | 'unknown';
}

/** Live database/seed check only; this does not claim weather, RPC or hosted cron health. */
export async function readDatabaseReadiness(): Promise<DatabaseReadiness> {
  const unknown = { scheduler: 'unknown', settler: 'unknown' } as const;
  if (!process.env.DATABASE_URL) return { status: 'not_configured', ...unknown };
  try {
    const { default: prisma } = await import('./prisma');
    const [config, cities] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { id: 'default' } }),
      prisma.city.findMany({ select: { slug: true } }),
      prisma.market.count(),
    ]);
    if (!config || CITIES.some((city) => !cities.some(({ slug }) => slug === city.slug))) {
      return { status: 'not_seeded', ...unknown };
    }
    return {
      status: 'ready',
      scheduler: config.isPaused ? 'paused' : 'enabled',
      settler: config.settlerPaused ? 'paused' : 'enabled',
    };
  } catch {
    return { status: 'unavailable', ...unknown };
  }
}
