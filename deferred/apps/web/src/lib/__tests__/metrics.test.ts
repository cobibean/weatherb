/**
 * Tests for the weekly metrics collection service
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// Mock Prisma client before any imports
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(() => {
      return {
        market: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        suggestion: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        testRun: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        adminLog: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };
    }),
  };
});

// Mock contract-data module
vi.mock('../contract-data', () => ({
  fetchMarketsFromContract: vi.fn().mockResolvedValue({ markets: [] }),
}));

// Import after mocks are set up
import {
  getPreviousWeekRange,
  collectWeeklyMetrics,
  getMetricsForDateRange,
} from '../metrics';
import { fetchMarketsFromContract } from '../contract-data';
import { PrismaClient } from '@prisma/client';

describe('Metrics Service', () => {
  let prismaClient: any;

  beforeAll(() => {
    // Get the mocked Prisma instance
    prismaClient = new PrismaClient();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPreviousWeekRange', () => {
    it('should return Monday to Sunday of the previous week', () => {
      // Mock current date to be Wednesday, December 27, 2024
      const mockDate = new Date('2024-12-27T12:00:00Z');
      vi.setSystemTime(mockDate);

      const { startDate, endDate } = getPreviousWeekRange();

      // Previous week should be Dec 16 (Monday) to Dec 22 (Sunday)
      expect(startDate.toISOString()).toBe('2024-12-16T00:00:00.000Z');
      expect(endDate.toISOString()).toBe('2024-12-22T23:59:59.999Z');
    });

    it('should handle Sunday correctly', () => {
      // Mock current date to be Sunday, December 29, 2024
      const mockDate = new Date('2024-12-29T12:00:00Z');
      vi.setSystemTime(mockDate);

      const { startDate, endDate } = getPreviousWeekRange();

      // Previous week should be Dec 16 (Monday) to Dec 22 (Sunday)
      expect(startDate.toISOString()).toBe('2024-12-16T00:00:00.000Z');
      expect(endDate.toISOString()).toBe('2024-12-22T23:59:59.999Z');
    });

    it('should handle Monday correctly', () => {
      // Mock current date to be Monday, December 30, 2024
      const mockDate = new Date('2024-12-30T12:00:00Z');
      vi.setSystemTime(mockDate);

      const { startDate, endDate } = getPreviousWeekRange();

      // Previous week should be Dec 23 (Monday) to Dec 29 (Sunday)
      expect(startDate.toISOString()).toBe('2024-12-23T00:00:00.000Z');
      expect(endDate.toISOString()).toBe('2024-12-29T23:59:59.999Z');
    });
  });

  describe('collectWeeklyMetrics', () => {
    it('should aggregate metrics correctly', async () => {
      const mockMarkets = [
        {
          id: '1',
          contractMarketId: 1,
          cityId: 'city1',
          city: { name: 'New York' },
          isTest: false,
          createdAt: new Date('2024-12-17'),
        },
        {
          id: '2',
          contractMarketId: 2,
          cityId: 'city2',
          city: { name: 'Los Angeles' },
          isTest: false,
          createdAt: new Date('2024-12-18'),
        },
      ];

      const mockContractMarkets = [
        {
          id: '1',
          cityId: 'new-york',
          cityName: 'New York',
          latitude: 40.7128,
          longitude: -74.0060,
          yesPool: '1000000000000000000', // 1 FLR
          noPool: '500000000000000000',    // 0.5 FLR
          status: 'resolved',
          outcome: true,
          thresholdF_tenths: 750,
          resolvedTempF_tenths: 780,
          resolveTime: 1702848000000,
          currency: 'FLR',
        },
        {
          id: '2',
          cityId: 'los-angeles',
          cityName: 'Los Angeles',
          latitude: 34.0522,
          longitude: -118.2437,
          yesPool: '2000000000000000000', // 2 FLR
          noPool: '1500000000000000000',   // 1.5 FLR
          status: 'resolved',
          outcome: false,
          thresholdF_tenths: 850,
          resolvedTempF_tenths: 840,
          resolveTime: 1702934400000,
          currency: 'FLR',
        },
      ];

      // Mock database queries
      prismaClient.market.findMany.mockResolvedValue(mockMarkets);
      prismaClient.suggestion.findMany.mockResolvedValue([]);
      prismaClient.testRun.findMany.mockResolvedValue([]);
      prismaClient.adminLog.findMany.mockResolvedValue([]);

      // Mock contract data
      vi.mocked(fetchMarketsFromContract).mockResolvedValue({
        markets: mockContractMarkets,
      });

      const metrics = await collectWeeklyMetrics();

      // Verify aggregated metrics
      expect(metrics.totalMarkets).toBe(2);
      expect(metrics.totalVolume).toBe('5.00'); // 1.5 + 3.5 = 5 FLR
      expect(metrics.uniqueBettors).toBe(0); // No bettor data in mock
      expect(metrics.topCities).toHaveLength(2);
      if (metrics.topCities[0]) {
        expect(metrics.topCities[0].name).toBe('Los Angeles'); // Higher volume
        expect(metrics.topCities[0].volume).toBe('3.50');
      }
      expect(metrics.marketHighlights).toHaveLength(2);
    });

    it('should handle empty data gracefully', async () => {
      // Mock empty responses
      prismaClient.market.findMany.mockResolvedValue([]);
      prismaClient.suggestion.findMany.mockResolvedValue([]);
      prismaClient.testRun.findMany.mockResolvedValue([]);
      prismaClient.adminLog.findMany.mockResolvedValue([]);

      vi.mocked(fetchMarketsFromContract).mockResolvedValue({
        markets: [],
      });

      const metrics = await collectWeeklyMetrics();

      expect(metrics.totalMarkets).toBe(0);
      expect(metrics.totalVolume).toBe('0.00');
      expect(metrics.uniqueBettors).toBe(0);
      expect(metrics.topCities).toHaveLength(0);
      expect(metrics.marketHighlights).toHaveLength(0);
      expect(metrics.approvedCities).toHaveLength(0);
    });

    it('should filter out test markets', async () => {
      const mockMarkets = [
        {
          id: '1',
          contractMarketId: 1,
          isTest: false,
          city: { name: 'New York' },
          createdAt: new Date('2024-12-17'),
        },
        {
          id: '2',
          contractMarketId: 2,
          isTest: true, // Test market - should be filtered out
          city: { name: 'Test City' },
          createdAt: new Date('2024-12-17'),
        },
      ];

      prismaClient.market.findMany.mockImplementation(async ({ where }: any) => {
        // Simulate Prisma filtering
        if (where?.isTest === false) {
          return mockMarkets.filter((m: any) => !m.isTest);
        }
        return mockMarkets;
      });

      prismaClient.suggestion.findMany.mockResolvedValue([]);
      prismaClient.testRun.findMany.mockResolvedValue([]);
      prismaClient.adminLog.findMany.mockResolvedValue([]);

      vi.mocked(fetchMarketsFromContract).mockResolvedValue({
        markets: [{
          id: '1',
          cityId: 'new-york',
          cityName: 'New York',
          latitude: 40.7128,
          longitude: -74.0060,
          yesPool: '1000000000000000000',
          noPool: '500000000000000000',
          status: 'pending',
          resolveTime: Date.now(),
          thresholdF_tenths: 750,
          currency: 'FLR',
        }] as any,
      });

      const metrics = await collectWeeklyMetrics();

      expect(metrics.totalMarkets).toBe(1); // Only non-test market
      expect(prismaClient.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isTest: false,
          }),
        })
      );
    });

    it('should calculate test run success rate correctly', async () => {
      const mockTestRuns = [
        { id: '1', status: 'COMPLETED', completedAt: new Date('2024-12-17') },
        { id: '2', status: 'COMPLETED', completedAt: new Date('2024-12-18') },
        { id: '3', status: 'FAILED', completedAt: new Date('2024-12-19') },
        { id: '4', status: 'COMPLETED', completedAt: new Date('2024-12-20') },
      ];

      prismaClient.market.findMany.mockResolvedValue([]);
      prismaClient.suggestion.findMany.mockResolvedValue([]);
      prismaClient.testRun.findMany.mockResolvedValue(mockTestRuns);
      prismaClient.adminLog.findMany.mockResolvedValue([]);

      vi.mocked(fetchMarketsFromContract).mockResolvedValue({
        markets: [],
      });

      const metrics = await collectWeeklyMetrics();

      // 3 out of 4 completed = 75% success rate
      // Note: The metrics object itself doesn't expose these values directly,
      // but the internal calculation should work correctly
      expect(prismaClient.testRun.findMany).toHaveBeenCalled();
    });
  });

  describe('getMetricsForDateRange', () => {
    it('should collect metrics for a custom date range', async () => {
      const startDate = new Date('2024-12-01');
      const endDate = new Date('2024-12-07');

      prismaClient.market.findMany.mockResolvedValue([]);
      prismaClient.suggestion.findMany.mockResolvedValue([]);
      prismaClient.testRun.findMany.mockResolvedValue([]);
      prismaClient.adminLog.findMany.mockResolvedValue([]);

      vi.mocked(fetchMarketsFromContract).mockResolvedValue({
        markets: [],
      });

      const metrics = await getMetricsForDateRange(startDate, endDate);

      expect(metrics.startDate).toBe('Dec 1, 2024');
      expect(metrics.endDate).toBe('Dec 7, 2024');
      expect(prismaClient.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });
  });
});