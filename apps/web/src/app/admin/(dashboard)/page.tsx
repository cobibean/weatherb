import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DashboardClient } from './dashboard-client';
import { getAdminStats, getRecentLogs } from '@/lib/admin-data';
import { adminWritesEnabled } from '@/lib/admin-writes';

// Ensure this page is always fresh
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function DashboardContent(): Promise<React.ReactElement> {
  let data: Awaited<ReturnType<typeof loadDashboardData>> | null;
  try {
    data = await loadDashboardData();
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    data = null;
  }
  if (data) {
    const [stats, recentLogs] = data;
    return (
      <DashboardClient
        stats={stats}
        recentLogs={recentLogs}
        writesEnabled={adminWritesEnabled()}
      />
    );
  }
  const errorMessage = 'Dashboard data is unavailable.';
  return (
    <div role="alert" className="p-6 rounded-2xl border border-error-soft bg-error-soft/10">
      <AlertTriangle className="w-6 h-6 text-error-soft mb-2" />
      <h3 className="font-display font-bold text-lg">Failed to Load Dashboard</h3>
      <p className="font-body text-sm">{errorMessage}</p>
    </div>
  );
}

async function loadDashboardData() {
  return await Promise.all([getAdminStats(), getRecentLogs(10)]);
}

export default function AdminDashboardPage(): React.ReactElement {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-neutral-800 mb-1">Dashboard</h1>
        <p className="font-body text-neutral-500">
          Monitor platform health and key metrics at a glance.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  );
}
