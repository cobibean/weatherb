# WeatherB 48-Hour Automation Test - Execution Log

## Test Configuration

**Test Period:** 48 hours  
**Start Time:** [TO BE RECORDED]  
**End Time:** [TO BE RECORDED]

### Cron Schedules (Testing Mode)
- **schedule-daily**: Every 30 minutes (`*/30 * * * *`)
- **settle-markets**: Every 5 minutes (`*/5 * * * *`)

### Environment Variables
- `DAILY_MARKET_COUNT=5`
- `MARKET_SPACING_HOURS=0.5` (30 minutes)

### Expected Results
- **Total Batches:** 96 (48 hours × 2 per hour)
- **Total Markets:** 480 (96 batches × 5 markets)
- **Markets per batch resolve at:** T+30min, T+60min, T+90min, T+120min, T+150min

---

## Pre-Test Checklist

### ✅ Local Configuration
- [x] `vercel.json` updated to `*/30 * * * *` for schedule-daily
- [x] `DAILY_MARKET_COUNT=5` set in `.env`
- [x] `MARKET_SPACING_HOURS=0.5` set in `.env`

### ⏳ Vercel Production Environment
- [ ] Verify cron jobs are configured
- [ ] Verify environment variables are set:
  - [ ] `RPC_URL`
  - [ ] `NEXT_PUBLIC_CONTRACT_ADDRESS`
  - [ ] `SCHEDULER_PRIVATE_KEY`
  - [ ] `SETTLER_PRIVATE_KEY`
  - [ ] `CRON_SECRET`
  - [ ] `UPSTASH_REDIS_REST_URL`
  - [ ] `UPSTASH_REDIS_REST_TOKEN`
  - [ ] `DAILY_MARKET_COUNT=5`
  - [ ] `MARKET_SPACING_HOURS=0.5`

### ⏳ Baseline Contract State
- [ ] Current market count: _______
- [ ] Latest market ID: _______
- [ ] Scheduler wallet FLR balance: _______
- [ ] Settler wallet FLR balance: _______
- [ ] Redis city index: _______

---

## Checkpoint Schedule

| Hour | UTC Time | Checkpoint | Key Events |
|------|----------|------------|------------|
| 0 | [START] | ✅ START | First batch creation |
| 0.5 | [+30min] | 🔍 Verify | First market settles, second batch creates |
| 6 | [+6h] | 📊 Report | 12 batches, 60 markets created/settled |
| 12 | [+12h] | 📊 Report | 24 batches, 120 markets created/settled |
| 18 | [+18h] | 📊 Report | 36 batches, 180 markets created/settled |
| 24 | [+24h] | 📊 Report | 48 batches, 240 markets created/settled |
| 30 | [+30h] | 📊 Report | 60 batches, 300 markets created/settled |
| 36 | [+36h] | 📊 Report | 72 batches, 360 markets created/settled |
| 42 | [+42h] | 📊 Report | 84 batches, 420 markets created/settled |
| 48 | [END] | 🏁 FINAL | 96 batches, 480 markets created/settled |

---

## Test Execution Log

### Checkpoint 0 - Test Start
**UTC Time:** _______  
**Status:** ⏳ Pending

#### schedule-daily (First Batch)
- Execution time: _______
- HTTP Status: _______
- Markets created: _______
- Markets failed: _______
- Transaction hashes: _______
- Errors: _______

#### Contract State After First Batch
- Market count: _______
- Market IDs: _______
- Cities used: _______
- Resolve times: _______
- Thresholds: _______

---

### Checkpoint 0.5 - First Settlement (30 minutes)
**UTC Time:** _______  
**Status:** ⏳ Pending

#### settle-markets (First Settlement)
- Execution time: _______
- HTTP Status: _______
- Markets settled: _______
- Markets pending: _______
- Markets failed: _______
- Settlement delay: _______ seconds
- Temperature reading: _______
- Outcome: _______
- Transaction hash: _______
- Errors: _______

