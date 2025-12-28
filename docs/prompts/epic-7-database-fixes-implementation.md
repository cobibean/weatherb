# Prompt: Implement Database Fixes and Update Epic 7 Plan

**For Claude Code Agent:** This prompt requires careful planning and implementation of database schema changes based on a comprehensive audit. You must read the audit report, create an implementation plan, execute the fixes, and update the Epic 7 documentation.

---

## Context

**Project:** WeatherB - Temperature prediction market on Flare blockchain

**Current Situation:**
- A comprehensive database audit has been completed (`docs/database-audit-epic-7.md`)
- 9 total issues identified (3 critical, 3 important, 3 minor)
- Epic 7 (Voting/Suggestions) implementation is blocked until critical issues are fixed
- Current Epic 7 plan needs updating with the improved schema

**Your Mission:**
Implement ALL 9 database fixes from the audit, then update the Epic 7 plan with the corrected schema and implementation patterns.

---

## Required Reading

**MUST READ FIRST (in this order):**

1. **Database Audit Report:** `docs/database-audit-epic-7.md`
   - Contains all 9 issues with detailed fixes
   - Includes recommended Prisma schema
   - Has performance implications and testing checklist

2. **Current Epic 7 Plan:** `docs/epics/epic-7-voting.md`
   - Current (flawed) schema design
   - Implementation tasks that need updating
   - API route patterns that need fixing

3. **Current Schema:** `apps/web/prisma/schema.prisma`
   - Existing database schema
   - Need to understand current state before adding Epic 7 tables

4. **Security Recommendations:** `docs/security-recommendations.md`
   - Security patterns to follow during implementation

---

## Implementation Tasks

### Phase 1: Plan Creation

Create a detailed implementation plan (`docs/plans/2024-12-28-epic-7-database-fixes.md`) that includes:

1. **Pre-implementation checks:**
   - Backup strategy for existing database
   - List of all schema changes needed
   - Migration rollback plan

2. **Fix implementation order:**
   - Group changes by table (existing vs new)
   - Identify dependencies between changes
   - Plan for zero-downtime migration

3. **Testing strategy:**
   - Unit tests for new constraints
   - Load testing scenarios
   - Rollback testing

### Phase 2: Schema Implementation

#### Task 1: Update Existing Tables (Important Issue #5)
Add missing indexes to existing tables:

```prisma
model AdminLog {
  // ... existing fields ...
  @@index([wallet, createdAt(sort: Desc)])  // Add for wallet queries
}

model AdminSession {
  // ... existing fields ...
  @@index([wallet, expiresAt])  // Optimize session lookups
}
```

#### Task 2: Create Enhanced Epic 7 Schema (All Issues)

Implement the complete fixed schema addressing all 9 issues:

**Critical Fixes:**
- ✅ Issue #1: Add foreign key index on Vote.suggestionId
- ✅ Issue #2: Fix composite index order with DESC sorting
- ✅ Issue #3: Add transaction isolation level configuration

**Important Fixes:**
- ✅ Issue #4: Normalize city data with optional FK to City table
- ✅ Issue #5: Add wallet indexes for user queries
- ✅ Issue #6: Convert timeWindow to enum

**Minor Fixes:**
- ✅ Issue #7: Document CUID vs BIGINT tradeoffs (keep CUID for now)
- ✅ Issue #8: Update AdminLog to use JSONB
- ✅ Issue #9: Add pagination limits to queries

