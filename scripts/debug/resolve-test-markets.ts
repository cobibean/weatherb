import { requireDatabaseUrl } from '@weatherb/shared/utils/database-url';
import { PrismaPg } from '@prisma/adapter-pg';
#!/usr/bin/env npx tsx
/**
 * Batch resolution script for stuck test markets.
 * 
 * This script bypasses the normal settler's findCityByBytes32() lookup
 * and uses the market's stored coordinates directly from the DB.
 * 
 * Usage:
 *   npx tsx scripts/debug/resolve-test-markets.ts [--dry-run]
 */
import { config as dotenvConfig } from 'dotenv';
import { createPublicClient, createWalletClient, http, formatEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PrismaClient } from '@prisma/client';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';

dotenvConfig({ path: '.env' });

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;
const SETTLER_PRIVATE_KEY = process.env.SETTLER_PRIVATE_KEY as Hex;

if (!RPC_URL || !CONTRACT_ADDRESS || !SETTLER_PRIVATE_KEY) {
  console.error('Missing required environment variables: RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS, SETTLER_PRIVATE_KEY');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireDatabaseUrl(), connectionTimeoutMillis: 5000 }) });
const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled', 'NoWinners'] as const;

const isDryRun = process.argv.includes('--dry-run');

// #region agent log
function log(msg: string, data?: Record<string, unknown>) {
  fetch('http://127.0.0.1:7242/ingest/4acd7855-0912-454f-ba09-749f15fd9944', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'resolve-test-markets.ts', message: msg, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix' }),
  }).catch(() => {});
}
// #endregion

