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
- **Status:** shipped in 2.3.0; 2.4.0 adds declared durations and owner-set bounds.
  Contract freeze after 2.4.0 — no further proxy upgrades planned for this restart.

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

### Pick up where you left off
- **What:** Resume interrupted bets and claims after closing a tab or losing connection,
  with a clear status and progress through any partially completed claim queue.
- **Why:** Users should not have to inspect the explorer or guess whether to submit again.
- **Shape:** Persist submitted transaction hashes and claim progress locally, scoped to
  wallet, chain, and contract. Recheck receipts and current claimability on return;
  distinguish pending, confirmed, failed, and unknown transactions before offering retry.
  Reuse the existing claim flow and request signatures only for remaining actions.
- **Added:** 2026-09-20; selected by user for the backlog, not implementation approval.

### The Daily Five
- **What:** A free daily prediction card covering the day's five scheduled markets.
  Make YES/NO picks without connecting a wallet, then return for a shareable result:
  “4/5. Austin betrayed me.”
- **Why:** Create a daily weather ritual that people can enjoy before deciding to bet.
- **Shape:** Start with device-local picks locked before the earliest betting cutoff.
  Cancelled markets are void; days with fewer markets show the actual count. Local
  results are self-reported. No combined wager, prize pool, or additional markets.
- **Added:** 2026-09-20; selected by user for the backlog, not implementation approval.

### Forecast Rewind
- **What:** Replay a finished market: scrub through forecast revisions, temperature
  observations, and shifts in the YES/NO pools leading up to the final reading.
- **Why:** Turn a settled result into a story people can explore and share, especially
  when the crowd's expectations and the actual weather diverged.
- **Shape:** Capture timestamped snapshots prospectively and add a replay to market
  history. Distinguish forecasts, observations, and the settlement reading; show data
  gaps explicitly. Check provider retention rights and sampling costs before building.
  Share pool-history data with the chart idea below.
- **Added:** 2026-09-20; selected by user for the backlog, not implementation approval.

### Your forecaster fingerprint
- **What:** A personal journal revealing patterns in your predictions: cities you read
  well, overconfidence, or how you fare when disagreeing with the crowd.
- **Why:** Help users develop their forecasting judgment alongside tracking winnings.
- **Shape:** Optional confidence ratings and private notes recorded before betting
  closes, compared with final outcomes. Separate prediction accuracy from financial
  returns and require enough history before presenting a pattern. Start without AI
  or public rankings; free Daily Five predictions could contribute too.
- **Added:** 2026-09-20; selected by user for the backlog, not implementation approval.

### Weather passport
- **What:** Collect city postcards recording the date, your prediction, and the actual
  weather—a travel journal of great calls and spectacular misses.
- **Why:** Give the city rotation a sense of place and make prediction history worth revisiting.
- **Shape:** Start with locally saved, downloadable cards using Afterglow colors and
  city typography. Free predictions count as well as bets; no purchase, token, or NFT
  required. City-specific illustrations would be a separate asset expansion.
- **Added:** 2026-09-20; selected by user for the backlog, not implementation approval.

### Polymarket-style YES/NO history chart
- **What:** Let users visualize how each side changes over time in a share-price-style
  chart. Reference: the user's September 20 Polymarket screenshot, with two colored
  lines, a 0–100% vertical scale, subtle gridlines, and prominent latest-value labels
  at the line endpoints.
- **Why:** Show how market sentiment moves, rather than only displaying the current
  split, so users can see when support shifted toward YES or NO.
- **Shape:** An interactive market chart with time-range controls, hover/touch values,
  timestamps, and live updates, styled to match Afterglow. Store timestamped pool
  snapshots or reconstruct changes from indexed bet events; reuse that history for
  Forecast Rewind. Show empty pools and missing history explicitly rather than
  inventing a 50/50 history, and preserve the last pool split separately from the result.
- **Pricing decision:** weatherB currently uses parimutuel pools. Its existing percentages
  represent each side's share of total stakes, not a tradable share price or a guaranteed
  probability. The initial chart can plot those percentages with clear pool-share labels.
  Actual buy/sell share prices would require a separate market-mechanics decision.
- **Added:** 2026-09-20; requested by user for the backlog, not implementation approval.
