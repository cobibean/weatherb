#!/usr/bin/env npx tsx
/**
 * Epic 4 — Coston2 Integration Test
 *
 * Tests:
 * 1. Contract connectivity
 * 2. Market creation
 * 3. Market query
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx scripts/test-coston2.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { flareTestnet } from 'viem/chains';

const CONTRACT_ADDRESS = '0xbc9b62E78D9F4da71F8063566b1b753b9aB2809a' as Hex;
const RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';

const WEATHER_MARKET_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'settler',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getMarketCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
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
    name: 'createMarket',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'cityId', type: 'bytes32' },
      { name: 'resolveTime', type: 'uint64' },
      { name: 'thresholdTenths', type: 'uint256' },
      { name: 'currency', type: 'address' },
    ],
    outputs: [{ name: 'marketId', type: 'uint256' }],
  },
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
    name: 'minBetWei',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'bettingBufferSeconds',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint64' }],
  },
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      { name: 'marketId', type: 'uint256', indexed: true },
      { name: 'cityId', type: 'bytes32', indexed: false },
      { name: 'resolveTime', type: 'uint64', indexed: false },
      { name: 'thresholdTenths', type: 'uint256', indexed: false },
      { name: 'currency', type: 'address', indexed: false },
    ],
  },
] as const;

const STATUS_LABELS = ['Open', 'Closed', 'Resolved', 'Cancelled'];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  WeatherB — Coston2 Integration Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  const privateKey = process.env['PRIVATE_KEY'];
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable required');
    console.log('   Usage: PRIVATE_KEY=0x... npx tsx scripts/test-coston2.ts');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as Hex);
  console.log(`📍 Wallet: ${account.address}`);
  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`📍 RPC: ${RPC_URL}`);
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

  // Test 1: Contract connectivity
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Test 1: Contract Connectivity');
  console.log('───────────────────────────────────────────────────────────────');

  try {
    const [owner, settler, marketCount, minBet, bettingBuffer] = await Promise.all([
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'owner',
      }),
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'settler',
      }),
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarketCount',
      }),
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'minBetWei',
      }),
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'bettingBufferSeconds',
      }),
    ]);

    console.log(`✅ Owner: ${owner}`);
    console.log(`✅ Settler: ${settler}`);
    console.log(`✅ Market Count: ${marketCount}`);
    console.log(`✅ Min Bet: ${Number(minBet) / 1e18} FLR`);
    console.log(`✅ Betting Buffer: ${bettingBuffer}s`);

    const isOwner = owner.toLowerCase() === account.address.toLowerCase();
    const isSettler = settler.toLowerCase() === account.address.toLowerCase();
    console.log();
    console.log(`   Your wallet is owner: ${isOwner ? '✅ YES' : '❌ NO'}`);
    console.log(`   Your wallet is settler: ${isSettler ? '✅ YES' : '❌ NO'}`);

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`   Your balance: ${Number(balance) / 1e18} C2FLR`);
    console.log();

    // List existing markets
    if (marketCount > 0n) {
      console.log('───────────────────────────────────────────────────────────────');
      console.log('  Existing Markets');
      console.log('───────────────────────────────────────────────────────────────');
      for (let i = 0n; i < marketCount; i++) {
        const market = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: WEATHER_MARKET_ABI,
          functionName: 'getMarket',
          args: [i],
        });
        console.log(`  Market #${i}:`);
        console.log(`    Status: ${STATUS_LABELS[market.status] ?? market.status}`);
        console.log(`    Threshold: ${Number(market.thresholdTenths) / 10}°F`);
        console.log(`    Resolve Time: ${new Date(Number(market.resolveTime) * 1000).toISOString()}`);
        console.log(`    YES Pool: ${Number(market.yesPool) / 1e18} FLR`);
        console.log(`    NO Pool: ${Number(market.noPool) / 1e18} FLR`);
      }
      console.log();
    }

    // Test 2: Create a test market (only if owner)
    if (isOwner && process.env['CREATE_MARKET'] === 'true') {
      console.log('───────────────────────────────────────────────────────────────');
      console.log('  Test 2: Create Market');
      console.log('───────────────────────────────────────────────────────────────');

      const cityId = keccak256(toBytes('nyc'));
      const resolveTime = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
      const thresholdTenths = 750n; // 75.0°F

      console.log(`   City ID: nyc → ${cityId}`);
      console.log(`   Resolve Time: ${new Date(Number(resolveTime) * 1000).toISOString()}`);
      console.log(`   Threshold: ${Number(thresholdTenths) / 10}°F`);

      const { request, result } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'createMarket',
        args: [cityId, resolveTime, thresholdTenths, '0x0000000000000000000000000000000000000000'],
        account,
      });

      console.log(`   Simulated marketId: ${result}`);

      const txHash = await walletClient.writeContract(request);
      console.log(`   TX sent: ${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`   TX confirmed! Block: ${receipt.blockNumber}, Status: ${receipt.status}`);

      const newMarketCount = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarketCount',
      });
      console.log(`✅ Market created! New count: ${newMarketCount}`);
      console.log();
    } else if (!isOwner) {
      console.log('⚠️  Skipping market creation (wallet is not owner)');
      console.log('   The deployer wallet owns the contract. Use that wallet to create markets.');
      console.log();
    } else {
      console.log('ℹ️  To create a test market, run with CREATE_MARKET=true');
      console.log('   PRIVATE_KEY=0x... CREATE_MARKET=true npx tsx scripts/test-coston2.ts');
      console.log();
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  All tests passed!');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});


