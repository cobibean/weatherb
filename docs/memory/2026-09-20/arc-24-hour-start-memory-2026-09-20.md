# Arc 24-hour acceptance start — September 20

Executed stage two through Node 24.21.0 and development runner: arc:setup, status,
start, no-winners and check. Fresh Arc proxy unchanged. Core market 2 (Austin >=78F)
created 12:08:23 UTC with exact 86400-second duration; YES 0.02 + 0.01 repeated bet,
NO 0.02. NoWinners fixture market 3 (Austin >=1000F), YES only 0.01; resolve time
September 21 12:08:47 UTC, manual duration 86399 seconds. All six receipts successful.

Chain/DB fields and IDs compared and match. Extended read-only arc:check output with
public market records so verification can use the existing protected environment
runner without exposing credentials. ESLint/typecheck pass and live query succeeds.
Public evidence: docs/testing/evidence/arc-24-hour-start-2026-09-20.json.
Both local worker pause flags true, hosted jobs unchanged, all old records preserved.

Updated SAME start-arc-testnet-lifecycle heartbeat to September 21 07:09:47 Central,
60 seconds after later actual deadline. Core observation cutoff 12:18:23 UTC,
NoWinners cutoff 12:18:47 UTC. Real-weather retries bounded; missed window cancels
and leaves weather acceptance open. Claims for generated wallets only. Pause this
heartbeat once terminal. No new deployment or additional market creation authorized
by stage three. Yesterday's user wallet claim and visual acceptance already pass.

Local preview was stopped; restarted through npm run dev (Node 24.21.0 / isolated
profile). Browser verified both active markets and core 0.05 pool / 60:40 share.
Preserved concurrent design changes. No browser signing or extra test stakes.
