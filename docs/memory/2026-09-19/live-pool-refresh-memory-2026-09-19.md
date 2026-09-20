# Live pool refresh

User observed percentages stayed stale after confirmed bets until manual reload.
HomeClient previously rendered only the server-provided snapshot. Added
use-live-markets.ts: five-second visible-tab polling of /api/markets?status=active,
no-store requests, focus/visibility refresh, abort/stale-response protection and
cleanup. BetModal onSuccess fires after receipt confirmation to refresh immediately.
Selected modal receives latest pools without remounting or resetting entered amount.
Failure keeps last known data with a retry notice. Error retry no longer reloads page.

Verified lint, web typecheck, all161webtests including4new refresh regressions,
plus browser showing0.62USDC and18%YES/82%NO and repeated live API requests.
This change leaves signing, contracts, settlement, keys and automations untouched.
The manual market is now at its settlement time; existing17:19Central heartbeat
handles it. Browser signatures/claims remain user acceptance. Existing unrelated
uncommitted changes and any separate design worktree remain intact.
