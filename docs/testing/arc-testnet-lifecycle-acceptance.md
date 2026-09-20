# Arc testnet lifecycle acceptance

September 19, 2026. **Partially verified: deployment and live cancellation/refunds
pass, plus real weather settlement and a winning claim on manual market 1. The exact
24-hour lifecycle, NoWinners and remaining browser wallet acceptance remain open.**
This report supplements the [execution plan](../plans/2026-09-19-arc-testnet-lifecycle.md).

## Deployment and evidence

- Chain: Arc Testnet, 5042002. Native USDC balances and transaction values use 18 decimals.
- [Fresh proxy](https://explorer.testnet.arc.io/address/0xd86e2774e4a9bf2e86199791068b9350b718b891), version 2.2.0.
- Implementation: `0x00fbe142dc2092e35aa15b2707074252ef8077df`.
- Fresh owner: `0x528CbD73E836723B987c20eB8185678b2477C292`.
- Fresh settler: `0x764EE83afB11C1892826CB17203c2e3c89C0fFA9`.
- Verified settings: 0.01 USDC minimum, 100 bps fee, 600-second betting buffer;
  contract is not paused. Local scheduler and settler flags remain paused.
- Runtime implementation bytecode matches the compiled artifact after substituting
  its UUPS `__self` immutable address. This is a local bytecode comparison, not an
  explorer source-verification submission.
- [Machine-readable public evidence](evidence/arc-testnet-deployment-2026-09-19.json)
  records artifact/ABI hashes, all transaction hashes, settings and claim arithmetic.
- Owned local database contains eight active cities and cancelled market 0
  and resolved market 1, bound to this deployment. Supabase and hosted schedules were not enabled.

The Circle faucet supplied 20 test USDC to the deployer. Two USDC each were sent to
fresh settler, YES bettor and NO bettor accounts. No legacy signer was reused.
Private files stay ignored, with mode 0600 in a mode 0700 directory. Existing
Thirdweb client ID and Tomorrow.io key were recovered into the isolated profile;
the temporary hosted configuration download was removed. Weather access and the
browser's WalletConnect pairing setup both responded successfully.

## Completed checks

| Check | Evidence |
| --- | --- |
| Fresh implementation and proxy deployment | Successful receipts, chain identity and on-chain roles/settings |
| Cancellation with both-side stakes | Market 0: YES bettor staked 0.02 YES + 0.01 NO; NO bettor staked 0.02 NO |
| Both-side refund | [Claim](https://explorer.testnet.arc.io/tx/0x6893b0fbc404c53c9b9ca36100f3f934f985909d3d1786679ed253b1c9620af8): expected and actual 0.03 USDC, after adding back gas |
| Other refund | [Claim](https://explorer.testnet.arc.io/tx/0xcf1c08aef83f2e194d72e1182b0534ab70d6df0d5b28367d112644c199795a09): expected and actual 0.02 USDC, after adding back gas |
| Retry | Re-running the cancellation command reused receipts, sent no new transactions, and left market count at one |
| Persistence | Cancelled terminal record reconciled; no pending chain markets; both local worker flags paused |
| Creation timing guard | `start` rejected outside 12:00–16:59 UTC before submitting a transaction |
| Browser | Homepage loaded; Past Markets showed cancelled Austin market; MetaMask/Rabby/WalletConnect chooser and WalletConnect pairing loaded |
| Local automated verification | Lint, types, safety, unit/DB/Foundry tests, production builds and ABI consistency pass; 8 safety, 62 shared, 157 web, 14 DB and 114 Foundry tests |

The cancelled market used a manual resolve timestamp and lasted 86,398 seconds
before its original deadline. It was cancelled immediately. **It does not count as
the exact 24-hour acceptance market.** That gate uses `createScheduledMarket`, which
computes its deadline from the creation block timestamp.

## Remaining gates

- Market 2 exact duration and repeated/opposing bets are verified. Its real
  observation within the ten-minute window, resolution and winning claims remain pending.
- One-sided losing market becomes NoWinners and returns the stake without a fee.
- Real browser wallet switch/connect, rejected request/retry, bet, disconnect/
  reconnect, balance display and claim. Automated wallet-boundary tests are not
  substitutes for signatures from an actual browser wallet.
- Duplicate scheduler and DB-failure recovery have local regression/real-DB test
  coverage. They still need acceptance against the deployed operating setup before
  hosted schedules can be enabled. No public launch or mainnet clearance is implied.

## September 19 manual market result

Manual **market 1, Austin >=96°F**, resolved **NO**. Tomorrow.io returned **95.8°F**
at **22:19:00 UTC**, 59 seconds after the 22:18:01 target and inside the ten-minute
window. The successful settlement block was at 22:19:27 UTC.
[Settlement receipt](https://explorer.testnet.arc.io/tx/0x65b231ea62e4b1493a32c62a578239a56592d17537005da39bb5f02d564f72c4).
Its 1,798-second manual duration remains supplementary to the 24-hour gate.

Chain state and the database-backed Past Markets API agree on resolution, outcome,
95.8°F, YES pool 0.11 USDC, NO pool 0.51 USDC, and fee 0.0011 USDC. The generated
NO bettor claimed exactly **0.012135294117647058 USDC**, matching its balance change
plus gas. The generated YES bettor has no payout.
[Test claim receipt](https://explorer.testnet.arc.io/tx/0xd3b15f98f36bcf14d340a85f3f97ee484815b938906476a169ff696f8b9a48e6).

The user's both-side position contains 0.10 YES + 0.50 NO. Its **unclaimed payout is
0.606764705882352941 USDC**, before claim gas; the on-chain getter and Positions API
agree. User signing/claim acceptance remains open. Full public evidence is in
[evidence/arc-browser-market-settlement-2026-09-19.json](evidence/arc-browser-market-settlement-2026-09-19.json).
Both local worker pause flags were restored and verified. Hosted schedules remain
paused. Optional Redis health tracking was unavailable; this did not prevent real
weather settlement or database persistence.

## September 20: 24-hour and NoWinners markets started

| Market | Threshold | Stakes | Resolves September 21 (Central) |
| --- | --- | --- | --- |
| 2: scheduled core | Austin >=78°F | YES 0.02 + repeated 0.01; NO 0.02 USDC | 07:08:23 |
| 3: NoWinners fixture | Austin >=1000°F | YES only, 0.01 USDC | 07:08:47 |

Market 2 was created by `createScheduledMarket` at September 20 12:08:23 UTC;
its resolve time is exactly **86,400 seconds** later. Market 3 uses the manual
creation method and lasts 86,399 seconds; it does not establish the exact-duration
gate. All two creation and four bet receipts succeeded. Database IDs, deadlines,
thresholds, status, pools and fees match chain state. Both local worker flags remain
paused. No deployment, credential or hosted schedule changes were made.
[Public creation/bet evidence](evidence/arc-24-hour-start-2026-09-20.json).

The same heartbeat `start-arc-testnet-lifecycle` is updated to **September 21 at
07:09:47 Central (12:09:47 UTC)**, 60 seconds after the later resolve time. Weather
cutoffs are 12:18:23 UTC for market 2 and 12:18:47 UTC for market 3. Settlement and
generated-wallet claims remain pending. Missed windows require cancellation/refund;
never fabricate observations or mark that weather gate passed. No further markets
are scheduled by this acceptance heartbeat, which pauses after terminal closeout.

## User steps

1. No wallet action is needed for these unattended checks; generated test wallets
   already placed all required stakes. The September 19 user claim and visual fixes
   are accepted.
2. Keep the Mac and Codex available for September 21 at **07:09:47 Central**.
3. Do not bet on the **1000°F NoWinners fixture**: its one-sided pool is deliberate.

## Commands and recovery

All live commands load only `.env.arc-dev`, through the explicit development runner.
Ordinary `npm run verify` still strips live credentials and blocks real network access.

```sh
npm run arc:wallets                  # create fresh test wallets once; prints public addresses
npm run arc:lifecycle -- status      # read balances and deployment journal
npm run arc:lifecycle -- weather     # one real forecast check
npm run arc:lifecycle -- deploy      # fresh/resumed implementation + proxy deployment
npm run arc:configure                # bind journal address and fresh signers into dev profile
npm run arc:lifecycle -- fund        # journaled 2-USDC allocations
npm run arc:lifecycle -- cancel-test # journaled cancellation/both-side refund check
npm run arc:lifecycle -- browser-test # short manual market for immediate wallet testing
npm run arc:lifecycle -- start       # exact 24-hour market, only in scheduled UTC window
npm run arc:lifecycle -- no-winners  # supplementary one-sided 1000°F fixture
npm run arc:lifecycle -- settle      # deliberate local settlement; restore pause flag
npm run arc:lifecycle -- claims      # fresh test-wallet claims and balance reconciliation
npm run arc:lifecycle -- reconcile  # recover confirmed chain records into the owned DB
```

Do not deploy again for this existing environment. Live state is in
`.tools/arc-lifecycle/journal.json`, with keys separately in `wallets.json`. Commands
serialize writes using `operation.lock`. If a process crashes, check its PID and
on-chain history before removing a stale lock. A `pendingSubmission` marker means
submission was interrupted before the hash was saved: reconcile the transaction
and record its hash rather than blindly resubmitting. Claims with a receipt but
missing balance evidence require manual receipt/block balance reconstruction.
Do not discard the journal or reset the development database to recover errors.

## Wallet dependencies

Thirdweb 5.121.4 and direct Viem 2.56.8 remain the current stable releases checked
September 19. No transitive major overrides or SDK migration were introduced.
The audit still reports 27 package entries (4 high, 23 moderate) from the three
previously documented advisories. See the [security checkpoint](../plans/2026-09-18-dependency-security-cleanup.md).

The published CJS/ESM/UMD bundles of all five installed WalletConnect utils copies
(2.21.0, 2.21.1 and 2.21.8) contain no `query-string` import and use `URLSearchParams`
for pairing URI parsing. This narrows the decoder advisory's relevance for the
reviewed connection path; it is not whole-SDK security clearance or a waiver of
public-release review. Browser-wallet bet/claim compatibility remains pending.

## Live pool refresh follow-up

The browser wallet test exposed a stale homepage snapshot. Active pools now poll
confirmed chain data every five seconds while visible, refresh on focus/return,
and refresh immediately after a confirmed browser bet. Existing modal input stays
mounted and its pool preview receives updated amounts. Failed refreshes preserve
the last known values and show a retry notice. Older in-flight responses cannot
replace a newer post-bet result. Four new hook regression tests pass (161 web tests
total); live browser and local requests confirmed polling and the 0.62-USDC pool
with18%YES/82%NO. Pool display also retains cents after the earlier formatting fix.

## User claim confirmed — September 19

The user confirmed claiming through their wallet. The successful
[claim transaction](https://explorer.testnet.arc.io/tx/0x8aac9f3281641f8cb0bdaad0514879b81b82e4845d752f4d15c55204cc4a21ec)
paid exactly 0.606764705882352941 USDC. Receipt sender matches the user's account;
block balance change plus gas matches the payout. Remaining on-chain payout is zero,
and the Positions API reports `claimed: true` / `status: claimed`.
The earlier unclaimed snapshot above is superseded by this confirmation. Browser
claim acceptance passes with user confirmation and matching chain evidence; other
wallet UX gates (reject/retry and disconnect/reconnect) are not inferred from this.

**New display defect:** after claiming, Positions aggregate `totalClaimed` and
`totalWinnings` incorrectly become zero, with net profit -0.60 and ROI -100%.
The claim transferred correctly; the displayed historical totals need a focused fix.
No implementation change was made during this read-only claim verification.

## Post-claim display fixes — September 19

Fixed the historical payout omission using a separate `claimedAmount`, reconstructed
with bigint arithmetic from the settled winning stake, immutable pools and recorded
`totalFees`. Claimed refunds preserve the full both-side stake. Stats include claimed
returns and exclude unresolved stakes from settled profit/ROI. The profit card now
explicitly says before gas; claimed position cards show the amount received.

Single and bulk claim modals notify the header after each successful receipt. The
header immediately refetches claimable positions and discards older requests; failed
or unconfirmed claims do not emit the event. Page refresh after the success callback
no longer waits an extra two seconds.

Verified 165 web tests plus two new header regressions, focused ESLint, web typecheck,
and live Positions API: totalClaimed 0.606764705882352941, totalClaimable zero,
netProfit 0.006764705882352941 and ROI 1.1274509803921569%. In-app browser loaded the
positions route but has no connected user wallet, so corrected wallet-connected
visual appearance awaits the user's check. No additional transaction was submitted.

## User visual acceptance — September 19

The user confirmed the post-claim visual check passes: the navigation notification
clears and the corrected profit/ROI display is accepted. This closes the visual gate
for the claimed-stats and badge fixes. Exact 24-hour settlement, NoWinners and other
unverified wallet/scheduler gates remain separate.

September 20 browser check: restarted the stopped local development server through
`npm run dev`; homepage shows both active markets, core pool 0.05 USDC with 60% YES /
40% NO, and the one-sided 1000°F fixture. No wallet action was taken.

## Remote sharing preparation — September 20

Preparing the Arc restart and accepted Afterglow design for a branch push and draft
PR. Verified lint/types, 8 safety, 62 shared, 175 web, 14 database and 114 Foundry
tests. Production build initially hit a local .next cache cleanup race, then passed
on retry; ABI consistency passed. Staged secret scan found no secrets. Runtime
credentials, generated-wallet keys, journals and local DB files remain ignored.

Hosted database provisioning is still blocked: at the user's explicit request,
deleted paused FAKEDEX (adqlusvjyrhtdayipmkv) and verified removal. A new free
weatherb-arc-dev creation was still rejected by the two-active-project limit;
Speakeasy and Hotspot Checkout are unchanged. The user must choose hosting before a
working teammate site can be deployed. No paid plan or alternate provider selected.

Removed cron registrations from active vercel.json and saved definitions in
`deferred/vercel-crons.json` so future deploys preserve the paused-hosted-jobs intent.
The local September 21 settlement heartbeat and test markets remain intact.

### September 20 — hosted teammate access

The existing Arc proxy/markets are now available at
https://weatherb-arc-testnet.vercel.app using a separate free Neon PostgreSQL 18
project. See [hosted runbook](arc-hosted-testnet.md). Vercel deployment
`dpl_9JaivbrVbc2Lvgs74mcPthzL5P18` built successfully. Unauthenticated HTTP checks:
root, database health, active markets, and past markets all 200; settle cron 401.
Health reports ready and both workers paused. Public active list contains only
Austin ≥78°F market 2; NoWinners fixture 3 is retained with hosted `isTest=true`.
Browser verified the homepage, 0.05 USDC pool, 60/40 shares, YES bet form, loaded
contract minimum/fee settings, and MetaMask/Rabby/WalletConnect chooser. No hosted
wallet transaction was signed; that acceptance remains for the user/teammates.

The same September 21 07:09:47 Central heartbeat now runs signer-free hosted
reconciliation/check after local settlement and generated-wallet claims. This is
still a local settlement worker: the Mac must remain awake for that window. No
hosted cron, signer key, weather secret, or mainnet service was enabled.
