# WeatherB: Complete User Positions & Claiming System

## Context

You are building the **user positions dashboard and winnings claiming system** for WeatherB, a prediction market on Flare where users bet YES/NO on temperature outcomes.

**Current State:**
- ✅ Betting functionality is fully implemented (users can place bets)
- ✅ Smart contract has complete `claim()`, `refund()`, `getPosition()`, and `calculatePayout()` functions
- ❌ No UI exists for users to view their positions, see winnings, or claim payouts
- ❌ `/positions` page is a stub with placeholder text only

**Your Mission:**
Build a complete positions dashboard where users can:
1. View all their active and past bets
2. See claimable winnings from resolved markets
3. Claim their winnings with one click
4. Refund cancelled market bets
5. Track performance statistics (win/loss ratio, total profit, ROI)

---

## Core Requirements (From PRD.md and CLAUDE.md)

### Business Rules You Must Follow

1. **1 bet per wallet per market** - Users can only bet once on each market
2. **Betting closes 10 minutes before resolve time** - After this, markets are "Closed for Betting"
3. **Settlement precision: 0.1°F, Display precision: 1°F** - Show whole degrees to users
4. **Threshold tie → YES wins** - If temp >= threshold, YES wins
5. **1% fee from losing pool** - Winning payouts already account for this
6. **Markets resolve automatically** - Settler cron runs every 5 minutes

### Available Smart Contract Functions

Your implementation MUST use these contract functions (ABI already complete):

```solidity
// Read user's position for a specific market
getPosition(marketId: uint256, bettor: address)
  → {yesAmount: uint256, noAmount: uint256, claimed: bool}

// Calculate how much user can claim
calculatePayout(marketId: uint256, bettor: address)
  → uint256 (payout amount in wei)

// Claim winnings from a resolved market
claim(marketId: uint256)
  → void (emits WinningsClaimed event)

// Refund bet from a cancelled market
refund(marketId: uint256)
  → void (emits Refunded event)

// Get market details
getMarket(marketId: uint256)
  → Market struct (includes status, outcome, pools, etc.)

// Get total number of markets
getMarketCount()
  → uint256
```

---

## Step-by-Step Implementation Plan

### Phase 1: Data Layer (Backend Logic)

**1.1 Create API Route for User Positions**
- File: `apps/web/src/app/api/positions/route.ts`
- Endpoint: `GET /api/positions?wallet=0x...`
- Logic:
  1. Accept wallet address as query param
  2. Get total market count from contract
  3. For each market ID (0 to count-1):
     - Call `getPosition(marketId, wallet)`
     - If user has a position (yesAmount > 0 OR noAmount > 0):
       - Call `getMarket(marketId)` to get market details
       - If market is Resolved and position.claimed = false:
         - Call `calculatePayout(marketId, wallet)` to get claimable amount
       - Build position object with all relevant data
  4. Return array of position objects sorted by status (claimable first)

**1.2 Create Helper Functions**
- File: `apps/web/src/lib/positions.ts`
- Functions:
  ```typescript
  // Fetch all positions for a wallet address
  async fetchUserPositions(walletAddress: string): Promise<UserPosition[]>

  // Calculate total claimable winnings across all markets
  async calculateTotalClaimable(walletAddress: string): Promise<bigint>

  // Calculate performance stats (win rate, total profit, ROI)
  async calculateUserStats(positions: UserPosition[]): Promise<UserStats>

  // Check if user has any claimable winnings
  async hasClaimableWinnings(walletAddress: string): Promise<boolean>
  ```

