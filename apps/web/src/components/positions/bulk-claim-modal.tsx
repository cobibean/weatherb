'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Loader2, ExternalLink, DollarSign } from 'lucide-react';
import { useActiveAccount, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall, getContract, defineChain } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { formatEther } from 'viem';
import { cn } from '@/lib/utils';
import type { UserPosition } from '@/types/positions';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

// Coston2 testnet chain
const coston2Chain = defineChain({
  id: 114,
  name: 'Coston2',
  nativeCurrency: { name: 'Coston2 FLR', symbol: 'C2FLR', decimals: 18 },
  blockExplorers: [{ name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' }],
  rpcUrls: { default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] } },
});

// Lazy client creation
const getClient = () => {
  if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
    return null;
  }
  return createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
  });
};

interface BulkClaimModalProps {
  claimablePositions: UserPosition[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ClaimStatus = 'pending' | 'claiming' | 'success' | 'error';

interface ClaimProgress {
  marketId: string;
  status: ClaimStatus;
  txHash?: string;
  error?: string;
}

export function BulkClaimModal({
  claimablePositions,
  isOpen,
  onClose,
  onSuccess,
}: BulkClaimModalProps) {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendTransaction();
  const client = getClient();

  const [isClaiming, setIsClaiming] = useState(false);
  const [progress, setProgress] = useState<ClaimProgress[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  const configError = !CONTRACT_ADDRESS || !client;

  const totalClaimable = claimablePositions.reduce((sum, pos) => {
    return sum + (pos.claimableAmount ?? 0n);
  }, 0n);

  const totalClaimableFLR = Number(formatEther(totalClaimable));

  const handleClaimAll = async () => {
    if (configError || !client || !CONTRACT_ADDRESS || !account) {
      return;
    }

    setIsClaiming(true);
    setCompletedCount(0);

    // Initialize progress tracking
    const initialProgress: ClaimProgress[] = claimablePositions.map((pos) => ({
      marketId: pos.marketId,
      status: 'pending',
    }));
    setProgress(initialProgress);

    // Claim each market sequentially
    for (let i = 0; i < claimablePositions.length; i++) {
      const position = claimablePositions[i];
      if (!position) continue;

      // Update status to claiming
      setProgress((prev) =>
        prev.map((p) =>
          p.marketId === position.marketId ? { ...p, status: 'claiming' } : p
        )
      );

      try {
        const contract = getContract({
          client,
          chain: coston2Chain,
          address: CONTRACT_ADDRESS as `0x${string}`,
        });

        const transaction = prepareContractCall({
          contract,
          method: 'function claim(uint256 marketId)',
          params: [BigInt(position.marketId)],
        });

        const result = await sendTransaction(transaction);

        // Update status to success
        setProgress((prev) =>
          prev.map((p) =>
            p.marketId === position.marketId
              ? { ...p, status: 'success', txHash: result.transactionHash }
              : p
          )
        );

        setCompletedCount((prev) => prev + 1);
      } catch (err) {
        console.error(`Failed to claim market ${position.marketId}:`, err);

        // Update status to error but continue with next claims
        setProgress((prev) =>
          prev.map((p) =>
            p.marketId === position.marketId
              ? {
                  ...p,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Claim failed',
                }
              : p
          )
        );

        setCompletedCount((prev) => prev + 1);
      }
    }

    setIsClaiming(false);

    // Call onSuccess after all claims complete
    setTimeout(() => {
      onSuccess?.();
    }, 1500);
  };

  const handleClose = () => {
    if (!isClaiming) {
      setProgress([]);
      setCompletedCount(0);
      onClose();
    }
  };

  const allComplete = completedCount === claimablePositions.length && completedCount > 0;
  const successCount = progress.filter((p) => p.status === 'success').length;
  const errorCount = progress.filter((p) => p.status === 'error').length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white flex-shrink-0">
            <button
              onClick={handleClose}
              disabled={isClaiming}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Claim All Winnings</h2>
                <p className="text-sm opacity-90">
                  {claimablePositions.length} market{claimablePositions.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            {allComplete ? (
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-neutral-800 mb-2">
                  Claims Complete!
                </h3>
                <p className="text-neutral-600 mb-4">
                  {successCount} of {claimablePositions.length} claim{claimablePositions.length === 1 ? '' : 's'} successful
                </p>
                {errorCount > 0 && (
                  <p className="text-sm text-amber-600 mb-4">
                    {errorCount} claim{errorCount === 1 ? '' : 's'} failed. You can retry them individually.
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Total Amount */}
                <div className="bg-emerald-50 rounded-xl p-4 border-2 border-emerald-200">
                  <div className="text-sm font-medium text-slate-700 mb-2">
                    Total claimable amount:
                  </div>
                  <div className="font-mono font-bold text-3xl text-emerald-700">
                    {totalClaimableFLR.toFixed(3)} FLR
                  </div>
                </div>

                {/* Markets List */}
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-3">
                    Markets to claim ({claimablePositions.length}):
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {claimablePositions.map((position) => {
                      const claimProgress = progress.find((p) => p.marketId === position.marketId);
                      const amount = position.claimableAmount
                        ? Number(formatEther(position.claimableAmount))
                        : 0;

                      return (
                        <div
                          key={position.marketId}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border',
                            claimProgress?.status === 'success' && 'bg-emerald-50 border-emerald-200',
                            claimProgress?.status === 'error' && 'bg-rose-50 border-rose-200',
                            claimProgress?.status === 'claiming' && 'bg-blue-50 border-blue-200',
                            !claimProgress && 'bg-slate-50 border-slate-200'
                          )}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-neutral-800">
                              {position.cityName}
                            </div>
                            <div className="text-xs text-neutral-600">
                              {amount.toFixed(3)} FLR
                            </div>
                          </div>
                          <div>
                            {claimProgress?.status === 'claiming' && (
                              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                            )}
                            {claimProgress?.status === 'success' && (
                              <CheckCircle className="w-5 h-5 text-emerald-600" />
                            )}
                            {claimProgress?.status === 'error' && (
                              <AlertCircle className="w-5 h-5 text-rose-600" />
                            )}
                            {claimProgress?.status === 'pending' && (
                              <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Progress */}
                {isClaiming && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-800">
                        Claiming progress...
                      </span>
                      <span className="text-sm font-semibold text-blue-800">
                        {completedCount} / {claimablePositions.length}
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(completedCount / claimablePositions.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Wallet Status */}
                {!account && (
                  <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-xl">
                    Connect your wallet to claim your winnings.
                  </p>
                )}

                {/* Notice */}
                {!isClaiming && (
                  <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                    <p>
                      Each claim requires a separate transaction. Gas fees will be deducted from your wallet for each claim.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!allComplete && (
            <div className="px-6 pb-6 flex-shrink-0">
              <button
                onClick={handleClaimAll}
                disabled={!account || isClaiming || configError}
                className={cn(
                  'w-full py-4 rounded-xl font-semibold text-white transition-all',
                  'flex items-center justify-center gap-2',
                  'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300',
                  (isClaiming || !account || configError) && 'cursor-not-allowed'
                )}
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Claiming {completedCount + 1} of {claimablePositions.length}...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Claim All ({totalClaimableFLR.toFixed(3)} FLR)
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
