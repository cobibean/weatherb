#!/usr/bin/env npx tsx
/**
 * Epic 4 — Bet Placement Test
 *
 * Tests placing a bet on an open market
 *
 * Usage:
 *   PRIVATE_KEY=0x... MARKET_ID=22 BET_YES=true npx tsx scripts/test-bet.ts
 */

import { config as dotenvConfig } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { flareTestnet } from 'viem/chains';

dotenvConfig({ path: '.env' });

const CONTRACT_ADDRESS = (process.env['CONTRACT_ADDRESS'] || '0xbc9b62E78D9F4da71F8063566b1b753b9aB2809a') as Hex;
const RPC_URL = process.env['RPC_URL'] || 'https://coston2-api.flare.network/ext/C/rpc';

const WEATHER_MARKET_ABI = [
  {
    type: 'function',
    name: 'placeBet',
    stateMutability: 'payable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'isYes', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getMarket',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'cityId', type: 'bytes32' },
          { name: 'resolveTime', type: 'uint64' },
          { name: 'bettingDeadline', type: 'uint64' },
          { name: 'thresholdTenths', type: 'uint256' },
          { name: 'currency', type: 'address' },
          { name: 'status', type: 'uint8' },
          { name: 'yesPool', type: 'uint256' },
          { name: 'noPool', type: 'uint256' },
          { name: 'totalFees', type: 'uint256' },
          { name: 'resolvedTempTenths', type: 'uint256' },
          { name: 'observedTimestamp', type: 'uint64' },
          { name: 'outcome', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getPosition',
    stateMutability: 'view',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'bettor', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'yesAmount', type: 'uint256' },
          { name: 'noAmount', type: 'uint256' },
          { name: 'claimed', type: 'bool' },
        ],
      },
    ],
  },
] as const;

const STATUS_LABELS = ['Open', 'Closed', 'Resolved', 'Cancelled'];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  WeatherB — Bet Placement Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  const privateKey = process.env['PRIVATE_KEY'];
  const marketIdStr = process.env['MARKET_ID'];
  const betYes = process.env['BET_YES'] !== 'false'; // Default to YES

  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  if (!marketIdStr) {
    console.error('❌ MARKET_ID environment variable required');
    process.exit(1);
  }

  const marketId = BigInt(marketIdStr);
  const account = privateKeyToAccount(privateKey as Hex);
  
  console.log(`📍 Wallet: ${account.address}`);
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`📍 Market ID: ${marketId}`);
  console.log(`📍 Bet Side: ${betYes ? 'YES' : 'NO'}`);
  console.log();

  const publicClient = createPublicClient({
    chain: flareTestnet,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    chain: flareTestnet,
    transport: http(RPC_URL),
    account,
  });

  // Check market status
  const market = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarket',
    args: [marketId],
  });

  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Market Details');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Status: ${STATUS_LABELS[market.status]}`);
  console.log(`  Threshold: ${Number(market.thresholdTenths) / 10}°F`);
  console.log(`  Resolve Time: ${new Date(Number(market.resolveTime) * 1000).toISOString()}`);
  console.log(`  Betting Deadline: ${new Date(Number(market.bettingDeadline) * 1000).toISOString()}`);
  console.log(`  YES Pool: ${Number(market.yesPool) / 1e18} FLR`);
  console.log(`  NO Pool: ${Number(market.noPool) / 1e18} FLR`);
  console.log();

  if (market.status !== 0) {
    console.error(`❌ Market is not open (status: ${STATUS_LABELS[market.status]})`);
    process.exit(1);
  }

  const now = Math.floor(Date.now() / 1000);
  if (now >= Number(market.bettingDeadline)) {
    console.error('❌ Betting deadline has passed');
    process.exit(1);
  }

  // Check existing position
  const existingPos = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getPosition',
    args: [marketId, account.address],
  });

  if (existingPos.yesAmount > 0n || existingPos.noAmount > 0n) {
    console.error('❌ Already have a position on this market');
    console.log(`   YES: ${Number(existingPos.yesAmount) / 1e18} FLR`);
    console.log(`   NO: ${Number(existingPos.noAmount) / 1e18} FLR`);
    process.exit(1);
  }

  // Place bet
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Placing Bet');
  console.log('───────────────────────────────────────────────────────────────');

  const betAmount = parseEther('0.02'); // 0.02 FLR (just above min bet)
  console.log(`   Amount: 0.02 FLR`);
  console.log(`   Side: ${betYes ? 'YES' : 'NO'}`);

  try {
    const { request } = await publicClient.simulateContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'placeBet',
      args: [marketId, betYes],
      value: betAmount,
      account,
    });

    const txHash = await walletClient.writeContract(request);
    console.log(`   TX sent: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`   TX confirmed! Block: ${receipt.blockNumber}, Status: ${receipt.status}`);

    // Verify position
    const newPos = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getPosition',
      args: [marketId, account.address],
    });

    console.log();
    console.log(`✅ Bet placed successfully!`);
    console.log(`   Your position:`);
    console.log(`     YES: ${Number(newPos.yesAmount) / 1e18} FLR`);
    console.log(`     NO: ${Number(newPos.noAmount) / 1e18} FLR`);

    // Check updated pools
    const updatedMarket = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [marketId],
    });

    console.log(`   Updated pools:`);
    console.log(`     YES Pool: ${Number(updatedMarket.yesPool) / 1e18} FLR`);
    console.log(`     NO Pool: ${Number(updatedMarket.noPool) / 1e18} FLR`);
  } catch (error) {
    console.error('❌ Bet failed:', error);
    process.exit(1);
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Test complete!');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});


