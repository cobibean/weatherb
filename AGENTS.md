# AGENTS.md — weatherB Project Rules

> Current restart: Arc Testnet / native USDC, September 2026. Follow
> `docs/plans/2026-09-18-arc-usdc-readiness-plan.md` and
> `docs/testing/arc-testnet-lifecycle-acceptance.md` for active configuration and
> verification. The Flare, hosted cron, voting, audition, and Sheets details below
> describe the retired/deferred implementation. They do not authorize re-enabling it.
> Native USDC values use 18 decimals; the fresh restart is version 2.4.0 and
> market duration is declared per market (daily rotation declares 24 h;
> owner-set bounds 15 min – 7 days).
> Settlement runs from the dedicated Vercel worker `weatherb-arc-worker` triggered by
> QStash; the public site holds no signer (see `docs/testing/arc-hosted-testnet.md`,
> "Settlement worker"). Automatic market creation remains manual pending the
> scheduler-role contract change (separate plan; see `docs/backlog-and-ideas.md`).

## What Is This?
**weatherB**: Prediction market on Flare. Users bet YES/NO on temperature.
> "Will temp be ≥ X°F at time T in City?"

---

## Architecture
```
contracts/        # Foundry — WeatherMarketV2.sol (UUPS upgradeable)
apps/web/         # Next.js 16.1 — App + Admin + Cron routes
packages/shared/  # Types, ABIs, constants
docs/             # Epics, reference, testing
```

| Layer | Choice |
|-------|--------|
| Contracts | Foundry + Solidity 0.8.24 |
| Frontend | Next.js 16.1, React 19, Tailwind, shadcn/ui |
| Wallet | Thirdweb + WalletConnect |
| Database | PostgreSQL + Prisma |
| Deployment | Vercel (web + cron), Upstash Redis |
| Weather | Tomorrow.io (single provider) |

---

## Rolling Market System

Markets are created and settled on a rolling 24-hour schedule:

| Property | Value |
|----------|-------|
| Markets per day | 5 (max) |
| Market duration | Declared at creation (daily rotation: 24 h) |
| Creation schedule | Hourly, 12:00-16:00 UTC |
| Settlement schedule | Every 5 minutes (checks mature markets) |
| City rotation | Round-robin via Upstash Redis |

**How It Works:**
1. Cron runs hourly (5 times/day) → creates 1 market per run
2. Each market resolves exactly 24 hours after creation
3. Cities rotate: NYC → LA → Chicago → Miami → Austin → Seattle → Denver → Phoenix → (repeat)
4. After 24 hours, old market settles and new one replaces it (same slot)

**City Identification:**
- Cities have a `slug` field (e.g., `'nyc'`, `'austin'`) used for on-chain hashing
- `keccak256(toBytes(city.slug))` creates the `cityId` stored on-chain
- Both cron creation and frontend lookup use the same slug-based hash

---

## Key Constraints — NEVER Violate

| # | Rule |
|---|------|
| 1 | Daily rotation creates 5 markets/day via the worker schedule (12–16 UTC); the contract enforces one market per UTC hour slot |
| 2 | Duration is declared per market and bounded on chain (owner-set min/max); daily markets declare 24 h |
| 3 | Multiple bets allowed per wallet |
| 4 | Store temps as tenths: 85.3°F → 853 |
| 5 | Display as whole degrees |
| 6 | Threshold tie → YES wins (`>=`) |
| 7 | FLR only in V1 |
| 8 | Only settler can resolve markets |
| 9 | Fee from losing pool (1% default, 10% max) |
| 10 | Betting closes 10 min before resolve |
| 11 | Min bet: 0.01 FLR |
| 12 | City `slug` must match between DB and constants |

---

## Coding Conventions
- **TypeScript**: Strict mode, explicit returns, zod validation
- **Solidity**: NatSpec, custom errors, CEI pattern
- **Naming**: `kebab-case.ts`, `PascalCase.tsx`, `camelCase` vars
- **Testing**: Foundry (contracts), Vitest (frontend)

---

