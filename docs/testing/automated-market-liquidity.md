# Automated market liquidity: staged operator runbook

Status (2026-09-23): hosted migration, public and worker deployment, dedicated maker wallet provisioning and manual funding, and first activation are complete. Seeding and claims are enabled for eligible new public markets from ID 26 at 2.50 native USDC per side. Actual new-market YES/NO deposits, claims or refunds, and continuation through the five-slot limit still await live acceptance. See `docs/memory/2026-09-23/liquidity-hosted-rollout-memory-2026-09-23.md` for rollout evidence.

## What the worker does

The dedicated market-maker wallet places one 2.50 native Arc Testnet USDC YES bet and one 2.50 NO bet on each eligible new public market. The amount is editable, with no monetary, daily, or loss budget; five funded or reserved markets is the concurrency limit. Native USDC uses 18 decimals and pays both principal and gas. There is no automatic top-up or treasury authority. The user manually funds the displayed wallet address.

Creation and settlement retain their existing signers and QStash schedules. The maker has a separate signer, lease, transaction journal, worker-run kind, admin controls and incidents. Its periodic work runs as an independent phase of the existing settlement sweep; a registered creation publishes an immediate best-effort hint. Queue failure leaves the sweep as recovery. A paused settlement run does not pause maker claims. The maker has independent seeding and claim controls. Disabling seeding does not revoke signed or broadcast deposits; disabling claims still permits transaction reconciliation.

Only `PUBLIC` markets with IDs at or above the immutable first-enable cutoff can be seeded. Creation intents classify scheduled public and test markets before the chain write. Generic discovery leaves unknown creations `UNKNOWN`; after repeated unresolved discovery it raises an incident instead of guessing. `TEST` markets and old markets remain excluded. A new deployment or wallet binding requires operator investigation rather than a silent reset of the cutoff.

## Deployment preparation

1. Keep the public application on `weatherb_app` and worker on `weatherb_worker`. Apply the additive Prisma migration and `scripts/development/access.sql` with the existing migration role, then verify both role grants and RLS. The migration creates disabled settings; do not enable during migration.
2. Provision a dedicated market-maker key with `npm run arc:market-maker` into a protected, gitignored local wallet file. Record only its public address. Ensure it differs from owner, scheduler and settler addresses. The worker profile alone receives `MARKET_MAKER_PRIVATE_KEY`; the public and verification profiles must exclude it. Do not print, copy into chat, or place the private key in the public Vercel project.
3. Put the worker-only key in the protected `.env.arc-worker` profile. Keep the existing settlement/scheduler secrets. `MARKET_MAKER_PRIVATE_KEY` is optional while the feature is disabled. Add `LIQUIDITY_ADMIN_WRITES_ENABLED=true` only to the public profile when the operator is ready to edit liquidity settings; it does not unlock unrelated `ADMIN_WRITES_ENABLED` routes. Keep `WEATHERB_WORKER_ROLE=settler` and a strong `CRON_SECRET` on the worker.
4. Deploy with seeding disabled, then check the old creation and settlement worker health, classification persistence, anonymous 401 on the immediate maker route, anonymous admin config redirects to login without exposing data or write access, and the distinct maker heartbeat. Neither the public site nor a development-auth bypass may be able to reach a maker signer.

`npm run arc:worker -- check` is **not read-only**: its authenticated route checks can create or settle markets when enabled. Do not use it as a harmless health probe during rollout. The dedicated maker route requires the worker bearer in development too.

## Controls and funding

Open **Admin → Operations → Market liquidity** with a verified admin wallet session. The maker section shows the chain, wallet address, last observed balance/block, independent worker heartbeat, five-slot usage, positions, incident history and receipt links. The dashboard links to Operations when active liquidity incidents exist. Copy the address from the panel and fund it manually with native Arc Testnet USDC. Five initial pairs consume 25 USDC principal **plus gas**, so 25 exactly does not fund all five safely. The worker checks actual balance and estimated gas before each signing action; an insufficient balance remains a persistent funding incident. A later successful check resolves the active notice while preserving activity history.

Save a per-side amount before first enable. The default is 2.50, yielding 5.00 principal per market. Amounts use decimal strings and the contract minimum; the amount saved for a reservation is immutable for that market, so a later settings edit affects only new reservations. There is no artificial 25-USDC cap. The UI sends an expected settings version. A conflict leaves the draft visible; reload current settings and reapply deliberately. A change and its admin audit entry commit together.

On the first transition to **Seed new markets**, the admin API reads the live contract at a pinned block and records its market count as `firstEligibleMarketId` with the block and time. The database prevents later edits of this cutoff or signer binding. Pause and resume do not reopen older markets. **Claim payouts and refunds** is independent. Keep claims enabled during ordinary seeding pauses so completed slots can release.

## Evidence for hosted acceptance

This section is an evidence template, not a claim of hosted proof. Record deployment identity (chain 5042002, contract address, version 2.4.0), maker public address, migration and grant result, config version, activation block/count, current worker/scheduler/settler status, and screenshots of Operations on desktop and mobile. Never record a key or full signed envelope.

