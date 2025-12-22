'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  Clock,
  Activity,
  Loader2,
} from 'lucide-react';
import type { AdminLog } from '@prisma/client';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface LogsClientProps {
  initialLogs: AdminLog[];
  initialPagination: Pagination;
}

const actionColors: Record<string, string> = {
  LOGIN: 'bg-sky-light/50 text-sky-deep',
  LOGOUT: 'bg-neutral-200 text-neutral-600',
  PAUSE_BETTING: 'bg-error-soft/50 text-neutral-800',
  RESUME_BETTING: 'bg-success-soft/50 text-neutral-800',
  PAUSE_SETTLEMENT: 'bg-sunset-orange/50 text-neutral-800',
  RESUME_SETTLEMENT: 'bg-success-soft/50 text-neutral-800',
  UPDATE_CONFIG: 'bg-sunset-pink/50 text-neutral-800',
  CREATE_CITY: 'bg-sky-medium/30 text-sky-deep',
  ACTIVATE_CITY: 'bg-success-soft/50 text-neutral-800',
  DEACTIVATE_CITY: 'bg-neutral-200 text-neutral-600',
  CANCEL_MARKET: 'bg-error-soft/50 text-neutral-800',
};

const actionLabels: Record<string, string> = {
  LOGIN: 'Logged In',
  LOGOUT: 'Logged Out',
  PAUSE_BETTING: 'Paused Betting',
  RESUME_BETTING: 'Resumed Betting',
  PAUSE_SETTLEMENT: 'Paused Settlement',
  RESUME_SETTLEMENT: 'Resumed Settlement',
  UPDATE_CONFIG: 'Updated Config',
  CREATE_CITY: 'Created City',
  ACTIVATE_CITY: 'Activated City',
  DEACTIVATE_CITY: 'Deactivated City',
  CANCEL_MARKET: 'Cancelled Market',
};

export function LogsClient({ initialLogs, initialPagination }: LogsClientProps): React.ReactElement {
  const [logs, setLogs] = useState(initialLogs);
  const [pagination, setPagination] = useState(initialPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const fetchLogs = async (page: number, action?: string): Promise<void> => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (action) params.set('action', action);

      const res = await fetch(`/admin/api/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (action: string): void => {
    setFilter(action);
    fetchLogs(1, action || undefined);
  };

  const handlePageChange = (page: number): void => {
    fetchLogs(page, filter || undefined);
  };

  const formatTime = (date: Date | string): string => {
    return new Date(date).toLocaleString();
  };

  const formatDetails = (details: unknown): string => {
    if (!details) return '';
    if (typeof details === 'string') return details;
    return JSON.stringify(details, null, 2);
  };

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="px-3 py-2 rounded-xl border border-neutral-200 bg-white font-body text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-medium"
          >
            <option value="">All Actions</option>
            {Object.keys(actionLabels).map((action) => (
              <option key={action} value={action}>
                {actionLabels[action] || action}
              </option>
            ))}
          </select>
        </div>

        {isLoading && (
          <Loader2 className="w-5 h-5 text-sky-medium animate-spin" />
        )}
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-neutral-50 border-b border-neutral-200 font-body text-sm font-medium text-neutral-500">
          <div className="col-span-2">Time</div>
          <div className="col-span-3">Action</div>
          <div className="col-span-3">Wallet</div>
          <div className="col-span-4">Details</div>
        </div>

        {/* Rows */}
        {logs.length === 0 ? (
          <div className="p-8 text-center font-body text-neutral-400">
            No logs found.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {logs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 hover:bg-neutral-50 transition-colors"
              >
                {/* Time */}
                <div className="sm:col-span-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-neutral-400 sm:hidden" />
                  <span className="font-body text-sm text-neutral-500">
                    {formatTime(log.createdAt)}
                  </span>
                </div>

                {/* Action */}
                <div className="sm:col-span-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-neutral-400 sm:hidden" />
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      actionColors[log.action] || 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    {actionLabels[log.action] || log.action}
                  </span>
                </div>

                {/* Wallet */}
                <div className="sm:col-span-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-neutral-400 sm:hidden" />
                  <span className="font-mono text-sm text-neutral-600 truncate">
                    {log.wallet.slice(0, 6)}...{log.wallet.slice(-4)}
                  </span>
                </div>

                {/* Details */}
                <div className="sm:col-span-4">
                  {log.details && (
                    <pre className="font-mono text-xs text-neutral-500 bg-neutral-100 rounded-lg p-2 overflow-x-auto max-h-20">
                      {formatDetails(log.details)}
                    </pre>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50">
            <p className="font-body text-sm text-neutral-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
                className="p-2 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="p-2 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

