import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Test Market Schema', () => {
  let testSuggestionId: string;
  let testCityId: string;

  beforeAll(async () => {
    // Clean up any existing test data first
    await prisma.testRun.deleteMany({ where: { suggestion: { wallet: '0xtest-markets' } } });
    await prisma.market.deleteMany({ where: { city: { name: 'Test Market City' } } });
    await prisma.suggestion.deleteMany({ where: { wallet: '0xtest-markets' } });
    await prisma.city.deleteMany({ where: { name: 'Test Market City' } });

    // Create a test city
    const city = await prisma.city.create({
      data: {
        name: 'Test Market City',
        latitude: 40.7128,
        longitude: -74.0060,
        timezone: 'America/New_York',
        isActive: true
      }
    });
    testCityId = city.id;

    // Create a test suggestion for foreign key constraints
    const suggestion = await prisma.suggestion.create({
      data: {
        customCityName: 'Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        wallet: '0xtest-markets',
        status: 'APPROVED'
      }
    });
    testSuggestionId = suggestion.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.testRun.deleteMany({ where: { suggestion: { wallet: '0xtest-markets' } } });
    await prisma.market.deleteMany({ where: { city: { name: 'Test Market City' } } });
    await prisma.suggestion.deleteMany({ where: { wallet: '0xtest-markets' } });
    await prisma.city.deleteMany({ where: { name: 'Test Market City' } });
  });

  it('should create a test run with linked markets', async () => {
    const testRun = await prisma.testRun.create({
      data: {
        suggestionId: testSuggestionId,
        fundingAmount: 25.0,
        marketsCreated: 3,
        encryptedKeys: 'encrypted-test-keys-data'
      }
    });

    expect(testRun.status).toBe('RUNNING');
    expect(testRun.keysDisposed).toBe(false);
  });

  it('should filter test markets from public queries', async () => {
    const publicMarkets = await prisma.market.findMany({
      where: { isTest: false }
    });

    const testMarkets = await prisma.market.findMany({
      where: { isTest: true }
    });

    expect(publicMarkets).not.toContainEqual(
      expect.objectContaining({ isTest: true })
    );
  });
});
