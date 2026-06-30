import { type Hex, formatEther } from 'viem';
import { publicClient } from './clients.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { getNextWallet, recordBet, createClientForWallet } from './wallet-manager.js';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import type { BetRequest, BetResult } from './types.js';

const CONTRACT_ADDRESS = config.contractAddress as Hex;

const MAX_RETRIES = 3;
const BACKOFF_MS = [5000, 10000, 20000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  const message = String(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('econnreset') ||
    message.includes('nonce') ||
    message.includes('replacement transaction underpriced') ||
    message.includes('already known')
  );
}

function isSkippableError(error: unknown): boolean {
  const message = String(error).toLowerCase();
  return (
    message.includes('insufficient funds') ||
    message.includes('betting closed') ||
    message.includes('market not open') ||
    message.includes('execution reverted') ||
    message.includes('deadline') ||
    message.includes('below minimum')
  );
}

async function logError(
  errorType: string,
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.botError.create({
      data: {
        errorType,
        errorMessage: String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
        context: context ? JSON.parse(JSON.stringify(context)) : undefined,
      },
    });
  } catch (logErr) {
    console.error('[Transaction] Failed to log error:', logErr);
  }
}

async function logBet(
  walletId: string,
  request: BetRequest,
  txHash: string,
  gasUsed?: bigint
): Promise<void> {
  await prisma.botBet.create({
    data: {
      walletId,
      marketId: request.marketId,
      betSide: request.isYes ? 'YES' : 'NO',
      amountFlr: Number(formatEther(request.amount)),
      txHash,
      gasUsed: gasUsed ?? null,
      strategy: request.strategy,
      poolRatioBefore: request.poolRatioBefore ?? null,
    },
  });

  await recordBet(walletId, Number(formatEther(request.amount)));
}

export async function placeBet(request: BetRequest): Promise<BetResult> {
  const { marketId, isYes, amount } = request;

  console.log(
    `[Transaction] Placing ${isYes ? 'YES' : 'NO'} bet of ${formatEther(amount)} FLR on market #${marketId}`
  );

  const wallet = await getNextWallet();
  if (!wallet) {
    const error = 'No wallets available';
    console.error(`[Transaction] ${error}`);
    await logError('transaction', error, { marketId: marketId.toString() });
    return { success: false, error, retryCount: 0 };
  }

  const walletClient = createClientForWallet(wallet);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`[Transaction] Attempt ${attempt + 1}/${MAX_RETRIES} with wallet ${wallet.address}`);

      const { request: contractRequest } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'placeBet',
        args: [marketId, isYes],
        value: amount,
        account: walletClient.account,
      });

      const txHash = await walletClient.writeContract(contractRequest);
      console.log(`[Transaction] TX submitted: ${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 60_000,
      });

      if (receipt.status === 'success') {
        console.log(
          `[Transaction] ✅ Bet confirmed in block ${receipt.blockNumber}, gas: ${receipt.gasUsed}`
        );

        await logBet(wallet.id, request, txHash, receipt.gasUsed);

        return {
          success: true,
          txHash,
          gasUsed: receipt.gasUsed,
          retryCount: attempt,
        };
      }

      const error = `Transaction reverted: ${txHash}`;
      console.error(`[Transaction] ${error}`);
      await logError('transaction', error, {
        marketId: marketId.toString(),
        wallet: wallet.address,
        txHash,
      });

      return { success: false, error, retryCount: attempt };
    } catch (error) {
      console.error(`[Transaction] Attempt ${attempt + 1} failed:`, error);

      if (isSkippableError(error)) {
        console.log('[Transaction] Skipping bet due to non-retryable error');
        await logError('transaction', error, {
          marketId: marketId.toString(),
          wallet: wallet.address,
          skipped: true,
        });
        return { success: false, error: String(error), retryCount: attempt };
      }

      if (isRetryableError(error) && attempt < MAX_RETRIES - 1) {
        const delay = BACKOFF_MS[attempt] || BACKOFF_MS[BACKOFF_MS.length - 1];
        console.log(`[Transaction] Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      await logError('transaction', error, {
        marketId: marketId.toString(),
        wallet: wallet.address,
        attempt,
      });

      return { success: false, error: String(error), retryCount: attempt };
    }
  }

  return { success: false, error: 'Max retries exceeded', retryCount: MAX_RETRIES };
}

export async function placeBets(requests: BetRequest[]): Promise<BetResult[]> {
  const results: BetResult[] = [];

  for (const request of requests) {
    const result = await placeBet(request);
    results.push(result);

    if (results.length < requests.length) {
      await sleep(1000);
    }
  }

  return results;
}

export async function getTransactionStats(): Promise<{
  last24h: { total: number; successful: number; failed: number };
  lastBet: Date | null;
}> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [bets, errors] = await Promise.all([
    prisma.botBet.count({
      where: { createdAt: { gte: oneDayAgo } },
    }),
    prisma.botError.count({
      where: {
        createdAt: { gte: oneDayAgo },
        errorType: 'transaction',
      },
    }),
  ]);

  const lastBet = await prisma.botBet.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return {
    last24h: {
      total: bets + errors,
      successful: bets,
      failed: errors,
    },
    lastBet: lastBet?.createdAt ?? null,
  };
}
