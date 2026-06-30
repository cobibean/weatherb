#!/usr/bin/env npx tsx
/**
 * Full integration test - runs the bot briefly and validates all components
 *
 * Usage: npx tsx src/scripts/test-full-integration.ts
 */

import { formatEther } from 'viem';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { publicClient, getTreasuryBalance } from '../clients.js';
import { initializeMarketMonitor, getMonitorStats, getOpenMarkets } from '../market-monitor.js';
import { initializeWalletManager, getWalletStats, getNextWallet } from '../wallet-manager.js';
import { getTransactionStats } from '../transaction.js';
import { getRebalancerStats } from '../rebalancer.js';

const CHECK = '[PASS]';
const WARN = '[WARN]';
const FAIL = '[FAIL]';

async function runTests(): Promise<{ passed: number; warned: number; failed: number }> {
  let passed = 0;
  let warned = 0;
  let failed = 0;

  function pass(msg: string): void {
    console.log(`${CHECK} ${msg}`);
    passed++;
  }

  function warn(msg: string): void {
    console.log(`${WARN} ${msg}`);
    warned++;
  }

  function fail(msg: string): void {
    console.log(`${FAIL} ${msg}`);
    failed++;
  }

  console.log('Full Integration Test');
  console.log('=====================\n');

  // 1. Database Connection
  console.log('1. Database Connection');
  try {
    const count = await prisma.botWallet.count();
    if (count > 0) {
      pass(`Connected to database (${count} wallets)`);
    } else {
      fail('Database connected but no wallets found');
    }
  } catch (error) {
    fail(`Database connection failed: ${error}`);
  }

  // 2. RPC Connection
  console.log('\n2. RPC Connection');
  try {
    const blockNumber = await publicClient.getBlockNumber();
    pass(`RPC connected (block ${blockNumber})`);
  } catch (error) {
    fail(`RPC connection failed: ${error}`);
  }

  // 3. Treasury Balance
  console.log('\n3. Treasury Balance');
  try {
    const balance = await getTreasuryBalance();
    const balanceFlr = Number(formatEther(balance));

    if (balanceFlr >= config.lowTreasuryAlertFlr) {
      pass(`Treasury has ${balanceFlr.toFixed(2)} FLR`);
    } else if (balanceFlr > 0) {
      warn(`Treasury low: ${balanceFlr.toFixed(2)} FLR (threshold: ${config.lowTreasuryAlertFlr})`);
    } else {
      fail('Treasury is empty!');
    }
  } catch (error) {
    fail(`Treasury check failed: ${error}`);
  }

  // 4. Market Monitor
  console.log('\n4. Market Monitor');
  try {
    await initializeMarketMonitor();
    const stats = getMonitorStats();

    if (stats.totalCached > 0) {
      pass(`Cached ${stats.totalCached} markets (${stats.openMarkets} open)`);
    } else {
      warn('No markets found in contract');
    }
  } catch (error) {
    fail(`Market monitor failed: ${error}`);
  }

  // 5. Wallet Manager
  console.log('\n5. Wallet Manager');
  try {
    await initializeWalletManager();
    const stats = await getWalletStats();

    if (stats.active > 0) {
      pass(`${stats.active} active wallets ready`);
    } else if (stats.lowBalance > 0) {
      warn(`No active wallets (${stats.lowBalance} need funding)`);
    } else {
      fail('No wallets available');
    }
  } catch (error) {
    fail(`Wallet manager failed: ${error}`);
  }

  // 6. Wallet Selection
  console.log('\n6. Wallet Selection');
  try {
    const wallet = await getNextWallet();
    if (wallet) {
      pass(`Round-robin selection working (got ${wallet.address.slice(0, 10)}...)`);
    } else {
      warn('No wallet available for selection');
    }
  } catch (error) {
    fail(`Wallet selection failed: ${error}`);
  }

  // 7. Open Markets Check
  console.log('\n7. Open Markets');
  const openMarkets = getOpenMarkets();
  if (openMarkets.length > 0) {
    pass(`${openMarkets.length} markets available for betting`);

    // Show imbalance summary
    let imbalanced = 0;
    for (const m of openMarkets) {
      const yes = Number(m.yesPool);
      const no = Number(m.noPool);
      const min = Math.min(yes, no);
      const max = Math.max(yes, no);
      if (min > 0 && max / min > config.imbalanceThreshold) {
        imbalanced++;
      }
    }
    if (imbalanced > 0) {
      console.log(`   ${imbalanced} markets need rebalancing`);
    }
  } else {
    warn('No open markets available');
  }

  // 8. Transaction Stats
  console.log('\n8. Transaction Stats');
  try {
    const txStats = await getTransactionStats();
    pass(`Last 24h: ${txStats.last24h.successful} successful, ${txStats.last24h.failed} failed`);

    if (txStats.lastBet) {
      const ago = Math.round((Date.now() - txStats.lastBet.getTime()) / 1000 / 60);
      console.log(`   Last bet: ${ago} minutes ago`);
    }
  } catch (error) {
    fail(`Transaction stats failed: ${error}`);
  }

  // 9. Rebalancer Stats
  console.log('\n9. Rebalancer Stats');
  try {
    const stats = await getRebalancerStats();
    pass(`Daily spend: ${stats.dailySpendFlr} / ${stats.dailyBudgetFlr} FLR (${stats.budgetUsedPercent}%)`);
  } catch (error) {
    fail(`Rebalancer stats failed: ${error}`);
  }

  // 10. Dry Run Rebalance (optional)
  console.log('\n10. Dry Run Rebalance');
  if (process.env.DRY_RUN === 'true') {
    try {
      // Just check what would be rebalanced without placing bets
      const wouldRebalance = openMarkets.filter((m) => {
        const yes = Number(m.yesPool);
        const no = Number(m.noPool);
        const min = Math.min(yes, no);
        const max = Math.max(yes, no);
        return min > 0 && max / min > config.imbalanceThreshold;
      });
      pass(`Would rebalance ${wouldRebalance.length} markets`);
    } catch (error) {
      fail(`Dry run failed: ${error}`);
    }
  } else {
    console.log('   (skipped - set DRY_RUN=true to test)');
  }

  return { passed, warned, failed };
}

async function main(): Promise<void> {
  try {
    const { passed, warned, failed } = await runTests();

    console.log('\n=======================================');
    console.log(`Results: ${passed} passed, ${warned} warnings, ${failed} failed`);
    console.log('=======================================\n');

    if (failed > 0) {
      console.log('Integration test FAILED\n');
      process.exit(1);
    } else if (warned > 0) {
      console.log('Integration test PASSED with warnings\n');
      process.exit(0);
    } else {
      console.log('Integration test PASSED\n');
      process.exit(0);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
