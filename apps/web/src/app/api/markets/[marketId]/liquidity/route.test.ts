import { beforeEach, describe, expect, it, vi } from 'vitest';

const run = vi.hoisted(() => vi.fn());
vi.mock('@/lib/liquidity/service', () => ({ runLiquidityTick: run }));
import { POST } from './route';

const context = (marketId: string) => ({ params: Promise.resolve({ marketId }) });
const request = (secret?: string, body?: string) => new Request('https://weatherb.test/api/markets/7/liquidity', {
  method: 'POST', ...(secret ? { headers: { authorization: `Bearer ${secret}` } } : {}), ...(body !== undefined ? { body } : {}),
});

describe('immediate maker delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('WEATHERB_WORKER_ROLE', 'settler');
    vi.stubEnv('CRON_SECRET', 'a'.repeat(32));
    run.mockResolvedValue({ status: 'ready', reconciled: 0, seeded: 0, claimed: 0, blocked: 0, errors: 0 });
  });

  it('requires an explicit worker bearer in development and production', async () => {
    expect((await POST(request(), context('7'))).status).toBe(401);
    expect((await POST(request('wrong'), context('7'))).status).toBe(401);
    vi.stubEnv('CRON_SECRET', '');
    expect((await POST(request(''), context('7'))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects bad IDs and arbitrary request bodies', async () => {
    expect((await POST(request('a'.repeat(32)), context('07'))).status).toBe(400);
    expect((await POST(request('a'.repeat(32), '{"seed":true}'), context('7'))).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the shared lease-protected service for authenticated hints', async () => {
    expect((await POST(request('a'.repeat(32)), context('7'))).status).toBe(200);
    expect(run).toHaveBeenCalledWith('market:7');
  });

  it('returns a retryable failure for a real service error result', async () => {
    run.mockResolvedValue({ status: 'failed', reconciled: 0, seeded: 0, claimed: 0, blocked: 0, errors: 1 });
    expect((await POST(request('a'.repeat(32)), context('7'))).status).toBe(503);
  });
});
