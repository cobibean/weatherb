#!/usr/bin/env npx tsx
/**
 * Test the transaction handler by placing a small test bet
 *
 * Usage: MARKET_ID=123 npx tsx src/scripts/test-transaction.ts
 */

import { parseEther } from 'viem';
import { initializeWalletManager, getWalletStats } from '../wallet-manager.js';
import { initializeMarketMonitor, getMarket, getOpenMarkets } from '../market-monitor.js';
import { placeBet, getTransactionStats } from '../transaction.js';
import { prisma } from '../db.js';

async function main() {
  console.log('Transaction Handler Test');
  console.log('========================\n');

  await initializeWalletManager();
  await initializeMarketMonitor();

  let marketId: bigint;
  const envMarketId = process.env.MARKET_ID;

  if (envMarketId) {
    marketId = BigInt(envMarketId);
    console.log(`Using specified market #${marketId}`);
  } else {
    const openMarkets = getOpenMarkets();
    if (openMarkets.length === 0) {
      console.error('No open markets available for testing');
      process.exit(1);
    }
    marketId = openMarkets[0].id;
    console.log(`Using first open market #${marketId}`);
  }

  const market = await getMarket(marketId);
  const yesPool = Number(market.yesPool) / 1e18;
  const noPool = Number(market.noPool) / 1e18;

  console.log(`\nMarket #${marketId}:`);
  console.log(`  YES Pool: ${yesPool.toFixed(2)} FLR`);
  console.log(`  NO Pool: ${noPool.toFixed(2)} FLR`);
  console.log(`  Deadline: ${new Date(market.bettingDeadline * 1000).toISOString()}`);

  const walletStats = await getWalletStats();
  console.log('\nWallet Stats:');
  console.log(`  Active: ${walletStats.active}`);
  console.log(`  Treasury: ${walletStats.treasuryBalance} FLR`);

  if (walletStats.active === 0) {
    console.error('\nNo active wallets available!');
    process.exit(1);
  }

  console.log('\nPlacing test bet...');
  const betAmount = parseEther('0.5');

  const result = await placeBet({
    marketId,
    isYes: true,
    amount: betAmount,
    strategy: 'new_market',
    poolRatioBefore:
      yesPool > 0 || noPool > 0
        ? Math.max(yesPool, noPool) / Math.max(Math.min(yesPool, noPool), 0.001)
        : 1,
  });

  console.log('\nResult:');
  console.log(`  Success: ${result.success}`);
  if (result.txHash) {
    console.log(`  TX Hash: ${result.txHash}`);
  }
  if (result.gasUsed) {
    console.log(`  Gas Used: ${result.gasUsed}`);
  }
  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }
  console.log(`  Retry Count: ${result.retryCount}`);

  const txStats = await getTransactionStats();
  console.log('\nTransaction Stats (24h):');
  console.log(`  Total: ${txStats.last24h.total}`);
  console.log(`  Successful: ${txStats.last24h.successful}`);
  console.log(`  Failed: ${txStats.last24h.failed}`);

  console.log('\n✅ Transaction handler test complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
