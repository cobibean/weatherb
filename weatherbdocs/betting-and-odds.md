# Betting and Odds

weatherB uses parimutuel pools. Your payout depends on the final YES and NO pools at settlement.

## What you can do here
- Understand how odds are calculated from pools.
- See how fees affect payouts.
- Walk through a simple payout example.

## Parimutuel pools
Each market has two pools:
- YES pool: total FLR bet on YES
- NO pool: total FLR bet on NO

When the market resolves, winners split the losing pool proportionally to their share of the winning pool.

## Implied odds
Odds are implied by pool sizes, not fixed by the house. As pools change, odds move.

Example:
- If YES has 40% of the total pool, implied YES probability is about 40%.
- If NO has 60% of the total pool, implied NO probability is about 60%.

## Fee model
- The protocol takes a fee from the losing pool.
- Default fee is 1% of the losing pool.
- Maximum fee is capped at 10%.

## Payout formula (simplified)
If YES wins:

payout = stake + (stake / yesPool) * (noPool - fee)

If NO wins, swap yesPool and noPool.

## Payout example
Assume the following at settlement:
- YES pool: 40 FLR
- NO pool: 60 FLR
- Fee: 1% of losing pool = 0.6 FLR
- Your YES stake: 10 FLR

Your payout:
- Net losing pool = 60 - 0.6 = 59.4
- Share of losing pool = (10 / 40) * 59.4 = 14.85
- Total payout = 10 + 14.85 = 24.85 FLR

## Payout preview vs final payout
The app shows a payout preview when you place a bet. The final payout is based on the pools at settlement, so it may change as other users bet.

## No winners case
If there are zero bets on the winning side, the market resolves as NoWinners and everyone can refund their stake.

Diagram placeholder: add `assets/payout-example.png`

## Contract and Explorer
- App: https://weatherb.app
- Contract (Coston2): 0x716186B29043840a165e1Faf49b85bc2101fAaC7
- Explorer: https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7
