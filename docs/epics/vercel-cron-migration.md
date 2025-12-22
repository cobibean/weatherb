# Vercel Cron Migration Plan

**Goal:** Migrate scheduler and settler services from standalone Node.js processes to Vercel Cron-triggered API routes, using Upstash Redis for state management.

**Status:** Planning

---

## Task Ownership Summary

| Task | Owner | Est. Time |
|------|-------|-----------|
| Prerequisite 1: Upstash Account Setup | 👤 HUMAN | 10 min |
| Prerequisite 2: Add Env Variables | 👤 HUMAN | 5 min |
| Task 1: Install Dependencies | 🤖 AGENT | 5 min |
| Task 2: Create Cron Utilities | 🤖 AGENT | 15 min |
| Task 3: Create Scheduler Route | 🤖 AGENT | 45 min |
| Task 4: Create Settler Route | 🤖 AGENT | 45 min |
| Task 5: Vercel Cron Config | 🤖 AGENT | 10 min |
| Task 6: Add Cron Security | 🤖 AGENT | 10 min |
| Task 7: Verify Imports | 🤖 AGENT | 5 min |
| Task 8: Test Locally | 🤖 AGENT + 👤 HUMAN | 30 min |
| Task 9: Deploy & Verify | 👤 HUMAN | 15 min |

**Breakdown:**
- 🤖 **Agent work:** ~75% (Tasks 1-7, partial 8)
- 👤 **Human work:** ~25% (Prerequisites, Task 9, verification)

---

## ⚠️ Critical Considerations

### Timeout Limits
- **Vercel Hobby:** 10 second function timeout
- **Vercel Pro:** 60 second function timeout
- Creating 5 markets with weather API + blockchain tx may exceed 10s
- **Recommendation:** Use Vercel Pro OR reduce `DAILY_MARKET_COUNT` to 2-3 for Hobby

### Redis Dependencies
The existing code has TWO places using Redis:
1. **Weather Provider Cache** (`packages/shared/src/providers/factory.ts` line 35) - Uses `ioredis`
2. **Market Selector State** (`services/scheduler/src/market-selector.ts` line 37) - Tracks city rotation index

Both need to be adapted for Upstash's REST-based client OR we simplify:
- Skip weather caching for MVP (provider calls are fast enough)
- Store city index in Upstash using `@upstash/redis` REST client

---

## Current Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel        │     │   Standalone    │     │   Standalone    │
│   (Next.js)     │     │   (Scheduler)   │     │   (Settler)     │
│   apps/web/     │     │   services/     │     │   services/     │
│                 │     │   scheduler/    │     │   settler/      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Current services location:**
- Scheduler: `services/scheduler/src/`
- Settler: `services/settler/src/`

**Key files to understand current logic:**

Scheduler:
- `services/scheduler/src/index.ts` - Entry point, cron setup, queue creation
- `services/scheduler/src/market-selector.ts` - City selection logic, **uses Redis for state**
- `services/scheduler/src/create-market.ts` - On-chain market creation
- `services/scheduler/src/config.ts` - Environment config schema

Settler:
- `services/settler/src/index.ts` - Entry point, polling loop, queue setup
- `services/settler/src/fetch-markets.ts` - Reads pending markets from chain
- `services/settler/src/resolve.ts` - Settles markets on-chain
- `services/settler/src/contract.ts` - **viem client factory (reusable)**
- `services/settler/src/config.ts` - Environment config schema

Shared (already works in Next.js):
- `packages/shared/src/providers/factory.ts` - Weather provider factory, **uses Redis for caching**
- `packages/shared/src/providers/env.ts` - Env var schema for providers
- `packages/shared/src/abi/weather-market.ts` - Contract ABI
- `packages/shared/src/constants/cities.ts` - City definitions

---

## Target Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Vercel                                │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │   Next.js    │  │ /api/cron/     │  │ /api/cron/       │  │
│  │   Frontend   │  │ schedule-daily │  │ settle-markets   │  │
│  └──────────────┘  └───────┬────────┘  └────────┬─────────┘  │
│                            │                     │            │
│         vercel.json crons ─┴─────────────────────┘            │
└────────────────────────────┬──────────────────────────────────┘
                             │
                     ┌───────▼───────┐
                     │    Upstash    │
                     │    Redis      │
                     └───────────────┘
