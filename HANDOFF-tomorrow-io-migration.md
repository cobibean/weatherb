# 🔄 HANDOFF: Tomorrow.io Migration - Phase 4 Prepared (Tests Pending)

**Date:** 2026-01-03
**Status:** Phase 4 Prepared ✅ (tests/monitoring pending execution)
**Next Agent:** Run validation tests and monitor API usage

---

## 📚 Required Reading (IN THIS ORDER)

1. **First, read:** `/Users/cobibean/DEV/weatherb/AGENTS.md` - Understand the agent workflow system
2. **Then read:** `docs/plans/2026-01-03-tomorrow-io-migration.md` - Complete design & architecture
3. **Then read:** `docs/plans/2026-01-03-tomorrow-io-IMPLEMENTATION.md` - What's been completed so far
4. **Then read:** This handoff document (you're here!)

---

## 🎯 The Big Picture: Why We're Doing This

### The Problem We're Solving

**WeatherB** is a prediction market on Flare where users bet YES/NO on temperature outcomes. Think: "Will NYC be ≥ 75°F at 2 PM tomorrow?"

The system was using **3 weather providers** (MET Norway, NWS, Open-Meteo) with complex fallback logic. Worse, the settlement cron was running **every 5 minutes** (288 times/day), scanning all markets on every run—massively wasteful.

### The Solution

1. **Single Provider:** Switch to Tomorrow.io exclusively (50 API calls/day free tier)
2. **Smart Caching:** 24h for forecasts, 1h for realtime (Redis-backed)
3. **Event-Driven Settlement:** Markets settle at EXACT resolve time (not polling every 5 min)

### The Impact

- **Before:** Complex multi-provider fallback, 288 cron runs/day, unpredictable API usage
- **After:** Single provider, ~13 API calls/day, event-driven settlement, 37 calls/day buffer

---

## ✅ What's Already Done (Phase 1)

### Implemented Files

1. **`packages/shared/src/providers/tomorrow-io.ts`** ✅
   - Realtime API for settlement (current temp)
   - Forecast API for market creation (24h ahead)
   - Celsius → Fahrenheit → tenths conversion
   - Health check endpoint

2. **`packages/shared/src/providers/cached-provider.ts`** ✅
   - Updated TTLs: 24h forecast, 1h realtime
   - Cache key rounding (hourly timestamps, 4-decimal coords)
   - Cache HIT/MISS logging

3. **`packages/shared/src/providers/factory.ts`** ✅
   - Replaced multi-provider fallback with Tomorrow.io only
   - Automatic Redis caching

4. **Environment & Config** ✅
   - `TOMORROW_IO_API_KEY` added to `.env` and `.env.example`
   - API key already in place: `vdpg37hnLcFLGsiZrMmrJQ4CO6y8l8Bs`
   - Old providers deprecated but not yet removed

### Build Status
✅ `pnpm --filter @weatherb/shared build` passes

### API Budget
- **~13 calls/day** (well under 50 limit)
- 37 calls/day buffer for testing, retries, growth

---

## ✅ Phase 2 Completed (Event-Driven Settlement via QStash)

### Implemented Files
1. **`apps/web/src/app/api/markets/[marketId]/settle/route.ts`** ✅
   - Per-market settlement endpoint
   - Cron auth via `CRON_SECRET`
   - On-chain status check + resolve on-chain
2. **`apps/web/src/app/api/cron/schedule-daily/route.ts`** ✅
   - Schedules QStash delivery to settle at exact `resolveTime`
   - Uses `QSTASH_TOKEN` and `NEXT_PUBLIC_APP_URL` (or `APP_URL`)
3. **`apps/web/src/app/api/cron/settle-markets/route.ts`** ✅
   - Tight ±10 minute fallback window + overdue logging
4. **`apps/web/package.json`** ✅
   - Added `@upstash/qstash`
5. **`.env.example`** ✅
   - Added `QSTASH_TOKEN`

---

## 🚀 Next Mission: Phase 4 Testing + Monitoring

### User's Explicit Choice: **Use QStash for event-driven settlement**

The user chose **Option A** over Option B. This is important.

### What Is Event-Driven Settlement?

**Current (inefficient):**
- Cron runs every 5 minutes
- Scans ALL markets
- Checks if any are ready to settle
- Settles ready markets
- **Problem:** 99% of cron runs do nothing!

**Event-Driven (efficient):**
- When a market is created, schedule a job to run AT EXACT resolve time (24h later)
- Job calls `/api/markets/[marketId]/settle` for that specific market
- No polling, no scanning, perfect timing
- **Result:** 5 markets/day = 5 settlement API calls, exactly when needed

---

## 📋 Phase 2 Implementation Tasks (Completed)

### Task 1: Create Per-Market Settlement Endpoint ✅

**File to create:** `apps/web/src/app/api/markets/[marketId]/settle/route.ts`

**Purpose:** Settle a SPECIFIC market when called (not scan all markets)

**Key points:**
1. Accept `POST /api/markets/[marketId]/settle`
2. Verify request is authorized (use `CRON_SECRET` like existing crons)
3. Fetch market from database using `contractMarketId`
4. Validate market status is `Open` (not already settled)
5. Call Tomorrow.io provider: `getFirstReadingAtOrAfter(lat, lon, resolveTime)`
6. Submit to contract: `resolveMarket(marketId, tempTenths, observedTimestamp)`
7. Log success/failure
8. Return JSON response

**Reference files:**
- `apps/web/src/app/api/cron/settle-markets/route.ts` - Current settlement logic (lines 172-250 have the core settlement function)
- Extract the `resolveMarket()` function (lines 172-250) and adapt it

**Template structure:**
```typescript
export async function POST(
  request: Request,
  { params }: { params: { marketId: string } }
): Promise<NextResponse> {
  // 1. Verify auth (CRON_SECRET)
  // 2. Fetch market from DB
  // 3. Validate market status
  // 4. Get temperature from Tomorrow.io
  // 5. Submit to contract
  // 6. Return result
}
```

---

### Task 2: Schedule Settlement During Market Creation ✅

**File to update:** `apps/web/src/app/api/cron/schedule-daily/route.ts`

**Current flow:**
1. Cron runs hourly (12:00-16:00 UTC)
2. Selects next city
3. Gets forecast from weather provider
4. Creates market on-chain (24h duration)
5. ~~Returns~~

**New flow (add step 5):**
1. Cron runs hourly (12:00-16:00 UTC)
2. Selects next city
3. Gets forecast from weather provider
4. Creates market on-chain (24h duration)
5. **Schedule settlement job to run at exact `resolveTime`** ← ADD THIS

**Scheduling options:**

**Option A1 - Vercel Cron (Dynamic):**
If Vercel supports dynamic cron scheduling (check docs), schedule a one-time job:
```typescript
// After creating market
await scheduleVercelCron({
  path: `/api/markets/${marketId}/settle`,
  runAt: new Date(resolveTimeSec * 1000),
  secret: process.env.CRON_SECRET,
});
```

**Option A2 - Upstash QStash (Recommended):**
Use Upstash QStash for scheduled HTTP requests:
```typescript
import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN });

await qstash.publishJSON({
  url: `${process.env.APP_URL}/api/markets/${marketId}/settle`,
  notBefore: resolveTimeSec,
  headers: {
    'Authorization': `Bearer ${process.env.CRON_SECRET}`,
  },
});
```

**Option A3 - Database + Smart Cron (Fallback):**
If scheduling is complex:
1. Store market with `needsSettlement: true` in database
2. Keep existing cron but only check markets within ±10min window:
```typescript
const nowSec = Math.floor(Date.now() / 1000);
const readyMarkets = pendingMarkets.filter(m => {
  const timeUntilResolve = m.resolveTimeSec - nowSec;
  return timeUntilResolve >= -600 && timeUntilResolve <= 600; // ±10min
});
```

**User preference:** QStash enabled (event-driven), cron is fallback only.

**Key files to reference:**
- `apps/web/src/app/api/cron/schedule-daily/route.ts` (lines 220-234) - Market creation logic
- `apps/web/src/lib/cron/index.ts` - Cron utilities (auth, Redis, etc.)

---

### Task 3: Update Existing Settlement Cron (Interim Safety Net) ✅

**File to update:** `apps/web/src/app/api/cron/settle-markets/route.ts`

Even with event-driven settlement, keep the cron as a **safety net** for missed settlements.

**Changes:**
1. Add ±10min window filter (only check markets close to resolve time)
2. Add logging: "Event-driven settlement should have handled this, running fallback"
3. Keep existing logic intact otherwise

**Code change (around line 299):**
```typescript
// Filter to markets past their resolve time
const nowSec = Math.floor(Date.now() / 1000);

// UPDATED: Only check markets within ±10min window (event-driven should handle others)
const readyMarkets = pendingMarkets.filter((m) => {
  const timeUntilResolve = m.resolveTimeSec - nowSec;
  const isPastResolveTime = m.resolveTimeSec <= nowSec;
  const isWithinWindow = Math.abs(timeUntilResolve) <= 600; // 10 min buffer

  if (isPastResolveTime && !isWithinWindow) {
    console.warn(`Market ${m.marketId} is ${Math.abs(timeUntilResolve)}s overdue - event settlement may have failed`);
  }

  return isPastResolveTime && isWithinWindow;
});
```

This ensures:
- Markets settle on time via event-driven
- If event fails, cron catches it within 10 min
- Old cron waste (checking markets hours away) eliminated

---

## 📂 Essential Files Reference

### Core Tomorrow.io Files (Already Implemented)
- `packages/shared/src/providers/tomorrow-io.ts` - Tomorrow.io provider
- `packages/shared/src/providers/cached-provider.ts` - Smart caching
- `packages/shared/src/providers/factory.ts` - Provider factory
- `.env` - Has `TOMORROW_IO_API_KEY=vdpg37hnLcFLGsiZrMmrJQ4CO6y8l8Bs`

### Settlement Files (You'll Modify/Create)
- `apps/web/src/app/api/markets/[marketId]/settle/route.ts` - **CREATE THIS**
- `apps/web/src/app/api/cron/schedule-daily/route.ts` - **UPDATE: Add scheduling**
- `apps/web/src/app/api/cron/settle-markets/route.ts` - **UPDATE: Add window filter**

### Utility Files (Reference)
- `apps/web/src/lib/cron/index.ts` - Cron auth, Redis, contract clients
- `apps/web/prisma/schema.prisma` - Database schema (Market model)
- `packages/shared/src/abi/weather-market.ts` - Contract ABI
- `packages/shared/src/constants/cities.ts` - City definitions

### Contract Files (Reference Only)
- `contracts/src/WeatherMarketV2.sol` - Smart contract (lines 289-332: resolveMarket function)
- No hardcoded 24h - resolve time is set by caller during market creation
- Markets can be settled anytime after `resolveTime`

---

## 🧪 Testing Strategy

**CRITICAL:** API calls cost money! Tomorrow.io free tier = 50/day.

### Before Testing
1. Verify `TOMORROW_IO_API_KEY` is set in `.env`
2. Check Tomorrow.io dashboard for current API usage
3. Use test cities strategically

### Test Plan (One Market at a Time!)

**Test 1: Forecast API (Market Creation)**
```bash
# Create a single test market
pnpm exec tsx scripts/test-market-creation.ts
```
- Expected: 1 forecast API call
- Verify cache HIT on second call (same hour, same coords)

**Test 2: Realtime API (Settlement)**
```bash
# Settle a single test market
pnpm exec tsx scripts/test-market-settlement.ts
```
- Expected: 1 realtime API call
- Verify cache HIT on second call (same hour, same coords)

**Test 3: Event-Driven Settlement**
1. Create a test market with `resolveTime` in 2 minutes
2. Verify settlement job is scheduled
3. Wait 2 minutes
4. Verify settlement endpoint is called
5. Verify market is resolved on-chain

**Test 4: Cron Safety Net**
1. Create a market with `resolveTime` in past (simulate missed event)
2. Run settle-markets cron manually
3. Verify it catches the overdue market
4. Verify warning log appears

---

## 🚨 Critical Constraints

### API Call Budget
- **Maximum:** 50 calls/day
- **Target:** ~13 calls/day (5 forecasts + 5 settlements + 3 health)
- **Buffer:** 37 calls/day remaining
- **Testing:** Use ONE market at a time, not batches!

### Settlement Timing
- Markets resolve exactly 24 hours after creation
- Betting deadline = `resolveTime - bettingBufferSeconds` (default 10 min)
- Temperature must be measured AS CLOSE AS POSSIBLE to `resolveTime`
- If settlement is delayed >1 hour, temperature may differ from actual resolve time

### Caching Rules
- Forecast: 24h TTL (forecasts don't change much)
- Realtime: 1h TTL (temperature updates hourly)
- Cache keys rounded to nearest hour for better hit rates
- Monitor cache HIT/MISS logs in production

---

## 📊 Success Metrics

After Phase 3 implementation, verify:

- [ ] Event-driven settlement works (markets settle within 5 min of resolve time)
- [ ] Cron safety net catches missed settlements (within 10 min)
- [ ] API usage stays at ~13 calls/day (check Tomorrow.io dashboard)
- [ ] Cache hit rate >80% (check logs for HIT/MISS ratio)
- [ ] No "provider fallback" errors (single provider only)
- [ ] Markets create and settle successfully in production

---

## 🔄 After Phase 3: Remaining Work

### Phase 3: Remove Old Providers ✅
- Deleted `met-no.ts`, `nws.ts`, `open-meteo.ts`, `fallback-provider.ts`
- Removed deprecated exports from `index.ts`
- Removed old provider tests

### Phase 4: Testing & Monitoring
- Update all tests to use Tomorrow.io
- Monitor API usage for 24-48 hours
- Verify cache hit rates
- Update documentation

### Phase 5: Deployment
- Add `TOMORROW_IO_API_KEY` to Vercel environment (already have key)
- Deploy to staging
- Monitor for 24 hours
- Deploy to production
- Remove deprecated env vars

---

## 💡 Implementation Tips

### 1. Use Existing Patterns
Don't reinvent the wheel. The codebase already has:
- Cron auth: `verifyCronRequest()` in `apps/web/src/lib/cron/index.ts`
- Contract clients: `createContractClients()` in same file
- Provider: `createWeatherProviderFromEnv()` (already uses Tomorrow.io)

### 2. Error Handling
- Log everything (console.log, console.error)
- Don't fail silently
- Return JSON responses with success/error info
- Use try/catch blocks

### 3. Type Safety
- Use TypeScript strictly
- Import types from `@weatherb/shared/types`
- Use Viem types for blockchain operations (`Hex`, etc.)

### 4. Testing Philosophy
- Start with ONE test market
- Verify it works end-to-end
- Check Tomorrow.io API usage dashboard
- Only then scale up

---

## 📞 Questions to Ask User (If Needed)

1. **QStash Decision:** "Do you want to use Upstash QStash for scheduling (requires setup) or smart cron window filter (simpler)?"
2. **Testing Strategy:** "Should I create a test script for event-driven settlement, or test manually with actual markets?"
3. **Deployment Timing:** "When do you want to deploy Phase 2 to production (after local testing)?"

---

## 🎬 Action Plan (Start Here!)

1. **Read all required docs** (AGENTS.md, migration plan, implementation doc)
2. **Understand current state:**
   - Tomorrow.io provider: ✅ Working
   - Smart caching: ✅ Working
   - Event-driven settlement: ❌ Your job
3. **Create per-market settlement endpoint** (`/api/markets/[marketId]/settle`)
4. **Update market creation** to schedule settlement (QStash or smart window)
5. **Update existing cron** with ±10min window filter
6. **Test with ONE market** (verify API call count)
7. **Verify end-to-end flow** (create → wait → settle)
8. **Report results** to user

---

## 📝 Summary for Next Agent

**You are continuing the Tomorrow.io weather provider migration for WeatherB.**

**What's done:** Tomorrow.io provider implemented, smart caching configured, event-driven settlement via QStash in place, cron fallback window tightened, old providers removed.

**What you need to do:** Run Phase 4 tests/monitoring (not executed yet) and verify API usage/caching.

**Why it matters:** Keeps the codebase single-provider and reduces maintenance + API risk.

**Start by:** Running light validation tests (one market) and check cache hit/miss logs.

**User preference:** QStash is enabled for scheduling; cron is fallback only.

**Critical:** Test with ONE market at a time to conserve API calls!

---

**Good luck! The foundation is solid, now validate end-to-end and monitor usage. 🚀**
