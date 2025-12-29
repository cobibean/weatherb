# Epic 8 Refined Design: AI-Powered City Approval Workflow

**Date**: 2025-01-28
**Status**: Design Complete - Ready for Implementation

---

## Core Objective

**100% Requirement**: Approve/deny/ignore user-voted city suggestions with confidence through automated end-to-end testing.

**Extra Credit**: Weekly AI summaries, polished admin experience, audit trails.

---

## Design Principles

1. **Admin has two control points**: Immediate (admin panel) + Passive (weekly emails)
2. **Test before promote**: All approvals trigger 4-hour automated e2e test with real money
3. **Full transparency**: Detailed test results with math verification
4. **Safety first**: Strict fund recovery rules, test markets永hidden from public
5. **Future-proof**: Modular email structure, extensible admin panel

---

## Part 1: Admin Panel (Immediate Control)

### Location
`/admin/suggestions` - New page in existing admin panel

### Layout: Tabbed Interface

#### Tab 1: Pending
- **Purpose**: Review unreviewed city suggestions
- **Display**: Simple table with columns:
  - City (name + coords if custom)
  - Total Votes
  - Recent Votes (7d)
  - Time Preference (Morning/Afternoon/Evening/Night)
  - Actions: [Approve] [Deny]
- **Sorting**: By total votes DESC (trending indicator for high recent votes)
- **Actions**: One-click, no confirmation dialogs

#### Tab 2: Testing
- **Purpose**: Monitor cities in 4-hour test window
- **Display**: Shows active test runs with:
  - City name
  - Started timestamp
  - Markets status (e.g., "3/5 settled")
  - Estimated completion
  - Progress indicator
- **Constraint**: Cannot promote until all test markets settled/cancelled

#### Tab 3: Live
- **Purpose**: Cities successfully promoted to rotation
- **Display**: Simple list of cities in rotation
- **Future**: Add remove/pause actions

#### Tab 4: Rejected
- **Purpose**: Archive of denied suggestions
- **Display**: City + rejection date
- **Future**: Add "reconsider" action

---

## Part 2: 4-Hour Test Window (Automated Validation)

### Trigger
- Admin clicks "Approve" in panel, OR
- Admin clicks approve link in weekly email

### Flow

#### Step 1: Generate Test Wallets
- Create 2 fresh wallets dynamically (no stored keys)
- Wallet A: YES bettor
- Wallet B: NO bettor

#### Step 2: Fund Wallets
- Transfer FLR from admin wallet (via `ADMIN_PRIVATE_KEY`)
- Amount: Enough for 3-5 bets + gas (~20-30 FLR total)

#### Step 3: Create Test Markets
- Spawn 3-5 parallel markets with `isTest: true` flag
- Different resolve times: +30min, +1hr, +2hr, +4hr (from approval time)
- Use production `WeatherMarketV2` contract (real settlement, real weather data)
- All markets linked to same `TestRun` record via `testRunId`
- Markets永hidden from frontend (filtered by `isTest` flag)

#### Step 4: Place Opposing Bets
**Pattern**: Unequal amounts to verify payout math

Example bet distribution:
```
Market 1 (+30min): YES 0.9 FLR  | NO 1.8 FLR
Market 2 (+1hr):   YES 2.5 FLR  | NO 3.1 FLR
Market 3 (+2hr):   YES 4.2 FLR  | NO 5.99 FLR
Market 4 (+3hr):   YES 1.5 FLR  | NO 2.7 FLR
Market 5 (+4hr):   YES 3.8 FLR  | NO 4.5 FLR
```

**Script behavior**:
- Place bets immediately after market creation
- Alternate which wallet goes first (avoid pattern detection)
- Log all transaction hashes

#### Step 5: Monitor Settlement
- Listen for `MarketResolved` events
- Track which markets settled, outcomes, actual temps
- Calculate expected payouts using contract fee logic

#### Step 6: Verify Payouts
**For each settled market**:
- Query wallet balances before/after claiming
- Calculate expected payout: `(winningBet / winningPool) * losingPool * (1 - fee%)`
- Compare expected vs actual (tolerance: 0.001 FLR for rounding)
- Flag any discrepancies as FAILED

#### Step 7: Sweep Funds Back
- Once all markets settled:
  - Drain Wallet A → admin wallet
  - Drain Wallet B → admin wallet
  - Wait for confirmations (3 blocks)
  - Verify admin wallet balance increased

