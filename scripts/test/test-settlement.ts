#!/usr/bin/env node
/**
 * Test script to manually settle pending markets and see what fails
 */
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { CITIES } from '@weatherb/shared/constants';
import { keccak256, toBytes } from 'viem';

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;
const SETTLER_PRIVATE_KEY = process.env.SETTLER_PRIVATE_KEY as Hex;

if (!RPC_URL || !CONTRACT_ADDRESS || !SETTLER_PRIVATE_KEY) {
  console.error('Missing required env vars');
  process.exit(1);
}

const publicClient = createPublicClient({ transport: http(RPC_URL) });
const account = privateKeyToAccount(SETTLER_PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  transport: http(RPC_URL),
});

const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled'] as const;

function findCityByBytes32(cityId: Hex) {
  return CITIES.find((c) => keccak256(toBytes(c.slug)) === cityId) ?? null;
}

async function main() {
  console.log('🔧 Testing settlement process...\n');
  console.log(`Settler wallet: ${account.address}\n`);

  const count = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });

  console.log(`Total markets: ${count}\n`);

  const nowSec = Math.floor(Date.now() / 1000);
  let settled = 0;
  let errors = 0;

  // Try to settle first 3 pending markets
  for (let i = 0n; i < count && settled < 3; i++) {
    const market = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [i],
    });

    const status = STATUS_MAP[Number(market.status)] ?? 'Unknown';
    const resolveTimeSec = Number(market.resolveTime);

    // Skip if already resolved/cancelled or not ready
    if (status === 'Resolved' || status === 'Cancelled') continue;
    if (resolveTimeSec > nowSec) continue;

    const city = findCityByBytes32(market.cityId);
    if (!city) {
      console.log(`⚠️  Market ${i}: Unknown city, skipping`);
      continue;
    }

    console.log(`\n📍 Market ${i}: ${city.name} (${status}, resolve at ${new Date(resolveTimeSec * 1000).toISOString()})`);

    try {
      // Get weather data
      console.log(`  Fetching weather data...`);
      const provider = createWeatherProviderFromEnv();
      const reading = await provider.getFirstReadingAtOrAfter(
        city.latitude,
        city.longitude,
        resolveTimeSec
      );

      console.log(`  Weather: ${reading.tempF_tenths / 10}°F at ${new Date(reading.observedTimestamp * 1000).toISOString()}`);
      console.log(`  Threshold: ${Number(market.thresholdTenths) / 10}°F`);
      console.log(`  Outcome: ${reading.tempF_tenths >= Number(market.thresholdTenths) ? 'YES' : 'NO'}`);

      // Simulate the transaction first
      console.log(`  Simulating settlement...`);
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'resolveMarket',
        args: [i, BigInt(reading.tempF_tenths), BigInt(reading.observedTimestamp)],
        account,
      });

      console.log(`  Sending transaction...`);
      const txHash = await walletClient.writeContract(request);
      console.log(`  TX: ${txHash}`);

      console.log(`  Waiting for confirmation...`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`  ✅ Settled! (gas used: ${receipt.gasUsed})`);

      settled++;
    } catch (error) {
      console.error(`  ❌ FAILED:`, error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error(`  Stack:`, error.stack.split('\n').slice(0, 5).join('\n'));
      }
      errors++;
    }
  }

  console.log(`\n\n📊 Results:`);
  console.log(`  Settled: ${settled}`);
  console.log(`  Errors: ${errors}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
