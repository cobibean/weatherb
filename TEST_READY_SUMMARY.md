# 48-Hour Automation Test - Ready to Deploy! 🚀

## ✅ Configuration Complete

All test configurations are ready. Here's what's been set up:

### Local Changes Made

1. **vercel.json** - Updated cron schedule:
   - `schedule-daily`: Changed from `0 6 * * *` → `*/30 * * * *` (every 30 minutes)
   - `settle-markets`: Already at `*/5 * * * *` (every 5 minutes) ✅

2. **.env** - Added test configuration:
   - `DAILY_MARKET_COUNT=5` ✅
   - `MARKET_SPACING_HOURS=0.5` ✅

3. **Documentation Created:**
   - `AUTOMATION_TEST_EXECUTION.md` - Checkpoint tracking log
   - `DEPLOY_TEST_CONFIG.md` - Step-by-step deployment guide

---

## 📊 Expected Test Results

### Test Parameters
- **Duration:** 48 hours
- **Market creation frequency:** Every 30 minutes
- **Settlement check frequency:** Every 5 minutes
- **Markets per batch:** 5
- **Time between market resolve times:** 30 minutes

### Expected Outcomes
- **Total batches:** 96 (48 hours × 2 per hour)
- **Total markets created:** 480 (96 batches × 5 markets)
- **Total markets settled:** 480 (all should settle within 30 minutes)

### Example Timeline
```
10:00 AM - Batch 1 created: Markets resolve at 10:30, 11:00, 11:30, 12:00, 12:30
10:30 AM - Batch 2 created + Market 1 from Batch 1 settles
11:00 AM - Batch 3 created + Market 2 from Batch 1 settles
11:30 AM - Batch 4 created + Market 3 from Batch 1 settles
... and so on for 48 hours
```

---

## 🚀 Next Steps - Deploy to Vercel

### Step 1: Commit and Push (Do This Now)

```bash
cd /Users/cobibean/DEV/weatherb

# Add only the vercel.json change
git add vercel.json

# Commit
git commit -m "test: configure cron for 48-hour automation test (every 30 min)"

# Push to trigger Vercel deployment
git push
```

### Step 2: Update Vercel Environment Variables

Go to Vercel dashboard and add/update these variables in **Production** environment:

1. **DAILY_MARKET_COUNT** = `5`
2. **MARKET_SPACING_HOURS** = `0.5`

**Important:** Make sure to redeploy after adding environment variables!

### Step 3: Record Baseline State

Before the test starts, record in `AUTOMATION_TEST_EXECUTION.md`:

- Current market count (from contract)
- Scheduler wallet FLR balance
- Settler wallet FLR balance
- Current UTC time when test starts

### Step 4: Monitor and Record

The test will start automatically at the next 30-minute mark (e.g., 10:00, 10:30, 11:00).

**Checkpoint schedule:**
- Hour 0 (start) - First batch creates
- Hour 0.5 (+30 min) - First market settles
- Hour 6, 12, 18, 24, 30, 36, 42 - Major checkpoints
- Hour 48 (end) - Final report

---

## 📋 Monitoring Checklist

At each checkpoint, record in `AUTOMATION_TEST_EXECUTION.md`:

- [ ] UTC timestamp
- [ ] Total batches created (vs expected)
- [ ] Total markets created (vs expected)
- [ ] Total markets settled (vs expected)
- [ ] Any errors in Vercel logs
- [ ] Settlement delays (should be < 5 minutes)
- [ ] Weather API success rate
- [ ] Transaction success rate

---

## 🔍 How to Check Logs

### Via Vercel Dashboard
1. Go to your WeatherB project
2. Click **Deployments** → Production deployment
3. Click **Functions** tab
4. Filter by:
   - `/api/cron/schedule-daily` - See market creation logs
   - `/api/cron/settle-markets` - See settlement logs

### What Success Looks Like

**schedule-daily response:**
```json
{
  "success": true,
  "created": 5,
  "failed": 0,
  "results": [...]
}
```

