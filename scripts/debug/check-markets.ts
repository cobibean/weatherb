#!/usr/bin/env npx tsx
/**
 * Diagnostic script to check on-chain market state and analyze contract balance
 * 
 * Usage:
 *   npx tsx scripts/debug/check-markets.ts [walletAddress]
 */
import { config as dotenvConfig } from 'dotenv';
import { createPublicClient, http, formatEther, type Hex } from 'viem';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';

dotenvConfig({ path: '.env' });

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;

if (!RPC_URL || !CONTRACT_ADDRESS) {
  console.error('Missing RPC_URL or NEXT_PUBLIC_CONTRACT_ADDRESS');
  console.error('Make sure .env file exists with these variables');
  process.exit(1);
}

const client = createPublicClient({
  transport: http(RPC_URL),
});

const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled', 'NoWinners'] as const;

async function main() {
  console.log('🔍 Checking on-chain market state...\n');
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}\n`);

  // Get contract balance
  const contractBalance = await client.getBalance({ address: CONTRACT_ADDRESS });
  console.log(`💰 Contract Balance: ${formatEther(contractBalance)} FLR\n`);

  const count = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });

  console.log(`📊 Total markets: ${count}\n`);
  console.log('⏳ Analyzing all markets (this may take a moment)...\n');

  // Aggregate data first
  let totalActivePools = 0n;
  let totalResolvedPools = 0n;
  let totalCancelledPools = 0n;
  let totalNoWinnersPools = 0n;
  let unresolvedPastMarkets = 0;
  let cancelledCount = 0;
  let openCount = 0;
  let closedCount = 0;
  let resolvedCount = 0;
  let noWinnersCount = 0;
  
  // Track markets with pools for detailed display
  const marketsWithPools: Array<{
    id: bigint;
    status: string;
    totalPool: bigint;
    yesPool: bigint;
    noPool: bigint;
    resolveTime: Date;
    threshold: number;
    outcome?: boolean;
    resolvedTemp?: number;
  }> = [];

  for (let i = 0n; i < count; i++) {
    const market = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [i],
    });

    const status = STATUS_MAP[Number(market.status)] ?? 'Unknown';
    const resolveTime = new Date(Number(market.resolveTime) * 1000);
    const now = new Date();
    const isPast = resolveTime < now;
    const totalPool = market.yesPool + market.noPool;

    // Count by status
    if (status === 'Cancelled') {
      cancelledCount++;
      totalCancelledPools += totalPool;
    } else if (status === 'Open') {
      openCount++;
      totalActivePools += totalPool;
    } else if (status === 'Closed') {
      closedCount++;
      totalActivePools += totalPool;
    } else if (status === 'Resolved') {
      resolvedCount++;
      totalResolvedPools += totalPool;
    } else if (status === 'NoWinners') {
      noWinnersCount++;
      totalNoWinnersPools += totalPool;
    }

    if (isPast && status !== 'Resolved' && status !== 'Cancelled' && status !== 'NoWinners') {
      unresolvedPastMarkets++;
    }

    // Track markets with pools for display (only non-cancelled)
    if (status !== 'Cancelled' && totalPool > 0n) {
      marketsWithPools.push({
        id: i,
        status,
        totalPool,
        yesPool: market.yesPool,
        noPool: market.noPool,
        resolveTime,
        threshold: Number(market.thresholdTenths) / 10,
        outcome: status === 'Resolved' ? market.outcome : undefined,
        resolvedTemp: status === 'Resolved' ? Number(market.resolvedTempTenths) / 10 : undefined,
      });
    }
  }

  // Sort by pool size (largest first)
  marketsWithPools.sort((a, b) => {
    if (b.totalPool > a.totalPool) return 1;
    if (b.totalPool < a.totalPool) return -1;
    return 0;
  });

  // Show summary first
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Contract Balance: ${formatEther(contractBalance)} FLR\n`);
  
  console.log('Market Status Breakdown:');
  console.log(`  Open: ${openCount} markets, ${formatEther(totalActivePools)} FLR`);
  console.log(`  Closed: ${closedCount} markets, ${formatEther(0n)} FLR (included in Active)`);
  console.log(`  Resolved: ${resolvedCount} markets, ${formatEther(totalResolvedPools)} FLR`);
  console.log(`  NoWinners: ${noWinnersCount} markets, ${formatEther(totalNoWinnersPools)} FLR`);
  console.log(`  Cancelled: ${cancelledCount} markets, ${formatEther(totalCancelledPools)} FLR\n`);
  
  const totalAccountedFor = totalActivePools + totalResolvedPools + totalNoWinnersPools;
  const difference = contractBalance - totalAccountedFor;
  
  console.log(`Total Accounted For (Active + Resolved + NoWinners): ${formatEther(totalAccountedFor)} FLR`);
  console.log(`Difference (Contract Balance - Accounted): ${formatEther(difference)} FLR`);
  
  if (difference > 0n) {
    console.log(`\n💡 The ${formatEther(difference)} FLR difference likely represents:`);
    console.log(`   - Accrued fees (1% of losing pools from resolved markets)`);
    console.log(`   - Unclaimed winnings (winners haven't called claim() yet)`);
  }
  
  if (unresolvedPastMarkets > 0) {
    console.log(`\n⚠️  WARNING: ${unresolvedPastMarkets} market(s) past resolve time but not settled!`);
    console.log(`   Check the settler cron job is running.`);
  }

  // Show markets with pools (top 20 or all if less than 20)
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`💰 Markets with Pools (showing top ${Math.min(20, marketsWithPools.length)}):`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const marketsToShow = marketsWithPools.slice(0, 20);
  for (const m of marketsToShow) {
    const market = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [m.id],
    });

    console.log(`Market ${m.id}:`);
    console.log(`  Status: ${m.status}`);
    console.log(`  Resolve Time: ${m.resolveTime.toISOString()}`);
    console.log(`  Threshold: ${m.threshold}°F`);
    console.log(`  YES Pool: ${formatEther(m.yesPool)} FLR`);
    console.log(`  NO Pool: ${formatEther(m.noPool)} FLR`);
    console.log(`  Total Pool: ${formatEther(m.totalPool)} FLR`);

    if (m.status === 'Resolved' && m.outcome !== undefined && m.resolvedTemp !== undefined) {
      console.log(`  ✅ Resolved Temp: ${m.resolvedTemp}°F`);
      console.log(`  ✅ Outcome: ${m.outcome ? 'YES' : 'NO'}`);
      console.log(`  ✅ Observed at: ${new Date(Number(market.observedTimestamp) * 1000).toISOString()}`);
    }

    console.log('');
  }

  if (marketsWithPools.length > 20) {
    console.log(`... and ${marketsWithPools.length - 20} more markets with pools\n`);
  }


  // Check if there's a specific wallet address to check positions for
  const walletAddress = process.argv[2];
  if (walletAddress) {
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`👤 Checking positions for wallet: ${walletAddress}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    for (let i = 0n; i < count; i++) {
      const position = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getPosition',
        args: [i, walletAddress as Hex],
      });

      if (position.yesAmount === 0n && position.noAmount === 0n) {
        continue; // Skip markets with no position
      }

      const market = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarket',
        args: [i],
      });

      const status = STATUS_MAP[Number(market.status)] ?? 'Unknown';
      const betSide = position.yesAmount > 0n ? 'YES' : 'NO';
      const betAmount = position.yesAmount > 0n ? position.yesAmount : position.noAmount;

      console.log(`Market ${i} Position:`);
      console.log(`  Side: ${betSide}`);
      console.log(`  Amount: ${formatEther(betAmount)} FLR`);
      console.log(`  Claimed: ${position.claimed ? 'YES ✅' : 'NO ⏳'}`);
      console.log(`  Market Status: ${status}`);

      if (status === 'Resolved') {
        const payout = await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: WEATHER_MARKET_ABI,
          functionName: 'calculatePayout',
          args: [i, walletAddress as Hex],
        });

        const didWin = (betSide === 'YES' && market.outcome) || (betSide === 'NO' && !market.outcome);

        console.log(`  Outcome: ${market.outcome ? 'YES' : 'NO'} ${didWin ? '(YOU WON 🎉)' : '(YOU LOST 😢)'}`);
        console.log(`  Claimable Payout: ${formatEther(payout)} FLR`);

        if (didWin && !position.claimed && payout === 0n) {
          console.log(`  ⚠️  WARNING: You won but payout is 0! This might be a bug.`);
        }
        if (!didWin && payout > 0n) {
          console.log(`  ⚠️  WARNING: You lost but payout > 0! This might be a bug.`);
        }
        if (position.claimed && payout > 0n) {
          console.log(`  ⚠️  WARNING: Marked as claimed but payout > 0! This might be a bug.`);
        }
      } else if (status === 'Cancelled' || status === 'NoWinners') {
        console.log(`  Refundable: ${formatEther(betAmount)} FLR`);
      }

      console.log('');
    }
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
