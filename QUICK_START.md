# 48-Hour Test - Quick Start Guide

## TL;DR - Deploy in 3 Steps

### 1. Push the Code
```bash
cd /Users/cobibean/DEV/weatherb
git add vercel.json
git commit -m "test: configure cron for 48-hour automation test (every 30 min)"
git push
```

### 2. Update Vercel Environment Variables
Go to Vercel dashboard → Settings → Environment Variables → Add:
- `DAILY_MARKET_COUNT` = `5`
- `MARKET_SPACING_HOURS` = `0.5`

Then **redeploy** the production deployment.

### 3. Monitor Starting at Next 30-Minute Mark
Test starts automatically (e.g., 10:00, 10:30, 11:00, etc.)

---

## What to Expect

### Test Configuration
- **Duration:** 48 hours
- **Create markets:** Every 30 minutes (96 batches total)
- **Check settlements:** Every 5 minutes
- **Markets per batch:** 5
- **Resolve time spacing:** 30 minutes apart

### Expected Results
- **Total markets created:** 480
- **Total markets settled:** 480
- **Cities used:** 8 cities in rotation (NYC, LA, Chicago, Miami, Seattle, Denver, Phoenix, Austin)
- **Each city used:** 60 times (480 ÷ 8 = 60)

### City Rotation Pattern
With 5 markets per batch and 8 cities:
```
Batch 1: NYC, LA, Chicago, Miami, Seattle
Batch 2: Denver, Phoenix, Austin, NYC, LA
Batch 3: Chicago, Miami, Seattle, Denver, Phoenix
... continues rotating through all 8 cities
```

### Example Timeline
```
10:00 - Batch 1 creates: Markets resolve at 10:30, 11:00, 11:30, 12:00, 12:30
10:30 - Batch 2 creates + Market 1 from Batch 1 settles
11:00 - Batch 3 creates + Market 2 from Batch 1 settles
11:30 - Batch 4 creates + Market 3 from Batch 1 settles
12:00 - Batch 5 creates + Market 4 from Batch 1 settles
12:30 - Batch 6 creates + Market 5 from Batch 1 settles
... repeats for 48 hours
```

---

## Monitoring Checkpoints

Check every 6 hours and record in `AUTOMATION_TEST_EXECUTION.md`:

| Hour | Expected Batches | Expected Markets | What to Check |
|------|-----------------|------------------|---------------|
| 0 | 1 | 5 | First batch creates successfully |
| 0.5 | 2 | 10 | First market settles, second batch creates |
| 6 | 12 | 60 | All systems running smoothly |
| 12 | 24 | 120 | Mid-test checkpoint |
| 24 | 48 | 240 | Halfway point |
| 36 | 72 | 360 | Three-quarters done |
| 48 | 96 | 480 | Final report |

---

## How to Check Logs

### Vercel Dashboard
1. Go to your WeatherB project
2. **Deployments** → Production → **Functions**
3. Filter by `/api/cron/schedule-daily` or `/api/cron/settle-markets`
4. Click on executions to see logs

### What Success Looks Like
**Market creation:**
```json
{
  "success": true,
  "created": 5,
  "failed": 0,
  "timestamp": "2024-12-23T10:00:00.000Z"
}
```

**Market settlement:**
```json
{
  "success": true,
  "settled": 1,
  "pending": 4,
  "failed": 0,
  "timestamp": "2024-12-23T10:30:00.000Z"
}
```

---

## Pre-Flight Checklist

Before pushing:
- [ ] Scheduler wallet has 5+ FLR
- [ ] Settler wallet has 10+ FLR
- [ ] Weather API keys set in Vercel
- [ ] `CRON_SECRET` set in Vercel
- [ ] All environment variables verified

---

## After Test (48 Hours Later)

### 1. Revert Cron Schedules
```bash
# Edit vercel.json back to production:
"schedule": "0 6 * * *"  // schedule-daily (daily at 6 AM)
"schedule": "0 0 * * *"  // settle-markets (daily at midnight)

git add vercel.json
git commit -m "revert: restore production cron schedules"
git push
```

### 2. Generate Final Report
Fill out the final section in `AUTOMATION_TEST_EXECUTION.md`:
- Total success rate
- Issues encountered
- Recommendation (production ready?)

---

## Success Criteria

✅ **PASS** if:
- 480/480 markets created
- 480/480 markets settled
- 0 cron failures
- All settlements within 10 minutes
- City rotation working correctly

❌ **FAIL** if:
- Consistent HTTP 500 errors
- Markets stuck unsettled
- Weather API failures
- Contract reverts

---

## Need Help?

- **Detailed instructions:** `DEPLOY_TEST_CONFIG.md`
- **Checkpoint tracking:** `AUTOMATION_TEST_EXECUTION.md`
- **Test plan:** `AUTOMATION_TEST_PLAN.md`
- **Monitoring guide:** `AUTOMATION_TEST_PROMPT.md`

---

## Ready? Let's Go! 🚀

```bash
git add vercel.json
git commit -m "test: configure cron for 48-hour automation test (every 30 min)"
git push
```

Then update Vercel env vars and watch the magic happen! ✨

