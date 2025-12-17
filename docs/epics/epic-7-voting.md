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

```prisma
// prisma/schema.prisma

model Suggestion {
  id          String   @id @default(cuid())
  cityName    String
  latitude    Float?
  longitude   Float?
  timeWindow  String?           // e.g., "afternoon", "morning"
  comment     String?
  wallet      String            // Suggester
  status      SuggestionStatus  @default(PENDING)
  voteCount   Int               @default(0)
  createdAt   DateTime          @default(now())
  votes       Vote[]
}

enum SuggestionStatus {
  PENDING
  APPROVED
  REJECTED
  IMPLEMENTED
}

model Vote {
  id           String     @id @default(cuid())
  wallet       String
  suggestionId String
  suggestion   Suggestion @relation(fields: [suggestionId], references: [id])
  createdAt    DateTime   @default(now())
  
  @@unique([wallet, suggestionId]) // One vote per wallet per suggestion
}
```

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
- [ ] Add Suggestion and Vote models
- [ ] Create migrations
- [ ] Add indexes for common queries

### 7.2 API Routes
- [ ] GET /api/suggestions (list with sorting)
- [ ] POST /api/suggestions (create)
- [ ] POST /api/suggestions/[id]/vote
- [ ] GET /api/suggestions/[id] (single suggestion)

### 7.3 Suggestion Submission
- [ ] Create SuggestionForm component
- [ ] City search/autocomplete (use geocoding API)
- [ ] Time window selector
- [ ] Connect wallet requirement
- [ ] Success feedback

### 7.4 Voting Interface
- [ ] SuggestionList with filter tabs
- [ ] VoteButton with optimistic update
- [ ] Handle "already voted" state
- [ ] Vote count display

### 7.5 Leaderboard
- [ ] Top 10 by votes
- [ ] Trending calculation (votes in last 7 days)
- [ ] Visual ranking

---

## Gamification Ideas (Future)

- **Unlock thresholds:** "50 votes to unlock this city!"
- **Streak bonuses:** Vote 7 days in a row
- **Suggester rewards:** If your suggestion gets implemented, earn badge
- **Prediction accuracy:** Track if voters were right about demand

These are **not in V1 scope** but the schema supports them.

---

## Acceptance Criteria

- [ ] Users can submit suggestions with city + time preference
- [ ] Users can vote on suggestions (1 per wallet per suggestion)
- [ ] Duplicate vote attempts handled gracefully
- [ ] Suggestions sorted by votes/recent/trending
- [ ] Admin can see top suggestions (for Epic 8 integration)

---

## Dependencies

- **Epic 0:** Database setup
- **Epic 5:** Web app structure
- **Feeds into Epic 8:** Admin email includes top suggestions

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Database schema | 1 hour |
| API routes | 3 hours |
| Suggestion form | 3 hours |
| Voting interface | 3 hours |
| Leaderboard | 2 hours |
| **Total** | **~12 hours** |