**1.3 Define TypeScript Types**
- File: `apps/web/src/types/positions.ts`
- Types needed:
  ```typescript
  type PositionStatus = 'active' | 'won' | 'lost' | 'claimable' | 'claimed' | 'refundable' | 'refunded';

  type UserPosition = {
    marketId: string;
    cityName: string;
    thresholdTenths: number; // 850 = 85°F
    resolveTime: number; // Unix timestamp
    betSide: 'YES' | 'NO';
    betAmount: bigint; // Amount user staked in wei
    status: PositionStatus;
    outcome?: boolean; // true = YES won, false = NO won (only if resolved)
    observedTempTenths?: number; // Actual temperature (only if resolved)
    claimableAmount?: bigint; // Payout in wei (only if claimable/claimed)
    multiplier?: number; // Odds at time of bet (for display)
    claimed: boolean;
  };

  type UserStats = {
    totalBets: number;
    activeBets: number;
    resolvedBets: number;
    wins: number;
    losses: number;
    winRate: number; // Percentage
    totalWagered: bigint; // Total amount bet across all markets
    totalWinnings: bigint; // Total amount won (claimed + claimable)
    totalClaimed: bigint; // Amount already claimed
    totalClaimable: bigint; // Amount ready to claim now
    netProfit: bigint; // totalWinnings - totalWagered
    roi: number; // (netProfit / totalWagered) * 100
  };
  ```

### Phase 2: UI Components (Frontend)

**2.1 Positions Page Layout**
- File: `apps/web/src/app/positions/page.tsx`
- Replace stub with full implementation:
  1. **Wallet Connection Check**
     - If not connected: Show "Connect Wallet" CTA
     - If connected: Fetch and display positions

  2. **Stats Dashboard** (Top Section)
     - Cards showing: Total Claimable, Active Bets, Win Rate, Total Profit
     - Use `calculateUserStats()` to populate
     - Prominent "Claim All Winnings" button if claimable > 0

  3. **Positions List** (Main Section)
     - Tabs: All | Active | Claimable | Claimed | Past
     - Each position card shows:
       - Market details (city, threshold, resolve time)
       - User's bet (side, amount)
       - Status badge (Active/Won/Lost/Claimable)
       - Outcome info (if resolved)
       - Claim button (if claimable)
       - Claimed checkmark (if already claimed)
     - Empty state for each tab if no positions

  4. **Loading & Error States**
     - Loading skeleton while fetching positions
     - Error message if fetch fails
     - Retry button on error

**2.2 Position Card Component**
- File: `apps/web/src/components/positions/position-card.tsx`
- Props: `{ position: UserPosition }`
- Display:
  - City name + temperature threshold
  - Your bet: "YES 0.5 FLR" or "NO 1.0 FLR"
  - Status badge with color coding:
    - Active: Blue (betting closed, awaiting resolution)
    - Won: Green (won but not claimed)
    - Claimable: Gold (won, ready to claim)
    - Claimed: Gray (already claimed)
    - Lost: Red (lost the bet)
  - If resolved: Show outcome temp vs threshold
  - If claimable: Show payout amount + "Claim" button
  - Countdown timer for active markets

**2.3 Claim Modal Component**
- File: `apps/web/src/components/positions/claim-modal.tsx`
- Props: `{ marketId: string, claimableAmount: bigint, onSuccess: () => void }`
- Flow:
  1. Show claim details:
     - Market info (city, threshold)
     - Your winnings: X.XX FLR
     - Network fee estimate
  2. "Confirm Claim" button
  3. On click:
     - Call contract's `claim(marketId)` function
     - Show transaction pending state
     - On success: Show success message + tx hash link
     - On error: Show error message with retry
  4. Auto-refresh positions after successful claim

**2.4 Bulk Claim Component**
- File: `apps/web/src/components/positions/bulk-claim-modal.tsx`
- Props: `{ claimablePositions: UserPosition[] }`
- Flow:
  1. Show list of all claimable markets
  2. Total claimable amount (sum across all)
  3. "Claim All" button
  4. Loop through each market:
     - Call `claim(marketId)` sequentially
     - Show progress: "Claiming 2 of 5..."
     - Handle individual failures gracefully
  5. Show final success summary

