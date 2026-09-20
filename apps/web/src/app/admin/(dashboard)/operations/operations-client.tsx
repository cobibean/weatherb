'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { arcTransactionUrl } from '@weatherb/shared/constants';
import type { OperationsSnapshot } from '@/lib/admin-operations';

const REFRESH_MS = 30_000;
const fmt = (iso: string | null): string => (iso ? new Date(iso).toLocaleString() : '—');

export function OperationsClient({ snapshot }: { snapshot: OperationsSnapshot }): React.ReactElement {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="space-y-6">
      <section aria-label="Alerts" className="space-y-2">
        {snapshot.alerts.length === 0 ? (
          <div className="p-4 rounded-2xl border border-success-soft/40 bg-success-soft/20 font-body text-sm">
            No active alerts. Checked {fmt(snapshot.checkedAt)}.
          </div>
        ) : (
          snapshot.alerts.map((alert) => (
            <div
              key={alert.code}
              role="alert"
              className={`p-4 rounded-2xl border font-body text-sm ${
                alert.level === 'critical'
                  ? 'border-error-soft/50 bg-error-soft/20'
                  : 'border-sunset-orange/40 bg-sunset-orange/10'
              }`}
            >
              <span className="font-mono text-xs uppercase mr-2">{alert.level}</span>
              <span className="font-mono text-xs mr-2">{alert.code}</span>
              {alert.message}
            </div>
          ))
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          ['Settlement', snapshot.settlerPaused ? 'Paused' : 'Enabled'],
          ['Last successful sweep', fmt(snapshot.worker.lastSuccessfulSweepAt)],
          ['Due / overdue', `${snapshot.worker.dueMarkets} / ${snapshot.worker.overdueMarkets}`],
          ['Settler balance', snapshot.settlerBalance ? `${snapshot.settlerBalance} USDC` : '—'],
          ['Creation', snapshot.schedulerPaused ? 'Paused' : 'Enabled'],
          ['Last creation run', `${fmt(snapshot.worker.lastScheduleAt)} · ${snapshot.worker.lastScheduleStatus ?? '—'}`],
        ].map(([title, value]) => (
          <div key={title} className="p-5 rounded-2xl border border-neutral-200 bg-white">
            <p className="font-body text-sm text-neutral-500 mb-1">{title}</p>
            <p className="font-display text-xl font-bold text-neutral-800 break-all">{value}</p>
          </div>
        ))}
      </section>
      <p className="font-mono text-xs text-neutral-500 break-all">
        Settler: {snapshot.settlerAddress ?? 'unavailable'}
      </p>

      <section className="p-5 rounded-2xl border border-neutral-200 bg-white overflow-x-auto">
        <h2 className="font-display font-bold text-lg text-neutral-800 mb-4">Outstanding markets</h2>
        {snapshot.outstanding.length === 0 ? (
          <p className="font-body text-neutral-400">None</p>
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-4">ID</th><th className="py-2 pr-4">Market</th>
                <th className="py-2 pr-4">Resolves</th><th className="py-2 pr-4">Window closes</th>
                <th className="py-2 pr-4">Attempts</th><th className="py-2 pr-4">Last error</th>
                <th className="py-2 pr-4">Submission</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.outstanding.map((m) => (
                <tr key={m.contractMarketId} className="border-t border-neutral-100 align-top">
                  <td className="py-2 pr-4 font-mono">#{m.contractMarketId}{m.isTest ? ' (test)' : ''}</td>
                  <td className="py-2 pr-4">{m.cityName} ≥ {Math.round(m.thresholdTemp / 10)}°F</td>
                  <td className="py-2 pr-4">{fmt(m.resolveTime)}</td>
                  <td className="py-2 pr-4">{fmt(m.windowClosesAt)}</td>
                  <td className="py-2 pr-4">{m.settlementAttempts}</td>
                  <td className="py-2 pr-4 max-w-xs break-words text-neutral-600">{m.lastSettlementError ?? '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {m.settlementTxHash ? (
                      <a className="underline" href={arcTransactionUrl(m.settlementTxHash as `0x${string}`)} target="_blank" rel="noreferrer">
                        {m.settlementTxHash.slice(0, 12)}… ({fmt(m.settlementSubmittedAt)})
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="p-5 rounded-2xl border border-neutral-200 bg-white overflow-x-auto">
        <h2 className="font-display font-bold text-lg text-neutral-800 mb-4">Recent worker runs</h2>
        {snapshot.runs.length === 0 ? (
          <p className="font-body text-neutral-400">No runs recorded</p>
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-4">Started</th><th className="py-2 pr-4">Kind</th>
                <th className="py-2 pr-4">Trigger</th><th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Summary</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.runs.map((run) => (
                <tr key={run.id} className="border-t border-neutral-100 align-top">
                  <td className="py-2 pr-4">{fmt(run.startedAt)}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{run.kind}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{run.trigger}</td>
                  <td className="py-2 pr-4">{run.status}</td>
                  <td className="py-2 pr-4 font-mono text-xs max-w-md break-words">
                    {run.error ?? JSON.stringify(run.summary ?? {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
