# Email Approval Flow Test

**Purpose**: Validate the complete city approval workflow using magic links after setting up your domain and Resend.

**Duration**: ~4-5 hours (includes 4-hour test window)

---

## Prerequisites

- [ ] Custom domain configured in Resend
- [ ] `RESEND_API_KEY` set in `.env`
- [ ] `EMAIL_FROM` configured (e.g., `WeatherB <noreply@yourdomain.com>`)
- [ ] `ADMIN_EMAIL` set to your email address
- [ ] `NEXT_PUBLIC_APP_URL` set to your production URL
- [ ] Admin wallet configured and has test FLR
- [ ] App deployed to production

---

## Test Steps

### 1. Create a Test Suggestion

**Via UI** (`/voting` page):
1. Connect your wallet
2. Click "Suggest a City"
3. Fill in:
   - City: `Denver, CO`
   - Time: `12:00 PM - 2:00 PM`
   - Comment: `Testing email approval flow`
4. Submit

**Expected**: Suggestion appears in "Pending" tab in admin panel

---

### 2. Start Test Window

**Admin Panel** (`/admin`):
1. Navigate to "Suggestions" → "Pending" tab
2. Find your Denver suggestion
3. Click "Start Test" button
4. Confirm the action

**Expected**:
- Status changes to "TESTING"
- 5 test markets created on-chain
- Test bets placed automatically
- Suggestion moves to "Testing" tab

**Verify**:
```bash
# Check database
psql $DATABASE_URL -c "SELECT id, status, customCityName FROM \"Suggestion\" WHERE customCityName = 'Denver, CO';"

# Check test run
psql $DATABASE_URL -c "SELECT id, status, marketsCreated FROM \"TestRun\" ORDER BY createdAt DESC LIMIT 1;"
```

---

### 3. Monitor Test Progress (Optional)

**Watch Live Updates** (`/admin/test-monitor`):
- View real-time market creation
- See bet placements
- Monitor settlement progress

**Check Logs**:
```bash
# View Vercel function logs
vercel logs --follow

# Or check specific cron
vercel logs --follow api/cron/settle-markets
```

---

### 4. Wait for Test Results Email

**Timeline**:
- Test starts: T+0
- Markets settle: T+30 min to T+150 min (staggered)
- Monitoring ends: T+240 min (4 hours)
- Email sent: T+240 min

**What to Expect**:
- Subject: `WeatherB Test Results: Denver, CO`
- From: Your configured `EMAIL_FROM`
- To: Your `ADMIN_EMAIL`

**Email Contents**:
1. **Summary Section**:
   - City name and coordinates
   - Test duration
   - Success/failure status

2. **Metrics Section**:
   - Markets Created: `5`
   - Markets Settled: `5` (should match)
   - Total Volume: `~30 FLR`
   - Payout Verified: `✓`
   - Net Gas Cost: `<1 FLR`

3. **Temperature Results**:
   - 5 markets with times, thresholds, actual temps
   - Outcome (YES/NO) for each

4. **Action Buttons**:
   - 🟢 **Approve City** (green button)
   - 🔴 **Deny City** (red button)

---

### 5. Test Magic Link - Approve Flow

**Click**: Green "Approve City" button in email

**Expected**:
1. Browser opens to: `https://yourdomain.com/api/magic/[long-token]`
2. Redirects to: `https://yourdomain.com/magic?status=success&action=approve&city=Denver,%20CO`
3. Success page displays:
   - ✅ "City Approved Successfully"
   - City name: "Denver, CO"
   - Status updated message

**Verify**:
```bash
# Check suggestion status changed to APPROVED
psql $DATABASE_URL -c "SELECT status, customCityName FROM \"Suggestion\" WHERE customCityName = 'Denver, CO';"

# Check magic link was used
psql $DATABASE_URL -c "SELECT used, usedAt, action FROM \"MagicLink\" ORDER BY createdAt DESC LIMIT 1;"
```

**Database Verification**:
- Suggestion status: `APPROVED`
- MagicLink used: `true`
- MagicLink action: `approve`

---

### 6. Test Magic Link - Security Checks

**Test 1: Try clicking link again**
- Click the same approve link
- **Expected**: Error page
  - Status: `error`
  - Message: `This link has already been used`

**Test 2: Try clicking deny link**
- Click the red "Deny City" button
- **Expected**: Error page
  - Status: `error`
  - Message: `This link has already been used` (suggestion already approved)

**Test 3: Verify 48-hour expiry (optional - takes 2 days)**
- Save a magic link
- Wait 48+ hours
- Click link
- **Expected**: `This link has expired`

