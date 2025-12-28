# Prompt: Create Market Summary Modal Implementation Plan

## Context

**Project:** WeatherB - Temperature prediction market on Flare blockchain

**Current State:**
- Users can view markets in multiple places (home page past markets dropdown, positions page, admin panel)
- Market results are displayed but lack detailed summaries
- Users don't get clear visibility into market outcomes, pool distributions, winner statistics, etc.

**Problem:**
Users are "left in the dark" on market result details. We need a comprehensive market summary that shows all relevant information about a market's outcome in a clear, digestible format.

---

## Requirements

### Market Summary Modal System

**Goal:** Create a reusable market summary modal component that displays comprehensive market information for both settled and live markets.

**Usage Locations:**
1. **Past Markets Dropdown** (home page) - Click on any past market
2. **My Positions Page** (`/positions`) - Click on any market from user's positions
3. **Admin Panel** (`/admin/markets`) - Click on any market for admin review

**Two Modal Variants:**

#### 1. Settled Markets (Resolved/Cancelled/NoWinners)
Should display:
- Market question (e.g., "Will Seattle hit ≥65°F on Jan 15?")
- Final outcome (YES Won / NO Won / Cancelled / No Winners)
- Temperature data:
  - Threshold temperature
  - Actual observed temperature (if resolved/noWinners)
  - Observation timestamp
- Pool statistics:
  - Final YES pool size
  - Final NO pool size
  - Total pool size
  - Winning pool percentage
- Result details:
  - Winner side (if resolved)
  - Total claimable amount (winning pool + fees if applicable)
  - Number of bettors on each side (if we have this data)
  - Fee collected (if available)
- User-specific data (if viewing from positions page):
  - User's bet side
  - User's bet amount
  - User's claimable amount (if won)
  - Claim status (claimed/claimable/lost/refundable)

#### 2. Live/Unsettled Markets (Open/Closed)
Should display:
- Market question
- Current status (Open for betting / Betting closed, awaiting settlement)
- Countdown/timestamp:
  - Time until betting closes (if Open)
  - Time until resolution (if Closed)
  - Exact resolve time
- Current pool statistics:
  - Current YES pool
  - Current NO pool
  - Total pool
  - Current odds/implied probability for each side
- Threshold temperature
- User-specific data (if viewing from positions page):
  - User's bet side
  - User's bet amount
  - Current estimated payout (if market resolved now)
  - Current multiplier

---

## Technical Considerations

### Data Requirements

**Market Data (from contract):**
- Market ID
- City name, latitude, longitude
- Threshold temperature (tenths)
- Resolve time
- Betting deadline
- Status (0-4: Open, Closed, Resolved, Cancelled, NoWinners)
- YES/NO pool sizes
- Resolved temperature (if settled)
- Observed timestamp (if settled)
- Outcome boolean (if resolved)
- Transaction hash (if available)

**User Data (if applicable):**
- User's position (from `getPosition(marketId, userAddress)`)
- Claimable amount (from `calculatePayout`)
- Claimed status

### UI/UX Requirements

**Modal Component:**
- Use shadcn/ui Dialog component (if available) or create custom modal
- Mobile-responsive design
- Accessible (keyboard navigation, screen reader friendly)
- Animations (framer-motion following existing patterns)
- Color coding:
  - YES → success-soft green
  - NO → error-soft red
  - Cancelled → neutral gray
  - NoWinners → sunset-orange/coral

**Visual Design:**
- Match existing WeatherB aesthetic (see `tailwind.config.ts` for colors)
- Use existing component patterns from `/components`
- Clear information hierarchy
- Weather-themed iconography (Thermometer, Clock, TrendingUp, etc. from lucide-react)

---

## Implementation Plan Requirements

**Create a comprehensive plan in:** `docs/plans/YYYY-MM-DD-market-summary-modal.md`

**Plan should include:**

### Task 1: Define TypeScript Types
- Create `MarketSummaryData` type
- Create separate types for settled vs live market summaries
- Consider what data transformations are needed

### Task 2: Create API Endpoints (if needed)
- Determine if existing `/api/markets` and `/api/positions` provide sufficient data
- Create new endpoints if additional aggregated data is needed
- Consider caching strategy for market summaries

