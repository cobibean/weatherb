#!/usr/bin/env npx tsx
/**
 * Initialize bot wallets - run once to generate and store encrypted wallets
 *
 * Usage: WALLET_COUNT=25 npx tsx src/scripts/init-wallets.ts
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createCipheriv, randomBytes, createHash } from 'crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(config.magicLinkSecret).digest();
}

function encryptPrivateKey(privateKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function main() {
  const count = config.walletCount;
  console.log(`Generating ${count} bot wallets...`);

  // Check if wallets already exist
  const existingCount = await prisma.botWallet.count();
  if (existingCount > 0) {
    console.log(`Found ${existingCount} existing wallets. Skipping generation.`);
    console.log('To regenerate, delete existing BotWallet records first.');
    return;
  }

  const wallets = [];

  for (let i = 0; i < count; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const encryptedKey = encryptPrivateKey(privateKey);

    wallets.push({
      address: account.address,
      encryptedKey,
    });

    console.log(`  ${i + 1}. ${account.address}`);
  }

  // Batch insert
  await prisma.botWallet.createMany({
    data: wallets,
  });

  console.log(`\n✅ Created ${count} bot wallets`);
  console.log('\nNext steps:');
  console.log('1. Fund treasury wallet manually via faucet');
  console.log('2. Run funding script to distribute to bot wallets');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
