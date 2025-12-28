# Prompt: Implement Epic 7 — User Voting & Suggestions

## Context

**Project:** WeatherB - Temperature prediction market on Flare blockchain

**Epic Status:**
- ✅ Epics 0-6: Complete (contracts, automation, web app, admin panel)
- 🚧 Epic 7: User Voting/Suggestions (THIS EPIC)
- 🔜 Epic 8: AI-generated weekly admin reports (depends on Epic 7)

**Current State:**
- 5 markets/day created automatically via Vercel Cron
- Markets created from predefined city rotation
- No user input on which cities/times they want to bet on

**Problem:**
Users have no way to influence which markets are created. We need a growth loop where users can suggest markets and vote on suggestions, which feeds into admin decisions.

---

## Epic Goal

**Let users suggest and vote on new markets to guide platform growth.**

**Key Features:**
1. Users can submit market suggestions (city + optional time preference)
2. Users can vote on suggestions (1 vote per wallet per suggestion)
3. Leaderboard shows top suggestions by votes
4. Admin can review top suggestions (via Epic 8 email integration)

---

## Architecture Overview

**Storage:** PostgreSQL (already in use via Prisma)

**Voting Model:** Off-chain, 1 vote per wallet per suggestion

**Wallet Auth:** Use existing WalletConnect integration (Thirdweb)

**UI Location:** New `/suggestions` page in web app

**Admin Integration:** API endpoints for Epic 8 to fetch top suggestions for weekly emails

---

## Database Schema

From `docs/epics/epic-7-voting.md`:

```prisma
// prisma/schema.prisma

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

## API Routes to Build

### 1. GET `/api/suggestions`
**Purpose:** List suggestions with filtering/sorting

**Query params:**
- `sort`: `votes` (default), `recent`, `trending`
- `status`: `PENDING` (default), `APPROVED`, `REJECTED`, `IMPLEMENTED`, `all`
- `limit`: number (default 50, max 100)

**Response:**
```typescript
{
  suggestions: [
    {
      id: string,
      cityName: string,
      latitude?: number,
      longitude?: number,
      timeWindow?: string,
      comment?: string,
      wallet: string,
      status: SuggestionStatus,
      voteCount: number,
      createdAt: string,
      userHasVoted: boolean, // If wallet connected
    }
  ],
  total: number
}
```

### 2. POST `/api/suggestions`
**Purpose:** Create new suggestion

**Auth:** Requires connected wallet

**Body:**
```typescript
{
  cityName: string,      // Required
  latitude?: number,     // Optional (from geocoding)
  longitude?: number,    // Optional (from geocoding)
  timeWindow?: string,   // Optional: "morning", "afternoon", "evening"
  comment?: string       // Optional user note
}
```

**Validation:**
- `cityName` required, 2-100 chars
- `comment` max 500 chars
- `timeWindow` must be one of: "morning", "afternoon", "evening", or null
- Dedupe check: Same city + wallet within 24h should be rejected

**Response:**
```typescript
{
  success: true,
  suggestion: { ... }
}
```

### 3. POST `/api/suggestions/[id]/vote`
**Purpose:** Vote on a suggestion

**Auth:** Requires connected wallet

**Body:** Empty

**Logic:**
- Check if wallet already voted on this suggestion
- If not, create vote + increment voteCount atomically
- If yes, return 400 "Already voted"

**Response:**
```typescript
{
  success: true,
  voteCount: number
}
```

### 4. DELETE `/api/suggestions/[id]/vote`
**Purpose:** Remove vote (optional feature)

**Auth:** Requires connected wallet

**Response:**
```typescript
{
  success: true,
  voteCount: number
}
```

### 5. GET `/api/suggestions/[id]`
**Purpose:** Get single suggestion details

**Response:**
```typescript
{
  id: string,
  cityName: string,
  // ... all fields
  votes: [
    { wallet: string, createdAt: string }
  ]
}
```

---

## UI Components to Build

### Page: `/suggestions`

**Layout:**
- Hero section explaining suggestions/voting
- Tabs: "Top Voted" | "Trending" | "Recent"
- "Submit Suggestion" button (opens modal/form)
- List of suggestion cards

### Component: `SuggestionForm`
**Location:** `apps/web/src/components/voting/suggestion-form.tsx`

**Features:**
- City name input (text field)
- Optional: City autocomplete (use geocoding API like OpenCage, Mapbox, or Google Geocoding)
- Time window selector (dropdown: Morning/Afternoon/Evening/No Preference)
- Comment textarea (500 char limit)
- Submit button (requires wallet connection)

**UX:**
- If no wallet connected, show "Connect Wallet" CTA
- After submit, show success message with link to view suggestion
- Clear form after successful submit

### Component: `SuggestionCard`
**Location:** `apps/web/src/components/voting/suggestion-card.tsx`

**Display:**
- City name (large, bold)
- Time window badge (if specified)
- Vote count with upvote button
- Suggester wallet (truncated: 0x1234...5678)
- Created timestamp (relative: "2 days ago")
- Comment (truncated with "Read more" if long)
- Status badge (if not PENDING)

**Vote Button:**
- Shows current vote count
- If user hasn't voted: clickable upvote button
- If user voted: filled/highlighted state, shows "Voted"
- Optimistic update (increment count immediately, rollback on error)

### Component: `SuggestionList`
**Location:** `apps/web/src/components/voting/suggestion-list.tsx`

**Features:**
- Fetch suggestions from API
- Filter tabs (Top Voted, Trending, Recent)
- Loading state (skeleton cards)
- Empty state ("No suggestions yet, be the first!")
- Infinite scroll or pagination

### Component: `Leaderboard`
**Location:** `apps/web/src/components/voting/leaderboard.tsx`

**Display:**
- Top 10 suggestions by votes
- Ranking numbers (1, 2, 3...)
- Trophy icons for top 3
- Compact card layout

---

## Wallet Authentication

**Requirements:**
- Only connected wallets can submit suggestions
- Only connected wallets can vote
- Use existing Thirdweb integration from web app
- Store wallet address in lowercase for consistency

**Implementation:**
```typescript
// Example middleware/utility
import { getActiveWallet } from '@/lib/wallet'; // Use existing Thirdweb hook

