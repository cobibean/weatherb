import type { LiquidityPosition } from '@prisma/client';
import { decodeEventLog, type Hex } from 'viem';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import prisma from '@/lib/prisma';
import { readMarket } from '@/lib/cron/market-state';
import { finishNoPayout } from './positions';
import { raiseLiquidityIncident, resolveLiquidityIncident, resolveTerminalSeedNotices } from './events';
import { executeLiquidityOperation, isLiquidityFundingError, reconcileTransaction, type LiquidityTransactionContext } from './transactions';

async function claimGasRequired(ctx: LiquidityTransactionContext, position: LiquidityPosition): Promise<'blocked'> {
  await prisma.liquidityPosition.update({ where: { id: position.id }, data: { claimStatus: 'CLAIMABLE', lastErrorCode: 'CLAIM_GAS_REQUIRED' } });
  await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
    contractMarketId: position.contractMarketId, code: 'liquidity-claim-gas-required', severity: 'WARNING', action: 'CLAIM', message: `Maker wallet needs native USDC gas to claim market ${position.contractMarketId}.` });
  return 'blocked';
}

/** Recover a chain-claimed position only from a matching, successful payout/refund receipt. */
async function recoverAlreadyClaimed(ctx: LiquidityTransactionContext, position: LiquidityPosition, head: bigint): Promise<'claimed' | 'blocked'> {
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  const fromBlock = position.claimRecoveryCursor ?? config.activationBlockNumber ?? 0n;
  if (fromBlock <= head) {
    const toBlock = fromBlock + 1999n < head ? fromBlock + 1999n : head;
    const logs = await ctx.client.getLogs({ address: ctx.identity.contractAddress, fromBlock, toBlock });
    for (const log of logs) {
      let decoded;
      try { decoded = decodeEventLog({ abi: WEATHER_MARKET_ABI, data: log.data, topics: log.topics }); }
      catch { continue; }
      if (decoded.eventName !== 'WinningsClaimed' && decoded.eventName !== 'Refunded') continue;
      const args = decoded.args as { marketId: bigint; claimer?: Hex; bettor?: Hex; amount: bigint };
      if (args.marketId !== BigInt(position.contractMarketId) ||
          (args.claimer ?? args.bettor)?.toLowerCase() !== ctx.identity.walletAddress.toLowerCase() || !log.transactionHash) continue;
      const receipt = await ctx.client.getTransactionReceipt({ hash: log.transactionHash });
      if (receipt.status !== 'success' || receipt.from.toLowerCase() !== ctx.identity.walletAddress.toLowerCase() ||
          receipt.to?.toLowerCase() !== ctx.identity.contractAddress.toLowerCase() ||
          !receipt.logs.some((item) => item.logIndex === log.logIndex && item.address.toLowerCase() === log.address.toLowerCase())) continue;
      const gas = receipt.gasUsed * (receipt.effectiveGasPrice ?? 0n);
      await prisma.$transaction(async (tx) => {
        const current = await tx.liquidityPosition.findUniqueOrThrow({ where: { id: position.id } });
        if (current.claimStatus === 'CLAIMED') return;
        await tx.liquidityPosition.update({ where: { id: position.id }, data: {
          claimedAmountWei: args.amount.toString(), claimableWei: '0', gasSpentWei: (BigInt(current.gasSpentWei) + gas).toString(),
          claimStatus: 'CLAIMED', slotHeld: false, completedAt: new Date(), claimedAt: new Date(), lastCheckedBlock: receipt.blockNumber,
          lastTransactionHash: log.transactionHash, lastTransactionStatus: 'CONFIRMED', lastTransactionOperation: 'CLAIM',
          lastError: null, lastErrorCode: null,
        } });
        await tx.liquidityEvent.create({ data: { deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(),
          positionId: position.id, contractMarketId: position.contractMarketId, transactionHash: log.transactionHash,
          code: 'liquidity-claim-recovered', severity: 'INFO', message: `Verified an already-claimed payout/refund of ${args.amount} base units for market ${position.contractMarketId}.`,
        } });
      });
      await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-claim-evidence-missing', position.contractMarketId, 'CLAIM');
      await resolveTerminalSeedNotices(ctx.identity.deploymentKey, position.contractMarketId);
      return 'claimed';
    }
    await prisma.liquidityPosition.update({ where: { id: position.id }, data: { claimRecoveryCursor: toBlock + 1n,
      claimStatus: 'ATTENTION', lastErrorCode: 'CLAIM_EVIDENCE_MISSING' } });
  }
  await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
    contractMarketId: position.contractMarketId, code: 'liquidity-claim-evidence-missing', severity: 'CRITICAL', action: 'CLAIM',
    message: `Chain reports market ${position.contractMarketId} already claimed, but the matching payout/refund receipt has not yet been verified. Keep the slot held and inspect wallet history.` });
  return 'blocked';
}

