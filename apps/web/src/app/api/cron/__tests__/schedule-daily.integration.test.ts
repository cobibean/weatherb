import { mocks, chain, slots, rows, setupLifecycle, market } from '@/test/lifecycle-mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keccak256, toBytes, toEventSelector } from 'viem';
import { CITIES } from '@weatherb/shared/constants';
import * as readiness from '@/lib/cron/readiness';
import { GET } from '../schedule-daily/route';
const request = (query = ''): Request => new Request(`http://localhost/api/cron/schedule-daily${query}`);
beforeEach(setupLifecycle);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Scheduled market creation and recovery', () => {
  it('checks authorization before accessing services', async () => {
    mocks.auth.mockReturnValue(false);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.cities).not.toHaveBeenCalled();
  });
  it('does no chain work while paused', async () => {
    mocks.config.mockResolvedValue({ isPaused: true });
    expect(await (await GET(request())).json()).toMatchObject({ skipped: true });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(['offline', 'unseeded'])('fails closed with %s database', async (failure) => {
    if (failure === 'offline') mocks.config.mockRejectedValue(new Error('offline'));
    else mocks.cities.mockResolvedValue([]);
    expect((await GET(request())).status).toBe(503);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('requires configuration', async () => {
    vi.stubEnv('RPC_URL', '');
    expect((await GET(request())).status).toBe(500);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('rejects legacy contracts', async () => {
    mocks.read.mockResolvedValueOnce('2.0.0');
    expect((await GET(request())).status).toBe(503);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('does not create outside the five UTC hours', async () => {
    vi.setSystemTime(new Date('2026-09-19T17:00:00Z'));
    expect(await (await GET(request())).json()).toMatchObject({ created: 0, skipped: true });
    expect(mocks.forecast).not.toHaveBeenCalled();
  });
  it('rejects zero active cities without fallback', async () => {
    mocks.cities.mockResolvedValueOnce(CITIES).mockResolvedValue([]);
    expect((await GET(request())).status).toBe(503);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each([
    [753, 750],
    [755, 760],
    [749, 750],
  ])('rounds %i to %i and persists the actual chain ID', async (forecast, threshold) => {
    mocks.forecast.mockResolvedValue(forecast);
    expect(await (await GET(request())).json()).toMatchObject({
      success: true,
      market: { marketId: '0', thresholdTenths: threshold },
    });
    expect(mocks.simulate).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'createScheduledMarket',
        args: [keccak256(toBytes('nyc')), BigInt(threshold), BigInt(Date.now() / 1000), 86400n],
      }),
    );
    expect(rows.get(0)).toMatchObject({
      thresholdTemp: threshold,
      resolveTime: new Date(Date.now() + 86400000),
    });
    expect(rows.has(9999)).toBe(false);
    expect(mocks.receipt.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.upsert.mock.invocationCallOrder[0]!,
    );
  });
  it('reuses the slot on repeat requests without fetching weather or writing again', async () => {
    await GET(request());
    expect(await (await GET(request())).json()).toMatchObject({
      created: 0,
      market: { marketId: '0' },
    });
    expect(mocks.write).toHaveBeenCalledTimes(1);
    expect(chain).toHaveLength(1);
  });
  it('rotates using durable chain count, not a pre-transaction Redis increment', async () => {
    chain.push(market({ status: 3 }));
    await GET(request());
    expect(mocks.forecast).toHaveBeenCalledWith(
      CITIES[1]!.latitude,
      CITIES[1]!.longitude,
      Date.now() / 1000 + 86400,
    );
  });
  it('reports DB failure after successful creation, then recovers without another creation', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('database disconnected'));
    expect((await GET(request())).status).toBe(503);
    expect(chain).toHaveLength(1);
    expect((await GET(request())).status).toBe(200);
    expect(rows.has(0)).toBe(true);
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it('recovers an earlier slot even outside creation hours', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('offline'));
    await GET(request());
    vi.setSystemTime(new Date('2026-09-19T18:00:00Z'));
    expect((await GET(request())).status).toBe(200);
    expect(rows.has(0)).toBe(true);
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it('recovers an ambiguous receipt without resubmitting', async () => {
    mocks.receipt.mockRejectedValueOnce(new Error('RPC timeout'));
    expect((await GET(request())).status).toBe(503);
    expect((await GET(request())).status).toBe(200);
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it('rejects a reverted receipt and does not publish settlement', async () => {
    mocks.receipt.mockResolvedValueOnce({ status: 'reverted' });
    expect((await GET(request())).status).toBe(503);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it('does not write after weather failure', async () => {
    mocks.forecast.mockRejectedValue(new Error('unavailable'));
    expect((await GET(request())).status).toBe(503);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('does not write unsupported negative thresholds', async () => {
    mocks.forecast.mockResolvedValue(-50);
    expect((await GET(request())).status).toBe(503);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('schedules confirmed resolve time and tolerates queue failure visibly', async () => {
    vi.stubEnv('QSTASH_TOKEN', 'fixture');
    vi.stubEnv('APP_URL', 'http://localhost');
    mocks.publish.mockRejectedValueOnce(new Error('queue unavailable'));
    expect(await (await GET(request())).json()).toMatchObject({
      success: true,
      settlementSchedule: {
        scheduled: false,
        message: 'Queue unavailable; periodic settlement remains required',
      },
    });
    expect(mocks.publish).toHaveBeenCalledWith(
      expect.objectContaining({ notBefore: Date.now() / 1000 + 86400 }),
    );
  });
  it('handles concurrent requests with the same contract slot', async () => {
    // Concurrent dynamic import mocking is not reliable in Vitest; preflight is tested separately above.
    vi.spyOn(readiness, 'automationReadinessResponse').mockResolvedValue(null);
    const responses = await Promise.all([GET(request()), GET(request())]);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(slots.size).toBe(1);
    expect(chain).toHaveLength(1);
  });
  it('records a skipped run while paused and no run on outage', async () => {
    mocks.config.mockResolvedValue({ isPaused: true });
    expect(await (await GET(request())).json()).toMatchObject({ skipped: true });
    expect(mocks.runCreate).toHaveBeenCalledWith({ data: { kind: 'schedule-daily', trigger: 'manual' } });
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }));
    mocks.runCreate.mockClear();
    mocks.config.mockRejectedValue(new Error('offline'));
    expect((await GET(request())).status).toBe(503);
    expect(mocks.runCreate).not.toHaveBeenCalled();
  });
  it('returns 409 and logs busy when the scheduler lease is held', async () => {
    mocks.queryRaw.mockResolvedValueOnce([]);
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ busy: true });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'busy' }) }));
  });
  it('logs a succeeded run with the created market and releases the lease', async () => {
    mocks.receipt.mockResolvedValue({ status: 'success', logs: [
      { address: '0x0000000000000000000000000000000000000001', topics: [toEventSelector('MarketCreated(uint256,bytes32,uint64,uint256,address)')] },
    ] });
    expect((await GET(request())).status).toBe(200);
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'succeeded', summary: expect.objectContaining({ created: 1, marketId: '0' }) }),
    }));
    expect(mocks.executeRaw).toHaveBeenCalled(); // release
  });
  it('schedules settlement once through the shared helper', async () => {
    vi.stubEnv('QSTASH_TOKEN', 'qs'); vi.stubEnv('APP_URL', 'https://worker.example');
    mocks.publish.mockResolvedValue({ messageId: 'msg-1' });
    await GET(request());
    await GET(request()); // same slot → reuse, no second publish
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { settlementMessageId: expect.any(String) } }));
  });
  it('creates a short hidden test market at any hour when test=1', async () => {
    vi.setSystemTime(new Date('2026-09-20T20:07:00Z'));
    const response = await GET(request('?duration=1800&test=1'));
    expect(response.status).toBe(200);
    expect(mocks.simulate).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'createScheduledMarket', args: [expect.any(String), expect.any(BigInt), BigInt(Date.UTC(2026, 8, 20, 20) / 1000), 1800n] }));
    expect(rows.get(0)).toMatchObject({ isTest: true });
    expect(Number(chain[0]!.resolveTime) - Math.floor(Date.now() / 1000)).toBe(1800);
  });
  it('declares 86400 for daily markets and refuses other durations without test=1', async () => {
    expect((await GET(request('?duration=1800'))).status).toBe(400);
    await GET(request());
    expect(mocks.simulate).toHaveBeenCalledWith(expect.objectContaining({ args: expect.arrayContaining([86400n]) }));
    expect(rows.get(0)).toMatchObject({ isTest: false });
  });
  it('rejects out-of-range or malformed durations', async () => {
    for (const q of ['?duration=899&test=1', '?duration=604801&test=1', '?duration=abc&test=1'])
      expect((await GET(request(q))).status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