**2.5 Stats Cards Component**
- File: `apps/web/src/components/positions/stats-cards.tsx`
- Props: `{ stats: UserStats }`
- Display 4 cards:
  1. **Total Claimable**
     - Large number: X.XX FLR
     - Icon: Currency symbol
     - "Claim Now" button if > 0
  2. **Active Bets**
     - Count of pending positions
     - Icon: Clock
  3. **Win Rate**
     - Percentage: XX%
     - Subtitle: "X wins / Y total"
     - Icon: Trophy
  4. **Total Profit**
     - Net profit: +X.XX FLR or -X.XX FLR
     - ROI percentage
     - Icon: Chart
     - Color: Green for profit, Red for loss

**2.6 Empty States**
- File: `apps/web/src/components/positions/empty-state.tsx`
- Different messages for each tab:
  - All: "No bets yet. Browse markets to get started!"
  - Active: "No active bets. Your pending markets will appear here."
  - Claimable: "No winnings to claim. Keep betting to win!"
  - Past: "No betting history yet."

### Phase 3: Integration & Polish

**3.1 Home Page Integration**
- File: `apps/web/src/app/page.tsx`
- Add "My Active Bets" section (if user has wallet connected)
  - Show user's active positions inline
  - Badge on market cards showing "You bet YES 0.5 FLR"
  - Link to full positions page

**3.2 Header Notification**
- File: `apps/web/src/components/layout/header.tsx`
- Add notification badge on "Positions" nav link
  - Show count of claimable winnings
  - Red dot indicator if claimable > 0
  - Tooltip: "You have X.XX FLR to claim!"

**3.3 Past Markets Enhancement**
- File: `apps/web/src/components/markets/past-markets.tsx`
- For each past market:
  - Show if user participated (badge)
  - Show if user won/lost
  - Show claim button if claimable

**3.4 Transaction Handling**
- Reuse existing transaction flow from bet modal
- File: `apps/web/src/hooks/use-contract-write.ts` (create if needed)
- Handle:
  - Wallet connection check
  - Transaction signing
  - Pending state
  - Success confirmation
  - Error handling with user-friendly messages
  - Gas estimation

**3.5 Real-time Updates**
- Use React Query or SWR for data fetching
- Auto-refresh positions when:
  - User claims winnings
  - User refunds a cancelled market
  - Page regains focus
- Polling interval: 30 seconds for active positions

---

## Design System & Styling

