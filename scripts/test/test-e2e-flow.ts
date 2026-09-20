#!/usr/bin/env node
/**
 * End-to-End Test Script
 *
 * Tests the complete user flow:
 * 1. Place a bet on an active market
 * 2. Wait for market to be past resolve time
 * 3. Trigger settlement (or wait for cron)
 * 4. Verify market is resolved
 * 5. Check payout calculation
 * 6. Claim winnings
 * 7. Verify claim succeeded
 *
 * Usage:
 *   npm exec -- tsx scripts/test/test-e2e-flow.ts
 *
 * Options:
 *   SKIP_BET=true         - Skip placing bet, just check existing positions
 *   SKIP_SETTLEMENT=true  - Skip settlement, just try claiming
 *   TEST_WALLET_KEY=0x... - Use specific test wallet (defaults to SETTLER_PRIVATE_KEY)
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { CITIES } from '@weatherb/shared/constants';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { keccak256, toBytes } from 'viem';

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;
const SETTLER_PRIVATE_KEY = process.env.SETTLER_PRIVATE_KEY as Hex;
const TEST_WALLET_KEY = (process.env.TEST_WALLET_KEY || SETTLER_PRIVATE_KEY) as Hex;

const SKIP_BET = process.env.SKIP_BET === 'true';
const SKIP_SETTLEMENT = process.env.SKIP_SETTLEMENT === 'true';

if (!RPC_URL || !CONTRACT_ADDRESS || !TEST_WALLET_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('   Required: RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS, SETTLER_PRIVATE_KEY');
  process.exit(1);
}

const publicClient = createPublicClient({ transport: http(RPC_URL) });
const testAccount = privateKeyToAccount(TEST_WALLET_KEY);
const walletClient = createWalletClient({
  account: testAccount,
  transport: http(RPC_URL),
});

const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled'] as const;

function findCityByBytes32(cityId: Hex) {
  return CITIES.find((c) => keccak256(toBytes(c.slug)) === cityId) ?? null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  weatherB — End-to-End Flow Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Test Wallet: ${testAccount.address}`);
  console.log();

  // Check wallet balance
  const balance = await publicClient.getBalance({ address: testAccount.address });
  console.log(`💰 Wallet Balance: ${formatEther(balance)} FLR`);

  if (balance < parseEther('0.1')) {
    console.log('⚠️  Low balance! You may need more FLR for gas and bets.');
  }
  console.log();

  // Get market count
  const marketCount = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });

  console.log(`📊 Total Markets: ${marketCount}`);
  console.log();

  // Step 1: Find a market to bet on (or check existing position)
  let targetMarketId: bigint | null = null;
  let targetMarket: any = null;

  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Step 1: Find Market to Test');
  console.log('───────────────────────────────────────────────────────────────');
  console.log();

  const nowSec = Math.floor(Date.now() / 1000);

  for (let i = 0n; i < marketCount; i++) {
    const market = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [i],
    });

    const status = STATUS_MAP[Number(market.status)];
    const resolveTimeSec = Number(market.resolveTime);

    // Check if we have a position here
    const position = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getPosition',
      args: [i, testAccount.address],
    });

    const hasPosition = position.yesAmount > 0n || position.noAmount > 0n;

    if (hasPosition) {
      targetMarketId = i;
      targetMarket = market;
      console.log(`✅ Found existing position on Market ${i}`);
      console.log(`   Status: ${status}`);
      console.log(`   Resolve Time: ${new Date(resolveTimeSec * 1000).toISOString()}`);
      console.log(`   Your Bet: ${position.yesAmount > 0n ? 'YES' : 'NO'} (${formatEther(position.yesAmount > 0n ? position.yesAmount : position.noAmount)} FLR)`);
      console.log(`   Claimed: ${position.claimed}`);
      break;
    }

    // If no position yet and we need to bet, find an open market
    if (!SKIP_BET && targetMarketId === null && status === 'Open') {
      // Prefer markets resolving soon (within next hour) for faster testing
      const timeUntilResolve = resolveTimeSec - nowSec;
      if (timeUntilResolve > 0 && timeUntilResolve < 3600) {
        targetMarketId = i;
        targetMarket = market;
        console.log(`🎯 Found open market resolving soon: Market ${i}`);
        console.log(`   Resolves in: ${Math.floor(timeUntilResolve / 60)} minutes`);
        break;
      }
    }
  }

  if (targetMarketId === null) {
    console.error('❌ No suitable market found!');
    console.error('   - No existing positions to test');
    console.error('   - No open markets resolving soon');
    process.exit(1);
  }

  const city = findCityByBytes32(targetMarket.cityId);
  console.log();
  console.log(`Market ${targetMarketId} Details:`);
  console.log(`   City: ${city?.name || 'Unknown'}`);
  console.log(`   Threshold: ${Number(targetMarket.thresholdTenths) / 10}°F`);
  console.log(`   Resolve Time: ${new Date(Number(targetMarket.resolveTime) * 1000).toISOString()}`);
  console.log(`   Status: ${STATUS_MAP[Number(targetMarket.status)]}`);
  console.log(`   YES Pool: ${formatEther(targetMarket.yesPool)} FLR`);
  console.log(`   NO Pool: ${formatEther(targetMarket.noPool)} FLR`);
  console.log();

  // Step 2: Place bet if needed
  if (!SKIP_BET) {
    const position = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getPosition',
      args: [targetMarketId, testAccount.address],
    });

    if (position.yesAmount === 0n && position.noAmount === 0n) {
      console.log('───────────────────────────────────────────────────────────────');
      console.log('  Step 2: Place Bet');
      console.log('───────────────────────────────────────────────────────────────');
      console.log();

      const betAmount = parseEther('0.01'); // Min bet
      const betOnYes = true; // Always bet YES for testing

      console.log(`📍 Placing bet: ${betOnYes ? 'YES' : 'NO'} with ${formatEther(betAmount)} FLR`);

      try {
        const { request } = await publicClient.simulateContract({
          address: CONTRACT_ADDRESS,
          abi: WEATHER_MARKET_ABI,
          functionName: 'bet',
          args: [targetMarketId, betOnYes],
          account: testAccount,
          value: betAmount,
        });

        const txHash = await walletClient.writeContract(request);
        console.log(`   TX sent: ${txHash}`);

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`   ✅ Bet placed! (gas: ${receipt.gasUsed})`);
      } catch (error) {
        console.error(`   ❌ Bet failed:`, error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    } else {
      console.log('ℹ️  Already have position on this market, skipping bet placement');
    }
  }
  console.log();

  // Step 3: Wait for market to be ready for settlement
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Step 3: Check Settlement Readiness');
  console.log('───────────────────────────────────────────────────────────────');
  console.log();

  const currentMarket = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarket',
    args: [targetMarketId],
  });

  const currentStatus = STATUS_MAP[Number(currentMarket.status)];
  const resolveTimeSec = Number(currentMarket.resolveTime);
  const timeUntilResolve = resolveTimeSec - nowSec;

  if (currentStatus === 'Resolved') {
    console.log('✅ Market already resolved!');
    console.log(`   Outcome: ${currentMarket.outcome ? 'YES' : 'NO'}`);
    console.log(`   Resolved Temp: ${Number(currentMarket.resolvedTempTenths) / 10}°F`);
  } else if (currentStatus === 'Cancelled') {
    console.log('⚠️  Market was cancelled - can only refund');
  } else if (timeUntilResolve > 0) {
    console.log(`⏳ Market not ready yet - resolves in ${Math.floor(timeUntilResolve / 60)} min ${timeUntilResolve % 60} sec`);
    console.log('   Options:');
    console.log('   1. Wait for Vercel Cron to settle it (runs every 5 min)');
    console.log('   2. Come back after resolve time and run: SKIP_BET=true npm exec -- tsx scripts/test/test-e2e-flow.ts');
  } else {
    console.log('✅ Market is past resolve time - ready for settlement');

    if (!SKIP_SETTLEMENT && SETTLER_PRIVATE_KEY) {
      console.log();
      console.log('───────────────────────────────────────────────────────────────');
      console.log('  Step 4: Settle Market');
      console.log('───────────────────────────────────────────────────────────────');
      console.log();

      // Settle the market
      const settlerAccount = privateKeyToAccount(SETTLER_PRIVATE_KEY);
      const settlerWallet = createWalletClient({
        account: settlerAccount,
        transport: http(RPC_URL),
      });

      try {
        console.log('📡 Fetching weather data...');
        const provider = createWeatherProviderFromEnv();
        const reading = await provider.getFirstReadingAtOrAfter(
          city!.latitude,
          city!.longitude,
          resolveTimeSec
        );

        console.log(`   Observed: ${reading.tempF_tenths / 10}°F at ${new Date(reading.observedTimestamp * 1000).toISOString()}`);
        console.log(`   Threshold: ${Number(currentMarket.thresholdTenths) / 10}°F`);
        console.log(`   Outcome: ${reading.tempF_tenths >= Number(currentMarket.thresholdTenths) ? 'YES' : 'NO'}`);
        console.log();

        console.log('🔧 Settling market...');
        const { request } = await publicClient.simulateContract({
          address: CONTRACT_ADDRESS,
          abi: WEATHER_MARKET_ABI,
          functionName: 'resolveMarket',
          args: [targetMarketId, BigInt(reading.tempF_tenths), BigInt(reading.observedTimestamp)],
          account: settlerAccount,
        });

        const txHash = await settlerWallet.writeContract(request);
        console.log(`   TX sent: ${txHash}`);

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`   ✅ Market settled! (gas: ${receipt.gasUsed})`);
      } catch (error) {
        console.error(`   ❌ Settlement failed:`, error instanceof Error ? error.message : String(error));
        console.log('   ℹ️  Vercel Cron will try again in a few minutes');
      }
    }
  }
  console.log();

  // Step 5: Check payout
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Step 5: Check Payout');
  console.log('───────────────────────────────────────────────────────────────');
  console.log();

  const finalMarket = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarket',
    args: [targetMarketId],
  });

  const finalStatus = STATUS_MAP[Number(finalMarket.status)];

  if (finalStatus !== 'Resolved' && finalStatus !== 'Cancelled') {
    console.log('⏳ Market not settled yet - cannot check payout');
    console.log('   Run this script again after settlement completes');
    process.exit(0);
  }

  const finalPosition = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getPosition',
    args: [targetMarketId, testAccount.address],
  });

  const payout = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'calculatePayout',
    args: [targetMarketId, testAccount.address],
  });

  const hasYesBet = finalPosition.yesAmount > 0n;
  const hasNoBet = finalPosition.noAmount > 0n;
  const betBothSides = hasYesBet && hasNoBet;

  console.log(`Your Position:`);
  if (betBothSides) {
    console.log(`   Bet: BOTH SIDES (YES: ${formatEther(finalPosition.yesAmount)} FLR, NO: ${formatEther(finalPosition.noAmount)} FLR)`);
  } else {
    const betSide = hasYesBet ? 'YES' : 'NO';
    const betAmount = hasYesBet ? finalPosition.yesAmount : finalPosition.noAmount;
    console.log(`   Bet: ${betSide} (${formatEther(betAmount)} FLR)`);
  }
  console.log(`   Status: ${finalPosition.claimed ? 'CLAIMED' : 'UNCLAIMED'}`);

  if (finalStatus === 'Resolved') {
    const outcome = finalMarket.outcome ? 'YES' : 'NO';
    if (betBothSides) {
      const winningSide = finalMarket.outcome ? 'YES' : 'NO';
      console.log(`   Outcome: ${outcome} (Your ${winningSide} bet won! 🎉)`);
    } else {
      const betSide = hasYesBet ? 'YES' : 'NO';
      const didWin = (betSide === 'YES' && finalMarket.outcome) || (betSide === 'NO' && !finalMarket.outcome);
      console.log(`   Outcome: ${outcome} ${didWin ? '(YOU WON! 🎉)' : '(YOU LOST 😢)'}`);
    }
  }

  console.log(`   Claimable Payout: ${formatEther(payout)} FLR`);

  if (payout === 0n && !finalPosition.claimed) {
    if (finalStatus === 'Resolved') {
      console.log(`   ℹ️  You lost this bet - no payout available`);
    } else {
      console.log(`   ℹ️  Market cancelled - may need to call refund() instead of claim()`);
    }
  }
  console.log();

  // Step 6: Claim winnings
  if (payout > 0n && !finalPosition.claimed) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log('  Step 6: Claim Winnings');
    console.log('───────────────────────────────────────────────────────────────');
    console.log();

    const functionName = finalStatus === 'Cancelled' ? 'refund' : 'claim';
    console.log(`💰 Claiming ${formatEther(payout)} FLR via ${functionName}()...`);

    try {
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName,
        args: [targetMarketId],
        account: testAccount,
      });

      const txHash = await walletClient.writeContract(request);
      console.log(`   TX sent: ${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`   ✅ Winnings claimed! (gas: ${receipt.gasUsed})`);

      const newBalance = await publicClient.getBalance({ address: testAccount.address });
      console.log(`   💰 New Balance: ${formatEther(newBalance)} FLR`);
    } catch (error) {
      console.error(`   ❌ Claim failed:`, error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else if (finalPosition.claimed) {
    console.log('ℹ️  Position already claimed!');
  } else {
    console.log('ℹ️  Nothing to claim (you lost or payout is 0)');
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Test Complete!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log('Summary:');
  console.log(`   Market ${targetMarketId}: ${STATUS_MAP[Number(finalMarket.status)]}`);

  if (betBothSides) {
    console.log(`   Your Bet: BOTH SIDES`);
  } else {
    const betSide = hasYesBet ? 'YES' : 'NO';
    const betAmount = hasYesBet ? finalPosition.yesAmount : finalPosition.noAmount;
    console.log(`   Your Bet: ${betSide} (${formatEther(betAmount)} FLR)`);
  }

  console.log(`   Claimed: ${finalPosition.claimed ? 'YES ✅' : 'NO ⏳'}`);

  if (finalStatus === 'Resolved') {
    if (payout > 0n && finalPosition.claimed) {
      console.log('   Result: WON and CLAIMED 🎉');
    } else if (payout > 0n) {
      console.log('   Result: WON but not claimed yet ⏳');
    } else if (!finalPosition.claimed) {
      console.log('   Result: LOST 😢');
    } else {
      console.log('   Result: ALREADY CLAIMED ✅');
    }
  }
  console.log();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
