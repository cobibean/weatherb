import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getPublicMarkets, getMarketById } from '@/lib/markets';

describe('Test Market Filtering', () => {
  let testCityId: string;
  let testMarketId: string;
  let realMarketId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.market.deleteMany({
      where: {
        city: { name: { in: ['Test Market Filter City', 'Real Market City'] } }
      }
    });
    await prisma.city.deleteMany({
      where: { name: { in: ['Test Market Filter City', 'Real Market City'] } }
    });

    // Create test city
    const testCity = await prisma.city.create({
      data: {
        name: 'Test Market Filter City',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York',
        isActive: true
      }
    });
    testCityId = testCity.id;

    // Create a test market (isTest: true)
    const testMarket = await prisma.market.create({
      data: {
        contractMarketId: 999,
        cityId: testCityId,
        cityName: 'Test Market Filter City',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York',
        thresholdTemp: 850, // 85.0°F
        resolveTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        isTest: true
      }
    });
    testMarketId = testMarket.id;

    // Create a real market (isTest: false)
    const realCity = await prisma.city.create({
      data: {
        name: 'Real Market City',
        latitude: 34.0522,
        longitude: -118.2437,
        timezone: 'America/Los_Angeles',
        isActive: true
      }
    });

    const realMarket = await prisma.market.create({
      data: {
        contractMarketId: 1000,
        cityId: realCity.id,
        cityName: 'Real Market City',
        latitude: 34.0522,
        longitude: -118.2437,
        timezone: 'America/Los_Angeles',
        thresholdTemp: 750, // 75.0°F
        resolveTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // Day after tomorrow
        isTest: false
      }
    });
    realMarketId = realMarket.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.market.deleteMany({
      where: {
        id: { in: [testMarketId, realMarketId] }
      }
    });
    await prisma.city.deleteMany({
      where: { name: { in: ['Test Market Filter City', 'Real Market City'] } }
    });
  });

  it('should exclude test markets from public queries', async () => {
    const publicMarkets = await getPublicMarkets();

    // Should not include any test markets
    expect(publicMarkets.every(m => !m.isTest)).toBe(true);

    // Should include the real market
    expect(publicMarkets.some(m => m.id === realMarketId)).toBe(true);

    // Should NOT include the test market
    expect(publicMarkets.some(m => m.id === testMarketId)).toBe(false);
  });

  it('should filter test markets by default in getMarketById', async () => {
    // Try to get test market without includeTest flag
    const testMarketResult = await getMarketById(testMarketId);
    expect(testMarketResult).toBeNull();

    // Should be able to get real market
    const realMarketResult = await getMarketById(realMarketId);
    expect(realMarketResult).not.toBeNull();
    expect(realMarketResult?.id).toBe(realMarketId);
  });

  it('should allow test markets when includeTest is true', async () => {
    // Should be able to get test market when explicitly requested
    const testMarketResult = await getMarketById(testMarketId, true);
    expect(testMarketResult).not.toBeNull();
    expect(testMarketResult?.id).toBe(testMarketId);
    expect(testMarketResult?.isTest).toBe(true);
  });

  it('should only return non-test markets in public query with various filters', async () => {
    // Query all public markets
    const allPublic = await prisma.market.findMany({
      where: { isTest: false }
    });

    // None should have isTest: true
    expect(allPublic.every(m => !m.isTest)).toBe(true);

    // Create some additional test data for comprehensive testing
    const futureTestMarket = await prisma.market.create({
      data: {
        contractMarketId: 1001,
        cityId: testCityId,
        cityName: 'Test Market Filter City',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York',
        thresholdTemp: 800,
        resolveTime: new Date(Date.now() + 72 * 60 * 60 * 1000), // 3 days from now
        isTest: true
      }
    });

    // Query by resolve time
    const futureMarkets = await prisma.market.findMany({
      where: {
        isTest: false,
        resolveTime: { gte: new Date() }
      }
    });

    // Should not include the test market we just created
    expect(futureMarkets.every(m => !m.isTest)).toBe(true);
    expect(futureMarkets.some(m => m.id === futureTestMarket.id)).toBe(false);

    // Clean up
    await prisma.market.delete({ where: { id: futureTestMarket.id } });
  });
});
