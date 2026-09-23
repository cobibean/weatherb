import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getOperationsSnapshot } from '@/lib/admin-operations';
import { OperationsClient } from './operations-client';
import { LiquidityPanel } from '@/components/admin/liquidity-panel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function OperationsContent(): Promise<React.ReactElement> {
  let snapshot: Awaited<ReturnType<typeof getOperationsSnapshot>> | null = null;
  try {
    snapshot = await getOperationsSnapshot();
  } catch (error) {
    console.error('Failed to load operations snapshot:', error);
  }
  if (snapshot === null) {
    return (
      <div role="alert" className="p-6 rounded-2xl border border-error-soft bg-error-soft/10">
        <AlertTriangle className="w-6 h-6 text-error-soft mb-2" />
        <h3 className="font-display font-bold text-lg">Failed to Load Operations</h3>
        <p className="font-body text-sm">Operations data is unavailable.</p>
      </div>
    );
  }
  return <OperationsClient snapshot={snapshot} />;
}

export default function OperationsPage(): React.ReactElement {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-neutral-800 mb-1">Operations</h1>
        <p className="font-body text-neutral-500">
          Hosted worker status, market liquidity, outstanding markets, and recent runs.
        </p>
      </div>
      <Suspense fallback={<div className="h-40 rounded-2xl bg-neutral-100 animate-pulse" />}>
        <OperationsContent />
      </Suspense>
      <LiquidityPanel />
    </div>
  );
}
