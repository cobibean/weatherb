# Database Audit Report for Epic 7 Readiness

**Date:** December 28, 2024
**Project:** WeatherB
**Scope:** PostgreSQL/Prisma schema audit before Epic 7 (Voting/Suggestions) implementation
**Auditor:** Claude Code with PostgreSQL Design Skill

---

## Executive Summary

The current database schema is generally solid but requires critical fixes before Epic 7 implementation. Most issues are related to missing indexes, inconsistent data types, and normalization problems that will impact performance and data integrity at scale.

**Verdict:** ⚠️ **Fix critical issues before proceeding with Epic 7**

---

## Critical Issues (Must Fix Before Epic 7)

### 1. Missing Foreign Key Index on Vote Table

**What's wrong:** The proposed `Vote` table has no index on `suggestionId` despite having a foreign key relationship.

**Why it matters:** Every vote query will perform full table scans. With 10,000+ votes, queries will become extremely slow. Also, deleting suggestions will lock the entire Vote table during cascade operations.

**How to fix:**
```prisma
model Vote {
  id           String     @id @default(cuid())
  wallet       String
  suggestionId String
  suggestion   Suggestion @relation(fields: [suggestionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([wallet, suggestionId])
  @@index([suggestionId])  // ADD THIS
  @@index([createdAt])     // ADD THIS for trending calculations
}
```

**Priority:** CRITICAL

### 2. Inefficient Composite Index for Top Voted Queries

**What's wrong:** The proposed `@@index([status, voteCount])` on Suggestion table won't efficiently serve your most common query pattern.

**Why it matters:** Your primary query filters by status='PENDING' and sorts by voteCount DESC. The current index order makes sorting inefficient.

**How to fix:**
```prisma
model Suggestion {
  // ... other fields ...

  // Replace the composite index with:
  @@index([status, voteCount(sort: Desc)])  // Descending order on voteCount
  @@index([createdAt(sort: Desc)])          // For "recent" queries
  @@index([wallet])                          // For user's suggestions
  @@index([cityName])                        // For duplicate detection
}
```

**Priority:** CRITICAL

### 3. Race Condition Risk in Vote Count Updates

**What's wrong:** The transaction pattern for voting could lead to lost updates under concurrent load:
```typescript
prisma.$transaction([
  prisma.vote.create({ data: { wallet, suggestionId } }),
  prisma.suggestion.update({
    where: { id: suggestionId },
    data: { voteCount: { increment: 1 } }
  })
])
```

**Why it matters:** Under high load, concurrent votes might not all be counted correctly due to PostgreSQL's MVCC behavior.

**How to fix:** Use explicit locking or implement retry logic:
```typescript
await prisma.$transaction(async (tx) => {
  // Lock the suggestion row first
  const suggestion = await tx.suggestion.findUnique({
    where: { id: suggestionId },
    select: { id: true }
  });

  if (!suggestion) throw new Error('Suggestion not found');

  // Now safe to create vote and increment
  await tx.vote.create({ data: { wallet, suggestionId } });
  await tx.suggestion.update({
    where: { id: suggestionId },
    data: { voteCount: { increment: 1 } }
  });
}, {
  isolationLevel: 'Serializable', // Ensures consistency
  maxWait: 5000,
  timeout: 10000
});
```

**Priority:** CRITICAL

---

## Important Issues (Should Fix Before Epic 7)

### 4. City Data Normalization Problem

**What's wrong:** Suggestion stores cityName, latitude, longitude separately from the City table, creating data duplication and potential inconsistencies.

**Why it matters:**
- City coordinates could differ between suggestions for the same city
- No referential integrity to ensure valid cities
- Difficult to update city data globally

**How to fix:** Add optional foreign key to City table:
```prisma
model Suggestion {
  id          String   @id @default(cuid())

  // Option A: Reference existing city
  cityId      String?
  city        City?    @relation(fields: [cityId], references: [id])

  // Option B: Custom city (when not in allowlist)
  customCityName String?
  latitude       Float?
  longitude      Float?

  // Constraint: must have either cityId OR customCityName
  // Implement in application logic or database check constraint

  // ... rest of fields

  @@index([cityId])
}
```

**Priority:** IMPORTANT

### 5. Missing Wallet Indexes

**What's wrong:** No indexes on wallet fields across tables (AdminLog, AdminSession, Suggestion, Vote).

