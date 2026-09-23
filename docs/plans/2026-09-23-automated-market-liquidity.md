# Automated market liquidity and claims

Date: 2026-09-23

Status: implementation plan; no implementation, migration, wallet creation, funding, deployment, or activation was performed while writing this document.

Audience: an implementing AI agent. Follow the decisions and invariants below; do not substitute the old bot's strategy or infer additional product features.

Repository root: /Users/cobibean/DEV/weatherb. All implementation paths below are relative to this root.

## 1. Outcome and approved decisions

Every eligible new market receives the same configured stake on YES and NO from one dedicated weatherB market-maker wallet. Existing settlement automation resolves the market. The market maker then claims any payout or refund back into the same wallet and reuses available funds for later markets.

The user approved the following:

| Decision | Required behavior |
| --- | --- |
| Initial amount | 2.50 native USDC per side, 5.00 per market. |
| Configuration | Persist the amount in the database and make it editable from the admin dashboard without a deployment. The default may appear in migration/bootstrap code; transaction code must read configuration. |
| Concurrent markets | At most five markets funded or reserved by this system at once. Five fully seeded markets initially commit 25.00 USDC in principal. This does not change market-creation limits. |
| Additional budgets | No daily spending budget, loss limit, cumulative spending cap, or operator-defined balance floor. Do not implement these. |
| Funding | The user manually funds the dedicated wallet. No treasury signer, automatic transfers, faucet automation, or automatic profit withdrawals. |
| Insufficient funds | Visible admin notification and durable attempt/error history. Retry automatically after funding when the action is still valid. No silent failures. |
| Market eligibility | New markets only. Do not seed markets that existed before first activation. |
| Admin controls | The dashboard controls the seed amount and automation switches. |
| Future agents | Keep business functions separate from HTTP/UI so a future CLI or agent can reuse them. Do not build a CLI, MCP server, or AI agent in this change. |
| Public disclosure | No new public badge, banner, or other prominent disclosure in this version. Documentation can explain platform participation later. |

Implementation choices made by this plan, rather than additional user requirements:

- One fresh EOA signs both sides and all claims, with no owner, scheduler, or settler authority.
- Use the existing dedicated worker, shared database, and QStash infrastructure.
- Seed each eligible market once. Never rebalance the pools as other users bet.
- Equal means equal contributions from this wallet. Existing human bets may make total pools unequal.
- Include new public markets from supported creation paths. Exclude hidden/test markets and unclassified external creations.
- A slot remains occupied until the wallet's position is financially finished: confirmed claim/refund, or a proven terminal position with no payout and no pending transaction.
- Independent switches: pause seeding; pause claims. Pausing seeding normally leaves claims enabled.
- All signing runs on the worker. The public web project may save validated settings and read status but receives no private key.

### Financial behavior to preserve

These are parimutuel bets, not withdrawable AMM liquidity. Principal cannot be pulled out before settlement. The wallet may lose to other bettors. At the inspected 1% losing-pool fee, an otherwise empty market seeded with 2.50 on each side returns 4.975 USDC before gas. Use actual claim receipts and the contract's payout calculation; do not promise preservation of the initial 25 USDC.

The five-market maximum remains five if the amount changes. For example, changing to 3.00 per side permits 30.00 principal across five newly seeded markets; 25.00 is an initial consequence, not a separate budget.

## 2. Verified baseline and source map

Repository inspected on master at 8c36235. Unrelated untracked docs/design/brand/ existed and must be preserved.

Read-only checks on 2026-09-23 found:

- Arc Testnet, chain 5042002, proxy 0xd86e2774e4a9bf2e86199791068b9350b718b891.
- Deployed version 2.4.0; feeBps 100; minBetWei 10000000000000000, or 0.01 native USDC; market count 23 at that moment.
- Both public and worker health reported database ready, scheduler/settler enabled, successful recent runs, and zero overdue markets.
- These are planning snapshots. Recheck environment identity before implementation acceptance; never use market count 23 as an activation constant.

Read these sources before editing:

| Existing path | Relevance |
| --- | --- |
| contracts/src/WeatherMarketV2.sol | placeBet accumulates repeated deposits; getPosition, calculatePayout, claim; isPaused getter. |
| contracts/src/interfaces/IWeatherMarket.sol | Market/Position structs, status enum and receipt events. |
| packages/shared/src/constants/arc.ts | Native USDC has 18 decimals; parseNativeUsdc and chain guard. |
| packages/shared/src/utils/payout.ts | Existing USDC formatting and payout utilities. |
| apps/web/src/app/api/cron/schedule-daily/route.ts | Confirmed creation, scheduled-slot lookup, DB persistence and test classification. |
| apps/web/src/app/api/cron/settle-markets/route.ts | Existing two-minute sweep and settlement lease. |
| apps/web/src/app/api/markets/[marketId]/settle/route.ts | Per-market settlement accelerator. |
| apps/web/src/lib/cron/market-state.ts | Deployment binding, chain reads, market persistence and reconciliation. |
| apps/web/src/lib/cron/lease.ts | Database signer lease primitive. |
| apps/web/src/lib/cron/worker-run.ts | WorkerRun, trigger labels and error redaction. |
| apps/web/src/lib/cron/settlement-schedule.ts | Existing QStash publication pattern. |
| apps/web/src/lib/admin-session.ts | Wallet allowlist, signature authentication, session cookie, AdminLog. |
| apps/web/src/lib/admin-auth.ts | Alternate bearer-session validator; keep activation checks consistent. |
| apps/web/src/lib/admin-writes.ts | Existing broad admin write lock. |
| apps/web/src/lib/admin-operations.ts | Admin snapshots and alert derivation. |
| apps/web/src/lib/worker-status.ts | Existing settlement/creation health, which must retain its meaning. |
| apps/web/src/app/admin/(dashboard)/operations/ | Existing operations UI and 30-second refresh. |
| apps/web/prisma/schema.prisma | Models and existing legacy bot tables. |
| scripts/development/access.sql | Explicit grants and RLS for public app and worker roles. |
| scripts/development/worker-profile.mjs | Explicit worker environment allowlist. |
| scripts/development/hosted-profile.mjs | Signer-free public/local hosted profile. |
| scripts/development/worker.mjs | Worker deployment and existing three QStash schedules. |
| scripts/development/setup-hosted-key.mjs | Protected, idempotent local wallet provisioning pattern. |
| scripts/verification/environment.mjs | Secret-free verification environment. |
| scripts/verification/database.mjs | Disposable database verification runner. |
| docs/testing/arc-hosted-testnet.md | Hosted identities and operations, with some older paragraphs superseded by newer sections. |
| docs/testing/arc-testnet-lifecycle-acceptance.md | Existing acceptance evidence. |

Important baseline constraints:

