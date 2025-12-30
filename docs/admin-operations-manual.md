# Admin Operations Manual

## WeatherB Platform Administration Guide

### Overview

This manual provides comprehensive guidance for WeatherB administrators to manage the platform, handle city suggestions, monitor test windows, and interpret system reports.

### Admin Panel Access

**URL**: `https://weatherb.com/admin`

**Authentication**:
- Wallet-based authentication using your admin wallet
- Ensure your wallet address is in the ADMIN_WALLETS environment variable

### Managing City Suggestions

#### Viewing Suggestions

The admin panel displays suggestions in four tabs:

1. **Pending** - New suggestions awaiting review
2. **Testing** - Cities currently in 4-hour test windows
3. **Live** - Approved cities in production
4. **Rejected** - Denied suggestions

#### Approving a City

1. Review the suggestion details:
   - City name and coordinates
   - Suggested time window
   - User comments
   - Vote count

2. Click "Start Test" to begin automated testing:
   - System generates 3 test wallets
   - Creates 5 markets with staggered times
   - Places opposing bets automatically
   - Monitors for 4 hours

3. Wait for test results email (sent after 4 hours)

4. Review test results:
   - Market settlement accuracy
   - Payout verification
   - Gas costs
   - Temperature data

5. Click approve/deny link in email

#### Understanding Test Results

**Key Metrics in Test Results Email:**

- **Markets Created/Settled**: Should be 5/5 for success
- **Total Volume**: Amount of test FLR used
- **Payout Verification**: Must be ✓ for all markets
- **Gas Costs**: Net cost of running the test
- **Temperature Results**: Shows actual vs threshold for each market

**Decision Criteria:**

✅ **Approve if:**
- All 5 markets settled successfully
- Payouts verified correctly
- Weather data available and accurate
- Gas costs reasonable (<1 FLR)

❌ **Deny if:**
- Markets failed to settle
- Payout verification failed
- Weather data unavailable
- Excessive gas costs

### Weekly Reports

#### Understanding AI Insights

Weekly reports arrive every Monday at 9 AM UTC with:

1. **Platform Metrics**
   - Total markets created
   - Betting volume
   - Unique participants
   - Average volume per market

2. **AI Analysis**
   - Trend identification
   - Growth patterns
   - Actionable recommendations
   - Performance insights

3. **City Performance**
   - Top cities by volume
   - New approved cities
   - Market highlights

#### Interpreting Metrics

**Healthy Platform Indicators:**
- Steady or growing unique bettors
- Consistent market creation (35/week target)
- Payout ratio 95-99% (indicates balanced markets)
- Test success rate >80%

**Warning Signs:**
- Declining unique bettors
- Low market volume (<100 FLR average)
- Payout ratio <90% or >99%
- Test success rate <50%

### Troubleshooting Guide

#### Common Issues and Solutions

##### Test Window Not Starting

**Symptoms**: Click "Start Test" but nothing happens

**Solutions**:
1. Check browser console for errors
2. Verify admin wallet connected
3. Ensure SCHEDULER_PRIVATE_KEY has sufficient FLR
4. Check test monitor cron is running

##### Test Results Not Received

**Symptoms**: No email after 4+ hours

**Solutions**:
1. Check test run status in database
2. Verify ADMIN_EMAIL configured
3. Check Resend API logs
4. Manually finalize: `GET /api/admin/finalize-test?testRunId=xxx`

##### Markets Not Settling

**Symptoms**: Markets remain unsettled past resolve time

**Solutions**:
1. Check settler cron job running
2. Verify SETTLER_PRIVATE_KEY has gas
3. Check weather API availability
4. Manually trigger: `GET /api/cron/settle-markets`

##### Funds Not Recovered

**Symptoms**: Test wallets still have funds after test

**Solutions**:
1. Wait for 3-block confirmation
2. Check sweep transaction on explorer
3. Manually sweep using admin tools
4. Never delete TestRun until funds recovered

##### Magic Link Not Working

**Symptoms**: Click approve/deny link, see error

**Solutions**:
1. Check if link expired (48 hours)
2. Verify link not already used
3. Check database for MagicLink record
4. Generate new test results email if needed

### Manual Operations

#### Trigger Weekly Report Manually

```bash
curl -X GET https://weatherb.com/api/admin/test-weekly-report?sendEmail=true \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

#### Clean Up Expired Magic Links

```bash
curl -X POST https://weatherb.com/api/magic/cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Check Test Run Status

```bash
curl -X GET https://weatherb.com/api/admin/test-runs/active \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

### Best Practices

#### Daily Operations

- [ ] Check pending suggestions (morning)
- [ ] Monitor active test windows
- [ ] Review completed test results
- [ ] Approve/deny tested cities

#### Weekly Operations

- [ ] Review weekly AI report (Mondays)
- [ ] Analyze platform trends
- [ ] Plan city expansion based on data
- [ ] Clean up expired magic links

#### Monthly Operations

- [ ] Audit test success rates
- [ ] Review gas cost trends
- [ ] Analyze user engagement metrics
- [ ] Update city allowlist if needed

### Security Guidelines

1. **Never Share**:
   - Admin private keys
   - Magic link tokens
   - Test wallet keys
   - API credentials

2. **Always Verify**:
   - Test results before approval
   - Fund recovery before closing tests
   - Payout calculations
   - Weather data accuracy

3. **Monitor For**:
   - Unusual betting patterns
   - Failed test windows
   - High gas costs
   - API failures

### Emergency Procedures

#### Platform Pause

If critical issue detected:

1. Set `isPaused = true` in SystemConfig
2. Stop settler: `settlerPaused = true`
3. Investigate issue
4. Fix and test
5. Resume operations

#### Fund Recovery Emergency

If test funds stuck:

1. Locate TestRun record
2. Decrypt wallet keys (requires ENCRYPTION_KEY)
3. Import wallets to MetaMask
4. Manually transfer funds
5. Mark TestRun as recovered

#### Database Rollback

If data corruption:

1. Stop all cron jobs
2. Restore from backup
3. Verify data integrity
4. Resume operations
5. Re-run missed jobs

### Contact & Support

**Technical Issues**: Check logs in Vercel dashboard
**Database Issues**: PostgreSQL logs in Supabase
**Email Issues**: Resend dashboard
**Blockchain Issues**: Flare block explorer

### Appendix: Admin API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/suggestions` | GET | List all suggestions |
| `/api/admin/suggestions/approve` | POST | Start test window |
| `/api/admin/suggestions/deny` | POST | Reject suggestion |
| `/api/admin/test-runs/active` | GET | Active test windows |
| `/api/admin/test-weekly-report` | GET | Manual weekly report |
| `/api/magic/[token]` | GET | Execute magic link |
| `/api/magic/cleanup` | POST | Clean expired links |

### Monitoring Checklist

- [ ] Vercel Functions: All green
- [ ] Cron Jobs: Running on schedule
- [ ] Database: <80% capacity
- [ ] Email Delivery: >95% success
- [ ] Test Success: >80% rate
- [ ] Gas Costs: <1 FLR per test