'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Pause,
  Play,
  X,
  Loader2,
  Shield,
} from 'lucide-react';

interface EmergencyControlsProps {
  isPaused: boolean;
  isSettlerPaused: boolean;
  onPauseToggle: () => Promise<void>;
  onSettlerPauseToggle: () => Promise<void>;
}

export function EmergencyControls({
  isPaused,
  isSettlerPaused,
  onPauseToggle,
  onSettlerPauseToggle,
}: EmergencyControlsProps): React.ReactElement {
  const [confirmingAction, setConfirmingAction] = useState<'pause' | 'settler' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    if (!confirmingAction) return;
    
    setIsLoading(true);
    try {
      if (confirmingAction === 'pause') {
        await onPauseToggle();
      } else if (confirmingAction === 'settler') {
        await onSettlerPauseToggle();
      }
    } finally {
      setIsLoading(false);
      setConfirmingAction(null);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-error-soft/50 bg-error-soft/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-error-soft flex items-center justify-center">
          <Shield className="w-5 h-5 text-neutral-800" />
        </div>
        <div>
          <h3 className="font-display font-bold text-neutral-800">Emergency Controls</h3>
          <p className="font-body text-sm text-neutral-500">Critical system actions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Global Pause */}
        <button
          onClick={() => setConfirmingAction('pause')}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-body font-medium transition-colors ${
            isPaused
              ? 'bg-success-soft text-neutral-800 hover:bg-success-soft/80'
              : 'bg-error-soft text-neutral-800 hover:bg-error-soft/80'
          }`}
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4" />
              Resume Betting
            </>
          ) : (
            <>
              <Pause className="w-4 h-4" />
              Pause All Betting
            </>
          )}
        </button>

        {/* Settler Pause */}
        <button
          onClick={() => setConfirmingAction('settler')}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-body font-medium transition-colors ${
            isSettlerPaused
              ? 'bg-success-soft text-neutral-800 hover:bg-success-soft/80'
              : 'bg-sunset-orange text-white hover:bg-sunset-orange/80'
          }`}
        >
          {isSettlerPaused ? (
            <>
              <Play className="w-4 h-4" />
              Resume Settlement
            </>
          ) : (
            <>
              <Pause className="w-4 h-4" />
              Pause Settlement
            </>
          )}
        </button>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmingAction && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => !isLoading && setConfirmingAction(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 bg-white rounded-2xl shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-sunset-orange/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-sunset-orange" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold text-lg text-neutral-800 mb-2">
                    Confirm Action
                  </h3>
                  <p className="font-body text-neutral-600 mb-4">
                    {confirmingAction === 'pause' && (
                      isPaused
                        ? 'Are you sure you want to resume betting? Users will be able to place bets again.'
                        : 'Are you sure you want to pause all betting? No new bets can be placed until resumed.'
                    )}
                    {confirmingAction === 'settler' && (
                      isSettlerPaused
                        ? 'Are you sure you want to resume settlement? Markets will be resolved automatically.'
                        : 'Are you sure you want to pause settlement? Markets will not be resolved until resumed.'
                    )}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleConfirm}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sunset-orange text-white font-body font-medium hover:bg-sunset-coral transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Confirm'
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmingAction(null)}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-100 text-neutral-600 font-body font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => !isLoading && setConfirmingAction(null)}
                  className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
                  disabled={isLoading}
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

