#!/usr/bin/env npx tsx
/**
 * Test the wallet manager in isolation
 *
 * Usage: npx tsx src/scripts/test-wallet-manager.ts
 */

import { formatEther } from 'viem';
import {
  initializeWalletManager,
  getNextWallet,
  getWalletStats,
  getBalance,
  getTreasuryBalance,
} from '../wallet-manager.js';
import { prisma } from '../db.js';

async function main() {
  console.log('Wallet Manager Test');
  console.log('===================\n');

  // Initialize
  await initializeWalletManager();

  // Show stats
  const stats = await getWalletStats();
  console.log('\nWallet Stats:');
  console.log(`  Total: ${stats.total}`);
  console.log(`  Active: ${stats.active}`);
  console.log(`  Low Balance: ${stats.lowBalance}`);
  console.log(`  Disabled: ${stats.disabled}`);
  console.log(`  Treasury: ${stats.treasuryBalance} FLR`);

  // Test round-robin selection
  console.log('\nRound-robin selection test (5 iterations):');
  for (let i = 0; i < 5; i++) {
    const wallet = await getNextWallet();
    if (wallet) {
      const balance = await getBalance(wallet.address);
      console.log(`  ${i + 1}. ${wallet.address} (${formatEther(balance)} FLR)`);
    } else {
      console.log(`  ${i + 1}. No wallet available!`);
    }
  }

  // Check treasury
  console.log('\nTreasury Check:');
  const treasuryBalance = await getTreasuryBalance();
  console.log(`  Balance: ${formatEther(treasuryBalance)} FLR`);

  if (treasuryBalance < 500n * 10n ** 18n) {
    console.log('  ⚠️  WARNING: Treasury balance low!');
  } else {
    console.log('  ✅ Treasury balance OK');
  }

  console.log('\n✅ Wallet manager test complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