1. Automatic creation is implemented. The older AGENTS.md sentence saying creation is manual is stale; do not reopen scheduler development.
2. The contract is frozen at 2.4.0 for this restart. This plan needs no contract upgrade, batch-bet helper contract, new token, ERC-20 approval, ABI change, or new contract role.
3. apps/market-bot is deferred. Its FLR settings, rotating wallets, random sizing, floating-point accounting, rebalancing, and retry behavior do not implement this plan. Leave it isolated.
4. The public app cannot read legacy BotWallet records. Do not revive those tables or grant access to encrypted keys.
5. Existing settlement retry logic can rely on a contract rejecting repeated settlement. Repeated placeBet succeeds and increases the position. Its retry policy cannot be copied for funding.
6. persistMarket currently creates rows with isTest=false; schedule-daily sets test=true afterwards. That interval is unsafe for a new seeder. Explicit classification and its recovery are part of this plan.

## 3. Architecture and execution order

Use an application module at apps/web/src/lib/liquidity/ and one dedicated worker endpoint:

- POST /api/markets/[marketId]/liquidity: QStash immediate seeding accelerator.
- GET/PATCH /admin/api/liquidity/config: authenticated read and configuration.
- GET /admin/api/liquidity/status: authenticated status, alerts and paginated activity.

Reuse the existing two-minute settlement sweep as the periodic trigger. Start an independent liquidity tick alongside the existing settlement phase and await both results. They use distinct signers and distinct leases; neither holds the other's lease. This prevents slow settlement dependencies from starving funding or claims. Do not add a second recurring two-minute schedule in v1. Immediate creation messages are extra deliveries, but there is no second baseline sweep.

~~~text
Existing creation confirms a market
  -> persist authoritative public/test classification
  -> eligible new public market is discoverable in durable storage
  -> best-effort immediate QStash delivery
       -> same liquidity service used by the periodic sweep

Existing two-minute trigger
  -> start existing settlement phase under its existing signer lease
  -> independently start liquidity phase under market-maker signer lease
       1. reconcile any unresolved signed transaction
       2. reconcile existing positions and process available claims/refunds
       3. recover creation registrations and discover eligible new markets
       4. complete any partially seeded pair that is still eligible to finish
       5. start new pairs while fewer than five slots are held
       6. save status, funding notices and activity
  -> await both phases, with independent status/error capture
~~~

Settlement success does not depend on the maker having money or being enabled. A settlement exception, busy result, or settler pause must not accidentally suppress a liquidity tick when its own prerequisites are healthy. Authentication failure and unavailable shared database must prevent both.

Refactor the route's early returns into a coordinator as needed. Keep the existing settlement service behavior and response fields. Add a separate liquidity result with its own success/status/counts. A liquidity failure must not falsify settlement counters or lastSuccessfulSweepAt; liquidity health is computed from its own run kind. Return a non-2xx response for actual infrastructure failures, with each phase's status represented accurately.

Creation publication failures must not turn a successfully created market into a reported creation failure. Persist the registration first, report queue failure separately, and let the periodic tick recover.

Claims do not need another per-market delivery. A settlement performed by the existing per-market endpoint becomes claimable to the next tick, normally within two minutes.

Because phases may run concurrently, liquidity may read a market just before settlement confirms and claim on the next tick. That is expected. All money decisions use fresh on-chain state, and neither phase may downgrade a terminal database row with an older read.

## 4. Activation, classification and eligibility

### 4.1 New-markets-only boundary

On the first successful enable operation:

1. Verify chain, proxy, DB deployment binding and a fresh worker readiness record for the configured maker wallet.
2. Read a specific latest block and getMarketCount at that block.
3. In a database transaction, compare the submitted config version and set firstEligibleMarketId to that count, activationBlockNumber to that block, and activatedAt to the activation time.
4. Persist enable + cutoff + audit log atomically. If any read or write fails, remain disabled.

IDs less than firstEligibleMarketId are permanently ineligible for seeding. This block snapshot is the precise activation boundary; DB createdAt is not proof of on-chain creation time.

The cutoff is write-once for this deployment and wallet. Pause/resume, restarts, deployments, seed-amount edits and repeated enable requests never reset it. A config-version conflict must return 409; never silently move the boundary.

Markets created after this cutoff while seeding is paused or offline may be picked up after recovery if they remain open. This is retrying eligible new work, not historical backfill. No seed-all or historical override control in v1.

### 4.2 Public/test classification must be authoritative

Add a liquidity classification to Market: UNKNOWN, PUBLIC or TEST, default UNKNOWN for existing/migrated records. Existing isTest remains the public-site visibility field.

For scheduled creation, add a small durable LiquidityCreationIntent keyed by deploymentKey and scheduled UTC slot:

- Record requested isTest, creation path and slot before signing a new creation transaction.
- A repeated request for the same slot cannot overwrite the intent's classification. Reject conflicting metadata.
- After the existing getScheduledMarket lookup confirms an ID, atomically persist its isTest, liquidity classification and the intent-to-market binding.
- If the creator crashes after submission or confirmation, the liquidity tick recovers the ID with getScheduledMarket(slot). That getter stores ID + 1; zero means absent. Apply the saved classification before considering funding.
- Do not publish the seeding message before classification commits.
- An intent without a created market is not a funding job and uses no maker slot.

This is metadata recovery, not a second scheduler. Never create a market from a liquidity tick.

Extend persistMarket with an explicit optional classification argument that preserves existing classifications during ordinary chain reconciliation. Generic reconciliation leaves previously unknown creations UNKNOWN; it never guesses PUBLIC from isTest=false. Liquidity discovery scans its own pending/unknown records as well as new IDs, rather than depending solely on the existing maximum-ID reconciliation cursor.

Supported manual creation tooling must register explicit public/test intent and classification through the same helper. Inspect apps/web/src/scripts/arc-lifecycle.ts create() and its labels; hidden acceptance/NoWinners fixtures remain TEST. An external on-chain creation with no trustworthy metadata stays UNKNOWN, unseeded, and visible in admin as requiring classification. Do not add a generic admin enrollment/override tool in this version.

Database metadata-write failure before a creation transaction may fail that request, consistent with the creator's existing database-readiness rule. Funding or queue problems after creation never block settlement or make the creator resubmit an already-created market.

### 4.3 Eligibility checks

All of the following must hold immediately before the first seed:

- Correct deployment and configured signer; market ID is at or above the cutoff.
- Classification PUBLIC and isTest=false.
- On-chain currency is the native zero address; market is Open; isPaused is false.
- Current block timestamp is earlier than bettingDeadline minus a 60-second operational margin.
- No prior successful seed for this wallet/market, no conflicting wallet position or unresolved transaction.
- Seeding switch enabled and fewer than five occupied/reserved slots.

The 60-second margin is a transaction-recovery margin, not another financial limit. Never infer deadlines from resolveTime or a hardcoded ten-minute subtraction when bettingDeadline is available.

Process waiting candidates by creation/market ID order. At capacity, keep them waiting; do not change their seed amount or steal another market's slot. When the margin expires before any bet, record SKIPPED_DEADLINE. Once skipped, never revive that market for seeding.

