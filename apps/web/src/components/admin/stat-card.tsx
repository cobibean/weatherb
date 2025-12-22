'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  colorScheme?: 'default' | 'success' | 'warning' | 'error' | 'sky';
}

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

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  colorScheme = 'default',
}: StatCardProps): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-2xl border ${colorClasses[colorScheme]} transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-body text-sm text-neutral-500 mb-1 truncate">{title}</p>
          <p className="font-display text-2xl font-bold text-neutral-800 truncate">{value}</p>
          
          {(subtitle || trendValue) && (
            <div className="flex items-center gap-2 mt-1">
              {trendValue && (
                <span
                  className={`font-body text-xs font-medium ${
                    trend === 'up'
                      ? 'text-success-soft'
                      : trend === 'down'
                      ? 'text-error-soft'
                      : 'text-neutral-400'
                  }`}
                >
                  {trend === 'up' && '↑'}
                  {trend === 'down' && '↓'}
                  {trendValue}
                </span>
              )}
              {subtitle && (
                <span className="font-body text-xs text-neutral-400">{subtitle}</span>
              )}
            </div>
          )}
        </div>

        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColorClasses[colorScheme]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