**Critical Rule**: Do NOT dispose private keys until 100% confirmed funds returned

#### Step 8: Send Results Email
- Trigger: All markets settled AND funds swept successfully
- Timing: Smart wait (could be <4hrs if everything settles early)
- Content: Detailed breakdown (see Part 3)

### Error Handling
- If settlement fails: Mark test FAILED, send alert email
- If sweep fails: Keep keys encrypted, alert admin for manual recovery
- If weather API fails: Retry 3x, then mark FAILED
- Log all errors to `TestRun.results` JSON field

---

## Part 3: Test Results Email (Detailed Verification)

### Timing
Sent as soon as all test markets settle + funds swept back (smart wait, not fixed 4hr)

### Subject Line
- ✅ Success: `[WeatherB] Test Results: Miami, FL - ✅ PASSED`
- ❌ Failure: `[WeatherB] Test Results: Miami, FL - ❌ FAILED`

### Email Structure

```
Test Results for: Miami, FL
Started: Jan 15, 2025 10:23 AM UTC
Completed: Jan 15, 2025 12:41 PM UTC (2h 18m)

━━━━━━━━━━━━━━━━━━━━━━━━━━
MARKET RESULTS (5 markets)
━━━━━━━━━━━━━━━━━━━━━━━━━━

Market #1: Jan 15 11:00 AM UTC
  Threshold: Temp >= 72°F
  Forecast: 72°F | Actual: 74°F | Outcome: YES wins
  Bets: 0.9 FLR (YES) vs 1.8 FLR (NO)
  Expected Payout: 2.673 FLR | Actual: 2.673 FLR ✅
  Status: PASSED
  Tx: 0xabc...def

Market #2: Jan 15 11:30 AM UTC
  Threshold: Temp >= 73°F
  Forecast: 73°F | Actual: 73°F | Outcome: YES wins (tie)
  Bets: 2.5 FLR (YES) vs 3.1 FLR (NO)
  Expected Payout: 5.544 FLR | Actual: 5.544 FLR ✅
  Status: PASSED
  Tx: 0x123...456

Market #3: Jan 15 12:00 PM UTC
  Threshold: Temp >= 75°F
  Forecast: 76°F | Actual: 74°F | Outcome: NO wins
  Bets: 4.2 FLR (YES) vs 5.99 FLR (NO)
  Expected Payout: 10.089 FLR | Actual: 10.089 FLR ✅
  Status: PASSED
  Tx: 0x789...abc

[... 2 more markets ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNDS RECOVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━
Initial funding: 25.00 FLR
Test bets placed: 24.51 FLR
Swept back: 24.87 FLR
Net cost: 0.13 FLR (gas + fees)
Recovery status: ✅ COMPLETE

━━━━━━━━━━━━━━━━━━━━━━━━━━
OVERALL: ✅ ALL TESTS PASSED (5/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━

This city is ready to go live.

[PROMOTE TO LIVE]  [RUN TESTS AGAIN]  [REJECT & DELETE]
```

### Magic Link Actions
- **Promote**: Update `Suggestion.status = 'LIVE'`, add city to rotation config
- **Run Tests Again**: Create new `TestRun`, repeat entire flow
- **Reject**: Update `Suggestion.status = 'REJECTED'`, delete test markets

---

## Part 4: Weekly Summary Email (Passive Awareness)

### Schedule
Every Monday 9:00 AM UTC (configurable in `vercel.json`)

### Subject
`📊 WeatherB Weekly Report - Jan 15-22, 2025`

### Email Structure (Modular & Extensible)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 MARKET METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━
Markets created:     35
Total bets placed:   142
Total volume:        2,450 FLR
Fees collected:      24.5 FLR
Unique wallets:      67
Avg bets/market:     4.1

Week-over-week:     +12% volume 📈

[FUTURE: Add conversion rates, retention, top cities, etc.]

━━━━━━━━━━━━━━━━━━━━━━━━━━
🗳️ TOP CITY SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Miami, FL
   Total: 47 votes | This week: +23 🔥 TRENDING
   Time preference: Morning

2. Seattle, WA
   Total: 31 votes | This week: +8
   Time preference: Afternoon

3. Austin, TX
   Total: 28 votes | This week: +5
   Time preference: Any

4. Denver, CO
   Total: 22 votes | This week: +3
   Time preference: Afternoon

