#!/usr/bin/env npx tsx
/**
 * Generate a treasury wallet address and private key
 *
 * Usage: npx tsx src/scripts/create-treasury.ts
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log('Treasury Wallet Generated');
console.log('========================');
console.log(`Address: ${account.address}`);
console.log(`Private Key: ${privateKey}`);
console.log('');
console.log('Add to .env:');
console.log(`TREASURY_PRIVATE_KEY=${privateKey}`);
console.log('');
console.log('Fund this wallet manually via:');
console.log('https://faucet.flare.network/coston2');
