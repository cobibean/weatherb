/**
 * ⚠️ QUARANTINED TEST FILE - DO NOT RUN
 * 
 * Disabled: 2025-01-01 during TypeScript audit cleanup
 * Reason: Database integration test that requires running Prisma connection
 * 
 * NOTE: This test actually hits the database (not mocked).
 * Should only run in CI with test database or locally with proper setup.
 * 
 * TO REBUILD THIS TEST:
 * 1. Ensure test database is available
 * 2. Update Prisma schema references if schema has changed
 * 3. Consider moving to E2E test suite
 * 
 * WHAT THIS TESTED:
 * - TestRun Prisma model with all required fields
 * - Market creation linked to City and Suggestion
 * - Database constraint validation
 * - Cleanup of test data
 */

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
        slug: 'test-market-city',
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

  it('should create a test run with all required fields', async () => {
    const testRun = await prisma.testRun.create({
      data: {
        suggestionId: testSuggestionId,
        walletKeys: 'encrypted-test-keys-data', // Renamed from encryptedKeys
        fundingAmount: '25.00', // Now Decimal
        marketsCreated: 3,
        marketsSettled: 0, // New required field
        recoveredAmount: '0.00', // New required field
        netCost: '25.00', // New required field
        results: { // New required field
          markets: [],
          totalBets: 0,
          totalVolume: '0.00'
        }
      }
    });

    expect(testRun.status).toBe('RUNNING');
    expect(testRun.keysDisposed).toBe(false);
    expect(testRun.marketsSettled).toBe(0);
    expect(testRun.fundingAmount.toString()).toBe('25');
    expect(testRun.recoveredAmount.toString()).toBe('0');
    expect(testRun.netCost.toString()).toBe('25');
    expect(testRun.results).toBeDefined();
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
