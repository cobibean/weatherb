# Google Sheets Integration - Review & Deployment Prompt

## Task Overview

Review the Google Sheets market accuracy tracking integration, verify it's properly wired up, test it, update Vercel environment variables, and deploy to production.

## Context

A Google Sheets integration was added to track market settlement accuracy. When markets are settled, the system logs:
- Market details (ID, city, threshold)
- Primary provider temperature (used for resolution)
- Alternative provider temperatures (NWS, Open-Meteo, MET Norway)
- Outcome and volume data

## Step 1: Code Review

Review the following files to ensure everything is properly implemented:

1. **`apps/web/src/lib/google-sheets.ts`**
   - Verify `GoogleSheetsClient` class exists
   - Check that it handles base64-encoded credentials
   - Verify `initializeSheet()` creates headers correctly
   - Verify `appendRow()` formats data correctly
   - Check error handling (non-blocking)

2. **`apps/web/src/lib/weather-comparison.ts`**
   - Verify `fetchAllProviderReadings()` function exists
   - Check it fetches from NWS, Open-Meteo, and MET Norway
   - Verify error handling for failed providers

3. **`apps/web/src/app/api/cron/settle-markets/route.ts`**
   - Verify Google Sheets client is imported
   - Check that `createGoogleSheetsClient()` is called
   - Verify comparison temperatures are fetched after settlement
   - Check that `sheetsClient.appendRow()` is called with correct data structure
   - Verify error handling doesn't block settlement

4. **`apps/web/package.json`**
   - Verify `googleapis` package is installed

5. **`docs/google-sheets-integration.md`**
   - Verify documentation exists and is complete

## Step 2: Verify Environment Variables

Check that environment variables are documented:
- `GOOGLE_SHEETS_SERVICE_ACCOUNT` - Base64-encoded service account JSON
- `GOOGLE_SHEETS_SPREADSHEET_ID` - Google Sheet ID

## Step 3: Test Headers Creation

Create a test script to verify headers are created correctly:

**File**: `apps/web/scripts/test-google-sheets-headers.ts`

```typescript
import { createGoogleSheetsClient } from '../src/lib/google-sheets';

async function testHeaders() {
  const client = createGoogleSheetsClient();
  
  if (!client) {
    console.error('Google Sheets client not available. Check environment variables.');
    process.exit(1);
  }

  try {
    console.log('Testing header creation...');
    await client.initializeSheet();
    console.log('✅ Headers created successfully!');
  } catch (error) {
    console.error('❌ Failed to create headers:', error);
    process.exit(1);
  }
}

testHeaders();
```

Run the test:
```bash
cd apps/web
pnpm tsx scripts/test-google-sheets-headers.ts
```

**Expected Result**: Headers should be created in the spreadsheet:
- Market ID
- City
- Threshold
- Resolved Temp
- Primary Temp
- Alt Temp 1
- Alt Temp 2
- Alt Temp 3
- Time
- Volume

## Step 4: Verify Spreadsheet Access

1. Open the Google Sheet (get URL from secure credential store)
2. Verify the service account email has Editor access
3. If not shared, share the sheet with the service account email address

## Step 5: Update Vercel Environment Variables

Use Vercel CLI to set environment variables:

```bash
# Set service account credentials (base64-encoded)
vercel env add GOOGLE_SHEETS_SERVICE_ACCOUNT production

# When prompted, paste your base64-encoded service account JSON
# (Get this from the secure credential store or generate from Google Cloud Console)

# Set spreadsheet ID
vercel env add GOOGLE_SHEETS_SPREADSHEET_ID production
# When prompted, enter the spreadsheet ID from the Google Sheet URL

# Also set for preview environment (optional but recommended)
vercel env add GOOGLE_SHEETS_SERVICE_ACCOUNT preview
vercel env add GOOGLE_SHEETS_SPREADSHEET_ID preview
```

Verify variables are set:
```bash
vercel env ls
```

## Step 6: Run Linting & Type Checking

Before pushing, ensure code quality:

```bash
# From project root
cd apps/web
pnpm typecheck
```

Fix any errors before proceeding.

## Step 7: Commit and Push

Once all checks pass:

```bash
# From project root
git add .
git commit -m "feat: add Google Sheets integration for market accuracy tracking

- Add GoogleSheetsClient for logging settlement data
- Add weather comparison utility to fetch from all providers
- Update settlement cron to log to Google Sheets
- Support base64-encoded service account credentials
- Non-blocking writes (settlement succeeds even if Sheets fails)"

git push origin main
```

## Step 8: Monitor Vercel Deployment

1. Watch deployment in Vercel dashboard or CLI:
   ```bash
   vercel ls
   ```

2. Wait for deployment to complete (check status shows "Ready")

3. Verify deployment logs for any errors:
   ```bash
   vercel logs --follow
   ```

## Step 9: Verify Integration

After deployment completes:

1. **Check Vercel Environment Variables**
   - Go to Vercel dashboard → Project → Settings → Environment Variables
   - Verify both `GOOGLE_SHEETS_SERVICE_ACCOUNT` and `GOOGLE_SHEETS_SPREADSHEET_ID` are set for production

2. **Test Headers Creation** (if not done locally)
   - The headers should be created automatically on first settlement
   - Or manually trigger by calling the settlement endpoint (if test mode available)

3. **Monitor Next Settlement**
   - Wait for next market settlement (runs every 5 minutes)
   - Check Google Sheet for new row
   - Verify all columns are populated correctly

## Success Criteria

- ✅ Code review complete, no issues found
- ✅ Headers test script created and passes
- ✅ Spreadsheet shared with service account
- ✅ Vercel environment variables set
- ✅ Type checking passes
- ✅ Code committed and pushed
- ✅ Vercel deployment completes successfully
- ✅ Headers appear in Google Sheet
- ✅ Next settlement logs data correctly

## Troubleshooting

**If headers test fails:**
- Check service account email has Editor access to sheet
- Verify base64 encoding is correct
- Check Vercel logs for authentication errors

**If deployment fails:**
- Check Vercel build logs
- Verify environment variables are set correctly
- Ensure `googleapis` package is in `package.json`

**If settlement doesn't log:**
- Check settlement cron logs in Vercel
- Verify environment variables are available at runtime
- Check Google Sheets API quotas/limits