---

### 7. Test Deny Flow (New Suggestion)

**Create Another Suggestion**:
1. Submit a new suggestion: `Phoenix, AZ`
2. Start test window
3. Wait for email (~4 hours)
4. Click **red "Deny City"** button

**Expected**:
- Redirect to: `/magic?status=success&action=deny&city=Phoenix,%20AZ`
- Success page: "City Denied"
- Suggestion status: `REJECTED`
- Appears in "Rejected" tab in admin panel

---

### 8. Verify Fund Recovery

**Check Test Wallets**:
```bash
# Query test run
psql $DATABASE_URL -c "
SELECT
  id,
  status,
  fundingAmount,
  recoveredAmount,
  netCost
FROM \"TestRun\"
WHERE status = 'COMPLETED'
ORDER BY createdAt DESC
LIMIT 1;
"
```

**Expected**:
- `fundingAmount`: `36.0` (2 wallets × 18 FLR)
- `recoveredAmount`: `~35.0 - 35.9` (minus gas)
- `netCost`: `<1.0 FLR`
- Wallet keys still encrypted in database (never deleted)

**Security Check**:
- Test wallets should have ~0 balance (swept back to admin)
- Check on Flare explorer: `https://flare-explorer.flare.network/address/[test-wallet-address]`

---

## Success Criteria

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Email received | Within 4-5 hours of starting test | ⬜ |
| Email formatting | Clean, professional, readable | ⬜ |
| Magic links work | Both approve/deny accessible | ⬜ |
| Approve updates DB | Status → APPROVED | ⬜ |
| Deny updates DB | Status → REJECTED | ⬜ |
| One-time use enforced | Second click fails | ⬜ |
| Funds recovered | >97% of test FLR returned | ⬜ |
| Markets settled | All 5 settled correctly | ⬜ |
| Payout verified | ✓ in email | ⬜ |

---

## Troubleshooting

### Email Not Received

1. **Check Resend Dashboard**:
   - Visit: https://resend.com/emails
   - Look for recent sends
   - Check delivery status

2. **Check Environment Variables**:
   ```bash
   # Verify config
   echo $RESEND_API_KEY  # Should be set
   echo $EMAIL_FROM       # Should match Resend domain
   echo $ADMIN_EMAIL      # Should be your email
   ```

3. **Check Spam Folder**:
   - Sometimes first emails land in spam
   - Mark as "Not Spam" for future emails

4. **Check Application Logs**:
   ```bash
   vercel logs --filter "[Email]"
   ```

### Magic Link Doesn't Work

1. **Check URL Format**:
   - Should be: `https://yourdomain.com/api/magic/[64-char-hex-token]`
   - Not localhost

2. **Check Database**:
   ```bash
   # Find magic links
   psql $DATABASE_URL -c "SELECT tokenHash, used, expiresAt FROM \"MagicLink\" ORDER BY createdAt DESC LIMIT 5;"
   ```

3. **Check NEXT_PUBLIC_APP_URL**:
   - Must match your production domain
   - No trailing slash

### Test Markets Not Settling

1. **Check Settler Cron**:
   - Visit Vercel dashboard → Cron Jobs
   - Verify `settle-markets` running every 5 min

2. **Check Weather API**:
   ```bash
   curl "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=39.7392&lon=-104.9903" \
     -H "User-Agent: WeatherB/1.0 (your-email@example.com)"
   ```

3. **Check Settler Wallet**:
   - Must have sufficient FLR for gas
   - Check balance on Flare explorer

---

## Cleanup

After successful testing:

```bash
# Optional: Clean up test suggestions
psql $DATABASE_URL -c "DELETE FROM \"Suggestion\" WHERE customCityName IN ('Denver, CO', 'Phoenix, AZ');"

# Clean up expired magic links
curl -X POST https://yourdomain.com/api/magic/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Notes

- **Production vs Development**: This test should be run in **production** to validate real domain and email delivery
- **Timing**: The 4-hour wait is intentional to ensure markets settle properly
- **Costs**: Each test costs ~0.5-1 FLR in gas (recovered automatically)
- **Magic Links**: Valid for 48 hours, one-time use only
- **Security**: Never share magic link tokens - they grant admin approval powers

---

## Next Steps

After successful test:

1. ✅ Email delivery confirmed
2. ✅ Magic links working
3. ✅ Fund recovery verified
4. ✅ Ready for production use

You can now:
- Handle real user suggestions
- Monitor weekly reports (coming in Epic 8 part 2)
- Scale to more cities with confidence
