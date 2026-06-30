import { Suspense } from 'react';
import { getLogs } from '@/lib/admin-data';
import { LogsClient } from './logs-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function LogsContent(): Promise<React.ReactElement> {
  const result = await getLogs({ page: 1, limit: 20 });
  return <LogsClient initialLogs={result.logs} initialPagination={result.pagination} />;
}

export default function LogsPage(): React.ReactElement {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-neutral-800 mb-1">
          Activity Logs
        </h1>
        <p className="font-body text-neutral-500">
          View all admin actions and system events.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        }
      >
        <LogsContent />
      </Suspense>
    </div>
  );
}

