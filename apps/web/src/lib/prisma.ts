import { requireDatabaseUrl } from '@weatherb/shared/utils/database-url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: requireDatabaseUrl(),
      connectionTimeoutMillis: 5000,
    }),
    log: ['error'], // Disable verbose query logging
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Issue #3: Transaction isolation helper for Epic 7 voting
// Use Serializable isolation to prevent race conditions in vote counting
export async function isolatedTransaction<T>(
  fn: (
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>,
  ) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: 'Serializable',
    maxWait: 5000, // Wait up to 5s for transaction to start
    timeout: 10000, // Timeout after 10s
  });
}

// Issue #9: Pagination helper to prevent unbounded queries
export const MAX_QUERY_LIMIT = 100;

export function paginationParams(
  page: number = 1,
  limit: number = 50,
): { take: number; skip: number } {
  const safeLimit = Math.min(Math.max(1, limit), MAX_QUERY_LIMIT);
  const safePage = Math.max(1, page);

  return {
    take: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}

export default prisma;