5. Boston, MA
   Total: 19 votes | This week: +2
   Time preference: Morning

[... showing top 10 ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI INSIGHTS (Claude Sonnet)
━━━━━━━━━━━━━━━━━━━━━━━━━━
Miami Analysis:
Strong momentum with 49% of total votes coming this
week. Similar coastal cities (Tampa, Fort Lauderdale)
show above-average betting activity. Weather volatility
is high (good for prediction markets). Temperature
range typically 65-85°F with frequent afternoon
variations. RECOMMENDATION: Approve for testing.

Seattle Analysis:
Vote growth is steady but slow. Pacific Northwest
cities in rotation (Portland, Vancouver) have 20%
lower engagement than national average. Marine
climate means less temperature volatility.
RECOMMENDATION: Wait for stronger signal.

Austin Analysis:
Moderate voting interest. Texas cities perform well
(Dallas, Houston both in top 10 for volume). Hot
climate with reliable forecasts.
RECOMMENDATION: Monitor for one more week.

━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ QUICK ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━
[APPROVE MIAMI]     [DENY MIAMI]
[APPROVE SEATTLE]   [DENY SEATTLE]
[APPROVE AUSTIN]    [DENY AUSTIN]

[VIEW FULL ADMIN PANEL]
```

### AI Prompt Design
```typescript
const prompt = `You are analyzing user voting data for a weather
prediction market platform.

METRICS:
${JSON.stringify(weeklyMetrics)}

TOP SUGGESTIONS:
${JSON.stringify(topSuggestions.map(s => ({
  city: s.cityId ? s.city.name : s.customCityName,
  state: s.cityId ? s.city.state : null,
  totalVotes: s.voteCount,
  recentVotes: s.recentVoteCount,
  timePreference: s.timeWindow,
  trending: s.recentVoteCount > (s.voteCount * 0.3)
})))}

CURRENT ROTATION PERFORMANCE:
${JSON.stringify(cityPerformanceStats)}

Analyze the top 3 suggestions and provide:
1. Vote momentum analysis (is growth accelerating?)
2. Comparison to similar cities already in rotation
3. Weather characteristics (volatility, forecast reliability)
4. Recommendation: APPROVE / WAIT / MONITOR

Be concise (2-3 sentences per city). Be conservative
(prefer waiting over rushing). Focus on data-driven insights.`;
```

### Future Extensions (Placeholder Sections)
- Retention cohorts
- Top performing cities by volume
- User feedback highlights
- Upcoming features preview

---

## Part 5: Technical Architecture

### Database Schema Changes

```prisma
// Add to existing schema.prisma

model Market {
  // ... existing fields
  isTest      Boolean   @default(false)  // Hide from frontend
  testRunId   String?                     // Link to test run
  testRun     TestRun?  @relation(fields: [testRunId], references: [id])

  @@index([isTest])  // Fast filtering
}

model TestRun {
  id              String      @id @default(cuid())
  suggestionId    String
  suggestion      Suggestion  @relation(fields: [suggestionId], references: [id])
  status          TestStatus  @default(RUNNING)
  createdAt       DateTime    @default(now())
  completedAt     DateTime?

  // Market tracking
  marketsCreated  Int         @default(0)
  marketsSettled  Int         @default(0)
  markets         Market[]

  // Financial tracking
  fundingAmount   Decimal     @db.Decimal(10, 2)  // Initial FLR sent
  recoveredAmount Decimal?    @db.Decimal(10, 2)  // FLR swept back
  netCost         Decimal?    @db.Decimal(10, 2)  // Gas + fees

  // Wallet management (encrypted)
  walletKeys      String?     // JSON: [{ address, privateKey }]
  keysDisposed    Boolean     @default(false)

  // Results storage
  results         Json?       // Detailed test results

  @@index([suggestionId])
  @@index([status])
}

enum TestStatus {
  RUNNING
  COMPLETED
  FAILED
}

// Update existing Suggestion model
model Suggestion {
  // ... existing fields
  testRuns    TestRun[]
}
```

### New API Routes

```
POST /api/admin/suggestions/approve
  Body: { suggestionId: string }
  Auth: Admin wallet signature
  Action: Create TestRun, start test window

POST /api/admin/suggestions/deny
  Body: { suggestionId: string }
  Auth: Admin wallet signature
  Action: Update status to REJECTED

POST /api/admin/suggestions/promote
  Body: { suggestionId: string }
  Auth: Admin wallet signature
  Validation: All test markets settled, tests passed
  Action: Update status to LIVE, add to city rotation config

GET /api/admin/action?token={jwt}
  Query: token (magic link JWT)
  Actions: approve | deny | promote | retest
  Returns: HTML success/error page

GET /api/cron/weekly-report
  Auth: Vercel Cron Secret
  Action: Generate + send weekly email
  Schedule: Monday 9am UTC (vercel.json)
```

### New Service Modules

#### `lib/test-runner.ts`
Orchestrates entire test window flow.

```typescript
export async function startTestWindow(suggestionId: string): Promise<TestRun>
export async function monitorTestRun(testRunId: string): Promise<void>
export async function finalizeTestRun(testRunId: string): Promise<TestResults>
```

#### `lib/test-wallets.ts`
Wallet lifecycle management.

```typescript
export function generateTestWallets(count: number): Wallet[]
export async function fundWallets(wallets: Wallet[], amountPerWallet: Decimal): Promise<TxHash[]>
export async function sweepWallets(wallets: Wallet[], toAddress: string): Promise<SweepResult>
export function encryptWalletKeys(wallets: Wallet[]): string
export function decryptWalletKeys(encrypted: string): Wallet[]
```

#### `lib/test-markets.ts`
Market creation and bet placement.

```typescript
export async function createTestMarkets(params: TestMarketParams): Promise<Market[]>
export async function placeBets(markets: Market[], wallets: Wallet[]): Promise<BetResult[]>
export async function verifyPayouts(markets: Market[], wallets: Wallet[]): Promise<PayoutVerification[]>
```

#### `lib/weekly-metrics.ts`
Data gathering for weekly email.

```typescript
export async function getWeeklyMetrics(): Promise<WeeklyMetrics>
export async function getTopSuggestions(limit: number): Promise<SuggestionWithVotes[]>
export async function getCityPerformance(): Promise<CityStats[]>
```

#### `lib/magic-links.ts`
JWT-based action links.

```typescript
export async function createActionLink(action: Action, suggestionId: string): Promise<string>
export async function verifyActionLink(token: string): Promise<ActionPayload>
```

#### `lib/email-templates/`
Resend email rendering.

```typescript
// email-templates/test-results.tsx
export function TestResultsEmail(props: TestResultsProps): React.ReactElement

// email-templates/weekly-summary.tsx
export function WeeklySummaryEmail(props: WeeklySummaryProps): React.ReactElement
```

---

## Part 6: Safety & Business Rules

### Test Market Rules
1. **Visibility**: `isTest: true` markets NEVER appear in:
   - Active markets list
   - Past markets list
   - Market stats/analytics
   - Any public API responses
2. **Contract**: Use production `WeatherMarketV2` (real settlement, real gas, real weather)
3. **Bet Sizes**: 0.9 - 5.99 FLR per bet (small but meaningful)
4. **Quantity**: 3-5 parallel markets per test run
5. **Persistence**: Test markets永in database (audit trail), never promoted to public

### Promotion Rules
1. Cannot promote until `marketsSettled === marketsCreated`
2. Cannot promote if any test failed (payout mismatch, settlement error, API failure)
3. Promotion updates:
   - `Suggestion.status = 'LIVE'`
   - Add city to rotation config (e.g., Upstash Redis state or DB config table)
4. Test markets remain `isTest: true` forever (no promotion option)

### Fund Safety Rules
1. **Key Storage**:
   - Private keys encrypted in `TestRun.walletKeys` using `MAGIC_LINK_SECRET`
   - Only decrypt when needed for sweeping
2. **Disposal Rule**:
   - Keys only deleted (`keysDisposed = true`) after 100% confirmed funds returned
   - Confirmation = admin wallet balance increased by expected amount
   - Minimum 3 block confirmations on sweep transactions
3. **Failure Handling**:
   - If sweep fails: Alert admin via email + Slack (future)
   - Keep keys encrypted in DB for manual recovery
   - Log detailed error in `TestRun.results`
4. **Audit Trail**:
   - Track: `fundingAmount`, `recoveredAmount`, `netCost`
   - Store all transaction hashes in `results` JSON

### Email Magic Links
1. **Expiration**: 7 days
2. **Actions**: `approve`, `deny`, `promote`, `retest`
3. **Payload**: `{ action: string, suggestionId: string, exp: number }`
4. **Security**: HMAC-signed JWT using `MAGIC_LINK_SECRET`
5. **Audit**: All actions logged to admin audit trail (future Epic)

---

## Part 7: Implementation Phases

### Phase 1: Database & Admin Panel (Week 1)
- [ ] Add `isTest`, `testRunId` to Market model
- [ ] Create `TestRun` model and migration
- [ ] Build admin suggestions page with tabs
- [ ] Implement approve/deny actions (no testing yet)
- [ ] Filter `isTest` markets from all public queries

### Phase 2: Test Window Core (Week 2)
- [ ] Implement `test-wallets.ts` (generate, fund, sweep)
- [ ] Implement `test-markets.ts` (create, bet, verify)
- [ ] Implement `test-runner.ts` (orchestration)
- [ ] Add encryption for wallet keys
- [ ] Build monitoring/polling for settlement

### Phase 3: Email System (Week 3)
- [ ] Set up Resend account + verify domain
- [ ] Create email templates (test results + weekly summary)
- [ ] Implement `magic-links.ts`
- [ ] Build `/api/admin/action` route
- [ ] Test end-to-end email flow

### Phase 4: AI & Weekly Reports (Week 4)
- [ ] Install `@anthropic-ai/sdk`
- [ ] Implement `weekly-metrics.ts`
- [ ] Design Claude prompt for city analysis
- [ ] Build `/api/cron/weekly-report` route
- [ ] Add to `vercel.json` cron config

### Phase 5: Polish & Testing (Week 5)
- [ ] Add "retest" action
- [ ] Improve error handling (retry logic, alerts)
- [ ] Write integration tests
- [ ] Test on testnet with multiple cities
- [ ] Document deployment steps

---

## Environment Variables

Add to `.env`:

```bash
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
ADMIN_REPORT_EMAIL=cobibean777@gmail.com

# AI (Anthropic)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx  # Already exists

# Magic Links
MAGIC_LINK_SECRET=<random-64-char-string>

# Admin Wallet (for funding test wallets)
ADMIN_PRIVATE_KEY=0x...  # Already exists

# App URL (for magic links)
APP_URL=https://weatherb.app  # or http://localhost:3000 for dev
```

---

## Success Metrics

### Core Functionality (100% requirement)
- [ ] Admin can approve/deny suggestions from panel
- [ ] Approval triggers automated test window
- [ ] Tests create real markets with real bets
- [ ] Payout verification detects errors
- [ ] Funds sweep back successfully
- [ ] Test results email shows detailed breakdown
- [ ] Promote action adds city to rotation
- [ ] Test markets永hidden from public

### Extra Credit (polish)
- [ ] Weekly emails arrive on schedule
- [ ] AI insights are actionable
- [ ] Magic links work from email
- [ ] Admin panel tabs show clear workflow state
- [ ] Retest action works for edge cases

---

## Future Enhancements

### Short-term
- Admin audit log (track all approve/deny/promote actions)
- Slack notifications for test failures
- Better test market scheduling (avoid conflicts with production markets)

### Medium-term
- A/B testing for new cities (soft launch to 10% of users)
- Automated city performance analysis (remove underperforming cities)
- Public test results page (transparency/trust building)

### Long-term
- Community voting weight (verified users get 2x votes)
- Prediction accuracy leaderboard by city
- Automated removal of cities with low engagement

---

## Dependencies

- **Epic 7**: Voting schema (`Suggestion`, `Vote` models) ✅
- **Epic 4**: Vercel Cron pattern ✅
- **Epic 1**: Weather providers (MET Norway) ✅
- **Epic 3**: Trusted settler (for test settlement) ✅

---

## Estimated Effort

| Phase | Hours |
|-------|-------|
| Phase 1: DB + Admin Panel | 12h |
| Phase 2: Test Window Core | 16h |
| Phase 3: Email System | 10h |
| Phase 4: AI + Weekly Reports | 8h |
| Phase 5: Polish + Testing | 10h |
| **Total** | **~56 hours** (~1.5 weeks solo) |

---

## Open Questions (Resolved)

All design questions resolved during brainstorming session on 2025-01-28.

---

## Sign-off

**Design validated by**: User (cobibean)
**Date**: 2025-01-28
**Status**: ✅ Ready for implementation planning

Next step: Create detailed implementation plan using `superpowers:writing-plans` skill.
