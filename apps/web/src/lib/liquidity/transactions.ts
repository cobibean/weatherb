import { randomUUID } from 'node:crypto';
import {
  decodeEventLog, encodeFunctionData, keccak256, parseTransaction, recoverTransactionAddress, TransactionNotFoundError,
  TransactionReceiptNotFoundError, type Hex, type PublicClient, type TransactionReceipt, type TransactionSerialized,
} from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import type { LiquidityOperation, LiquidityPosition, LiquidityTransaction } from '@prisma/client';
import { ARC_TESTNET } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import prisma from '@/lib/prisma';
import { redactError } from '@/lib/cron/worker-run';
import { readMarket } from '@/lib/cron/market-state';
import { raiseLiquidityIncident, recordLiquidityActivity, resolveLiquidityIncident, resolveTerminalSeedNotices } from './events';
import type { LiquidityIdentity } from './types';

export type LiquidityTransactionContext = {
  client: PublicClient;
  account: PrivateKeyAccount;
  identity: LiquidityIdentity;
  leaseId: string;
  holder: string;
};

const UNRESOLVED = ['PREPARED', 'SUBMITTED', 'UNKNOWN'] as const;

export class LiquidityFundingError extends Error {
  constructor() { super('Maker wallet cannot cover transaction value and maximum gas fee'); }
}

export function isLiquidityFundingError(error: unknown): boolean {
  return error instanceof LiquidityFundingError || /insufficient funds/i.test(error instanceof Error ? error.message : String(error));
}

async function assertLease(ctx: LiquidityTransactionContext): Promise<void> {
  const row = await prisma.workerLease.findUnique({ where: { id: ctx.leaseId } });
  if (!row || row.holder !== ctx.holder || row.expiresAt <= new Date()) throw new Error('Liquidity lease expired before broadcast');
}

function receiptEvent(receipt: TransactionReceipt, ctx: LiquidityTransactionContext, position: LiquidityPosition, operation: LiquidityOperation): bigint {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ctx.identity.contractAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: WEATHER_MARKET_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === 'BetPlaced' && operation !== 'CLAIM') {
        const args = decoded.args as { marketId: bigint; bettor: Hex; isYes: boolean; amount: bigint };
        if (args.marketId === BigInt(position.contractMarketId) && args.bettor.toLowerCase() === ctx.identity.walletAddress.toLowerCase() && args.isYes === (operation === 'YES_SEED')) return args.amount;
      }
      if ((decoded.eventName === 'WinningsClaimed' || decoded.eventName === 'Refunded') && operation === 'CLAIM') {
        const args = decoded.args as { marketId: bigint; claimer?: Hex; bettor?: Hex; amount: bigint };
        if (args.marketId === BigInt(position.contractMarketId) && (args.claimer ?? args.bettor)?.toLowerCase() === ctx.identity.walletAddress.toLowerCase()) return args.amount;
      }
    } catch { /* Another contract event. */ }
  }
  throw new Error('Receipt lacks matching market-maker event');
}

async function receiptOrNull(client: PublicClient, hash: Hex): Promise<TransactionReceipt | null> {
  try { return await client.getTransactionReceipt({ hash }); }
  catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return null;
    throw error;
  }
}