```

---

## Prerequisites

### 1. Upstash Account Setup 👤 HUMAN

1. Go to [upstash.com](https://upstash.com) and create free account
2. Create a new Redis database (select region closest to Vercel deployment)
3. Copy connection credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2. Environment Variables to Add 👤 HUMAN

Add to Vercel dashboard AND local `.env`:

```bash
# Upstash Redis (replaces local Redis)
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx

# Scheduler private key (for creating markets)
SCHEDULER_PRIVATE_KEY=0x...

# Settler private key (for resolving markets)  
SETTLER_PRIVATE_KEY=0x...

# Weather provider config
WEATHER_PROVIDER=met-no
MET_NO_USER_AGENT=WeatherB/1.0 (your@email.com)
```

---

## Implementation Tasks

### Task 1: Install Upstash Dependencies 🤖 AGENT

**File:** `apps/web/package.json`

Add dependencies:
```bash
cd apps/web && pnpm add @upstash/redis @upstash/qstash
```

---

### Task 2: Create Shared Cron Utilities 🤖 AGENT

**Create:** `apps/web/src/lib/cron/index.ts`

This module should:
1. Export a configured Upstash Redis client using `@upstash/redis`
2. Export helper to verify cron request authenticity
3. Export a weather provider wrapper

**⚠️ Weather Provider Caching Issue:**

The existing `createWeatherProviderFromEnv()` uses `ioredis` for caching (see `packages/shared/src/providers/factory.ts` line 35). This won't work with Upstash REST API.

**Options (pick one):**
1. **Skip caching (simplest for MVP):** Set `REDIS_URL` to empty/undefined - the `CachedProvider` will pass through without caching
2. **Use Upstash Redis protocol URL:** Upstash provides both REST and Redis-protocol URLs. The Redis URL works with `ioredis` but may have connection overhead in serverless
3. **Modify shared package:** Update `CachedProvider` to accept Upstash REST client (more work, better long-term)

**Recommendation for MVP:** Option 1 - skip caching. Weather API calls are fast (~200ms) and we only make a few per cron run.

**Reference files:**
- `packages/shared/src/providers/factory.ts` - `createWeatherProviderFromEnv()`
- `packages/shared/src/providers/cached-provider.ts` - Caching wrapper
- `packages/shared/src/providers/env.ts` - Env schema (shows `REDIS_URL` is optional)

---

### Task 3: Create Scheduler API Route 🤖 AGENT

**Create:** `apps/web/src/app/api/cron/schedule-daily/route.ts`

**Logic to port from:**
- `services/scheduler/src/index.ts` lines 92-138 (the cron callback)
- `services/scheduler/src/market-selector.ts` (city selection)
- `services/scheduler/src/create-market.ts` (on-chain creation)

**⚠️ City Index State Issue:**

The original `selectMarketsForDay()` in `market-selector.ts` uses Redis to track which city index to start from (line 37-38, 51). This ensures cities rotate each day.

**Solution:** Rewrite city selection to use Upstash REST client:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Get and increment city index
const key = 'weatherb:scheduler:cityIndex';
const startIndex = (await redis.get<number>(key)) ?? 0;
// ... select cities ...
await redis.set(key, startIndex + dailyMarketCount);
```

**Behavior:**
1. Verify request is from Vercel Cron (check `CRON_SECRET` header)
2. Health check weather provider (skip if unhealthy)
3. Get city rotation index from Upstash
4. Select N cities starting from index
5. For each city:
   - Fetch forecast temperature
   - Create market on-chain
   - Log result
6. Update city index in Upstash
7. Return JSON response with created market count

**Simplification option:** For MVP, skip QStash queuing and create markets directly in sequence. This works if `DAILY_MARKET_COUNT ≤ 5` since Vercel Pro has 60s timeout. Hobby plan users should use ≤2 markets.

---

### Task 4: Create Settler API Route 🤖 AGENT

**Create:** `apps/web/src/app/api/cron/settle-markets/route.ts`

**Logic to port from:**
- `services/settler/src/index.ts` lines 120-152 (the polling loop)
- `services/settler/src/fetch-markets.ts` (get pending markets)
- `services/settler/src/resolve.ts` (settle on-chain)

