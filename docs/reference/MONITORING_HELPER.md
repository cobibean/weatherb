# Monitoring Helper - Data Collection Guide

This guide helps you collect and record data at each checkpoint.

---

## Quick Data Collection Commands

### Check Contract State (via Flare Explorer)

**Contract Address:** Get from `.env` → `NEXT_PUBLIC_CONTRACT_ADDRESS`

**URL:** `https://flare-explorer.flare.network/address/[CONTRACT_ADDRESS]`

**What to record:**
1. Click "Read Contract" tab
2. Find `getMarketCount()` → Record total markets
3. Find `getMarket(uint256 marketId)` → Check individual markets

### Check Wallet Balances

**Scheduler wallet:** Get address from private key or check recent transactions  
**Settler wallet:** Get address from private key or check recent transactions

**URL:** `https://flare-explorer.flare.network/address/[WALLET_ADDRESS]`

**What to record:**
- Current FLR balance
- Recent transaction count

---

## Checkpoint Data Template

Copy this template for each checkpoint:

```markdown
### Checkpoint [Hour X] - [UTC Time]

#### schedule-daily Status
- Last execution: [timestamp from Vercel logs]
- HTTP Status: [200/500]
- Markets created: [number]
- Markets failed: [number]
- Cities used: [list]
- Transaction hashes: [list]
- Errors: [any errors or "None"]

#### settle-markets Status
- Last execution: [timestamp from Vercel logs]
- HTTP Status: [200/500]
- Markets settled: [number]
- Markets pending: [number]
- Markets failed: [number]
- Average settlement delay: [seconds]
- Transaction hashes: [list]
- Errors: [any errors or "None"]

#### Contract State
- Total market count: [number]
- Expected market count: [baseline + (batches × 5)]
- Match: ✅ / ❌

#### Performance Metrics
- Scheduler wallet FLR: [balance]
- Settler wallet FLR: [balance]
- Gas used this checkpoint: [estimate]

#### Issues
[List any issues or "None"]
```

---

## Vercel Log Analysis

### Finding Logs in Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select WeatherB project
3. Click **Deployments** → Select production deployment
4. Click **Functions** tab
5. Use filters:
   - Route: `/api/cron/schedule-daily` or `/api/cron/settle-markets`
   - Time range: Last 6 hours (for checkpoint)

### Interpreting schedule-daily Logs

**Look for:**
```json
{
  "success": true,
  "created": 5,
  "failed": 0,
  "results": [
    {
      "marketId": "123",
      "cityId": "nyc",
      "cityName": "New York City",
      "transactionHash": "0x...",
      "thresholdTenths": 750,
      "forecastTempTenths": 753
    }
  ],
  "timestamp": "2024-12-23T10:00:00.000Z"
}
```

**Red flags:**
- `"success": false`
- `"failed": > 0`
- `"errors": [...]` present
- HTTP status 500

### Interpreting settle-markets Logs

**Look for:**
```json
{
  "success": true,
  "settled": 1,
  "pending": 4,
  "failed": 0,
  "results": [
    {
      "marketId": "123",
      "cityName": "New York City",
      "transactionHash": "0x...",
      "tempTenths": 753,
      "observedTimestamp": 1703332800
    }
  ],
  "timestamp": "2024-12-23T10:30:00.000Z"
}
```

**Red flags:**
- `"success": false`
- `"failed": > 0`
- `"errors": [...]` present
- Settlement delay > 10 minutes
- HTTP status 500

---

## Calculating Metrics

### Settlement Delay

```
Settlement Delay = Settlement Time - Resolve Time

Example:
- Market resolve time: 10:30:00 UTC
- Settlement logged at: 10:32:15 UTC
- Delay: 2 minutes 15 seconds ✅ (< 10 min)
```

### Success Rate

```
Success Rate = (Successful Operations / Total Operations) × 100

Example at Hour 6:
- Expected batches: 12
- Successful batches: 12
- Success rate: (12/12) × 100 = 100% ✅
```

### Gas Usage Estimate

```
Gas per operation ≈ 0.01 FLR (estimate)

Example at Hour 6:
- Markets created: 60 (60 × 0.01 = 0.6 FLR)
- Markets settled: 60 (60 × 0.01 = 0.6 FLR)
- Total gas used: ~1.2 FLR
```

### City Rotation Check

With 8 cities and 5 markets per batch:

```
Expected pattern:
Batch 1: Cities 0-4 (NYC, LA, Chicago, Miami, Seattle)
Batch 2: Cities 5-7, 0-1 (Denver, Phoenix, Austin, NYC, LA)
Batch 3: Cities 2-6 (Chicago, Miami, Seattle, Denver, Phoenix)
...

Each city should appear every 1.6 batches (8 cities ÷ 5 markets)
```