/** A successful receipt is counted once, only after the matching event and on-chain position agree. */
export async function reconcileTransaction(ctx: LiquidityTransactionContext, transaction: LiquidityTransaction): Promise<'confirmed' | 'reverted' | 'pending' | 'unknown'> {
  const position = await prisma.liquidityPosition.findUniqueOrThrow({ where: { id: transaction.positionId } });
  const receipt = await receiptOrNull(ctx.client, transaction.transactionHash as Hex);
  if (receipt) {
    if (receipt.from.toLowerCase() !== ctx.identity.walletAddress.toLowerCase()) throw new Error('Receipt sender mismatch');
    if (receipt.to?.toLowerCase() !== ctx.identity.contractAddress.toLowerCase()) throw new Error('Receipt destination mismatch');
    const gas = receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n);
    if (receipt.status === 'reverted') {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.liquidityTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
        if (fresh.status === 'REVERTED') return;
        await tx.liquidityTransaction.update({ where: { id: transaction.id }, data: {
          status: 'REVERTED', receiptBlockNumber: receipt.blockNumber, receiptBlockHash: receipt.blockHash,
          receiptStatus: 'reverted', gasSpentWei: gas.toString(), errorCode: 'REVERTED',
        } });
        await tx.liquidityPosition.update({ where: { id: position.id }, data: { gasSpentWei: (BigInt(position.gasSpentWei) + gas).toString(), lastErrorCode: 'REVERTED', lastTransactionStatus: 'REVERTED' } });
      });
      await recordLiquidityActivity({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id, contractMarketId: position.contractMarketId, transactionHash: transaction.transactionHash, code: 'liquidity-transaction-reverted', severity: 'WARNING', message: 'Maker transaction reverted; eligibility must be rechecked before a new attempt.' });
      await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-transaction-pending', position.contractMarketId, transaction.operation,
        'Maker transaction reverted; the nonce can be reconsidered only after eligibility is rechecked.');
      await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-transaction-unknown', position.contractMarketId, transaction.operation,
        'The saved transaction produced a reverted receipt; no maker stake or payout was counted.');
      return 'reverted';
    }
    const amount = receiptEvent(receipt, ctx, position, transaction.operation);
    if (transaction.operation !== 'CLAIM' && amount !== BigInt(transaction.valueWei)) throw new Error('Bet event amount differs from signed value');
    const chainPosition = await ctx.client.readContract({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI,
      functionName: 'getPosition', args: [BigInt(position.contractMarketId), ctx.identity.walletAddress], blockNumber: receipt.blockNumber });
    if (transaction.operation === 'YES_SEED' && chainPosition.yesAmount < amount) throw new Error('Receipt position lacks YES stake');
    if (transaction.operation === 'NO_SEED' && chainPosition.noAmount < amount) throw new Error('Receipt position lacks NO stake');
    if (transaction.operation === 'CLAIM' && !chainPosition.claimed) throw new Error('Receipt position is not claimed');
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.liquidityTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
      if (fresh.status === 'CONFIRMED') return;
      const current = await tx.liquidityPosition.findUniqueOrThrow({ where: { id: position.id } });
      const yes = BigInt(current.confirmedYesWei) + (transaction.operation === 'YES_SEED' ? amount : 0n);
      const no = BigInt(current.confirmedNoWei) + (transaction.operation === 'NO_SEED' ? amount : 0n);
      await tx.liquidityTransaction.update({ where: { id: transaction.id }, data: {
        status: 'CONFIRMED', receiptBlockNumber: receipt.blockNumber, receiptBlockHash: receipt.blockHash,
        receiptStatus: 'success', confirmedAmountWei: amount.toString(), gasSpentWei: gas.toString(),
      } });
      await tx.liquidityPosition.update({ where: { id: position.id }, data: {
        confirmedYesWei: yes.toString(), confirmedNoWei: no.toString(),
        claimedAmountWei: transaction.operation === 'CLAIM' ? amount.toString() : current.claimedAmountWei,
        claimableWei: transaction.operation === 'CLAIM' ? '0' : current.claimableWei,
        gasSpentWei: (BigInt(current.gasSpentWei) + gas).toString(),
        seedStatus: transaction.operation === 'CLAIM' ? current.seedStatus : yes > 0n && no > 0n ? 'SEEDED' : 'PARTIAL',
        claimStatus: transaction.operation === 'CLAIM' ? 'CLAIMED' : current.claimStatus,
        slotHeld: transaction.operation !== 'CLAIM',
        firstSeededAt: current.firstSeededAt ?? (transaction.operation === 'CLAIM' ? null : new Date()),
        claimedAt: transaction.operation === 'CLAIM' ? new Date() : current.claimedAt,
        completedAt: transaction.operation === 'CLAIM' ? new Date() : current.completedAt,
        lastError: null, lastErrorCode: null, waitReason: null,
        lastTransactionStatus: 'CONFIRMED',
      } });
      await tx.liquidityEvent.create({ data: { deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
        contractMarketId: position.contractMarketId, transactionHash: transaction.transactionHash,
        code: transaction.operation === 'CLAIM' ? 'liquidity-claim-confirmed' : 'liquidity-seed-confirmed',
        severity: 'INFO', message: `${transaction.operation} confirmed for market ${position.contractMarketId}; amount ${amount}.`,
      } });
    });
    if (transaction.operation === 'NO_SEED') await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-partial-seed', position.contractMarketId);
    if (transaction.operation === 'CLAIM') {
      await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-claim-gas-required', position.contractMarketId, 'CLAIM');
      await resolveTerminalSeedNotices(ctx.identity.deploymentKey, position.contractMarketId);
    }
    await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-transaction-pending', position.contractMarketId, transaction.operation);
    await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-transaction-unknown', position.contractMarketId, transaction.operation);
    return 'confirmed';
  }
  let known = false;
  try { known = !!(await ctx.client.getTransaction({ hash: transaction.transactionHash as Hex })); }
  catch (error) { if (!(error instanceof TransactionNotFoundError)) throw error; }
  const latestNonce = await ctx.client.getTransactionCount({ address: ctx.identity.walletAddress, blockTag: 'latest' });
  if (!known && latestNonce > transaction.nonce) {
    await prisma.liquidityTransaction.update({ where: { id: transaction.id }, data: { status: 'UNKNOWN', errorCode: 'NONCE_CONSUMED' } });
    await prisma.liquidityPosition.update({ where: { id: position.id }, data: { lastTransactionStatus: 'UNKNOWN' } });
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
      contractMarketId: position.contractMarketId, code: 'liquidity-transaction-unknown', severity: 'CRITICAL', action: transaction.operation,
      message: `Maker nonce ${transaction.nonce} was consumed without a matching receipt for ${transaction.transactionHash}. Investigate before more writes.` });
    return 'unknown';
  }
  if (Date.now() - transaction.preparedAt.getTime() > 360_000)
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
      contractMarketId: position.contractMarketId, code: 'liquidity-transaction-pending', severity: 'WARNING', action: transaction.operation,
      message: known ? `Maker nonce ${transaction.nonce} remains pending at ${transaction.transactionHash}.`
        : `Maker nonce ${transaction.nonce} remains unresolved; ${transaction.transactionHash} is not currently found. The saved signed bytes are retained for identical-byte retry.` });
  if (known) {
    return 'pending';
  }
  // Only saved bytes may be retried. A paused or expired seed cannot be rebroadcast.
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  const market = await readMarket(ctx.client, ctx.identity.contractAddress, BigInt(position.contractMarketId));
  const block = await ctx.client.getBlock();
  const expired = transaction.operation !== 'CLAIM' && (market.status !== 0 || block.timestamp >= market.bettingDeadline - 60n);
  if (expired) {
    await prisma.liquidityTransaction.update({ where: { id: transaction.id }, data: { status: 'UNKNOWN', errorCode: 'EXPIRED_SEED_NONCE' } });
    await prisma.liquidityPosition.update({ where: { id: position.id }, data: { lastTransactionStatus: 'UNKNOWN' } });
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
      contractMarketId: position.contractMarketId, code: 'liquidity-transaction-unknown', severity: 'CRITICAL', action: transaction.operation,
      message: `Seed nonce ${transaction.nonce} expired before its outcome was proved. Investigate the saved hash.` });
    await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-transaction-pending', position.contractMarketId, transaction.operation,
      'The seed deadline passed without a proved receipt; the nonce now requires operator recovery.');
    return 'unknown';
  }
  if ((transaction.operation === 'CLAIM' && !config.claimsEnabled) || (transaction.operation !== 'CLAIM' && !config.seedingEnabled)) return 'pending';
  await broadcastSavedTransaction(ctx, transaction);
  return 'pending';
}

