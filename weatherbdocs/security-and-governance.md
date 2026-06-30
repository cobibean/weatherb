# Security and Governance

This page explains how roles, permissions, and limits work in weatherB.

## What you can do here
- Understand who can do what on-chain.
- Review upgradeability and fee limits.
- Learn the core trust assumptions.

## Roles
| Role | What they can do |
| --- | --- |
| Owner | Create markets, pause/unpause, set parameters, cancel markets, withdraw fees |
| Settler | Resolve markets and cancel markets |
| User | Place bets, claim winnings, request refunds |

## Upgradeability
weatherB uses a UUPS upgradeable contract. The owner can upgrade the contract implementation. This allows bug fixes and improvements but requires trust in the owner key.

## Admin capabilities vs limitations
| Admin CAN | Admin CANNOT |
| --- | --- |
| Create markets | Change outcomes after resolution |
| Pause betting | Resolve markets (settler only) |
| Cancel markets | Withdraw user stakes |
| Set fee, min bet, and betting buffer | Bypass on-chain rules |
| Update settler address | Claim winnings for users |

## Fees and limits
- Default fee is 1% of the losing pool.
- Maximum fee is capped at 10%.
- Minimum bet is 0.01 FLR.
- Betting closes 10 minutes before resolve time.

## Pause controls
The owner can pause betting, claims, and refunds during emergencies. Pausing does not change market outcomes.

## Contract and Explorer
- App: https://weatherb.app
- Contract (Coston2): 0x716186B29043840a165e1Faf49b85bc2101fAaC7
- Explorer: https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7

## Trust assumptions
- Settlement is performed by a designated settler wallet.
- Weather data comes from a trusted third-party provider (Tomorrow.io).
- Upgrades are possible and visible on-chain.