#### schedule-daily (Second Batch)
- Markets created: _______
- Cities rotated correctly: _______
- Errors: _______

---

### Checkpoint 6 - Hour 6
**UTC Time:** _______  
**Status:** ⏳ Pending

#### Summary Statistics
- Total batches created: _______ / 12 expected
- Total markets created: _______ / 60 expected
- Total markets settled: _______ / 60 expected
- Total markets pending: _______
- Total markets failed: _______
- Success rate: _______%

#### Performance Metrics
- Average settlement delay: _______ seconds
- Longest settlement delay: _______ seconds
- Weather API success rate: _______%
- Transaction success rate: _______%

#### Issues Encountered
_______

---

### Checkpoint 12 - Hour 12
**UTC Time:** _______  
**Status:** ⏳ Pending

#### Summary Statistics
- Total batches created: _______ / 24 expected
- Total markets created: _______ / 120 expected
- Total markets settled: _______ / 120 expected
- Total markets pending: _______
- Total markets failed: _______
- Success rate: _______%

#### Performance Metrics
- Average settlement delay: _______ seconds
- Longest settlement delay: _______ seconds
- Weather API success rate: _______%
- Transaction success rate: _______%

#### Issues Encountered
_______

---

### Checkpoint 18 - Hour 18
**UTC Time:** _______  
**Status:** ⏳ Pending

#### Summary Statistics
- Total batches created: _______ / 36 expected
- Total markets created: _______ / 180 expected
- Total markets settled: _______ / 180 expected
- Total markets pending: _______
- Total markets failed: _______
- Success rate: _______%

#### Performance Metrics
- Average settlement delay: _______ seconds
- Longest settlement delay: _______ seconds
- Weather API success rate: _______%
- Transaction success rate: _______%

#### Issues Encountered
_______

---

### Checkpoint 24 - Hour 24
**UTC Time:** _______  
**Status:** ⏳ Pending

#### Summary Statistics
- Total batches created: _______ / 48 expected
- Total markets created: _______ / 240 expected
- Total markets settled: _______ / 240 expected
- Total markets pending: _______
- Total markets failed: _______
- Success rate: _______%

#### Performance Metrics
- Average settlement delay: _______ seconds
- Longest settlement delay: _______ seconds
- Weather API success rate: _______%
- Transaction success rate: _______%

#### Issues Encountered
_______

---

### Checkpoint 30 - Hour 30
**UTC Time:** _______  
**Status:** ⏳ Pending

#### Summary Statistics
- Total batches created: _______ / 60 expected
- Total markets created: _______ / 300 expected
- Total markets settled: _______ / 300 expected
- Total markets pending: _______
- Total markets failed: _______
- Success rate: _______%

#### Performance Metrics
- Average settlement delay: _______ seconds
- Longest settlement delay: _______ seconds
- Weather API success rate: _______%
- Transaction success rate: _______%

#### Issues Encountered
_______

---

### Checkpoint 36 - Hour 36
**UTC Time:** _______  
**Status:** ⏳ Pending

#### Summary Statistics
- Total batches created: _______ / 72 expected
- Total markets created: _______ / 360 expected
- Total markets settled: _______ / 360 expected
- Total markets pending: _______
- Total markets failed: _______
- Success rate: _______%

#### Performance Metrics
- Average settlement delay: _______ seconds
- Longest settlement delay: _______ seconds
- Weather API success rate: _______%
- Transaction success rate: _______%

#### Issues Encountered
_______

---

### Checkpoint 42 - Hour 42
**UTC Time:** _______  
**Status:** ⏳ Pending

#### Summary Statistics
- Total batches created: _______ / 84 expected
- Total markets created: _______ / 420 expected
- Total markets settled: _______ / 420 expected
- Total markets pending: _______
- Total markets failed: _______
- Success rate: _______%

