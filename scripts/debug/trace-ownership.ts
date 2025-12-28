#!/usr/bin/env npx tsx
/**
 * Trace Ownership Changes
 *
 * Queries the blockchain to find transactions that called:
 * - transferOwnership()
 * - setSettler()
 *
 * This helps diagnose how ownership/settler got changed.
 */

import { config as dotenvConfig } from 'dotenv';
import {
  createPublicClient,
  http,
  type Hex,
  decodeEventLog,
  parseAbiItem,
  keccak256,
  toBytes,
} from 'viem';
import { flareTestnet } from 'viem/chains';

dotenvConfig({ path: '.env' });
dotenvConfig({ path: 'apps/web/.env.local', override: true });

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xA56C89B892e7A1B84ee78d97c7543ce726aabBFc') as Hex;
const RPC_URL = process.env.RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc';

// Function selectors for key admin functions
const FUNCTION_SELECTORS = {
  transferOwnership: keccak256(toBytes('transferOwnership(address)')).slice(0, 10),
  setSettler: keccak256(toBytes('setSettler(address)')).slice(0, 10),
};

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  WeatherB — Ownership & Settler Trace');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`📍 RPC: ${RPC_URL}`);
  console.log();

  console.log('Function selectors:');
  console.log(`   transferOwnership: ${FUNCTION_SELECTORS.transferOwnership}`);
  console.log(`   setSettler: ${FUNCTION_SELECTORS.setSettler}`);
  console.log();

  const publicClient = createPublicClient({
    chain: flareTestnet,
    transport: http(RPC_URL),
  });

  // Get the latest block to scan from
  const latestBlock = await publicClient.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);
  console.log();

  // We need to scan transaction history. Let's get all transactions to this contract.
  // Unfortunately, standard RPC doesn't have a way to get all transactions to a contract.
  // We'll need to use the explorer API or scan blocks.

  // For now, let's just check the current state and check if there's an explorer we can use
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Current On-Chain State');
  console.log('───────────────────────────────────────────────────────────────');

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
  ] as const;

  const [owner, settler] = await Promise.all([
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
  ]);

  console.log(`   Owner:   ${owner}`);
  console.log(`   Settler: ${settler}`);
  console.log();

  // Check Coston2 explorer link
  const explorerUrl = `https://coston2-explorer.flare.network/address/${CONTRACT_ADDRESS}`;
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Manual Investigation');
  console.log('───────────────────────────────────────────────────────────────');
  console.log();
  console.log('   To see all transactions to this contract, visit:');
  console.log(`   ${explorerUrl}`);
  console.log();
  console.log('   Look for transactions with method:');
  console.log('   - transferOwnership');
  console.log('   - setSettler');
  console.log();

  // Let's also check if maybe there was a different contract deployed
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Checking Deployment History');
  console.log('───────────────────────────────────────────────────────────────');
  
  // Get the creation transaction
  const creationTx = await publicClient.getTransaction({
    hash: '0x15e523dc9ac6e7dabcfc29f4255f96be2b88be060b51c18ac6498a3a20a7b647' as Hex,
  }).catch(() => null);

  if (creationTx) {
    console.log(`   Creation TX: ${creationTx.hash}`);
    console.log(`   From: ${creationTx.from}`);
    console.log(`   Block: ${creationTx.blockNumber}`);
  } else {
    console.log('   Could not fetch creation transaction');
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Recommendations');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log('   1. Check the explorer link above for transferOwnership/setSettler calls');
  console.log();
  console.log('   2. If you have the private key for the current owner:');
  console.log(`      ${owner}`);
  console.log('      Run: FIX_SETTLER=true OWNER_PRIVATE_KEY=0x... npx tsx scripts/fix-settler.ts');
  console.log();
  console.log('   3. If the current owner is a compromised/lost wallet,');
  console.log('      you may need to redeploy the contract.');
  console.log();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
