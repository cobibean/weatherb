'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  Thermometer,
} from 'lucide-react';
import { EmergencyControls } from '@/components/admin/emergency-controls';
import type { AdminMarket } from '@/lib/admin-data';

interface MarketsClientProps {
  markets: AdminMarket[];
  isPaused: boolean;
  isSettlerPaused: boolean;
}

export function MarketsClient({ markets, isPaused: initialPaused, isSettlerPaused: initialSettlerPaused }: MarketsClientProps): React.ReactElement {
  const router = useRouter();
  const [isPaused, setIsPaused] = useState(initialPaused);
  const [isSettlerPaused, setIsSettlerPaused] = useState(initialSettlerPaused);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleCancelMarket = async (marketId: number): Promise<void> => {
    setCancellingId(marketId);
    setConfirmCancel(null);
    setMessage(null);

    try {
      const res = await fetch('/admin/api/markets/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel market');
      }

      setMessage({ type: 'success', text: `Market #${marketId} cancellation initiated` });
      router.refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to cancel market',
      });
    } finally {
      setCancellingId(null);
    }
  };

  const formatTemp = (tenths: number): string => {
    return `${(tenths / 10).toFixed(0)}°F`;
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusBadge = (status: string, outcome?: boolean) => {
    switch (status) {
      case 'Open':
        return (
          <span className="px-2 py-1 rounded-full bg-sky-light/50 text-sky-deep text-xs font-medium">
            Open
          </span>
        );
      case 'Closed':
        return (
          <span className="px-2 py-1 rounded-full bg-sunset-orange/30 text-sunset-coral text-xs font-medium">
            Betting Closed
          </span>
        );
      case 'Resolved':
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            outcome ? 'bg-success-soft/50 text-neutral-800' : 'bg-error-soft/50 text-neutral-800'
          }`}>
            {outcome ? 'YES Won' : 'NO Won'}
          </span>
        );
      case 'Cancelled':
        return (
          <span className="px-2 py-1 rounded-full bg-neutral-200 text-neutral-600 text-xs font-medium">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const openMarkets = markets.filter((m) => m.status === 'Open' || m.status === 'Closed');
  const pastMarkets = markets.filter((m) => m.status === 'Resolved' || m.status === 'Cancelled');

  return (
    <div className="space-y-6">
      {/* Emergency Controls */}
      <EmergencyControls
        isPaused={isPaused}
        isSettlerPaused={isSettlerPaused}
        onPauseToggle={handlePauseToggle}
        onSettlerPauseToggle={handleSettlerPauseToggle}
      />

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-success-soft/30 border border-success-soft'
                : 'bg-error-soft/30 border border-error-soft'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-success-soft" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-error-soft" />
            )}
            <p className="font-body text-sm text-neutral-800">{message.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Markets */}
      <div>
        <h3 className="font-display font-bold text-lg text-neutral-800 mb-3">
          Active Markets ({openMarkets.length})
        </h3>
        {openMarkets.length === 0 ? (
          <p className="p-6 rounded-2xl border border-neutral-200 bg-white text-center font-body text-neutral-400">
            No active markets at the moment.
          </p>
        ) : (
          <div className="space-y-3">
            {openMarkets.map((market, index) => (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-2xl border border-neutral-200 bg-white"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-sky-light/30 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-sky-deep" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold text-neutral-800">
                          #{market.id} - {market.cityName}
                        </p>
                        {getStatusBadge(market.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Thermometer className="w-3.5 h-3.5" />
                          ≥{formatTemp(market.thresholdTenths)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(market.resolveTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="font-body text-xs text-neutral-400">YES Pool</p>
                      <p className="font-mono font-bold text-success-soft">{market.yesPool} FLR</p>
                    </div>
                    <div className="text-center">
                      <p className="font-body text-xs text-neutral-400">NO Pool</p>
                      <p className="font-mono font-bold text-error-soft">{market.noPool} FLR</p>
                    </div>

                    <button
                      onClick={() => setConfirmCancel(market.id)}
                      disabled={cancellingId === market.id}
                      className="px-3 py-2 rounded-xl bg-error-soft/20 text-error-soft hover:bg-error-soft/30 transition-colors disabled:opacity-50"
                    >
                      {cancellingId === market.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Past Markets */}
      {pastMarkets.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg text-neutral-800 mb-3">
            Past Markets ({pastMarkets.length})
          </h3>
          <div className="space-y-3">
            {pastMarkets.map((market, index) => (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-neutral-200 flex items-center justify-center">
                      {market.status === 'Resolved' ? (
                        <CheckCircle className="w-6 h-6 text-neutral-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-neutral-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold text-neutral-600">
                          #{market.id} - {market.cityName}
                        </p>
                        {getStatusBadge(market.status, market.outcome)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Thermometer className="w-3.5 h-3.5" />
                          ≥{formatTemp(market.thresholdTenths)}
                          {market.resolvedTemp !== undefined && (
                            <span className="ml-1">→ {market.resolvedTemp}°F</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(market.resolveTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="font-body text-xs text-neutral-400">YES Pool</p>
                      <p className="font-mono text-neutral-500">{market.yesPool} FLR</p>
                    </div>
                    <div className="text-center">
                      <p className="font-body text-xs text-neutral-400">NO Pool</p>
                      <p className="font-mono text-neutral-500">{market.noPool} FLR</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {confirmCancel !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setConfirmCancel(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 bg-white rounded-2xl shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-error-soft/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-error-soft" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold text-lg text-neutral-800 mb-2">
                    Cancel Market #{confirmCancel}?
                  </h3>
                  <p className="font-body text-neutral-600 mb-4">
                    This will cancel the market and allow all bettors to claim refunds. 
                    This action cannot be undone.
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleCancelMarket(confirmCancel)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-error-soft text-neutral-800 font-body font-medium hover:bg-error-soft/80 transition-colors"
                    >
                      Yes, Cancel Market
                    </button>
                    <button
                      onClick={() => setConfirmCancel(null)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-100 text-neutral-600 font-body font-medium hover:bg-neutral-200 transition-colors"
                    >
                      Keep Open
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setConfirmCancel(null)}
                  className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
