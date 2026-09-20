# Arc configuration and complete testnet wallet lifecycle

Status: implementation and fresh Arc deployment completed September 19, 2026; live
cancellation/refunds and manual market 1 weather resolution/winning test claim verified.
Exact 24-hour resolution, NoWinners and remaining browser wallet acceptance remain open. See [acceptance evidence](../testing/arc-testnet-lifecycle-acceptance.md).
Manual market 1 resolved NO at 95.8°F on September 19; the user subsequently claimed their
0.606764705882352941 USDC payout, verified by receipt and balance change. Markets 2 and 3 were created September 20: core duration exactly 86,400 seconds,
repeated/opposing stakes confirmed; one-sided NoWinners fixture funded. The same
heartbeat next runs September 21 at 07:09:47 Central for settlement/claims.

## Outcome and boundary

Prove the actual product journey against a fresh Arc testnet deployment and the
owned local PostgreSQL database: create/display a market, connect a wallet, place
opposing native-USDC bets, resolve using valid weather, and receive a winning claim.
Also prove cancellation/refunds, NoWinners, repeated bets, and both-side stakes.
Keep hosted schedules paused, Supabase deferred, and existing Coston2 claims separate.
No mainnet transaction, paid upgrade, token distribution, swaps, or optional features.

## A. Configuration and wallet dependencies

1. Recheck current Arc documentation and RPC chain ID before wiring clients. The
   official testnet settings checked during planning are chain 5042002,
   `https://rpc.testnet.arc.io`, and `https://explorer.testnet.arc.io`.
2. Create one shared Arc configuration for browser, server, deployment, explorer,
   wallet switching, and signing. Fail on chain/address mismatch; remove active
   Coston2 defaults. Keep legacy history/config recoverable outside the restart path.
3. Recheck stable Thirdweb/wallet dependencies and the advisory report. Prefer a
   current supported parent release, with no blind transitive-major overrides.
   If the supported SDK cannot meet the wallet requirement, present a bounded
   replacement decision before expanding into a provider migration.
4. Native USDC uses **18 decimals** in balance RPCs, transaction values, bets, and
   payouts. Its ERC-20 view uses six decimals but is the same balance; show one USDC
   balance, use payable calls, and require no ERC-20 approval for native bets.
5. Replace active FLR labels, faucet/explorer links, hardcoded networks, and currency
   helpers coherently. Preserve current 0.01 native-unit minimum, 1% fee, ten-minute
   betting buffer, 24-hour duration, and ties-to-YES behavior. Read actual deployed
   settings for validation/estimates, including non-default fee regression tests.
6. Test amount precision/round trips, balance plus gas checks, wallet switching,
   rejected signatures, disconnect/reconnect, failure/retry, and fee estimates.

Exit: safe local verification passes, no active legacy network paths, selected wallet
stack has explicit compatibility/advisory evidence. No deployment yet.

## B. Isolated testnet access

- Generate fresh test-only owner/deployer, settler, and bettor accounts in an ignored
  restricted local file once execution is authorized. Never reuse legacy signer
  credentials or request the user's primary wallet seed/private key.
- Obtain faucet USDC and verify each balance on chain; use a small explicit test
  funding allocation. Escalate any human challenge or faucet access limitation.
- Check existing accessible project settings for a valid wallet client identifier
  and Tomorrow.io key without printing values. Local `.env` is currently absent;
  `.env.arc-dev` has neither credential configured. Presence/validity elsewhere is
  unverified. Request secure configuration only if existing access cannot supply it.
- Extend the explicit development environment allowlist for the selected fresh
  testnet credentials. Ordinary verification still strips all live credentials.
- Keep QStash optional: invoke workers deliberately. Any signing entry point must
  validate chain ID and fresh deployment identity and respect pause flags.

Exit: funded test accounts, working RPC/weather access, and isolated configuration.
No Supabase upgrade or existing-project modification is required.

