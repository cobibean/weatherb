#!/usr/bin/env npx tsx
/**
 * Debug Settler Configuration
 *
 * Diagnoses why markets aren't settling by comparing:
 * 1. The settler address registered in the contract
 * 2. The address derived from SETTLER_PRIVATE_KEY
 *
 * Also provides a fix command if they don't match.
 *
 * Usage:
 *   npx tsx scripts/debug/debug-settler.ts
 *
 * To fix the settler address:
 *   FIX_SETTLER=true npx tsx scripts/debug/debug-settler.ts
 */

import { config as dotenvConfig } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { flareTestnet } from 'viem/chains';

dotenvConfig({ path: '.env' });
dotenvConfig({ path: 'apps/web/.env.local', override: true });

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
    name: 'setSettler',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newSettler', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getMarketCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
] as const;

const STATUS_LABELS = ['Open', 'Closed', 'Resolved', 'Cancelled'];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  weatherB — Settler Debug Diagnostic');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  // Get environment variables
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const settlerPrivateKey = process.env.SETTLER_PRIVATE_KEY as Hex | undefined;
  const schedulerPrivateKey = process.env.SCHEDULER_PRIVATE_KEY as Hex | undefined;
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY as Hex | undefined;
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
  const fixSettler = process.env.FIX_SETTLER === 'true';

  console.log('📋 Environment Variables Check:');
  console.log(`   RPC_URL: ${rpcUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS: ${contractAddress ? contractAddress : '❌ Missing'}`);
  console.log(`   SETTLER_PRIVATE_KEY: ${settlerPrivateKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SCHEDULER_PRIVATE_KEY: ${schedulerPrivateKey ? '✅ Set' : '⚠️ Not set'}`);
  console.log(`   ADMIN_PRIVATE_KEY: ${adminPrivateKey ? '✅ Set' : '⚠️ Not set'}`);
  console.log(`   DEPLOYER_PRIVATE_KEY: ${deployerPrivateKey ? '✅ Set' : '⚠️ Not set'}`);
  console.log();

  if (!rpcUrl || !contractAddress) {
    console.error('❌ RPC_URL and NEXT_PUBLIC_CONTRACT_ADDRESS are required');
    process.exit(1);
  }

  // Create public client
  const publicClient = createPublicClient({
    chain: flareTestnet,
    transport: http(rpcUrl),
  });

  // Fetch on-chain settler and owner
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  On-Chain Contract State');
  console.log('───────────────────────────────────────────────────────────────');

  const [onChainSettler, onChainOwner, marketCount] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'settler',
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'owner',
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarketCount',
    }),
  ]);

  console.log(`   Contract: ${contractAddress}`);
  console.log(`   Owner:    ${onChainOwner}`);
  console.log(`   Settler:  ${onChainSettler}`);
  console.log(`   Markets:  ${marketCount}`);
  console.log();

  // Derive addresses from private keys
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Wallet Address Derivations');
  console.log('───────────────────────────────────────────────────────────────');

  const derivedAddresses: { name: string; address: string; isOwner: boolean; isSettler: boolean }[] = [];

  if (settlerPrivateKey) {
    const account = privateKeyToAccount(settlerPrivateKey);
    const isOwner = account.address.toLowerCase() === (onChainOwner as string).toLowerCase();
    const isSettler = account.address.toLowerCase() === (onChainSettler as string).toLowerCase();
    derivedAddresses.push({ name: 'SETTLER_PRIVATE_KEY', address: account.address, isOwner, isSettler });
    console.log(`   SETTLER_PRIVATE_KEY → ${account.address}`);
    console.log(`      - Is On-Chain Settler: ${isSettler ? '✅ YES' : '❌ NO'}`);
    console.log(`      - Is On-Chain Owner:   ${isOwner ? '✅ YES' : '⚠️ NO'}`);
  }

  if (schedulerPrivateKey) {
    const account = privateKeyToAccount(schedulerPrivateKey);
    const isOwner = account.address.toLowerCase() === (onChainOwner as string).toLowerCase();
    const isSettler = account.address.toLowerCase() === (onChainSettler as string).toLowerCase();
    derivedAddresses.push({ name: 'SCHEDULER_PRIVATE_KEY', address: account.address, isOwner, isSettler });
    console.log(`   SCHEDULER_PRIVATE_KEY → ${account.address}`);
    console.log(`      - Is On-Chain Settler: ${isSettler ? '✅ YES' : '❌ NO'}`);
    console.log(`      - Is On-Chain Owner:   ${isOwner ? '✅ YES' : '⚠️ NO'}`);
  }

  if (adminPrivateKey) {
    const account = privateKeyToAccount(adminPrivateKey);
    const isOwner = account.address.toLowerCase() === (onChainOwner as string).toLowerCase();
    const isSettler = account.address.toLowerCase() === (onChainSettler as string).toLowerCase();
    derivedAddresses.push({ name: 'ADMIN_PRIVATE_KEY', address: account.address, isOwner, isSettler });
    console.log(`   ADMIN_PRIVATE_KEY → ${account.address}`);
    console.log(`      - Is On-Chain Settler: ${isSettler ? '✅ YES' : '❌ NO'}`);
    console.log(`      - Is On-Chain Owner:   ${isOwner ? '✅ YES' : '⚠️ NO'}`);
  }

  if (deployerPrivateKey) {
    const account = privateKeyToAccount(deployerPrivateKey);
    const isOwner = account.address.toLowerCase() === (onChainOwner as string).toLowerCase();
    const isSettler = account.address.toLowerCase() === (onChainSettler as string).toLowerCase();
    derivedAddresses.push({ name: 'DEPLOYER_PRIVATE_KEY', address: account.address, isOwner, isSettler });
    console.log(`   DEPLOYER_PRIVATE_KEY → ${account.address}`);
    console.log(`      - Is On-Chain Settler: ${isSettler ? '✅ YES' : '❌ NO'}`);
    console.log(`      - Is On-Chain Owner:   ${isOwner ? '✅ YES' : '⚠️ NO'}`);
  }

  console.log();

  // Check diagnosis
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Diagnosis');
  console.log('───────────────────────────────────────────────────────────────');

  const settlerEntry = derivedAddresses.find(d => d.name === 'SETTLER_PRIVATE_KEY');
  const ownerEntry = derivedAddresses.find(d => d.isOwner);

  if (!settlerPrivateKey) {
    console.log('   ❌ SETTLER_PRIVATE_KEY is not set');
    console.log('   ➡️  Add SETTLER_PRIVATE_KEY to your environment');
    process.exit(1);
  }

  if (settlerEntry?.isSettler) {
    console.log('   ✅ SETTLER_PRIVATE_KEY matches on-chain settler address');
    console.log('   ➡️  Settlement should work. Check other issues:');
    console.log('      - Is the cron job running? Check Vercel logs');
    console.log('      - Is there a weather API issue? Check provider');
    console.log('      - Is there a gas issue? Check wallet balance');
  } else {
    console.log('   ❌ SETTLER_PRIVATE_KEY does NOT match on-chain settler!');
    console.log();
    console.log(`   Expected settler address: ${onChainSettler}`);
    console.log(`   SETTLER_PRIVATE_KEY produces: ${settlerEntry?.address}`);
    console.log();

    if (ownerEntry) {
      console.log(`   🔧 FIX: The owner (${ownerEntry.name}) can update the settler.`);
      console.log();
      if (fixSettler && ownerEntry) {
        console.log('   📝 Updating settler address on-chain...');
        
        const ownerKey = ownerEntry.name === 'SETTLER_PRIVATE_KEY' ? settlerPrivateKey :
                        ownerEntry.name === 'SCHEDULER_PRIVATE_KEY' ? schedulerPrivateKey :
                        ownerEntry.name === 'ADMIN_PRIVATE_KEY' ? adminPrivateKey :
                        deployerPrivateKey;

        if (!ownerKey) {
          console.error('   ❌ Owner private key not available');
          process.exit(1);
        }

        const ownerAccount = privateKeyToAccount(ownerKey);
        const walletClient = createWalletClient({
          chain: flareTestnet,
          transport: http(rpcUrl),
          account: ownerAccount,
        });

        const newSettlerAddress = privateKeyToAccount(settlerPrivateKey).address;

        try {
          const { request } = await publicClient.simulateContract({
            address: contractAddress,
            abi: WEATHER_MARKET_ABI,
            functionName: 'setSettler',
            args: [newSettlerAddress],
            account: ownerAccount,
          });

          const txHash = await walletClient.writeContract(request);
          console.log(`   TX sent: ${txHash}`);

          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          console.log(`   TX confirmed! Block: ${receipt.blockNumber}`);
          console.log();
          console.log(`   ✅ Settler updated to: ${newSettlerAddress}`);
        } catch (error) {
          console.error('   ❌ Failed to update settler:', error);
          process.exit(1);
        }
      } else {
        console.log('   ➡️  To fix automatically, run:');
        console.log('      FIX_SETTLER=true npx tsx scripts/debug/debug-settler.ts');
      }
    } else {
      console.log('   ⚠️  No private key available that matches the owner.');
      console.log('   ➡️  Add DEPLOYER_PRIVATE_KEY, ADMIN_PRIVATE_KEY, or SCHEDULER_PRIVATE_KEY');
    }
  }

  console.log();

  // Show pending markets
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Pending Markets (need settlement)');
  console.log('───────────────────────────────────────────────────────────────');

  const nowSec = Math.floor(Date.now() / 1000);
  let pendingCount = 0;

  for (let i = 0n; i < marketCount; i++) {
    const market = await publicClient.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [i],
    });

    const status = market.status;
    const resolveTime = Number(market.resolveTime);
    const statusLabel = STATUS_LABELS[status];

    // Only show Open/Closed markets that should be resolved
    if ((status === 0 || status === 1) && resolveTime <= nowSec) {
      pendingCount++;
      const yesPool = Number(market.yesPool) / 1e18;
      const noPool = Number(market.noPool) / 1e18;
      const timeSinceResolve = nowSec - resolveTime;
      const minutesAgo = Math.floor(timeSinceResolve / 60);
      
      console.log(`   Market #${i}: ${statusLabel}`);
      console.log(`      Resolve time: ${new Date(resolveTime * 1000).toISOString()} (${minutesAgo} min ago)`);
      console.log(`      Threshold: ${Number(market.thresholdTenths) / 10}°F`);
      console.log(`      Pools: YES=${yesPool.toFixed(3)} FLR, NO=${noPool.toFixed(3)} FLR`);
      console.log();
    }
  }

  if (pendingCount === 0) {
    console.log('   No markets currently need settlement.');
  } else {
    console.log(`   Total: ${pendingCount} market(s) need settlement`);
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Diagnostic complete!');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
