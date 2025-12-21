#!/usr/bin/env npx tsx
/**
 * Epic 4 — Settlement Test
 *
 * Tests the settlement flow for resolved markets
 *
 * Usage:
 *   PRIVATE_KEY=0x... MARKET_ID=22 npx tsx scripts/test-settlement.ts
 *
 * Options:
 *   CANCEL=true - Test cancel flow instead of resolve
 */

import { config as dotenvConfig } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
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
    name: 'settler',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
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
    name: 'cancelMarketBySettler',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'resolveMarket',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'proof', type: 'bytes' },
      { name: 'attestationData', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

const STATUS_LABELS = ['Open', 'Closed', 'Resolved', 'Cancelled'];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  WeatherB — Settlement Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  const privateKey = process.env['PRIVATE_KEY'];
  const marketIdStr = process.env['MARKET_ID'];
  const cancelMode = process.env['CANCEL'] === 'true';

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
  console.log(`📍 Mode: ${cancelMode ? 'CANCEL' : 'RESOLVE'}`);
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

  // Check if wallet is settler
  const settler = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'settler',
  });

  const isSettler = settler.toLowerCase() === account.address.toLowerCase();
  console.log(`   Contract settler: ${settler}`);
  console.log(`   You are settler: ${isSettler ? '✅ YES' : '❌ NO'}`);

  if (!isSettler) {
    console.error('\n❌ Only the settler can resolve/cancel markets');
    process.exit(1);
  }

  // Check market status
  const market = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarket',
    args: [marketId],
  });

  console.log();
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Market Details');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Status: ${STATUS_LABELS[market.status]}`);
  console.log(`  Threshold: ${Number(market.thresholdTenths) / 10}°F`);
  console.log(`  Resolve Time: ${new Date(Number(market.resolveTime) * 1000).toISOString()}`);
  console.log(`  YES Pool: ${Number(market.yesPool) / 1e18} FLR`);
  console.log(`  NO Pool: ${Number(market.noPool) / 1e18} FLR`);

  const nowSec = Math.floor(Date.now() / 1000);
  const resolveTimeSec = Number(market.resolveTime);
  const timeUntilResolve = resolveTimeSec - nowSec;

  if (timeUntilResolve > 0) {
    console.log(`  Time until resolve: ${Math.floor(timeUntilResolve / 60)}m ${timeUntilResolve % 60}s`);
  } else {
    console.log(`  ⏰ Resolve time passed ${Math.abs(timeUntilResolve)}s ago`);
  }

  // Can only settle after resolve time
  if (timeUntilResolve > 0) {
    console.log();
    console.log('⏳ Cannot settle yet - resolve time not reached');
    console.log(`   Wait ${Math.floor(timeUntilResolve / 60)} minutes and ${timeUntilResolve % 60} seconds`);
    process.exit(0);
  }

  // Status must be Open or Closed
  if (market.status !== 0 && market.status !== 1) {
    console.log();
    console.log(`❌ Market already ${STATUS_LABELS[market.status]}`);
    process.exit(1);
  }

  console.log();
  console.log('───────────────────────────────────────────────────────────────');

  if (cancelMode) {
    console.log('  Cancelling Market');
    console.log('───────────────────────────────────────────────────────────────');

    try {
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: WEATHER_MARKET_ABI,
        functionName: 'cancelMarketBySettler',
        args: [marketId],
        account,
      });

      const txHash = await walletClient.writeContract(request);
      console.log(`   TX sent: ${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`   TX confirmed! Block: ${receipt.blockNumber}, Status: ${receipt.status}`);

      console.log();
      console.log('✅ Market cancelled! Bettors can now claim refunds.');
    } catch (error) {
      console.error('❌ Cancel failed:', error);
      process.exit(1);
    }
  } else {
    console.log('  Resolving Market (FDC)');
    console.log('───────────────────────────────────────────────────────────────');
    console.log();
    console.log('⚠️  FDC Resolution requires:');
    console.log('   1. A working weather API endpoint');
    console.log('   2. FDC Hub to process Web2Json attestation');
    console.log('   3. Valid Merkle proof from FDC');
    console.log();
    console.log('   For testnet testing, the FDC Hub may require:');
    console.log('   - Specific endpoint configuration');
    console.log('   - Test mode or mock data');
    console.log();

    // For now, demonstrate what the resolve call would look like
    console.log('   Demonstrating resolve call with mock data...');

    // Create mock attestation data
    const mockCityId = market.cityId;
    const mockObservedTimestamp = BigInt(resolveTimeSec + 60); // 1 minute after resolve
    const mockTempTenths = 800n; // 80.0°F (above 75°F threshold = YES wins)

    const attestationData = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint64' }, { type: 'uint256' }],
      [mockCityId, mockObservedTimestamp, mockTempTenths],
    );

    console.log(`   Mock attestation:`);
    console.log(`     City ID: ${mockCityId}`);
    console.log(`     Observed Time: ${new Date(Number(mockObservedTimestamp) * 1000).toISOString()}`);
    console.log(`     Temperature: ${Number(mockTempTenths) / 10}°F`);
    console.log(`     Outcome: ${mockTempTenths >= market.thresholdTenths ? 'YES wins' : 'NO wins'}`);
    console.log();

    // Note: We can't actually resolve without a valid FDC proof
    console.log('   ℹ️  Actual resolution requires valid FDC proof.');
    console.log('   ℹ️  The settler service will handle this automatically.');
    console.log();
    console.log('   To test the cancel flow instead:');
    console.log('   PRIVATE_KEY=0x... MARKET_ID=22 CANCEL=true npx tsx scripts/test-settlement.ts');
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