## C. Fresh deployment and persistence

- Run full verification and review the deployment script's network/owner/settler
  checks. Deploy fresh implementation plus proxy; do not upgrade Coston2 contracts.
- Record chain ID, deployment receipts, addresses, version, ABI/build identity,
  owner/settler, minimum bet, fee, betting buffer, and bytecode verification evidence.
- Bind the empty development database to that deployment. Confirm its eight cities
  and enforce unique market IDs. Wire the app to this address.
- Deliberate lifecycle calls can temporarily unpause local worker flags while hosted
  schedules remain disabled; restore local flags after acceptance. Do not pause the
  contract in a way that prevents outstanding test claims.

Exit: app, RPC, wallet, contract, and database agree on one Arc testnet deployment.

## D. Actual wallet lifecycle and evidence

| Scenario | Required evidence |
| --- | --- |
| Core 24-hour market | Creation receipt, exact duration/deadline, visible market, opposing bets, repeated bets, DB/chain IDs matching |
| Wallet UX | Connect/switch, account balance and USDC display, rejected request recovery, successful browser-originated bet and claim |
| Resolution | Provider observation inside target window; ties-to-YES and valid outcome; successful receipt and matching terminal DB row |
| Winnings | Recorded fee, getter/UI payout agreement, actual balance change accounting for gas, no double claim |
| Cancellation | Explicit cancellation, full refund including both-side stakes, correct claim method, terminal DB record |
| NoWinners | One-sided losing pool, full stake recovery, zero protocol fee, successful claim |
| Recovery | Duplicate scheduled request creates one market; successful transaction plus failed DB persistence returns an error and later reconciles without a duplicate |

Use fresh test accounts for unattended transaction checks and a real supported
browser wallet for the product workflow. User-owned wallet unlocks or approvals may
require the user. A script-only lifecycle does not establish wallet UI acceptance.

At least one market must observe the real 24-hour duration and actual weather window.
Short-duration/local-clock fixtures are supplementary checks, not substitutes. Arrange
an explicitly authorized follow-up for the target time; do not leave a blocking
24-hour tool wait or assume a future wakeup exists. If the valid window is missed,
verify cancellation and run another market rather than claiming resolution passed.

Use a supported nonnegative-temperature test case. The unsigned-temperature ABI
still rejects negative Fahrenheit; signed support versus an explicit product limit
is a later product/release decision, not silently included here.

## E. Closeout and next decision

Record transaction links, observation timestamps, expected/actual native amounts,
database checks, wallet/browser outcomes, and any failures in an acceptance report.
Update the canonical readiness plan. Assess whether the core product is independent
of the deferred features. Mark incomplete gates honestly.

Hosted CI requires a future push/PR. Live scheduled-operation acceptance (including
five UTC slots, retries, and recovery under the deployed setup) remains a separate
gate before enabling schedules. Mainnet, paid hosting, and public launch remain
separate decisions. A working local/testnet lifecycle does not authorize those.

## What may require the user

Nothing blocks starting implementation once authorized. Possible interruptions:
missing/inaccessible wallet-service or weather credentials; faucet human challenges;
user-wallet unlock/connect/sign approvals; or a wallet-provider replacement decision
if current supported dependencies cannot meet requirements. Ask only at an actual
blocker and continue independent work where possible. Secrets belong in secure local
configuration, never in chat. Supabase can stay local throughout.

Sources checked September 19:
[Arc connection settings](https://docs.arc.io/arc/references/connect-to-arc),
[native USDC model](https://docs.arc.io/arc/concepts/stablecoin-native-model),
[Circle faucet](https://faucet.circle.com/).
Project references: [canonical readiness plan](2026-09-18-arc-usdc-readiness-plan.md),
[phase 4 report](2026-09-19-phase-4-money-settlement.md),
[dependency checkpoint](2026-09-18-dependency-security-cleanup.md).