**settle-markets response:**
```json
{
  "success": true,
  "settled": 1,
  "pending": 4,
  "failed": 0,
  "results": [...]
}
```

---

## ⚠️ Important Notes

### Gas Requirements
Each wallet needs sufficient FLR:
- **Scheduler wallet:** ~0.01 FLR per batch × 96 batches = ~1 FLR minimum (recommend 5 FLR)
- **Settler wallet:** ~0.01 FLR per settlement × 480 settlements = ~5 FLR minimum (recommend 10 FLR)

### Weather API Limits
With 480 markets, you'll make:
- 480 forecast calls (during creation)
- 480 observation calls (during settlement)
- **Total:** ~960 weather API calls over 48 hours

Make sure your weather API provider can handle this volume!

### City Rotation
With 5 markets per batch and (assuming) 10 cities in rotation:
- Every 2 batches will cycle through all cities
- Each city will be used 48 times over 48 hours

### After Test Completion

**Don't forget to revert the cron schedules!**

```bash
# Edit vercel.json back to production:
{
  "crons": [
    {
      "path": "/api/cron/schedule-daily",
      "schedule": "0 6 * * *"  // Daily at 6 AM UTC
    },
    {
      "path": "/api/cron/settle-markets",
      "schedule": "0 0 * * *"  // Daily at midnight UTC
    }
  ]
}

git add vercel.json
git commit -m "revert: restore production cron schedules"
git push
```

---

## 🎯 Success Criteria

For the test to **PASS**, we need:

### Primary Metrics (Must Pass)
- ✅ 100% market creation success (480/480 markets created)
- ✅ 100% market settlement success (480/480 markets settled)
- ✅ 0 cron execution failures (HTTP 500s)
- ✅ All settlements within 10 minutes of resolve time
- ✅ All weather data fetches successful

### Secondary Metrics (Should Pass)
- ✅ City rotation working (no duplicate cities in same batch)
- ✅ Redis state persists correctly
- ✅ Transaction gas costs reasonable (<0.01 FLR per operation)
- ✅ No memory leaks or performance degradation

### Failure Conditions (Stop Test If)
- ❌ Any cron job returns 500 error consistently
- ❌ Contract revert errors
- ❌ Weather API completely unavailable
- ❌ Settlement stuck for >1 hour past resolve time

---

## 📞 Emergency Procedures

### If schedule-daily fails:
1. Check Vercel logs for error details
2. Verify scheduler wallet has FLR balance
3. Verify weather API is responding
4. Check environment variables are set correctly

### If settle-markets fails:
1. Check Vercel logs for error details
2. Verify settler wallet has FLR balance
3. Verify weather API is responding
4. Check if markets have actually reached resolve time

### If both fail:
1. Check Vercel deployment status
2. Verify `CRON_SECRET` matches
3. Check all environment variables
4. May need to redeploy

---

## 📚 Reference Documents

- **AUTOMATION_TEST_EXECUTION.md** - Fill this out at each checkpoint
- **DEPLOY_TEST_CONFIG.md** - Detailed deployment instructions
- **AUTOMATION_TEST_PLAN.md** - Original test plan
- **AUTOMATION_TEST_PROMPT.md** - Detailed monitoring instructions

---

## ✅ Pre-Deployment Checklist

Before you run `git push`:

- [x] `vercel.json` updated to `*/30 * * * *`
- [x] `.env` has `DAILY_MARKET_COUNT=5`
- [x] `.env` has `MARKET_SPACING_HOURS=0.5`
- [ ] Scheduler wallet has sufficient FLR (5+ FLR recommended)
- [ ] Settler wallet has sufficient FLR (10+ FLR recommended)
- [ ] Weather API keys are set in Vercel
- [ ] `CRON_SECRET` is set in Vercel
- [ ] All required environment variables exist in Vercel

---

## 🎬 Ready to Start!

Once you:
1. ✅ Push the changes to GitHub
2. ✅ Update Vercel environment variables
3. ✅ Verify deployment successful

The test will **automatically start** at the next 30-minute mark!

**Good luck! May your markets create and settle flawlessly! 🌤️📈**

