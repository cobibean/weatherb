#!/usr/bin/env npx tsx
/**
 * Test the rebalancer in isolation
 *
 * Usage: npx tsx src/scripts/test-rebalancer.ts
 * With immediate rebalance: TRIGGER_REBALANCE=true npx tsx src/scripts/test-rebalancer.ts
 */

import { initializeWalletManager, getWalletStats } from '../wallet-manager.js';
import { initializeMarketMonitor, getOpenMarkets } from '../market-monitor.js';
import {
  rebalanceOpenMarkets,
  checkAndSeedNewMarkets,
  getRebalancerStats,
  getNextRebalanceInterval,
} from '../rebalancer.js';
import { prisma } from '../db.js';
import { formatEther } from 'viem';

async function main() {
  console.log('Rebalancer Test');
  console.log('===============\n');

  // Initialize dependencies
  console.log('Initializing wallet manager...');
  await initializeWalletManager();

  console.log('Initializing market monitor...');
  await initializeMarketMonitor();

  // Show current state
  const walletStats = await getWalletStats();
  console.log(`\nWallet Stats:`);
  console.log(`  Active: ${walletStats.active}`);
  console.log(`  Treasury: ${walletStats.treasuryBalance} FLR`);

  const openMarkets = getOpenMarkets();
  console.log(`\nOpen Markets: ${openMarkets.length}`);

  for (const market of openMarkets.slice(0, 5)) {
    const yesFlr = Number(market.yesPool) / 1e18;
    const noFlr = Number(market.noPool) / 1e18;
    const minPool = Math.min(yesFlr, noFlr);
    const maxPool = Math.max(yesFlr, noFlr);
    const ratio = minPool > 0 ? maxPool / minPool : (yesFlr === 0 && noFlr === 0 ? 1 : 999);

    const needsRebalance = ratio > 1.3;
    const status = needsRebalance ? '!! IMBALANCED' : '   BALANCED';

    console.log(`  Market #${market.id}: YES=${yesFlr.toFixed(2)} NO=${noFlr.toFixed(2)} (${ratio.toFixed(2)}x) ${status}`);
  }

  if (openMarkets.length > 5) {
    console.log(`  ... and ${openMarkets.length - 5} more`);
  }

  // Show next rebalance timing
  const nextInterval = getNextRebalanceInterval();
  console.log(`\nNext rebalance would be in: ${Math.round(nextInterval / 1000)}s`);

  // Check for new markets
  console.log('\nChecking for new markets...');
  const newMarkets = await checkAndSeedNewMarkets();
  console.log(`  Found: ${newMarkets}`);

  // Optionally trigger immediate rebalance
  if (process.env.TRIGGER_REBALANCE === 'true') {
    console.log('\n--- TRIGGERING IMMEDIATE REBALANCE ---\n');
    const result = await rebalanceOpenMarkets();
    console.log(`\nRebalance Result:`);
    console.log(`  Markets Checked: ${result.marketsChecked}`);
    console.log(`  Bets Placed: ${result.betsPlaced}`);
    console.log(`  Total Spent: ${formatEther(result.totalSpent)} FLR`);
  } else {
    console.log('\n(Set TRIGGER_REBALANCE=true to actually place rebalancing bets)');
  }

  // Show rebalancer stats
  const rebalancerStats = await getRebalancerStats();
  console.log(`\nRebalancer Stats:`);
  console.log(`  Daily Spend: ${rebalancerStats.dailySpendFlr} FLR`);
  console.log(`  Daily Budget: ${rebalancerStats.dailyBudgetFlr} FLR`);
  console.log(`  Budget Used: ${rebalancerStats.budgetUsedPercent}%`);
  console.log(`  Bets Today: ${rebalancerStats.betsToday}`);

  console.log('\nRebalancer test complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
