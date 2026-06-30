# Settlement and Data Sources

weatherB settlement is automated and based on a clear data rule: the first reading at or after the resolve time.

## What you can do here
- Understand how settlement works end to end.
- See which weather providers are used and in what order.
- Learn how weatherB handles missing or delayed data.

## Settlement overview
1. A market reaches its resolve time.
2. The settler service fetches weather data.
3. The contract resolves the market with the observed temperature.
4. Winners can claim, or everyone can refund if there are no winners.

Settlement is performed by a designated settler wallet. Users cannot resolve markets directly.

## Weather data sources
weatherB uses a single provider for settlement data:

| Provider | Notes |
| --- | --- |
| Tomorrow.io | Realtime readings used at resolve time |

Forecasts are cached for 24 hours and realtime readings for 1 hour to keep API usage under the free tier limit.

## Reading rule
The resolver uses the first reading at or after the resolve time (T). This prevents cherry-picking and makes settlement deterministic.

## Data flow
Diagram placeholder: add `assets/settlement-data-flow.png`

## If data is missing or delayed
- The settler retries with the same provider.
- If reliable data cannot be obtained, the market may be cancelled by the owner or settler.
- Cancelled or NoWinners markets are refundable.

## Contract and Explorer
- App: https://weatherb.app
- Contract (Coston2): 0x716186B29043840a165e1Faf49b85bc2101fAaC7
- Explorer: https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7
