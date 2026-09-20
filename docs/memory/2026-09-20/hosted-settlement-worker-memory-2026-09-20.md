# Hosted settlement worker — memory (2026-09-20)

## Why

The September 20 24-hour test relied on a Codex heartbeat invoking settlement code on
the user's Mac. Unattended hosted operation was missing. This work makes settlement run
from hosted infrastructure with no local process; automatic market creation is
deferred to a separate scheduler-role contract plan.

## Decisions

- **Separate Vercel worker project** (`weatherb-arc-worker`, same repo, CLI deploys, no
  Git integration) holds the only settlement credentials. The public site keeps its
  no-secrets guard; its signing routes are inert without `WEATHERB_WORKER_ROLE=settler`.
- **Fresh hosted settler key** (`0xa7640379553b124be096CdFC8D9AF820C624C219`) and an
  owner `setSettler` rotation. The old local settler key can no longer settle, so hosted
  and local can never compete — a structural guarantee rather than a coordination rule.
  `arc:lifecycle settle` refuses once the journal records `hostedSettler`.
- **QStash over Vercel cron** for both the two-minute sweep and the per-market delivery:
  `vercel.json` is shared by both projects (a cron there would run on the public site
  too), Vercel cron has no retries, and QStash was already wired. The sweep is
  authoritative; the per-market delivery is an accelerator that usually fails once on
  Tomorrow.io observation lag (~15–20 s).
- **Execution hardening**: per-signer `WorkerLease` (280 s, `maxDuration` 300),
  `settlementTxHash` recorded before the receipt wait (180 s in-flight grace before
  resubmission), attempts and redacted errors on the Market row, reconciliation bounded
  to unsettled rows plus new IDs, durable `WorkerRun` log including `skipped` (paused)
  and `busy` runs.
- **Read-only admin first**: all admin write routes return 403 unless
  `ADMIN_WRITES_ENABLED=true` (not set). New `/admin/operations` page shows alerts,
  settler balance, outstanding markets, and recent runs. Fine-grained write permissions
  are in `docs/backlog-and-ideas.md`.
- **Neon role `weatherb_worker`** separate from `weatherb_app`, created with the owner
  connection kept in `.tools/arc-hosted/owner-url`; grants applied by `access.sql`.
- **30-minute owner-created markets** (`arc:lifecycle hosted-test <label>`) replaced the
  heartbeat as acceptance fixtures: happy path, repeated delivery, and paused-through-
  window cancellation were all exercised on chain the same afternoon.

## Gotchas

- `@prisma/adapter-pg` writes timestamptz params as UTC wall-clock; the disposable test
  cluster is now forced to `TimeZone='UTC'` to match Neon.
- `arc:hosted -- reconcile` requires both worker flags paused; with settlement enabled
  the sweep syncs new markets and `mark-test` must wait for it.
- The local dev DB needs `npm run arc:migrate` before `hosted-test`.
- Paused sweeps return HTTP 200 `skipped: true`; they are logged as `skipped` and never
  advance `lastSuccessfulSweepAt`.

## State at handoff

Branch `codex/arc-phase-1-baseline`, commits `b8747f8..6fc783a`, not pushed. Worker and
public health: `settler: enabled`, sweeps succeeding, `overdueMarkets: 0`. Markets 0–6
on chain; 4/5 RESOLVED, 6 CANCELLED by the worker; Markets 2/3 due 2026-09-21 12:08 UTC
under the hosted worker with the Codex heartbeat cancelled. Evidence in
`docs/testing/arc-testnet-lifecycle-acceptance.md`; runbook in
`docs/testing/arc-hosted-testnet.md`.
