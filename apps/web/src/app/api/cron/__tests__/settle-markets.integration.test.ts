import { mocks, chain, rows, setupLifecycle, market } from '@/test/lifecycle-mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../settle-markets/route';
import { POST } from '@/app/api/markets/[marketId]/settle/route';
const request = (): Request => new Request('http://localhost/api/cron/settle-markets');
const single = (id = '0') =>
  POST(new NextRequest(`http://localhost/api/markets/${id}/settle`), {
    params: Promise.resolve({ marketId: id }),
  });
beforeEach(() => {
  setupLifecycle();
  chain.push(market());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('Settlement and reconciliation routes', () => {
  it('rejects unauthorized requests', async () => {
    mocks.auth.mockReturnValue(false);
    expect((await GET(request())).status).toBe(401);
    expect((await single()).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('skips paused settlement before chain reads', async () => {
    mocks.config.mockResolvedValue({ settlerPaused: true });
    expect(await (await GET(request())).json()).toMatchObject({ skipped: true });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('fails closed on database outage', async () => {
    mocks.config.mockRejectedValue(new Error('offline'));
    expect((await GET(request())).status).toBe(503);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('requires configuration', async () => {
    vi.stubEnv('RPC_URL', '');
    expect((await GET(request())).status).toBe(500);
    expect((await single()).status).toBe(500);
  });
  it('rejects legacy contracts without touching the chain', async () => {
    mocks.read.mockResolvedValueOnce('2.0.0');
    expect((await GET(request())).status).toBe(503);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each(['periodic', 'single'])(
    'settles and persists valid observations via %s route',
    async (route) => {
      expect((await (route === 'single' ? single() : GET(request()))).status).toBe(200);
      expect(mocks.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'resolveMarket',
          args: [0n, 850n, BigInt(Date.now() / 1000)],
        }),
      );
      expect(rows.get(0)).toMatchObject({
        status: 'RESOLVED',
        actualTemp: 850,
        outcome: 'YES',
        isSettled: true,
      });
      expect(mocks.receipt).toHaveBeenCalledWith({ hash: '0xreceipt' });
    },
  );
  it('persists NoWinners correctly for one-sided losing pools', async () => {
    chain[0]!.yesPool = 0n;
    await single();
    expect(rows.get(0)).toMatchObject({ status: 'NO_WINNERS', isSettled: true });
  });
  it.each([2, 3, 4] as const)(
    'reconciles terminal status %i without another transaction',
    async (status) => {
      chain[0]!.status = status;
      expect((await single()).status).toBe(200);
      expect(rows.get(0)?.isSettled).toBe(true);
      expect((await GET(request())).status).toBe(200);
      expect(mocks.write).not.toHaveBeenCalled();
    },
  );
  it('waits for the target and reports early single invocations as retryable', async () => {
    chain[0]!.resolveTime = BigInt(Date.now() / 1000 + 1);
    expect(await (await GET(request())).json()).toMatchObject({ pending: 1, settled: 0 });
    expect((await single()).status).toBe(409);
    expect(mocks.reading).not.toHaveBeenCalled();
  });
  it.each(['periodic', 'single'])(
    'cancels overdue markets via %s without fetching current weather',
    async (route) => {
      chain[0]!.resolveTime = BigInt(Date.now() / 1000 - 601);
      expect((await (route === 'single' ? single() : GET(request()))).status).toBe(200);
      expect(mocks.simulate).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'cancelMarketBySettler', args: [0n] }),
      );
      expect(mocks.reading).not.toHaveBeenCalled();
      expect(rows.get(0)).toMatchObject({ status: 'CANCELLED', actualTemp: null, outcome: null });
    },
  );
  it.each(['early', 'late', 'future', 'invalid'])('rejects a %s observation', async (kind) => {
    const target = Number(chain[0]!.resolveTime);
    const observedTimestamp =
      kind === 'early'
        ? target - 1
        : kind === 'late'
          ? target + 601
          : kind === 'future'
            ? Date.now() / 1000 + 1
            : NaN;
    mocks.reading.mockResolvedValue({ tempF_tenths: 850, observedTimestamp, source: 'fixture' });
    expect((await single()).status).toBe(503);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('retries weather failures within the window and cancels at expiry', async () => {
    mocks.reading.mockRejectedValue(new Error('provider down'));
    expect((await single()).status).toBe(503);
    expect((await single()).status).toBe(503);
    expect(mocks.write).not.toHaveBeenCalled();
    vi.setSystemTime(new Date((Number(chain[0]!.resolveTime) + 601) * 1000));
    expect((await single()).status).toBe(200);
    expect(chain[0]!.status).toBe(3);
  });
  it('continues other markets but returns 503 for any failed settlement', async () => {
    chain.push(market());
    mocks.reading.mockRejectedValueOnce(new Error('provider down'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ success: false, failed: 1, settled: 1 });
  });
  it('surfaces post-transaction database failure and repairs it on retry', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('database disconnected'));
    expect((await single()).status).toBe(503);
    expect(chain[0]!.status).toBe(2);
    expect((await single()).status).toBe(200);
    expect(rows.get(0)?.isSettled).toBe(true);
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it('periodic reconciliation recovers a missed terminal write', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('database disconnected'));
    await single();
    expect((await GET(request())).status).toBe(200);
    expect(rows.get(0)?.isSettled).toBe(true);
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it('does not persist a reverted transaction as success', async () => {
    mocks.receipt.mockResolvedValueOnce({ status: 'reverted' });
    expect((await single()).status).toBe(503);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('recovers after a receipt timeout without a second transaction', async () => {
    mocks.receipt.mockRejectedValueOnce(new Error('timeout'));
    expect((await single()).status).toBe(503);
    expect((await single()).status).toBe(200);
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid IDs before chain access', async () => {
    expect((await single('-1')).status).toBe(400);
    expect((await single('1.5')).status).toBe(400);
    expect((await single('9007199254740993')).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
