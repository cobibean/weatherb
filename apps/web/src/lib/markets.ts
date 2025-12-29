/**
 * Market query functions with test market filtering.
 *
 * SECURITY CRITICAL: Test markets must NEVER appear in public queries.
 * All public-facing functions filter `isTest: false` by default.
 * Only admin/internal functions should include test markets.
 */

import { prisma } from '@/lib/prisma';
import type { Market } from '@prisma/client';

/**
 * Get all public markets (excludes test markets).
 * This is the primary function for public market queries.
 *
 * @returns Array of non-test markets
 */
export async function getPublicMarkets(): Promise<Market[]> {
  return prisma.market.findMany({
    where: {
      isTest: false,
    },
    orderBy: {
      resolveTime: 'asc',
    },
    include: {
      city: true,
    },
  });
}

/**
 * Get a market by ID.
 * By default, excludes test markets for security.
 *
 * @param id - Market ID to retrieve
 * @param includeTest - If true, allows retrieving test markets (admin/internal use only)
 * @returns Market if found and passes filter, null otherwise
 */
export async function getMarketById(
  id: string,
  includeTest: boolean = false
): Promise<Market | null> {
  const where: { id: string; isTest?: boolean } = { id };

  // By default, exclude test markets
  if (!includeTest) {
    where.isTest = false;
  }

  return prisma.market.findFirst({
    where,
    include: {
      city: true,
    },
  });
}

/**
 * Get a market by contract market ID.
 * By default, excludes test markets for security.
 *
 * @param contractMarketId - On-chain market ID
 * @param includeTest - If true, allows retrieving test markets (admin/internal use only)
 * @returns Market if found and passes filter, null otherwise
 */
export async function getMarketByContractId(
  contractMarketId: number,
  includeTest: boolean = false
): Promise<Market | null> {
  const where: { contractMarketId: number; isTest?: boolean } = { contractMarketId };

  // By default, exclude test markets
  if (!includeTest) {
    where.isTest = false;
  }

  return prisma.market.findFirst({
    where,
    include: {
      city: true,
    },
  });
}

/**
 * Get markets ready for settlement (past their resolve time).
 * By default, excludes test markets for security.
 *
 * @param includeTest - If true, includes test markets (admin/internal use only)
 * @returns Array of markets ready to settle
 */
export async function getMarketsReadyForSettlement(
  includeTest: boolean = false
): Promise<Market[]> {
  const where: { resolveTime: { lte: Date }; isTest?: boolean } = {
    resolveTime: {
      lte: new Date(),
    },
  };

  // By default, exclude test markets
  if (!includeTest) {
    where.isTest = false;
  }

  return prisma.market.findMany({
    where,
    orderBy: {
      resolveTime: 'asc',
    },
    include: {
      city: true,
    },
  });
}

/**
 * Get active markets (resolve time in the future).
 * By default, excludes test markets for security.
 *
 * @param includeTest - If true, includes test markets (admin/internal use only)
 * @returns Array of active markets
 */
export async function getActiveMarkets(
  includeTest: boolean = false
): Promise<Market[]> {
  const where: { resolveTime: { gt: Date }; isTest?: boolean } = {
    resolveTime: {
      gt: new Date(),
    },
  };

  // By default, exclude test markets
  if (!includeTest) {
    where.isTest = false;
  }

  return prisma.market.findMany({
    where,
    orderBy: {
      resolveTime: 'asc',
    },
    include: {
      city: true,
    },
  });
}

/**
 * Get markets by city.
 * By default, excludes test markets for security.
 *
 * @param cityId - City ID to filter by
 * @param includeTest - If true, includes test markets (admin/internal use only)
 * @returns Array of markets for the specified city
 */
export async function getMarketsByCity(
  cityId: string,
  includeTest: boolean = false
): Promise<Market[]> {
  const where: { cityId: string; isTest?: boolean } = { cityId };

  // By default, exclude test markets
  if (!includeTest) {
    where.isTest = false;
  }

  return prisma.market.findMany({
    where,
    orderBy: {
      resolveTime: 'desc',
    },
    include: {
      city: true,
    },
  });
}

/**
 * Get markets for a specific date range.
 * By default, excludes test markets for security.
 *
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @param includeTest - If true, includes test markets (admin/internal use only)
 * @returns Array of markets in the date range
 */
export async function getMarketsByDateRange(
  startDate: Date,
  endDate: Date,
  includeTest: boolean = false
): Promise<Market[]> {
  const where: {
    resolveTime: { gte: Date; lte: Date };
    isTest?: boolean;
  } = {
    resolveTime: {
      gte: startDate,
      lte: endDate,
    },
  };

  // By default, exclude test markets
  if (!includeTest) {
    where.isTest = false;
  }

  return prisma.market.findMany({
    where,
    orderBy: {
      resolveTime: 'asc',
    },
    include: {
      city: true,
    },
  });
}

/**
 * Admin function: Get all markets including test markets.
 * This should ONLY be used in admin contexts.
 *
 * @returns All markets (including test markets)
 */
export async function getAllMarketsAdmin(): Promise<Market[]> {
  return prisma.market.findMany({
    orderBy: {
      resolveTime: 'desc',
    },
    include: {
      city: true,
      testRun: true,
    },
  });
}

/**
 * Admin function: Get test markets only.
 * This should ONLY be used in admin contexts.
 *
 * @returns Array of test markets only
 */
export async function getTestMarketsAdmin(): Promise<Market[]> {
  return prisma.market.findMany({
    where: {
      isTest: true,
    },
    orderBy: {
      resolveTime: 'desc',
    },
    include: {
      city: true,
      testRun: true,
    },
  });
}
