# Claimed stats and notification fixes — September 19

User reported stale navigation notification and -100% ROI after their successful
market 1 claim. positions.ts excluded payouts once claimed; header polled only every
60 seconds independently of confirmed claims.

Added separate claimedAmount to position types/serialization and claimed-card display.
Reconstruct historical payouts from the immutable settled pools, winning stake and
recorded totalFees, using exact bigint division matching the contract. Refunds return
both stakes. Stats retain paid returns, include refunded amounts in totalClaimed and
exclude pending stakes from settled profit/ROI. Profit label explicitly excludes gas.

Receipt-confirmed single/bulk claims dispatch wallet-scoped positions-updated events.
Header refetches immediately with abort/stale-response/unmount protection. The page's
extra two-second post-success refresh delay was removed. No additional signing.

Verified 165 web tests plus two header tests (immediate clearing, older-response
rejection, unrelated wallet event), focused ESLint, typecheck, live API against user's
claimed position: profit 0.006764705882352941 USDC; ROI 1.1274509803921569%; no claimable
balance. In-app browser route loaded without a connected wallet; user visual check
still needed. Lifecycle acceptance report updated. Scheduled heartbeat unchanged.
