# Prompt for Implementation Agent - 48 Hour Automation Verification

## Your Mission

You will verify that the WeatherB market creation and settlement automations work correctly in the live Vercel production environment over a 48-hour period. **You will NOT trigger any cron jobs manually** - they run automatically on schedule. Your job is to monitor, verify, and report.

---

## Prerequisites - Verify Before Starting

Use your Vercel MCP connection to check:

### 1. Cron Jobs Are Configured

Check that Vercel has these cron jobs enabled in production:

```
/api/cron/schedule-daily - Runs daily at 9:00 AM UTC
/api/cron/settle-markets - Runs every 10 minutes
```

**How to verify:**
- Use Vercel MCP to list configured cron jobs
- Confirm both jobs are enabled
- Confirm schedules match above

**Report back:**
```
Cron Configuration:
- schedule-daily: [schedule] [enabled/disabled]
- settle-markets: [schedule] [enabled/disabled]
```

### 2. Environment Variables Are Set

Verify these environment variables exist in Vercel production:

**Required:**
- `RPC_URL`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `SCHEDULER_PRIVATE_KEY`
- `SETTLER_PRIVATE_KEY`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `DAILY_MARKET_COUNT`
- `MARKET_SPACING_HOURS`

**Optional but recommended:**
- Weather API keys (MET_NORWAY_API_KEY, etc.)

