'use client';

import { useClientClock } from '@/hooks/use-client-clock';
import { useMemo } from 'react';
import { formatEther } from 'viem';
import { TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserPosition } from '@/types/positions';

interface PositionCardProps {
  position: UserPosition;
  onClaim?: ((marketId: string) => void) | undefined;
  onRefund?: ((marketId: string) => void) | undefined;
  onViewDetails?: ((position: UserPosition) => void) | undefined;
}

export function PositionCard({
  position,
  onClaim,
  onRefund,
  onViewDetails,
}: PositionCardProps): React.ReactElement {
  const payout = position.claimedAmount ?? position.claimableAmount ?? 0n;
  const thresholdF = position.thresholdTenths / 10;
  const resolveDate = new Date(position.resolveTime);
  const isYes = position.betSide === 'YES';
  const betAmountUSDC = formatEther(position.betAmount);

  // Format observed temp if available
  const observedTempF =
    position.observedTempTenths != null ? position.observedTempTenths / 10 : undefined;

  const now = useClientClock();

  // Time until resolution
  const timeUntilResolve = useMemo(() => {
    if (!now) return '--';
    const diff = position.resolveTime - now;

    if (diff < 0) return 'Resolving soon...';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    return 'Resolving soon...';
  }, [position.resolveTime, now]);

  // Status badge configuration
  const statusConfig = useMemo(() => {
    switch (position.status) {
      case 'active':
        return {
          label: 'Active',
          color: 'bg-[#163346] text-[#a6d6f2] border-[#456078]',
          icon: Clock,
        };
      case 'claimable':
      case 'won':
        return {
          label: 'Won',
          color: 'bg-[#163346] text-[#a6d6f2] border-[#456078]',
          icon: CheckCircle,
        };
      case 'claimed':
        return {
          label: 'Claimed',
          color: 'bg-[#142b40] text-[#b6c4d5] border-[#30475a]',
          icon: CheckCircle,
        };
      case 'lost':
        return {
          label: 'Lost',
          color: 'bg-[#352637] text-[#f2b3c3] border-[#456078]',
          icon: XCircle,
        };
      case 'refundable':
        return {
          label: 'Refund Available',
          color: 'bg-[#342e24] text-[#eed39c] border-[#456078]',
          icon: AlertCircle,
        };
      case 'refunded':
        return {
          label: 'Refunded',
          color: 'bg-[#142b40] text-[#b6c4d5] border-[#30475a]',
          icon: CheckCircle,
        };
      default:
        return {
          label: position.status,
          color: 'bg-[#142b40] text-[#b6c4d5] border-[#30475a]',
          icon: Clock,
        };
    }
  }, [position.status]);

  const StatusIcon = statusConfig.icon;

  return (
    <div className="wb-panel wb-position-card">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[#f4f7fb] mb-1">{position.cityName}</h3>
          <p className="text-sm text-[#b6c4d5]">
            Will temp be ≥ <span className="font-semibold">{thresholdF}°F</span>?
          </p>
        </div>
        <div
          className={cn(
            'px-3 py-1 rounded-full border flex items-center gap-1.5',
            statusConfig.color,
          )}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">{statusConfig.label}</span>
        </div>
      </div>

      {/* Bet Info */}
      <div className="bg-[#142b40] rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#b6c4d5]">Your bet:</span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1',
                isYes ? 'bg-[#163346] text-[#a6d6f2]' : 'bg-[#352637] text-[#f2b3c3]',
              )}
            >
              {isYes ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {position.betSide}
            </span>
            <span className="font-mono font-semibold text-[#f4f7fb]">
              {Number(betAmountUSDC).toFixed(3)} USDC
            </span>
          </div>
        </div>
        {position.multiplier && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#30475a]">
            <span className="text-xs text-[#b6c4d5]">Odds at bet:</span>
            <span className="text-xs font-semibold text-[#f4f7fb]">
              {position.multiplier.toFixed(2)}x
            </span>
          </div>
        )}
      </div>

      {/* Resolution Info */}
      {position.status === 'active' ? (
        <div className="flex items-center gap-2 text-sm text-[#b6c4d5] mb-4">
          <Clock className="w-4 h-4" />
          <span>
            Resolves in {timeUntilResolve} • {resolveDate.toLocaleDateString()} at{' '}
            {resolveDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ) : observedTempF !== undefined ? (
        <div className="bg-[#142b40] rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#b6c4d5]">Observed temp:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#f4f7fb]">
                {observedTempF.toFixed(1)}°F
              </span>
              <span className="text-xs text-[#b6c4d5]">
                ({observedTempF >= thresholdF ? 'YES' : 'NO'} outcome)
              </span>
            </div>
          </div>
          <div className="text-xs text-[#b6c4d5] mt-1">
            Resolved: {new Date(position.resolveTime).toLocaleDateString()}
          </div>
        </div>
      ) : (
        <div className="text-sm text-[#b6c4d5] mb-4">
          Resolved: {resolveDate.toLocaleDateString()}
        </div>
      )}

      {/* Claimable/Claimed Amount */}
      {payout > 0n && (
        <div
          className={cn(
            'rounded-lg p-3 mb-4 border-2',
            position.status === 'claimable'
              ? 'bg-[#163346] border-[#456078]'
              : 'bg-[#142b40] border-[#30475a]',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#f4f7fb]">
              {position.status === 'refundable'
                ? 'Your refund:'
                : position.status === 'claimable'
                  ? 'You won:'
                  : 'You claimed:'}
            </span>
            <span
              className={cn(
                'font-mono font-bold text-lg',
                position.status === 'claimable' ? 'text-[#a6d6f2]' : 'text-[#f4f7fb]',
              )}
            >
              {Number(formatEther(payout)).toFixed(3)} USDC
            </span>
          </div>
          {payout > position.betAmount && (
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-[#b6c4d5]">Profit:</span>
              <span className="text-[#a6d6f2] font-semibold">
                +{Number(formatEther(payout - position.betAmount)).toFixed(3)} USDC
              </span>
            </div>
          )}
        </div>
      )}

      <div className="wb-position-actions">
        {/* Action Buttons */}
        {position.status === 'claimable' && onClaim && (
          <button
            onClick={() => onClaim(position.marketId)}
            className="wb-outcome w-full flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Claim Winnings
          </button>
        )}

        {position.status === 'refundable' && onRefund && (
          <button
            onClick={() => onRefund(position.marketId)}
            className="wb-outcome w-full flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            Refund Bet
          </button>
        )}

        {position.status === 'claimed' && (
          <div className="w-full py-3 bg-[#142b40] text-[#b6c4d5] font-semibold rounded-lg flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Claimed
          </div>
        )}

        {position.status === 'lost' && (
          <div className="w-full py-2 text-center text-sm text-[#b6c4d5]">Position settled</div>
        )}

        {/* View Details Button */}
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(position)}
            className="w-full mt-3 px-3 py-2 text-sm font-medium text-[#a6d6f2] hover:text-[#a6d6f2] hover:bg-[#163346] rounded-lg transition-colors border border-[#456078]"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}
