'use client';
import { notifyPositionsUpdated } from '@/lib/position-events';
import { appChain, prepareArcAction, confirmArcTransaction } from '@/lib/arc-wallet';

import { useState } from 'react';
import { motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { X, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { InlineLoader } from '@/components/ui/loading-spinner';
import { useActiveAccount, useActiveWallet, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall, getContract } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { formatEther } from 'viem';
import { cn } from '@/lib/utils';
import { decodeContractError } from '@/lib/contract-errors';
import type { UserPosition } from '@/types/positions';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

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

export function ClaimModal({
  position,
  isOpen,
  onClose,
  onSuccess,
}: ClaimModalProps): React.ReactElement | null {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { mutateAsync: sendTransaction } = useSendTransaction();
  const client = getClient();

  const [txState, setTxState] = useState<TxState>('idle');
  const isPending = txState === 'pending';
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configError = !CONTRACT_ADDRESS || !client;
  const thresholdF = position.thresholdTenths / 10;
  const isRefund = position.status === 'refundable';
  const claimableAmountUSDC = position.claimableAmount
    ? Number(formatEther(position.claimableAmount))
    : 0;
  const profitUSDC = position.claimableAmount
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
      await prepareArcAction(wallet, account.address as `0x${string}`, BigInt(position.marketId));
      const contract = getContract({
        client,
        chain: appChain,
        address: CONTRACT_ADDRESS as `0x${string}`,
      });

      // The restart contract claim() handles winnings, cancellation, and NoWinners refunds.
      const transaction = prepareContractCall({
        contract,
        method: 'function claim(uint256 marketId)',
        params: [BigInt(position.marketId)],
      });

      const result = await sendTransaction(transaction);
      await confirmArcTransaction(result.transactionHash);
      notifyPositionsUpdated(account.address);
      setTxHash(result.transactionHash);
      setTxState('success');

      // Call onSuccess callback after a short delay
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err) {
      console.error(`${isRefund ? 'Refund' : 'Claim'} failed:`, err);
      setError(decodeContractError(err));
      setTxState('error');
    }
  };

  const handleClose = () => {
    if (isPending) return;
    setTxState('idle');
    setError(null);
    setTxHash(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Overlay asChild>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <Dialog.Content
            asChild
            aria-describedby={undefined}
            onEscapeKeyDown={(event) => {
              if (isPending) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (isPending) event.preventDefault();
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              data-wb-theme="afterglow"
              className="wb-dialog relative w-full max-w-md mx-4 bg-[#0c2134] rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div
                className={cn(
                  'px-6 py-4 text-white',
                  isRefund
                    ? 'bg-linear-to-r from-amber-500 to-amber-600'
                    : 'bg-linear-to-r from-emerald-500 to-emerald-600',
                )}
              >
                <button
                  aria-label="Close"
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-1 rounded-full hover:bg-[#0c2134] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6" />
                  <div>
                    <Dialog.Title asChild>
                      <h2 className="text-xl font-bold">
                        {isRefund ? 'Refund Bet' : 'Claim Winnings'}
                      </h2>
                    </Dialog.Title>
                    <p className="text-sm opacity-90">{position.cityName}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {txState === 'success' ? (
                  <div className="text-center py-4">
                    <CheckCircle
                      className={cn(
                        'w-16 h-16 mx-auto mb-4',
                        isRefund ? 'text-[#eed39c]' : 'text-[#a6d6f2]',
                      )}
                    />
                    <h3 className="text-xl font-bold text-[#f4f7fb] mb-2">
                      {isRefund ? 'Refund Complete!' : 'Winnings Claimed!'}
                    </h3>
                    <p className="text-[#b6c4d5] mb-1">
                      You received {claimableAmountUSDC.toFixed(3)} USDC
                    </p>
                    {!isRefund && (
                      <p className="text-sm text-[#a6d6f2] font-semibold">
                        Profit: +{profitUSDC.toFixed(3)} USDC
                      </p>
                    )}
                    {txHash && (
                      <a
                        href={`https://explorer.testnet.arc.io/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-[#a6d6f2] hover:underline mt-4"
                      >
                        View transaction
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Market Info */}
                    <div className="bg-[#142b40] rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#b6c4d5]">Market:</span>
                        <span className="text-sm font-semibold text-[#f4f7fb]">
                          Temp ≥ {thresholdF}°F
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#b6c4d5]">Your bet:</span>
                        <span className="text-sm font-semibold text-[#f4f7fb]">
                          {position.betSide} • {Number(formatEther(position.betAmount)).toFixed(3)}{' '}
                          USDC
                        </span>
                      </div>
                      {position.observedTempTenths && (
                        <div className="flex items-center justify-between pt-2 border-t border-[#30475a]">
                          <span className="text-sm text-[#b6c4d5]">Result:</span>
                          <span className="text-sm font-semibold text-[#a6d6f2]">
                            {(position.observedTempTenths / 10).toFixed(1)}°F (
                            {position.outcome ? 'YES' : 'NO'})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Winnings/Refund Breakdown */}
                    <div
                      className={cn(
                        'rounded-xl p-4 border-2',
                        isRefund
                          ? 'bg-[#342e24] border-[#456078]'
                          : 'bg-[#163346] border-[#456078]',
                      )}
                    >
                      <div className="text-sm font-medium text-[#f4f7fb] mb-3">
                        {isRefund ? 'Your refund:' : 'Your winnings:'}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#b6c4d5]">
                            {isRefund ? 'Refund amount:' : 'Total payout:'}
                          </span>
                          <span
                            className={cn(
                              'font-mono font-bold text-lg',
                              isRefund ? 'text-[#eed39c]' : 'text-[#a6d6f2]',
                            )}
                          >
                            {claimableAmountUSDC.toFixed(3)} USDC
                          </span>
                        </div>
                        {!isRefund && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-[#b6c4d5]">Your stake:</span>
                              <span className="font-mono text-[#b6c4d5]">
                                {Number(formatEther(position.betAmount)).toFixed(3)} USDC
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-[#456078]">
                              <span className="text-sm font-semibold text-[#f4f7fb]">Profit:</span>
                              <span className="font-mono font-bold text-[#a6d6f2]">
                                +{profitUSDC.toFixed(3)} USDC
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Network Fee Notice */}
                    <div className="bg-[#163346] rounded-lg p-3 text-xs text-[#a6d6f2]">
                      <p>
                        Network gas fees will be deducted from your wallet. The amount shown above
                        will be sent to your wallet.
                      </p>
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="flex items-center gap-2 text-[#f2b3c3] bg-[#352637] px-4 py-3 rounded-xl">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                      </div>
                    )}

                    {/* Wallet Status */}
                    {!account && (
                      <p className="text-sm text-[#eed39c] bg-[#342e24] px-4 py-3 rounded-xl">
                        Connect your wallet to{' '}
                        {isRefund ? 'get your refund' : 'claim your winnings'}.
                      </p>
                    )}

                    {/* Claim/Refund Button */}
                    <button
                      onClick={handleClaim}
                      disabled={!account || isPending || configError}
                      className={cn(
                        'w-full py-4 rounded-xl font-semibold text-white transition-all',
                        'flex items-center justify-center gap-2',
                        isRefund
                          ? 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300'
                          : 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300',
                        (isPending || !account || configError) && 'cursor-not-allowed',
                      )}
                    >
                      {isPending ? (
                        <>
                          <InlineLoader variant="minimal" size="sm" />
                          Confirming...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          {isRefund ? 'Refund' : 'Claim'} {claimableAmountUSDC.toFixed(3)} USDC
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </Dialog.Content>
        </motion.div>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