**Behavior:**
1. Verify request is from Vercel Cron
2. Fetch all pending markets from contract
3. Filter to those past resolve time
4. For each ready market:
   - Fetch current temperature from weather provider
   - Call `resolveMarket()` on contract
5. Return JSON response with settled count

**Error handling:** If one market fails, log and continue to next. Don't fail entire request.

**Simplified from original:** The original settler has these features we're simplifying for MVP:
- `OutageController` - Tracks provider health over time, enters "outage mode" → **Simplified:** Just check health at start of each run
- Retry tracking with BullMQ - Cancels market after N failures → **Simplified:** Log failures, manual intervention if needed
- `cancelEligibleMarkets()` - Auto-cancels on outage → **Deferred:** Can add later if needed

---

### Task 5: Create Vercel Cron Configuration 🤖 AGENT

**Modify:** `vercel.json` (already exists at repo root)

Add crons section:
```json
{
  "crons": [
    {
      "path": "/api/cron/schedule-daily",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/settle-markets",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Schedule notes:**
- `0 6 * * *` = Daily at 6:00 AM UTC
- `*/5 * * * *` = Every 5 minutes

**Reference:** Current scheduler cron expression is in `services/scheduler/src/config.ts` as `SCHEDULE_TIME_CRON`

---

### Task 6: Add Cron Security 🤖 AGENT

Vercel automatically sets `CRON_SECRET` and sends it in the `Authorization` header as `Bearer <CRON_SECRET>`.

**Create:** `apps/web/src/lib/cron/auth.ts`

```typescript
import { NextResponse } from 'next/server';

