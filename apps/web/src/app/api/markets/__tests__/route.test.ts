import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import type { SerializedMarket } from '@/lib/contract-data';

// Mock the contract-data module
vi.mock('@/lib/contract-data', () => ({
  fetchMarketsFromContract: vi.fn(),
}));

describe('GET /api/markets - Test Market Filtering', () => {
  let testCityId: string;
  let testMarketDbId: string;
  let realMarketDbId: string;
  let pastMarketDbId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.market.deleteMany({
      where: {
        city: { name: { in: ['API Test City', 'API Real City'] } }
      }
    });
    await prisma.city.deleteMany({
      where: { name: { in: ['API Test City', 'API Real City'] } }
    });

    // Create test city
    const testCity = await prisma.city.create({
      data: {
        slug: 'api-test-city',
        name: 'API Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York',
        isActive: true
      }
    });
    testCityId = testCity.id;

    // Create real city
    const realCity = await prisma.city.create({
      data: {
        slug: 'api-real-city',
        name: 'API Real City',
        latitude: 34.0522,
        longitude: -118.2437,
        timezone: 'America/Los_Angeles',
        isActive: true
      }
    });

    // Create a test market in database (isTest: true)
    const testMarket = await prisma.market.create({
      data: {
        contractMarketId: 100, // This corresponds to blockchain market ID
        cityId: testCityId,
        cityName: 'API Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York',
        thresholdTemp: 850,
        resolveTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isTest: true
      }
    });
    testMarketDbId = testMarket.id;

    // Create a real market in database (isTest: false)
    const realMarket = await prisma.market.create({
      data: {
        contractMarketId: 101, // This corresponds to blockchain market ID
        cityId: realCity.id,
        cityName: 'API Real City',
        latitude: 34.0522,
        longitude: -118.2437,
        timezone: 'America/Los_Angeles',
        thresholdTemp: 750,
        resolveTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
        isTest: false
      }
    });
    realMarketDbId = realMarket.id;

    const pastMarket = await prisma.market.create({
      data: {
        contractMarketId: 102,
        cityId: realCity.id,
        cityName: 'API Real City',
        latitude: 34.0522,
        longitude: -118.2437,
        timezone: 'America/Los_Angeles',
        thresholdTemp: 750,
        resolveTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'RESOLVED',
        isSettled: true,
        settledAt: new Date(),
        actualTemp: 760,
        outcome: 'YES',
        yesPool: '2000000000000000000',
        noPool: '2000000000000000000',
        isTest: false
      }
    });
    pastMarketDbId = pastMarket.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.market.deleteMany({
      where: {
        id: { in: [testMarketDbId, realMarketDbId, pastMarketDbId] }
      }
    });
    await prisma.city.deleteMany({
      where: { name: { in: ['API Test City', 'API Real City'] } }
    });
  });

  it('should filter out test markets from blockchain response', async () => {
    // Mock blockchain response with both test and real markets
    const mockBlockchainMarkets: SerializedMarket[] = [
      {
        id: '100', // Test market
        cityId: 'api-test-city',
        cityName: 'API Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        resolveTime: Date.now() + 24 * 60 * 60 * 1000,
        thresholdF_tenths: 850,
        currency: 'FLR',
        status: 'open',
        yesPool: '1000000000000000000',
        noPool: '1000000000000000000',
      },
      {
        id: '101', // Real market
        cityId: 'api-real-city',
        cityName: 'API Real City',
        latitude: 34.0522,
        longitude: -118.2437,
        resolveTime: Date.now() + 48 * 60 * 60 * 1000,
        thresholdF_tenths: 750,
        currency: 'FLR',
        status: 'open',
        yesPool: '2000000000000000000',
        noPool: '2000000000000000000',
      },
    ];

    const { fetchMarketsFromContract } = await import('@/lib/contract-data');
    vi.mocked(fetchMarketsFromContract).mockResolvedValue({
      markets: mockBlockchainMarkets,
    });

    // Create mock request
    const request = new Request('http://localhost:3000/api/markets');

    // Call the API route
    const response = await GET(request);
    const data = await response.json();

    // Verify test market is filtered out
    expect(data.markets).toHaveLength(1);
    expect(data.markets[0].id).toBe('101'); // Only real market
    expect(data.markets[0].cityName).toBe('API Real City');

    // Verify test market is NOT in the response
    const testMarketInResponse = data.markets.find((m: SerializedMarket) => m.id === '100');
    expect(testMarketInResponse).toBeUndefined();
  });

  it('should handle status filter while excluding test markets', async () => {
    // Mock blockchain response with test and real markets in different states
    const mockBlockchainMarkets: SerializedMarket[] = [
      {
        id: '100', // Test market - active
        cityId: 'api-test-city',
        cityName: 'API Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        resolveTime: Date.now() + 24 * 60 * 60 * 1000,
        thresholdF_tenths: 850,
        currency: 'FLR',
        status: 'open',
        yesPool: '1000000000000000000',
        noPool: '1000000000000000000',
      },
      {
        id: '101', // Real market - active
        cityId: 'api-real-city',
        cityName: 'API Real City',
        latitude: 34.0522,
        longitude: -118.2437,
        resolveTime: Date.now() + 48 * 60 * 60 * 1000,
        thresholdF_tenths: 750,
        currency: 'FLR',
        status: 'open',
        yesPool: '2000000000000000000',
        noPool: '2000000000000000000',
      },
      {
        id: '102', // Real market - resolved (from DB, not RPC)
        cityId: 'api-real-city',
        cityName: 'API Real City',
        latitude: 34.0522,
        longitude: -118.2437,
        resolveTime: Date.now() - 24 * 60 * 60 * 1000,
        thresholdF_tenths: 750,
        currency: 'FLR',
        status: 'resolved',
        yesPool: '2000000000000000000',
        noPool: '2000000000000000000',
        resolvedTempF_tenths: 760,
        outcome: true,
      },
    ];

    const { fetchMarketsFromContract } = await import('@/lib/contract-data');
    vi.mocked(fetchMarketsFromContract).mockResolvedValue({
      markets: mockBlockchainMarkets,
    });

    // Test active filter
    const activeRequest = new Request('http://localhost:3000/api/markets?status=active');
    const activeResponse = await GET(activeRequest);
    const activeData = await activeResponse.json();

    // Should only return real active market (not test market 100)
    expect(activeData.markets).toHaveLength(1);
    expect(activeData.markets[0].id).toBe('101');
    expect(activeData.markets[0].status).toBe('open');

    // Test past filter (uses DB, not RPC)
    const pastRequest = new Request('http://localhost:3000/api/markets?status=past');
    const pastResponse = await GET(pastRequest);
    const pastData = await pastResponse.json();

    // Should only return resolved real market
    expect(pastData.markets).toHaveLength(1);
    expect(pastData.markets[0].id).toBe('102');
    expect(pastData.markets[0].status).toBe('resolved');
  });

  it('should handle empty test markets gracefully', async () => {
    // Get all current test market IDs before modifying
    const currentTestMarkets = await prisma.market.findMany({
      where: { isTest: true },
      select: { id: true }
    });
    const testMarketIds = currentTestMarkets.map(m => m.id);

    // Temporarily mark test markets as non-test
    await prisma.market.updateMany({
      where: { isTest: true },
      data: { isTest: false }
    });

    const mockBlockchainMarkets: SerializedMarket[] = [
      {
        id: '101',
        cityId: 'api-real-city',
        cityName: 'API Real City',
        latitude: 34.0522,
        longitude: -118.2437,
        resolveTime: Date.now() + 48 * 60 * 60 * 1000,
        thresholdF_tenths: 750,
        currency: 'FLR',
        status: 'open',
        yesPool: '2000000000000000000',
        noPool: '2000000000000000000',
      },
    ];

    const { fetchMarketsFromContract } = await import('@/lib/contract-data');
    vi.mocked(fetchMarketsFromContract).mockResolvedValue({
      markets: mockBlockchainMarkets,
    });

    const request = new Request('http://localhost:3000/api/markets');
    const response = await GET(request);
    const data = await response.json();

    // Should return all markets when no test markets exist
    expect(data.markets).toHaveLength(1);
    expect(data.markets[0].id).toBe('101');

    // Restore ALL test market flags that we modified
    await prisma.market.updateMany({
      where: { id: { in: testMarketIds } },
      data: { isTest: true }
    });
  });
});