## 5. Data model and access rules

Use new tables rather than the FLR-era BotWallet/BotBet models. Use Prisma migrations with matching SQL constraints/indexes and explicit grants/RLS. Monetary values are base-unit decimal strings; parse to bigint for arithmetic. API amounts are decimal strings, never JavaScript numbers.

The following is the minimum logical schema; exact Prisma enum/type names may follow repository conventions.

### LiquidityConfig

Singleton for the bound deployment:

- id; deploymentKey; walletAddress (normalized, immutable after activation).
- seedAmountWei, default "2500000000000000000".
- seedingEnabled=false; claimsEnabled=true.
- firstEligibleMarketId nullable; activationBlockNumber nullable; activatedAt nullable.
- version integer for optimistic concurrency; updatedAt; updatedBy.

Five is a named system constant MAX_ACTIVE_LIQUIDITY_MARKETS=5, shown read-only in admin. Do not expose a control that can raise it in v1.

Migration/bootstrap must not activate the system or overwrite an existing configuration. Bind a provisioned wallet while disabled. The worker must reject a different derived signer address, chain or proxy.

### LiquidityCreationIntent

- id, deploymentKey, intentKey, slot nullable, isTest, source, creationTxHash nullable, contractMarketId nullable, classification status, createdAt, reconciledAt, lastError.
- Unique (deploymentKey, intentKey). Scheduled key is "scheduled:<UTC slot>"; additionally enforce uniqueness of non-null scheduled slots per deployment.
- Manual key is "manual:<stable request/journal identity>"; record its transaction hash/confirmed ID. Do not manufacture a slot for an unscheduled createMarket call.
- Enforce that a scheduled intent has a slot and a manual intent has a stable request identity; test both paths.

### LiquidityPosition

One row per (deploymentKey, walletAddress, contractMarketId), enforced unique:

- Market relation; seedStatus; claimStatus; waitReason; slotHeld.
- targetPerSideWei nullable until first reservation; configVersionAtReservation.
- confirmedYesWei; confirmedNoWei; claimedAmountWei; gasSpentWei, initially "0".
- lastCheckedBlock; discoveredAt; firstSeededAt; claimedAt; completedAt.
- lastErrorCode; redacted lastError; lastAttemptAt; nextAttemptAt.

Suggested seed states: QUEUED, SEEDING, PARTIAL, SEEDED, SKIPPED, ATTENTION.
Suggested claim states: NONE, WAITING, CLAIMABLE, IN_FLIGHT, CLAIMED, NO_PAYOUT, ATTENTION.

Use waitReason for CAPACITY, INSUFFICIENT_FUNDS, PAUSED, CONTRACT_PAUSED or UNCLASSIFIED. Do not encode a failed RPC read as a zero balance or zero payout.

Snapshot targetPerSideWei and acquire slotHeld atomically under a config/slot lock before preparing the first seed transaction. A settings edit affects positions not yet reserved. A reserved pair always retains its original target, including after one side has succeeded.

slotHeld remains true for a partial seed, an unresolved transaction, seeded unresolved position, or a terminal position awaiting claim/refund. Release it only after reconciliation proves no remaining financial obligation or uncertain transaction for that row. A pre-broadcast unfunded reservation can be released safely; preserve its recorded target once set.

### LiquidityTransaction

One durable signed transaction attempt:

- id; positionId; operation YES_SEED, NO_SEED or CLAIM; attempt number.
- deploymentKey; signerAddress; nonce; to; calldata; valueWei; gas/fee fields.
- serialized signed transaction; locally calculated transactionHash.
- status PREPARED, SUBMITTED, CONFIRMED, REVERTED, UNKNOWN or SUPERSEDED_EXTERNALLY.
- preparedAt; firstBroadcastAt; lastBroadcastAt; receiptBlockNumber/hash; receiptStatus.
- confirmed value/event amount; actual gas cost; errorCode; redacted error.
- externalRecoveryHash and recovery evidence nullable, used only after verified operator-led nonce recovery.

Constraints: unique transaction hash; unique (deploymentKey, signerAddress, nonce) for v1, which does not implement replacement transactions; unique (positionId, operation, attempt). Enforce one unresolved transaction for the signer in service logic under the signer lease and transactional locks.

Do not store private keys in this table. The signed transaction is still sensitive spend authorization: restrict it to the worker/migrator, never return it to the public app or put it in logs.

### LiquidityEvent

Append-only business activity and deduplicated incidents:

- id; deploymentKey; walletAddress; optional position/market/action references.
- code; severity; redacted message; safe JSON details; createdAt.
- For active incidents, a stable incidentKey, firstSeenAt, lastSeenAt, occurrenceCount and resolvedAt.

Either separate activity and incident tables or use typed rows in this table with SQL uniqueness for active incident keys. Do not lose historical failures when resolving an incident. A successful retry appends recovery activity and resolves the active incident.

Also add LiquidityWorkerState (one row per deployment/wallet) for heartbeat, configuration/key readiness, last successful reconciliation, known balance with observed time/block, and redacted current failure. This gives the public app status without accessing the key or signed transaction records.

### Role permissions

| Data | weatherb_app | weatherb_worker |
| --- | --- | --- |
| LiquidityConfig | SELECT; narrowly permitted configuration mutations through authenticated application code | SELECT; approved worker readiness/binding operations only |
| LiquidityPosition | SELECT | SELECT/INSERT/UPDATE |
| LiquidityCreationIntent | SELECT if needed for admin diagnostics | SELECT/INSERT/UPDATE |
| LiquidityTransaction | No access | SELECT/INSERT/UPDATE |
| LiquidityEvent | SELECT; config audit can use existing AdminLog | SELECT/INSERT/UPDATE for lifecycle incidents |
| LiquidityWorkerState | SELECT | SELECT/INSERT/UPDATE |

Use column grants where appropriate and RLS policies for actual roles; the matrix is not satisfied by UI checks alone. No grants to anon, authenticated, PUBLIC or legacy bot tables. The migration role retains migration authority. Existing administrative provisioning scripts may need explicit, reviewed access for registration; do not solve that with blanket table grants.

Keep public transaction hashes and safe operation status mirrored on position/event records for the dashboard; do not expose serialized transactions merely to make an explorer link.

## 6. Transaction safety and recovery

### 6.1 Non-negotiable invariants

1. A duplicate delivery must never create an extra stake.
2. The wallet's final intended contribution is exactly targetPerSideWei on each side.
3. At most five slotHeld positions exist for the deployment.
4. A transaction is durably recoverable before its first network broadcast.
5. There is at most one unresolved nonce for the maker signer. Claims and seeds share the same lease and nonce sequence.
6. Chain position and successful receipts establish money movement; worker logs alone do not.
7. No seed before the activation boundary, on a test market, or after the deadline.
8. Never release a slot or claim completion while a transaction outcome is unknown.

### 6.2 Lease and request bounds