**How to verify:**
- Use Vercel MCP to list environment variables
- Check each variable exists (don't print values, just confirm presence)

**Report back:**
```
Environment Variables:
- RPC_URL: [present/missing]
- NEXT_PUBLIC_CONTRACT_ADDRESS: [present/missing]
... (for each variable)
```

### 3. Baseline Contract State

Before the test starts, record the current state of the contract:

**How to get this data:**
- Option A: Use Vercel MCP to trigger a one-time contract read via admin panel
- Option B: Use Flare block explorer with NEXT_PUBLIC_CONTRACT_ADDRESS
- Option C: Ask user to provide baseline manually

**Record:**
- Current market count (how many markets exist now)
- Latest market ID
- Timestamp when you're starting the test

**Report back:**
```
Baseline Contract State (Test Start):
- UTC Time: [timestamp]
- Market Count: [number]
- Latest Market ID: [id]
```

---

## What You'll Monitor

### Every 6 Hours (8 checkpoints over 48 hours)

Use Vercel MCP to fetch and analyze logs:

#### For `/api/cron/schedule-daily` logs:

Extract from the most recent execution:
```
{
  "timestamp": "[when it ran]",
  "status": "[HTTP status code]",
  "success": [true/false],
  "created": [number],
  "failed": [number],
  "results": [
    {
      "marketId": "[id]",
      "cityId": "[city]",
      "resolveTime": "[timestamp]",
      "thresholdTenths": [number],
      "txHash": "[hash]"
    }
  ],
  "errors": [any errors]
}
```

**Questions to answer:**
1. Did it run at 9:00 AM UTC?
2. Did it create DAILY_MARKET_COUNT markets?
3. Were all transactions successful?
4. Are there any errors?

#### For `/api/cron/settle-markets` logs:

Extract from recent executions (last 10 minutes):
```
{
  "timestamp": "[when it ran]",
  "status": "[HTTP status code]",
  "success": [true/false],
  "settled": [number],
  "pending": [number],
  "failed": [number],
  "results": [
    {
      "marketId": "[id]",
      "tempTenths": [actual temp],
      "outcome": [true/false],
      "txHash": "[hash]"
    }
  ],
  "errors": [any errors]
}
```

**Questions to answer:**
1. Is it running every 10 minutes?
2. Are markets being settled at the correct times?
3. Are settlements happening within 10 minutes of resolve time?
4. Are there any failures?

---

## Detailed Verification Points

### Hour 0 Checkpoint (Day 1, 9:00 AM UTC)

**Wait for `schedule-daily` to execute at 9:00 AM UTC**

1. **Fetch logs** for `/api/cron/schedule-daily` from the last 30 minutes
2. **Verify response:**
   - HTTP 200
   - `success: true`
   - `created: N` (matches DAILY_MARKET_COUNT)
   - `failed: 0`
   - Transaction hashes present

3. **Extract market details:**
   - Market IDs created
   - City IDs used
   - Resolve times (should be spaced by MARKET_SPACING_HOURS)
   - Thresholds (should be multiples of 10)

4. **Report findings:**
```
Hour 0 - Market Creation (Day 1):
- Execution Time: [actual UTC time]
- Status: [SUCCESS/FAILURE]
- Markets Created: [count]
- Markets Failed: [count]
- City Rotation: [list of cities]
- Resolve Times: [list of times, verify spacing]
- Thresholds: [list, verify all multiples of 10]
- Transaction Hashes: [list]
- Errors: [any errors or "None"]
```

---

### Hour 3-6 Checkpoint (First Settlements)

**The first market should reach its resolve time around Hour 3-6**

1. **Fetch logs** for `/api/cron/settle-markets` from the last hour
2. **Look for the first settlement:**
   - `settled: 1` or more
   - Market ID matches first created market
   - Transaction hash present

3. **Verify settlement details:**
   - Actual temperature reading (tempTenths)
   - Observed timestamp (should be near resolve time)
   - Outcome (YES/NO based on temp >= threshold)

4. **Calculate settlement delay:**
   - Resolve time (from Hour 0 data)
   - Settlement time (from logs)
   - Delay = Settlement - Resolve (should be 0-10 minutes)

5. **Report findings:**
```
Hour 3-6 - First Settlement:
- Market ID: [id]
- Resolve Time: [expected time]
- Settlement Time: [actual time]
- Delay: [minutes]
- Temperature: [tempTenths] ([converted to °F])
- Threshold: [thresholdTenths]
- Outcome: [YES/NO]
- Transaction Hash: [hash]
- Status: [SUCCESS/FAILURE]
- Errors: [any errors or "None"]
```

---

### Hour 12 Checkpoint (Mid-Day 1)

1. **Fetch logs** for both cron jobs
2. **Count settlements:**
   - How many markets have been settled?
   - How many are still pending?

3. **Check for errors:**
   - Any settlement failures?
   - Any weather API errors?

4. **Report findings:**
```
Hour 12 - Mid-Day 1 Status:
- Markets Settled: [count]
- Markets Pending: [count]
- Total settle-markets Runs: [count since Hour 0]
- Settlement Success Rate: [%]
- Errors Encountered: [list or "None"]
```

---

### Hour 24 Checkpoint (Day 2, 9:00 AM UTC)

**Second `schedule-daily` execution**

1. **Fetch logs** for `/api/cron/schedule-daily`
2. **Verify second batch of markets:**
   - New markets created
   - Different cities than Day 1 (check rotation)
   - Fresh forecasts/thresholds

3. **Verify Day 1 markets:**
   - All Day 1 markets should be settled by now
   - Check final settlement status

4. **Report findings:**
```
Hour 24 - Day 2 Market Creation:
- Execution Time: [actual UTC time]
- Status: [SUCCESS/FAILURE]
- Markets Created: [count]
- City Rotation: [list, compare to Day 1]
- Day 1 Markets Status: [all settled/some pending]
- Day 1 Settlement Success Rate: [%]
- Errors: [any errors or "None"]
```

---

### Hour 36 Checkpoint (Mid-Day 2)

Same as Hour 12 checkpoint, but for Day 2 markets:

```
Hour 36 - Mid-Day 2 Status:
- Day 2 Markets Settled: [count]
- Day 2 Markets Pending: [count]
- Day 1 Markets Status: [all in terminal state?]
- Total Errors Since Hour 24: [count]
```

---

### Hour 48 Checkpoint (End of Test)

**Final verification**

1. **Fetch logs** for both cron jobs
2. **Generate final summary:**

```
Hour 48 - Final Test Summary:
- Total Markets Created: [count]
- Total Markets Settled: [count]
- Total Markets Cancelled: [count]
- Total Markets Still Pending: [count]
- Total settle-markets Executions: [count]
- Overall Success Rate: [%]
- Total Errors: [count]
```

3. **Analyze performance:**
```
Performance Metrics:
- Average Settlement Delay: [minutes]
- Longest Settlement Delay: [minutes] (Market ID: [id])
- Weather API Success Rate: [%]
- Transaction Success Rate: [%]
```

4. **List all issues:**
```
Issues Encountered:
[List each error/warning with timestamp and resolution]
OR
"No issues - all systems nominal"
```

---

## How to Collect Data

### Using Vercel MCP

**To fetch logs:**
```
Use Vercel MCP to:
1. List all cron job executions in the last [timeframe]
2. Get detailed logs for specific execution ID
3. Filter logs by route path (/api/cron/schedule-daily or /api/cron/settle-markets)
```

**To check environment variables:**
```
Use Vercel MCP to:
1. List all environment variables for production deployment
2. Verify presence (don't print secret values)
```

**To verify cron configuration:**
```
Use Vercel MCP to:
1. Get project configuration (vercel.json or dashboard settings)
2. List active cron schedules
```

---

## Reporting Format

After each checkpoint (every 6 hours), provide a structured report:

```markdown
## Checkpoint [Hour X]
**UTC Time:** [timestamp]

### schedule-daily Status
[data from logs or "Did not run (not scheduled)" or "ERROR: [details]"]

### settle-markets Status
[summary of recent executions]

### Issues
[list any errors/warnings or "None"]

### Next Checkpoint
[Hour Y at UTC time Z]
```

After Hour 48, provide:

```markdown
## 48-Hour Automation Test - Final Report

### Test Period
- Start: [UTC timestamp]
- End: [UTC timestamp]
- Duration: 48 hours

### Summary Statistics
[from Hour 48 checkpoint data]

### Performance Analysis
[from performance metrics]

### Issues Log
[complete list of all issues with resolutions]

### Contract State Verification
- Starting Market Count: [from baseline]
- Ending Market Count: [from final check]
- Expected Increase: [2 × DAILY_MARKET_COUNT]
- Actual Increase: [calculated]
- Match: [YES/NO]

### Recommendation
[Choose one:]
✅ **PRODUCTION READY** - All systems working as expected
⚠️ **PRODUCTION READY WITH CAVEATS** - Minor issues observed: [list]
❌ **NOT PRODUCTION READY** - Critical issues: [list]

### Detailed Logs
[Attach or link to full log files for all checkpoint data]
```

---

## What To Do If Something Goes Wrong

### If schedule-daily Fails
1. **Capture full error logs**
2. **Check:**
   - Scheduler wallet has FLR balance?
   - Environment variables set correctly?
   - Weather API responding?
3. **Report immediately** - don't wait for next checkpoint
4. **Ask user:** Should I continue monitoring or stop test?

### If settle-markets Fails
1. **Capture full error logs**
2. **Check:**
   - Settler wallet has FLR balance?
   - Weather API responding?
   - Are there actually markets ready to settle?
3. **Report immediately**
4. **Ask user:** Should I continue monitoring or stop test?

### If Logs Are Unavailable
1. **Try alternative methods:**
   - Check Vercel dashboard directly
   - Use Flare block explorer to see on-chain state
2. **Report the issue**
3. **Ask user for guidance**

---

## Success Criteria

For a **PASSING** test, we need:
- ✅ 100% market creation success (2 × DAILY_MARKET_COUNT markets created)
- ✅ 100% market settlement success (all created markets settled)
- ✅ 0 cron execution failures (HTTP 500s)
- ✅ All settlements within 10 minutes of resolve time
- ✅ Weather data fetched successfully for all settlements
- ✅ City rotation working (no duplicate cities on same day)

---

## Timeline

**Your 48-hour monitoring schedule:**

| Hour | Checkpoint | Key Event |
|------|------------|-----------|
| 0 | ✅ START | Day 1 market creation at 9:00 AM UTC |
| 6 | ✅ Check | First settlements should be happening |
| 12 | ✅ Check | Mid-day 1 status |
| 18 | ✅ Check | Most Day 1 markets settled |
| 24 | ✅ Check | Day 2 market creation at 9:00 AM UTC |
| 30 | ✅ Check | Day 2 first settlements |
| 36 | ✅ Check | Mid-day 2 status |
| 42 | ✅ Check | Most Day 2 markets settled |
| 48 | ✅ END | Final report |

**Between checkpoints:**
- Monitor for critical errors (you can check logs more frequently if you want)
- If you see errors, report immediately

---

## Final Deliverable

At the end of 48 hours, provide:

1. **Executive Summary** (what happened in 2-3 sentences)
2. **Final Report** (using format above)
3. **Recommendation** (ship or not ship)
4. **Full Checkpoint Logs** (all 8 checkpoint reports)

---

## Questions to Ask Before Starting

Before you begin monitoring, confirm with the user:

1. What is the current value of `DAILY_MARKET_COUNT`?
2. What is the current value of `MARKET_SPACING_HOURS`?
3. When should I start monitoring? (Next 9:00 AM UTC, or start mid-cycle?)
4. Should I report checkpoints in real-time or wait until end?

---

## You're Ready

Once prerequisites are verified and you have answers to the questions above, respond with:

```
🚀 Automation Test Ready to Start

Configuration:
- DAILY_MARKET_COUNT: [value]
- MARKET_SPACING_HOURS: [value]
- Test Start: [UTC timestamp of next 9:00 AM]
- Test End: [UTC timestamp 48 hours later]

Monitoring Plan:
- 8 checkpoints every 6 hours
- Real-time error reporting: [YES/NO]

Baseline Recorded:
- Current Market Count: [number]
- Cron Jobs Verified: ✅
- Environment Variables Verified: ✅

Standing by for test start...
```

Then execute the monitoring plan and report back at each checkpoint.

**Good luck! 🎯**
