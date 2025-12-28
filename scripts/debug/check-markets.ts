#!/usr/bin/env node
/**
 * Diagnostic script to check on-chain market state
 */
import { createPublicClient, http, type Hex } from 'viem';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;

if (!RPC_URL || !CONTRACT_ADDRESS) {
  console.error('Missing RPC_URL or NEXT_PUBLIC_CONTRACT_ADDRESS');
  process.exit(1);
}

const client = createPublicClient({
  transport: http(RPC_URL),
});

const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled'] as const;

async function main() {
  console.log('🔍 Checking on-chain market state...\n');
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}\n`);

  const count = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });

  console.log(`📊 Total markets: ${count}\n`);

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

    console.log(`Market ${i}:`);
    console.log(`  Status: ${status}`);
    console.log(`  Resolve Time: ${resolveTime.toISOString()} ${isPast ? '(PAST)' : '(FUTURE)'}`);
    console.log(`  Threshold: ${Number(market.thresholdTenths) / 10}°F`);
    console.log(`  YES Pool: ${market.yesPool.toString()} wei`);
    console.log(`  NO Pool: ${market.noPool.toString()} wei`);

    if (status === 'Resolved') {
      console.log(`  ✅ Resolved Temp: ${Number(market.resolvedTempTenths) / 10}°F`);
      console.log(`  ✅ Outcome: ${market.outcome ? 'YES' : 'NO'}`);
      console.log(`  ✅ Observed at: ${new Date(Number(market.observedTimestamp) * 1000).toISOString()}`);
    } else if (isPast && status !== 'Cancelled') {
      console.log(`  ⚠️  SHOULD BE SETTLED! (status is ${status} but resolve time has passed)`);
    }

    console.log('');
  }

  // Check if there's a specific wallet address to check positions for
  const walletAddress = process.argv[2];
  if (walletAddress) {
    console.log(`\n👤 Checking positions for wallet: ${walletAddress}\n`);

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
      console.log(`  Amount: ${betAmount.toString()} wei`);
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
        console.log(`  Claimable Payout: ${payout.toString()} wei`);

        if (didWin && !position.claimed && payout === 0n) {
          console.log(`  ⚠️  WARNING: You won but payout is 0! This might be a bug.`);
        }
        if (!didWin && payout > 0n) {
          console.log(`  ⚠️  WARNING: You lost but payout > 0! This might be a bug.`);
        }
        if (position.claimed && payout > 0n) {
          console.log(`  ⚠️  WARNING: Marked as claimed but payout > 0! This might be a bug.`);
        }
      } else if (status === 'Cancelled') {
        console.log(`  Refundable: ${betAmount.toString()} wei`);
      }

      console.log('');
    }
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
