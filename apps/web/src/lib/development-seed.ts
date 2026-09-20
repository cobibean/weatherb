import type { PrismaClient } from '@prisma/client';
import { CITIES } from '@weatherb/shared/constants';

/** Add the baseline without resetting operator settings or creating market history. */
export async function seedDevelopmentDatabase(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const city of CITIES) {
      if (!city.timezone) throw new Error(`Missing timezone for ${city.slug}`);
      await tx.city.upsert({
        where: { slug: city.slug },
        create: {
          slug: city.slug,
          name: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          timezone: city.timezone,
          isActive: true,
        },
        update: {},
      });
    }
    await tx.systemConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        cadence: 5,
        dailyCount: 5,
        bettingBuffer: 600,
        testMode: true,
        isPaused: true,
        settlerPaused: true,
      },
      update: {},
    });
  });
}
