# Phase 4 money/settlement correctness — September 19, 2026

## Outcome

User authorized task 4 implementation after the proxy convention cleanup. Task 4
is locally implemented/verified on `codex/arc-phase-1-baseline`. Existing broad
phase 1–3 changes remain uncommitted; no push/PR/deploy/contract upgrade or hosted
schedule change. No subagents were used for this phase. Next scope is the Arc
configuration/testnet lifecycle, not already completed or started here.

## Durable changes

- Contract source 2.2.0: payouts use recorded totalFees; refund getter includes both
  stakes; observation bounds enforced. Added owner-only idempotent scheduled slots
  for 12–16 UTC with exactly 24h duration from creation block. Five-slot cap applies
  to scheduling; existing manual createMarket remains available. Slot mapping uses
  one storage-gap slot; ABI regenerated. Legacy Coston2 contracts untouched.
- Refund positions carry both-side amounts and BOTH label. Individual/bulk claim()
  supports resolved, Cancelled, and NoWinners in the new source. Recorded fees flow
  through DB/API/summary; admin pools stay raw until presentation.
- Shared settlement service powers both endpoints. Retry invalid/unavailable weather
  within 600s of target; cancel overdue targets for refunds without current-weather
  substitution. Exact-second cache keys and validation prevent cross-target reuse.
- Scheduler checks receipts and actual slot IDs, no Redis pre-advance. Chain-count
  rotation. Queue failure remains visible with periodic settlement required.
- Shared reconciliation upserts chain state, including missing/terminal rows;
  transaction advisory locks + unique market IDs prevent duplicate persistence and
  delayed OPEN writes undoing settlement. Failures return non-success and retry
  recovers without repeating successful chain writes. Admin cancellation retries
  reconcile too.
- Automation requires contract version 2.2.0. Empty DB atomically binds to chain ID
  plus contract address; different deployment/unbound existing history rejected.
  Two new additive migrations: unique market ID/deployment binding and recorded
  fee column. Eight migrations total. No new package dependencies.

## Verification

Full `npm run verify` passed: lint/types, 8 safety checks, 52 shared, 149 web,
14 disposable PostgreSQL, 114 Foundry tests (includes fee/stake fuzz), builds and ABI.
Contract tests execute actual EVM logic; service RPC/weather are mocked under the
network guard; DB concurrency/recovery executes real PostgreSQL. React tests cover
individual and bulk refund submission. This is not live wallet/network acceptance.

Persistent owned local DB migrated successfully and access profile reapplied;
arc:check confirms eight active cities, zero markets, both workers paused. Stopped
our local PostgreSQL after checks; data preserved, npm run dev starts it again.
No RPC/private keys added to the local profile. No Supabase changes.

Test gotcha: concurrent dynamic Prisma imports in Vitest bypassed its mock. Only
the concurrent route test stubs preflight (separately tested); real Postgres tests
verify concurrent persistence. Network guard caught this; it was not disabled.

Logs: `/tmp/weatherb-phase4-final-verify.log`, `/tmp/weatherb-phase4-local-migrate.log`,
`/tmp/weatherb-phase4-local-check.log`, `/tmp/weatherb-phase4-local-stop.log`.

## Next acceptance boundary

Canonical plan: `docs/plans/2026-09-18-arc-usdc-readiness-plan.md`.
Details: `docs/plans/2026-09-19-phase-4-money-settlement.md`.
Setup: `docs/testing/arc-development-database.md`.

Arc native USDC/chain/explorer configuration, fresh deployment, actual wallet bets,
claims/refunds/one-sided market behavior, real provider timing, and receipt/balance/
DB agreement still required. Recheck wallet dependency advisories at that milestone.
Hosted schedules remain disabled pending actual deployment acceptance; Supabase
hosting remains deferred by user. Unsigned temperature ABI still cannot represent
negative Fahrenheit; fail closed then refund. Live bet estimates assume default 1%
fee; bind them to the deployed fee configuration before using another rate. Full
chain scans are adequate for the restart baseline; incremental indexing is future
work if growth makes them too slow. These limits are in the phase 4 report.
