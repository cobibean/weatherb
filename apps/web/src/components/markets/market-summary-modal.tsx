'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import type { Market } from '@weatherb/shared/types/market';
import type { UserPosition } from '@/types/positions';
import { calculateMarketSummary, formatTemperatureDisplay, getOutcomeMessage } from '@/lib/market-summary-utils';
import { cn } from '@/lib/utils';

type MarketSummaryModalProps = {
  market: Market | null;
  isOpen: boolean;
  onClose: () => void;
  userPosition?: UserPosition;
  feePercentage?: number;
  isLoading?: boolean;
  error?: string;
};

export function MarketSummaryModal({
  market,
  isOpen,
  onClose,
  userPosition,
  feePercentage = 0.01,
  isLoading = false,
  error
}: MarketSummaryModalProps) {
  if (!isOpen) return null;

  // Show loading state
  if (isLoading) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 bg-white rounded-2xl p-8 shadow-2xl"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
              <p className="text-gray-600">Loading market data...</p>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // Show error state
  if (error || !market) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 bg-white rounded-2xl p-8 shadow-2xl max-w-md"
          >
            <div className="flex flex-col items-center space-y-4">
              <AlertCircle className="w-12 h-12 text-rose-500" />
              <p className="text-gray-800 font-semibold">Error Loading Market</p>
              <p className="text-gray-600 text-center">{error || 'Market data not available'}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  const summary = calculateMarketSummary(market, feePercentage);
  const summaryWithUser = {
    ...summary,
    userPosition
  };

  // Determine header gradient color based on outcome
  const getHeaderGradient = () => {
    if (summary.type === 'settled') {
      if (summary.winnerSide === 'YES') {
        return 'from-emerald-50 to-emerald-100';
      } else if (summary.winnerSide === 'NO') {
        return 'from-rose-50 to-rose-100';
      } else {
        return 'from-amber-50 to-amber-100';
      }
    }
    return 'from-sky-50 to-sky-100';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn(
            "px-6 py-4 border-b border-gray-100",
            "bg-gradient-to-r",
            getHeaderGradient()
          )}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Market Summary
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/50 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
            {/* City Name */}
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-gray-900">{market.cityName}</h3>
            </div>

            {/* Outcome Badge */}
            <div className="mb-6">
              <div className={cn(
                "inline-block px-4 py-2 rounded-full font-semibold text-sm",
                summary.type === 'settled' && summary.winnerSide === 'YES' && "bg-emerald-100 text-emerald-800",
                summary.type === 'settled' && summary.winnerSide === 'NO' && "bg-rose-100 text-rose-800",
                summary.type === 'settled' && summary.winnerSide === 'NONE' && "bg-amber-100 text-amber-800",
                summary.type === 'live' && "bg-sky-100 text-sky-800"
              )}>
                {getOutcomeMessage(market.status, market.outcome)}
              </div>
            </div>

            {/* Market Details */}
            {summary.type === 'settled' && (
              <div className="space-y-4">
                {/* Temperature Info */}
                {market.resolvedTempF_tenths !== undefined && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-sm text-gray-600 mb-1">Observed Temperature</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatTemperatureDisplay(market.resolvedTempF_tenths)}
                    </div>
                  </div>
                )}

                {/* Threshold */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">Threshold</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ≥{formatTemperatureDisplay(market.thresholdF_tenths)}
                  </div>
                </div>

                {/* Pool Distribution */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-2">Pool Distribution</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">YES Pool:</span>
                      <span className="font-semibold">{(Number(market.yesPool) / 1e18).toFixed(2)} FLR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">NO Pool:</span>
                      <span className="font-semibold">{(Number(market.noPool) / 1e18).toFixed(2)} FLR</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600 font-semibold">Total:</span>
                      <span className="font-bold">{(Number(summary.totalPool) / 1e18).toFixed(2)} FLR</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {summary.type === 'live' && (
              <div className="space-y-4">
                {/* Threshold */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">Target</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ≥{formatTemperatureDisplay(market.thresholdF_tenths)}
                  </div>
                </div>

                {/* Implied Probability */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-2">Current Odds</div>
                  <div className="flex justify-between">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase mb-1">YES</div>
                      <div className="text-xl font-bold text-emerald-600">
                        {summary.impliedProbability.yes}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase mb-1">NO</div>
                      <div className="text-xl font-bold text-rose-600">
                        {summary.impliedProbability.no}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pool Sizes */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-2">Total Pool</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {(Number(summary.totalPool) / 1e18).toFixed(2)} FLR
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
