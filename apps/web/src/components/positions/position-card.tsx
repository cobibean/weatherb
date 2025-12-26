'use client';

import { useMemo } from 'react';
import { formatEther } from 'viem';
import { TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserPosition } from '@/types/positions';

interface PositionCardProps {
  position: UserPosition;
  onClaim?: ((marketId: string) => void) | undefined;
  onRefund?: ((marketId: string) => void) | undefined;
}

export function PositionCard({ position, onClaim, onRefund }: PositionCardProps) {
  const thresholdF = position.thresholdTenths / 10;
  const resolveDate = new Date(position.resolveTime);
  const isYes = position.betSide === 'YES';
  const betAmountFLR = formatEther(position.betAmount);

  // Format observed temp if available
  const observedTempF = position.observedTempTenths
    ? position.observedTempTenths / 10
    : undefined;

  // Time until resolution
  const timeUntilResolve = useMemo(() => {
    const now = Date.now();
    const diff = position.resolveTime - now;

    if (diff < 0) return 'Resolving soon...';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    return 'Resolving soon...';
  }, [position.resolveTime]);

  // Status badge configuration
  const statusConfig = useMemo(() => {
    switch (position.status) {
      case 'active':
        return {
          label: 'Active',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Clock,
        };
      case 'claimable':
      case 'won':
        return {
          label: 'Won',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: CheckCircle,
        };
      case 'claimed':
        return {
          label: 'Claimed',
          color: 'bg-slate-100 text-slate-600 border-slate-200',
          icon: CheckCircle,
        };
      case 'lost':
        return {
          label: 'Lost',
          color: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: XCircle,
        };
      case 'refundable':
        return {
          label: 'Refund Available',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: AlertCircle,
        };
      case 'refunded':
        return {
          label: 'Refunded',
          color: 'bg-slate-100 text-slate-600 border-slate-200',
          icon: CheckCircle,
        };
      default:
        return {
          label: position.status,
          color: 'bg-slate-100 text-slate-600 border-slate-200',
          icon: Clock,
        };
    }
  }, [position.status]);

  const StatusIcon = statusConfig.icon;

  return (
    <div className="card hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-neutral-800 mb-1">
            {position.cityName}
          </h3>
          <p className="text-sm text-neutral-600">
            Will temp be ≥ <span className="font-semibold">{thresholdF}°F</span>?
          </p>
        </div>
        <div className={cn('px-3 py-1 rounded-full border flex items-center gap-1.5', statusConfig.color)}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">{statusConfig.label}</span>
        </div>
      </div>

      {/* Bet Info */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Your bet:</span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1',
                isYes ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
              )}
            >
              {isYes ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {position.betSide}
            </span>
            <span className="font-mono font-semibold text-neutral-800">
              {Number(betAmountFLR).toFixed(3)} FLR
            </span>
          </div>
        </div>
        {position.multiplier && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
            <span className="text-xs text-slate-500">Odds at bet:</span>
            <span className="text-xs font-semibold text-slate-700">
              {position.multiplier.toFixed(2)}x
            </span>
          </div>
        )}
      </div>

      {/* Resolution Info */}
      {position.status === 'active' ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600 mb-4">
          <Clock className="w-4 h-4" />
          <span>
            Resolves in {timeUntilResolve} • {resolveDate.toLocaleDateString()} at{' '}
            {resolveDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ) : observedTempF !== undefined ? (
        <div className="bg-slate-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Observed temp:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-neutral-800">{observedTempF.toFixed(1)}°F</span>
              <span className="text-xs text-slate-500">
                ({observedTempF >= thresholdF ? 'YES' : 'NO'} outcome)
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Resolved: {new Date(position.resolveTime).toLocaleDateString()}
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-600 mb-4">
          Resolved: {resolveDate.toLocaleDateString()}
        </div>
      )}

      {/* Claimable/Claimed Amount */}
      {position.claimableAmount && position.claimableAmount > 0n && (
        <div
          className={cn(
            'rounded-lg p-3 mb-4 border-2',
            position.status === 'claimable'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-slate-50 border-slate-200'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              {position.status === 'claimable' ? 'You won:' : 'You claimed:'}
            </span>
            <span
              className={cn(
                'font-mono font-bold text-lg',
                position.status === 'claimable' ? 'text-emerald-700' : 'text-slate-700'
              )}
            >
              {Number(formatEther(position.claimableAmount)).toFixed(3)} FLR
            </span>
          </div>
          {position.claimableAmount > position.betAmount && (
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-slate-500">Profit:</span>
              <span className="text-emerald-600 font-semibold">
                +{Number(formatEther(position.claimableAmount - position.betAmount)).toFixed(3)} FLR
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {position.status === 'claimable' && onClaim && (
        <button
          onClick={() => onClaim(position.marketId)}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Claim Winnings
        </button>
      )}

      {position.status === 'refundable' && onRefund && (
        <button
          onClick={() => onRefund(position.marketId)}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <AlertCircle className="w-4 h-4" />
          Refund Bet
        </button>
      )}

      {position.status === 'claimed' && (
        <div className="w-full py-3 bg-slate-100 text-slate-600 font-semibold rounded-lg flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Claimed
        </div>
      )}

      {position.status === 'lost' && (
        <div className="w-full py-2 text-center text-sm text-slate-500">
          Better luck next time!
        </div>
      )}
    </div>
  );
}
