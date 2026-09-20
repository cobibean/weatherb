import { requireDatabaseUrl } from '@weatherb/shared/utils/database-url';
import { PrismaPg } from '@prisma/adapter-pg';
#!/usr/bin/env npx tsx
/**
 * FORCE resolution script for test markets - BYPASSES TIME CHECK.
 * 
 * Use this when you need to resolve test markets immediately
 * without waiting for their resolve time.
 * 
 * ⚠️  WARNING: This resolves markets early! Only use for testing.
 * 
 * Usage:
 *   npx tsx scripts/debug/force-resolve-test-markets.ts              # Dry run
 *   npx tsx scripts/debug/force-resolve-test-markets.ts --live       # Actually resolve
 *   npx tsx scripts/debug/force-resolve-test-markets.ts --live --ids 1284,1285,1286  # Specific markets
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

// Parse args
const isLive = process.argv.includes('--live');
const idsArg = process.argv.find(arg => arg.startsWith('--ids='));
const specificIds = idsArg ? idsArg.replace('--ids=', '').split(',').map(Number) : null;

async function main() {
  console.log('⚡ FORCE Resolution Script for Test Markets');
  console.log('⚠️  WARNING: This bypasses the resolve time check!\n');
  console.log(`Mode: ${isLive ? '🔴 LIVE (will submit transactions)' : '🔍 DRY RUN (no transactions)'}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}`);
  if (specificIds) {
    console.log(`Target markets: ${specificIds.join(', ')}`);
  }
  console.log('');

  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const account = privateKeyToAccount(SETTLER_PRIVATE_KEY);
  const walletClient = createWalletClient({ transport: http(RPC_URL), account });

  console.log(`Settler wallet: ${account.address}\n`);

  // Get weather provider
  const weatherProvider = createWeatherProviderFromEnv();

  // Fetch unresolved test markets
  const whereClause: { isTest: boolean; isSettled: boolean; contractMarketId?: { in: number[] } } = { 
    isTest: true,
    isSettled: false,
  };
  
  if (specificIds) {
    whereClause.contractMarketId = { in: specificIds };
  }

  const testMarkets = await prisma.market.findMany({
    where: whereClause,
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

    // ⚠️ BYPASSED: Time check - we're forcing resolution regardless of resolve time
    const resolveTimeSec = Number(onChainMarket.resolveTime);
    const nowSec = Math.floor(Date.now() / 1000);
    
    if (resolveTimeSec > nowSec) {
      console.log(`  ⚠️  BYPASSING TIME CHECK: Resolve time is ${new Date(resolveTimeSec * 1000).toISOString()}`);
      console.log(`  ⚠️  Current time is ${new Date(nowSec * 1000).toISOString()}`);
      console.log(`  ⚠️  Forcing resolution anyway...`);
    }

    // Use stored coordinates from DB (bypass city lookup!)
    const latitude = market.latitude;
    const longitude = market.longitude;

    console.log(`  📍 Using stored coordinates: (${latitude}, ${longitude})`);

    try {
      // Fetch CURRENT weather (not historical, since market hasn't matured)
      // We'll use the current temperature as the "actual" result
      console.log(`  🌡️  Fetching current weather...`);
      
      // Use current time for weather lookup since market hasn't matured yet
      const lookupTime = Math.min(resolveTimeSec, nowSec);
      const reading = await weatherProvider.getFirstReadingAtOrAfter(latitude, longitude, lookupTime);

      console.log(`  🌡️  Weather: ${reading.tempF_tenths / 10}°F at ${new Date(reading.observedTimestamp * 1000).toISOString()}`);
      console.log(`  📊 Threshold: ${Number(onChainMarket.thresholdTenths) / 10}°F`);
      console.log(`  🎯 Outcome: ${reading.tempF_tenths >= Number(onChainMarket.thresholdTenths) ? 'YES' : 'NO'}`);

      if (!isLive) {
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

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