### Task 3: Build Modal Component
- Create `MarketSummaryModal.tsx`
- Design component API (props interface)
- Implement settled market variant
- Implement live market variant
- Add loading/error states

### Task 4: Create Market Summary Views
- Build `SettledMarketSummary.tsx` sub-component
- Build `LiveMarketSummary.tsx` sub-component
- Add proper data formatting utilities (temperature display, time formatting, etc.)

### Task 5: Integrate into Home Page
- Add "View Details" button/click handler to past markets dropdown
- Pass market data to modal
- Handle modal open/close state

### Task 6: Integrate into Positions Page
- Add "View Details" to each position card/row
- Fetch user-specific data
- Display user's outcome in modal

### Task 7: Integrate into Admin Panel
- Add "View Details" to admin market list
- Include admin-specific data if needed

### Task 8: Testing
- Unit tests for data transformations
- Component tests for modal variants
- Integration tests for user flows

### Task 9: Documentation
- Document modal component API
- Add usage examples
- Update user-facing documentation if needed

---

## Constraints & Guidelines

**From CLAUDE.md:**
- TypeScript strict mode, explicit return types
- Use existing shadcn/ui components where possible
- Follow existing naming conventions (kebab-case files, camelCase vars)
- Use Tailwind + existing design tokens
- Mobile-first responsive design

**From AGENTS.md:**
- Temperature display: whole degrees (85°F) in UI, stored as tenths
- Market status handling: Open(0), Closed(1), Resolved(2), Cancelled(3), NoWinners(4)
- Use existing contract data utilities from `apps/web/src/lib/contract-data.ts`
- Follow existing modal/dialog patterns in codebase

---

## Key Files to Reference

**Types:**
- `packages/shared/src/types/market.ts` - Market type definition
- `apps/web/src/types/positions.ts` - Position types

**Components:**
- `apps/web/src/components/home/home-client.tsx` - Past markets dropdown
- `apps/web/src/app/positions/page.tsx` - Positions page
- `apps/web/src/app/admin/(dashboard)/markets/markets-client.tsx` - Admin markets

**Data Fetching:**
- `apps/web/src/lib/contract-data.ts` - Market data utilities
- `apps/web/src/lib/positions.ts` - Position data utilities
- `apps/web/src/app/api/markets/route.ts` - Markets API endpoint
- `apps/web/src/app/api/positions/route.ts` - Positions API endpoint

**UI Components:**
- Check `apps/web/src/components/ui/` for existing shadcn components
- Check existing modal usage patterns in codebase

**Design System:**
- `apps/web/tailwind.config.ts` - Color palette, theme tokens
- Existing component patterns for consistency

---

## Expected Deliverable

A detailed implementation plan saved to `docs/plans/YYYY-MM-DD-market-summary-modal.md` that:

1. **Follows TDD principles** - Write tests first, then implementation
2. **Bite-sized tasks** - Each task is 2-5 minutes of work with clear commit points
3. **Exact file paths** - No ambiguity about where code goes
4. **Complete code samples** - Show exactly what to write, not just descriptions
5. **Test commands** - Exact commands to run with expected output
6. **Frequent commits** - Clear commit messages following conventional commits

The plan should enable a developer with zero context on this codebase to implement the feature successfully.

---

## Agent Instructions

1. **First:** Explore the codebase to understand:
   - Current market display patterns
   - Existing modal/dialog implementations
   - Available market data structures
   - Current API endpoints

2. **Then:** Write a comprehensive plan following the writing-plans skill format

3. **Include:**
   - Exact TypeScript type definitions
   - Complete React component code
   - API endpoint implementations (if needed)
   - Integration points with exact line numbers
   - Test cases with assertions
   - Build/test verification steps

4. **Save to:** `docs/plans/2025-12-27-market-summary-modal.md`

5. **Offer execution options** after plan is complete

---

## Success Criteria

After implementation, users should be able to:
- ✅ Click any market from past markets dropdown and see detailed summary
- ✅ Click any position and see market summary with user-specific data
- ✅ View market summaries from admin panel
- ✅ See different views for settled vs live markets
- ✅ Clearly understand market outcomes, pool distributions, and results
- ✅ Access summaries on mobile devices with good UX

The modal should become the primary way users understand market results in detail.
