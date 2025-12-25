# Automation Test Plan - 48 Hour Live Verification

## Objective

Verify the WeatherB market creation and settlement automations work correctly in production over a 48-hour period without AI intervention.

---

## Pre-Test Setup Requirements

### 1. Vercel Cron Configuration
Verify these cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/schedule-daily",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/settle-markets",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

**Expected Behavior:**
- `schedule-daily` runs once per day at 9:00 AM UTC
- `settle-markets` runs every 10 minutes

### 2. Environment Variables
Confirm these are set in Vercel production environment:

```
RPC_URL=https://flare-api.flare.network/ext/C/rpc
NEXT_PUBLIC_CONTRACT_ADDRESS=0x[deployed contract address]
SCHEDULER_PRIVATE_KEY=0x[scheduler wallet private key]
SETTLER_PRIVATE_KEY=0x[settler wallet private key]
UPSTASH_REDIS_REST_URL=[redis url]
UPSTASH_REDIS_REST_TOKEN=[redis token]
CRON_SECRET=[shared secret for auth]
DAILY_MARKET_COUNT=[1-5]
MARKET_SPACING_HOURS=[hours between markets]
```

### 3. Contract State
Before starting, record baseline:
- Current market count: `getMarketCount()`
- Settler wallet FLR balance
- Scheduler wallet FLR balance

### 4. Redis State
Record current city rotation index:
- Key: `weatherb:city:index`
- Value: [current index]

---

## Test Timeline (48 Hours)

### Hour 0 (Test Start - Day 1, 9:00 AM UTC)

**Event:** First `schedule-daily` execution

**What to Verify:**

1. **Vercel Logs** (`/api/cron/schedule-daily`)
   - HTTP 200 response
   - `success: true` in response body
   - `created: N` matches DAILY_MARKET_COUNT
   - `failed: 0`
   - Transaction hashes present for each market

2. **Contract State** (via Flare Explorer or contract read)
   - Market count increased by DAILY_MARKET_COUNT
   - For each new market:
     - `status = 0` (Open)
     - `resolveTime` is spaced by MARKET_SPACING_HOURS
     - `bettingDeadline = resolveTime - 10 minutes`
     - `thresholdTenths` is a multiple of 10 (whole degree)
     - `cityId` matches expected rotation

3. **Redis State**
   - `weatherb:city:index` incremented by DAILY_MARKET_COUNT

4. **Weather API Calls**
   - Vercel logs show successful forecast fetches
   - No weather API errors

**Success Criteria:**
- ✅ All markets created successfully
- ✅ No errors in Vercel logs
- ✅ Transaction confirmations received
- ✅ Contract state matches expected values

---

### Hours 0-3 (First Settlement Window)

**Event:** `settle-markets` runs every 10 minutes

**What to Verify:**

1. **Vercel Logs** (`/api/cron/settle-markets`)
   - HTTP 200 response every 10 minutes
   - `success: true`
   - `settled: 0` (no markets ready yet)
   - `pending: N` (all markets still waiting)
   - `message: "No markets ready for settlement"`

**Success Criteria:**
- ✅ Cron runs successfully every 10 minutes
- ✅ No premature settlements
- ✅ No errors

---

### Hour 3+ (First Market Resolution)

**Event:** First market reaches `resolveTime`, next `settle-markets` run should settle it

**What to Verify:**

1. **Vercel Logs** (`/api/cron/settle-markets`)
   - `settled: 1` (first market)
   - `pending: N-1` (remaining markets)
   - `failed: 0`
   - Transaction hash present
   - Correct `tempTenths` and `observedTimestamp` logged

2. **Contract State**
   - Market 0 (or first created market):
     - `status = 2` (Resolved)
     - `resolvedTempTenths` matches weather reading
     - `observedTimestamp` is within 1 hour of `resolveTime`
     - `outcome = true/false` based on `temp >= threshold`

3. **Weather Data**
   - Vercel logs show actual temperature reading
   - Source matches expected provider (met-no, nws, open-meteo)
   - Temperature is in tenths (e.g., 753 = 75.3°F)

**Success Criteria:**
- ✅ Market settled within 10 minutes of resolve time
- ✅ Weather data fetched successfully
- ✅ Outcome calculated correctly
- ✅ Transaction confirmed on-chain

---

### Hours 3-24 (Remaining Day 1 Settlements)

**What to Verify:**

Each market should settle at its `resolveTime + 0-10 minutes`:

1. **Sequential Settlements**
   - Markets settle in order
   - Spacing matches MARKET_SPACING_HOURS
   - No missed settlements

2. **Error Handling**
   - If weather API fails, check logs for retry behavior
   - Settlement should continue for other markets

**Success Criteria:**
- ✅ All Day 1 markets settled successfully
- ✅ No markets stuck in Open status past resolve time

