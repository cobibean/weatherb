import { beforeEach, describe, it, expect, vi } from 'vitest';
import { loadHomeMarkets } from '@/lib/home-markets';
const mocks = vi.hoisted(() => ({ readiness: vi.fn(), chain: vi.fn(), tests: vi.fn() }));
vi.mock('@/lib/database-readiness', () => ({ readDatabaseReadiness: mocks.readiness }));
vi.mock('@/lib/contract-data', () => ({ fetchMarketsFromContract: mocks.chain }));
vi.mock('@/lib/prisma', () => ({ prisma: { market: { findMany: mocks.tests } } }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.readiness.mockResolvedValue({ status: 'ready' });
  mocks.tests.mockResolvedValue([]);
});
describe('Homepage market availability', () => {
  it('distinguishes a healthy empty market list from a service failure', async () => {
    mocks.chain.mockResolvedValue({ markets: [] });
    expect(await loadHomeMarkets()).toEqual({ markets: [] });
    mocks.chain.mockResolvedValue({ markets: [], error: 'RPC failed' });
    expect(await loadHomeMarkets()).toHaveProperty('error');
  });
  it('fails closed before chain reads when database readiness fails', async () => {
    mocks.readiness.mockResolvedValue({ status: 'unavailable' });
    expect(await loadHomeMarkets()).toHaveProperty('error');
    expect(mocks.chain).not.toHaveBeenCalled();
  });
  it('does not expose test markets or partial results when the filter query fails', async () => {
    mocks.chain.mockResolvedValue({
      markets: [
        { id: '1', status: 'open' },
        { id: '2', status: 'open' },
      ],
    });
    mocks.tests.mockResolvedValue([{ contractMarketId: 1 }]);
    expect((await loadHomeMarkets()).markets).toEqual([{ id: '2', status: 'open' }]);
    mocks.tests.mockRejectedValue(new Error('private error'));
    expect(await loadHomeMarkets()).toMatchObject({ markets: [], error: expect.any(String) });
  });
});
