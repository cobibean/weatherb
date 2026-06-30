'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  Coins,
  Users,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  TestTube,
} from 'lucide-react';
import { StatCard } from '@/components/admin/stat-card';
import { EmergencyControls } from '@/components/admin/emergency-controls';
import { ColorPalettePieChart, ColorSwatches } from '@/components/admin/color-palette';
import { ProviderTestModal } from '@/components/admin/provider-test-modal';
import type { AdminStats } from '@/lib/admin-data';
import type { AdminLog } from '@prisma/client';

interface DashboardClientProps {
  stats: AdminStats;
  recentLogs: AdminLog[];
}

const providerStatusConfig = {
  healthy: { label: 'Healthy', icon: CheckCircle, color: 'success' as const },
  degraded: { label: 'Degraded', icon: AlertCircle, color: 'warning' as const },
  down: { label: 'Down', icon: XCircle, color: 'error' as const },
};

export function DashboardClient({ stats, recentLogs }: DashboardClientProps): React.ReactElement {
  const router = useRouter();
  const [isPaused, setIsPaused] = useState(stats.isPaused);
  const [isSettlerPaused, setIsSettlerPaused] = useState(stats.isSettlerPaused);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  
  // Safety check: ensure recentLogs is always an array
  const safeRecentLogs = recentLogs ?? [];

  const handlePauseToggle = async (): Promise<void> => {
    const newState = !isPaused;
    const res = await fetch('/admin/api/system/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaused: newState }),
    });
    
    if (res.ok) {
      setIsPaused(newState);
      router.refresh();
    }
  };

  const handleSettlerPauseToggle = async (): Promise<void> => {
    const newState = !isSettlerPaused;
    const res = await fetch('/admin/api/system/settler-pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlerPaused: newState }),
    });
    
    if (res.ok) {
      setIsSettlerPaused(newState);
      router.refresh();
    }
  };

  const statusConfig = providerStatusConfig[stats.providerStatus] ?? providerStatusConfig.degraded;
  const StatusIcon = statusConfig.icon;

  const handleTestComplete = (): void => {
    // Refresh dashboard stats after successful test
    router.refresh();
  };

  const colorClasses = {
    default: 'bg-cloud-off border-neutral-200',
    success: 'bg-success-soft/20 border-success-soft/40',
    warning: 'bg-sunset-orange/20 border-sunset-orange/40',
    error: 'bg-error-soft/30 border-error-soft/50',
    sky: 'bg-sky-light/20 border-sky-medium/30',
  };

  const iconColorClasses = {
    default: 'bg-neutral-200 text-neutral-600',
    success: 'bg-success-soft text-neutral-800',
    warning: 'bg-sunset-orange text-white',
    error: 'bg-error-soft text-neutral-800',
    sky: 'bg-sky-medium text-white',
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Custom Provider Status Card with Test Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-2xl border ${colorClasses[statusConfig.color]} transition-shadow hover:shadow-md`}
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <p className="font-body text-sm text-neutral-500 mb-1 truncate">Provider Status</p>
              <p className="font-display text-2xl font-bold text-neutral-800 truncate">
                {statusConfig.label}
              </p>
            </div>
            {StatusIcon && (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColorClasses[statusConfig.color]}`}>
                <StatusIcon className="w-5 h-5" />
              </div>
            )}
          </div>
          <button
            onClick={() => setIsTestModalOpen(true)}
            className="w-full mt-2 px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors flex items-center justify-center gap-2"
          >
            <TestTube className="w-4 h-4" />
            Test Provider
          </button>
        </motion.div>
        <StatCard
          title="Markets Today"
          value={stats.marketsToday}
          subtitle="of 5 max"
          icon={TrendingUp}
          colorScheme="sky"
        />
        <StatCard
          title="Pending Settlements"
          value={stats.pendingSettlements}
          icon={Clock}
          colorScheme={stats.pendingSettlements > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Fees (24h)"
          value={`${stats.fees24h} FLR`}
          icon={Coins}
          colorScheme="default"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Volume"
          value={`${stats.totalVolume} FLR`}
          subtitle="All-time"
          icon={Activity}
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          subtitle="Unique wallets"
          icon={Users}
        />
        <div className="sm:col-span-2 lg:col-span-1">
          <EmergencyControls
            isPaused={isPaused}
            isSettlerPaused={isSettlerPaused}
            onPauseToggle={handlePauseToggle}
            onSettlerPauseToggle={handleSettlerPauseToggle}
          />
        </div>
      </div>

      {/* Status Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-2xl border border-neutral-200 bg-white"
        >
          <h3 className="font-display font-bold text-lg text-neutral-800 mb-4">
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-neutral-100">
              <span className="font-body text-neutral-600">Betting</span>
              <span className={`font-body font-medium ${isPaused ? 'text-error-soft' : 'text-success-soft'}`}>
                {isPaused ? '⏸ Paused' : '✓ Active'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-neutral-100">
              <span className="font-body text-neutral-600">Settlement</span>
              <span className={`font-body font-medium ${isSettlerPaused ? 'text-error-soft' : 'text-success-soft'}`}>
                {isSettlerPaused ? '⏸ Paused' : '✓ Active'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="font-body text-neutral-600">Weather Provider</span>
              <span className={`font-body font-medium ${
                stats.providerStatus === 'healthy' ? 'text-success-soft' :
                stats.providerStatus === 'degraded' ? 'text-sunset-orange' : 'text-error-soft'
              }`}>
                {stats.providerStatus === 'healthy' && '✓ Healthy'}
                {stats.providerStatus === 'degraded' && '⚠ Degraded'}
                {stats.providerStatus === 'down' && '✕ Down'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-5 rounded-2xl border border-neutral-200 bg-white"
        >
          <h3 className="font-display font-bold text-lg text-neutral-800 mb-4">
            Recent Activity
          </h3>
          {safeRecentLogs.length === 0 ? (
            <p className="font-body text-neutral-400 text-center py-8">
              No recent activity
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {safeRecentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-neutral-800 truncate">
                      {log.action}
                    </p>
                    <p className="font-mono text-xs text-neutral-400 truncate">
                      {log.wallet.slice(0, 10)}...
                    </p>
                  </div>
                  <span className="font-body text-xs text-neutral-400 flex-shrink-0 ml-2">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Design System Colors */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-5 rounded-2xl border border-neutral-200 bg-white"
      >
        <h3 className="font-display font-bold text-lg text-neutral-800 mb-6">
          Design System Colors
        </h3>
        <ColorPalettePieChart />
      </motion.div>

      {/* Color Swatches */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-5 rounded-2xl border border-neutral-200 bg-white"
      >
        <h3 className="font-display font-bold text-lg text-neutral-800 mb-4">
          Color Palette
        </h3>
        <ColorSwatches />
      </motion.div>

      {/* Provider Test Modal */}
      <ProviderTestModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onTestComplete={handleTestComplete}
      />
    </div>
  );
}