Use a maker-specific lease such as liquidity:<chainId>:<lowercase wallet>. Do not reuse the scheduler or settler lease. Generate a unique invocation UUID even if WorkerRun logging fails; the existing fallback holder "unrecorded" is not appropriate for financial writes.

For liquidity, use maxDuration=300 seconds, a 360-second lease, and stop initiating new work after 240 seconds. All network calls have bounded timeouts shorter than remaining execution time. Confirm lease ownership and expiry immediately before each broadcast. Do not use the existing 280-second settlement lease duration for a 300-second liquidity invocation.

The coordinator starts both phases promptly and passes its request start time into liquidity, so the liquidity deadline covers the complete invocation rather than a late nested timer. If insufficient time remains, record deferred work and let the next tick run. Test that a slow settlement dependency does not prevent the liquidity phase from starting. Never depend on detached promises, process memory, setInterval, or work after an HTTP response.

Use a DB row lock/transaction to reserve a slot and snapshot the amount. The signer lease alone is not the schema-level concurrency proof. Reconciliation and all state mutations use the same lock order.

### 6.3 Prepare, persist, broadcast

For each YES seed, NO seed or claim:

1. Reconcile unresolved attempts and read the latest chain position/status first.
2. Verify enabled state, deployment, deadline, slot, expected position and operation.
3. Simulate/estimate the exact call and determine explicit nonce, calldata, value and fee fields.
4. Sign locally without broadcasting. Compute the hash from the serialized transaction.
5. Commit the complete signed envelope, hash, nonce and operation association to LiquidityTransaction.
6. If that commit fails, do not broadcast.
7. Recheck current controls and lease; submit the saved bytes with sendRawTransaction.
8. Persist submission progress. Receipt waits are bounded; an uncertain return is pending/unknown, not failure proof.
9. After a successful receipt, verify the expected event from the configured contract for this market and wallet, then reconcile getPosition at that receipt block or later.
10. Commit confirmed position, receipt-derived amount/gas and activity atomically. Resume the next operation only once this nonce's outcome is known.