export function verifyCronRequest(request: Request): boolean {
  // In development, allow manual testing
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // CRON_SECRET is auto-set by Vercel for cron jobs
  if (!cronSecret) {
    console.warn('CRON_SECRET not set - rejecting cron request');
    return false;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Note:** `CRON_SECRET` is automatically set by Vercel for projects with cron jobs. You don't need to manually create it.

---

### Task 7: Verify Shared Code Imports 🤖 AGENT

The scheduler/settler services import from `@weatherb/shared`. These imports should continue to work since they're already in the monorepo.

**Verify these exports exist and work in Next.js context:**
- `@weatherb/shared/providers` - Weather provider factory
- `@weatherb/shared/abi` - Contract ABI
- `@weatherb/shared/constants` - CITIES array

**Reference:** `packages/shared/src/index.ts` for all exports

---

### Task 8: Test Locally 🤖 AGENT (partial) + 👤 HUMAN (verification)

1. Start local Redis OR configure Upstash for local dev
2. Run `pnpm dev` in `apps/web`
3. Test scheduler: `curl http://localhost:3000/api/cron/schedule-daily`
4. Test settler: `curl http://localhost:3000/api/cron/settle-markets`

---

### Task 9: Deploy and Verify 👤 HUMAN

1. Push changes to GitHub
2. Vercel auto-deploys
3. Check Vercel dashboard → Project → Settings → Crons to see registered crons
4. Monitor logs in Vercel dashboard for first scheduled runs

---

## Files Created/Modified Summary

| Action | Path | Description |
|--------|------|-------------|
| Create | `apps/web/src/lib/cron/index.ts` | Upstash client, shared utilities |
| Create | `apps/web/src/lib/cron/auth.ts` | Cron request verification |
| Create | `apps/web/src/lib/cron/contract.ts` | viem client factory (port from `services/settler/src/contract.ts`) |
| Create | `apps/web/src/app/api/cron/schedule-daily/route.ts` | Daily market creation |
| Create | `apps/web/src/app/api/cron/settle-markets/route.ts` | Market settlement polling |
| Modify | `apps/web/package.json` | Add `@upstash/redis` |
| Modify | `vercel.json` | Add crons configuration |
| Modify | `.env` | Add Upstash + scheduler/settler env vars |

**Optional improvements (not required for MVP):**
| Action | Path | Description |
|--------|------|-------------|
| Modify | `packages/shared/src/providers/cached-provider.ts` | Support Upstash REST client |
| Create | `apps/web/src/app/api/cron/health/route.ts` | Health check endpoint for monitoring |

---

## Known Limitations (MVP Simplifications)

These features from the original services are **not included** in the MVP migration:

| Feature | Original Location | Impact | Future Fix |
|---------|-------------------|--------|------------|
| Weather response caching | `CachedProvider` | Slightly more API calls | Add Upstash caching later |
| Retry tracking | BullMQ job attempts | Failed settlements not auto-retried | Monitor logs, manual retry |
| Auto-cancel on max retries | `settler/index.ts:92-118` | Markets may stay unresolved | Add manual cancel in admin |
| Outage mode | `OutageController` | No automatic pause on provider failure | Check health at run start |
| Staggered market creation | BullMQ delayed jobs | All markets created at once | Use QStash if timing matters |

**These are acceptable for a demo/testnet deployment.** Add them back when moving to mainnet.

---

## Rollback Plan

The original `services/scheduler` and `services/settler` directories remain untouched. If the Vercel Cron approach doesn't work:

1. Remove the new API routes
2. Remove crons from `vercel.json`
3. Deploy scheduler/settler to Railway as originally planned

---

## Environment Variables Checklist

After migration, these are ALL the env vars needed in Vercel:

**Public (browser-safe):**
- `NEXT_PUBLIC_CONTRACT_ADDRESS` - For frontend betting UI
- `NEXT_PUBLIC_CHAIN_ID` - 114 (Coston2) or 14 (Flare)
- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` - Wallet connection

**Private (server-only):**
- `CONTRACT_ADDRESS` - For cron routes (same value as NEXT_PUBLIC version)
- `DATABASE_URL` - Supabase pooled connection
- `DIRECT_URL` - Supabase direct connection (for migrations)
- `RPC_URL` - Flare/Coston2 RPC endpoint
- `ADMIN_WALLETS` - Comma-separated admin addresses
- `SCHEDULER_PRIVATE_KEY` - Wallet for creating markets (needs FLR for gas)
- `SETTLER_PRIVATE_KEY` - Wallet for settling markets (needs FLR for gas)
- `WEATHER_PROVIDER` - `met-no` | `nws` | `open-meteo`
- `MET_NO_USER_AGENT` - Required when using MET Norway (format: `AppName/1.0 (email)`)
- `UPSTASH_REDIS_REST_URL` - Upstash REST endpoint
- `UPSTASH_REDIS_REST_TOKEN` - Upstash auth token
- `CRON_SECRET` - **Auto-set by Vercel**, don't manually create

**Note:** The cron routes should use `CONTRACT_ADDRESS` (not `NEXT_PUBLIC_`) since they're server-side. You can set both to the same value.

---

## Estimated Effort

| Task | Time |
|------|------|
| Upstash setup | 10 min |
| Install deps | 5 min |
| Cron utilities | 15 min |
| Scheduler route | 45 min |
| Settler route | 45 min |
| Vercel config | 10 min |
| Testing | 30 min |
| **Total** | **~2.5 hours** |

---

## Notes for Executing Agent

### Before Starting
1. **Read these files first** to understand the logic you're porting:
   - `services/scheduler/src/create-market.ts` - Core market creation
   - `services/settler/src/resolve.ts` - Core settlement logic
   - `services/settler/src/fetch-markets.ts` - Reading from contract
   - `packages/shared/src/providers/factory.ts` - Weather provider setup

### During Implementation
2. **Import from `@weatherb/shared`** rather than copying code:
   - `@weatherb/shared/abi` → `WEATHER_MARKET_ABI`
   - `@weatherb/shared/constants` → `CITIES`
   - `@weatherb/shared/providers` → `createWeatherProviderFromEnv()`
3. **Port `services/settler/src/contract.ts`** to `apps/web/src/lib/cron/contract.ts` - this creates viem clients
4. **Don't set `REDIS_URL`** in the API routes - this disables caching (acceptable for MVP)
5. **Use `@upstash/redis`** for city index state, NOT `ioredis`

### Testing
6. **Test locally with curl** before deploying:
   ```bash
   curl http://localhost:3000/api/cron/schedule-daily
   curl http://localhost:3000/api/cron/settle-markets
   ```
7. **Check Coston2 explorer** to verify transactions went through

### Safety
8. **Keep old services** - Don't delete `services/scheduler` or `services/settler` until migration is proven
9. **Vercel Hobby has 10s timeout** - If using Hobby plan, set `DAILY_MARKET_COUNT=2`