## Environment Variables
Uses `.env` (not `.env.local`). Key vars:
- `RPC_URL`, `DATABASE_URL`, `UPSTASH_REDIS_REST_*`
- `SETTLER_PRIVATE_KEY`, `SCHEDULER_PRIVATE_KEY`, `ADMIN_PRIVATE_KEY`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID`

See `.env.example` for full list.

---

## Essential Files
| File | Purpose |
|------|---------|
| `contracts/src/WeatherMarketV2.sol` | Active contract (UUPS) |
| `packages/shared/src/abi/` | Contract ABIs |
| `apps/web/src/app/api/cron/` | Scheduler + settler |
| `apps/web/prisma/schema.prisma` | Database models |
| `PRD.md` | Product requirements |
| `docs/epics/*.md` | Build plans |

---

## Epic Status
| Epic | Status |
|------|--------|
| 0-7 | ✅ Complete (contracts, UI, admin, voting) |
| 8 | 🔄 Test automation done, weekly reports pending |
| 9-10 | ⏳ Indexing, security |

---

## Audition City Testing System

When users vote for new cities, we run an "audition" test before adding them to the rotation:

| Component | File |
|-----------|------|
| Test market creation | `apps/web/src/lib/test-markets.ts` |
| Test wallet management | `apps/web/src/lib/test-wallets.ts` |
| Test runner orchestration | `apps/web/src/lib/test-runner.ts` |
| Settler cron (resolves all markets) | `apps/web/src/app/api/cron/settle-markets/route.ts` |

**Flow:**
1. Admin triggers test for a suggested city
2. System generates test wallets (encrypted, stored in `TestRun.walletKeys`)
3. Creates 5 test markets with staggered resolve times (30-240 min)
4. Places opposing YES/NO bets from test wallets
5. Settler cron resolves markets when mature
6. Wallets claim winnings and sweep funds back to admin

**Critical: Slug Consistency**
- Custom city slug is generated from name: `name.toLowerCase().replace(/\s+/g, '-')`
- Example: "New York City" → `new-york-city`
- This slug is used for BOTH:
  - On-chain `cityId`: `keccak256(toBytes(slug))`
  - DB city lookup: `city.findFirst({ where: { slug } })`
- Mismatch = settler can't find city = markets stuck

**Fallback:** Settler uses Market record coordinates if city lookup fails.

---

## Google Sheets Market Logging

All settled/cancelled markets are logged to Google Sheets for data analysis:

| Component | File |
|-----------|------|
| Sheets client | `apps/web/src/lib/google-sheets.ts` |
| Idempotency helper | `apps/web/src/lib/sheets-logging.ts` |
| Settlement utility | `packages/shared/src/utils/settlement.ts` |

**Critical Patterns:**

1. **Single source of truth**: `calculateSettlement()` determines outcome/status
   - Used by cron settler, single settler, AND database updates
   - Business rule: `tempTenths >= thresholdTenths` → YES wins (ties go to YES)

2. **Atomic idempotency**: `claimSheetsLoggingRights()` prevents duplicate rows
   - Uses `UPDATE Market SET sheetsLoggedAt = NOW() WHERE sheetsLoggedAt IS NULL`
   - Database is source of truth, Redis is optimization layer
   - All 3 settlement paths (cron, single, admin cancel) use same atomic claim

3. **Timezone awareness**: Observed time logged in market's local timezone
   - Uses `Intl.DateTimeFormat` with market's timezone field
   - Falls back to `America/Chicago` if timezone is null
   - Header: "Observed Time (Local)"

4. **Volume precision**: Always use `formatFlr()` from `@weatherb/shared/utils/payout`
   - Never convert to Number (loses precision for large values)
   - BigInt arithmetic preserves precision

**Never:**
- Duplicate settlement calculation logic (always import shared utility)
- Log to Sheets without atomic claim (causes duplicates)
- Use manual wei → FLR conversion (use formatFlr)

---

## Quick Reference
- **Deployment**: Vercel + Flare Coston2 (testnet) / Flare mainnet (prod)
- **Cron Schedule** (historical Flare setup): `schedule-daily` (hourly 12-16 UTC), `settle-markets` (every 5 min). Arc restart: QStash `weatherb-arc-settle-sweep` every 2 min against the worker plus one per-market delivery at `resolveTime`; creation is manual.
- **Settlement Flow**: Weather API → Settler Cron → `resolveMarket()` → on-chain
- **City Lookup**: `slug` field → `keccak256` hash → matches on-chain `cityId`
- **Test Wallet Encryption**: Uses `MAGIC_LINK_SECRET` env var for AES-256-GCM encryption
