# Weather Betting Platform Build Plan

> **See `docs/epics/` for detailed plans per epic.**

---

## Epic 0 — Repo + Dev Foundations

- Create monorepo structure: `contracts/`, `apps/web/`, `services/scheduler/`, `services/settler/`, `packages/shared/`, `docs/`, `infra/`
- Toolchain: pnpm workspaces, Foundry for contracts, Next.js 14+ for web
- Add env + secrets strategy (`.env.local` for dev, encrypted secrets for prod)
- Database: PostgreSQL + Prisma for indexing/voting storage
- Add shared types: Market params, Resolution payload, Currency enum, Provider interface
- CI pipeline: lint, format, unit tests, contract compile/test, typecheck
- Docker Compose for local dev (Postgres, Redis)
- Add `.nvmrc` for Node version pinning

**Deliverable:** Repo scaffolding + CI green + local dev environment running.

---

## Epic 1 — Weather Provider Research + Adapter Layer

### Goal
Pick the initial provider but design so swapping later is painless.

- Implement provider interface:

```typescript
interface WeatherProvider {
  getForecast(cityId: string, timestamp: number): Promise<number>; // tempF_tenths
  getFirstReadingAtOrAfter(cityId: string, timestamp: number): Promise<{
    tempF_tenths: number;
    observedTimestamp: number;
  }>;
  healthCheck(): Promise<{ status: 'green' | 'red'; latencyMs: number }>;
}
```

- Build adapters for candidates:
  - **Open-Meteo** (free, good global coverage) — primary candidate
  - **Tomorrow.io** (paid, high reliability) — backup candidate
  - OpenWeatherMap (fallback option)

- Build comparison test script:
  - Check update frequency
  - Verify "first reading at/after" behavior works
  - Log cost/rate limits
  - Test timezone handling

- Add caching layer (Redis) to avoid rate limit issues
- Add fallback logic (primary → backup provider)

**Deliverable:** Provider abstraction + working Open-Meteo adapter + test report.

---

## Epic 2 — Smart Contracts (Core)

### Goal
Markets, bets, settlement, refunds, claims, fee accounting, currency variable.

- **Single contract architecture** (`WeatherMarket.sol`) — simpler for V1
- Market struct:

```solidity
struct Market {
    bytes32 cityId;
    uint64 resolveTime;
    uint256 thresholdF_tenths;    // 853 = 85.3°F
    address currency;              // address(0) = native FLR
    MarketStatus status;
    uint256 yesPool;
    uint256 noPool;
    // Resolution data
    uint256 resolvedTempF_tenths;
    uint64 observedTimestamp;
    bool outcome;                  // true = YES won
}
```

- Core functions:

```solidity
createMarket(cityId, resolveTime, thresholdF_tenths, currency)
placeBet(marketId, side) payable  // side: true=YES, false=NO
resolveMarket(marketId, proof, data)  // onlySettler
cancelMarket(marketId)
claim(marketId)
adminWithdrawFees()
```

- **Critical:** `onlySettler` role for automation-only settlement
- **Critical:** One bet per wallet per market (mapping enforcement)
- Currency design: `address(0)` = native FLR, else ERC20 address

- Unit tests (Foundry):
  - Pool math / payout calculations
  - One bet per wallet enforcement
  - Fee math (1% from losing pool)
  - Cancel/refund happy path
  - Full resolve → claim flow
  - Edge cases: exactly threshold temp, empty pools

**Deliverable:** Tested contracts deployed to Coston2 testnet.

---

## Epic 3 — FDC Proof Verification Integration

### Goal
Integrate Flare Data Connector for trustless settlement.

- Define attestation payload:

```solidity
struct WeatherAttestation {
    bytes32 cityId;
    uint64 observedTimestamp;
    uint256 tempF_tenths;
}
```

- Implement FDC verification in contract:
  - Verify proof against Flare's verification contract
  - Decode attestation data
  - Enforce `observedTimestamp >= market.resolveTime`
  - Compute outcome: `tempF_tenths >= thresholdF_tenths`

- Handle FDC-specific failures (separate from weather provider down)

**Deliverable:** Markets resolve on-chain via FDC proof.

---

## Epic 4 — Automation Services

### 4A) Market Scheduler Service

- Daily cron job: create exactly 5 markets/day
- For each market:
  - Select city from allowlist (single city in testing mode)
  - Calculate resolve time based on cadence config (default: 5 min intervals)
  - Fetch forecast temperature
  - Generate threshold (round to whole °F for display, store as tenths)
  - Call `createMarket()` on-chain
- Respect outage mode: skip creation if provider health is red
- Queue: BullMQ for job scheduling

### 4B) Settlement Bot Service

- Poll for markets past resolve time
- Fetch "first reading at/after T" from provider
- Create FDC attestation request
- Submit proof and call `resolveMarket()`
- Retry logic with exponential backoff
- On provider failure: trigger cancel/refund flow

### 4C) Outage Controller

- Health checks every 5 minutes
- If provider red:
  - Pause market creation
  - Cancel/refund eligible pending markets
  - Broadcast status to frontend
