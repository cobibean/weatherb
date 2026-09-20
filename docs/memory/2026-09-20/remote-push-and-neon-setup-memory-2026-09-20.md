# Remote push and Neon setup — September 20

User requested sharing the test markets with teammates. Committed Arc restart and
integrated Afterglow work as 38778dc on codex/arc-phase-1-baseline; pushed to origin.
Draft PR https://github.com/cobibean/weatherb/pull/2 created and attached. No merge.
Unrelated docs/research and August MCP research memory remain untracked/uncommitted.

Verification: lint/types; 8 safety, 62 shared, 175 web, 14 DB, 114 Foundry tests;
production build and ABI check passed. First build failed due .next cleanup race;
retry passed. Gitleaks staged scan zero. Local app restarted after build. Active
Vercel cron config now empty; definitions saved in deferred/vercel-crons.json.

User explicitly requested FAKEDEX deletion. Supabase CLI deleted paused project
adqlusvjyrhtdayipmkv, confirmed absent from project list. Creation of weatherb-arc-dev
still rejected by two ACTIVE free-project quota; paused projects never counted.
Speakeasy and Hotspot untouched. User chose another free PostgreSQL host, then Neon.

Vercel CLI authenticated as cobibean, team cobi-beans-projects
(team_2l4gGocPPIEpAB4OWmKXM5LJ). Existing weatherb Vercel project found. Vercel connector
list_teams returned empty but CLI works. Existing Neon marketplace installation
icfg_e1AcK8h7hbAudk44rp5FQ7UB advertises free plan free_v3 (no credit card).
No Neon resource created or credentials pulled yet, no Vercel deployment performed.

User asked to open Neon and said they will make account. Opened console.neon.tech in
IAB tab 15, marked handoff; it navigated to org-steep-silence-53735298/welcome, already
signed in, first-project form. Form shows project name, AWS US East 2 Ohio, Postgres
on, other services off. User owns account setup; next step dedicated weatherb-arc-dev
free Postgres, schema/roles/seed/chain reconciliation, Vercel env and test deployment.
Preserve isolated local profile, test signer keys and September 21 settlement heartbeat.
Never publish local Unix-socket DB URL or signer keys. Hosted jobs stay paused.

## Completed Neon setup and public site (supersedes setup pending above)

User created Neon free project silent-dream-20560813, branch
br-fragrant-glade-b5x8jk6y, Postgres 18 AWS Ohio. User approved Neon CLI OAuth.
Restricted weatherb_app / weatherb_migrator roles bootstrapped; 8 migrations,
8 cities, 4 chain-reconciled markets, 17 RLS tables. Runtime verified no schema
CREATE or BotWallet read privileges. Separate ignored mode-0600 .env.arc-hosted;
local .env.arc-dev and signer files unchanged. Owner URL private under .tools only.

Public Vercel project weatherb-arc-testnet (prj_Xf7r8PYDcxuvtLKApRK4YvfunSfi),
https://weatherb-arc-testnet.vercel.app, deployment dpl_9JaivbrVbc2Lvgs74mcPthzL5P18.
Vercel runtime has only restricted DB, public wallet/Arc settings, RPC and env-loader
controls. No signing/migrator/weather/cron credentials. Private local files excluded
from upload. Existing weatherb project/domain remain unchanged; its automatic PR
preview failed because it lacks DATABASE_URL. GitHub verify passed for 38778dc.

New npm run arc:hosted -- migrate|seed|reconcile|check uses explicit guarded Neon
profile and no wallet files. NoWinners fixture 3 marked isTest=true in hosted DB to
protect the one-sided acceptance test from teammate bets; reconciliation preserves
flag. Market2 remains public. Local worker flags and both hosted flags paused.

Verification: lint/typecheck, 10 safety tests including 2 hosted credential guards,
Vercel production build, live role/RLS checks; anonymous HTTP root/health/active/past
200, cron401; browser homepage, cents, 60/40, bet form and wallet chooser passed.
Hosted wallet-signed bet still requires human acceptance. No browser-wallet action
claimed. Same heartbeat updated (unchanged Sept21 07:09:47 Central) with hosted
reconciliation after local settle/claims, plus public health/history verification.
