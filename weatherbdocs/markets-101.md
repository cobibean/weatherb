# Markets 101

This page explains how weatherB markets are structured, how time and temperature work, and what each status means.

## What you can do here
- Learn the exact market question format and rules.
- Understand temperature precision and the tie rule.
- See how market status changes over time.

## Market question format
Every market is a simple YES/NO question:

"Will the temperature be >= X F at time T in City?"

Example: "Will the temperature be >= 72F in New York City at 2:00pm?"

## Temperature precision
- Temperatures are stored as tenths of a degree (85.3F is stored as 853).
- The app displays whole degrees for clarity (85.3F is shown as 85F).

## Tie rule
If the observed temperature equals the threshold, YES wins. The rule is always >=.

## Betting window
- Markets open when created.
- Betting closes 10 minutes before the resolve time.
- After betting closes, the market status becomes "Closed" until it resolves.

## Market lifecycle
Screenshot placeholder: add `assets/market-lifecycle.png`

## Market statuses
| Status | Meaning | What you can do |
| --- | --- | --- |
| Open | Betting is live | Place YES or NO bets |
| Closed | Betting ended, waiting to resolve | Wait for settlement |
| Resolved | Outcome is final | Claim winnings if you won |
| Cancelled | Market was cancelled | Refund your bet |
| NoWinners | Winning pool was empty | Refund your bet |

## Rules and constraints
| Rule | Value |
| --- | --- |
| Markets per day | 5 maximum |
| Multiple bets per wallet | Allowed (bets accumulate) |
| Temperature storage | Tenths of a degree (e.g., 85.3F -> 853) |
| Display precision | Whole degrees only |
| Tie rule | Temp == threshold means YES wins |
| Currency | FLR only (V1) |
| Settlement | Only settler can resolve |
| Fee | 1% default, max 10%, from losing pool |
| Betting close buffer | 10 minutes before resolve time |
| Minimum bet | 0.01 FLR |

## Multiple bets and sides
You can place multiple bets on the same market. The contract tracks your YES and NO amounts separately. If you bet both sides, your final payout depends on the winning side only.

## Time zones
Resolve times are shown in your local time zone. On-chain timestamps are stored in UTC seconds.

## Contract and Explorer
- App: https://weatherb.app
- Contract (Coston2): 0x716186B29043840a165e1Faf49b85bc2101fAaC7
- Explorer: https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7
