import { mocks, chain, rows, setupLifecycle, market } from '@/test/lifecycle-mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../markets/cancel/route';
const admin = vi.hoisted(() => ({ session: vi.fn(), cancel: vi.fn() }));
vi.mock('@/lib/admin-session', () => ({ getAdminSession: admin.session, logAdminAction: vi.fn() }));
vi.mock('@/lib/admin-contract', () => ({
  getAdminContractClients: async () => ({
    publicClient: { readContract: mocks.read, getChainId: async () => 5042002 },
    contractAddress: '0x0000000000000000000000000000000000000001',
    abi: [],
  }),
  cancelMarketOnChain: admin.cancel,
}));
const request = () =>
  new NextRequest('http://localhost/admin/api/markets/cancel', {
    method: 'POST',
    body: JSON.stringify({ marketId: 0 }),
  });
beforeEach(() => {
  setupLifecycle();
  vi.stubEnv('ADMIN_WRITES_ENABLED', 'true');
  chain.push(market());
  admin.session.mockResolvedValue({ wallet: 'fixture' });
  admin.cancel.mockImplementation(async () => {
    chain[0]!.status = 3;
    return '0xreceipt';
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe('Admin cancellation persistence', () => {
  it('returns an error if the chain succeeded but storage failed, then reconciles on retry', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('offline'));
    expect((await POST(request())).status).toBe(500);
    expect(chain[0]!.status).toBe(3);
    expect((await POST(request())).status).toBe(200);
    expect(rows.get(0)?.isSettled).toBe(true);
    expect(admin.cancel).toHaveBeenCalledTimes(1);
  });
  it('requires an admin session before touching chain state', async () => {
    admin.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
