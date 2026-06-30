# weatherB Docs

weatherB is a simple prediction market on Flare where you bet YES/NO on a temperature outcome:
"Will the temperature be >= 72F in New York City at 2:00pm?"

This documentation covers the current testnet release on Coston2. Mainnet documentation will be added when live.

## What you can do here
- Learn how weatherB markets work and how payouts are calculated.
- Place bets, track positions, and claim or refund winnings.
- Understand settlement, data sources, and trust assumptions.
- Find roadmap context.

## Quick start (3 minutes)
1. Connect your wallet (Coston2 testnet).
2. Pick an open market.
3. Choose YES or NO and enter an amount (min 0.01 FLR).
4. Confirm the transaction in your wallet.
5. Track and claim in My Positions after settlement.

## Key rules at a glance
| Rule | Value |
| --- | --- |
| Markets per day | 5 maximum |
| Temperature precision | Stored in tenths (e.g., 85.3F -> 853), shown as whole degrees |
| Tie rule | Temp == threshold means YES wins |
| Betting closes | 10 minutes before resolve time |
| Minimum bet | 0.01 FLR |
| Currency | FLR only (V1) |
| Who can resolve | Settler only |
| Fees | 1% default, max 10%, taken from losing pool |

## Trust and transparency
- Markets and payouts are on-chain.
- Settlement is executed by a designated settler wallet.
- Weather data uses Tomorrow.io as a single provider.
- All resolution inputs are recorded on-chain.

## Find what you need
- [Getting Started](getting-started.md)
- [Markets 101](markets-101.md)
- [Betting and Odds](betting-and-odds.md)
- [Settlement and Data Sources](settlement-and-data.md)
- [Using the App](using-the-app.md)
- [Refunds and Cancellations](refunds-and-cancellations.md)
- [Security and Governance](security-and-governance.md)
- [FAQ](faq.md)
- [Glossary](glossary.md)
- [Status and Roadmap](status-and-roadmap.md)
- [Community](community.md)

## Contract and Explorer
- App: https://weatherb.app
- Contract (Coston2): 0x716186B29043840a165e1Faf49b85bc2101fAaC7
- Explorer: https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7

## Disclaimer
weatherB is experimental software. Not financial advice. Use at your own risk.
