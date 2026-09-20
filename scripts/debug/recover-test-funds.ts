import { requireDatabaseUrl } from '@weatherb/shared/utils/database-url';
import { PrismaPg } from '@prisma/adapter-pg';
#!/usr/bin/env npx tsx
/**
 * Fund Recovery Script for Audition City Test Markets
 * 
 * This script:
 * 1. Finds TestRuns with available wallet keys (keysDisposed: false)
 * 2. Decrypts the wallet keys
 * 3. Claims winnings from resolved markets
 * 4. Sweeps all funds back to the admin wallet
 * 
 * Usage:
 *   npx tsx scripts/debug/recover-test-funds.ts [--dry-run]
 */
import { config as dotenvConfig } from 'dotenv';
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  formatEther, 
  parseEther,
  type Hex 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PrismaClient } from '@prisma/client';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { decryptWalletKeys } from '../../apps/web/src/lib/test-wallets';

dotenvConfig({ path: '.env' });

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;
const ADMIN_WALLET = process.env.ADMIN_ADDRESS as Hex || '0x5d92A2486042Dd4cEE0BD6B5ffd98a8C3A6EA4Fe';

if (!RPC_URL || !CONTRACT_ADDRESS) {
  console.error('Missing required environment variables: RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireDatabaseUrl(), connectionTimeoutMillis: 5000 }) });
const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled', 'NoWinners'] as const;

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('💰 Fund Recovery Script for Audition City Test Markets');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no transactions)' : '⚡ LIVE (will submit transactions)'}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Admin Wallet: ${ADMIN_WALLET}`);
  console.log(`RPC: ${RPC_URL}\n`);

  const publicClient = createPublicClient({ transport: http(RPC_URL) });

  // Step 1: Find TestRuns with available keys
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 STEP 1: Finding TestRuns with available wallet keys...');
  console.log('═══════════════════════════════════════════════════════════\n');

  const testRuns = await prisma.testRun.findMany({
    where: { keysDisposed: false },
    include: {
      markets: true,
      suggestion: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${testRuns.length} TestRuns with available keys\n`);

  if (testRuns.length === 0) {
    console.log('❌ No TestRuns with available keys found.');
    console.log('   Keys may have been disposed or no test runs exist.');
    await prisma.$disconnect();
    return;
  }

  // Step 2: Process each TestRun
  let totalRecovered = 0n;
  let totalClaimed = 0n;
  const results: Array<{
    testRunId: string;
    suggestionCity: string;
    walletsProcessed: number;
    claimed: string;
    recovered: string;
    errors: string[];
  }> = [];

  for (const testRun of testRuns) {
    console.log('────────────────────────────────────────────────────────────');
    console.log(`🧪 TestRun: ${testRun.id}`);
    console.log(`   City: ${testRun.suggestion?.customCityName || 'Unknown'}`);
    console.log(`   Status: ${testRun.status}`);
    console.log(`   Markets: ${testRun.markets.length}`);
    console.log('────────────────────────────────────────────────────────────\n');

    const errors: string[] = [];
    let runClaimed = 0n;
    let runRecovered = 0n;

    // Decrypt wallet keys
    let wallets;
    try {
      wallets = decryptWalletKeys(testRun.walletKeys);
      console.log(`   ✅ Decrypted ${wallets.length} wallet keys\n`);
    } catch (error) {
      const msg = `Failed to decrypt keys: ${error instanceof Error ? error.message : String(error)}`;
      console.log(`   ❌ ${msg}\n`);
      errors.push(msg);
      results.push({
        testRunId: testRun.id,
        suggestionCity: testRun.suggestion?.customCityName || 'Unknown',
        walletsProcessed: 0,
        claimed: '0',
        recovered: '0',
        errors,
      });
      continue;
    }

    // Process each wallet
    for (const wallet of wallets) {
      console.log(`   👛 Wallet: ${wallet.address}`);

      // Check balance
      const balance = await publicClient.getBalance({ address: wallet.address });
      console.log(`      Balance: ${formatEther(balance)} FLR`);

      // Check for claimable winnings in each market
      for (const market of testRun.markets) {
        try {
          // Get on-chain market status
          const onChainMarket = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WEATHER_MARKET_ABI,
            functionName: 'getMarket',
            args: [BigInt(market.contractMarketId)],
          });

          const status = STATUS_MAP[Number(onChainMarket.status)] ?? 'Unknown';
          
          // Skip non-resolved markets
          if (status !== 'Resolved' && status !== 'Cancelled' && status !== 'NoWinners') {
            continue;
          }

          // Check position
          const position = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WEATHER_MARKET_ABI,
            functionName: 'getPosition',
            args: [BigInt(market.contractMarketId), wallet.address],
          });

          const hasPosition = position.yesAmount > 0n || position.noAmount > 0n;
          if (!hasPosition) continue;

          // Check if already claimed
          if (position.claimed) {
            console.log(`      Market ${market.contractMarketId}: Already claimed`);
            continue;
          }

          // Calculate payout
          const payout = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WEATHER_MARKET_ABI,
            functionName: 'calculatePayout',
            args: [BigInt(market.contractMarketId), wallet.address],
          }) as bigint;

          if (payout === 0n) {
            console.log(`      Market ${market.contractMarketId}: No payout (lost or no winners)`);
            continue;
          }

          console.log(`      Market ${market.contractMarketId}: Claimable ${formatEther(payout)} FLR`);

          if (isDryRun) {
            console.log(`      🔍 DRY RUN: Would claim ${formatEther(payout)} FLR`);
            runClaimed += payout;
            continue;
          }

          // Claim winnings
          const account = privateKeyToAccount(wallet.privateKey);
          const walletClient = createWalletClient({ transport: http(RPC_URL), account });

          try {
            const { request } = await publicClient.simulateContract({
              address: CONTRACT_ADDRESS,
              abi: WEATHER_MARKET_ABI,
              functionName: 'claim',
              args: [BigInt(market.contractMarketId)],
              account: walletClient.account!,
            });

            const txHash = await walletClient.writeContract(request);
            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

            if (receipt.status === 'success') {
              console.log(`      ✅ Claimed! TX: ${txHash}`);
              runClaimed += payout;
            } else {
              throw new Error('Transaction failed');
            }
          } catch (claimError) {
            const msg = `Failed to claim market ${market.contractMarketId}: ${claimError instanceof Error ? claimError.message : String(claimError)}`;
            console.log(`      ❌ ${msg}`);
            errors.push(msg);
          }

        } catch (error) {
          const msg = `Error processing market ${market.contractMarketId}: ${error instanceof Error ? error.message : String(error)}`;
          console.log(`      ❌ ${msg}`);
          errors.push(msg);
        }
      }

      // Sweep remaining balance to admin
      const newBalance = await publicClient.getBalance({ address: wallet.address });
      
      if (newBalance > 0n) {
        // Estimate gas for transfer
        const gasPrice = await publicClient.getGasPrice();
        const gasLimit = 21000n; // Standard ETH transfer
        const gasCost = gasPrice * gasLimit;

        if (newBalance > gasCost) {
          const sweepAmount = newBalance - gasCost;
          console.log(`      💸 Sweeping ${formatEther(sweepAmount)} FLR to admin...`);

          if (isDryRun) {
            console.log(`      🔍 DRY RUN: Would sweep ${formatEther(sweepAmount)} FLR`);
            runRecovered += sweepAmount;
          } else {
            try {
              const account = privateKeyToAccount(wallet.privateKey);
              const walletClient = createWalletClient({ transport: http(RPC_URL), account });

              const txHash = await walletClient.sendTransaction({
                account: walletClient.account!,
                to: ADMIN_WALLET,
                value: sweepAmount,
                chain: null,
              });

              const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

              if (receipt.status === 'success') {
                console.log(`      ✅ Swept! TX: ${txHash}`);
                runRecovered += sweepAmount;
              } else {
                throw new Error('Transaction failed');
              }
            } catch (sweepError) {
              const msg = `Failed to sweep: ${sweepError instanceof Error ? sweepError.message : String(sweepError)}`;
              console.log(`      ❌ ${msg}`);
              errors.push(msg);
            }
          }
        } else {
          console.log(`      ⚠️  Balance ${formatEther(newBalance)} FLR too low to cover gas`);
        }
      }

      console.log('');
    }

    totalClaimed += runClaimed;
    totalRecovered += runRecovered;

    results.push({
      testRunId: testRun.id,
      suggestionCity: testRun.suggestion?.customCityName || 'Unknown',
      walletsProcessed: wallets.length,
      claimed: formatEther(runClaimed),
      recovered: formatEther(runRecovered),
      errors,
    });
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Total TestRuns processed: ${results.length}`);
  console.log(`Total claimed: ${formatEther(totalClaimed)} FLR`);
  console.log(`Total recovered to admin: ${formatEther(totalRecovered)} FLR`);

  const withErrors = results.filter(r => r.errors.length > 0);
  if (withErrors.length > 0) {
    console.log(`\n⚠️  ${withErrors.length} TestRuns had errors:`);
    for (const r of withErrors) {
      console.log(`   - ${r.suggestionCity}: ${r.errors.join(', ')}`);
    }
  }

  console.log('\n📋 Per-TestRun breakdown:');
  for (const r of results) {
    console.log(`   ${r.suggestionCity}: ${r.walletsProcessed} wallets, claimed ${r.claimed} FLR, recovered ${r.recovered} FLR`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