#### Performance Metrics
- Average settlement delay: _______ seconds
- Longest settlement delay: _______ seconds
- Weather API success rate: _______%
- Transaction success rate: _______%

#### Issues Encountered
_______

---

### Checkpoint 48 - Final Report
**UTC Time:** _______  
**Status:** ⏳ Pending

#### Final Summary Statistics
- Total batches created: _______ / 96 expected
- Total markets created: _______ / 480 expected
- Total markets settled: _______ / 480 expected
- Total markets cancelled: _______
- Total markets still pending: _______
- Overall success rate: _______%

#### Final Performance Metrics
- Average settlement delay: _______ seconds
- Longest settlement delay: _______ seconds (Market ID: _______)
- Weather API success rate: _______%
- Transaction success rate: _______%
- Total gas used: _______ FLR
- Average gas per operation: _______ FLR

#### Contract State Verification
- Starting market count: _______
- Ending market count: _______
- Expected increase: 480
- Actual increase: _______
- Match: ✅ / ❌

#### City Rotation Verification
- Total unique cities used: _______
- Cities used (in order): _______
- Rotation working correctly: ✅ / ❌

#### Issues Log
_______

---

## Final Recommendation

**Status:** ⏳ Pending

Choose one:
- ✅ **PRODUCTION READY** - All systems working as expected
- ⚠️ **PRODUCTION READY WITH CAVEATS** - Minor issues observed: _______
- ❌ **NOT PRODUCTION READY** - Critical issues: _______

**Detailed Analysis:**
_______

**Recommended Actions:**
_______

---

## Notes

### How to Deploy Changes to Vercel

1. **Commit and push changes:**
```bash
git add vercel.json
git commit -m "test: configure cron for 48-hour automation test"
git push
```

2. **Vercel will auto-deploy** (if connected to GitHub)

3. **Verify deployment:**
   - Check Vercel dashboard for successful deployment
   - Verify cron jobs are updated in Vercel settings

4. **Update environment variables in Vercel:**
   - Go to Vercel dashboard → Project → Settings → Environment Variables
   - Add/update: `DAILY_MARKET_COUNT=5`
   - Add/update: `MARKET_SPACING_HOURS=0.5`
   - Redeploy if needed

### How to Monitor During Test

**Via Vercel Dashboard:**
1. Go to Deployments → Select production deployment
2. Click "Functions" tab
3. Filter by `/api/cron/schedule-daily` or `/api/cron/settle-markets`
4. View logs for each execution

**Via Flare Block Explorer:**
1. Go to https://flare-explorer.flare.network/
2. Search for contract address: `NEXT_PUBLIC_CONTRACT_ADDRESS`
3. View recent transactions
4. Verify `createMarket` and `resolveMarket` calls

**Via Contract Reads:**
1. Use admin panel or block explorer
2. Call `getMarketCount()` to see total markets
3. Call `getMarket(id)` to inspect individual markets

### Emergency Procedures

**If schedule-daily fails:**
1. Check Vercel logs for error details
2. Verify scheduler wallet has FLR balance
3. Verify weather API is responding
4. May need to manually create markets via admin panel

**If settle-markets fails:**
1. Check Vercel logs for error details
2. Verify settler wallet has FLR balance
3. Verify weather API is responding
4. May need to manually settle via admin panel

**If both fail:**
1. Check Vercel deployment status
2. Verify CRON_SECRET matches
3. Check environment variables
4. May need to redeploy

---

## Test Start Instructions

1. ✅ Commit and push `vercel.json` changes
2. ✅ Deploy to Vercel production
3. ✅ Update environment variables in Vercel
4. ✅ Record baseline contract state
5. ✅ Note test start time (when first batch creates)
6. ✅ Begin monitoring every 6 hours
7. ✅ Report findings at each checkpoint
8. ✅ Generate final report at hour 48

**Test is ready to begin once deployed to Vercel!** 🚀

