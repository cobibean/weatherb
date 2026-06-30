# Handoff Prompt: Test Audition City Flow End-to-End

## Context

We recently fixed bugs in the audition city testing system where test markets weren't being settled by the settler cron. The fixes were:

1. **Slug mismatch fix** (`apps/web/src/lib/test-markets.ts`): Changed DB city lookup from name-based to slug-based to ensure the slug used for on-chain `cityId` hash matches the DB city record.

2. **isActive fix** (`apps/web/src/lib/test-markets.ts`): If a city exists but is inactive, it now gets reactivated automatically.

3. **Fallback fix** (`apps/web/src/app/api/cron/settle-markets/route.ts`): Added fallback to use Market record coordinates when city lookup fails.

## Your Task

Run an end-to-end test of the audition city flow and verify all three fixes work correctly. Generate a report documenting the results.

---

## Key Files to Review

| File | Purpose |
|------|---------|
| `apps/web/src/lib/test-markets.ts` | Creates test markets, places bets |
| `apps/web/src/lib/test-wallets.ts` | Generates, encrypts, funds, sweeps test wallets |
| `apps/web/src/lib/test-runner.ts` | Orchestrates the full test flow |
| `apps/web/src/app/api/cron/settle-markets/route.ts` | Settler cron that resolves mature markets |
| `apps/web/prisma/schema.prisma` | Database schema (TestRun, Market, City models) |

---

## Test Plan

### Phase 1: Setup & Trigger Test

1. **Create a test suggestion** (or use existing pending one):
   - Use a custom city name that will generate a unique slug
   - Suggested test city: "Test City Alpha" (slug: `test-city-alpha`)
   - Coordinates: lat 40.7128, lng -74.0060 (NYC area for valid weather data)

2. **Trigger the test flow** via one of:
   - Admin API endpoint: `POST /api/admin/suggestions/{id}/test`
   - Direct call to `runTestFlow()` from `test-runner.ts`
   - Create a test script that calls the functions directly

3. **Verify test wallets are created**:
   - Check `TestRun` record in DB has `walletKeys` (encrypted)
   - Verify `walletCount` is 2 (for opposing bets)
   - Confirm `fundingTxHash` is populated after funding

### Phase 2: Verify Market Creation

4. **Check 5 test markets were created**:
   ```sql
   SELECT id, "contractMarketId", "cityName", "thresholdTemp", "resolveTime", "isTest", "isSettled"
   FROM "Market"
   WHERE "isTest" = true
   ORDER BY "createdAt" DESC
   LIMIT 5;
   ```

5. **Verify slug consistency** (CRITICAL - this was the main bug):
   - Check the `City` record created for the test city
   - Verify `city.slug` matches the expected format: `test-city-alpha`
   - Verify on-chain `cityId` hash matches `keccak256(toBytes(city.slug))`

6. **Verify city is active**:
   ```sql
   SELECT slug, name, "isActive" FROM "City" WHERE slug = 'test-city-alpha';
   ```
   - `isActive` should be `true`

### Phase 3: Verify Bets Placed

7. **Check bets were placed**:
   - Query on-chain positions for the test wallets
   - Verify opposing YES/NO bets exist on each market
   - Check `TestRun.betsPlaced` count

### Phase 4: Wait for Settlement

8. **Wait for markets to mature** (or use short resolve times for testing)
   - Markets have staggered resolve times: +30, +60, +120, +180, +240 minutes
   - For faster testing, consider creating markets with shorter times

9. **Trigger settler cron** (or wait for automatic run):
   - `GET /api/cron/settle-markets` (requires `CRON_SECRET` header)
   - Or invoke directly with the appropriate auth

10. **Verify markets settled**:
    ```sql
    SELECT id, "contractMarketId", "isSettled", "settledAt", "actualTemp", outcome
    FROM "Market"
    WHERE "isTest" = true AND "testRunId" = '<test-run-id>'
    ORDER BY "resolveTime";
    ```
    - All 5 markets should have `isSettled = true`
    - `actualTemp` and `outcome` should be populated

### Phase 5: Verify Claims & Sweep

11. **Check winnings claimed**:
    - Verify winning wallets received payouts
    - Check `TestRun.payoutsVerified` is true

12. **Check funds swept back**:
    - Test wallet balances should be near zero
    - Admin/funding wallet should have received the swept funds
    - Check `TestRun.fundsRecovered` amount

---

## Verification Checklist

Create a report with these checkboxes:

```markdown
## Audition City Test Report

**Test City**: [name] (slug: [slug])
**Test Run ID**: [id]
**Date**: [timestamp]

### Fix Verification

- [ ] **Fix 1 - Slug Consistency**: 
  - DB city slug matches generated slug from name
  - On-chain cityId hash matches `keccak256(toBytes(slug))`
  
- [ ] **Fix 2 - isActive**: 
  - City record has `isActive: true`
  - (If city existed before) Was reactivated automatically

- [ ] **Fix 3 - Fallback**: 
  - (Optional) If city lookup failed, settler used Market coordinates
  - Check settler logs for "using DB market coords" message

### Flow Verification

- [ ] Test wallets created and funded
- [ ] 5 test markets created with correct city
- [ ] Opposing bets placed (YES/NO on each market)
- [ ] All 5 markets settled by cron
- [ ] Winnings claimed to winning wallets
- [ ] Funds swept back to funding wallet

### Metrics

| Metric | Value |
|--------|-------|
| Markets created | /5 |
| Markets settled | /5 |
| Total bet volume | FLR |
| Winnings claimed | FLR |
| Funds recovered | FLR |
| Gas used (total) | FLR |

### Issues Found

[List any issues, or "None"]

### Conclusion

[PASS/FAIL] - [Summary]
```

---

## Debugging Tips

1. **If markets don't settle**, check:
   - Settler logs for "Unknown cityId" errors
   - City `isActive` status
   - Slug hash mismatch (compare on-chain cityId vs DB slug hash)

2. **If wallet decryption fails**, check:
   - `MAGIC_LINK_SECRET` env var is set correctly
   - `TestRun.walletKeys` contains encrypted data (not empty)

3. **If weather fetch fails**, check:
   - Coordinates are valid (within weather API coverage)
   - Weather provider is responding

---

## Scripts Available

- `scripts/debug/diagnose-test-markets.ts` - Diagnoses why markets didn't settle
- `scripts/debug/resolve-test-markets.ts` - Batch resolves stuck test markets
- `scripts/debug/check-test-wallets.ts` - Inspects TestRun wallet data

Run with: `npx tsx scripts/debug/<script>.ts`
