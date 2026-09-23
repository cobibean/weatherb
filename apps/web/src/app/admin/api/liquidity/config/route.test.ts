import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminAuth: mock.auth }));
vi.mock('@/lib/liquidity/admin-config', () => ({
  getLiquidityConfig: mock.get,
  saveLiquidityConfig: mock.save,
  LiquidityConfigError: class extends Error {
    constructor(readonly status: number, message: string) { super(message); }
  },
}));
import { GET, PATCH } from './route';

function request(body: unknown, origin = 'https://weatherb.test'): Request {
  return new Request('https://weatherb.test/admin/api/liquidity/config', {
    method: 'PATCH', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

describe('liquidity admin route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.auth.mockResolvedValue({ authenticated: true, wallet: '0xadmin' });
    mock.get.mockResolvedValue({ version: 1 });
    mock.save.mockResolvedValue({ version: 2 });
  });

  it('denies anonymous reads and mutations', async () => {
    mock.auth.mockResolvedValue({ authenticated: false, error: 'Not authenticated' });
    expect((await GET()).status).toBe(401);
    expect((await PATCH(request({ expectedVersion: 1, seedingEnabled: true }))).status).toBe(401);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('rejects cross-origin and unknown settings', async () => {
    expect((await PATCH(request({ expectedVersion: 1, seedingEnabled: true }, 'https://evil.test'))).status).toBe(403);
    expect((await PATCH(request({ expectedVersion: 1, seedingEnabled: true, lossBudget: '1' }))).status).toBe(400);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('passes verified edits and exposes a version conflict', async () => {
    expect((await PATCH(request({ expectedVersion: 1, seedAmountUsdc: '2.50' }))).status).toBe(200);
    expect(mock.save).toHaveBeenCalledWith('0xadmin', { expectedVersion: 1, seedAmountUsdc: '2.50' });
    mock.save.mockRejectedValue(new Error('conflict'));
    // Unexpected errors are not reflected back to clients.
    const failure = await PATCH(request({ expectedVersion: 1, claimsEnabled: false }));
    expect(failure.status).toBe(503);
    expect(await failure.json()).toEqual({ error: 'Liquidity configuration unavailable' });
  });
});
