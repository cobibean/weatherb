import { NextRequest } from 'next/server';
import { POST } from '@/app/api/markets/[marketId]/settle/route';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { CITIES } from '@weatherb/shared/constants';
import { readDatabaseReadiness } from '@/lib/database-readiness';
import { GET } from '@/app/api/health/route';
import { automationReadinessResponse } from '@/lib/cron/readiness';

const mocks = vi.hoisted(() => ({ config: vi.fn(), cities: vi.fn(), count: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: {
    systemConfig: { findUnique: mocks.config },
    city: { findMany: mocks.cities },
    market: { count: mocks.count },
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockResolvedValue({ isPaused: true, settlerPaused: true });
  mocks.cities.mockResolvedValue(CITIES);
  mocks.count.mockResolvedValue(0);
});
afterEach(() => vi.unstubAllEnvs());

describe('Live database readiness', () => {
  it('blocks the individual settlement endpoint while paused or offline', async () => {
    vi.stubEnv('CRON_SECRET', 'local-readiness-fixture');
    const request = () =>
      new NextRequest('http://localhost/api/markets/7/settle', {
        method: 'POST',
        headers: { Authorization: 'Bearer local-readiness-fixture' },
      });
    const context = { params: Promise.resolve({ marketId: '7' }) };
    expect(await (await POST(request(), context)).json()).toMatchObject({
      skipped: true,
      reason: 'settler is paused',
    });
    mocks.config.mockRejectedValue(new Error('offline'));
    expect((await POST(request(), context)).status).toBe(503);
  });

  it('returns ready for a seeded empty database and reports pauses separately', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      scope: 'database',
      status: 'ready',
      scheduler: 'paused',
      settler: 'paused',
    });
  });
  it('reports missing configuration without attempting a database connection', async () => {
    vi.stubEnv('DATABASE_URL', '');
    expect(await readDatabaseReadiness()).toMatchObject({ status: 'not_configured' });
    expect(mocks.config).not.toHaveBeenCalled();
  });
  it.each(['config', 'cities'])('rejects an incomplete %s seed', async (missing) => {
    if (missing === 'config') mocks.config.mockResolvedValue(null);
    else mocks.cities.mockResolvedValue([CITIES[0]]);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: 'not_seeded' });
  });
  it('returns 503 without leaking connection errors', async () => {
    mocks.count.mockRejectedValue(new Error('private credentials'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private credentials');
  });
  it.each(['scheduler', 'settler'] as const)(
    'skips the paused %s; an unavailable DB is a failure',
    async (kind) => {
      expect(await (await automationReadinessResponse(kind))?.json()).toMatchObject({
        skipped: true,
      });
      mocks.config.mockResolvedValue({ isPaused: false, settlerPaused: false });
      expect(await automationReadinessResponse(kind)).toBeNull();
      mocks.config.mockRejectedValue(new Error('offline'));
      expect((await automationReadinessResponse(kind))?.status).toBe(503);
    },
  );
});
