import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Hex, WalletClient, PublicClient } from 'viem';

// Import functions we'll implement
import {
  generateTestWallets,
  encryptWalletKeys,
  decryptWalletKeys,
  fundWallets,
  sweepWallets,
  type TestWallet,
  type FundingResult,
  type SweepResult,
} from '../test-wallets';

describe('Test Wallet Generation and Management', () => {
  const mockEncryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    // Set up mock environment
    vi.stubEnv('MAGIC_LINK_SECRET', mockEncryptionKey);
    vi.stubEnv('RPC_URL', 'https://coston2-api.flare.network/ext/C/rpc');
    vi.stubEnv('ADMIN_PRIVATE_KEY', '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('generateTestWallets', () => {
    it('should generate specified number of wallets', () => {
      const wallets = generateTestWallets(2);

      expect(wallets).toHaveLength(2);
      expect(wallets[0]).toHaveProperty('address');
      expect(wallets[0]).toHaveProperty('privateKey');
      expect(wallets[1]).toHaveProperty('address');
      expect(wallets[1]).toHaveProperty('privateKey');
    });

    it('should generate wallets with valid ethereum addresses', () => {
      const wallets = generateTestWallets(2);

      wallets.forEach(wallet => {
        expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
    });

    it('should generate unique wallets', () => {
      const wallets = generateTestWallets(3);

      const addresses = wallets.map(w => w.address);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(3);

      const privateKeys = wallets.map(w => w.privateKey);
      const uniqueKeys = new Set(privateKeys);
      expect(uniqueKeys.size).toBe(3);
    });

    it('should generate exactly 2 wallets for default test runs', () => {
      const wallets = generateTestWallets(2);
      expect(wallets).toHaveLength(2);
    });

    it('should throw on invalid count', () => {
      expect(() => generateTestWallets(0)).toThrow('Wallet count must be at least 1');
      expect(() => generateTestWallets(-1)).toThrow('Wallet count must be at least 1');
    });

    it('should throw on excessive count', () => {
      expect(() => generateTestWallets(11)).toThrow('Wallet count must not exceed 10');
    });
  });

  describe('encryptWalletKeys', () => {
    it('should encrypt wallet keys into a string', () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1234567890123456789012345678901234567890' as Hex,
          privateKey: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' as Hex,
        },
      ];

      const encrypted = encryptWalletKeys(wallets);

      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
      // Should not contain plaintext private key
      expect(encrypted).not.toContain('abcdef0123456789');
    });

    it('should produce different ciphertext for same input (due to IV)', () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1234567890123456789012345678901234567890' as Hex,
          privateKey: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' as Hex,
        },
      ];

      const encrypted1 = encryptWalletKeys(wallets);
      const encrypted2 = encryptWalletKeys(wallets);

      // Different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should encrypt multiple wallets', () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Hex,
          privateKey: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
        },
      ];

      const encrypted = encryptWalletKeys(wallets);
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should throw if encryption key is missing', () => {
      vi.stubEnv('MAGIC_LINK_SECRET', undefined);

      const wallets: TestWallet[] = [
        {
          address: '0x1234567890123456789012345678901234567890' as Hex,
          privateKey: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' as Hex,
        },
      ];

      expect(() => encryptWalletKeys(wallets)).toThrow('MAGIC_LINK_SECRET');
    });
  });

  describe('decryptWalletKeys', () => {
    it('should decrypt encrypted wallet keys', () => {
      const originalWallets: TestWallet[] = [
        {
          address: '0x1234567890123456789012345678901234567890' as Hex,
          privateKey: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' as Hex,
        },
      ];

      const encrypted = encryptWalletKeys(originalWallets);
      const decrypted = decryptWalletKeys(encrypted);

      expect(decrypted).toEqual(originalWallets);
    });

    it('should decrypt multiple wallets', () => {
      const originalWallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Hex,
          privateKey: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
        },
      ];

      const encrypted = encryptWalletKeys(originalWallets);
      const decrypted = decryptWalletKeys(encrypted);

      expect(decrypted).toEqual(originalWallets);
    });

    it('should throw on invalid encrypted data', () => {
      expect(() => decryptWalletKeys('invalid-data')).toThrow();
    });

    it('should throw on tampered data', () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1234567890123456789012345678901234567890' as Hex,
          privateKey: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' as Hex,
        },
      ];

      const encrypted = encryptWalletKeys(wallets);
      const tampered = encrypted.slice(0, -10) + 'tampered!!';

      expect(() => decryptWalletKeys(tampered)).toThrow();
    });

    it('should throw if decryption key is missing', () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1234567890123456789012345678901234567890' as Hex,
          privateKey: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' as Hex,
        },
      ];

      const encrypted = encryptWalletKeys(wallets);
      vi.stubEnv('MAGIC_LINK_SECRET', undefined);

      expect(() => decryptWalletKeys(encrypted)).toThrow('MAGIC_LINK_SECRET');
    });
  });

  describe('fundWallets', () => {
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;

    beforeEach(() => {
      // Mock viem clients
      mockPublicClient = {
        getBalance: vi.fn(async () => BigInt('1000000000000000000000')), // 1000 FLR
        waitForTransactionReceipt: vi.fn(async () => ({
          status: 'success',
          transactionHash: '0xfundinghash',
          blockNumber: BigInt(100),
        })),
        getGasPrice: vi.fn(async () => BigInt('25000000000')), // 25 gwei
      } as any;

      mockWalletClient = {
        sendTransaction: vi.fn(async () => '0xfundinghash' as Hex),
        account: {
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex,
        },
      } as any;
    });

    it('should fund multiple wallets successfully', async () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Hex,
          privateKey: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
        },
      ];

      const result = await fundWallets(
        wallets,
        '10', // 10 FLR
        mockPublicClient as PublicClient,
        mockWalletClient as WalletClient,
      );

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe('20'); // 2 wallets × 10 FLR
      expect(result.transactions).toHaveLength(2);
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(2);
    });

    it('should validate admin wallet has sufficient balance', async () => {
      mockPublicClient.getBalance = vi.fn(async () => BigInt('5000000000000000000')); // Only 5 FLR

      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      await expect(
        fundWallets(wallets, '10', mockPublicClient as PublicClient, mockWalletClient as WalletClient),
      ).rejects.toThrow('Insufficient balance');
    });

    it('should include transaction hashes in result', async () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      const result = await fundWallets(
        wallets,
        '10',
        mockPublicClient as PublicClient,
        mockWalletClient as WalletClient,
      );

      expect(result.transactions[0]).toHaveProperty('hash');
      expect(result.transactions[0]).toHaveProperty('to');
      expect(result.transactions[0]).toHaveProperty('amount');
      expect(result.transactions[0].hash).toBe('0xfundinghash');
    });

    it('should handle funding failure gracefully', async () => {
      mockWalletClient.sendTransaction = vi.fn(async () => {
        throw new Error('Transaction failed');
      });

      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      await expect(
        fundWallets(wallets, '10', mockPublicClient as PublicClient, mockWalletClient as WalletClient),
      ).rejects.toThrow();
    });

    it('should enforce minimum funding amount', async () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      await expect(
        fundWallets(wallets, '0.001', mockPublicClient as PublicClient, mockWalletClient as WalletClient),
      ).rejects.toThrow('Funding amount must be at least 0.01 FLR');
    });
  });

  describe('sweepWallets', () => {
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClientFactory: any;
    const mockRpcUrl = 'https://coston2-api.flare.network/ext/C/rpc';

    beforeEach(() => {
      mockPublicClient = {
        getBalance: vi.fn(async () => BigInt('9500000000000000000')), // 9.5 FLR remaining
        waitForTransactionReceipt: vi.fn(async (params: any) => ({
          status: 'success',
          transactionHash: params.hash,
          blockNumber: BigInt(105),
          gasUsed: BigInt('21000'),
          effectiveGasPrice: BigInt('25000000000'),
        })),
        getGasPrice: vi.fn(async () => BigInt('25000000000')), // 25 gwei
        estimateGas: vi.fn(async () => BigInt('21000')),
        getTransactionConfirmations: vi.fn(async () => 3),
      } as any;

      // Mock wallet client factory to prevent real RPC calls
      mockWalletClientFactory = vi.fn(() => ({
        sendTransaction: vi.fn(async () => '0xsweephash' as Hex),
        account: {
          address: '0x1111111111111111111111111111111111111111' as Hex,
        },
      }));
    });

    it('should sweep all wallets and return recovered amount', async () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Hex,
          privateKey: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
        },
      ];

      const toAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;

      const result = await sweepWallets(
        wallets,
        toAddress,
        mockPublicClient as PublicClient,
        mockRpcUrl,
        mockWalletClientFactory,
      );

      expect(result.success).toBe(true);
      expect(result.recoveredAmount).toBeDefined();
      expect(parseFloat(result.recoveredAmount)).toBeGreaterThan(0);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].confirmations).toBe(3);
    });

    it('should wait for 3 confirmations on each sweep transaction', async () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      const toAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;

      await sweepWallets(
        wallets,
        toAddress,
        mockPublicClient as PublicClient,
        mockRpcUrl,
        mockWalletClientFactory,
      );

      expect(mockPublicClient.getTransactionConfirmations).toHaveBeenCalled();
    });

    it('should calculate gas costs accurately', async () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      const toAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;

      const result = await sweepWallets(
        wallets,
        toAddress,
        mockPublicClient as PublicClient,
        mockRpcUrl,
        mockWalletClientFactory,
      );

      expect(result.transactions[0]).toHaveProperty('gasCost');
      expect(result.transactions[0].gasCost).toBeDefined();
    });

    it('should skip wallets with zero balance', async () => {
      mockPublicClient.getBalance = vi.fn(async () => BigInt('0'));

      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      const toAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;

      const result = await sweepWallets(
        wallets,
        toAddress,
        mockPublicClient as PublicClient,
        mockRpcUrl,
        mockWalletClientFactory,
      );

      expect(result.success).toBe(true);
      expect(result.recoveredAmount).toBe('0');
      expect(result.transactions).toHaveLength(0);
    });

    it('should fail if confirmations are insufficient', async () => {
      mockPublicClient.getTransactionConfirmations = vi.fn(async () => 2); // Only 2 confirmations

      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      const toAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;

      await expect(
        sweepWallets(wallets, toAddress, mockPublicClient as PublicClient, mockRpcUrl, mockWalletClientFactory),
      ).rejects.toThrow('confirmation');
    });

    it('should handle sweep failure and preserve error details', async () => {
      mockPublicClient.waitForTransactionReceipt = vi.fn(async () => {
        throw new Error('Transaction reverted');
      });

      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      const toAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;

      await expect(
        sweepWallets(wallets, toAddress, mockPublicClient as PublicClient, mockRpcUrl, mockWalletClientFactory),
      ).rejects.toThrow('Transaction reverted');
    });

    it('should include audit trail in response', async () => {
      const wallets: TestWallet[] = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        },
      ];

      const toAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;

      const result = await sweepWallets(
        wallets,
        toAddress,
        mockPublicClient as PublicClient,
        mockRpcUrl,
        mockWalletClientFactory,
      );

      expect(result.transactions[0]).toHaveProperty('hash');
      expect(result.transactions[0]).toHaveProperty('from');
      expect(result.transactions[0]).toHaveProperty('to');
      expect(result.transactions[0]).toHaveProperty('amount');
      expect(result.transactions[0]).toHaveProperty('gasCost');
      expect(result.transactions[0]).toHaveProperty('confirmations');
    });
  });

  describe('Edge Cases and Security', () => {
    it('should never log private keys', () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const consoleDebugSpy = vi.spyOn(console, 'debug');

      const wallets = generateTestWallets(1);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining(wallets[0].privateKey));
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining(wallets[0].privateKey));
      expect(consoleDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining(wallets[0].privateKey));

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleDebugSpy.mockRestore();
    });

    it('should handle encryption with special characters in key', () => {
      vi.stubEnv('MAGIC_LINK_SECRET', 'abcd1234!@#$%^&*()_+-=[]{}|;:,.<>?');

      const wallets: TestWallet[] = [
        {
          address: '0x1234567890123456789012345678901234567890' as Hex,
          privateKey: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' as Hex,
        },
      ];

      const encrypted = encryptWalletKeys(wallets);
      const decrypted = decryptWalletKeys(encrypted);

      expect(decrypted).toEqual(wallets);
    });
  });
});
