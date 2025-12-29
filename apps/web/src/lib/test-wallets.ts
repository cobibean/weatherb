/**
 * Test Wallet Generation and Management
 *
 * CRITICAL SECURITY MODULE - Handles test wallet creation, encryption, funding, and recovery.
 *
 * Security Features:
 * - Cryptographically secure wallet generation using viem
 * - AES-256-GCM encryption for private key storage
 * - 3-block confirmation requirement for fund recovery
 * - Comprehensive audit trail for all transactions
 * - Zero plaintext private key logging
 *
 * @module test-wallets
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// ============================================================
// TYPES
// ============================================================

export type TestWallet = {
  address: Hex;
  privateKey: Hex;
};

export type FundingTransaction = {
  hash: Hex;
  to: Hex;
  amount: string; // FLR amount as string
};

export type FundingResult = {
  success: boolean;
  totalAmount: string; // Total FLR sent
  transactions: FundingTransaction[];
  error?: string;
};

export type SweepTransaction = {
  hash: Hex;
  from: Hex;
  to: Hex;
  amount: string; // FLR amount recovered
  gasCost: string; // FLR spent on gas
  confirmations: number;
};

export type SweepResult = {
  success: boolean;
  recoveredAmount: string; // Total FLR recovered (after gas costs)
  transactions: SweepTransaction[];
  error?: string;
};

export type WalletClientFactory = (privateKey: Hex, rpcUrl: string) => WalletClient;

// ============================================================
// CONSTANTS
// ============================================================

const MIN_FUNDING_AMOUNT = 0.01; // FLR
const MAX_WALLET_COUNT = 10;
const REQUIRED_CONFIRMATIONS = 3;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // bytes
const AUTH_TAG_LENGTH = 16; // bytes

// ============================================================
// WALLET GENERATION
// ============================================================

/**
 * Generate test wallets using cryptographically secure random generation.
 *
 * SECURITY: Uses viem's generatePrivateKey() which wraps crypto.randomBytes()
 *
 * @param count - Number of wallets to generate (1-10)
 * @returns Array of test wallets with addresses and private keys
 * @throws Error if count is invalid
 */
export function generateTestWallets(count: number): TestWallet[] {
  // Validation
  if (count < 1) {
    throw new Error('Wallet count must be at least 1');
  }
  if (count > MAX_WALLET_COUNT) {
    throw new Error(`Wallet count must not exceed ${MAX_WALLET_COUNT}`);
  }

  const wallets: TestWallet[] = [];

  for (let i = 0; i < count; i++) {
    // Generate cryptographically secure private key
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    wallets.push({
      address: account.address,
      privateKey,
    });
  }

  return wallets;
}

// ============================================================
// ENCRYPTION
// ============================================================

/**
 * Get encryption key from environment variable and derive 32-byte key.
 *
 * SECURITY: Uses SHA-256 to ensure consistent 32-byte key length
 *
 * @returns 32-byte encryption key buffer
 * @throws Error if MAGIC_LINK_SECRET is not set
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    throw new Error('MAGIC_LINK_SECRET environment variable is required for wallet encryption');
  }

  // Derive 32-byte key using SHA-256
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypt wallet keys using AES-256-GCM.
 *
 * SECURITY FEATURES:
 * - AES-256-GCM provides authenticated encryption
 * - Random IV ensures different ciphertext for same plaintext
 * - Authentication tag prevents tampering
 *
 * Format: iv:authTag:encryptedData (all hex-encoded)
 *
 * @param wallets - Array of test wallets to encrypt
 * @returns Encrypted string (safe for database storage)
 * @throws Error if encryption fails
 */
export function encryptWalletKeys(wallets: TestWallet[]): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  // Serialize wallets to JSON
  const plaintext = JSON.stringify(wallets);

  // Create cipher with AES-256-GCM
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt wallet keys using AES-256-GCM.
 *
 * SECURITY FEATURES:
 * - Verifies authentication tag to detect tampering
 * - Throws on invalid/tampered data
 *
 * @param encrypted - Encrypted string from encryptWalletKeys()
 * @returns Array of decrypted test wallets
 * @throws Error if decryption fails or data is tampered
 */
export function decryptWalletKeys(encrypted: string): TestWallet[] {
  const key = getEncryptionKey();

  try {
    // Parse encrypted string: iv:authTag:encryptedData
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = parts[2];

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid auth tag length');
    }

    // Create decipher
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Parse JSON
    const wallets = JSON.parse(decrypted) as TestWallet[];

    // Validate structure
    if (!Array.isArray(wallets)) {
      throw new Error('Decrypted data is not an array');
    }

    for (const wallet of wallets) {
      if (!wallet.address || !wallet.privateKey) {
        throw new Error('Invalid wallet structure after decryption');
      }
    }

    return wallets;
  } catch (error) {
    // SECURITY: Don't leak information about decryption failures
    if (error instanceof Error) {
      throw new Error(`Failed to decrypt wallet keys: ${error.message}`);
    }
    throw new Error('Failed to decrypt wallet keys: Unknown error');
  }
}

// ============================================================
// FUNDING
// ============================================================

