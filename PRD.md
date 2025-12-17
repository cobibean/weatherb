# PRD — Weather-Only Temperature Prediction Market (V1)

## 0) One-liner
An automated, low-maintenance prediction market on **temperature** that lists **5 total binary markets/day** (across the entire app), lets users bet YES/NO on “temp ≥ threshold,” and auto-settles via a Web2→proof→contract verification flow (Flare FDC-style). Runs mostly unattended, with a lightweight weekly admin email loop for growth decisions.

---

## 1) Goals / Non-goals

### Goals
- Fully automated: create → accept bets → resolve → payout.
- Simple UX: city-based cards, 2-button betting, 1 bet per wallet per market.
- Deterministic settlement: single objective temp reading drives outcome.
- Configurable cadence from admin panel (start: **5 minutes**).
- **5 total markets/day** supply constraint in V1.
- Fee: **1%**.
- Growth: vote/suggest loop + weekly AI admin email approvals.
- Wallet: **WalletConnect via Thirdweb**.

### Non-goals (V1)
- Permissionless settlement.
- Multi-outcome markets / LP / AMM / orderbooks.
- Weather metrics beyond temperature.
- Fully automated expansion without any admin approvals (admin stays in loop for scaling).

---

## 2) Locked Rules

- Market proposition: **TEMP_F ≥ THRESHOLD_F**.
- Outcome tie-break: **temp == threshold → YES**.
- Settlement precision: **0.1°F** (tenths).
- Display precision: **1°F steps** (clean UX), but settlement uses 0.1°F under the hood.
- Reading rule: **first reading at or after T**.
- Cities: major cities (name on card; lat/long in details).
- Supply: **5 total markets/day** across the whole app.
- One bet per wallet per market.
- Fee: **1%**.
- Betting currency (V1): **FLR** on Flare.
- Currency is a **per-market variable** (so FLR markets and future stable markets can coexist later).

---

## 3) Environments

### Testing mode (pre-launch)
- Run with **one city** to harden end-to-end automation + settlement.
- Keep cadence adjustable (e.g., 60s / 5m).

### Launch mode
- Enable **multiple cities** (still only 5 total markets/day initially).

---

## 4) User Experience

### Market Card
- City (front + center)
- Resolve time (local + UTC)
- Threshold (displayed as whole °F)
- YES/NO implied prices
- Currency badge (FLR in V1)
- Bet YES / Bet NO
- Details:
  - lat/long
  - provider name
  - settlement rule (“first reading at/after T”)
  - post-resolve: final temp (0.1°F) + timestamp used + on-chain record link

### Betting
- WalletConnect (Thirdweb)
- User selects side and amount
- One bet total per wallet per market (UI should prevent, contract must enforce)

---

## 5) Market Generation (Automated)

### Daily scheduler
- Creates exactly **5 markets/day**.

### Market selection inputs
- City
- Resolve timestamp T (aligned to cadence)
- Threshold (dynamic around forecast)

### Threshold logic (dynamic around forecast)
- Pull forecast temp for (city, T), in °F.
- Round to clean **whole-degree** display threshold.
- Optional variety: pick from a small band around forecast (e.g., forecast-2, forecast, forecast+2) but displayed as whole degrees.
- Store internally as **tenths-of-degree** integer (e.g., 85°F displayed → internally 850).

---

## 6) Pricing + Payout (Parimutuel)

### Pools
- YES pool, NO pool.
- Implied price display:
  - P(YES) = YES_pool / (YES_pool + NO_pool)

### Settlement payout
- Winners split losers proportionally to their share of the winning pool.
- Fee: **1%** (recommended: taken from losing pool only).

### Currency
- Per-market `currency` field:
  - V1: FLR
  - Future: stablecoin markets (parallel)

---

## 7) Settlement (Automation-only)

- Settlement bot/service only entity that resolves markets in V1.
- Uses “proof + decoded data” to update market outcome.
- Stores:
  - resolved temp (0.1°F)
  - timestamp used (first reading at/after T)
  - outcome boolean

### Outage behavior
If provider/API down:
- Cancel/refund affected markets.
- Automated user status message.
- Health checks every 5 minutes.
- Pause new market creation until green.

---

## 8) Voting + Admin Growth Loop

### User voting
- Users vote/suggest markets (city/time preferences).
- Gamified “unlock slots” loop (V1 can just collect votes; slot unlock can be phased).

### Weekly admin email (AI-generated)
- Top suggestions + votes + momentum
- Estimated demand/ROI
- Recommendation
- One-click approve YES/NO + confirm city

### Post-approval test window
- After approval, system runs automated integration tests for **4 hours**.
- Sends results email with final YES/NO approval.

---

## 9) Admin Panel

Must-have settings:
- Cadence (start: 5 minutes, adjustable)
- Market count/day (fixed at 5 in V1; leave config hook)
- City allowlist
- Currency enablement toggles (future-proof)
- Emergency pause

Observability:
- Provider uptime + latency
- Settlement queue/backlog
- Failed settlement logs
- Volume + fees

---

## 10) On-chain Requirements (High-Level)

Contract supports:
- Create markets with:
  - cityId, lat/long reference
  - resolveTime T
  - threshold (tenths °F integer)
  - currency (FLR now; variable later)
- Place bet (one bet per wallet per market)
- Resolve market (automation-only call)
- Cancel/refund
- Claim winnings
- Fee accounting (1%)

---

## 11) Remaining research work (explicit)
- Evaluate weather providers by cost, coverage, uptime, and update frequency sufficient for “first reading at/after T.”
- Build provider adapter layer for easy switching.