export async function processLiquidityClaim(ctx: LiquidityTransactionContext, position: LiquidityPosition): Promise<'waiting' | 'claimed' | 'no_payout' | 'blocked' | 'in_flight'> {
  const id = BigInt(position.contractMarketId);
  const market = await readMarket(ctx.client, ctx.identity.contractAddress, id);
  const block = await ctx.client.getBlockNumber();
  if (market.status < 2) return 'waiting';
  const chainPosition = await ctx.client.readContract({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI,
    functionName: 'getPosition', args: [id, ctx.identity.walletAddress], blockNumber: block });
  if (chainPosition.yesAmount !== BigInt(position.confirmedYesWei) || chainPosition.noAmount !== BigInt(position.confirmedNoWei)) {
    await prisma.liquidityPosition.update({ where: { id: position.id }, data: { claimStatus: 'ATTENTION', seedStatus: 'ATTENTION', lastErrorCode: 'POSITION_MISMATCH' } });
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
      contractMarketId: position.contractMarketId, code: 'liquidity-transaction-unknown', severity: 'CRITICAL', action: 'POSITION', message: 'Maker chain position does not match verified receipts.' });
    return 'blocked';
  }
  if (chainPosition.claimed) {
    const known = await prisma.liquidityTransaction.findFirst({ where: { positionId: position.id, operation: 'CLAIM', status: 'CONFIRMED' } });
    if (known) {
      await prisma.liquidityPosition.update({ where: { id: position.id }, data: { claimStatus: 'CLAIMED', slotHeld: false, completedAt: position.completedAt ?? new Date() } });
      await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-claim-gas-required', position.contractMarketId, 'CLAIM');
      await resolveTerminalSeedNotices(ctx.identity.deploymentKey, position.contractMarketId);
      return 'claimed';
    }
    return recoverAlreadyClaimed(ctx, position, block);
  }
  if (market.status === 2) {
    const winningStake = market.outcome ? chainPosition.yesAmount : chainPosition.noAmount;
    if (winningStake === 0n) {
      await finishNoPayout(position.id, block);
      await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-claim-gas-required', position.contractMarketId, 'CLAIM');
      await resolveTerminalSeedNotices(ctx.identity.deploymentKey, position.contractMarketId);
      return 'no_payout';
    }
  }
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  if (!config.claimsEnabled) return 'waiting';
  const paused = await ctx.client.readContract({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'isPaused' });
  if (paused) {
    await raiseLiquidityIncident({ deploymentKey: ctx.identity.deploymentKey, walletAddress: ctx.identity.walletAddress.toLowerCase(), positionId: position.id,
      contractMarketId: position.contractMarketId, code: 'liquidity-contract-paused', severity: 'WARNING', action: 'CLAIM', message: 'Contract pause prevents maker claim.' });
    return 'blocked';
  }
  await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-contract-paused', position.contractMarketId, 'CLAIM');
  const payout = await ctx.client.readContract({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI,
    functionName: 'calculatePayout', args: [id, ctx.identity.walletAddress], blockNumber: block });
  await prisma.liquidityPosition.update({ where: { id: position.id }, data: { claimableWei: payout.toString(), lastCheckedBlock: block } });
  if (payout === 0n) {
    await finishNoPayout(position.id, block);
    await resolveLiquidityIncident(ctx.identity.deploymentKey, 'liquidity-claim-gas-required', position.contractMarketId, 'CLAIM');
    await resolveTerminalSeedNotices(ctx.identity.deploymentKey, position.contractMarketId);
    return 'no_payout';
  }
  const balance = await ctx.client.getBalance({ address: ctx.identity.walletAddress });
  const fees = await ctx.client.estimateFeesPerGas();
  let gas: bigint;
  try { gas = await ctx.client.estimateContractGas({ address: ctx.identity.contractAddress, abi: WEATHER_MARKET_ABI,
    functionName: 'claim', args: [id], account: ctx.identity.walletAddress }); }
  catch (error) { if (isLiquidityFundingError(error)) return claimGasRequired(ctx, position); throw error; }
  if (fees.maxFeePerGas === undefined || balance < gas * 120n / 100n * fees.maxFeePerGas) return claimGasRequired(ctx, position);
  await prisma.liquidityPosition.update({ where: { id: position.id }, data: { claimStatus: 'IN_FLIGHT', lastAttemptAt: new Date() } });
  let transaction;
  try { transaction = await executeLiquidityOperation(ctx, position, 'CLAIM', 0n); }
  catch (error) { if (isLiquidityFundingError(error)) return claimGasRequired(ctx, position); throw error; }
  try { await ctx.client.waitForTransactionReceipt({ hash: transaction.transactionHash as `0x${string}`, timeout: 10_000 }); } catch { /* Journal owns the retry. */ }
  const status = await reconcileTransaction(ctx, await prisma.liquidityTransaction.findUniqueOrThrow({ where: { id: transaction.id } }));
  return status === 'confirmed' ? 'claimed' : 'in_flight';
}
