'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Loader2, CheckCircle, AlertCircle, Zap, ArrowRight } from 'lucide-react';
import { useActiveAccount, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall, getContract, defineChain } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { parseEther, formatEther } from 'viem';
import type { Market } from '@weatherb/shared/types';
import { calculatePotentialPayout, formatMultiplier, getImpliedMultipliers } from '@weatherb/shared/utils/payout';
import { cn } from '@/lib/utils';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

// Coston2 testnet chain
const coston2Chain = defineChain({
  id: 114,
  name: 'Coston2',
  nativeCurrency: { name: 'Coston2 FLR', symbol: 'C2FLR', decimals: 18 },
  blockExplorers: [{ name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' }],
  rpcUrls: { default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] } },
});

// Lazy client creation to avoid build-time errors
const getClient = () => {
  if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
    return null;
  }
  return createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
  });
};

interface BetModalProps {
  market: Market;
  side: 'yes' | 'no';
  isOpen: boolean;
  onClose: () => void;
}

type TxState = 'idle' | 'pending' | 'success' | 'error';

export function BetModal({ market, side, isOpen, onClose }: BetModalProps) {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction, isPending } = useSendTransaction();
  const client = getClient();
  
  const [amount, setAmount] = useState('0.1');
  const [txState, setTxState] = useState<TxState>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for missing configuration
  const configError = !CONTRACT_ADDRESS || !client;

  const thresholdF = market.thresholdF_tenths / 10;
  const resolveDate = new Date(market.resolveTime);
  const isYes = side === 'yes';

  // Calculate current implied odds for display
  const currentOdds = useMemo(() => 
    getImpliedMultipliers(market.yesPool, market.noPool),
    [market.yesPool, market.noPool]
  );

  // Calculate potential payout based on current input
  const payoutPreview = useMemo(() => {
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      return null;
    }
    try {
      const betWei = parseEther(amount);
      return calculatePotentialPayout(
        market.yesPool,
        market.noPool,
        betWei,
        side
      );
    } catch {
      return null;
    }
  }, [amount, market.yesPool, market.noPool, side]);

  // Format payout for display
  const formattedPayout = useMemo(() => {
    if (!payoutPreview) return null;
    const payoutNum = Number(formatEther(payoutPreview.payout));
    const profitNum = Number(formatEther(payoutPreview.profit));
    return {
      total: payoutNum.toFixed(3),
      profit: profitNum.toFixed(3),
      multiplier: formatMultiplier(payoutPreview.multiplier),
    };
  }, [payoutPreview]);

  const handleBet = async () => {
    if (configError || !client || !CONTRACT_ADDRESS) {
      setError('Betting is not configured. Please try again later.');
      return;
    }

    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount < 0.01) {
      setError('Minimum bet is 0.01 FLR');
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
        method: 'function placeBet(uint256 marketId, bool isYes) payable',
        params: [BigInt(market.id), isYes],
        value: parseEther(amount),
      });

      const result = await sendTransaction(transaction);
      setTxHash(result.transactionHash);
      setTxState('success');
    } catch (err) {
      console.error('Bet failed:', err);
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
          <div className={cn(
            'px-6 py-4 text-white',
            isYes ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-rose-500 to-rose-600'
          )}>
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              {isYes ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
              <div>
                <h2 className="text-xl font-bold">Bet {isYes ? 'YES' : 'NO'}</h2>
                <p className="text-sm opacity-90">{market.cityName}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Market Info */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <p className="text-sm text-slate-600">
                Will the temperature be <span className="font-semibold">≥ {thresholdF}°F</span>?
              </p>
              <p className="text-xs text-slate-500">
                Resolves: {resolveDate.toLocaleDateString()} at {resolveDate.toLocaleTimeString()}
              </p>
            </div>

            {txState === 'success' ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="font-semibold text-lg">Bet Placed!</p>
                <p className="text-sm text-slate-600 mt-1">
                  {amount} FLR on {isYes ? 'YES' : 'NO'}
                </p>
                {txHash && (
                  <a
                    href={`https://coston2-explorer.flare.network/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-500 hover:underline mt-2 inline-block"
                  >
                    View transaction →
                  </a>
                )}
              </div>
            ) : (
              <>
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bet Amount (FLR)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={isPending}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all text-lg"
                      placeholder="0.1"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      FLR
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {['0.1', '0.5', '1', '5'].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAmount(preset)}
                        disabled={isPending}
                        className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payout Preview */}
                {formattedPayout && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-xl p-4 border-2',
                      isYes 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-rose-50 border-rose-200'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-600">If {isYes ? 'YES' : 'NO'} wins:</span>
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1',
                        isYes ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                      )}>
                        <Zap className="w-3 h-3" />
                        {formattedPayout.multiplier}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">You receive:</span>
                        <span className="font-mono font-bold text-lg text-slate-800">
                          {formattedPayout.total} FLR
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Profit:</span>
                        <span className={cn(
                          'font-mono font-semibold',
                          isYes ? 'text-emerald-600' : 'text-rose-600'
                        )}>
                          +{formattedPayout.profit} FLR
                        </span>
                      </div>
                    </div>

                    {/* Odds Impact */}
                    {payoutPreview && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Market odds after bet:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sky-600 font-medium">
                              YES {Math.round(currentOdds.yesPercent)}%
                            </span>
                            <ArrowRight className="w-3 h-3" />
                            <span className="font-semibold text-slate-700">
                              {payoutPreview.newYesPercent}% / {payoutPreview.newNoPercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Current Odds Info (when no amount entered) */}
                {!formattedPayout && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="text-sm text-slate-600 mb-2">Current odds:</div>
                    <div className="flex justify-between">
                      <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase">YES</div>
                        <div className="font-mono font-bold text-emerald-600">
                          {formatMultiplier(currentOdds.yesMultiplier)}
                        </div>
                        <div className="text-xs text-slate-400">{currentOdds.yesPercent}%</div>
                      </div>
                      <div className="flex items-center text-slate-300">|</div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase">NO</div>
                        <div className="font-mono font-bold text-rose-600">
                          {formatMultiplier(currentOdds.noMultiplier)}
                        </div>
                        <div className="text-xs text-slate-400">{currentOdds.noPercent}%</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      Enter an amount to see your potential payout
                    </p>
                  </div>
                )}

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
                    Connect your wallet using the button in the header to place a bet.
                  </p>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleBet}
                  disabled={!account || isPending}
                  className={cn(
                    'w-full py-4 rounded-xl font-semibold text-white transition-all',
                    'flex items-center justify-center gap-2',
                    isYes
                      ? 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300'
                      : 'bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300',
                    isPending && 'cursor-not-allowed'
                  )}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>Place {amount} FLR on {isYes ? 'YES' : 'NO'}</>
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

