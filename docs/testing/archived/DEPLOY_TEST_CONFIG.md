# Deploy Test Configuration to Vercel

## Quick Start

Follow these steps to deploy the test configuration and start the 48-hour automation test.

---

## Step 1: Commit and Push Changes

```bash
cd /Users/cobibean/DEV/weatherb

# Stage the changes
git add vercel.json .env

# Commit
git commit -m "test: configure cron for 48-hour automation test (every 30 min)"

# Push to trigger Vercel deployment
git push
```

**Note:** `.env` is gitignored, so only `vercel.json` will be committed.

---

## Step 2: Update Vercel Environment Variables

Go to your Vercel dashboard and update these environment variables:

### Required Variables to Add/Update

1. **DAILY_MARKET_COUNT**
   - Value: `5`
   - Environment: Production

2. **MARKET_SPACING_HOURS**
   - Value: `0.5`
   - Environment: Production

### Verify These Exist (Don't Change)

- ✅ `RPC_URL`
- ✅ `NEXT_PUBLIC_CONTRACT_ADDRESS`
- ✅ `SCHEDULER_PRIVATE_KEY`
- ✅ `SETTLER_PRIVATE_KEY`
- ✅ `CRON_SECRET`
- ✅ `UPSTASH_REDIS_REST_URL`
- ✅ `UPSTASH_REDIS_REST_TOKEN`

### How to Update in Vercel

1. Go to: https://vercel.com/dashboard
2. Select your WeatherB project
3. Go to: **Settings** → **Environment Variables**
4. Add/update the two variables above
5. Click **Save**
6. **Redeploy** the production deployment (if prompted)

---

## Step 3: Verify Deployment

### Check Vercel Dashboard

1. Go to **Deployments** tab
2. Wait for latest deployment to complete (green checkmark)
3. Click on the deployment
4. Go to **Settings** → **Cron Jobs** (or check project settings)
5. Verify you see:
   ```
   /api/cron/schedule-daily - */30 * * * *
   /api/cron/settle-markets - */5 * * * *
   ```

### Check Cron Job Status

1. In Vercel dashboard, go to **Cron Jobs** (if available)
2. Or go to **Functions** → Filter by cron routes
3. Verify both cron jobs are enabled and scheduled

---

## Step 4: Record Baseline State

Before the test starts, record the current state:

### Contract State

Use Flare block explorer or admin panel to get:

```bash
# Contract address from your .env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...

# Visit: https://flare-explorer.flare.network/address/[CONTRACT_ADDRESS]

# Record:
- Current market count: _______
- Latest market ID: _______
- Last transaction timestamp: _______
```

### Wallet Balances

Check FLR balances for:

```bash
# Scheduler wallet (creates markets)
SCHEDULER_ADDRESS: _______ FLR

# Settler wallet (settles markets)
SETTLER_ADDRESS: _______ FLR
```

**Recommended minimum:** 10 FLR each for 48-hour test

### Redis State

If you have access to Upstash dashboard:

```bash
# Key: weatherb:city:index
# Current value: _______
```

---

## Step 5: Start Test Monitoring

### When Does Test Start?

The test starts automatically at the next 30-minute mark (e.g., 10:00, 10:30, 11:00, etc.) when `schedule-daily` runs.

**To find the exact start time:**

1. Check current UTC time: https://time.is/UTC
2. Next 30-minute mark is your test start time
3. Record this in `AUTOMATION_TEST_EXECUTION.md`

### First Checkpoint (30 minutes after start)

At T+30 minutes:
1. Check Vercel logs for `/api/cron/schedule-daily`
2. Verify 5 markets were created
3. Check Vercel logs for `/api/cron/settle-markets`
4. Verify first market was settled

### Monitoring Schedule

Check every 6 hours:
- Hour 0 (start)
- Hour 6
- Hour 12
- Hour 18
- Hour 24
- Hour 30
- Hour 36
- Hour 42
- Hour 48 (end)

---

## Step 6: How to Check Logs

### Via Vercel Dashboard

1. Go to your project in Vercel
2. Click **Deployments** → Select production deployment
3. Click **Functions** tab
4. Filter by route:
   - `/api/cron/schedule-daily`
   - `/api/cron/settle-markets`
