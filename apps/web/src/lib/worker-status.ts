import { SETTLEMENT_WINDOW_SECONDS } from '@weatherb/shared/utils/weather-timing';
import prisma from '@/lib/prisma';

export type WorkerStatus = {
  lastSweepAt: string | null;
  lastSuccessfulSweepAt: string | null;
  lastSweepStatus: string | null;
  lastScheduleAt: string | null;
  lastSuccessfulScheduleAt: string | null;
  lastScheduleStatus: string | null;
  overdueMarkets: number;
  dueMarkets: number;
};

/** Overdue: window closed and still not terminal. Due: resolve time reached, still inside the window. */
export async function readWorkerStatus(now: Date = new Date()): Promise<WorkerStatus> {
  const windowClosed = new Date(now.getTime() - SETTLEMENT_WINDOW_SECONDS * 1000);
  const [last, lastSuccess, lastSchedule, lastScheduleSuccess, overdueMarkets, dueMarkets] = await Promise.all([
    prisma.workerRun.findFirst({
      where: { kind: 'settle-sweep' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, status: true },
    }),
    prisma.workerRun.findFirst({
      where: { kind: 'settle-sweep', status: 'succeeded' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
    prisma.workerRun.findFirst({
      where: { kind: 'schedule-daily' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, status: true },
    }),
    prisma.workerRun.findFirst({
      where: { kind: 'schedule-daily', status: 'succeeded' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
    prisma.market.count({ where: { isSettled: false, resolveTime: { lt: windowClosed } } }),
    prisma.market.count({
      where: { isSettled: false, resolveTime: { lte: now, gte: windowClosed } },
    }),
  ]);
  return {
    lastSweepAt: last?.startedAt.toISOString() ?? null,
    lastSuccessfulSweepAt: lastSuccess?.startedAt.toISOString() ?? null,
    lastSweepStatus: last?.status ?? null,
    lastScheduleAt: lastSchedule?.startedAt.toISOString() ?? null,
    lastSuccessfulScheduleAt: lastScheduleSuccess?.startedAt.toISOString() ?? null,
    lastScheduleStatus: lastSchedule?.status ?? null,
    overdueMarkets,
    dueMarkets,
  };
}
