# Prompt: Database Audit for Epic 7 Readiness

**For Claude Code Agent:** This prompt requires the database design plugin. Before proceeding, you MUST invoke the database design plugin using the Skill tool to analyze the schemas provided below.

---

## Context

**Project:** WeatherB - Temperature prediction market on Flare blockchain

**Current State:**
- PostgreSQL database with Prisma ORM
- 4 existing tables: SystemConfig, City, AdminLog, AdminSession
- Deployed on Vercel (serverless environment)
- Production database uses pooled connections (port 6543) via DATABASE_URL
- Migrations use direct connections (port 5432) via DIRECT_URL

**Upcoming Feature:**
Epic 7 will add user voting/suggestions system with 2 new tables:
- `Suggestion` - User-submitted market suggestions
- `Vote` - Votes on suggestions (1 per wallet per suggestion)

**Problem:**
Before implementing Epic 7, we need to ensure our current database architecture is solid and identify any issues that would:
1. Create problems when adding Epic 7 tables
2. Cause performance issues with voting queries
3. Lead to data integrity problems
4. Require refactoring after Epic 7 is built

---

## Current Database Schema

**File:** `apps/web/prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  // DATABASE_URL: Use pooled connection (port 6543) for runtime
  // DIRECT_URL: Use direct connection (port 5432) for migrations
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// System-wide configuration (singleton pattern with id="default")
model SystemConfig {
  id            String   @id @default("default")
  cadence       Int      @default(5)       // minutes between market resolve times
  testMode      Boolean  @default(true)    // single city only when enabled
  dailyCount    Int      @default(5)       // markets created per day (max 5)
  bettingBuffer Int      @default(600)     // seconds before resolve to close betting
  isPaused      Boolean  @default(false)   // global pause state
  settlerPaused Boolean  @default(false)   // settlement pause state
  updatedAt     DateTime @updatedAt
}

// Allowlisted cities for market creation
model City {
  id        String   @id @default(cuid())
  name      String
  latitude  Float
  longitude Float
  timezone  String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive])
}

// Audit log for admin actions
model AdminLog {
  id        String   @id @default(cuid())
  wallet    String   // admin wallet address (lowercase)
  action    String   // e.g. "PAUSE", "UNPAUSE", "CANCEL_MARKET", "UPDATE_SETTINGS"
  details   Json?    // additional context (marketId, old/new values, etc.)
  createdAt DateTime @default(now())

  @@index([wallet])
  @@index([createdAt])
  @@index([action])
}

// Admin sessions for wallet-based auth
model AdminSession {
  id        String   @id @default(cuid())
  wallet    String   // lowercase wallet address
  nonce     String   // random nonce for signature verification
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([wallet])
  @@index([expiresAt])
}
```

---

## Proposed Epic 7 Schema Addition

**From:** `docs/prompts/epic-7-voting-implementation.md`

```prisma
model Suggestion {
  id          String   @id @default(cuid())
  cityName    String
  latitude    Float?
  longitude   Float?
  timeWindow  String?           // e.g., "afternoon", "morning", "evening"
  comment     String?
  wallet      String            // Suggester wallet address
  status      SuggestionStatus  @default(PENDING)
  voteCount   Int               @default(0)
  createdAt   DateTime          @default(now())
  votes       Vote[]

  @@index([status, voteCount])
  @@index([createdAt])
}

enum SuggestionStatus {
  PENDING      // Awaiting admin review
  APPROVED     // Admin approved, will be created
  REJECTED     // Admin rejected
  IMPLEMENTED  // Market created for this suggestion
}

model Vote {
  id           String     @id @default(cuid())
  wallet       String
  suggestionId String
  suggestion   Suggestion @relation(fields: [suggestionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([wallet, suggestionId]) // One vote per wallet per suggestion
  @@index([suggestionId])
}
```

---

## Epic 7 Query Patterns

**Expected query workload:**

### High-Frequency Reads
1. **List suggestions sorted by votes:**
   ```typescript
   prisma.suggestion.findMany({
     where: { status: 'PENDING' },
     orderBy: { voteCount: 'desc' },
     take: 50
   })
   ```

2. **List suggestions sorted by recent:**
   ```typescript
   prisma.suggestion.findMany({
     where: { status: 'PENDING' },
     orderBy: { createdAt: 'desc' },
     take: 50
   })
   ```

3. **List suggestions with "trending" (recent votes):**
   ```typescript
   // Option A: Filter by createdAt < 14 days, sort by voteCount
   prisma.suggestion.findMany({
     where: {
       status: 'PENDING',
       createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
     },
     orderBy: { voteCount: 'desc' },
     take: 50
   })

   // Option B: Calculate trending score from Vote.createdAt
   // (requires join - more expensive)
   ```

4. **Check if user voted on suggestion:**
   ```typescript
   prisma.vote.findUnique({
     where: { wallet_suggestionId: { wallet, suggestionId } }
   })
   ```

5. **Get top suggestions for admin (Epic 8 integration):**
   ```typescript
   prisma.suggestion.findMany({
     where: { status: 'PENDING' },
     orderBy: { voteCount: 'desc' },
     take: 10
   })
   ```

### Moderate-Frequency Writes
1. **Create suggestion:**
   ```typescript
   prisma.suggestion.create({ data: { ... } })
   ```

2. **Create vote + increment count (ATOMIC):**
   ```typescript
   prisma.$transaction([
     prisma.vote.create({ data: { wallet, suggestionId } }),
     prisma.suggestion.update({
       where: { id: suggestionId },
       data: { voteCount: { increment: 1 } }
     })
   ])
   ```

3. **Check for duplicate suggestion (spam prevention):**
   ```typescript
   prisma.suggestion.findFirst({
     where: {
       wallet,
       cityName,
       createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
     }
   })
   ```

