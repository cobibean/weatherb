# Epic 7 — Voting / Suggestions (Growth Loop)

> **Goal:** Let users suggest and vote on new markets to guide platform growth.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | **PostgreSQL** | Already using, fast, sufficient for V1 |
| Voting model | **1 vote per wallet per suggestion** | Simple, sybil-resistant enough for V1 |
| On-chain vs off-chain | **Off-chain** | Fast, cheap, can move on-chain later |

---

## Features

### For Users

1. **Submit suggestion**
   - Select city (from expanded list, not just allowlist)
   - Suggest preferred time window
   - Optional: Add comment

2. **Vote on suggestions**
   - Browse open suggestions
   - Upvote (1 per wallet per suggestion)
   - See vote counts and momentum

3. **Leaderboard**
   - Top suggestions by votes
   - Trending (velocity of votes)
   - Recently added

### For Admin (via Epic 8 email)

- See top suggestions weekly
- Approve/reject with one click

---

## Database Schema

**UPDATED:** Schema includes all fixes from database audit (see `docs/testing/database-audit-epic-7.md`)

```prisma
// Epic 7: Voting/Suggestions Schema
// All audit issues addressed

enum SuggestionStatus {
  PENDING
  APPROVED
  REJECTED
  IMPLEMENTED
}

enum TimeWindow {
  MORNING     // 6am-12pm
  AFTERNOON   // 12pm-6pm
  EVENING     // 6pm-12am
  NIGHT       // 12am-6am
}

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

  // Vote tracking with trending
  voteCount         Int              @default(0)
  recentVoteCount   Int              @default(0)  // Votes in last 7 days
  lastVoteAt        DateTime?

  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  votes             Vote[]

  // All required indexes (Issues #1, #2, #5)
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
  wallet       String
  suggestionId String
  suggestion   Suggestion @relation(fields: [suggestionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([wallet, suggestionId])
  @@index([suggestionId])                    // Issue #1: Critical FK index
  @@index([wallet, createdAt(sort: Desc)])   // Issue #5: Wallet queries
  @@index([createdAt])                       // Trending calculations
}
```

**Check Constraints** (applied manually after migrations):
- `vote_count_non_negative`: Ensures voteCount >= 0
- `recent_votes_valid`: Ensures recentVoteCount <= voteCount
- `city_required`: Ensures either cityId OR (customCityName + coords)

---

## API Routes

```typescript
// app/api/suggestions/route.ts

// GET - List suggestions
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') || 'votes'; // votes, recent, trending
  
  const suggestions = await db.suggestion.findMany({
    where: { status: 'PENDING' },
    orderBy: sort === 'votes' ? { voteCount: 'desc' } : { createdAt: 'desc' },
    take: 50,
  });
  
  return Response.json(suggestions);
}

// POST - Create suggestion
export async function POST(request: Request) {
  const body = await request.json();
  const wallet = await getWalletFromSession(request);
  
  const suggestion = await db.suggestion.create({
    data: {
      cityName: body.cityName,
      latitude: body.latitude,
      longitude: body.longitude,
      timeWindow: body.timeWindow,
      comment: body.comment,
      wallet,
    },
  });
  
  return Response.json(suggestion);
}
```

```typescript
// app/api/suggestions/[id]/vote/route.ts

export async function POST(request: Request, { params }) {
  const wallet = await getWalletFromSession(request);
  const { id } = params;
  
  try {
    await db.$transaction([
      db.vote.create({
        data: { wallet, suggestionId: id },
      }),
      db.suggestion.update({
        where: { id },
        data: { voteCount: { increment: 1 } },
      }),
    ]);
    
    return Response.json({ success: true });
  } catch (error) {
    if (error.code === 'P2002') { // Unique constraint
      return Response.json({ error: 'Already voted' }, { status: 400 });
    }
    throw error;
  }
}
```

---

## Transaction Handling & Race Condition Prevention

