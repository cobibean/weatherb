'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
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

interface ClaimModalProps {
  position: UserPosition;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TxState = 'idle' | 'pending' | 'success' | 'error';

export function ClaimModal({ position, isOpen, onClose, onSuccess }: ClaimModalProps) {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction, isPending } = useSendTransaction();
  const client = getClient();

  const [txState, setTxState] = useState<TxState>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configError = !CONTRACT_ADDRESS || !client;
  const thresholdF = position.thresholdTenths / 10;
  const claimableAmountFLR = position.claimableAmount
    ? Number(formatEther(position.claimableAmount))
    : 0;
  const profitFLR = position.claimableAmount
    ? Number(formatEther(position.claimableAmount - position.betAmount))
    : 0;

  const handleClaim = async () => {
    if (configError || !client || !CONTRACT_ADDRESS) {
      setError('Claiming is not configured. Please try again later.');
      return;
    }

    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setTxState('pending');
    setError(null);

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
      setTxHash(result.transactionHash);
      setTxState('success');

      // Call onSuccess callback after a short delay
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err) {
      console.error('Claim failed:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setTxState('error');
    }
  };

  const handleClose = () => {
    setTxState('idle');
    setError(null);
    setTxHash(null);
    onClose();
  };

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
          className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Claim Winnings</h2>
                <p className="text-sm opacity-90">{position.cityName}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {txState === 'success' ? (
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-neutral-800 mb-2">
                  Winnings Claimed!
                </h3>
                <p className="text-neutral-600 mb-1">
                  You received {claimableAmountFLR.toFixed(3)} FLR
                </p>
                <p className="text-sm text-emerald-600 font-semibold">
                  Profit: +{profitFLR.toFixed(3)} FLR
                </p>
                {txHash && (
                  <a
                    href={`https://coston2-explorer.flare.network/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-sky-500 hover:underline mt-4"
                  >
                    View transaction
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <>
                {/* Market Info */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Market:</span>
                    <span className="text-sm font-semibold text-slate-800">
                      Temp ≥ {thresholdF}°F
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Your bet:</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {position.betSide} • {Number(formatEther(position.betAmount)).toFixed(3)} FLR
                    </span>
                  </div>
                  {position.observedTempTenths && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-sm text-slate-600">Result:</span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {(position.observedTempTenths / 10).toFixed(1)}°F ({position.outcome ? 'YES' : 'NO'})
                      </span>
                    </div>
                  )}
                </div>

                {/* Winnings Breakdown */}
                <div className="bg-emerald-50 rounded-xl p-4 border-2 border-emerald-200">
                  <div className="text-sm font-medium text-slate-700 mb-3">
                    Your winnings:
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Total payout:</span>
                      <span className="font-mono font-bold text-lg text-emerald-700">
                        {claimableAmountFLR.toFixed(3)} FLR
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Your stake:</span>
                      <span className="font-mono text-slate-600">
                        {Number(formatEther(position.betAmount)).toFixed(3)} FLR
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                      <span className="text-sm font-semibold text-slate-700">Profit:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        +{profitFLR.toFixed(3)} FLR
                      </span>
                    </div>
                  </div>
                </div>

                {/* Network Fee Notice */}
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                  <p>
                    Network gas fees will be deducted from your wallet. The amount shown above will be sent to your wallet.
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                {/* Wallet Status */}
                {!account && (
                  <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-xl">
                    Connect your wallet to claim your winnings.
                  </p>
                )}

                {/* Claim Button */}
                <button
                  onClick={handleClaim}
                  disabled={!account || isPending || configError}
                  className={cn(
                    'w-full py-4 rounded-xl font-semibold text-white transition-all',
                    'flex items-center justify-center gap-2',
                    'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300',
                    (isPending || !account || configError) && 'cursor-not-allowed'
                  )}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Claim {claimableAmountFLR.toFixed(3)} FLR
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