### Low-Frequency Writes
1. **Admin updates suggestion status:**
   ```typescript
   prisma.suggestion.update({
     where: { id },
     data: { status: 'APPROVED' }
   })
   ```

---

## Audit Focus Areas

Please analyze the combined schema (current + Epic 7 addition) and provide feedback on:

### 1. Index Coverage & Performance
- [ ] Are the proposed indexes sufficient for Epic 7 queries?
- [ ] Are there missing composite indexes we need?
- [ ] Should we add indexes on `wallet` fields for user-specific queries?
- [ ] Is the `@@index([status, voteCount])` optimal for "top voted" queries?
- [ ] Do we need an index on `Suggestion.wallet` + `cityName` for duplicate detection?

### 2. ID Strategy
- [ ] Is `cuid()` the right choice for high-volume Vote records?
- [ ] Would UUIDs or auto-incrementing integers be better?
- [ ] Are there performance implications for CUID in joins?
- [ ] Should we use shorter IDs for Vote table?

### 3. Data Integrity & Constraints
- [ ] Is `onDelete: Cascade` correct for Vote → Suggestion?
- [ ] Should City table have relations to Suggestion? (cityName is free text)
- [ ] Are there missing NOT NULL constraints?
- [ ] Should `voteCount` be a computed field instead of denormalized?
- [ ] Any risk of voteCount getting out of sync?

### 4. Normalization & Schema Design
- [ ] Is `timeWindow` stored as free text optimal? (should it be an enum?)
- [ ] Should we normalize city data? (Suggestion stores cityName, lat, long separately from City table)
- [ ] Is the `details` Json field in AdminLog a problem? (type safety)
- [ ] Are there any N+1 query risks?

### 5. Scalability Concerns
- [ ] How will the schema handle 1000s of suggestions?
- [ ] How will the schema handle 10,000s of votes?
- [ ] Are there any query patterns that won't scale?
- [ ] Should we add pagination limits at the schema level?
- [ ] Connection pooling considerations for Vercel serverless?

### 6. Type Safety & Developer Experience
- [ ] Are Prisma types being used correctly in the codebase?
- [ ] Any missing enum definitions that should be added?
- [ ] Should we generate types for common query patterns?
- [ ] Are there migration risks when adding Epic 7 tables?

### 7. Epic 7 Readiness Issues
- [ ] Are there any existing schema patterns that would conflict with Epic 7?
- [ ] Do we need to refactor anything BEFORE adding Suggestion/Vote tables?
- [ ] Are there data migration concerns?
- [ ] Should we add analytics/metrics tables at the same time?

---

## Prisma Client Usage Patterns

**Current usage:** `apps/web/src/lib/prisma.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

**Questions:**
- [ ] Is this pattern correct for Vercel serverless?
- [ ] Should we configure connection pool size explicitly?
- [ ] Are there any connection leak risks?
- [ ] Should we enable query logging in production for Epic 7 launch?

---

## Expected Deliverable

Please provide a comprehensive database audit report that includes:

1. **Critical Issues** - Must fix before Epic 7 implementation
2. **Important Issues** - Should fix before Epic 7 implementation
3. **Minor Issues** - Can defer but should document
4. **Recommendations** - Best practices for Epic 7 implementation

For each issue, provide:
- **What's wrong:** Clear description of the problem
- **Why it matters:** Impact on Epic 7 or existing features
- **How to fix:** Specific changes to make (include code samples)
- **Priority:** Critical / Important / Minor

---

## Success Criteria

After this audit, we should:
- ✅ Have confidence that current schema is solid
- ✅ Know exactly what (if anything) needs refactoring before Epic 7
- ✅ Have optimized Epic 7 schema ready to implement
- ✅ Understand any performance bottlenecks to watch for
- ✅ Have migration plan if schema changes are needed

---

## References

**Key Files:**
- Current schema: `apps/web/prisma/schema.prisma`
- Prisma client: `apps/web/src/lib/prisma.ts`
- Admin session logic: `apps/web/src/lib/admin-session.ts` (shows transaction patterns)
- Admin data queries: `apps/web/src/lib/admin-data.ts` (shows query patterns)

**Epic 7 Spec:**
- Full specification: `docs/epics/epic-7-voting.md`
- Implementation prompt: `docs/prompts/epic-7-voting-implementation.md`

**Environment:**
- Vercel serverless (Next.js 15)
- PostgreSQL (production: Neon/Supabase with pooling)
- Prisma ORM v5.x

---

## Agent Instructions

**Your task:** Conduct a comprehensive database audit using the database design plugin.

**Steps:**

1. **Invoke the database design plugin** using the Skill tool
   - Provide the combined schema (current + Epic 7 tables)
   - Ask it to analyze for: performance, scalability, normalization, indexing, constraints

2. **Analyze the plugin's output** against the 7 audit focus areas listed above

3. **Generate the audit report** with the deliverable format specified:
   - Critical Issues (must fix before Epic 7)
   - Important Issues (should fix before Epic 7)
   - Minor Issues (can defer)
   - Recommendations (best practices)

4. **For each issue, provide:**
   - What's wrong
   - Why it matters for Epic 7
   - How to fix (with code samples)
   - Priority level

5. **Save the audit report** to `docs/audits/2025-12-28-database-epic-7-audit.md`

---

## Notes

- We are NOT storing market data in PostgreSQL (markets live on-chain only)
- City table is just an allowlist for market creation, not a source of truth
- Epic 7 suggestions may reference cities that don't exist in City table (free text)
- Wallet addresses stored as lowercase strings (0x... format)
- Production workload is currently low (<100 users), but Epic 7 aims for growth
- We will add Epic 8 (AI reports) immediately after Epic 7, which queries Suggestion data

Ready for database audit! 🔍