---

### Hour 24 (Day 2, 9:00 AM UTC)

**Event:** Second `schedule-daily` execution

**What to Verify:**

1. **Vercel Logs**
   - Same checks as Hour 0
   - New markets created with fresh forecasts

2. **Contract State**
   - Market count increased by another DAILY_MARKET_COUNT
   - Total markets = baseline + (2 × DAILY_MARKET_COUNT)

3. **Redis State**
   - City index incremented by another DAILY_MARKET_COUNT
   - Cities rotated correctly (no duplicates on same day)

**Success Criteria:**
- ✅ Day 2 markets created successfully
- ✅ City rotation working
- ✅ No interference with Day 1 settled markets

---

### Hours 24-48 (Day 2 Settlements)

**What to Verify:**

Same settlement verification as Day 1:
- Markets settle at correct times
- Weather data accurate
- All transactions confirmed

**Additional Check:**
- Day 1 markets remain in Resolved/Cancelled status (no re-settlements)

**Success Criteria:**
- ✅ All Day 2 markets settled successfully
- ✅ No regression on Day 1 markets
- ✅ System stable over 48 hours

---

## Data Collection Points

### Every 6 Hours
Record snapshot:
- Market count
- Number of Open markets
- Number of Resolved markets
- Number of Cancelled markets
- Latest `settle-markets` cron result
- Any errors in Vercel logs

### Every Market Creation
Record:
- Market ID
- City ID
- Resolve time
- Betting deadline
- Threshold (tenths)
- Transaction hash
- Forecast source

### Every Market Settlement
Record:
- Market ID
- Actual temp (tenths)
- Observed timestamp
- Outcome (YES/NO)
- Transaction hash
- Settlement delay (time from resolveTime to settlement)

---

## Success Metrics

### Primary Metrics (Must Pass)
- ✅ 100% market creation success rate
- ✅ 100% market settlement success rate
- ✅ 0 cron execution failures
- ✅ All settlements within 10 minutes of resolve time
- ✅ All weather data fetches successful

### Secondary Metrics (Should Pass)
- ✅ City rotation working (no duplicate cities on same day)
- ✅ Redis state persists correctly
- ✅ Transaction gas costs reasonable (<0.01 FLR per operation)
- ✅ No memory leaks or performance degradation

### Failure Conditions (Stop Test If)
- ❌ Any cron job returns 500 error
- ❌ Missing environment variables
- ❌ Contract revert errors
- ❌ Weather API completely unavailable
- ❌ Settlement stuck for >1 hour past resolve time

---

## Post-Test Analysis

After 48 hours, generate report with:

1. **Summary Stats**
   - Total markets created: X
   - Total markets settled: Y
   - Total cron executions: Z
   - Success rate: %

2. **Performance**
   - Average settlement delay
   - Average gas cost per operation
   - Weather API response times

3. **Issues Encountered**
   - List any errors/warnings
   - Recovery actions taken
   - Recommended fixes

4. **Contract State Verification**
   - Final market count
   - All markets in terminal state (Resolved/Cancelled)
   - Wallet balances after operations

5. **Recommendation**
   - ✅ Production Ready
   - ⚠️ Production Ready with Caveats
   - ❌ Not Production Ready

---

## Emergency Procedures

### If Schedule-Daily Fails
1. Check Vercel logs for error details
2. Verify environment variables
3. Check scheduler wallet FLR balance
4. Manual market creation may be required via admin panel

### If Settle-Markets Fails
1. Check Vercel logs for error details
2. Verify weather API availability
3. Check settler wallet FLR balance
4. Manual settlement may be required via admin panel

### If Both Fail
1. Check Vercel deployment status
2. Verify cron configuration
3. Check CRON_SECRET matches
4. May need to redeploy

---

## Test Execution Checklist

- [ ] Baseline data recorded
- [ ] Environment variables verified
- [ ] Cron jobs configured in Vercel
- [ ] Test start time logged (UTC)
- [ ] Hour 0 verification completed
- [ ] Hour 3+ first settlement verified
- [ ] Hour 24 second creation verified
- [ ] Hour 48 reached
- [ ] All data collected
- [ ] Post-test analysis completed
- [ ] Report generated

---

## Expected Test Duration

**Start:** Day 1, 9:00 AM UTC (when `schedule-daily` runs)
**End:** Day 3, 9:00 AM UTC (48 hours later)

**Total Cron Executions Expected:**
- `schedule-daily`: 2 executions (Day 1 & Day 2)
- `settle-markets`: ~288 executions (every 10 min × 48 hours)

**Total Markets Expected:**
- Created: 2 × DAILY_MARKET_COUNT
- Settled: Same as created (all should resolve within 48 hours)
