import { requireDatabaseUrl } from '@weatherb/shared/utils/database-url';
import { PrismaPg } from '@prisma/adapter-pg';
#!/usr/bin/env npx tsx
/**
 * Diagnostic script to analyze why test markets didn't resolve
 * 
 * Usage:
 *   npx tsx scripts/debug/diagnose-test-markets.ts
 */
import { config as dotenvConfig } from 'dotenv';
import { createPublicClient, http, formatEther, keccak256, toBytes, type Hex } from 'viem';
import { PrismaClient } from '@prisma/client';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { CITIES } from '@weatherb/shared/constants';

dotenvConfig({ path: '.env' });

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;

if (!RPC_URL || !CONTRACT_ADDRESS) {
  console.error('Missing RPC_URL or NEXT_PUBLIC_CONTRACT_ADDRESS');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireDatabaseUrl(), connectionTimeoutMillis: 5000 }) });
const client = createPublicClient({
  transport: http(RPC_URL),
});

const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled', 'NoWinners'] as const;

// #region agent log
function log(msg: string, data?: Record<string, unknown>) {
  fetch('http://127.0.0.1:7242/ingest/4acd7855-0912-454f-ba09-749f15fd9944', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'diagnose-test-markets.ts', message: msg, data, timestamp: Date.now(), sessionId: 'debug-session' }),
  }).catch(() => {});
}
// #endregion

