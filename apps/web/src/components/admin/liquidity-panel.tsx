'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { arcTransactionUrl } from '@weatherb/shared/constants';

type Config = {
  version: number; seedAmountUsdc: string; maxActiveMarkets: number; seedingEnabled: boolean;
  claimsEnabled: boolean; walletAddress: string | null; chainId: number; firstEligibleMarketId: number | null;
  activationBlockNumber: string | null; activatedAt: string | null; canEdit: boolean; workerReady: boolean;
};
type Incident = { id: string; code: string; severity: string; message: string; contractMarketId: number | null;
  transactionHash: string | null; firstSeenAt: string | null; lastSeenAt: string; occurrenceCount: number };
type Position = { id: string; marketId: number; seedStatus: string; claimStatus: string; waitReason: string | null;
  slotHeld: boolean; targetPerSideWei: string | null; confirmedYesWei: string; confirmedNoWei: string;
  claimedAmountWei: string; gasSpentWei: string; netWei: string | null; lastErrorCode: string | null;
  lastTransactionHash: string | null; lastTransactionStatus: string | null; lastTransactionNonce: number | null;
  lastTransactionOperation: string | null };
type Status = { config: Config; balance: { amountUsdc: string; observedAt: string | null; blockNumber: string | null } | null;
  worker: { ready: boolean; stale: boolean; currentFailure: string | null; lastReconciledAt: string | null };
  slots: { held: number; maximum: number }; totals: { principalWei: string; recoveredWei: string; claimableWei: string | null; gasWei: string };
  incidents: Incident[]; positions: Position[]; nextPositionCursor: string | null;
  activity: { id: string; code: string; message: string; createdAt: string }[]; nextCursor: string | null };

function usdc(wei: string): string {
  const negative = wei.startsWith('-');
  const digits = negative ? wei.slice(1) : wei;
  const padded = digits.padStart(19, '0');
  const fraction = padded.slice(-18).replace(/0+$/, '').padEnd(2, '0');
  return `${negative ? '-' : ''}${padded.slice(0, -18)}.${fraction}`;
}
const when = (date: string | null): string => date ? new Date(date).toLocaleString() : 'unavailable';