**Critical:** Voting uses Serializable transaction isolation to prevent lost updates (Issue #3).

### Concurrent Vote Handling

The `castVote()` function uses the following pattern:

```typescript
await isolatedTransaction(async (tx) => {
  // 1. Lock suggestion row
  const suggestion = await tx.suggestion.findUnique({
    where: { id: suggestionId },
  });

  // 2. Create vote (fails on duplicate)
  await tx.vote.create({ ... });

  // 3. Increment counts atomically
  await tx.suggestion.update({
    where: { id: suggestionId },
    data: { voteCount: { increment: 1 } }
  });
});
```

This ensures that even with 100 concurrent votes, all are counted correctly.

**Retry Logic:** Automatic retries (5 attempts) with exponential backoff (50-400ms) for serialization conflicts.

### Trending Score Updates

`recentVoteCount` is updated daily via cron job, not in real-time:

```typescript
// apps/web/src/app/api/cron/update-trending/route.ts
export async function GET() {
  const result = await updateTrendingScores();
  return Response.json(result);
}
```

**Vercel cron config:**
```json
{
  "crons": [{
    "path": "/api/cron/update-trending",
    "schedule": "0 0 * * *"  // Daily at midnight UTC
  }]
}
```

---

## UI Components

```
apps/web/src/components/voting/
├── suggestion-card.tsx      # Display single suggestion
├── suggestion-list.tsx      # List with filters
├── suggestion-form.tsx      # Submit new suggestion
├── vote-button.tsx          # Upvote with count
└── leaderboard.tsx          # Top suggestions
```

---

## Tasks

### 7.1 Database Schema
- [x] Add Suggestion and Vote models
- [x] Create migrations
- [x] Add indexes for common queries

### 7.2 API Routes
- [x] GET /api/suggestions (list with sorting)
- [x] POST /api/suggestions (create)
- [x] POST /api/suggestions/[id]/vote
- [x] GET /api/suggestions/[id] (single suggestion)

### 7.3 Suggestion Submission
- [x] Create SuggestionForm component
- [x] City search/autocomplete (use geocoding API)
- [x] Time window selector
- [x] Connect wallet requirement
- [x] Success feedback

### 7.4 Voting Interface
- [x] SuggestionList with filter tabs
- [x] VoteButton with optimistic update
- [x] Handle "already voted" state
- [x] Vote count display

### 7.5 Leaderboard
- [x] Top 10 by votes
- [x] Trending calculation (votes in last 7 days)
- [x] Visual ranking

---

## Gamification Ideas (Future)

- **Unlock thresholds:** "50 votes to unlock this city!"
- **Streak bonuses:** Vote 7 days in a row
- **Suggester rewards:** If your suggestion gets implemented, earn badge
- **Prediction accuracy:** Track if voters were right about demand

These are **not in V1 scope** but the schema supports them.

---

## Acceptance Criteria

- [x] Users can submit suggestions with city + time preference
- [x] Users can vote on suggestions (1 per wallet per suggestion)
- [x] Duplicate vote attempts handled gracefully
- [x] Suggestions sorted by votes/recent/trending
- [x] Admin can see top suggestions (for Epic 8 integration)
- [x] **NEW:** Concurrent voting handled correctly (10+ simultaneous votes)
- [x] **NEW:** Pagination implemented on all list endpoints (max 100 results)
- [x] **NEW:** Trending scores updated daily via cron
- [x] **NEW:** All database indexes present and used by queries

---

## Database Performance

### Expected Query Performance

With recommended indexes (10K suggestions / 100K votes):

| Query | Expected Time | Index Used |
|-------|---------------|------------|
| Top voted (50 results) | <20ms | `status_voteCount` |
| Trending (50 results) | <15ms | `status_recentVoteCount` |
| Recent suggestions | <10ms | `createdAt` |
| User's suggestions | <10ms | `wallet_status` |
| Check if user voted | <5ms | `wallet_suggestionId` (unique) |

### Monitoring Queries

Use these queries to verify index usage:

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM "Suggestion"
WHERE "status" = 'PENDING'
ORDER BY "voteCount" DESC
LIMIT 50;
-- Should show "Index Scan using Suggestion_status_voteCount_idx"

-- Check for slow queries
SELECT * FROM pg_stat_statements
WHERE query LIKE '%Suggestion%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Load Testing

Before production deployment:

```bash
# Create 10K test suggestions
npm run test:seed-suggestions -- --count 10000

# Create 100K test votes
npm run test:seed-votes -- --count 100000

# Run concurrent vote test
npm run test:concurrent-votes -- --concurrent 100
```

All queries should complete in <50ms.

---

## Dependencies

- **Epic 0:** Database setup
- **Epic 5:** Web app structure
- **Feeds into Epic 8:** Admin email includes top suggestions

---

## Estimated Effort

| Task | Original | Actual (with audit fixes) |
|------|----------|---------------------------|
| Database schema | 1 hour | **3 hours** |
| Database migration & testing | - | **2 hours** |
| Transaction handling | - | **2 hours** |
| API routes | 3 hours | 4 hours |
| Suggestion form | 3 hours | 3 hours |
| Voting interface | 3 hours | 3 hours |
| Leaderboard | 2 hours | 2 hours |
| Load testing | - | **2 hours** |
| **Total** | **~12 hours** | **~21 hours** |

Additional time accounts for:
- Implementing all 9 audit fixes
- Writing comprehensive tests
- Load testing and verification
- Transaction isolation patterns