```prisma
// Add these enums
enum SuggestionStatus {
  PENDING
  APPROVED
  REJECTED
  IMPLEMENTED
}

enum TimeWindow {
  MORNING
  AFTERNOON
  EVENING
  NIGHT
}

// Full Suggestion model with ALL fixes
model Suggestion {
  id                String           @id @default(cuid())

  // City normalization (Issue #4)
  cityId            String?
  city              City?            @relation(fields: [cityId], references: [id])
  customCityName    String?
  latitude          Float?
  longitude         Float?

  timeWindow        TimeWindow?      // Issue #6: Enum not String
  comment           String?          @db.Text
  wallet            String
  status            SuggestionStatus @default(PENDING)

  // Vote tracking with trending support
  voteCount         Int              @default(0)
  recentVoteCount   Int              @default(0)
  lastVoteAt        DateTime?

  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  votes             Vote[]

  // All required indexes (Issues #2, #5)
  @@index([status, voteCount(sort: Desc)])
  @@index([status, recentVoteCount(sort: Desc)])
  @@index([createdAt(sort: Desc)])
  @@index([wallet, status])
  @@index([wallet, createdAt(sort: Desc)])
  @@index([cityId])
  @@index([customCityName])
}

model Vote {
  id           String     @id @default(cuid())  // Issue #7: Keep CUID for now
  wallet       String
  suggestionId String
  suggestion   Suggestion @relation(fields: [suggestionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([wallet, suggestionId])
  @@index([suggestionId])                      // Issue #1: Critical FK index
  @@index([wallet, createdAt(sort: Desc)])     // Issue #5: Wallet queries
  @@index([createdAt])                         // For trending calculations
}

// Update City model for relationship
model City {
  // ... existing fields ...
  suggestions Suggestion[]  // Add relation for Issue #4
}

// Update AdminLog for Issue #8
model AdminLog {
  // ... existing fields ...
  details Json? @db.JsonB  // Change to JSONB
}
```

#### Task 3: Create Database Constraints

Create a migration SQL file for constraints that Prisma doesn't support:

```sql
-- migrations/add_epic7_constraints.sql

-- Ensure voteCount never goes negative
ALTER TABLE "Suggestion"
ADD CONSTRAINT vote_count_non_negative
CHECK ("voteCount" >= 0);

-- Ensure either cityId or customCityName is present
ALTER TABLE "Suggestion"
ADD CONSTRAINT city_required
CHECK (
  ("cityId" IS NOT NULL) OR
  ("customCityName" IS NOT NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL)
);

-- Ensure recentVoteCount never exceeds total voteCount
ALTER TABLE "Suggestion"
ADD CONSTRAINT recent_votes_valid
CHECK ("recentVoteCount" <= "voteCount");
```

#### Task 4: Update Prisma Client Configuration (Issue #3, #9)

Update `apps/web/src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Enhanced configuration for Epic 7
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
    // Add query timeout for serverless
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Add helper for transactions with proper isolation (Issue #3)
export async function isolatedTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: 'Serializable',
    maxWait: 5000,
    timeout: 10000,
  });
}

// Add pagination helper (Issue #9)
export const MAX_QUERY_LIMIT = 100;

export function paginationParams(page: number = 1, limit: number = 50) {
  const safeLimit = Math.min(Math.max(1, limit), MAX_QUERY_LIMIT);
  const safePage = Math.max(1, page);

  return {
    take: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}

export default prisma;
```

#### Task 5: Create Vote Transaction Handler (Issue #3)

Create `apps/web/src/lib/voting.ts`:

```typescript
import { isolatedTransaction, prisma } from './prisma';

export async function castVote(wallet: string, suggestionId: string): Promise<void> {
  // Use serializable isolation to prevent race conditions
  await isolatedTransaction(async (tx) => {
    // Lock the suggestion row first
    const suggestion = await tx.suggestion.findUnique({
      where: { id: suggestionId },
      select: { id: true, status: true },
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion is not open for voting');
    }

    // Create vote (will fail if duplicate due to unique constraint)
    await tx.vote.create({
      data: {
        wallet: wallet.toLowerCase(),
        suggestionId,
      },
    });

    // Increment counts atomically
    await tx.suggestion.update({
      where: { id: suggestionId },
      data: {
        voteCount: { increment: 1 },
        recentVoteCount: { increment: 1 },
        lastVoteAt: new Date(),
      },
    });
  });
}

export async function removeVote(wallet: string, suggestionId: string): Promise<void> {
  await isolatedTransaction(async (tx) => {
    const vote = await tx.vote.findUnique({
      where: {
        wallet_suggestionId: {
          wallet: wallet.toLowerCase(),
          suggestionId,
        },
      },
    });

    if (!vote) {
      throw new Error('Vote not found');
    }

    await tx.vote.delete({
      where: { id: vote.id },
    });

    await tx.suggestion.update({
      where: { id: suggestionId },
      data: {
        voteCount: { decrement: 1 },
        // Don't decrement recentVoteCount here - handle in scheduled job
      },
    });
  });
}
```

