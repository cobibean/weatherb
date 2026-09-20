# Arc configuration and live deployment

September 19, 2026. User authorized implementation of the existing Arc lifecycle
plan and asked for step-by-step actions at a stopping point. No new repo, hosted
Supabase, mainnet, paid service or restoration of deferred features was authorized.

## Result

Implemented shared Arc Testnet config (5042002, current .arc.io RPC/explorer), native
USDC18 parsing/labels, deployed minimum/fee reads, wallet switching, gas checks and
receipt-confirmed bet/claim UI. All active clients use Arc. MetaMask, Rabby and
WalletConnect are exposed; buying tokens and duplicate ERC-20 balances are omitted.
Single-claim rejected-request/retry and disconnect/chain mismatch behavior have
regression coverage. Wallet signatures themselves remain unverified.

Recovered existing Thirdweb and Tomorrow.io service credentials from Vercel through
a temporary restricted env pull, copied only those services into .env.arc-dev, and
removed the pull file. Weather forecast works. Generated four fresh test wallets;
all private material stays in ignored restricted files. Never reuse legacy keys.

Deployed fresh WeatherMarketV2 2.2.0 implementation and proxy on Arc. Proxy:
`0xd86e2774e4a9bf2e86199791068b9350b718b891`. Bytecode compared to compiled runtime,
including UUPS immutable substitution. Owner/settler/settings checked. Contract
is unpaused; both database worker flags stay paused. Local DB binds to Arc/address.
Hosted jobs remain paused. Legacy contracts untouched.

Live cancellation market 0 used 0.02 YES + 0.01 NO from one wallet and 0.02 NO from
a second. Claims returned 0.03 and 0.02 USDC exactly after accounting for gas.
Receipt-journal retry sent no additional transactions. Database shows terminal row;
market count remains one. This manual market's original duration was 86,398 seconds,
so it must NOT be counted as the exact 24-hour scheduled acceptance market.

## Evidence and verification

- Canonical status: docs/plans/2026-09-18-arc-usdc-readiness-plan.md.
- Execution: docs/plans/2026-09-19-arc-testnet-lifecycle.md.
- Acceptance, user instructions, receipts and recovery:
  docs/testing/arc-testnet-lifecycle-acceptance.md.
- Public deployment artifact: docs/testing/evidence/arc-testnet-deployment-2026-09-19.json.
- Full npm run verify passed: 8 safety, 62 shared, 157 web, 14 disposable-DB and
  114 Foundry tests, lint/types, production builds and compiled ABI consistency.
- Browser: localhost homepage, cancelled Austin market in Past Markets, wallet
  chooser and WalletConnect pairing ready. No user wallet connected/signed.
- Thirdweb5.121.4 and Viem2.56.8 remain latest stable. Audit unchanged27/4high/23moderate.
  Published bundles in five WC utils copies have no query-string import and use
  URLSearchParams. This narrows that path; not complete SDK/public-release clearance.

## Resume

A one-time thread heartbeat `start-arc-testnet-lifecycle` is active for September20
07:05 America/Chicago (12:05UTC). This is a bounded acceptance follow-up, not a restart
of hosted cron. It should run arc:setup, status, start and no-winners, then create a
new wakeup 60seconds after the later real on-chain resolveTime. That settlement
wakeup does not yet exist. Creation outside12–16UTC fails safely. Actual weather,
NoWinners, winning claims and browser signatures are still pending. If the window
is missed, cancel/refund and repeat rather than asserting success.

Node24.21.0 from /Users/cobibean/.nvm/versions/node/v24.21.0/bin. `npm run arc:dev`
serves127.0.0.1:3000; owned local PG remains running. `arc:wallets` creates fresh keys
once; `arc:lifecycle` status/weather/deploy/fund/reconcile/cancel-test/start/no-winners/
settle/claims uses .env.arc-dev only. `arc:configure` writes fresh journal address/
signers into that profile. Never redeploy/reset this environment for routine recovery.

Journal .tools/arc-lifecycle/journal.json stores receipt hashes, build identity,
market IDs and balance evidence; keys are separate in wallets.json. Operation lock
serializes mutations. A pendingSubmission marker requires manual chain reconciliation
before clearing; do not blindly retry uncertain sends. A crashed lock can be removed
only after confirming its recorded PID is no longer operating. Do not print secrets.

Existing large uncommitted phases1–4 changes were preserved; this turn did not stage,
commit or push. AGENTS gained a current-status pointer above historical Flare rules.
Formatting-only pass followed full verification; git diff whitespace check passes.
