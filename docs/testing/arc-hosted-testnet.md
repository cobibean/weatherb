# Arc teammate test site

September 20, 2026. This deployment shares the existing Arc Testnet contract and
wallet positions with the local app. It does not create another contract or reset
the acceptance journal.

- Site: https://weatherb-arc-testnet.vercel.app
- Vercel project: `weatherb-arc-testnet`, scope `cobi-beans-projects`.
- Neon free project: `silent-dream-20560813`, branch `br-fragrant-glade-b5x8jk6y`
  (`production`), AWS Ohio, PostgreSQL 18, database `neondb`.
- Arc chain: `5042002`; proxy: `0xd86e2774e4a9bf2e86199791068b9350b718b891`.
- Teammate market: **2, Austin ≥78°F**. Bets close September 21 at 06:58:23
  America/Chicago; resolves at 07:08:23. Settlement needs a real provider observation
  within the following ten minutes.
- Market 3 (1000°F) is the one-sided NoWinners fixture. Its hosted `isTest` flag is
  true, hiding it from the public market list while preserving its chain state,
  database record, stake, and lifecycle evidence. Do not place teammate bets on it.

## Database and credentials

All eight committed Prisma migrations were applied. The baseline contains eight
cities, paused scheduler/settler flags, a binding to the proxy, and markets 0–3
reconciled directly from Arc. There was no local database reset or data dump.

`weatherb_app` is the runtime role with server CRUD policies on the active tables;
it cannot create schema objects or read legacy `BotWallet` records. The separate
`weatherb_migrator` owns migrations. All 17 tables (including migration metadata)
have RLS enabled. Runtime uses Neon's pooled endpoint; migrations use its direct
endpoint. Both require verified TLS.

Keep `.env.arc-hosted` mode 0600, separate from `.env.arc-dev`. The hosted runner
accepts only explicit Neon endpoint/role/database URLs and Arc Testnet settings.
It excludes all signer, admin, weather-provider and cron secrets. Vercel receives
only runtime `DATABASE_URL`, public Thirdweb/chain/proxy configuration, `RPC_URL`,
`WEATHERB_ENV_FILE=none`, and `NEXT_TELEMETRY_DISABLED=1`. No migration URL or wallet
file goes to Vercel. `.vercelignore` excludes every `.env.*`, `.tools`, backups,
and other non-runtime files.

## Operator commands

Use Node 24.21.0 from the repository root:

```sh
npm run arc:hosted -- migrate
npm run arc:hosted -- seed
npm run arc:hosted -- reconcile
npm run arc:hosted -- check
```

`migrate` reapplies the restricted access policy after pending migrations; `seed`
is additive. `reconcile` has no signing capability and uses the shared deployment
binding and chain-to-database reconciliation. It preserves fixture flags and
terminal records. No command loads the local test-wallet keys.

Hosted cron remains absent (`vercel.json` has `crons: []`), and both hosted worker
flags remain paused. Tomorrow's existing local heartbeat still performs settlement
and generated-wallet claims with `.env.arc-dev`; it then runs hosted reconciliation
and checks hosted health/history. The Mac must be awake for that local heartbeat.
Browser claims remain the user's or teammate's responsibility.

## Teammate acceptance

Open the site, connect a wallet, switch to Arc Testnet, obtain faucet test USDC,
and place a small YES or NO bet on Austin ≥78°F. Native USDC pays both stakes and
gas; keep a little balance for claims. The minimum stake is 0.01 USDC. Verify the
receipt and automatic pool refresh, then claim after settlement through My Positions.
No mainnet funds are involved.

Public HTTP and browser checks do not substitute for a teammate's successful
wallet connection and signed bet on this hosted origin. Thirdweb origin restrictions,
if enabled in that account, must allow `weatherb-arc-testnet.vercel.app`.