async function main() {
  console.log('🔧 Batch Resolution Script for Stuck Test Markets');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no transactions)' : '⚡ LIVE (will submit transactions)'}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}\n`);

  // #region agent log
  log('Script started', { isDryRun, contract: CONTRACT_ADDRESS });
  // #endregion

  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const account = privateKeyToAccount(SETTLER_PRIVATE_KEY);
  const walletClient = createWalletClient({ transport: http(RPC_URL), account });

  console.log(`Settler wallet: ${account.address}\n`);

  // Get weather provider
  const weatherProvider = createWeatherProviderFromEnv();

  // Fetch all unresolved test markets
  const testMarkets = await prisma.market.findMany({
    where: { 
      isTest: true,
      isSettled: false,
    },
    include: { city: true },
    orderBy: { contractMarketId: 'asc' },
  });

  console.log(`📊 Found ${testMarkets.length} unresolved test markets\n`);

  if (testMarkets.length === 0) {
    console.log('✅ No unresolved test markets found!');
    await prisma.$disconnect();
    return;
  }

  const results: Array<{
    contractMarketId: number;
    cityName: string;
    status: string;
    txHash?: string;
    error?: string;
  }> = [];

  for (const market of testMarkets) {
    console.log(`────────────────────────────────────────────────────────────`);
    console.log(`📍 Processing Market ${market.contractMarketId}: ${market.cityName}`);

    // Check on-chain status first
    const onChainMarket = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [BigInt(market.contractMarketId)],
    });

    const onChainStatus = STATUS_MAP[Number(onChainMarket.status)] ?? 'Unknown';

    // Skip if already resolved/cancelled
    if (onChainStatus === 'Resolved' || onChainStatus === 'Cancelled' || onChainStatus === 'NoWinners') {
      console.log(`  ⏭️  Already ${onChainStatus} on-chain, skipping...`);
      
      // Update DB to match
      await prisma.market.update({
        where: { id: market.id },
        data: { isSettled: true, settledAt: new Date() },
      });
      
      results.push({ contractMarketId: market.contractMarketId, cityName: market.cityName, status: `Already ${onChainStatus}` });
      continue;
    }

    // Check if past resolve time
    const resolveTimeSec = Number(onChainMarket.resolveTime);
    const nowSec = Math.floor(Date.now() / 1000);
    
    if (resolveTimeSec > nowSec) {
      console.log(`  ⏳ Not past resolve time yet (${new Date(resolveTimeSec * 1000).toISOString()}), skipping...`);
      results.push({ contractMarketId: market.contractMarketId, cityName: market.cityName, status: 'Not ready' });
      continue;
    }

    // Use stored coordinates from DB (bypass city lookup!)
    const latitude = market.latitude;
    const longitude = market.longitude;

    console.log(`  📍 Using stored coordinates: (${latitude}, ${longitude})`);
    console.log(`  🕐 Resolve time: ${new Date(resolveTimeSec * 1000).toISOString()}`);

    // #region agent log
    log('Fetching weather', { contractMarketId: market.contractMarketId, latitude, longitude, resolveTimeSec });
    // #endregion

    try {
      // Fetch weather data using stored coordinates
      const reading = await weatherProvider.getFirstReadingAtOrAfter(latitude, longitude, resolveTimeSec);

      console.log(`  🌡️  Weather: ${reading.tempF_tenths / 10}°F at ${new Date(reading.observedTimestamp * 1000).toISOString()}`);
      console.log(`  📊 Threshold: ${Number(onChainMarket.thresholdTenths) / 10}°F`);
      console.log(`  🎯 Outcome: ${reading.tempF_tenths >= Number(onChainMarket.thresholdTenths) ? 'YES' : 'NO'}`);

      // #region agent log
      log('Weather fetched', { 
        contractMarketId: market.contractMarketId, 
        tempTenths: reading.tempF_tenths,
        threshold: Number(onChainMarket.thresholdTenths),
        outcome: reading.tempF_tenths >= Number(onChainMarket.thresholdTenths) ? 'YES' : 'NO'
      });
      // #endregion

      if (isDryRun) {
        console.log(`  🔍 DRY RUN: Would call resolveMarket(${market.contractMarketId}, ${reading.tempF_tenths}, ${reading.observedTimestamp})`);
        results.push({ contractMarketId: market.contractMarketId, cityName: market.cityName, status: 'Dry run - would resolve' });
        continue;
      }

      // Submit resolution transaction
      console.log(`  ⚡ Submitting resolution transaction...`);

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'resolveMarket',
        args: [
          BigInt(market.contractMarketId),
          BigInt(reading.tempF_tenths),
          BigInt(reading.observedTimestamp),
        ],
        account: walletClient.account!,
      });

      const txHash = await walletClient.writeContract(request);
      console.log(`  📝 Transaction: ${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status !== 'success') {
        throw new Error(`Transaction failed: ${txHash}`);
      }

      console.log(`  ✅ Market resolved successfully!`);

      // #region agent log
      log('Market resolved', { contractMarketId: market.contractMarketId, txHash, tempTenths: reading.tempF_tenths });
      // #endregion

      // Update DB
      const outcome = reading.tempF_tenths >= Number(onChainMarket.thresholdTenths) ? 'YES' : 'NO';
      await prisma.market.update({
        where: { id: market.id },
        data: {
          isSettled: true,
          settledAt: new Date(),
          actualTemp: reading.tempF_tenths,
          outcome,
        },
      });

      results.push({ contractMarketId: market.contractMarketId, cityName: market.cityName, status: 'Resolved', txHash });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ Error: ${errorMessage}`);

      // #region agent log
      log('Resolution failed', { contractMarketId: market.contractMarketId, error: errorMessage });
      // #endregion

      results.push({ contractMarketId: market.contractMarketId, cityName: market.cityName, status: 'Failed', error: errorMessage });
    }
  }

  // Summary
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`📊 SUMMARY`);
  console.log(`═══════════════════════════════════════════════════════════`);

  const resolved = results.filter(r => r.status === 'Resolved');
  const failed = results.filter(r => r.status === 'Failed');
  const skipped = results.filter(r => !['Resolved', 'Failed'].includes(r.status));

  console.log(`✅ Resolved: ${resolved.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⏭️  Skipped: ${skipped.length}`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed markets:`);
    for (const f of failed) {
      console.log(`  - Market ${f.contractMarketId} (${f.cityName}): ${f.error}`);
    }
  }

  if (resolved.length > 0) {
    console.log(`\n✅ Resolved markets:`);
    for (const r of resolved) {
      console.log(`  - Market ${r.contractMarketId} (${r.cityName}): ${r.txHash}`);
    }
  }

  // #region agent log
  log('Script complete', { resolved: resolved.length, failed: failed.length, skipped: skipped.length });
  // #endregion

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
