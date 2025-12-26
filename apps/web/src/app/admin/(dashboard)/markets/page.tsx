import { Suspense } from 'react';
import { getAdminMarkets, getSystemConfig } from '@/lib/admin-data';
import { MarketsClient } from './markets-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function MarketsContent(): Promise<React.ReactElement> {
  const config = await getSystemConfig();
  const markets = await getAdminMarkets();

  return (
    <MarketsClient 
      markets={markets}
      isPaused={config.isPaused}
      isSettlerPaused={config.settlerPaused}
    />
  );
}

export default function MarketsPage(): React.ReactElement {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-neutral-800 mb-1">
          Markets
        </h1>
        <p className="font-body text-neutral-500">
          View and manage active and past weather markets.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        }
      >
        <MarketsContent />
      </Suspense>
    </div>
  );
}
