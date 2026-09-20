# Phase 3: fresh development database

Date: September 19, 2026
Status: implemented and verified locally; hosted provisioning intentionally deferred

## Decision

Supabase quoted $0/month but rejected project creation because the account already
has two active free projects. No project was created. The user chose local development
and will consider upgrading Supabase once the product starts to form. No changes were
made to Speakeasy, Hotspot Checkout, subscriptions, or hosted schedules.

## Delivered

- A persistent, private local PostgreSQL cluster with separate migration/runtime
  accounts, generated local credentials, and explicit start/stop/check commands.
- All six Prisma migrations applied as the restricted migration owner; all eight
  canonical cities seeded, zero markets, both automation flags paused.
- A repeatable server-only access profile: RLS on all application/migration tables,
  runtime access limited to five active tables, no runtime DDL or deferred-table access.
- Idempotent seeding preserves operator settings and existing IDs/history. Admin
  reads no longer create implicit default configuration.
- Default development startup uses `.env.arc-dev` and strips inherited service
  credentials. The legacy `.env` stays unchanged. No signing credentials are included.
- A live, uncached database readiness endpoint with 503 failures; honest homepage
  unavailable state and history errors; removed unconditional healthy footer copy.
- Database/pause checks before scheduler and both settlement paths; removed the
  scheduler's hardcoded-city fallback during database failure.

## Evidence and boundaries

- Full `npm run verify` passed: lint/types, safety checks, shared/web/contract tests,
  nine isolated database tests, production builds, and ABI consistency.
- Verified a fresh disposable rebuild under the migration role, idempotent seed,
  runtime reads/writes, denied runtime DDL/deferred/migration-table permissions, and RLS.
- Actual persistent database checks: eight active canonical cities, zero markets,
  paused creation/settlement; migration and seed reruns succeeded.
- HTTP/browser check: ready database returned 200, past markets returned an empty
  list; stopping the local cluster returned 503 for health and market history, and
  the browser displayed an error. Restart restored 200 and empty-history rendering.
- Missing RPC/contract configuration correctly leaves active markets unavailable.
  Arc wallet/contract/service integration and a full live-market lifecycle are not
  claimed. UI still has legacy Flare labels pending Arc work.
- Hosted connection/TLS configuration and Supabase advisors remain unverified until
  hosting is provisioned. Hosted CI remains pending push/PR. No deployment or on-chain
  action occurred. Phase 4 has not started.

See [the setup and verification guide](../testing/arc-development-database.md).