export function LiquidityPanel(): React.ReactElement {
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState<{ amount: string; seed: boolean; claims: boolean;
    version: number; originalAmount: string; originalSeed: boolean; originalClaims: boolean } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [olderPositions, setOlderPositions] = useState<Position[]>([]);
  const [positionCursor, setPositionCursor] = useState<string | null | undefined>(undefined);
  const [olderActivity, setOlderActivity] = useState<Status['activity']>([]);
  const [activityCursor, setActivityCursor] = useState<string | null | undefined>(undefined);
  const refresh = useCallback(async (replaceDraft = false): Promise<void> => {
    try {
      const response = await fetch('/admin/api/liquidity/status', { cache: 'no-store' });
      if (!response.ok) throw new Error('Status unavailable');
      const next = await response.json() as Status;
      setStatus(next);
      setPositionCursor((current) => current === undefined ? next.nextPositionCursor : current);
      setActivityCursor((current) => current === undefined ? next.nextCursor : current);
      setDraft((current) => current && !replaceDraft ? current : {
        amount: next.config.seedAmountUsdc, seed: next.config.seedingEnabled, claims: next.config.claimsEnabled,
        version: next.config.version, originalAmount: next.config.seedAmountUsdc,
        originalSeed: next.config.seedingEnabled, originalClaims: next.config.claimsEnabled,
      });
      setLoadError(false);
    } catch { setLoadError(true); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => { void refresh(); }, 0);
    const timer = setInterval(() => { void refresh(); }, 30_000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [refresh]);
  const save = async (): Promise<void> => {
    if (!status || !draft || saving) return;
    setSaving(true); setSaveMessage(null); setConflict(false);
    try {
      const patch: { expectedVersion: number; seedAmountUsdc?: string; seedingEnabled?: boolean; claimsEnabled?: boolean } = {
        expectedVersion: draft.version,
      };
      if (draft.amount !== draft.originalAmount) patch.seedAmountUsdc = draft.amount;
      if (draft.seed !== draft.originalSeed) patch.seedingEnabled = draft.seed;
      if (draft.claims !== draft.originalClaims) patch.claimsEnabled = draft.claims;
      if (Object.keys(patch).length === 1) { setSaveMessage('No settings changes to save.'); return; }
      const response = await fetch('/admin/api/liquidity/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch) });
      const body = await response.json() as Config & { error?: string };
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        throw new Error(body.error ?? 'Save failed');
      }
      setSaveMessage('Settings saved. The worker will use them on its next tick.');
      await refresh(true);
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Save failed'); }
    finally { setSaving(false); }
  };
  const loadOlderPositions = async (): Promise<void> => {
    if (!positionCursor) return;
    try {
      const response = await fetch(`/admin/api/liquidity/status?positionCursor=${encodeURIComponent(positionCursor)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Older positions unavailable');
      const page = await response.json() as Status;
      setOlderPositions((current) => {
        const known = new Set([...current, ...(status?.positions ?? [])].map((position) => position.id));
        return [...current, ...page.positions.filter((position) => !known.has(position.id))];
      });
      setPositionCursor(page.nextPositionCursor);
    } catch { setSaveMessage('Older positions are temporarily unavailable.'); }
  };
  const loadOlderActivity = async (): Promise<void> => {
    if (!activityCursor) return;
    try {
      const response = await fetch(`/admin/api/liquidity/status?cursor=${encodeURIComponent(activityCursor)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Older activity unavailable');
      const page = await response.json() as Status;
      setOlderActivity((current) => {
        const known = new Set([...current, ...(status?.activity ?? [])].map((event) => event.id));
        return [...current, ...page.activity.filter((event) => !known.has(event.id))];
      });
      setActivityCursor(page.nextCursor);
    } catch { setSaveMessage('Older activity is temporarily unavailable.'); }
  };
  const displayedPositions = status ? [...status.positions, ...olderPositions.filter((position) => !status.positions.some((latest) => latest.id === position.id))] : [];
  const displayedActivity = status ? [...status.activity, ...olderActivity.filter((event) => !status.activity.some((latest) => latest.id === event.id))] : [];
  return <section aria-label="Market liquidity" className="space-y-5">
    <div><h2 className="font-display text-2xl font-bold text-neutral-800">Market liquidity</h2>
      <p className="font-body text-sm text-neutral-500">Automatic equal YES and NO contributions on eligible new public markets.</p></div>
    {loadError && <div role="alert" className="p-4 rounded-2xl border border-error-soft bg-error-soft/10">Liquidity status is unavailable. Existing Operations data remains available.</div>}
    {status && draft && <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="p-5 rounded-2xl border border-neutral-200 bg-white space-y-2">
          <h3 className="font-display font-bold">Maker wallet · Arc Testnet</h3>
          <p className="font-mono text-xs break-all">{status.config.walletAddress ?? 'Awaiting worker setup'}</p>
          {status.config.walletAddress && <button type="button" className="underline text-sm" onClick={() => { void navigator.clipboard.writeText(status.config.walletAddress!); }}>Copy address</button>}
          <p className="font-display text-xl">{status.balance ? `${status.balance.amountUsdc} native USDC` : 'Balance unavailable'}</p>
          <p className="font-body text-xs text-neutral-500">Checked {when(status.balance?.observedAt ?? null)} · Chain {status.config.chainId}</p>
          <p className="font-body text-xs">Worker {status.worker.ready ? 'ready' : 'not ready'} · Last reconciliation {when(status.worker.lastReconciledAt)}</p>
          {status.worker.currentFailure && <p role="alert" className="font-body text-sm text-error">Worker error: {status.worker.currentFailure}</p>}
          <p className="font-body text-sm">Fund this address manually with native Arc Testnet USDC. The next worker tick rechecks the balance.</p>
        </div>
        <div className="p-5 rounded-2xl border border-neutral-200 bg-white space-y-3">
          <h3 className="font-display font-bold">Controls</h3>
          <label className="block font-body text-sm">Native USDC per side
            <input aria-label="Native USDC per side" className="block mt-1 w-full rounded-lg border border-neutral-300 p-2 font-mono" inputMode="decimal" value={draft.amount}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })} disabled={!status.config.canEdit || saving} /></label>
          <p className="font-body text-sm">{/^\d+(?:\.\d{1,18})?$/.test(draft.amount) ? `${usdc((BigInt(draft.amount.split('.')[0] || '0') * 10n ** 18n + BigInt((draft.amount.split('.')[1] ?? '').padEnd(18, '0'))) * 2n + '')} USDC per market` : 'Enter a valid amount'} · Maximum {status.config.maxActiveMarkets} active markets</p>
          <label className="flex gap-2 items-center font-body text-sm"><input type="checkbox" checked={draft.seed} onChange={(event) => setDraft({ ...draft, seed: event.target.checked })} disabled={!status.config.canEdit || saving} /> Seed new markets</label>
          <label className="flex gap-2 items-center font-body text-sm"><input type="checkbox" checked={draft.claims} onChange={(event) => setDraft({ ...draft, claims: event.target.checked })} disabled={!status.config.canEdit || saving} /> Claim payouts and refunds</label>
          <p className="font-body text-xs text-neutral-500">Pausing seeding does not withdraw stakes. Claims continue unless separately paused. Transactions already broadcast may still confirm.</p>
          <p className="font-body text-xs text-neutral-500">{status.config.firstEligibleMarketId === null ? 'First enable applies only to markets created after activation.' : `First eligible market #${status.config.firstEligibleMarketId} · activation block ${status.config.activationBlockNumber} · ${when(status.config.activatedAt)}`}</p>
          <button type="button" onClick={() => { void save(); }} disabled={!status.config.canEdit || saving} className="rounded-lg bg-sky-deep text-white px-4 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Save liquidity settings'}</button>
          {saveMessage && <p role="status" className="font-body text-sm">{saveMessage}</p>}
          {conflict && <button type="button" className="underline text-sm" onClick={() => { void refresh(true); setConflict(false); }}>Reload current settings</button>}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Slots', `${status.slots.held} / ${status.slots.maximum}`], ['Principal placed', `${usdc(status.totals.principalWei)} USDC`],
          ['Claimable', status.totals.claimableWei === null ? 'Unavailable' : `${usdc(status.totals.claimableWei)} USDC`],
          ['Payouts received', `${usdc(status.totals.recoveredWei)} USDC`], ['Gas paid', `${usdc(status.totals.gasWei)} USDC`]].map(([label, value]) =>
          <div key={label} className="p-4 rounded-2xl border border-neutral-200 bg-white"><p className="text-sm text-neutral-500">{label}</p><p className="font-display font-bold break-all">{value}</p></div>)}</div>
      <div className="space-y-2"><h3 className="font-display font-bold">Notices</h3>
        {status.incidents.length === 0 ? <p className="font-body text-sm text-neutral-500">No active liquidity notices.</p> : status.incidents.map((incident) =>
          <div key={incident.id} role="alert" className="p-4 rounded-2xl border border-sunset-orange/40 bg-sunset-orange/10 font-body text-sm">
            <strong>{incident.code}</strong>{incident.contractMarketId !== null ? ` · Market #${incident.contractMarketId}` : ''}<p>{incident.message}</p>
            <p className="text-xs text-neutral-500">Since {when(incident.firstSeenAt)} · last checked {when(incident.lastSeenAt)}</p>
            {incident.transactionHash && <a className="underline" target="_blank" rel="noreferrer" href={arcTransactionUrl(incident.transactionHash as `0x${string}`)}>View transaction</a>}
          </div>)}</div>
      <div className="p-5 rounded-2xl border border-neutral-200 bg-white overflow-x-auto"><h3 className="font-display font-bold mb-3">Positions</h3>
        {displayedPositions.length === 0 ? <p className="text-sm text-neutral-500">No eligible market positions yet.</p> : <table className="w-full text-sm text-left"><thead><tr><th className="pr-4">Market</th><th className="pr-4">Seed</th><th className="pr-4">Claim</th><th className="pr-4">YES / NO</th><th className="pr-4">Payout</th><th className="pr-4">Net when complete</th><th>Latest transaction</th></tr></thead>
          <tbody>{displayedPositions.map((position) => <tr key={position.id} className="border-t border-neutral-100 align-top"><td className="py-2 pr-4">#{position.marketId}</td><td className="py-2 pr-4">{position.seedStatus}{position.waitReason ? ` · ${position.waitReason}` : ''}</td><td className="py-2 pr-4">{position.claimStatus}</td><td className="py-2 pr-4 font-mono">{usdc(position.confirmedYesWei)} / {usdc(position.confirmedNoWei)}</td><td className="py-2 pr-4 font-mono">{usdc(position.claimedAmountWei)}</td><td className="py-2 pr-4 font-mono">{position.netWei === null ? 'Pending' : usdc(position.netWei)}</td><td>{position.lastTransactionHash ? <a className="underline font-mono" target="_blank" rel="noreferrer" href={arcTransactionUrl(position.lastTransactionHash as `0x${string}`)}>{position.lastTransactionOperation} {position.lastTransactionStatus}</a> : '—'}</td></tr>)}</tbody></table>}
        {positionCursor && <button type="button" className="underline text-sm mt-3" onClick={() => { void loadOlderPositions(); }}>Load older positions</button>}</div>
      <div className="p-5 rounded-2xl border border-neutral-200 bg-white"><h3 className="font-display font-bold mb-2">Recent liquidity activity</h3>
        {displayedActivity.length === 0 ? <p className="text-sm text-neutral-500">No activity yet.</p> : <ul className="space-y-1 text-sm">{displayedActivity.map((event) => <li key={event.id}>{when(event.createdAt)} · {event.message}</li>)}</ul>}
        {activityCursor && <button type="button" className="underline text-sm mt-3" onClick={() => { void loadOlderActivity(); }}>Load older activity</button>}</div>
    </>}
  </section>;
}

export function LiquidityAlertSummary(): React.ReactElement {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  useEffect(() => {
    const load = async (): Promise<void> => {
      try { const response = await fetch('/admin/api/liquidity/status', { cache: 'no-store' });
        if (response.ok) setIncidents(((await response.json()) as Status).incidents);
      } catch { /* Keep existing dashboard content usable. */ }
    };
    void load(); const timer = setInterval(() => { void load(); }, 30_000); return () => clearInterval(timer);
  }, []);
  if (!incidents?.length) return <></>;
  return <Link href="/admin/operations" className="block p-4 rounded-2xl border border-sunset-orange/40 bg-sunset-orange/10 font-body text-sm">
    {incidents.length} active liquidity notice{incidents.length === 1 ? '' : 's'} · {incidents[0]?.code}. Open Operations.
  </Link>;
}