- Resume on green

**Deliverable:** Fully autonomous market lifecycle on testnet.

---

## Epic 5 — Web App (Bettor UX)

- Next.js 14+ with App Router
- Thirdweb SDK + WalletConnect
- TailwindCSS + shadcn/ui components

### Pages/Features:

- **Home / Market List**
  - City name, resolve time (local + UTC), threshold (whole °F)
  - YES/NO implied prices (live updating via polling)
  - Currency badge (FLR)
  - Bet buttons

- **Market Details (drawer/modal)**
  - Lat/long coordinates
  - Settlement rule text
  - Provider name
  - Post-resolve: final temp, timestamp, tx link

- **Bet Flow**
  - Side selection + amount input
  - Wallet connection prompt if needed
  - Transaction confirmation
  - Prevent second bet (UI check + handle contract revert gracefully)

- **My Positions**
  - Open bets with current implied value
  - Resolved outcomes
  - Claim button for winnings

- **Status Banner**
  - Provider health indicator
  - Outage notifications

**Deliverable:** Usable web app with full betting flow.

---

## Epic 6 — Admin Panel + Config

- Admin auth: wallet allowlist (simple for V1)

### Settings:
- Cadence (default: 5 minutes, adjustable)
- Testing mode toggle (single city lock)
- Daily market count (fixed at 5, config for future)
- City allowlist management
- Settler bot address management
- Emergency pause switches

### Dashboard:
- Provider health status + latency
- Markets created today
- Settlement queue/backlog
- Fees collected (lifetime + 24h)
- Failed transaction logs

**Deliverable:** Admin can configure system without code deploys.

---

## Epic 7 — Voting / Suggestions (Growth Loop)

### User Features:
- Suggest new city + preferred time window
- Vote on existing suggestions (1 vote per wallet per suggestion)
- Leaderboard of top suggestions

### Storage:
- V1: PostgreSQL (fast, cheap, sufficient)
- Schema: suggestions table, votes table

### Gamification (optional for V1):
- "Unlock the next slot" — when suggestion hits vote threshold

**Deliverable:** Community can signal demand for new markets.

---

## Epic 8 — Weekly AI Report + Email Approval Workflow

### Email Setup:
- Provider: Resend (simple, cheap, good DX)

### Weekly Job:
- Aggregate suggestions + votes + momentum
- Pull market stats (volume, fees, participation)
- Generate AI summary with GPT-4
- Send to admin email

### Email Actions:
- One-click YES/NO on suggestions
- Confirm city selection

### Post-Approval Flow:
- 4-hour automated integration test window
- Test: provider fetch + proof generation + simulated resolution
- Send follow-up email with results
- On final YES: add city to scheduler config

**Deliverable:** Admin scales business from inbox.

---

## Epic 9 — Indexing + Observability

### Indexer:
- Listen to contract events:
  - `MarketCreated`
  - `BetPlaced`
  - `MarketResolved`
  - `MarketCancelled`
  - `WinningsClaimed`
- Populate PostgreSQL for fast web queries
- Consider: Envio or Ponder for Flare-compatible indexing

### Monitoring:
- Bot health checks (scheduler, settler)
- Failed transaction alerts
- Provider downtime alerts
- Grafana dashboard (optional)

### Analytics:
- Daily volume
- Fees collected
- Active wallets
- Conversion funnel (connect → bet → claim)

**Deliverable:** Visibility into system health + business metrics.

---

## Epic 10 — Security + Hardening

### Contract Security:
- Reentrancy guards (OpenZeppelin ReentrancyGuard)
- Safe math (Solidity 0.8+ built-in)
- Access control (onlyAdmin, onlySettler)
- No tx replay vulnerabilities

### Rate Limits:
- Bet amount sanity checks (min/max)
- Spam prevention on suggestions/votes

### Emergency Controls:
- Pause betting (per market or global)
- Pause settlement
- Emergency cancel with refunds
- Admin key rotation capability

### Threat Model Review:
- Settler bot key compromise → mitigation: timelock on large settlements?
- Weather provider manipulation → mitigation: multiple source verification (V2)
- Front-running bets → mitigation: low-value markets reduce incentive
- Timestamp manipulation → mitigation: FDC timestamps are external

**Deliverable:** Hardened system, not an easy rug.

---

## Build Order (Fastest Path to Demo)

```
Epic 0 (repo foundations)
    ↓
Epic 2 (contracts) ←→ Epic 3 (FDC) — parallel, tightly coupled
    ↓
Epic 1 (provider adapter)
    ↓
Epic 4A (scheduler) + Epic 9 (indexing) — parallel
    ↓
Epic 5 (web app)
    ↓
Epic 4B/C (settler + outage)
    ↓
─── MVP COMPLETE ───
    ↓
Epic 6 (admin panel)
    ↓
Epic 7 (voting)
    ↓
Epic 8 (AI reports)
    ↓
Epic 10 (security hardening)
```

**Target:** Functional demo on testnet after Epic 5.
