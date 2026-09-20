# Phase 3 local development database — September 19, 2026

## Outcome and user decision

- User authorized task 3. Supabase org explicitly chosen: cobibean's Org. Cost tool
  quoted $0/month; creation of weatherb-arc-dev was rejected by the two-active-free-
  project limit. No project was created. User explicitly chose local development and
  deferred a Supabase upgrade until the product starts to form. Do not retry hosting
  or modify Speakeasy/Hotspot Checkout without a new instruction.
- Phase 3 is implemented and verified for that revised local scope. Phase 4 not begun.
  Work stays uncommitted on codex/arc-phase-1-baseline. No push/deploy/on-chain action,
  subscription changes, hosted cron changes, or global memory updates.

## Local database and scripts

- Persistent PostgreSQL 14 cluster at ignored `.tools/arc-postgres/data`, private Unix
  socket in its parent, socket port 55439, no TCP listener. Database weatherb_arc_dev.
  Files bind ownership to this checkout; do not move/delete/adopt without inspection.
- `.env.arc-dev` holds generated distinct runtime/migrator credentials, mode 0600.
  Cluster folder 0700; local admin password remains in its private ignored file.
  No credentials were printed or committed. Legacy `.env` is preserved.
- `npm run arc:setup` starts/initializes; `arc:migrate` applies six Prisma migrations
  and the access profile; `arc:seed` preserves existing IDs/settings/history;
  `arc:check` reports live state; `arc:stop` stops without deleting data.
- `npm run dev` starts the owned database then serves Next on 127.0.0.1. It scrubs
  inherited service credentials and skips legacy dotenv loading. Runtime receives
  only app DB credentials; migration URL is restricted to the migration process.
- Eight active canonical cities, zero markets, explicit test-mode config, scheduler
  and settler paused. No RPC, contract, wallet, Redis, queue, weather or signing keys
  added to the local profile. Active markets unavailable until Arc configuration;
  past-market history is a verified healthy empty list.
- Separate migration owner has DB/schema creation rights; runtime role has RLS
  policies and CRUD on only five active tables, no DDL/bypass/deferred-table access.
  Access profile enables RLS on 16 application tables plus Prisma metadata. Bootstrap
  and access SQL are separate committed-source steps, not extra Prisma migrations.

## Behavior and verification

- Live `/api/health` is explicitly database-scoped: 200 ready, 503 unavailable,
  unconfigured, or incomplete seed; no-store. Pause state reported independently.
- Homepage distinguishes failed services from no markets; history fails before cache
  reads when DB is unhealthy. Removed unconditional healthy footer claim.
- Scheduler and both settlement endpoints check database/seed/pause state before
  external work. Scheduler's DB fallback removed. Admin config reads no longer create
  defaults. Post-transaction persistence reconciliation remains phase 4.
- Full verify passed: lint/types, 8 safety, 41 shared, 110 web, 9 DB, 107 contract
  tests, full builds, ABI. An additional single-settlement guard test then passed in
  the focused 8-test readiness file (111 web tests total); final lint/types passed.
- Disposable DB runner now creates roles and migrates as the restricted owner;
  tests seed idempotency and actual runtime permissions. Active runtime uses pg via
  Prisma; CLI access-profile setup declares pg 8.23.0 explicitly (latest stable
  registry version confirmed). Dependency tree check passed.
- Persistent migration/seed reruns passed. Actual outage/recovery: stop local cluster
  → health/history HTTP 503 and browser history error; restart → HTTP 200/empty history.
  Browser checked retry and layout. Missing RPC banner is expected, not chain health.
- Temporary browser tab closed; Next server and persistent PostgreSQL stopped after
  verification, data preserved. `npm run dev` restarts both. Disposable test cluster
  was removed automatically. No background preview remains.

## Gotchas and next work

- Prisma's schema engine needs socket port in URL authority; query-only port was
  ignored. Bootstrap must grant CREATE on the development database to migrator for
  the initial CREATE SCHEMA migration. The failed first attempt had no application
  tables; marked 00_init rolled back with Prisma resolve, then migrated successfully.
  Clean disposable role-based rebuild independently passed after the correction.
- Local setup uses existing PG14 tooling; hosted Supabase/TLS/advisors are explicitly
  unverified. Same SQL/migrations/seed can be used later, with hosted acceptance.
- Wallet transitive dependency checkpoint and phase 4 financial/scheduling gates from
  earlier notes remain. No wallet integration or product redesign happened here.

Sources: `docs/plans/2026-09-19-phase-3-development-database.md`, canonical
`docs/plans/2026-09-18-arc-usdc-readiness-plan.md`,
`docs/testing/arc-development-database.md`.
Logs: `/tmp/weatherb-phase3-verify.log`, `weatherb-phase3-final-unit.log`,
`weatherb-phase3-final-lint.log`, `weatherb-phase3-final-types.log`, and
`weatherb-phase3-local-final-check.log` (all under `/tmp`).