export async function getWalletFromRequest(request: Request): Promise<string | null> {
  // Check if wallet is connected via Thirdweb session
  // Return wallet address or null
}

export function requireWallet(handler: Function) {
  return async (request: Request, ...args: any[]) => {
    const wallet = await getWalletFromRequest(request);
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 });
    }
    return handler(request, ...args, { wallet });
  };
}
```

**Note:** The exact wallet auth implementation depends on how Thirdweb is currently integrated. Check existing patterns in the codebase.

---

## Trending Calculation

**"Trending" means:** Suggestions with momentum (recent votes)

**Algorithm:**
```typescript
// Pseudo-code for trending score
score = voteCount / (age_in_days + 2)^1.5

// Or simpler: votes in last 7 days
trending = votes.filter(v => v.createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000).length
```

**Implementation:**
- Add `trendingScore` as computed field (calculate on query)
- Or add `recentVoteCount` to Suggestion model (update via trigger/cron)

For V1, keep it simple: **Sort by vote count among suggestions created in last 14 days**

---

## Admin Integration (for Epic 8)

**GET `/api/admin/suggestions/top`**

**Purpose:** Fetch top suggestions for weekly admin email

**Auth:** Admin wallet only (reuse existing admin auth from Epic 6)

**Response:**
```typescript
{
  topByVotes: Suggestion[], // Top 10 by vote count
  trending: Suggestion[],   // Top 10 by recent votes
}
```

This endpoint will be called by Epic 8's email generation job.

---

## Validation & Edge Cases

### Deduplication
- Prevent same wallet from suggesting same city within 24 hours
- Check: `where: { wallet, cityName, createdAt: { gte: 24h ago } }`
- Return friendly error: "You recently suggested {cityName}. Please wait before suggesting again."

### Spam Prevention
- Rate limit: Max 5 suggestions per wallet per day
- Rate limit: Max 50 votes per wallet per day
- Implement using Redis or in-memory cache (or Upstash KV)

### City Validation
- Accept any city name (free text)
- Optional: Validate against known city database or geocoding API
- Store lat/long if provided (helps admin review)

### Time Window Options
- "Morning" (6 AM - 12 PM local time)
- "Afternoon" (12 PM - 6 PM local time)
- "Evening" (6 PM - 12 AM local time)
- No preference (default)

---

## Testing Requirements

### Unit Tests
- Vote creation (happy path)
- Duplicate vote prevention
- Vote count increment
- Suggestion creation with validation

### Integration Tests
- Submit suggestion flow (end-to-end)
- Vote on suggestion flow
- Fetch suggestions with different sort orders
- Admin fetching top suggestions

### Edge Cases
- Vote on non-existent suggestion (404)
- Submit suggestion without wallet (401)
- Vote twice on same suggestion (400)
- Submit with invalid data (400)

---

## UI/UX Requirements

### Design System
- Use existing WeatherB aesthetic (Tailwind + shadcn/ui)
- Weather-themed icons (Thermometer, MapPin, Clock, TrendingUp from lucide-react)
- Color palette from `tailwind.config.ts`:
  - Primary: sky-light, sky-deep
  - Success: success-soft
  - Neutral: neutral-800, neutral-400

### Mobile Responsive
- Suggestion cards stack on mobile
- Form inputs full-width on mobile
- Tabs scroll horizontally if needed

### Accessibility
- Form labels and ARIA attributes
- Keyboard navigation for vote buttons
- Screen reader announcements for vote counts

### Loading States
- Skeleton cards while fetching suggestions
- Spinner on submit button
- Optimistic updates for votes (instant feedback)

### Empty States
- No suggestions yet: "Be the first to suggest a market!"
- No votes yet: "Be the first to vote on this suggestion!"

---

## Implementation Plan Structure

**Save plan to:** `docs/plans/2025-12-27-epic-7-voting.md`

**Required Tasks:**

### Task 1: Database Schema & Migrations
- Add Suggestion and Vote models to Prisma schema
- Create migration
- Add indexes
- Test migration on dev database

### Task 2: API Route - List Suggestions
- Implement GET /api/suggestions
- Support sorting (votes, recent, trending)
- Support filtering by status
- Return `userHasVoted` field if wallet connected
- Write tests

### Task 3: API Route - Create Suggestion
- Implement POST /api/suggestions
- Validate input (city name, comment length, etc.)
- Check for duplicates (same city + wallet within 24h)
- Require wallet authentication
- Write tests

### Task 4: API Route - Vote on Suggestion
- Implement POST /api/suggestions/[id]/vote
- Atomic transaction (create vote + increment count)
- Handle duplicate vote attempts
- Require wallet authentication
- Write tests

### Task 5: API Route - Get Single Suggestion
- Implement GET /api/suggestions/[id]
- Include vote details
- Write tests

### Task 6: Build SuggestionForm Component
- City name input
- Time window selector
- Comment textarea
- Submit handler
- Wallet connection requirement
- Success/error feedback
- Form validation

### Task 7: Build SuggestionCard Component
- Display suggestion details
- Vote button with count
- Optimistic vote updates
- Voted state indicator
- Responsive design

### Task 8: Build SuggestionList Component
- Fetch suggestions from API
- Filter tabs (Top Voted, Trending, Recent)
- Loading/empty states
- Pagination or infinite scroll
- Refresh on vote

### Task 9: Build Leaderboard Component
- Top 10 suggestions
- Ranking display
- Trophy icons for top 3

### Task 10: Create /suggestions Page
- Page layout
- Integrate all components
- SEO metadata
- Add to navigation

### Task 11: Admin Integration Endpoint
- GET /api/admin/suggestions/top
- Auth check (admin wallet only)
- Return top suggestions for Epic 8

### Task 12: Testing & Polish
- Write integration tests
- Test wallet auth flows
- Test rate limiting
- Cross-browser testing
- Mobile testing

---

## Key Files to Reference

**Database:**
- `apps/web/prisma/schema.prisma` - Add new models here

**API Routes:**
- `apps/web/src/app/api/suggestions/route.ts` - List + Create
- `apps/web/src/app/api/suggestions/[id]/route.ts` - Get single
- `apps/web/src/app/api/suggestions/[id]/vote/route.ts` - Vote

**Components:**
- `apps/web/src/components/voting/` - New directory for voting components

**Pages:**
- `apps/web/src/app/suggestions/page.tsx` - Main suggestions page

**Types:**
- `apps/web/src/types/suggestion.ts` - TypeScript types for suggestions/votes

**Utilities:**
- `apps/web/src/lib/prisma.ts` - Prisma client (already exists)
- Check for existing wallet auth utilities in `apps/web/src/lib/`

**Existing Patterns:**
- Check how positions page fetches data (see `/positions/page.tsx`)
- Check existing form patterns (see bet modal components)
- Check existing auth patterns (see admin panel for wallet auth)

---

## Constraints & Guidelines

**From CLAUDE.md:**
- TypeScript strict mode, explicit return types
- Use Prisma for database operations
- Follow existing API route patterns
- Use shadcn/ui components
- Mobile-first responsive design

**From AGENTS.md:**
- Store wallet addresses in lowercase
- Use existing Thirdweb integration for wallet auth
- Follow existing component naming conventions
- Add proper error handling and user feedback

**From Epic 7 Doc:**
- Off-chain voting (PostgreSQL storage)
- 1 vote per wallet per suggestion
- Simple dedupe: same city + wallet within 24h
- Estimated effort: ~12 hours

---

## Success Criteria

After implementation:
- ✅ Users can submit market suggestions with city + optional time preference
- ✅ Users can vote on suggestions (1 vote per wallet per suggestion)
- ✅ Duplicate vote attempts return clear error message
- ✅ Suggestions can be sorted by votes/recent/trending
- ✅ Leaderboard shows top 10 suggestions
- ✅ Admin endpoint returns top suggestions for Epic 8 integration
- ✅ All tests passing
- ✅ Mobile responsive
- ✅ Accessible (keyboard nav, screen readers)

---

## Future Enhancements (Not in V1)

From epic doc, these are documented but **not in scope for initial implementation:**
- Unlock thresholds ("50 votes to unlock this city!")
- Streak bonuses (vote 7 days in a row)
- Suggester rewards (badges for implemented suggestions)
- Prediction accuracy tracking
- Remove vote functionality (currently vote is permanent)

The schema supports these features but they are not required for V1.

---

## Agent Instructions

**Your task:** Write a comprehensive implementation plan following the writing-plans skill format.

**Steps:**

1. **Explore the codebase:**
   - Check existing Prisma schema patterns
   - Find existing wallet auth implementation (Thirdweb)
   - Review existing API route patterns
   - Check existing form components and modal patterns
   - Review existing page layouts

2. **Write the plan:**
   - Follow TDD approach (tests first)
   - Break into bite-sized tasks (2-5 min each)
   - Include complete code samples
   - Provide exact file paths
   - Show exact test commands with expected output
   - Include frequent commit points

3. **Save the plan:**
   - File: `docs/plans/2025-12-27-epic-7-voting.md`
   - Include header with "For Claude: Use superpowers:executing-plans"

4. **Offer execution options:**
   - Subagent-driven (this session) using superpowers:subagent-driven-development
   - Parallel session using superpowers:executing-plans

---

## Expected Deliverable

A detailed, executable implementation plan that a developer with zero context can follow to build Epic 7 voting system from scratch, with all tests, components, API routes, and integrations working end-to-end.

The plan should enable:
- Database setup via Prisma migrations
- API endpoints with full validation and auth
- React components following existing patterns
- Full integration with wallet auth
- Comprehensive testing
- Production-ready code

Ready to implement Epic 7 and enable user-driven market growth! 🚀