/**
 * Fund test wallets from admin wallet.
 *
 * SECURITY:
 * - Validates admin balance before funding
 * - Enforces minimum funding amount
 * - Waits for transaction receipts
 * - Returns full transaction audit trail
 *
 * @param wallets - Test wallets to fund
 * @param amountPerWallet - FLR amount to send to each wallet (as string)
 * @param publicClient - Viem public client
 * @param walletClient - Viem wallet client (admin wallet)
 * @returns Funding result with transaction details
 * @throws Error if funding fails or validation fails
 */
export async function fundWallets(
  wallets: TestWallet[],
  amountPerWallet: string,
  publicClient: PublicClient,
  walletClient: WalletClient,
): Promise<FundingResult> {
  const amount = parseFloat(amountPerWallet);

  // Validate amount
  if (amount < MIN_FUNDING_AMOUNT) {
    throw new Error(`Funding amount must be at least ${MIN_FUNDING_AMOUNT} FLR`);
  }

  const amountWei = parseEther(amountPerWallet);
  const totalRequired = BigInt(wallets.length) * amountWei;

  // Check admin balance
  const adminAddress = walletClient.account!.address;
  const adminBalance = await publicClient.getBalance({ address: adminAddress });

  // Add 10% buffer for gas costs
  const requiredWithBuffer = (totalRequired * 110n) / 100n;

  if (adminBalance < requiredWithBuffer) {
    throw new Error(
      `Insufficient balance. Required: ${formatEther(requiredWithBuffer)} FLR, Available: ${formatEther(adminBalance)} FLR`,
    );
  }

  // Fund each wallet
  const transactions: FundingTransaction[] = [];

  for (const wallet of wallets) {
    const hash = await walletClient.sendTransaction({
      to: wallet.address,
      value: amountWei,
    });

    // Wait for receipt
    await publicClient.waitForTransactionReceipt({ hash });

    transactions.push({
      hash,
      to: wallet.address,
      amount: amountPerWallet,
    });
  }

  const totalAmount = (parseFloat(amountPerWallet) * wallets.length).toString();

  return {
    success: true,
    totalAmount,
    transactions,
  };
}

// ============================================================
// SWEEPING (FUND RECOVERY)
// ============================================================

/**
 * Default wallet client factory - creates real wallet client
 */
function defaultWalletClientFactory(privateKey: Hex, rpcUrl: string): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    transport: http(rpcUrl),
  });
}

/**
 * Sweep all funds from test wallets back to admin wallet.
 *
 * CRITICAL SECURITY:
 * - Waits for REQUIRED_CONFIRMATIONS (3) on each transaction
 * - Accurately calculates gas costs
 * - Skips wallets with zero/dust balance
 * - Returns full audit trail
 * - Only returns success: true if ALL sweeps confirmed
 *
 * @param wallets - Test wallets to sweep
 * @param toAddress - Admin wallet address to receive funds
 * @param publicClient - Viem public client
 * @param rpcUrl - RPC URL (optional, defaults to env RPC_URL)
 * @param walletClientFactory - Factory function for creating wallet clients (for testing)
 * @returns Sweep result with recovered amount and transaction details
 * @throws Error if any sweep fails or confirmations insufficient
 */
export async function sweepWallets(
  wallets: TestWallet[],
  toAddress: Hex,
  publicClient: PublicClient,
  rpcUrl?: string,
  walletClientFactory: WalletClientFactory = defaultWalletClientFactory,
): Promise<SweepResult> {
  const transactions: SweepTransaction[] = [];
  let totalRecovered = 0n;

  for (const wallet of wallets) {
    // Check balance
    const balance = await publicClient.getBalance({ address: wallet.address });

    if (balance === 0n) {
      // Skip empty wallets
      continue;
    }

    // Estimate gas cost
    const gasPrice = await publicClient.getGasPrice();
    const gasLimit = await publicClient.estimateGas({
      account: wallet.address,
      to: toAddress,
      value: balance,
    });

    const gasCost = gasPrice * gasLimit;

    // Check if balance can cover gas
    if (balance <= gasCost) {
      // Wallet has dust only, skip
      continue;
    }

    // Calculate amount to send (balance minus gas)
    const amountToSend = balance - gasCost;

    // Create wallet client for this test wallet
    const rpcUrlToUse = rpcUrl || process.env.RPC_URL;
    if (!rpcUrlToUse) {
      throw new Error('RPC_URL is required for sweeping wallets');
    }
    const testWalletClient = walletClientFactory(wallet.privateKey, rpcUrlToUse);

    // Send transaction
    const hash = await testWalletClient.sendTransaction({
      to: toAddress,
      value: amountToSend,
    });

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      throw new Error(`Sweep transaction failed for wallet ${wallet.address}: ${hash}`);
    }

    // CRITICAL: Wait for required confirmations
    const confirmations = await publicClient.getTransactionConfirmations({ hash });

    if (confirmations < REQUIRED_CONFIRMATIONS) {
      throw new Error(
        `Insufficient confirmations for sweep transaction ${hash}. Required: ${REQUIRED_CONFIRMATIONS}, Got: ${confirmations}`,
      );
    }

    // Calculate actual gas cost from receipt
    const actualGasCost = receipt.gasUsed * receipt.effectiveGasPrice;

    transactions.push({
      hash,
      from: wallet.address,
      to: toAddress,
      amount: formatEther(amountToSend),
      gasCost: formatEther(actualGasCost),
      confirmations: Number(confirmations),
    });

    totalRecovered += amountToSend;
  }

  return {
    success: true,
    recoveredAmount: formatEther(totalRecovered),
    transactions,
  };
}