#### Task 6: Create Trending Update Job

Create `apps/web/src/lib/trending.ts`:

```typescript
import prisma from './prisma';

export async function updateTrendingScores(): Promise<void> {
  // Update recentVoteCount for all pending suggestions
  // This should run daily via cron job

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  await prisma.$executeRaw`
    UPDATE "Suggestion"
    SET "recentVoteCount" = (
      SELECT COUNT(*)
      FROM "Vote"
      WHERE "Vote"."suggestionId" = "Suggestion"."id"
      AND "Vote"."createdAt" > ${sevenDaysAgo}
    )
    WHERE "status" = 'PENDING'
  `;
}
```

### Phase 3: Update API Routes

Update the Epic 7 API routes with proper pagination and error handling:

```typescript
// apps/web/src/app/api/suggestions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma, { paginationParams } from '@/lib/prisma';
import { castVote } from '@/lib/voting';

const listQuerySchema = z.object({
  sort: z.enum(['votes', 'recent', 'trending']).default('votes'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse(Object.fromEntries(searchParams));

    const orderBy =
      query.sort === 'votes' ? { voteCount: 'desc' as const } :
      query.sort === 'trending' ? { recentVoteCount: 'desc' as const } :
      { createdAt: 'desc' as const };

    const suggestions = await prisma.suggestion.findMany({
      where: { status: 'PENDING' },
      orderBy,
      ...paginationParams(query.page, query.limit),
      include: {
        city: true,
        _count: {
          select: { votes: true },
        },
      },
    });

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Failed to list suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to list suggestions' },
      { status: 500 }
    );
  }
}
```

### Phase 4: Testing Implementation

Create comprehensive tests in `apps/web/src/lib/__tests__/voting.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { castVote, removeVote } from '../voting';
import prisma from '../prisma';

describe('Voting System', () => {
  beforeEach(async () => {
    // Clean test data
    await prisma.vote.deleteMany();
    await prisma.suggestion.deleteMany();
  });

  it('should handle concurrent votes correctly', async () => {
    // Create test suggestion
    const suggestion = await prisma.suggestion.create({
      data: {
        customCityName: 'Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        wallet: '0xtest',
        status: 'PENDING',
      },
    });

    // Simulate 10 concurrent votes
    const votePromises = Array.from({ length: 10 }, (_, i) =>
      castVote(`0xvoter${i}`, suggestion.id)
    );

    await Promise.all(votePromises);

    // Verify count is exactly 10
    const updated = await prisma.suggestion.findUnique({
      where: { id: suggestion.id },
    });

    expect(updated?.voteCount).toBe(10);
    expect(updated?.recentVoteCount).toBe(10);
  });

  it('should prevent duplicate votes', async () => {
    const suggestion = await prisma.suggestion.create({
      data: {
        customCityName: 'Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        wallet: '0xtest',
        status: 'PENDING',
      },
    });

    await castVote('0xvoter', suggestion.id);

    // Second vote should fail
    await expect(castVote('0xvoter', suggestion.id)).rejects.toThrow();

    // Count should still be 1
    const updated = await prisma.suggestion.findUnique({
      where: { id: suggestion.id },
    });
    expect(updated?.voteCount).toBe(1);
  });
});
```

