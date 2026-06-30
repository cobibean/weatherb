import { type Hex, formatEther, parseEther } from 'viem';
import { prisma } from './db.js';
import { publicClient, getTreasuryClient, createBotWalletClient } from './clients.js';
import { config } from './config.js';
import { decryptPrivateKey } from './crypto.js';
import type { DecryptedWallet, WalletStatus } from './types.js';

let walletCache: DecryptedWallet[] = [];
let currentWalletIndex = 0;

const MIN_BALANCE_WEI = parseEther(config.minWalletBalanceFlr.toString());
const FUNDING_AMOUNT_WEI = parseEther(config.fundingAmountFlr.toString());

/**
 * Initialize wallet manager - load and decrypt all wallets
 */
export async function initializeWalletManager(): Promise<void> {
  console.log('[WalletManager] Initializing...');

  const wallets = await prisma.botWallet.findMany({
    where: { status: { not: 'disabled' } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[WalletManager] Found ${wallets.length} wallets in database`);

  walletCache = wallets.map((wallet) => ({
    id: wallet.id,
    address: wallet.address as Hex,
    privateKey: decryptPrivateKey(wallet.encryptedKey) as Hex,
    status: wallet.status as WalletStatus,
  }));

  console.log(`[WalletManager] Decrypted ${walletCache.length} wallets`);

  await refreshAllBalances();
}

/**
 * Get next wallet using round-robin selection.
 * Skips wallets with low balance (requests funding in background).
 * Returns null if no wallets available.
 */
export async function getNextWallet(): Promise<DecryptedWallet | null> {
  if (walletCache.length === 0) {
    console.error('[WalletManager] No wallets available');
    return null;
  }

  for (let attempts = 0; attempts < walletCache.length; attempts++) {
    const wallet = walletCache[currentWalletIndex % walletCache.length];
    currentWalletIndex++;

    if (wallet.status === 'disabled') {
      continue;
    }

    const balance = await getBalance(wallet.address);

    if (balance >= MIN_BALANCE_WEI) {
      return wallet;
    }

    console.log(`[WalletManager] Wallet ${wallet.address} low balance: ${formatEther(balance)} FLR`);
    requestFunding(wallet).catch((err) => {
      console.error(`[WalletManager] Funding request failed for ${wallet.address}:`, err);
    });
  }

  console.error('[WalletManager] All wallets have low balance');
  return null;
}

/**
 * Get a specific wallet by address
 */
export function getWalletByAddress(address: string): DecryptedWallet | undefined {
  return walletCache.find((w) => w.address.toLowerCase() === address.toLowerCase());
}

/**
 * Get wallet balance from chain
 */
export async function getBalance(address: Hex): Promise<bigint> {
  return await publicClient.getBalance({ address });
}

/**
 * Get treasury balance
 */
export async function getTreasuryBalance(): Promise<bigint> {
  const treasury = getTreasuryClient();
  return await publicClient.getBalance({ address: treasury.account!.address });
}

/**
 * Request funding from treasury for a wallet
 */
async function requestFunding(wallet: DecryptedWallet): Promise<void> {
  console.log(`[WalletManager] Requesting funding for ${wallet.address}...`);

  const treasuryBalance = await getTreasuryBalance();
  if (treasuryBalance < FUNDING_AMOUNT_WEI * 2n) {
    console.error(
      `[WalletManager] CRITICAL: Treasury low! Balance: ${formatEther(treasuryBalance)} FLR`
    );
    await updateWalletStatus(wallet.id, 'low_balance');
    return;
  }

  const treasury = getTreasuryClient();

  try {
    const txHash = await treasury.sendTransaction({
      account: treasury.account!,
      chain: treasury.chain,
      to: wallet.address,
      value: FUNDING_AMOUNT_WEI,
    });

    console.log(`[WalletManager] Funding tx sent: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'success') {
      console.log(`[WalletManager] Funding confirmed for ${wallet.address}`);

      await prisma.botFunding.create({
        data: {
          walletId: wallet.id,
          amountFlr: config.fundingAmountFlr,
          txHash,
        },
      });

      await updateWalletStatus(wallet.id, 'active');
      wallet.status = 'active';
    } else {
      console.error(`[WalletManager] Funding tx reverted: ${txHash}`);
      await updateWalletStatus(wallet.id, 'low_balance');
    }
  } catch (error) {
    console.error('[WalletManager] Funding failed:', error);
    await updateWalletStatus(wallet.id, 'low_balance');
    throw error;
  }
}

/**
 * Update wallet status in database and cache
 */
async function updateWalletStatus(walletId: string, status: WalletStatus): Promise<void> {
  await prisma.botWallet.update({
    where: { id: walletId },
    data: { status, updatedAt: new Date() },
  });

  const cached = walletCache.find((w) => w.id === walletId);
  if (cached) {
    cached.status = status;
  }
}

/**
 * Update wallet stats after a bet
 */
export async function recordBet(walletId: string, amountFlr: number): Promise<void> {
  await prisma.botWallet.update({
    where: { id: walletId },
    data: {
      lastBetTime: new Date(),
      totalBets: { increment: 1 },
      totalSpentFlr: { increment: amountFlr },
      updatedAt: new Date(),
    },
  });
}

/**
 * Refresh balances and update status for all wallets
 */
export async function refreshAllBalances(): Promise<void> {
  console.log('[WalletManager] Refreshing all wallet balances...');

  let activeCount = 0;
  let lowCount = 0;

  for (const wallet of walletCache) {
    if (wallet.status === 'disabled') continue;

    const balance = await getBalance(wallet.address);

    if (balance < MIN_BALANCE_WEI) {
      if (wallet.status !== 'low_balance') {
        await updateWalletStatus(wallet.id, 'low_balance');
      }
      lowCount++;
    } else {
      if (wallet.status !== 'active') {
        await updateWalletStatus(wallet.id, 'active');
      }
      activeCount++;
    }
  }

  console.log(`[WalletManager] Active: ${activeCount}, Low balance: ${lowCount}`);

  if (lowCount > 5) {
    console.error(`[WalletManager] WARNING: ${lowCount} wallets have low balance!`);
  }
}

/**
 * Get wallet manager stats for health checks
 */
export async function getWalletStats(): Promise<{
  total: number;
  active: number;
  lowBalance: number;
  disabled: number;
  treasuryBalance: string;
}> {
  const treasuryBalance = await getTreasuryBalance();

  const statuses = walletCache.reduce(
    (acc, w) => {
      acc[w.status] = (acc[w.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    total: walletCache.length,
    active: statuses['active'] || 0,
    lowBalance: statuses['low_balance'] || 0,
    disabled: statuses['disabled'] || 0,
    treasuryBalance: formatEther(treasuryBalance),
  };
}

/**
 * Create a wallet client for a specific wallet
 */
export function createClientForWallet(wallet: DecryptedWallet) {
  return createBotWalletClient(wallet.privateKey);
}