**Verification:**
- No city should appear twice in the same batch ✅
- All 8 cities should be used equally over time ✅

---

## Quick Health Checks

### Every 30 Minutes (Optional - for active monitoring)

1. **Check latest schedule-daily execution:**
   - Did it run on time (at :00 or :30)?
   - Did it create 5 markets?
   - Any errors?

2. **Check latest settle-markets execution:**
   - Is it running every 5 minutes?
   - Are markets being settled?
   - Any errors?

### Every 6 Hours (Required - checkpoint)

1. **Aggregate statistics:**
   - Count total batches created
   - Count total markets created
   - Count total markets settled
   - Calculate success rates

2. **Check for issues:**
   - Any repeated errors?
   - Any stuck markets?
   - Wallet balances sufficient?

3. **Record in AUTOMATION_TEST_EXECUTION.md**

---

## Common Issues and Solutions

### Issue: Markets Not Creating

**Symptoms:**
- `schedule-daily` returns 500 error
- `"created": 0` in logs
- Contract revert errors

**Check:**
1. Scheduler wallet FLR balance
2. Weather API responding (check logs for API errors)
3. Contract address correct in Vercel env vars
4. RPC_URL working

**Solution:**
- Add FLR to scheduler wallet
- Check weather API status
- Verify environment variables
- Try different RPC endpoint if needed

### Issue: Markets Not Settling

**Symptoms:**
- `settle-markets` returns 500 error
- `"settled": 0` but markets past resolve time
- Weather API errors

**Check:**
1. Settler wallet FLR balance
2. Markets actually past resolve time (check contract)
3. Weather API responding
4. Contract address correct

**Solution:**
- Add FLR to settler wallet
- Wait for resolve time to pass
- Check weather API status
- Verify environment variables

### Issue: City Rotation Not Working

**Symptoms:**
- Same cities appearing in consecutive batches
- Some cities never used

**Check:**
1. Redis connection (UPSTASH_REDIS_REST_URL)
2. Redis key `weatherb:city:index` value
3. Logs show city index incrementing

**Solution:**
- Verify Upstash Redis credentials
- Check Redis dashboard for key value
- May need to manually reset index if stuck

### Issue: Settlement Delays > 10 Minutes

**Symptoms:**
- Markets settling 15+ minutes after resolve time
- Weather API slow response times

**Check:**
1. Weather API response times in logs
2. Network latency to weather API
3. Cron execution frequency (should be every 5 min)

**Solution:**
- Check weather API status page
- Consider fallback weather provider
- Verify cron schedule in Vercel

---

## Data Recording Shortcuts

### Spreadsheet Template

Create a simple spreadsheet to track:

| Hour | UTC Time | Batches | Markets Created | Markets Settled | Errors | Notes |
|------|----------|---------|-----------------|-----------------|--------|-------|
| 0 | | 1 | 5 | 0 | 0 | Test start |
| 0.5 | | 2 | 10 | 1 | 0 | First settlement |
| 6 | | 12 | 60 | 60 | 0 | All good |
| ... | | | | | | |

### Quick Calculation Formulas

```
Expected batches at hour H = H × 2
Expected markets at hour H = H × 2 × 5 = H × 10
Expected settled at hour H = (H × 2 × 5) - 5 = (H × 10) - 5

Example at Hour 12:
- Expected batches: 12 × 2 = 24
- Expected markets: 12 × 10 = 120
- Expected settled: (12 × 10) - 5 = 115 (last 5 still pending)
```

---

## Final Report Checklist

At Hour 48, make sure you have:

- [ ] Total batches created (should be 96)
- [ ] Total markets created (should be 480)
- [ ] Total markets settled (should be 480)
- [ ] Total errors encountered
- [ ] Average settlement delay
- [ ] Longest settlement delay
- [ ] Weather API success rate
- [ ] Transaction success rate
- [ ] Total gas used
- [ ] City rotation verification
- [ ] Final wallet balances
- [ ] Recommendation (production ready?)

---

## Need Help?

If you're stuck or see unexpected behavior:

1. **Check Vercel logs** for detailed error messages
2. **Check Flare Explorer** for on-chain state
3. **Check weather API status** if seeing API errors
4. **Check wallet balances** if seeing transaction errors
5. **Refer to DEPLOY_TEST_CONFIG.md** for troubleshooting steps

---

## Pro Tips

1. **Set reminders** for each 6-hour checkpoint
2. **Take screenshots** of Vercel logs at each checkpoint
3. **Keep a running notes doc** for any anomalies
4. **Check wallet balances** at each checkpoint to ensure sufficient FLR
5. **Export Vercel logs** if possible for post-test analysis

---

Good luck with monitoring! 📊🔍

