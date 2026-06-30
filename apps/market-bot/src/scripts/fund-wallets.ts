#!/usr/bin/env npx tsx
/**
 * Fund all bot wallets from treasury
 *
 * Usage: npx tsx src/scripts/fund-wallets.ts
 */

import { formatEther, parseEther, type Hex } from 'viem';
import { prisma } from '../db.js';
import { publicClient, getTreasuryClient } from '../clients.js';

const INITIAL_FUNDING = parseEther('100'); // 100 FLR per wallet

async function main() {
  console.log('Fund All Bot Wallets');
  console.log('====================\n');

  const treasury = getTreasuryClient();
  const treasuryAddress = treasury.account!.address;

  // Check treasury balance
  const treasuryBalance = await publicClient.getBalance({ address: treasuryAddress });
  console.log(`Treasury: ${treasuryAddress}`);
  console.log(`Treasury Balance: ${formatEther(treasuryBalance)} FLR\n`);

  // Get all wallets
  const wallets = await prisma.botWallet.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${wallets.length} wallets to fund\n`);

  const totalRequired = INITIAL_FUNDING * BigInt(wallets.length);
  if (treasuryBalance < totalRequired) {
    console.error('ERROR: Insufficient treasury balance!');
    console.error(`Required: ${formatEther(totalRequired)} FLR`);
    console.error(`Available: ${formatEther(treasuryBalance)} FLR`);
    process.exit(1);
  }

  let funded = 0;
  let skipped = 0;

  for (const wallet of wallets) {
    const address = wallet.address as Hex;
    const currentBalance = await publicClient.getBalance({ address });

    // Skip if already has sufficient balance
    if (currentBalance >= INITIAL_FUNDING / 2n) {
      console.log(`Skip ${address} (balance: ${formatEther(currentBalance)} FLR)`);
      skipped++;
      continue;
    }

    console.log(`Funding ${address}...`);

    try {
      const txHash = await treasury.sendTransaction({
        account: treasury.account!,
        chain: treasury.chain,
        to: address,
        value: INITIAL_FUNDING,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        console.log(`  ✅ Sent ${formatEther(INITIAL_FUNDING)} FLR (tx: ${txHash})`);

        await prisma.botFunding.create({
          data: {
            walletId: wallet.id,
            amountFlr: Number(formatEther(INITIAL_FUNDING)),
            txHash,
          },
        });

        funded++;
      } else {
        console.log(`  ❌ Transaction reverted: ${txHash}`);
      }
    } catch (error) {
      console.error('  ❌ Failed:', error);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('\nComplete!');
  console.log(`  Funded: ${funded}`);
  console.log(`  Skipped: ${skipped}`);

  const finalTreasuryBalance = await publicClient.getBalance({ address: treasuryAddress });
  console.log(`  Treasury remaining: ${formatEther(finalTreasuryBalance)} FLR`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
