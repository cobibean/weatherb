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
    // Task 5 added an early tracking persist; the transient failure must hit the post-transaction write.
    let rejected = false;
    const upsert = mocks.upsert.getMockImplementation()!;
    mocks.upsert.mockImplementation(
      async (args: {
        where: { contractMarketId: number };
        create: { isSettled?: boolean };
        update: { isSettled?: boolean };
      }) => {
        if (!rejected && (args.update?.isSettled ?? args.create?.isSettled) === true) {
          rejected = true;
          throw new Error('database disconnected');
        }
        return upsert(args);
      },
    );
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
    // Task 5's early tracking persist upserts the OPEN row, so assert on row state instead of call counts.
    expect(rows.get(0)?.isSettled).toBe(false);
    expect(rows.get(0)?.status).not.toBe('RESOLVED');
    expect(rows.get(0)?.status).not.toBe('CANCELLED');
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
  it('records the submitted hash before waiting for the receipt', async () => {
    mocks.receipt.mockRejectedValueOnce(new Error('timeout'));
    expect((await single()).status).toBe(503);
    expect(rows.get(0)).toMatchObject({
      settlementTxHash: '0xreceipt',
      settlementAttempts: 1,
      isSettled: false,
    });
  });
  it('does not resubmit while a recent submission is still unmined', async () => {
    mocks.receipt.mockRejectedValueOnce(new Error('timeout'));
    await single();
    chain[0]!.status = 0; // Simulate the mock write not having landed yet.
    mocks.txReceipt.mockResolvedValueOnce(null);
    const response = await single();
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ result: { action: 'in_flight' } });
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it('resubmits when the earlier submission is older than the grace period and unmined', async () => {
    mocks.receipt.mockRejectedValueOnce(new Error('timeout'));
    await single();
    chain[0]!.status = 0;
    mocks.txReceipt.mockResolvedValue(null);
    vi.setSystemTime(new Date(Date.now() + 181_000));
    chain[0]!.resolveTime = BigInt(Math.floor(Date.now() / 1000) - 100);
    expect((await single()).status).toBe(200);
    expect(mocks.write).toHaveBeenCalledTimes(2);
  });
  it('records a redacted weather error and increments attempts on provider failure', async () => {
    mocks.reading.mockRejectedValueOnce(new Error('provider down apikey=zzz'));
    await single();
    expect(rows.get(0)).toMatchObject({ settlementAttempts: 1 });
    expect(String(rows.get(0)?.lastSettlementError)).not.toContain('zzz');
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('sweep reconciles only outstanding and newly created markets', async () => {
    chain[0]!.status = 2;
    await single(); // Binds the deployment and persists market 0 as settled.
    mocks.read.mockClear();
    rows.set(0, { isSettled: true, status: 'RESOLVED' });
    chain.push(market()); // id 1: known? no — above max known id (0), must be read
    expect((await GET(request())).status).toBe(200);
    const readIds = mocks.read.mock.calls
      .filter(([{ functionName }]) => functionName === 'getMarket')
      .map(([{ args }]) => Number(args[0]));
    expect(readIds).not.toContain(0);
    expect(readIds).toContain(1);
  });
  it('returns 409 busy and does not touch the chain when another worker holds the lease', async () => {
    mocks.queryRaw.mockResolvedValueOnce([]);
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ busy: true });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'busy' }) }),
    );
  });
  it('records a succeeded sweep run with a summary and releases the lease', async () => {
    expect((await GET(request())).status).toBe(200);
    expect(mocks.runCreate).toHaveBeenCalledWith({
      data: { kind: 'settle-sweep', trigger: 'manual' },
    });
    expect(mocks.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'succeeded', summary: expect.objectContaining({ settled: 1 }) }),
      }),
    );
    expect(mocks.executeRaw).toHaveBeenCalled();
  });
  it('schedules one QStash delivery for a pending market and never a second', async () => {
    vi.stubEnv('QSTASH_TOKEN', 'qs');
    vi.stubEnv('APP_URL', 'https://worker.example');
    chain[0]!.resolveTime = BigInt(Math.floor(Date.now() / 1000) + 600);
    mocks.publish.mockResolvedValue({ messageId: 'msg_1' });
    await GET(request());
    await GET(request());
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://worker.example/api/markets/0/settle',
        notBefore: Number(chain[0]!.resolveTime),
      }),
    );
    expect(rows.get(0)).toMatchObject({ settlementMessageId: 'msg_1' });
  });
  it('a failed sweep run is recorded as failed', async () => {
    mocks.read.mockResolvedValueOnce('2.0.0');
    expect((await GET(request())).status).toBe(503);
    expect(mocks.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });
});
