## Audition City Test Report

**Test City**: Test City Alpha (slug: test-city-alpha)
**Test Run ID**: cmjxsw6k900011vlmd2r3bnk4
**Date**: 2026-01-03 04:29:55Z

### Fix Verification

- [x] **Fix 1 - Slug Consistency**:
  - DB city slug matches generated slug from name
  - On-chain cityId hash matches `keccak256(toBytes(slug))`

- [x] **Fix 2 - isActive**:
  - City record has `isActive: true`
  - City was pre-set inactive and reactivated during market creation

- [ ] **Fix 3 - Fallback**:
  - Pending settlement; no mature markets yet to trigger fallback path
  - Will verify after first market reaches resolve time and settler runs

### Flow Verification

- [x] Test wallets created and funded
- [x] 5 test markets created with correct city
- [x] Opposing bets placed (YES/NO on each market)
- [ ] All 5 markets settled by cron (waiting for resolve times)
- [ ] Winnings claimed to winning wallets (pending settlement)
- [ ] Funds swept back to funding wallet (pending settlement)

### Metrics

| Metric | Value |
|--------|-------|
| Markets created | 5/5 |
| Markets settled | 0/5 (pending) |
| Total bet volume | 30.99 FLR (expected from test config) |
| Winnings claimed | 0 FLR (pending) |
| Funds recovered | 0 FLR (pending) |
| Gas used (total) | Pending (finalized on settlement/claims) |

### Issues Found

- Settlement not yet executed; earliest resolve time is ~1 hour from test start.

### Conclusion

PARTIAL - Setup, market creation, slug consistency, and reactivation verified. Settlement, claims, sweep, and fallback verification pending until markets mature.
