# Phase 4 — money and settlement correctness

September 19, 2026. Implemented for the fresh restart deployment; local verification
is recorded below. No hosted deployment, contract upgrade, or automation restart.

## Result

- `WeatherMarketV2` source version is now **2.2.0**. Winner claims and the payout
  getter use `Market.totalFees`, recorded at resolution. Changing the global fee
  before/between claims cannot change those payouts. Cancelled and NoWinners
  getters return both accumulated stakes; a claimed position returns zero.
- Individual and bulk claims use `claim()`, supported by this source for resolved,
  cancelled, and NoWinners markets. Refund amounts survive position serialization,
  appear in the claimable balance, and include both sides. Two-sided positions say
  BOTH. Settled summaries use the recorded fee, carried through chain/API/database
  data. Admin pool values stay in base units until display formatting.
- Both settlement endpoints share the same implementation. Valid observations must
  have integer timestamps in `[resolveTime, resolveTime + 600]`, cannot be from the
  future, and must contain an integer, nonnegative temperature supported by the
  existing unsigned ABI. Invalid/unavailable weather returns a retryable 503 while
  the window is open. After ten minutes the worker cancels for refunds without
  fetching today's weather for an old target. The contract independently rejects
  pre-target, future, or out-of-window observations. An already-recorded valid
  historical observation can still be submitted to the contract later; automated
  workers take the bounded cancellation path after expiry.
- Reading caches use the exact target second and validate before caching/returning,
  so observations from another target in the same hour cannot contaminate a market.
  Tomorrow.io realtime access rejects expired targets before making a request.

## Creation and reconciliation

`createScheduledMarket(cityId, thresholdTenths, slot)` permits one creation in each
UTC hour from 12 through 16. The slot is the hour's Unix start time. Repeated calls
return the original market ID, including later retries with changed arguments;
invalid, future, or expired unfilled slots revert. There are only five permitted
slots per UTC day. Resolve time is the creation block timestamp plus exactly 24
hours. The existing owner-only `createMarket` remains available for deliberate
manual/test lifecycles; the five-slot guarantee applies to scheduled creation.

The scheduler no longer advances Redis before a transaction. It rotates cities
using durable contract market count, checks receipt success, obtains the actual
created ID from the slot mapping (never a simulated ID), and reads the confirmed
market. The creation count comes from receipt events, including concurrent replay.
Queue failures are visible; periodic settlement remains necessary.

Both workers reconcile chain state before work. The individual settlement and admin
cancellation endpoints also reconcile already-terminal markets on retry. A chain
success followed by a DB failure returns a failure response rather than hiding the
problem. A later invocation recovers the row without another creation/settlement.

The restart database represents **one deployment**. Automation requires version
2.2.0 and atomically binds an empty database to chain ID plus contract address in
`SystemConfig.deploymentKey`. A different deployment or existing unbound history is
rejected. `Market.contractMarketId` is unique. PostgreSQL transaction locks serialize
record updates, and a delayed open snapshot cannot undo a recorded terminal state.
Deactivated cities remain available for reconciliation. Unknown city hashes fail
visibly. No legacy Coston2 contract or database is adopted or changed.

Two additive migrations create the market-ID uniqueness constraint, deployment
binding, and recorded-fee column. Eight migrations now rebuild the schema. The
persistent local database remains eight active cities, zero markets, both workers
paused, and no contract binding or signing keys configured.

## Verification

- Full `npm run verify`: lint, typechecking, 8 safety checks, 52 shared tests,
  149 web tests, 14 disposable PostgreSQL tests, 114 Foundry tests, production builds,
  and generated ABI consistency.
- Contract tests cover fees changed between claims and fee withdrawal, fuzzed fee
  settings/stakes, both-side refunds, NoWinners method selection, double-claim
  protection, observation bounds, scheduled retries, five-slot limits, invalid
  slots, authorization, and exact duration.
- Route tests exercise production services with RPC/provider/DB boundaries mocked:
  auth/pause/configuration, legacy rejection, concurrent and repeated creation,
  actual versus simulated IDs, queue failures, failed receipts, receipt timeouts,
  provider failures through expiry, all terminal statuses, partial settlement
  failures, and database recovery for scheduler, periodic/single settlement, and
  admin cancellation. Network guards remained enabled throughout.
- Real disposable PostgreSQL tests verify concurrent upserts, precision, terminal
  recovery, stale snapshot protection, inactive cities, and deployment isolation.
- Rendered React tests exercise individual and bulk claim submission; no connected
  wallet or live weather/network transaction is represented by these fixtures.
- Persistent local migrations/access profile applied, and `arc:check` confirms the
  seeded, empty, paused baseline. Logs are `/tmp/weatherb-phase4-final-verify.log`
  and `/tmp/weatherb-phase4-local-*.log`.

## Remaining acceptance gates

The next milestone is Arc configuration, fresh testnet deployment, and a complete
wallet-connected lifecycle. Native USDC parsing, labels, chain/explorer settings,
wallet compatibility/advisories, actual weather timing, and receipt/balance/database
agreement must be verified there. No six-decimal ERC-20 conversion is introduced.
The unsigned temperature ABI still cannot represent negative Fahrenheit readings;
automation fails closed and eventually refunds these cases. Signed-temperature
support would be a separate contract/product decision.

Keep hosted schedules disabled. The new recovery paths and daily limit pass local
checks, but validate them with actual Arc receipts and the deployment-bound database
before enabling scheduled operation. Full-chain scans suit the small restart
baseline; incremental indexing is future work if history makes scans too slow.
Hosted CI and Supabase hosting remain unverified/deferred. Existing dependency
advisory follow-ups remain in the dependency security report. Existing live-market
payout estimates assume the default 1% fee; the Arc configuration milestone must
bind these estimates to the deployed fee setting before changing it for users.