### Phase 5: Update Epic 7 Documentation

Update `docs/epics/epic-7-voting.md` with:

1. **Replace the schema section** with the corrected schema from Phase 2
2. **Update API route examples** with proper error handling and pagination
3. **Add a new section** for transaction handling and race condition prevention
4. **Update the acceptance criteria** to include:
   - Concurrent voting handled correctly
   - Pagination implemented on all list endpoints
   - Rate limiting configured
   - Trending scores updated daily

5. **Add a new "Database Performance" section** with:
   - Expected query performance metrics
   - Index usage guidelines
   - Monitoring queries for slow performance

6. **Update effort estimates** to include:
   - Database migration and testing: 2 hours
   - Transaction handling implementation: 2 hours
   - Load testing: 2 hours

---

## Migration Plan

### Step 1: Development Environment
1. Backup current dev database
2. Create new migration: `npx prisma migrate dev --name epic7_complete`
3. Run manual SQL for check constraints
4. Run tests to verify all constraints work

### Step 2: Staging Environment
1. Deploy to staging branch
2. Run migration on staging database
3. Perform load testing with 10K suggestions, 100K votes
4. Verify all indexes are being used (check with EXPLAIN)

### Step 3: Production Deployment
1. Schedule maintenance window (if needed)
2. Backup production database
3. Deploy schema changes
4. Run migrations
5. Add check constraints
6. Monitor performance metrics

---

## Success Criteria

After implementing all fixes:

✅ All 9 issues from audit are resolved
✅ Schema includes all recommended indexes
✅ Transaction isolation prevents race conditions
✅ Load test passes with 10K suggestions / 100K votes
✅ All queries complete in < 50ms
✅ Epic 7 documentation updated with correct schema
✅ Tests verify concurrent voting works correctly
✅ Pagination limits prevent memory issues
✅ Trending scores update automatically

---

## Testing Checklist

Before marking complete:

- [ ] Run `npx prisma migrate dev` successfully
- [ ] All TypeScript types generated correctly
- [ ] Concurrent voting test passes (10+ simultaneous votes)
- [ ] Duplicate vote prevention works
- [ ] Pagination limits enforced (can't request > 100 items)
- [ ] Index usage verified with `EXPLAIN ANALYZE`
- [ ] Load test with 10K suggestions doesn't timeout
- [ ] Trending job updates scores correctly
- [ ] City normalization works (both cityId and custom)
- [ ] TimeWindow enum validates correctly

---

## Deliverables

1. **Implementation Plan:** `docs/plans/2024-12-28-epic-7-database-fixes.md`
2. **Updated Schema:** `apps/web/prisma/schema.prisma` with all fixes
3. **Migration Files:** All Prisma migrations + constraint SQL
4. **Helper Libraries:** `voting.ts`, `trending.ts`, enhanced `prisma.ts`
5. **Tests:** Comprehensive test suite for voting system
6. **Updated Epic 7 Doc:** `docs/epics/epic-7-voting.md` with correct patterns
7. **Performance Report:** Results from load testing

---

## Time Estimate

- Planning & Documentation: 2 hours
- Schema Implementation: 3 hours
- API Routes & Helpers: 3 hours
- Testing Implementation: 2 hours
- Load Testing & Verification: 2 hours
- Documentation Updates: 1 hour

**Total: 13 hours**

---

## Important Notes

1. **NEVER skip the transaction isolation fix** - this prevents data corruption
2. **Always test with concurrent operations** - serial testing won't catch race conditions
3. **Verify index usage with EXPLAIN** - having an index doesn't mean it's being used
4. **Keep the trending job lightweight** - it runs daily on all suggestions
5. **Document any deviations** from this plan in the implementation notes

Good luck! Remember to test thoroughly at each phase before proceeding to the next. The audit identified real issues that WILL cause problems in production if not fixed properly.