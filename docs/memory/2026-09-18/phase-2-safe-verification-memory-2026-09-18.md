# weatherB phase 2 verification — September 18, 2026

## Completed

- User authorized phase 2 implementation only. Work remains local on
  `codex/arc-phase-1-baseline`; no commit/push/deploy, hosted database provision,
  or blockchain transaction this phase. Hosted jobs were not resumed.
- Root `npm run verify` now passes: lint, typechecking, eight guard checks,
  94 web tests, 41 shared tests, seven disposable DB tests, 107 contract tests,
  full production builds, and compiled ABI match. No active skips.
- CI runs this same command with PostgreSQL 16 tooling. Hosted execution remains
  unverified until a future push/PR; local PostgreSQL validation used version 14.
- Clean temporary-directory install/tree check passed with one React/ReactDOM 19.3
  pair. Root pins were needed because hoisted Testing Library originally resolved
  React 19.2.8 while app hooks used nested 19.3, causing invalid-hook failures.

## Implementation and discoveries

- `scripts/verification/` launches with sanitized environment and dummy settings.
  Root dotenv is skipped; Vite env loading disabled. Node socket/fetch/TLS/UDP/
  WebSocket access is guarded, and swallowed blocked calls still fail tests.
  Only managed PostgreSQL Unix sockets and exact Turbopack worker IPC are allowed.
- DB runner creates its own private cluster; marker/exact URL checks run before
  migrations/fixtures. Direct unowned config invocation fails closed. Seven real
  Prisma/API fixtures passed repeatedly. Intentional fixture failure also verified
  server shutdown and directory cleanup. Preview server was stopped and cleaned.
- Optional voting/auditions/magic links/reporting code and stale tests are preserved
  in `deferred/` with a manifest. Routes are 410 stubs, pages 404, nav omitted,
  and settlement/cancellation no longer imports Sheets. Do not count the old 231
  deferred test diagnostics as repaired. Bot typecheck remains separately failing
  with four TS2742 declaration portability diagnostics at wallet-manager.ts:245.
- Actual route tests replace copied cron logic. Fixed city-hash fixtures and provider
  mock reset leakage, re-enabled all active skipped cases. Money logic unchanged.
- Lint fixes include keyed wallet-state views, shared external clock for countdowns,
  hydration snapshots, deterministic decorative particles, and explicit return types.
- Fonts are local Sora/Jakarta with OFL licenses. Homepage is request-rendered, avoiding
  build-time chain/database calls. Verification builds have dummy public config and
  must never be deployed; Vercel still uses the normal web-workspace build.

## Evidence and limits

- Browser smoke on the production build covered desktop/mobile positions, menu,
  empty homepage, explainer next/close, docs styling, and admin login redirect.
  No connected wallet or transaction. Preview RPC was intentionally blocked;
  existing empty/healthy copy is not proof of live service health.
- npm audit still reports 36 affected package entries (26 moderate, 10 high).
  Dependency paths/dispositions are in the phase 2 report; exploitability is not
  cleared. Do not force incompatible SDK downgrades.
- Unrelated pre-existing research/notes preserved. Implementation remains uncommitted.

## Sources and next boundary

- `docs/plans/2026-09-18-arc-usdc-readiness-plan.md`
- `docs/plans/2026-09-18-phase-2-safe-verification.md`
- `docs/testing/development-verification.md`
- `deferred/README.md`, `deferred/manifest.json`

Next separately authorized work is phase 3: fresh hosted development database,
idempotent eight-city/config seed, and truthful service health. Phase 4 financial
and scheduling correctness gates, Arc configuration, and testnet lifecycle remain.