**Follow Existing Patterns:**
- Use Tailwind CSS classes (already in project)
- Match existing market card styling
- Use shadcn/ui components (Button, Card, Badge, Modal)
- Color scheme:
  - Primary: Blue (existing brand color)
  - Success: Green (#10b981)
  - Warning: Yellow (#f59e0b)
  - Danger: Red (#ef4444)
  - Neutral: Gray (#6b7280)

**Responsive Design:**
- Mobile-first approach
- Stack cards vertically on mobile
- Grid layout on desktop (2-3 columns)
- Sticky stats header on scroll

**Accessibility:**
- Proper ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly
- Focus indicators
- Loading states announced

---

## Testing Requirements

**Unit Tests:**
- Test position data transformation logic
- Test payout calculations
- Test stats calculations (win rate, ROI, etc.)

**Integration Tests:**
- Test fetching positions from contract
- Test claim transaction flow
- Test refund transaction flow
- Test error handling

**Manual Testing Checklist:**
1. Connect wallet → see positions
2. Place bet → see it appear in "Active" tab
3. Wait for market to resolve → see it move to "Claimable"
4. Claim winnings → see success message + tx hash
5. Check positions page → see position marked as "Claimed"
6. Check stats → verify win rate and profit updated
7. Test with wallet that has no positions → see empty state
8. Test claiming multiple markets at once
9. Test refunding a cancelled market
10. Test all responsive breakpoints

---

## Edge Cases to Handle

1. **User has no positions** → Show empty state with CTA to browse markets
2. **All positions are claimed** → Show "All caught up!" message
3. **Wallet not connected** → Show connect wallet prompt
4. **Contract read fails** → Show error message with retry button
5. **Transaction rejected** → Clear error message, allow retry
6. **Transaction pending** → Show loading state, prevent double-submit
7. **Market cancelled** → Show "Refund Available" instead of claim
8. **User already claimed** → Gray out with "Claimed ✓" badge
9. **Network congestion** → Show gas estimate warning
10. **Lost bet** → Show empathetic message, encourage trying again

---

## Success Criteria

**You've succeeded when:**
1. ✅ Users can see all their betting positions in one place
2. ✅ Users can claim their winnings with 1 click
3. ✅ Users can see accurate performance stats (win rate, profit, ROI)
4. ✅ The UI handles all edge cases gracefully
5. ✅ The feature works on mobile and desktop
6. ✅ Transaction handling is robust and user-friendly
7. ✅ Code follows existing project patterns and conventions
8. ✅ All TypeScript types are properly defined
9. ✅ Loading and error states provide good UX
10. ✅ Users can easily navigate between positions and markets

---

## Resources & References

**Key Files to Study:**
- `apps/web/src/components/markets/bet-modal.tsx` - Reference for transaction handling
- `apps/web/src/app/api/markets/route.ts` - Reference for contract querying patterns
- `packages/shared/src/abi/weather-market.ts` - Complete contract ABI
- `apps/web/src/lib/contract.ts` - Contract client helpers
- `CLAUDE.md` - Project constraints and business rules
- `PRD.md` - Full product requirements

**Smart Contract Reference:**
- Location: `contracts/src/WeatherMarket.sol`
- Key functions: claim, refund, getPosition, calculatePayout
- Events: WinningsClaimed, Refunded

**Existing Components to Reuse:**
- Button (from shadcn/ui)
- Card (from shadcn/ui)
- Badge (from shadcn/ui)
- Modal/Dialog (from shadcn/ui)
- Loading spinner (from bet modal)
- Transaction success screen (from bet modal)

---

## Implementation Strategy

**Recommended Approach:**

1. **Start with the data layer** - Get position fetching working first
2. **Build one component at a time** - Position card → Stats → Full page
3. **Test incrementally** - Verify each piece works before moving on
4. **Handle happy path first** - Get basic claim flow working
5. **Add edge cases** - Then handle errors, empty states, etc.
6. **Polish UX** - Finally add loading states, animations, notifications

**Development Order:**
1. Create TypeScript types (`types/positions.ts`)
2. Build API route (`api/positions/route.ts`)
3. Create helper functions (`lib/positions.ts`)
4. Build Position Card component (static first, then interactive)
5. Build Stats Cards component
6. Build Claim Modal component
7. Assemble Positions page with tabs
8. Add empty states
9. Integrate with home page
10. Add header notification
11. Test thoroughly
12. Fix bugs and polish

---

## Code Quality Standards

**Follow Project Conventions:**
- TypeScript strict mode (explicit types, no `any`)
- Use `async/await` for promises
- Proper error handling with try/catch
- Zod for runtime validation if needed
- ESLint rules from project config
- Prettier formatting
- Descriptive variable names
- Comments for complex logic
- No console.logs in production code

**File Naming:**
- kebab-case for files: `position-card.tsx`
- PascalCase for components: `PositionCard`
- camelCase for functions: `fetchUserPositions`

---

## Final Notes

**What Makes This Feature Great:**
- Users feel in control of their winnings
- Clear visibility into betting performance
- One-click claiming (no complex steps)
- Beautiful, intuitive UI
- Responsive and accessible
- Handles errors gracefully
- Fast and performant

**Key User Journeys:**
1. **Curious user**: "Did I win?" → Check positions page → See claimable winnings → Claim with one click → Celebrate!
2. **Active bettor**: "How am I doing?" → View stats dashboard → See win rate and profit → Feel motivated to continue
3. **Passive user**: "What happened to my bets?" → Browse past positions → See outcomes → Learn from wins/losses

**Remember:**
- This is the second half of the user experience (betting is first half)
- Users MUST be able to claim their winnings or they will lose trust
- Performance matters - fetch data efficiently, don't query every market
- Mobile experience is critical - many users will claim on their phones
- Clear, friendly messaging - celebrate wins, encourage after losses

Good luck building! 🚀
