# Weather-Only Binary Prediction Market (V1) — Context (Updated)

## Core
- Temperature-only prediction market on **Flare**
- Binary markets: **YES if temp ≥ threshold**, else NO
- Equality resolves to **YES** (no draws)
- Settlement precision: **0.1°F**
- Display precision: **whole degrees (1°F steps)**

## Supply + Cadence
- **5 total markets/day** across the whole app
- Cadence configurable via admin panel (start: **5 minutes**)
- Testing can run single-city; launch uses multiple cities

## Data
- Weather data provider TBD (needs research/testing for cost + reliability)
- Settlement reading: **first reading at/after resolve time T**
- If provider down: cancel/refund + notify + retry health checks every 5 min + pause new markets until green

## Betting + Payout
- Currency V1: **FLR**
- Per-market currency is a **variable** so stablecoin markets can be added later and coexist
- Parimutuel payout: winners split losers proportionally
- Fee: **1%**

## Wallet / Frontend
- WalletConnect via **Thirdweb**

## Automation + Admin Loop
- Creation + settlement automated end-to-end (automation-only settlement in V1)
- Voting/suggestions to guide demand and unlock slots
- Weekly AI email to admin with top suggestions + ROI estimate
- Admin approves via YES/NO and confirms city
- System runs 4-hour integration test window post-approval and requests final YES/NO
