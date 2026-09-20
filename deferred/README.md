# Deferred weatherB features

These files preserve voting/suggestions, city auditions and test-wallet orchestration,
magic links, email/weekly reports, metrics/AI insights, and Google Sheets reporting
from before the Arc restart. Original paths are retained below `apps/web/src/`;
`manifest.json` inventories moved files. They are not part of a workspace or the
Next application. Relative imports are historical and are not a runnable package.

The active app has no imports from this directory. Former API routes return 410
without importing their old handlers; deferred pages return 404. Main navigation
omits them. The three active settlement/cancellation paths no longer call Sheets.
The standalone `apps/market-bot` workspace remains recoverable, but the web/shared
app has no imports from it and ordinary build/typecheck/test commands do not run it.

Known unresolved checks from phase 1:

- 231 TypeScript diagnostics belonged to tests for these deferred features. Those
  files are preserved here, not repaired or silently counted as passing.
- Obsolete magic-link/email exports, old enum spellings, Prisma fixture shapes,
  test-wallet result types, and Next request-context mocks still need repair if restored.
- The bot retains its wallet-client declaration portability failure. Reproduce with
  `npm run check:deferred:bot` (read-only typecheck).
- Historical scripts under `scripts/debug` and bot transaction scripts are manual
  tools, not verification. They may reference archived modules or write to services.
  Do not use them as a replacement for `npm run verify`.

`obsolete-checks/` contains cron tests that tested copies of obsolete implementation
logic. Their assertions are replaced by tests importing the actual active routes,
covering hourly creation, 24-hour duration, city hashing/rotation, rounding,
authentication, weather failures, receipts, and settlement calls. The old assertion
that a local integer exceeded five was not evidence of a daily on-chain limit;
idempotency and daily-limit enforcement remain phase 4.

Restoration requires deliberate entry-point wiring, dependency checks, isolated
fixtures, and green tests; copying files back is not acceptance.
