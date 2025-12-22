import { Suspense } from 'react';
import { TrendingUp, Clock, Coins, AlertTriangle, Users, Activity } from 'lucide-react';
import { StatCard } from '@/components/admin/stat-card';
import { DashboardClient } from './dashboard-client';
import { getAdminStats, getRecentLogs } from '@/lib/admin-data';

// Ensure this page is always fresh
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function DashboardContent(): Promise<React.ReactElement> {
  const [stats, recentLogs] = await Promise.all([
    getAdminStats(),
    getRecentLogs(10),
  ]);

  return (
    <DashboardClient 
      stats={stats} 
      recentLogs={recentLogs}
    />
  );
}

export default function AdminDashboardPage(): React.ReactElement {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-neutral-800 mb-1">
          Dashboard
        </h1>
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
