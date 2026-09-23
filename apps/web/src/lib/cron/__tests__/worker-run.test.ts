import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: { workerRun: { create: mocks.create, update: mocks.update } },
}));
import { recordWorkerRun, redactError, triggerFromRequest } from '../worker-run';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ id: 'run-1' });
  mocks.update.mockResolvedValue({});
});

describe('recordWorkerRun', () => {
  it('records a running row, then the outcome and summary', async () => {
    const outcome = await recordWorkerRun(
      'settle-sweep',
      'qstash:weatherb-arc-settle-sweep',
      async (runId) => {
        expect(runId).toBe('run-1');
        return { status: 'succeeded', summary: { settled: 1 } };
      },
    );
    expect(outcome).toEqual({ status: 'succeeded', summary: { settled: 1 } });
    expect(mocks.create).toHaveBeenCalledWith({
      data: { kind: 'settle-sweep', trigger: 'qstash:weatherb-arc-settle-sweep' },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'succeeded', summary: { settled: 1 }, error: null }),
    });
  });
  it('marks thrown errors failed with a redacted message and rethrows', async () => {
    vi.stubEnv('CRON_SECRET', 'topsecret');
    await expect(
      recordWorkerRun('settle-market', 'manual', async () => {
        throw new Error('failed with topsecret apikey=abc123 inside');
      }),
    ).rejects.toThrow();
    const error = mocks.update.mock.calls[0]![0].data.error as string;
    expect(error).not.toContain('topsecret');
    expect(error).not.toContain('abc123');
    expect(mocks.update.mock.calls[0]![0].data.status).toBe('failed');
    vi.unstubAllEnvs();
  });
  it('still returns the outcome when the run log itself is unavailable', async () => {
    mocks.create.mockRejectedValue(new Error('db down'));
    const outcome = await recordWorkerRun('settle-sweep', 'manual', async () => ({
      status: 'skipped',
      summary: {},
    }));
    expect(outcome.status).toBe('skipped');
  });
});

describe('triggerFromRequest', () => {
  it('names QStash schedules, QStash messages, and manual calls', () => {
    const h = (headers: Record<string, string>) => new Request('http://x', { headers });
    expect(triggerFromRequest(h({ 'upstash-schedule-id': 'weatherb-arc-settle-sweep' }))).toBe(
      'qstash:weatherb-arc-settle-sweep',
    );
    expect(triggerFromRequest(h({ 'upstash-message-id': 'msg_1' }))).toBe('qstash-message');
    expect(triggerFromRequest(h({}))).toBe('manual');
  });
});

it('redacts a serialized transaction and credential URL from a viem-style error', () => {
  const serialized = `0x${'a'.repeat(400)}`;
  const safe = redactError(new Error(`RPC failed: ${serialized} at https://rpc.test/private?apiKey=sensitive`));
  expect(safe).not.toContain(serialized);
  expect(safe).not.toContain('sensitive');
  expect(safe).toContain('[signed transaction redacted]');
});