Viem supports separate transaction preparation, signing and submission; check the installed 2.56.8 types instead of copying an outdated signature from an example. See [signTransaction](https://viem.sh/docs/actions/wallet/signTransaction).

This order covers crashes between submission and recording the result. Do not use writeContract followed by a best-effort DB insert for the maker.

### 6.4 Retry decision table

| Observation | Action |
| --- | --- |
| Saved transaction has a successful receipt | Reconcile event/position; never send another stake for that operation. |
| Saved transaction has a reverted receipt | Record actual failure/gas. Recheck eligibility and position before preparing a fresh attempt with a new nonce. |
| RPC send timed out or returned an ambiguous network error | Keep the saved nonce/hash; query receipt and transaction, then resend only identical bytes if appropriate. |
| No receipt and no transaction found, nonce not consumed | May rebroadcast identical saved bytes while the operation remains allowed. Do not allocate another nonce for that operation. |
| Nonce consumed but known hash cannot be reconciled | ATTENTION; stop new signer writes, preserve slot, surface incident. Do not guess that the intended bet happened. |
| Position already equals the target on a side | Reconcile known history; skip that side. |
| Position exceeds target or contains unexplained deposits | ATTENTION; no top-up, subtraction, rebalance or automatic wallet adoption. |
| Duplicate claim sees claimed=true | Reconcile claim event/receipt and mark recovered completion; no second claim. |
| Chain/RPC state is unavailable or contradictory | Retry read later; do not interpret uncertainty as permission to spend. |

There is no automatic fee-bump/replacement mechanism in v1. A transaction pending for six minutes raises an admin incident; continue safe receipt checks/rebroadcasts. The operator runbook must describe investigating the exact nonce/hash. Do not expose a "force retry with new nonce" control.

A pause stops new seed broadcasts, including a prepared but not yet broadcast seed and the missing half of a partial pair. Already broadcast transactions can still mine; keep reconciling them. A prepared envelope cannot be casually deleted or its nonce reused because broadcast may have occurred before a crash.

If an unresolved seed becomes invalid because its deadline passes, do not pretend its nonce disappeared or that subsequent claims can bypass it. Raise liquidity-transaction-unknown with reason EXPIRED_SEED_NONCE. Stop new signer writes until receipt reconciliation or explicitly supervised nonce recovery resolves it. This rare condition requires technical intervention in v1. The runbook must explain that an authorized operator may need a same-nonce cancellation/replacement, must record its recovery hash separately, and must reconcile its canonical outcome and the original operation before resuming. Mark the original journal entry SUPERSEDED_EXTERNALLY only after verifying the replacement sender/nonce/receipt and reconciling the maker position; preserve the original envelope and account for recovery gas. Do not label the original operation CONFIRMED unless its intended contract effect is proven. Automated replacement and a dashboard force-send button remain out of scope.

### 6.5 Partial pairs and unavailable balance

There is no atomic both-sides call in the frozen contract. Send YES first, confirm it, then NO. If NO fails, persist PARTIAL with exact confirmed amounts, keep the slot and retry only the missing side while valid.

Before starting a pair, check available balance against both deposits plus estimated transaction costs. This is an affordability check, not a spending budget, gas reserve policy or loss limit. If clearly unaffordable, log a blocked attempt and raise a funding notice without deliberately sending a doomed transaction. The user did not require paying gas to demonstrate failure.

After a real send/simulation rejection for insufficient funds, preserve the distinction between "not submitted" and "possibly submitted." A later deposit automatically permits safe retry. No requirement to toggle enable again.

Claims have priority over new seed pairs because they may restore funds. Do not withhold an affordable claim to maintain an arbitrary reserve. If the wallet cannot pay claim gas, show a specific gas-funding notice; expected payout cannot fund that transaction in advance.

If the second side cannot complete before the deadline, stop seeding, keep the partial position visible, and follow the normal terminal claim/refund path. Its losing side can end with no payout; record the loss and release the slot only after confirming no pending transaction remains.

## 7. Claims, accounting and slot completion

For every tracked position with a stake, keep checking it after the Market row becomes terminal. The existing unsettled-market query is insufficient: terminal markets can have unclaimed maker funds.

Read getMarket, getPosition and calculatePayout together at a consistent block where possible:

- Resolved + positive payout + unclaimed: call claim(marketId).
- Cancelled or NoWinners + a positive stake: call claim(marketId), which handles both statuses.
- Already claimed: recover the claim/refund event and transaction evidence, then complete locally.
- Resolved + zero payout: only mark NO_PAYOUT after a successful chain read confirms no winning stake, not an RPC error.
- Nonterminal: wait.
- Contract paused: wait visibly; claims also use whenNotPaused.

A fully seeded pair normally has a winning-side stake. NoWinners remains relevant for partial positions, compatibility, and fixtures.

Payout is the actual WinningsClaimed or Refunded event amount, not the wallet balance change. Manual top-ups and unrelated timing make balance deltas unreliable. Gas is the receipt's actual gasUsed multiplied by effectiveGasPrice, including reverted attempts. Do not count a receipt twice.

Display separately: principal contributed, payout/refund received, gas paid, net result. For completed positions, net = received - confirmed stakes - actual gas. For unfinished positions, show capital committed and realized receipts without labeling the whole stake as a realized loss.

Keep claims in the same wallet; no fee withdrawal or transfer to the owner. A confirmed claim/refund completes that position and releases its slot, allowing the next eligible market to start in the same tick if time permits.

## 8. Admin controls and authentication

### 8.1 Narrow permission boundary

Do not enable ADMIN_WRITES_ENABLED globally to ship liquidity controls. Add LIQUIDITY_ADMIN_WRITES_ENABLED, default false, checked only by liquidity configuration mutations. Production rollout enables this flag on the public project; existing owner, scheduler, cancellation and city write routes retain their current lock.

Configuration mutations write the database only. They never sign transactions or synchronously call a worker write endpoint from the browser. The worker observes committed configuration on its next invocation.

Every admin API and server-rendered liquidity snapshot requires a verified, unexpired admin session and the current ADMIN_WALLETS allowlist. Protect JSON mutations with exact allowed-origin validation, JSON content-type validation, a small body limit, strict Zod schemas, and optimistic version checks.

**Resolve the observed pending-session ambiguity before adding writes:** the inspected AdminSession model/getAdminSession flow has no explicit authenticated marker. A pending nonce row must not become authorization merely because its ID appears in a cookie. Add authenticatedAt nullable:

- createPendingSession creates authenticatedAt=null.
- verifyAndActivateSession sets authenticatedAt only after successful signature verification.
- getAdminSession and verifyAdminWallet reject authenticatedAt=null, expired or non-allowlisted sessions.
- Migrate existing sessions to null and require login again; do not presume all old rows were verified.
- Reject replay/activation of an already activated nonce and verify the nonce and expected wallet using existing signature semantics. Commit activation with a conditional update requiring authenticatedAt=null; concurrent verifications cannot both consume the pending nonce.
- Test direct cookie and bearer injection of pending session IDs. Do not redesign the rest of authentication.

### 8.2 API contract

GET /admin/api/liquidity/config returns only safe fields:

~~~json
{
  "version": 1,
  "seedAmountUsdc": "2.50",
  "maxActiveMarkets": 5,
  "seedingEnabled": false,
  "claimsEnabled": true,
  "walletAddress": "configured public address or null",
  "chainId": 5042002,
  "firstEligibleMarketId": null,
  "activatedAt": null,
  "canEdit": true,
  "workerReady": false
}
~~~

The address string above is explanatory, not a valid fixture. Use real typed addresses in tests.

PATCH /admin/api/liquidity/config accepts only:

~~~json
{
  "expectedVersion": 1,
  "seedAmountUsdc": "2.50",
  "seedingEnabled": true,
  "claimsEnabled": true
}
~~~

Each editable field except expectedVersion is optional; at least one is required. Reject unknown keys, wallet/destination changes, activation cutoff changes, numeric JSON amounts, zero, negative values, exponent notation, more than 18 decimals, and values outside uint256-safe arithmetic. Validate against the current on-chain minimum before accepting an amount. Do not add an arbitrary maximum monetary amount.

Before enabling, require worker readiness checked within six minutes for the same deployment/wallet and a successful chain/config read. A low balance is not a reason to reject enabling; enable with a funding notice. An unavailable signer, wrong binding, or unsupported chain is a reason to reject it.

Save configuration change + incremented version + AdminLog entry atomically. The log records acting admin wallet, old/new fields and activation boundary when applicable, never private keys. Return committed config. Use 400 for invalid input, 401 for absent/unverified session, 403 for disabled liquidity editing, 409 for stale version or incompatible configuration state, and 503 for unavailable dependencies.

GET /admin/api/liquidity/status returns a typed serializable DTO with:

- Config, safe worker readiness, wallet address and chain.
- Balance with observedAt, block and availability; active/reserved slots out of five.
- Current incidents and their first/last observed times.
- Position rows with exact stake/payout/gas amounts, statuses, target snapshot and safe transaction links.
- Paginated activity using a stable createdAt/id cursor, default 25 and maximum 100 rows.
- Last invocation, last successful reconciliation and any running/stale indication.

Never serialize Prisma models wholesale. Select fields explicitly and encode all bigint values as strings.

### 8.3 Dashboard workflow

Add a Liquidity section to the existing Operations page rather than a new independent admin application.

It contains:

1. A wallet card: copyable public address, Arc Testnet label, native USDC balance, updated time and a funding instruction. No private-key input or transfer button.
2. Controls: amount per side, derived amount per market, read-only five-market maximum, seed pause/resume, and claims pause/resume. Saving shows pending, success and recoverable error states.
3. Clear text beside the seeding switch: pausing does not withdraw stakes; claims continue unless separately paused. Existing signed transactions may still confirm.
4. First-enable text: only markets created after the activation boundary qualify. Display the established cutoff afterwards without an edit field.
5. Capital/status summary: slot count, principal committed, claimable amount and recovered funds. Unknown values display unavailable, not zero.
6. Persistent funding/error notices with market/action context, explorer links when available, last attempt time, and next recovery behavior.
7. A position/activity table showing queued, waiting for funds/capacity, partially seeded, seeded, waiting for settlement, claiming, claimed/refunded, skipped or attention states.

Reuse current admin typography/components, responsive tables/cards, focus styles and accessible labels. Poll safe status on the existing 30-second cadence. Refresh must not replace an unsaved form draft or move focus; version conflict offers reload/reapply rather than silently overwriting.

Show a compact active-liquidity-alert summary on /admin linking to Operations, so a funding notice is visible on the dashboard landing page too. Add Operations to the mobile menu, which currently omits it. Correct the blanket Read-only badge to reflect narrowly enabled liquidity controls while keeping unrelated controls read-only.

No public market-card/UI changes beyond naturally displaying the actual updated on-chain pool amounts.

## 9. Dashboard notifications, errors and health

Notifications are persistent dashboard incidents, not just transient toasts. No email, Slack, browser-push integration or external messages in this scope.

| Code | Trigger and recovery |
| --- | --- |
| liquidity-funding-required | Observed balance cannot cover the next intended pair plus estimated costs, or a known insufficient-funds error. Include wallet, available amount, intended action and shortfall when known. Resolve after funding/claims make that action affordable. |
| liquidity-claim-gas-required | A claim is available but the wallet cannot afford its transaction. Resolve after gas funding and successful re-evaluation. |
| liquidity-partial-seed | Only one side is confirmed. Identify its amount, missing side, deadline and retry state. Resolve on completion or terminal accounting; retain activity history. |
| liquidity-transaction-pending | Known transaction unresolved for six minutes. Show nonce, safe hash and elapsed time. |
| liquidity-transaction-unknown | Consumed nonce or conflicting evidence cannot be reconciled. Block new signing, require investigation, and never clear solely because a later tick ran. |
| liquidity-worker-stale | No completed liquidity check for six minutes while activated and the feature or outstanding positions require service. |
| liquidity-worker-failed | RPC/database/config/processing failure; retain exact safe stage and error code. |
| liquidity-market-unclassified | New market above cutoff lacks authoritative metadata after two sweeps. Do not seed based on its default isTest flag. |
| liquidity-market-skipped | Deadline expired before an eligible seed could complete. Persist which side, if any, was funded. |
| liquidity-contract-paused | Contract pause prevents a needed seed or claim. Do not toggle the contract. |

Capacity waiting and intentional pauses are normal statuses, not critical incidents.

Deduplicate repeated active incidents by deployment/wallet/code/market/action as applicable. Repeated checks update lastSeen/occurrence count without flooding the activity feed; state changes and actual transaction attempts remain auditable. Do not add a dismiss button that hides an unresolved funding requirement.

Funding awareness also runs between market creations. With no concrete next market, balance below twice the configured seed amount is a definite principal shortfall; show that plus "gas also required." Reuse a recent representative gas estimate only when available and label it an estimate. Do not invent a balance floor if there is no estimate.

Known insufficient funds is a processed blocked result, not a successful seed. A tick may return HTTP 200 with blocked counts while the dashboard is degraded. The independent heartbeat shows that it checked, while the active incident shows that money movement did not happen.

Failures to write the financial journal block broadcasting. If the database itself is unavailable, neither persistent event insertion nor the dashboard may work: emit redacted platform logs, return 503, and let stale status/read-unavailable UI expose the gap after recovery. Do not claim dashboard notification delivery while storage is down.

Use redaction before storage/logging. Never log raw RPC error objects that can contain serialized transactions, keys, authorization headers, provider URLs with tokens or database URLs.

## 10. Worker environment and delivery behavior

### Signer provisioning

- Extend the protected setup-hosted-key pattern with the market-maker role and an idempotent .tools/arc-hosted/market-maker.json file, mode 0600 under mode-0700 directories.
- Expose only the public address in command output. Do not paste or print the key.
- Add MARKET_MAKER_PRIVATE_KEY only to .env.arc-worker.example documentation and the worker environment allowlist. Keep actual .env files ignored.
- Validate key syntax and derived address. Require it to differ from scheduler, settler and owner addresses; it needs no on-chain role.
- Provisioning may be a setup command as with existing worker keys. It is not a general management CLI; ongoing configuration is through admin.
- Keep the key optional for deployment while the feature is disabled. Missing key means not ready and prevents enable; it must not stop the existing creator/settler.
- The public project receives LIQUIDITY_ADMIN_WRITES_ENABLED and existing admin/read-only RPC settings, never MARKET_MAKER_PRIVATE_KEY, CRON_SECRET or a treasury key.

Update profile/secret-exclusion tests for the new key. Ensure verificationEnvironment continues stripping it. No environment-printing diagnostics.

### Trigger integration

Keep existing schedule IDs/frequencies. Extend the existing periodic route to invoke the service; do not create a standalone process or revive the old bot workspace.

After classified public creation, use publishJSON to the worker's /api/markets/<id>/liquidity endpoint with the existing bearer-auth delivery pattern, retries: 3, and a stable message deduplication ID scoped to deployment and market. QStash deduplication lasts ten minutes and therefore is only an efficiency measure; durable state/nonce recovery provides correctness. See [QStash deduplication](https://upstash.com/docs/qstash/features/deduplication).

The endpoint:

- Requires worker deployment identity and the configured bearer secret, including in development. Do not inherit a no-auth development bypass for a signer endpoint.
- Validates a nonnegative safe integer market ID. Ignores/rejects supplied amount, destination, wallet, arbitrary calldata or force flags.
- Calls the same lease-protected service as the periodic tick. The message is a wake-up hint, not authority to seed a market.
- Returns 401 for invalid auth, 400 for invalid input, 409 for lease busy, 202 for a known in-flight transaction, 200 for reconciled/disabled/ineligible/blocked results, and 503 for dependency failures.
- Never forwards private transaction material in the response.

Budget the work in one invocation: at most 25 discovery/reconciliation candidates per page, and no more than five newly prepared money-moving transactions per tick, subject to remaining time. Persist a cursor only after every earlier ID has a durable processed/deferred record; never skip a failed lower ID just because a higher ID was seen.

These execution bounds are resource controls, not monetary limits. Remaining eligible work continues on the next immediate delivery or periodic tick. Claims and partial-pair recovery precede fresh pairs.

Queue failure, duplicate delivery, restart and slow RPC must all converge on the same stored position/action without duplicate stakes.

## 11. Implementation sequence and files

Complete the following tasks in order. Use small coherent commits if implementation is later authorized. Do not deploy simply because a unit test passes.

### Task 1 — Establish baseline and schema

Read current AGENTS.md, this plan and the source map. Recheck branch/worktree dirt; preserve unrelated files. Inspect newer source changes before applying this plan mechanically.

Create:

- apps/web/prisma/migrations/<new_timestamp>_market_liquidity/migration.sql.
- apps/web/src/lib/liquidity/types.ts.
- apps/web/src/lib/liquidity/config.ts.

Modify:

- apps/web/prisma/schema.prisma for the models, classification and authenticatedAt.
- scripts/development/access.sql for explicit roles, columns, RLS and new table coverage.
- apps/web/src/lib/development-seed.ts for idempotent disabled configuration only, if needed.
- Database test setup/cleanup and role fixtures to include the new tables.

Specify actual enum values, foreign keys, uniqueness and indexes in code; do not keep lifecycle status as unchecked arbitrary text. Index pending seed/claim queues, slotHeld and incident lookup. Use timestamptz(6) consistently.

Exit: disposable migration succeeds; rerunning seed preserves operator values/cutoff; public role cannot read signed envelopes or write worker-owned lifecycle records.

### Task 2 — Verified admin sessions and isolated controls

Modify admin-session.ts, admin-auth.ts and their tests for explicit activation. Add:

- apps/web/src/lib/liquidity/admin-config.ts.
- apps/web/src/app/admin/api/liquidity/config/route.ts.
- apps/web/src/app/admin/api/liquidity/status/route.ts.
- apps/web/src/lib/liquidity/__tests__/admin-config.test.ts.
- apps/web/src/app/admin/api/liquidity/__tests__/config.test.ts.

Keep the permission helper distinct from adminWritesEnabled. Make configuration version checks and audit writes atomic. Reuse server functions from routes; do not put business rules in React.

Exit: verified admin can edit with the liquidity flag enabled while all old admin write routes remain locked; forged/pending/expired sessions and cross-origin writes fail.

### Task 3 — Durable eligibility and creation recovery

Create apps/web/src/lib/liquidity/discovery.ts with registration, cutoff and discovery logic.

Modify:

- apps/web/src/lib/cron/market-state.ts for classification-aware persistence.
- apps/web/src/app/api/cron/schedule-daily/route.ts for creation intent/classification integration.
- apps/web/src/scripts/arc-lifecycle.ts only as needed for explicit classification of its creation paths; preserve existing journal and signer guards.

Build scheduled crash recovery using saved intent + getScheduledMarket. Manual creation uses its saved request/transaction identity. Unclassified foreign creations remain held.

Exit: a concurrent sweep cannot fund a hidden canary during the old isTest=false interval; a missed callback or creator crash does not lose a known public market; IDs below activation remain untouched.

### Task 4 — Durable transaction engine

Create:

- apps/web/src/lib/liquidity/transactions.ts.
- apps/web/src/lib/liquidity/positions.ts.
- apps/web/src/lib/liquidity/__tests__/transactions.test.ts.
- apps/web/src/lib/__tests__/liquidity-transactions.db.test.ts.

Implement the exact prepare/persist/broadcast/reconcile sequence from section 6 with typed viem APIs. Prove that a DB failure prevents the first broadcast, and a post-broadcast crash recovers the saved transaction without signing a duplicate bet.

Do not change the frozen contract or import the old bot's transaction helper.

Exit: duplicate invocations, timeout-after-broadcast, mined-before-DB-update, consumed-nonce ambiguity, partial pairs and repeated claims are covered by meaningful failure-injection tests.

### Task 5 — Seeding, claims, slots and incidents

Create:

- apps/web/src/lib/liquidity/service.ts.
- apps/web/src/lib/liquidity/claims.ts.
- apps/web/src/lib/liquidity/events.ts.
- apps/web/src/lib/liquidity/status.ts.
- Focused unit tests under apps/web/src/lib/liquidity/__tests__/.
- apps/web/src/lib/__tests__/liquidity-capacity.db.test.ts.

Implement claims-first ordering, exact target snapshots, five-slot reservation/release, liquidity heartbeat and incident lifecycle. Add a unique worker run kind such as liquidity-tick without changing the meaning of settlement runs.

Exit: six concurrent candidates never hold six slots; old stake amounts survive a setting edit; manual funding resumes valid work without configuration changes; terminal positions remain discoverable until recovery is finished.

### Task 6 — Delivery integration

Create:

- apps/web/src/lib/liquidity/schedule.ts.
- apps/web/src/app/api/markets/[marketId]/liquidity/route.ts.
- apps/web/src/app/api/markets/[marketId]/liquidity/__tests__/route.test.ts.

Modify:

- apps/web/src/app/api/cron/settle-markets/route.ts to coordinate independent phases.
- apps/web/src/app/api/cron/schedule-daily/route.ts to publish the immediate hint after registration.
- apps/web/src/lib/cron/worker-run.ts for liquidity run types.
- Existing settlement/creation integration tests for independence and response compatibility.

Exit: disabled/empty/unfunded liquidity does not break creation or settlement; paused settlement does not prevent otherwise permitted claims; queue failure is recovered by the existing sweep.

### Task 7 — Dashboard

Create apps/web/src/components/admin/liquidity-panel.tsx and focused component tests.

Modify:

- apps/web/src/app/admin/(dashboard)/operations/operations-client.tsx and page.tsx.
- apps/web/src/lib/admin-operations.ts for a safe liquidity summary, or compose a separate typed snapshot.
- apps/web/src/app/admin/(dashboard)/page.tsx and/or dashboard-client.tsx for the linked alert summary.
- apps/web/src/components/admin/header.tsx and admin layout for mobile Operations access and accurate capability labeling.

Preserve existing settlement/creation information. A liquidity RPC failure must not blank otherwise available Operations data. Render a scoped unavailable state.

Exit: complete desktop/mobile workflow works, unsaved edits survive polling, controls show real save results, and funding/partial/unknown incidents remain visible after refresh and reopening.

### Task 8 — Profiles and setup

Modify:

- scripts/development/setup-hosted-key.mjs for the new protected role.
- scripts/development/worker-profile.mjs and .env.arc-worker.example.
- scripts/development/hosted-profile.mjs and .env.arc-hosted.example only for the scoped admin flag/configuration plumbing needed by the public deployment.
- scripts/verification/worker-profile.test.mjs and hosted-profile guard tests.
- package.json only if a wallet-provisioning alias is useful; no general agent CLI.

Review scripts/development/worker.mjs, deployment scripts and actual environment synchronization paths: ensure they forward the new worker-only variable without dropping existing scheduler/settler credentials. Do not introduce a new recurring schedule.

The existing arc:worker -- check invokes authenticated creation/settlement routes and can cause writes. It is not a read-only health command; document this when using it in acceptance.

Exit: disabled feature can deploy without a maker key; configured worker derives the expected distinct address; public and verification profiles exclude all new signing material.

### Task 9 — Verification and runbook

Add docs/testing/automated-market-liquidity.md with setup, controls, funding, evidence and recovery instructions. Update existing hosted runbook references narrowly and correct stale creation/manual statements relevant to this feature.

Document the public wallet address and environment identity, not secrets. Record receipts, event amounts, slot counts and dashboard evidence. Preserve existing historical acceptance records.

Finish the full verification and staged hosted acceptance below. Report implemented, locally verified and hosted-verified separately.

## 12. Required verification

Tests must call the real services/routes with injected clients or controlled RPC mocks. Do not test a copied algorithm and present it as implementation proof.

### Pure/unit and route behavior

- "2.50" parses to 2500000000000000000; settings round-trip without float conversion.
- Invalid amount formats, excess precision, zero, below-minimum and overflow fail.
- No daily/loss/dollar budget is introduced.
- Changed config affects new reservations only; both sides of a partial pair use the original target.
- Exactly five slots, including claims pending; waiting sixth market starts only after a slot truly completes.
- Amount setting can rise above the initial 2.50 without encountering an invented 25-USDC cap.
- Initial activation freezes a live block/count boundary; old markets stay excluded across restart/pause/resume.
- Test and unknown classifications never seed, including concurrent scheduler/sweeper execution.
- Contract pause/deadline/non-native market guards precede signing.
- No repeat seed on duplicate callback or tick, including a duplicate received days later.
- Crash before persist broadcasts nothing; crash after persist/before broadcast reuses envelope; crash after broadcast/before update recovers hash/nonce.
- Successful receipt requires matching contract/market/wallet/operation evidence.
- Uncertain RPC outcome never causes a fresh nonce for the same unresolved seed.
- Reverted receipt records gas and permits only a revalidated retry.
- Unexpected wallet position or consumed unknown nonce blocks new writes visibly.
- Insufficient funds before and after one side: notice + recovery after funding, no silent skip.
- YES and NO outcomes both claim correctly; cancellation and NoWinners refund through claim.
- Partial losing position completes with NO_PAYOUT; partial winning position claims actual payout.
- Already-claimed recovery does not send again or record zero proceeds as a verified amount.
- Manual funding does not inflate reported payout/profit.
- Seeding paused still allows claims; claims paused still reconciles existing transactions.
- Missing key while disabled does not impair existing automation.
- Queue publication failure, settlement busy/paused/failure and request timeout preserve phase independence.
- Worker-only routes reject missing/wrong secret in production and development.
- Liquidity admin flag does not unlock existing owner/admin mutations.
- Pending, forged, expired and removed-admin sessions fail for both cookie and bearer validators.
- CSRF/origin checks, strict input, config-version conflicts and audit-write rollback work.
- Error redaction excludes keys, serialized transactions and credential-bearing URLs.

### Disposable database tests

- Real role grants/RLS enforce the access matrix, including worker-only signed transactions.
- Concurrent reservations for at least six markets result in no more than five held slots.
- Unique position, transaction hash/nonce and active incident constraints reject duplicates.
- Lease contention, unique holder IDs, expiry and stale-holder release behave correctly.
- A settings conflict rolls back both change and audit; new cutoff cannot overwrite the old cutoff.
- Migrations preserve existing Market/WorkerRun data and initialize the new system disabled.
- Discovery cursor never jumps past a failed earlier candidate; terminal positions with unclaimed funds remain queried.
- Scheduler classification and liquidity discovery race cannot turn a hidden fixture into a public seed.

Use the repository's disposable runner, not the hosted database. Extend its role setup if it currently lacks weatherb_worker. Existing DB fixtures/cleanup must remove child records in a valid order.

### Browser workflow

With controlled local fixtures, verify:

1. Authenticated admin opens Operations on desktop and mobile.
2. Enters 2.50, saves, refreshes, and sees persisted value and derived 5.00 total.
3. Stale concurrent edit returns a conflict without silently losing the draft.
4. First enable displays new-markets-only behavior and stable activation boundary.
5. Pause/resume controls accurately reflect which actions continue.
6. Zero/insufficient balance displays funding address and persistent notice on both dashboard and Operations.
7. Funding clears the active notice after a successful recheck and preserves historical activity.
8. Partial seed, pending/unknown transaction, claim, refund and no-payout states remain understandable.
9. Public pages gain no liquidity disclosure UI.
10. Anonymous users cannot read liquidity admin data or mutate settings.

### Repository commands

Use the repository's declared Node/npm versions. Current root package.json declares Node 24.x and npm 12.0.2; follow any newer compatible checked-in instructions.

Run focused tests during development, then:

~~~sh
npm run verify
git diff --check
~~~

The verify command includes lint, typecheck, unit/safety tests, Foundry, disposable DB tests, build, ABI and storage-layout checks. ABI/storage checks should remain unchanged and pass because there is no contract work.

Do not run historical bot integration scripts or debug transaction scripts as tests. Do not run migrations, funding commands or transaction acceptance against hosted services during ordinary local verification.

## 13. Staged hosted acceptance and recovery

This document authorizes no actions by itself. The implementing agent must follow the execution/deployment authorization in its actual session. Preparation and local verification should make any requested activation concrete and reviewable.

### Deployment sequence

1. Apply the additive schema and grants through the existing migration role. Verify old creation/settlement still work. New config remains disabled.
2. Provision the dedicated key using the protected helper; put it only in the worker profile/environment. Bind and display the derived public address. Do not rotate scheduler/settler/owner.
3. Deploy worker and public changes while seeding is disabled. Check auth failures, classification persistence, distinct-wallet readiness, existing schedules and separate heartbeat.
4. Enable the scoped admin-write flag on the public project. Verify all unrelated admin writes still return the existing read-only denial.
5. User manually funds the wallet. 25 USDC is five initial principal pairs, not principal plus gas; dashboard should show the actual balance and next-action affordability.
6. Save 2.50 per side and enable through admin. Capture activation block, first eligible ID, settings version and timestamp.
7. Observe the next newly created public market. Verify one confirmed 2.50 YES deposit and one confirmed 2.50 NO deposit, then unchanged amounts after repeated delivery.
8. After existing settlement runs, verify the maker claim/refund receipt, actual returned amount, dashboard result and released slot.
9. Observe a later new market funded automatically from remaining/recovered balance with no manual bot execution.
10. Save evidence in the new testing runbook and report any still-unobserved branch honestly.

Do not silently lower the production seed amount to pass a test. Failure branches and six-market contention belong in local/disposable tests. Existing hidden canaries remain excluded. If a dedicated hosted liquidity fixture is needed, use an isolated test deployment/explicit separately authorized fixture rather than relaxing the public eligibility rule.

### Hosted evidence checklist

- Exact commit/deployment, chain, proxy, maker public address and activation boundary.
- Configuration persisted through the admin API/UI with no redeploy.
- Successful existing creation/settlement before and after deployment.
- Seed transaction hashes, correct BetPlaced events and exact getPosition amounts.
- Duplicate-trigger evidence with unchanged stake totals.
- Dashboard funding notice and safe history; hosted funding recovery if actually exercised.
- Terminal outcome and successful claim/refund hash/event.
- Correct payout/gas accounting and slot release.
- A subsequent market seeded automatically.
- No owner privileges, public signing material, new recurring schedule or old-bot process.

### Operational recovery

| Situation | Operator action; automated behavior |
| --- | --- |
| Wallet needs money | Send native USDC on the displayed Arc network to the displayed maker address. The next tick rechecks and resumes valid work. |
| Pause new commitments | Disable seeding in admin; leave claims enabled. Existing funds cannot be withdrawn early. |
| Pause every new maker transaction | Disable both switches. Already broadcast transactions may still confirm; reconciliation continues. |
| One side succeeded | Inspect partial-seed row. Do not manually add another bet. Worker retries only the missing side while valid, then settles/claims the residual position. |
| Unknown/pending transaction | Inspect recorded hash, nonce, contract event and wallet position. Never delete the journal or click a fresh-nonce retry. A consumed unknown nonce requires explicit technical reconciliation. |
| Worker rollback needed | Disable seeding first. Prefer retaining compatible claim/reconciliation service for outstanding positions. Do not drop additive tables or erase cutoff/history. |
| Maker key change desired | Stop and plan a controlled migration of outstanding positions. No dashboard wallet edit; the original wallet must claim its own funds. |
| Shared database unavailable | Repair connectivity, retain journal, then reconcile before signing. Dashboard may only show unavailable/stale status until storage recovers. |
| Contract paused or settlement delayed | Surface the condition; maker never unpauses or resolves/cancels markets itself. |

### Definition of done

Implementation is complete only when configuration, exact once-per-side funding, partial/uncertain transaction recovery, five-slot enforcement, claims/refunds, dashboard notices, access isolation and required local tests are implemented and verified.

Hosted acceptance is a separate statement requiring the real create -> seed both sides -> settle -> claim/refund -> next market sequence. A passing build, enabled switch, or successful QStash publish is not that evidence.

No general AI management interface, public disclosure UI, rebalancing strategy, contract upgrade, automated replenishment or mainnet release belongs in this implementation.
