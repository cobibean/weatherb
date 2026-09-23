import prisma from '@/lib/prisma';

export type WorkerRunKind = 'settle-sweep' | 'settle-market' | 'schedule-daily' | 'liquidity-tick';
export type WorkerRunStatus = 'succeeded' | 'failed' | 'skipped' | 'busy';
export type WorkerRunOutcome<T> = {
  status: WorkerRunStatus;
  summary: T;
  error?: string | undefined;
};

/** Strip anything that looks like a secret before persisting an error message. */
export function redactError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const [key, value] of Object.entries(process.env))
    if (value && value.length >= 8 && /KEY|SECRET|TOKEN|DATABASE|URL/.test(key))
      message = message.replaceAll(value, '[redacted]');
  // Viem errors may stringify the serialized, spend-authorizing envelope.
  return message
    .replace(/0x[0-9a-f]{128,}/gi, '[signed transaction redacted]')
    .replace(/(privatekey|authorization|bearer)\s*[:=]?\s*(?:bearer\s+)?[^\s,}]+/gi, '$1 [redacted]')
    .replace(/(https?:\/\/)[^\s]+/gi, '$1[redacted]')
    .replace(/(apikey|token|secret)=[^&\s]+/gi, '$1=[redacted]')
    .slice(0, 500);
}

export function triggerFromRequest(request: Request): string {
  const schedule = request.headers.get('upstash-schedule-id');
  if (schedule) return `qstash:${schedule}`;
  if (request.headers.get('upstash-message-id')) return 'qstash-message';
  return 'manual';
}

/** The run log must never change the outcome of the work; log failures are swallowed. */
export async function recordWorkerRun<T extends object>(
  kind: WorkerRunKind,
  trigger: string,
  fn: (runId: string) => Promise<WorkerRunOutcome<T>>,
): Promise<WorkerRunOutcome<T>> {
  let runId: string | null = null;
  try {
    runId = (await prisma.workerRun.create({ data: { kind, trigger } })).id;
  } catch (error) {
    console.error('[WorkerRun] Could not record run start:', redactError(error));
  }
  const finish = async (data: {
    status: WorkerRunStatus;
    summary?: object;
    error: string | null;
  }): Promise<void> => {
    if (!runId) return;
    try {
      await prisma.workerRun.update({
        where: { id: runId },
        data: { ...data, finishedAt: new Date() },
      });
    } catch (error) {
      console.error('[WorkerRun] Could not record run end:', redactError(error));
    }
  };
  try {
    const outcome = await fn(runId ?? 'unrecorded');
    await finish({ status: outcome.status, summary: outcome.summary, error: outcome.error ?? null });
    return outcome;
  } catch (error) {
    await finish({ status: 'failed', error: redactError(error) });
    throw error;
  }
}