5. Click on individual executions to see logs

### Via Vercel CLI (Optional)

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login
vercel login

# View logs
vercel logs [deployment-url] --follow
```

### What to Look For in Logs

**schedule-daily logs:**
```json
{
  "success": true,
  "created": 5,
  "failed": 0,
  "results": [
    {
      "marketId": "123",
      "cityName": "New York",
      "transactionHash": "0x...",
      "thresholdTenths": 750
    }
  ]
}
```

**settle-markets logs:**
```json
{
  "success": true,
  "settled": 1,
  "pending": 4,
  "failed": 0,
  "results": [
    {
      "marketId": "123",
      "cityName": "New York",
      "tempTenths": 753,
      "transactionHash": "0x..."
    }
  ]
}
```

---

## Step 7: Record Data at Each Checkpoint

Update `AUTOMATION_TEST_EXECUTION.md` with:

1. **Timestamp** - UTC time of checkpoint
2. **Markets created** - Total count from logs
3. **Markets settled** - Total count from logs
4. **Errors** - Any errors encountered
5. **Performance** - Settlement delays, gas costs

---

## Step 8: After 48 Hours

1. **Stop the test** by reverting cron schedules:

```bash
# Edit vercel.json back to production settings:
{
  "crons": [
    {
      "path": "/api/cron/schedule-daily",
      "schedule": "0 6 * * *"  // Back to daily at 6 AM UTC
    },
    {
      "path": "/api/cron/settle-markets",
      "schedule": "0 0 * * *"  // Back to daily at midnight UTC (23h 55m before next creation)
    }
  ]
}

# Commit and push
git add vercel.json
git commit -m "revert: restore production cron schedules"
git push
```

2. **Update Vercel environment variables:**
   - Remove or comment out `MARKET_SPACING_HOURS` (use default)
   - Keep `DAILY_MARKET_COUNT=5` (or adjust for production)

3. **Generate final report** in `AUTOMATION_TEST_EXECUTION.md`

4. **Make recommendation:** Production ready? Issues to fix?

---

## Troubleshooting

### Cron Jobs Not Running

**Check:**
- Vercel deployment successful?
- Cron jobs enabled in Vercel settings?
- `CRON_SECRET` matches between Vercel and cron route?

**Fix:**
- Redeploy from Vercel dashboard
- Check Vercel logs for errors
- Verify environment variables

### Markets Not Creating

**Check:**
- Scheduler wallet has FLR balance?
- `RPC_URL` is correct?
- `NEXT_PUBLIC_CONTRACT_ADDRESS` is correct?
- Weather API responding?

**Fix:**
- Add FLR to scheduler wallet
- Check Vercel logs for specific error
- Test weather API manually

### Markets Not Settling

**Check:**
- Settler wallet has FLR balance?
- Markets have reached resolve time?
- Weather API responding?

**Fix:**
- Add FLR to settler wallet
- Wait for resolve time to pass
- Check Vercel logs for specific error

---

## Quick Reference

### Vercel Dashboard URLs

- Project: https://vercel.com/[your-team]/[weatherb]
- Deployments: https://vercel.com/[your-team]/[weatherb]/deployments
- Settings: https://vercel.com/[your-team]/[weatherb]/settings
- Env Vars: https://vercel.com/[your-team]/[weatherb]/settings/environment-variables

### Flare Explorer

- Contract: https://flare-explorer.flare.network/address/[CONTRACT_ADDRESS]
- Scheduler wallet: https://flare-explorer.flare.network/address/[SCHEDULER_ADDRESS]
- Settler wallet: https://flare-explorer.flare.network/address/[SETTLER_ADDRESS]

### Test Files

- Execution log: `AUTOMATION_TEST_EXECUTION.md`
- Test plan: `AUTOMATION_TEST_PLAN.md`
- Test prompt: `AUTOMATION_TEST_PROMPT.md`

---

## Ready to Deploy? ✅

- [ ] Committed `vercel.json` changes
- [ ] Pushed to GitHub
- [ ] Updated Vercel environment variables
- [ ] Verified deployment successful
- [ ] Recorded baseline state
- [ ] Noted test start time
- [ ] Ready to monitor!

**Once all checked, the test will start automatically at the next 30-minute mark!** 🚀

