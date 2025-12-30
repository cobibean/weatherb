/**
 * Test Window Integration Tests
 *
 * Comprehensive integration tests for the complete Epic 8 test window flow.
 * Tests the entire lifecycle from suggestion approval through fund recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TestRun, Suggestion, Market, TestStatus } from '@prisma/client';
import type { Hex } from 'viem';
import { parseEther, formatEther, createPublicClient, createWalletClient } from 'viem';
import { Decimal } from '@prisma/client/runtime/library';

// Mock external dependencies first before importing modules
vi.mock('../../prisma', () => ({
  default: {
    suggestion: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    testRun: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    market: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../test-wallets', () => ({
  generateTestWallets: vi.fn(),
  encryptWalletKeys: vi.fn(),
  decryptWalletKeys: vi.fn(),
  fundWallets: vi.fn(),
  sweepWallets: vi.fn(),
}));

vi.mock('../../test-markets', () => ({
  createTestMarkets: vi.fn(),
  placeBets: vi.fn(),
  verifyPayouts: vi.fn(),
}));

vi.mock('../../email', () => ({
  sendTestResultsEmail: vi.fn(),
}));

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(),
    createWalletClient: vi.fn(),
  };
});

// Import the modules under test
import {
  startTestWindow,
  monitorTestRun,
  finalizeTestRun,
  type TestResults,
} from '../../test-runner';

import * as testWallets from '../../test-wallets';
import * as testMarkets from '../../test-markets';
import * as email from '../../email';
import prisma from '../../prisma';

// Helper to create mock data
const createMockSuggestion = (overrides?: Partial<Suggestion>): Suggestion => ({
  id: 'suggestion-123',
  city: 'Denver',
  latitude: 39.7392,
  longitude: -104.9903,
  timeOfDay: 'afternoon',
  targetTemp: 75,
  targetDate: new Date('2024-12-30'),
  votes: 10,
  score: 100,
  status: 'pending',
  submittedAt: new Date(),
  approvedAt: null,
  deniedAt: null,
  processedAt: null,
  adminNotes: null,
  ...overrides,
});

const createMockTestRun = (overrides?: Partial<TestRun>): TestRun => ({
  id: 'testrun-123',
  suggestionId: 'suggestion-123',
  walletKeys: 'encrypted-keys-json',
  walletCount: 3,
  keysDisposed: false,
  marketsCreated: 5,
  marketsSettled: 0,
  fundingAmount: new Decimal('15.0'),
  fundingTxHash: '0xfundingtx',
  recoveredAmount: new Decimal('0'),
  netCost: new Decimal('0'),
  status: 'RUNNING' as TestStatus,
  startedAt: new Date(),
  completedAt: null,
  actualTemp: null,
  totalVolume: null,
  payoutVerified: false,
  results: null,
  errorMessage: null,
  ...overrides,
});

describe('Test Window Integration', () => {
  let mockPrismaClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock viem clients
    vi.mocked(createPublicClient).mockReturnValue({
      getBalance: vi.fn().mockResolvedValue(parseEther('10')),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
      readContract: vi.fn(),
      getBlockNumber: vi.fn().mockResolvedValue(1000n),
    } as any);

    vi.mocked(createWalletClient).mockReturnValue({
      sendTransaction: vi.fn().mockResolvedValue('0xmocktxhash' as Hex),
      writeContract: vi.fn().mockResolvedValue('0xmocktxhash' as Hex),
    } as any);

    // Setup mock Prisma client
    mockPrismaClient = {
      suggestion: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      testRun: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      market: {
        createMany: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrismaClient)),
    };

    // Replace the prisma import methods
    Object.assign(prisma, mockPrismaClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Test Window Flow', () => {
    it('should execute the full test window lifecycle successfully', async () => {
      const mockSuggestion = createMockSuggestion({ status: 'approved' });
      const mockTestRun = createMockTestRun();

      // Step 1: Mock suggestion lookup
      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);

      // Step 2: Mock test run creation
      mockPrismaClient.testRun.create.mockResolvedValue(mockTestRun);

      // Step 3: Mock wallet generation
      const mockWallets: testWallets.TestWallet[] = [
        { address: '0xwallet1' as Hex, privateKey: '0xkey1' as Hex },
        { address: '0xwallet2' as Hex, privateKey: '0xkey2' as Hex },
        { address: '0xwallet3' as Hex, privateKey: '0xkey3' as Hex },
      ];
      vi.mocked(testWallets.generateTestWallets).mockReturnValue(mockWallets);
      vi.mocked(testWallets.encryptWalletKeys).mockReturnValue('encrypted-keys');

      // Step 4: Mock wallet funding
      const mockFundingResult: testWallets.FundingResult = {
        success: true,
        txHash: '0xfundingtx' as Hex,
        totalAmount: parseEther('15'),
        walletBalances: [
          { address: mockWallets[0].address, amount: parseEther('5') },
          { address: mockWallets[1].address, amount: parseEther('5') },
          { address: mockWallets[2].address, amount: parseEther('5') },
        ],
      };
      vi.mocked(testWallets.fundWallets).mockResolvedValue(mockFundingResult);

      // Step 5: Mock market creation
      const mockMarkets: testMarkets.CreatedMarket[] = Array.from({ length: 5 }, (_, i) => ({
        marketId: BigInt(100 + i),
        txHash: `0xmarket${i}` as Hex,
        threshold: 750 + i * 10, // 75.0°F to 79.0°F
        resolveTime: BigInt(Math.floor(Date.now() / 1000) + 3600 * (i + 1)),
      }));
      vi.mocked(testMarkets.createTestMarkets).mockResolvedValue({
        success: true,
        markets: mockMarkets,
        failedCount: 0,
      });

      // Step 6: Mock bet placement
      const mockBetResults: testMarkets.BetResult[] = mockMarkets.flatMap((market) => [
        {
          marketId: market.marketId,
          position: 'YES' as const,
          amount: parseEther('1'),
          txHash: `0xbet-yes-${market.marketId}` as Hex,
          wallet: mockWallets[0].address,
        },
        {
          marketId: market.marketId,
          position: 'NO' as const,
          amount: parseEther('1'),
          txHash: `0xbet-no-${market.marketId}` as Hex,
          wallet: mockWallets[1].address,
        },
      ]);
      vi.mocked(testMarkets.placeBets).mockResolvedValue({
        success: true,
        bets: mockBetResults,
        totalVolume: parseEther('10'),
      });

      // Start the test window
      const testRun = await startTestWindow(mockSuggestion.id);

      // Verify initial state
      expect(testRun).toBeDefined();
      expect(testRun.id).toBe(mockTestRun.id);
      expect(testRun.status).toBe('RUNNING');
      expect(vi.mocked(testWallets.generateTestWallets)).toHaveBeenCalledWith(3);
      expect(vi.mocked(testWallets.fundWallets)).toHaveBeenCalled();
      expect(vi.mocked(testMarkets.createTestMarkets)).toHaveBeenCalled();
      expect(vi.mocked(testMarkets.placeBets)).toHaveBeenCalled();

      // Step 7: Mock market settlement monitoring
      mockPrismaClient.testRun.findUnique.mockResolvedValue({
        ...mockTestRun,
        marketsSettled: 5,
        markets: mockMarkets.map((m) => ({
          id: `market-${m.marketId}`,
          marketId: Number(m.marketId),
          settled: true,
          outcome: 'YES',
        })),
      });

      // Step 8: Mock payout verification
      const mockPayoutResult: testMarkets.VerifyPayoutsResult = {
        success: true,
        totalPayout: parseEther('12'),
        walletPayouts: [
          { address: mockWallets[0].address, payout: parseEther('6') },
          { address: mockWallets[1].address, payout: parseEther('4') },
          { address: mockWallets[2].address, payout: parseEther('2') },
        ],
      };
      vi.mocked(testMarkets.verifyPayouts).mockResolvedValue(mockPayoutResult);

      // Monitor the test run
      const monitorResult = await monitorTestRun(testRun.id);
      expect(monitorResult.allSettled).toBe(true);
      expect(monitorResult.payoutsVerified).toBe(true);

      // Step 9: Mock fund recovery
      vi.mocked(testWallets.decryptWalletKeys).mockReturnValue(mockWallets);
      const mockSweepResult: testWallets.SweepResult = {
        success: true,
        totalRecovered: parseEther('14.5'),
        txHashes: ['0xsweep1' as Hex, '0xsweep2' as Hex, '0xsweep3' as Hex],
        walletResults: mockWallets.map((w) => ({
          address: w.address,
          recovered: parseEther('4.83'),
          txHash: '0xsweeptx' as Hex,
        })),
      };
      vi.mocked(testWallets.sweepWallets).mockResolvedValue(mockSweepResult);

      // Step 10: Finalize the test run
      mockPrismaClient.testRun.update.mockResolvedValue({
        ...mockTestRun,
        status: 'COMPLETED' as TestStatus,
        completedAt: new Date(),
        recoveredAmount: new Decimal('14.5'),
        netCost: new Decimal('0.5'),
        keysDisposed: true,
        payoutVerified: true,
        actualTemp: 768, // 76.8°F
        totalVolume: 10,
      });

      const finalizeResult = await finalizeTestRun(testRun.id);

      // Verify finalization
      expect(finalizeResult.success).toBe(true);
      expect(finalizeResult.fundsRecovered).toBe(true);
      expect(finalizeResult.keysDisposed).toBe(true);
      expect(vi.mocked(testWallets.sweepWallets)).toHaveBeenCalled();
      expect(vi.mocked(email.sendTestResultsEmail)).toHaveBeenCalled();

      // Verify database updates
      expect(mockPrismaClient.testRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testRun.id },
          data: expect.objectContaining({
            status: 'COMPLETED',
            keysDisposed: true,
            recoveredAmount: expect.any(Object),
            netCost: expect.any(Object),
          }),
        })
      );
    });

    it('should handle wallet generation and encryption correctly', async () => {
      const mockSuggestion = createMockSuggestion();
      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);

      // Test wallet generation with different counts
      const walletCounts = [1, 3, 5];

      for (const count of walletCounts) {
        vi.clearAllMocks();

        const mockWallets = Array.from({ length: count }, (_, i) => ({
          address: `0xwallet${i}` as Hex,
          privateKey: `0xkey${i}` as Hex,
        }));

        vi.mocked(testWallets.generateTestWallets).mockReturnValue(mockWallets);
        vi.mocked(testWallets.encryptWalletKeys).mockReturnValue(`encrypted-${count}-wallets`);

        mockPrismaClient.testRun.create.mockResolvedValue(
          createMockTestRun({ walletCount: count })
        );

        await startTestWindow(mockSuggestion.id, { walletCount: count });

        expect(vi.mocked(testWallets.generateTestWallets)).toHaveBeenCalledWith(count);
        expect(vi.mocked(testWallets.encryptWalletKeys)).toHaveBeenCalledWith(mockWallets);
        expect(mockPrismaClient.testRun.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              walletCount: count,
              walletKeys: `encrypted-${count}-wallets`,
            }),
          })
        );
      }
    });

    it('should handle fund recovery with proper safety checks', async () => {
      const mockTestRun = createMockTestRun({
        marketsSettled: 5,
        marketsCreated: 5,
        keysDisposed: false,
      });

      mockPrismaClient.testRun.findUnique.mockResolvedValue(mockTestRun);

      const mockWallets: testWallets.TestWallet[] = [
        { address: '0xwallet1' as Hex, privateKey: '0xkey1' as Hex },
        { address: '0xwallet2' as Hex, privateKey: '0xkey2' as Hex },
      ];
      vi.mocked(testWallets.decryptWalletKeys).mockReturnValue(mockWallets);

      // Test successful recovery
      const mockSweepResult: testWallets.SweepResult = {
        success: true,
        totalRecovered: parseEther('14.8'),
        txHashes: ['0xsweep1' as Hex, '0xsweep2' as Hex],
        walletResults: mockWallets.map((w, i) => ({
          address: w.address,
          recovered: parseEther(i === 0 ? '8.3' : '6.5'),
          txHash: `0xsweep${i}` as Hex,
        })),
      };
      vi.mocked(testWallets.sweepWallets).mockResolvedValue(mockSweepResult);

      // Should wait for confirmations before disposing keys
      const publicClient = {
        getBlockNumber: vi.fn()
          .mockResolvedValueOnce(1000n)
          .mockResolvedValueOnce(1001n)
          .mockResolvedValueOnce(1002n)
          .mockResolvedValueOnce(1003n), // 3 blocks later
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
      };

      vi.mocked(createPublicClient).mockReturnValue(publicClient as any);

      const result = await finalizeTestRun(mockTestRun.id);

      expect(result.success).toBe(true);
      expect(result.fundsRecovered).toBe(true);
      expect(result.keysDisposed).toBe(true);

      // Verify proper confirmation waiting
      expect(publicClient.getBlockNumber).toHaveBeenCalledTimes(4);

      // Verify keys were only disposed after confirmations
      expect(mockPrismaClient.testRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            keysDisposed: true,
          }),
        })
      );
    });

    it('should handle errors gracefully and update status accordingly', async () => {
      const mockSuggestion = createMockSuggestion();
      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);

      // Test market creation failure
      vi.mocked(testMarkets.createTestMarkets).mockResolvedValue({
        success: false,
        markets: [],
        failedCount: 5,
        error: 'Failed to create markets',
      });

      mockPrismaClient.testRun.create.mockResolvedValue(createMockTestRun());
      mockPrismaClient.testRun.update.mockResolvedValue(
        createMockTestRun({ status: 'FAILED' as TestStatus })
      );

      await expect(startTestWindow(mockSuggestion.id)).rejects.toThrow();

      // Verify error status update
      expect(mockPrismaClient.testRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: expect.stringContaining('Failed to create markets'),
          }),
        })
      );
    });

    it('should send proper email notifications at key stages', async () => {
      const mockSuggestion = createMockSuggestion();
      const mockTestRun = createMockTestRun({
        status: 'COMPLETED' as TestStatus,
        marketsSettled: 5,
        actualTemp: 773, // 77.3°F
        totalVolume: 10.5,
        recoveredAmount: new Decimal('14.7'),
        netCost: new Decimal('0.3'),
      });

      mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);
      mockPrismaClient.testRun.findUnique.mockResolvedValue(mockTestRun);

      const testResults: TestResults = {
        success: true,
        testRunId: mockTestRun.id,
        suggestion: mockSuggestion,
        marketsCreated: 5,
        marketsSettled: 5,
        actualTemp: 77.3,
        totalVolume: '10.5',
        fundingAmount: '15.0',
        recoveredAmount: '14.7',
        netCost: '0.3',
        payoutVerified: true,
        duration: '2 hours',
      };

      await email.sendTestResultsEmail(testResults);

      expect(vi.mocked(email.sendTestResultsEmail)).toHaveBeenCalledWith(testResults);
    });

    it('should handle concurrent test runs without interference', async () => {
      // Create multiple suggestions
      const suggestions = [
        createMockSuggestion({ id: 'sug-1', city: 'Denver' }),
        createMockSuggestion({ id: 'sug-2', city: 'Boston' }),
        createMockSuggestion({ id: 'sug-3', city: 'Austin' }),
      ];

      // Mock different responses for each suggestion
      mockPrismaClient.suggestion.findUnique.mockImplementation(({ where }) => {
        return suggestions.find((s) => s.id === where.id);
      });

      const testRuns = suggestions.map((s) =>
        createMockTestRun({ id: `run-${s.id}`, suggestionId: s.id })
      );

      mockPrismaClient.testRun.create.mockImplementation(({ data }) => {
        const testRun = testRuns.find((tr) => tr.suggestionId === data.suggestionId);
        return Promise.resolve(testRun);
      });

      // Start multiple test windows concurrently
      const promises = suggestions.map((s) => startTestWindow(s.id));
      const results = await Promise.allSettled(promises);

      // All should complete without errors
      results.forEach((result, i) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.suggestionId).toBe(suggestions[i].id);
        }
      });

      // Verify each test run was created independently
      expect(mockPrismaClient.testRun.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases and Error Recovery', () => {
    it('should never dispose keys before confirmed fund recovery', async () => {
      const mockTestRun = createMockTestRun({ keysDisposed: false });
      mockPrismaClient.testRun.findUnique.mockResolvedValue(mockTestRun);

      // Simulate sweep failure
      vi.mocked(testWallets.sweepWallets).mockResolvedValue({
        success: false,
        totalRecovered: parseEther('0'),
        txHashes: [],
        walletResults: [],
        error: 'Network error during sweep',
      });

      const result = await finalizeTestRun(mockTestRun.id);

      expect(result.success).toBe(false);
      expect(result.fundsRecovered).toBe(false);
      expect(result.keysDisposed).toBe(false);

      // Keys should NOT be disposed
      expect(mockPrismaClient.testRun.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            keysDisposed: true,
          }),
        })
      );
    });

    it('should handle partial market settlement correctly', async () => {
      const mockTestRun = createMockTestRun({
        marketsCreated: 5,
        marketsSettled: 3, // Only 3 of 5 settled
      });

      mockPrismaClient.testRun.findUnique.mockResolvedValue(mockTestRun);
      mockPrismaClient.market.findMany.mockResolvedValue([
        { id: 'market-1', settled: true, outcome: 'YES' },
        { id: 'market-2', settled: true, outcome: 'NO' },
        { id: 'market-3', settled: true, outcome: 'YES' },
        { id: 'market-4', settled: false, outcome: null },
        { id: 'market-5', settled: false, outcome: null },
      ]);

      const result = await monitorTestRun(mockTestRun.id);

      expect(result.allSettled).toBe(false);
      expect(result.settledCount).toBe(3);
      expect(result.totalCount).toBe(5);
      expect(result.payoutsVerified).toBe(false); // Should not verify until all settled
    });

    it('should validate suggestion status before starting test', async () => {
      const invalidStatuses = ['denied', 'processing', 'completed'];

      for (const status of invalidStatuses) {
        const mockSuggestion = createMockSuggestion({ status: status as any });
        mockPrismaClient.suggestion.findUnique.mockResolvedValue(mockSuggestion);

        await expect(startTestWindow(mockSuggestion.id)).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('status'),
          })
        );
      }
    });

    it('should handle zero fund recovery gracefully', async () => {
      const mockTestRun = createMockTestRun({
        fundingAmount: new Decimal('15.0'),
        marketsSettled: 5,
      });

      mockPrismaClient.testRun.findUnique.mockResolvedValue(mockTestRun);

      // All funds lost (edge case)
      vi.mocked(testWallets.sweepWallets).mockResolvedValue({
        success: true,
        totalRecovered: parseEther('0'),
        txHashes: ['0xemptysweep' as Hex],
        walletResults: [],
      });

      const result = await finalizeTestRun(mockTestRun.id);

      expect(result.success).toBe(true);
      expect(result.fundsRecovered).toBe(true); // Still "recovered" even if 0
      expect(mockPrismaClient.testRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recoveredAmount: expect.any(Object),
            netCost: expect.any(Object), // Should be full funding amount
          }),
        })
      );
    });
  });
});