async function main() {
  console.log('🔍 Diagnosing Test Market Resolution Issues\n');
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}\n`);

  // #region agent log
  log('Script started', { contract: CONTRACT_ADDRESS, rpcUrl: RPC_URL });
  // #endregion

  // Step 1: Get all test markets from DB
  const testMarkets = await prisma.market.findMany({
    where: { isTest: true },
    include: {
      city: true,
      testRun: {
        include: {
          suggestion: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Found ${testMarkets.length} test markets in database\n`);

  // #region agent log
  log('Fetched test markets from DB', { count: testMarkets.length, marketIds: testMarkets.map(m => m.contractMarketId) });
  // #endregion

  // Categorize markets
  const unresolvedMarkets: typeof testMarkets = [];
  const resolvedMarkets: typeof testMarkets = [];
  const syncIssues: Array<{ market: typeof testMarkets[0]; onChainStatus: string; dbSettled: boolean }> = [];

  for (const market of testMarkets) {
    // Fetch on-chain status
    const onChainMarket = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [BigInt(market.contractMarketId)],
    });

    const onChainStatus = STATUS_MAP[Number(onChainMarket.status)] ?? 'Unknown';
    const isOnChainResolved = onChainStatus === 'Resolved' || onChainStatus === 'Cancelled' || onChainStatus === 'NoWinners';

    // #region agent log
    log('Market on-chain status', {
      contractMarketId: market.contractMarketId,
      onChainStatus,
      dbSettled: market.isSettled,
      cityName: market.cityName,
      hypothesisId: 'D',
    });
    // #endregion

    if (market.isSettled !== isOnChainResolved) {
      syncIssues.push({ market, onChainStatus, dbSettled: market.isSettled });
    }

    if (!isOnChainResolved) {
      unresolvedMarkets.push(market);
    } else {
      resolvedMarkets.push(market);
    }
  }

  console.log(`✅ Resolved on-chain: ${resolvedMarkets.length}`);
  console.log(`❌ Unresolved on-chain: ${unresolvedMarkets.length}`);
  console.log(`⚠️  DB/On-chain sync issues: ${syncIssues.length}\n`);

  // Step 2: Analyze unresolved markets
  if (unresolvedMarkets.length === 0) {
    console.log('All test markets are resolved on-chain!\n');
    
    if (syncIssues.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📋 DB/On-chain Sync Issues (DB needs updating):');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      for (const issue of syncIssues) {
        console.log(`Market ${issue.market.contractMarketId} (${issue.market.cityName}):`);
        console.log(`  On-chain status: ${issue.onChainStatus}`);
        console.log(`  DB isSettled: ${issue.dbSettled}`);
        console.log(`  → DB should be updated to match on-chain state\n`);
      }
    }
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 UNRESOLVED TEST MARKETS ANALYSIS:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const now = Math.floor(Date.now() / 1000);
    let totalUnclaimedFLR = 0n;

    for (const market of unresolvedMarkets) {
      console.log(`\n────────────────────────────────────────────────────────────`);
      console.log(`📍 Market ${market.contractMarketId}: ${market.cityName}`);
      console.log(`────────────────────────────────────────────────────────────`);

      // Fetch on-chain data
      const onChainMarket = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarket',
        args: [BigInt(market.contractMarketId)],
      });

      const onChainStatus = STATUS_MAP[Number(onChainMarket.status)] ?? 'Unknown';
      const resolveTimeSec = Number(onChainMarket.resolveTime);
      const isPastResolveTime = resolveTimeSec <= now;
      const totalPool = onChainMarket.yesPool + onChainMarket.noPool;
      totalUnclaimedFLR += totalPool;

      console.log(`\n📊 On-Chain State:`);
      console.log(`  Status: ${onChainStatus}`);
      console.log(`  Resolve Time: ${new Date(resolveTimeSec * 1000).toISOString()}`);
      console.log(`  Past Resolve Time: ${isPastResolveTime ? '✅ YES' : '❌ NO'}`);
      console.log(`  YES Pool: ${formatEther(onChainMarket.yesPool)} FLR`);
      console.log(`  NO Pool: ${formatEther(onChainMarket.noPool)} FLR`);
      console.log(`  Total Pool: ${formatEther(totalPool)} FLR`);

      // #region agent log
      log('Market timing analysis', {
        contractMarketId: market.contractMarketId,
        isPastResolveTime,
        resolveTimeSec,
        nowSec: now,
        totalPool: formatEther(totalPool),
        hypothesisId: 'C',
      });
      // #endregion

      // Check city lookup (THE KEY HYPOTHESIS)
      const cityIdOnChain = onChainMarket.cityId as Hex;
      console.log(`\n🏙️ City Lookup Analysis:`);
      console.log(`  On-chain cityId (bytes32): ${cityIdOnChain}`);

      // Check hardcoded CITIES
      const hardcodedCity = CITIES.find((c) => keccak256(toBytes(c.slug)) === cityIdOnChain);
      if (hardcodedCity) {
        console.log(`  ✅ Found in hardcoded CITIES: ${hardcodedCity.name} (slug: ${hardcodedCity.slug})`);
      } else {
        console.log(`  ❌ NOT in hardcoded CITIES`);
      }

      // #region agent log
      log('Hardcoded city lookup', {
        contractMarketId: market.contractMarketId,
        cityIdOnChain,
        foundInHardcoded: !!hardcodedCity,
        hardcodedSlug: hardcodedCity?.slug,
        hypothesisId: 'A',
      });
      // #endregion

      // Check DB city
      const dbCitySlugHash = market.city ? keccak256(toBytes(market.city.slug)) : null;
      console.log(`\n  📁 DB City Analysis:`);
      console.log(`    City record exists: ${market.city ? '✅ YES' : '❌ NO'}`);
      if (market.city) {
        console.log(`    City slug: ${market.city.slug}`);
        console.log(`    City name: ${market.city.name}`);
        console.log(`    isActive: ${market.city.isActive ? '✅ YES' : '❌ NO'}`);
        console.log(`    Slug hash: ${dbCitySlugHash}`);
        console.log(`    Hash matches on-chain: ${dbCitySlugHash === cityIdOnChain ? '✅ YES' : '❌ NO'}`);
      }

      // #region agent log
      log('DB city analysis', {
        contractMarketId: market.contractMarketId,
        cityExists: !!market.city,
        citySlug: market.city?.slug,
        cityName: market.city?.name,
        isActive: market.city?.isActive,
        slugHash: dbCitySlugHash,
        hashMatchesOnChain: dbCitySlugHash === cityIdOnChain,
        hypothesisId: 'B',
      });
      // #endregion

      // Check what slug was used to create this market
      console.log(`\n  🔍 Slug Generation Check:`);
      const originalCityName = market.cityName;
      const expectedSlug = originalCityName.toLowerCase().replace(/\s+/g, '-');
      const expectedHash = keccak256(toBytes(expectedSlug));
      console.log(`    Market cityName: ${originalCityName}`);
      console.log(`    Expected slug (from name): ${expectedSlug}`);
      console.log(`    Expected hash: ${expectedHash}`);
      console.log(`    Matches on-chain: ${expectedHash === cityIdOnChain ? '✅ YES' : '❌ NO'}`);

      // Root cause determination
      console.log(`\n  🎯 DIAGNOSIS:`);
      
      if (!isPastResolveTime) {
        console.log(`    ⏳ Market NOT past resolve time - will settle when ready`);
      } else if (hardcodedCity) {
        console.log(`    ✅ City is in hardcoded CITIES - should resolve normally`);
        console.log(`    ❓ Check settler cron logs for errors`);
      } else if (market.city && market.city.isActive && dbCitySlugHash === cityIdOnChain) {
        console.log(`    ✅ City is in DB and active with matching hash - should resolve`);
        console.log(`    ❓ Check settler cron logs for weather API errors`);
      } else if (market.city && !market.city.isActive) {
        console.log(`    🔴 HYPOTHESIS B CONFIRMED: City exists but isActive=false`);
        console.log(`    → Fix: Set city.isActive = true in database`);
      } else if (market.city && dbCitySlugHash !== cityIdOnChain) {
        console.log(`    🔴 HYPOTHESIS A CONFIRMED: Slug hash mismatch`);
        console.log(`    → On-chain cityId: ${cityIdOnChain}`);
        console.log(`    → DB slug hash: ${dbCitySlugHash}`);
        console.log(`    → Fix: Update city slug to match expected hash`);
      } else if (!market.city) {
        console.log(`    🔴 City record missing from DB`);
        console.log(`    → Fix: Create city record with correct slug`);
      } else {
        console.log(`    ❓ Unknown issue - check settler cron logs`);
      }

      // Check TestRun status
      if (market.testRun) {
        console.log(`\n  🧪 TestRun Info:`);
        console.log(`    Status: ${market.testRun.status}`);
        console.log(`    Keys Disposed: ${market.testRun.keysDisposed}`);
        console.log(`    Markets Created: ${market.testRun.marketsCreated}`);
        console.log(`    Markets Settled: ${market.testRun.marketsSettled}`);
        if (market.testRun.suggestion) {
          console.log(`    Suggestion City: ${market.testRun.suggestion.customCityName || 'N/A'}`);
        }
      }
    }

    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`📊 SUMMARY`);
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`Total unresolved test markets: ${unresolvedMarkets.length}`);
    console.log(`Total FLR in unresolved markets: ${formatEther(totalUnclaimedFLR)} FLR`);

    // #region agent log
    log('Diagnosis complete', {
      unresolvedCount: unresolvedMarkets.length,
      totalFLR: formatEther(totalUnclaimedFLR),
      syncIssues: syncIssues.length,
    });
    // #endregion
  }

  // Step 3: Check all DB cities and their active status
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`📋 ALL DATABASE CITIES:`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  const allCities = await prisma.city.findMany({
    orderBy: { createdAt: 'desc' },
  });

  for (const city of allCities) {
    const slugHash = keccak256(toBytes(city.slug));
    const inHardcoded = CITIES.some(c => c.slug === city.slug);
    console.log(`${city.isActive ? '✅' : '❌'} ${city.name} (slug: ${city.slug})`);
    console.log(`   Hash: ${slugHash}`);
    console.log(`   In hardcoded CITIES: ${inHardcoded ? 'YES' : 'NO'}\n`);
  }

  // #region agent log
  log('All cities analyzed', {
    totalCities: allCities.length,
    activeCities: allCities.filter(c => c.isActive).length,
    inactiveCities: allCities.filter(c => !c.isActive).length,
  });
  // #endregion

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
