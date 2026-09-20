# Backlog and Ideas

Parking lot for work we want but are deliberately not doing yet. Keep entries short:
what, why, and what it would take. Move an item into a dated plan under `docs/plans/`
when it is picked up.

## Backlog

### Fine-grained admin write permissions
- **What:** Replace the single `ADMIN_WRITES_ENABLED` switch (`apps/web/src/lib/admin-writes.ts`)
  with per-capability gates, e.g. `settler-pause`, `scheduler-pause`, `market-cancel`,
  `system-config`, `cities`, `provider-test`, so writes can be enabled one at a time.
- **Why:** Today enabling writes on the hosted admin panel is all-or-nothing across all six
  write routes. We want to turn on low-risk controls (pause toggles) before higher-risk ones
  (market cancellation, config changes), and possibly scope them per admin wallet.
- **Shape:** an `ADMIN_WRITE_CAPABILITIES` allowlist (comma-separated) read by
  `adminWritesEnabled(capability)`; each route passes its capability; the UI reads the same
  list to enable only the matching controls; tests per route for allowed/denied; optional
  per-wallet map later. Requires the read-only panel's security review to be done first
  (see the hosted settlement worker plan, "Out of scope").
- **Added:** 2026-09-20.

### Scheduler role for automatic market creation
- **What:** Add a `scheduler` role to `WeatherMarketV2` so `createScheduledMarket` no longer
  requires the owner key; then run the five daily 12:00–16:00 UTC creations from the worker.
- **Why:** Unattended creation currently needs owner authority, which also controls upgrades.
- **Shape:** contract change + Foundry tests + version bump + UUPS upgrade decision, then a
  QStash schedule against the worker with a `SCHEDULER_PRIVATE_KEY`. Separate plan.
- **Added:** 2026-09-20.

### QStash signature verification on worker routes
- **What:** Verify `Upstash-Signature` in addition to the bearer secret.
- **Added:** 2026-09-20.

### Push notifications for operations alerts
- **What:** Optional email/Slack delivery for `market-overdue`, `worker-stale`, `settler-low-balance`.
  The read-only Operations page remains the source of truth.
- **Added:** 2026-09-20.

### Upstash Redis for the worker
- **What:** Provider-health tracking currently logs a configuration error and continues on the
  worker because Redis is not configured there.
- **Added:** 2026-09-20.

## Ideas

- Per-wallet admin roles (viewer / operator / owner) once fine-grained permissions exist.