/** Persist signed bytes and hash before the first broadcast; a DB failure stops all writes. */
export async function prepareLiquidityTransaction(ctx: LiquidityTransactionContext, position: LiquidityPosition, operation: LiquidityOperation, value: bigint): Promise<LiquidityTransaction> {
  if (ctx.account.address.toLowerCase() !== ctx.identity.walletAddress.toLowerCase()) throw new Error('Market-maker signer mismatch');
  const unresolved = await prisma.liquidityTransaction.findFirst({ where: { deploymentKey: ctx.identity.deploymentKey, signerAddress: ctx.identity.walletAddress.toLowerCase(), status: { in: [...UNRESOLVED] } } });
  if (unresolved) throw new Error('Unresolved maker nonce blocks new signing');
  const data = operation === 'CLAIM'
    ? encodeFunctionData({ abi: WEATHER_MARKET_ABI, functionName: 'claim', args: [BigInt(position.contractMarketId)] })
    : encodeFunctionData({ abi: WEATHER_MARKET_ABI, functionName: 'placeBet', args: [BigInt(position.contractMarketId), operation === 'YES_SEED'] });
  const nonce = await ctx.client.getTransactionCount({ address: ctx.identity.walletAddress, blockTag: 'pending' });
  let gas: bigint;
  try { gas = await ctx.client.estimateGas({ account: ctx.identity.walletAddress, to: ctx.identity.contractAddress, data, value }); }
  catch (error) { if (isLiquidityFundingError(error)) throw new LiquidityFundingError(); throw error; }
  const fees = await ctx.client.estimateFeesPerGas();
  if (fees.maxFeePerGas === undefined || fees.maxPriorityFeePerGas === undefined) throw new Error('EIP-1559 fees unavailable');
  const gasLimit = gas * 120n / 100n;
  if (await ctx.client.getBalance({ address: ctx.identity.walletAddress }) < value + gasLimit * fees.maxFeePerGas)
    throw new LiquidityFundingError();
  const signedTransaction = await ctx.account.signTransaction({
    type: 'eip1559', chainId: ARC_TESTNET.id, nonce, to: ctx.identity.contractAddress,
    data, value, gas: gasLimit, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const hash = keccak256(signedTransaction);
  const attempt = await prisma.liquidityTransaction.count({ where: { positionId: position.id, operation } }) + 1;
  return prisma.$transaction(async (tx) => {
    const saved = await tx.liquidityTransaction.create({ data: {
      id: randomUUID(), positionId: position.id, operation, attempt, deploymentKey: ctx.identity.deploymentKey,
      signerAddress: ctx.identity.walletAddress.toLowerCase(), nonce, toAddress: ctx.identity.contractAddress.toLowerCase(),
      calldata: data, valueWei: value.toString(), gasLimitWei: gasLimit.toString(),
      maxFeePerGasWei: fees.maxFeePerGas.toString(), maxPriorityFeePerGasWei: fees.maxPriorityFeePerGas.toString(),
      signedTransaction, transactionHash: hash,
    } });
    await tx.liquidityPosition.update({ where: { id: position.id }, data: {
      lastTransactionHash: hash, lastTransactionStatus: 'PREPARED', lastTransactionNonce: nonce,
      lastTransactionOperation: operation,
    } });
    return saved;
  });
}

export async function broadcastSavedTransaction(ctx: LiquidityTransactionContext, transaction: LiquidityTransaction): Promise<void> {
  if (ctx.account.address.toLowerCase() !== ctx.identity.walletAddress.toLowerCase() || transaction.signerAddress.toLowerCase() !== ctx.identity.walletAddress.toLowerCase())
    throw new Error('Saved transaction signer mismatch');
  const raw = transaction.signedTransaction as Hex;
  const envelope = parseTransaction(raw);
  if (keccak256(raw).toLowerCase() !== transaction.transactionHash.toLowerCase() ||
      (await recoverTransactionAddress({ serializedTransaction: raw as TransactionSerialized })).toLowerCase() !== ctx.identity.walletAddress.toLowerCase() ||
      envelope.chainId !== ARC_TESTNET.id || envelope.nonce !== transaction.nonce ||
      envelope.to?.toLowerCase() !== ctx.identity.contractAddress.toLowerCase() ||
      envelope.data?.toLowerCase() !== transaction.calldata.toLowerCase() ||
      (envelope.value ?? 0n) !== BigInt(transaction.valueWei)) throw new Error('Saved transaction envelope mismatch');
  await assertLease(ctx);
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  if (transaction.operation === 'CLAIM' ? !config.claimsEnabled : !config.seedingEnabled) return;
  const position = await prisma.liquidityPosition.findUniqueOrThrow({ where: { id: transaction.positionId } });
  const market = await readMarket(ctx.client, ctx.identity.contractAddress, BigInt(position.contractMarketId));
  const paused = await ctx.client.readContract({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'isPaused' });
  if (paused) return;
  if (transaction.operation === 'CLAIM') {
    if (market.status < 2) return;
    const chainPosition = await ctx.client.readContract({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI,
      functionName: 'getPosition', args: [BigInt(position.contractMarketId), ctx.identity.walletAddress] });
    if (chainPosition.claimed) return;
  } else {
    const block = await ctx.client.getBlock();
    if (market.status !== 0 || block.timestamp >= market.bettingDeadline - 60n) return;
  }
  try {
    await ctx.client.sendRawTransaction({ serializedTransaction: raw });
    await prisma.liquidityTransaction.update({ where: { id: transaction.id }, data: { status: 'SUBMITTED', firstBroadcastAt: transaction.firstBroadcastAt ?? new Date(), lastBroadcastAt: new Date() } });
    await prisma.liquidityPosition.update({ where: { id: position.id }, data: { lastTransactionStatus: 'SUBMITTED' } });
  } catch (error) {
    // The RPC may have accepted the bytes before the timeout. Never generate another nonce.
    await prisma.liquidityTransaction.update({ where: { id: transaction.id }, data: { status: 'UNKNOWN', errorCode: 'BROADCAST_UNCERTAIN', lastError: redactError(error) } }).catch(() => {});
    await prisma.liquidityPosition.update({ where: { id: position.id }, data: { lastTransactionStatus: 'UNKNOWN' } }).catch(() => {});
  }
}

export async function executeLiquidityOperation(ctx: LiquidityTransactionContext, position: LiquidityPosition, operation: LiquidityOperation, value: bigint): Promise<LiquidityTransaction> {
  const transaction = await prepareLiquidityTransaction(ctx, position, operation, value);
  await broadcastSavedTransaction(ctx, transaction);
  return transaction;
}

export async function reconcileUnresolved(ctx: LiquidityTransactionContext): Promise<'clear' | 'pending' | 'unknown'> {
  const transaction = await prisma.liquidityTransaction.findFirst({ where: { deploymentKey: ctx.identity.deploymentKey,
    signerAddress: ctx.identity.walletAddress.toLowerCase(), status: { in: [...UNRESOLVED] } }, orderBy: { preparedAt: 'asc' } });
  if (!transaction) return 'clear';
  const outcome = await reconcileTransaction(ctx, transaction);
  return outcome === 'confirmed' || outcome === 'reverted' ? 'clear' : outcome;
}
