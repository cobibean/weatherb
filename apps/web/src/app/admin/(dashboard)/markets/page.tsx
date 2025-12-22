import { Suspense } from 'react';
import { getSystemConfig } from '@/lib/admin-data';
import { MarketsClient } from './markets-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function MarketsContent(): Promise<React.ReactElement> {
  const config = await getSystemConfig();
  
  // TODO: Fetch real market data from contract
  // For now, use mock data
  const mockMarkets = [
    {
      id: 0,
      cityId: 'new-york',
      cityName: 'New York',
      resolveTime: Date.now() + 3600000,
      thresholdTenths: 750,
      status: 'Open',
      yesPool: '125.5',
      noPool: '89.2',
    },
    {
      id: 1,
      cityId: 'los-angeles',
      cityName: 'Los Angeles',
      resolveTime: Date.now() + 7200000,
      thresholdTenths: 820,
      status: 'Open',
      yesPool: '45.0',
      noPool: '67.8',
    },
    {
      id: 2,
      cityId: 'chicago',
      cityName: 'Chicago',
      resolveTime: Date.now() - 3600000,
      thresholdTenths: 680,
      status: 'Resolved',
      yesPool: '200.0',
      noPool: '150.0',
      outcome: true,
      resolvedTemp: 72,
    },
  ];

  return (
    <MarketsClient 
      markets={mockMarkets}
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