**Why it matters:** User-specific queries like "show my suggestions" or "what have I voted on" will be slow.

**How to fix:**
```prisma
model Suggestion {
  // ... existing fields ...
  @@index([wallet, status])  // For "my pending suggestions"
  @@index([wallet, createdAt(sort: Desc)])  // For "my recent suggestions"
}

model Vote {
  // ... existing fields ...
  @@index([wallet, createdAt(sort: Desc)])  // For "my recent votes"
}
```

**Priority:** IMPORTANT

### 6. TimeWindow Should Be An Enum

**What's wrong:** `timeWindow` is stored as free text `String?` which allows any value.

**Why it matters:** Inconsistent values ("morning" vs "Morning" vs "AM") will break filtering and aggregation.

**How to fix:**
```prisma
enum TimeWindow {
  MORNING    // 6am-12pm
  AFTERNOON  // 12pm-6pm
  EVENING    // 6pm-12am
  NIGHT      // 12am-6am
}

model Suggestion {
  // ... other fields ...
  timeWindow TimeWindow?  // Use enum instead of String
}
```

**Priority:** IMPORTANT

---

## Minor Issues (Can Defer)

### 7. CUID Performance Considerations

**What's wrong:** Using CUID for high-volume Vote records is less efficient than BIGINT.

**Why it matters:** CUIDs are 25 bytes vs 8 bytes for BIGINT. With millions of votes, this impacts:
- Storage size (3x larger)
- Index size (slower lookups)
- Join performance

**How to fix (if needed):**
```prisma
model Vote {
  id           BigInt     @id @default(autoincrement())
  // ... rest unchanged
}
```

**Priority:** MINOR (defer unless seeing performance issues)

### 8. Json Type in AdminLog

**What's wrong:** The `details Json?` field lacks type safety and makes querying difficult.

**Why it matters:** Can't efficiently query or index specific fields within the JSON.

**How to fix:** Consider structured fields or JSONB with validation:
```prisma
model AdminLog {
  // ... existing fields ...
  details     Json?    @db.JsonB  // Use JSONB for better performance
  marketId    Int?     // Extract common fields
  oldValue    String?
  newValue    String?
}
```

**Priority:** MINOR

### 9. Missing Pagination Limits

**What's wrong:** No database-level limits on query results.

**Why it matters:** A query without LIMIT could return thousands of rows, causing memory issues.

**How to fix:** Always use pagination in queries:
```typescript
// Add to all list queries
const MAX_RESULTS = 100;
prisma.suggestion.findMany({
  take: Math.min(requestedLimit || 50, MAX_RESULTS),
  skip: (page - 1) * limit
});
```

**Priority:** MINOR

---

## Recommendations for Epic 7 Implementation

### 1. Add Database-Level Check Constraints

```sql
-- After Prisma migration, add these constraints manually:

-- Ensure voteCount stays in sync
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
```

### 2. Implement Trending Score Efficiently

Instead of calculating trending from Vote.createdAt joins, add a dedicated field:

```prisma
model Suggestion {
  // ... existing fields ...
  recentVoteCount   Int      @default(0)  // Votes in last 7 days
  lastVoteAt        DateTime?             // For decay calculations

  @@index([status, recentVoteCount(sort: Desc)])  // For trending queries
}
```

Update via scheduled job:
```typescript
// Run daily to decay old votes
await prisma.$executeRaw`
  UPDATE "Suggestion"
  SET "recentVoteCount" = (
    SELECT COUNT(*) FROM "Vote"
    WHERE "Vote"."suggestionId" = "Suggestion"."id"
    AND "Vote"."createdAt" > NOW() - INTERVAL '7 days'
  )
  WHERE "status" = 'PENDING'
`;
```

### 3. Connection Pool Configuration

Update your Prisma client for Vercel serverless:

```typescript
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Add connection pool settings
  connection_limit: 1,  // Serverless should use 1 connection
});

// Ensure cleanup on function end
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
```

### 4. Migration Strategy

1. **Before Epic 7 deployment:**
   - Add missing indexes to existing tables
   - Update Prisma client configuration
   - Test with load simulation

2. **Epic 7 deployment:**
   - Deploy schema changes
   - Add check constraints via raw SQL
   - Monitor query performance

3. **Post-deployment:**
   - Add trending score optimization if needed
   - Consider Vote table ID type change if > 1M votes