For a newly created PUBLIC market at or after the cutoff, record:

| Evidence | Value to capture |
|---|---|
| Classification | Creation intent and Market row both PUBLIC; `isTest=false` |
| YES | Receipt hash, nonce, verified `BetPlaced` event amount, market/wallet/side, final status |
| NO | Separate receipt hash, nonce, verified `BetPlaced` event amount, market/wallet/side, final status |
| Capacity | Slots held before/after; no more than five; sixth waits until completion |
| Idempotency | Repeated immediate delivery and periodic sweep leave the same two confirmed amounts |
| Outcome | Settlement/cancellation status and maker claim/refund receipt, actual event amount, gas, released slot |
| Continuation | A later new PUBLIC market starts automatically from the remaining/recovered wallet balance |

Check YES and NO outcomes, cancellation, NoWinners refund, a partial losing side with `NO_PAYOUT`, insufficient funds before and after one side, and an already-claimed rerun over time. Do not present a mock or a pre-funded wallet as live payout proof. Public pages should contain no new maker disclosure UI. Anonymous admin API requests may be redirected by middleware to login (307 in the hosted check); they must expose no settings data or write access. Anonymous maker POST must return 401.

## Recovery and incident handling

The worker signs an EIP-1559 envelope, stores the exact bytes/hash/nonce and intended operation atomically, and only then broadcasts. A failed journal write broadcasts nothing. After a timeout, reconcile the saved hash and chain nonce; rebroadcast **the identical saved bytes** only when appropriate. Never sign a fresh nonce while an unresolved envelope exists. A consumed nonce with no matching receipt becomes `UNKNOWN` and blocks new writes until investigated. Review chain receipt, sender, destination, event market/wallet/side/amount and on-chain maker position before any manual correction. Do not edit the journal to force completion.

An expired seed whose saved hash has no receipt still owns its nonce and blocks all maker writes, including claims. The worker does not replace it automatically. If the hash remains absent after checking multiple Arc RPC views and the market can no longer accept the seed, an explicitly authorized operator may submit a same-nonce replacement from the **same maker wallet**. Keep seeding and claims paused during this procedure. Retain the original `LiquidityTransaction.signedTransaction`, hash, nonce, calldata and value unchanged. Record the replacement hash separately in `externalRecoveryHash` and its reason, authorized operator, RPC views, submission time and block in `recoveryEvidence`. Do not use a new nonce or mark the row complete at submission time.

After finality, verify the replacement receipt's sender, nonce, destination, status and block/hash against the maker wallet, and verify the original hash has no successful receipt. Read the affected on-chain maker position at the replacement block and reconcile it against the journal's confirmed amounts. Only after this proof, atomically set the original journal row to `SUPERSEDED_EXTERNALLY` with the separately recorded replacement evidence and actual `gasUsed × effectiveGasPrice`; add that gas to the position exactly once and record an activity event. A replacement that reverted still consumed its nonce and paid gas. If the original bet unexpectedly succeeded, reconcile its own receipt and event instead; never mark it superseded. If either receipt or position evidence is ambiguous, keep `UNKNOWN`, the slot and the active incident, and escalate rather than releasing claims or capacity. Resume worker controls only after the journal, position and chain nonce agree. Manual database correction must use the migration/operator role in a reviewed transaction; the app has no force-complete control.

`liquidity-funding-required` means top up the displayed maker wallet manually; the next sweep rechecks. `liquidity-partial-seed` means one side confirmed and the other remains; inspect the reserved target and remaining deadline. `liquidity-transaction-pending` or `liquidity-transaction-unknown` means investigate the saved hash/nonce before any new signing. `liquidity-contract-paused`, `liquidity-market-skipped`, `liquidity-claim-gas-required`, `liquidity-worker-stale`, and `liquidity-worker-failed` identify their direct operational causes. Notices persist across refresh and a recovery adds history rather than erasing it.

Pausing seeding stops new deposits, but existing positions and their claims remain tracked. A claimable winning or refundable position holds its slot until a verified claim receipt or verified zero payout completes it. A market that expires after one side remains a partial position and follows the actual chain payout/refund rules. Never infer profit from a manual wallet top-up: dashboard net uses confirmed stake, verified claim/refund proceeds and gas only.

## Local proof and release boundary

Use the repo's Node 24/npm 12. Run `npm run verify` and `git diff --check` from an isolated worktree. The verify script uses disposable test data for schema/RLS and network-isolated mocks for unit tests; no hosted credentials are required. Check the new signed-envelope failure-injection, six-way slot concurrency, role access, verified-session, route, claim, and component tests. For browser validation use controlled local fixtures, including conflict, funding notice, partial/pending/unknown, claim/refund/no-payout and mobile navigation. A passing local build or browser fixture does not establish hosted chain acceptance.

Do not alter hosted environment variables, database roles, QStash schedules, deployed services, or transfer USDC as part of ordinary local verification. The deployment and funding sequence needs separate authorization and explicit evidence review.
