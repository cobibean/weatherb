# Manual Arc market settlement — September 19

Market 1 resolved NO using Tomorrow.io 95.8°F at 22:19:00 UTC, inside the
22:18:01–22:28:01 observation window. Settlement succeeded at 22:19:27 UTC.
No retries or fabricated timestamps were needed. Chain and database-backed Past
Markets API match pools (0.11 YES / 0.51 NO), fee (0.0011), temperature and outcome.
Generated NO bettor claim: 0.012135294117647058 USDC; balance change plus gas equals
expected. User both-side stake was 0.60; payout 0.606764705882352941 remains unclaimed
for browser signing. Receipt hashes and exact evidence are in
`docs/testing/evidence/arc-browser-market-settlement-2026-09-19.json`.

Ran arc:setup, arc:lifecycle settle, arc:lifecycle claims and arc:check using Node
24.21.0 and isolated development profile. Both local worker flags restored/paused;
hosted jobs unchanged. Optional Redis health tracking absent; settlement persisted.
No new deployment, DB reset, credentials changes or user wallet signing.

Updated the SAME heartbeat start-arc-testnet-lifecycle to September 20 07:05 Central.
Stage two creates the exact-86400-second core and one-sided NoWinners fixtures, then
reschedules itself for 60 seconds after the later actual resolve time. Stage three
uses bounded weather retries, verifies outcomes and generated-wallet claims, then
pauses. Keep Mac/Codex available. Only one heartbeat per task is supported.

Acceptance report and both Arc plans updated. Exact 24-hour, NoWinners, remaining
browser wallet UX and deployed scheduler/recovery gates remain open. No hosted or
mainnet launch clearance. No implementation changes in this settlement run.
