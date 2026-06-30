#!/usr/bin/env npx tsx
/**
 * Test the market monitor in isolation
 *
 * Usage: npx tsx src/scripts/test-market-monitor.ts
 */

import {
  initializeMarketMonitor,
  pollForNewMarkets,
  getOpenMarkets,
  getMarketCount,
  getMonitorStats,
} from '../market-monitor.js';

async function main() {
  console.log('Market Monitor Test');
  console.log('===================\n');

  // Initialize
  await initializeMarketMonitor();

  // Show stats
  const stats = getMonitorStats();
  console.log('\nMonitor Stats:');
  console.log(`  Total cached: ${stats.totalCached}`);
  console.log(`  Open markets: ${stats.openMarkets}`);
  console.log(`  Last known count: ${stats.lastKnownCount}`);

  // Show open markets
  const openMarkets = getOpenMarkets();
  console.log('\nOpen Markets:');

  if (openMarkets.length === 0) {
    console.log('  (none)');
  } else {
    for (const market of openMarkets) {
      const deadline = new Date(market.bettingDeadline * 1000).toISOString();
      const yesPool = Number(market.yesPool) / 1e18;
      const noPool = Number(market.noPool) / 1e18;
      const ratio = Math.max(yesPool, noPool) / Math.max(Math.min(yesPool, noPool), 0.001);

      console.log(`  Market #${market.id}:`);
      console.log(`    Deadline: ${deadline}`);
      console.log(`    YES Pool: ${yesPool.toFixed(2)} FLR`);
      console.log(`    NO Pool: ${noPool.toFixed(2)} FLR`);
      console.log(`    Imbalance Ratio: ${ratio.toFixed(2)}x`);
    }
  }

  // Poll for new markets (should return empty if no new markets)
  console.log('\nPolling for new markets...');
  const newMarkets = await pollForNewMarkets();
  console.log(`  Found ${newMarkets.length} new markets`);

  console.log('\n✅ Market monitor test complete');
}

main().catch(console.error);