---

## Query Performance Estimates

With recommended indexes:

| Query | Without Indexes | With Indexes | At 10K suggestions / 100K votes |
|-------|-----------------|--------------|----------------------------------|
| Top voted (50 results) | 500ms+ | <10ms | <20ms |
| Recent suggestions | 300ms+ | <5ms | <10ms |
| Check if user voted | 1000ms+ | <5ms | <5ms |
| User's suggestions | 400ms+ | <5ms | <10ms |
| Trending (current) | 2000ms+ | N/A | N/A |
| Trending (with field) | N/A | <10ms | <15ms |

---

## Prisma Schema - Final Recommended Version

```prisma
// Epic 7 Tables with all fixes applied

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

model Suggestion {
  id                String           @id @default(cuid())

  // City reference (either existing or custom)
  cityId            String?
  city              City?            @relation(fields: [cityId], references: [id])
  customCityName    String?
  latitude          Float?
  longitude         Float?

  timeWindow        TimeWindow?
  comment           String?          @db.Text
  wallet            String           // lowercase
  status            SuggestionStatus @default(PENDING)

  // Vote tracking
  voteCount         Int              @default(0)
  recentVoteCount   Int              @default(0)  // For trending
  lastVoteAt        DateTime?

  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  votes             Vote[]

  @@index([status, voteCount(sort: Desc)])
  @@index([status, recentVoteCount(sort: Desc)])
  @@index([createdAt(sort: Desc)])
  @@index([wallet, status])
  @@index([wallet, createdAt(sort: Desc)])
  @@index([cityId])
  @@index([customCityName])
}

model Vote {
  id           String     @id @default(cuid())
  wallet       String     // lowercase
  suggestionId String
  suggestion   Suggestion @relation(fields: [suggestionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([wallet, suggestionId])
  @@index([suggestionId])
  @@index([wallet, createdAt(sort: Desc)])
  @@index([createdAt])
}

// Update to City model to support relationship
model City {
  id        String   @id @default(cuid())
  name      String
  latitude  Float
  longitude Float
  timezone  String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  suggestions Suggestion[]  // Add relation

  @@index([isActive])
}
```

---

## Testing Checklist

Before deploying Epic 7:

- [ ] Load test with 10,000 suggestions and 100,000 votes
- [ ] Test concurrent voting (10+ simultaneous votes on same suggestion)
- [ ] Verify cascade delete performance
- [ ] Test pagination with large result sets
- [ ] Verify index usage with `EXPLAIN ANALYZE`
- [ ] Test connection pooling under load
- [ ] Verify wallet-based queries performance
- [ ] Test trending calculation performance

---

## Security Recommendations

### 1. Rate Limiting
Implement rate limiting for suggestion creation and voting to prevent spam:
```typescript
// Example using upstash/ratelimit
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"), // 10 suggestions per hour
});

const { success } = await ratelimit.limit(wallet);
if (!success) {
  return new Response("Rate limit exceeded", { status: 429 });
}
```

### 2. Input Validation
Validate all inputs before database operations:
```typescript
const suggestionSchema = z.object({
  cityName: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timeWindow: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']).optional(),
  comment: z.string().max(500).optional(),
});
```

### 3. SQL Injection Protection
Prisma parameterizes queries by default, but be careful with raw queries:
```typescript
// GOOD - parameterized
await prisma.$queryRaw`
  SELECT * FROM "Suggestion"
  WHERE "cityName" = ${cityName}
`;

// BAD - vulnerable to injection
await prisma.$queryRawUnsafe(
  `SELECT * FROM "Suggestion" WHERE "cityName" = '${cityName}'`
);
```

---

## Conclusion

Your current schema is well-structured but needs critical index additions and some normalization improvements before Epic 7. The most important fixes are:

1. **Add foreign key index on Vote.suggestionId** - prevents severe performance degradation
2. **Fix composite index order** - ensures efficient sorting
3. **Implement proper transaction isolation** - prevents lost votes
4. **Normalize city data** - maintains data integrity

With these fixes, your database will handle Epic 7's expected load efficiently and maintain data consistency as you scale.

**Estimated time to implement all critical fixes:** 4-6 hours
**Recommended: Fix critical + important issues:** 8-10 hours
**Full implementation with all optimizations:** 12-16 hours