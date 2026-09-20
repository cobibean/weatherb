import { describe, expect, it } from 'vitest';
import { deriveOperationsAlerts, type OutstandingMarket } from '@/lib/admin-operations';

const now = new Date('2026-09-21T12:20:00Z');
const worker = {
  lastSweepAt: '2026-09-21T12:19:00.000Z',
  lastSuccessfulSweepAt: '2026-09-21T12:19:00.000Z',
  lastSweepStatus: 'succeeded',
  overdueMarkets: 0,
  dueMarkets: 0,
};
const market = (overrides: Partial<OutstandingMarket>): OutstandingMarket => ({
  contractMarketId: 2,
  cityName: 'Austin',
  thresholdTemp: 780,
  resolveTime: '2026-09-21T12:08:23.000Z',
  windowClosesAt: '2026-09-21T12:18:23.000Z',
  status: 'CLOSED',
  settlementAttempts: 0,
  lastSettlementAttemptAt: null,
  lastSettlementError: null,
  settlementTxHash: null,
  settlementSubmittedAt: null,
  isTest: false,
  ...overrides,
});
const codes = (alerts: { code: string }[]) => alerts.map((a) => a.code).sort();

describe('deriveOperationsAlerts', () => {
  it('is quiet when the worker is fresh and nothing is due', () => {
    expect(deriveOperationsAlerts({ now, settlerPaused: false, worker, outstanding: [], settlerBalanceWei: 10n ** 18n })).toEqual([]);
  });
  it('flags overdue markets as critical', () => {
    const alerts = deriveOperationsAlerts({ now, settlerPaused: false, worker, outstanding: [market({})], settlerBalanceWei: 10n ** 18n });
    expect(codes(alerts)).toEqual(['market-overdue']);
    expect(alerts[0]!.level).toBe('critical');
  });
  it('flags a stale worker when settlement is enabled and no sweep succeeded for 6 minutes', () => {
    const stale = { ...worker, lastSuccessfulSweepAt: '2026-09-21T12:13:00.000Z' };
    expect(codes(deriveOperationsAlerts({ now, settlerPaused: false, worker: stale, outstanding: [], settlerBalanceWei: null }))).toEqual(['worker-stale']);
  });
  it('does not call a paused worker stale, but warns when markets are due while paused', () => {
    const due = market({ resolveTime: '2026-09-21T12:15:00.000Z', windowClosesAt: '2026-09-21T12:25:00.000Z' });
    expect(codes(deriveOperationsAlerts({ now, settlerPaused: true, worker: { ...worker, lastSuccessfulSweepAt: null }, outstanding: [due], settlerBalanceWei: 10n ** 18n }))).toEqual(['settler-paused']);
  });
  it('warns on retrying settlements, failed runs, and low balance', () => {
    const retrying = market({ resolveTime: '2026-09-21T12:15:00.000Z', windowClosesAt: '2026-09-21T12:25:00.000Z', settlementAttempts: 2, lastSettlementError: 'weather unavailable' });
    const alerts = deriveOperationsAlerts({ now, settlerPaused: false, worker: { ...worker, lastSweepStatus: 'failed' }, outstanding: [retrying], settlerBalanceWei: 10n ** 16n });
    expect(codes(alerts)).toEqual(['settlement-retrying', 'settler-low-balance', 'worker-failed']);
  });
});
