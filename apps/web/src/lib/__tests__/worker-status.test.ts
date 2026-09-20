import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), count: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: { workerRun: { findFirst: mocks.findFirst }, market: { count: mocks.count } },
}));
import { readWorkerStatus } from '@/lib/worker-status';

beforeEach(() => vi.resetAllMocks());

describe('readWorkerStatus', () => {
  it('reports last sweep, last success, and overdue/due counts', async () => {
    const now = new Date('2026-09-21T12:20:00Z');
    mocks.findFirst
      .mockResolvedValueOnce({ startedAt: new Date('2026-09-21T12:18:00Z'), status: 'failed' })
      .mockResolvedValueOnce({ startedAt: new Date('2026-09-21T12:16:00Z') });
    mocks.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await readWorkerStatus(now)).toEqual({
      lastSweepAt: '2026-09-21T12:18:00.000Z',
      lastSuccessfulSweepAt: '2026-09-21T12:16:00.000Z',
      lastSweepStatus: 'failed',
      overdueMarkets: 1,
      dueMarkets: 2,
    });
    expect(mocks.count).toHaveBeenNthCalledWith(1, {
      where: { isSettled: false, resolveTime: { lt: new Date('2026-09-21T12:10:00Z') } },
    });
  });
  it('returns nulls and zeros with no history', async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    expect(await readWorkerStatus()).toMatchObject({ lastSweepAt: null, overdueMarkets: 0 });
  });
});
