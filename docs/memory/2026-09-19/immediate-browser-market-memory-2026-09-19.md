# Immediate wallet test after Arc deployment

User completed wallet connection/faucet funding and challenged the overnight wait.
Decoupled browser acceptance from scheduled24-hour acceptance. Added journaled
`arc:lifecycle browser-test`: manual30-minute forecast market, generated test wallets
bet0.01USDC each side. Existing contract/scheduled rules unchanged. Typecheck passes;
confirmed live creation and both bet receipts, persisted market1 and read it back.

Market1 Austin>=96°F; creation
0xa7b01915fda624de016e8f15e475c52d397cac29f492014e2aa55ce976d86608.
Bets close2026-09-19T22:08:01Z; resolve22:18:01Z; observation cutoff22:28:01Z.
Manual1798-second duration does not count for the exact24-hour gate.

App allows one heartbeat per thread. Attempt to add another was rejected; instead
updated existing start-arc-testnet-lifecycle, renamed Continue Arc testnet acceptance,
to today17:19 Central. Its prompt must settle/retry within valid window, cancel if
missed, claim generated-wallet funds only, and notify user to claim in browser.
THEN update SAME heartbeat to tomorrow07:05 Central for start/no-winners, then update
SAME heartbeat to their actual settlement time. Do not create a second heartbeat or
workaround cron. Hosted schedules stay paused; local flags restored after settlement.
User’s browser claim remains theirs. See updated acceptance report for current steps.
