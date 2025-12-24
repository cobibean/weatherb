# PRD — Weather-Only Temperature Prediction Market (V1)

**Status:** Epics 0-6 Complete (Dec 2024) | Next: Epic 7 (User Voting)

## 0) One-liner
An automated, low-maintenance prediction market on **temperature** that lists **5 total binary markets/day** (across the entire app), lets users bet YES/NO on "temp ≥ threshold," and auto-settles via trusted settler pattern. Runs mostly unattended on Vercel, with a lightweight weekly admin email loop for growth decisions.

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

**Implementation:** Vercel Cron job runs daily at 6 AM UTC (`/api/cron/schedule-daily`)

### Daily scheduler
- Creates exactly **5 markets/day** on-chain
- Uses city rotation (tracked in Upstash Redis)
- Fetches forecast from weather provider
- Calculates threshold dynamically around forecast

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

**Implementation:** Vercel Cron job runs every 5 minutes (`/api/cron/settle-markets`)

- Settlement service is the only entity that resolves markets in V1 (trusted settler pattern)
- Fetches actual temperature from weather provider (MET Norway primary)
- Calls contract `resolveMarket()` with:
  - resolved temp (0.1°F precision as tenths)
  - timestamp used (first reading at/after T)
  - outcome boolean calculated on-chain via `temp >= threshold`

### Outage behavior
If provider/API down:
- Settler detects failure and logs error
- Admin can manually cancel/refund affected markets via admin panel
- Future: Automated cancellation after timeout threshold
- Health monitoring via admin dashboard

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

**Status:** ✅ Complete (Epic 6)

**Implementation:** `/admin` routes with wallet-based authentication

Must-have settings (✅ implemented):
- Emergency pause (contract-level via pause/unpause)
- Settler pause (controls Cron job behavior)
- City management (add/remove cities)
- System configuration (database-backed)
- Market cancellation (contract call)

Observability (✅ implemented):
- Admin dashboard with system stats
- Action logs (all admin operations tracked)
- Market logs viewer

Future enhancements:
- Provider uptime monitoring
- Real-time contract stats (requires indexing)
- Fee/volume analytics

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

## 11) Implementation Status

### ✅ Completed (Epics 0-6)
- **Epic 0-3:** Monorepo, contracts, weather providers (MET Norway, NWS, Open-Meteo), settlement
- **Epic 4:** Automation via Vercel Cron (scheduler + settler)
- **Epic 5:** Web app UI (Next.js 16.1, React 19, shadcn/ui)
- **Epic 6:** Admin panel with wallet auth and contract integration

**Key Simplifications Made:**
- Settled on **trusted settler pattern** (removed FDC complexity)
- **MET Norway** as primary provider (free, high-quality, 5-min nowcast)
- **Vercel Cron** for automation (removed standalone services)
- **Single contract** (not factory pattern)

### 🚧 Pending (Epics 7-10)
- **Epic 7:** User voting/suggestions for markets
- **Epic 8:** AI-generated weekly admin reports (OpenAI + Resend)
- **Epic 9:** Event indexing (subgraph or similar)
- **Epic 10:** Security hardening, monitoring, alerts

### 📝 Known Limitations (V1)
- No permissionless settlement (admin/settler only)
- FLR only (stablecoins planned for V2)
- Single admin wallet (multi-sig planned)
- Polling for price updates (WebSocket upgrade planned)
- Mock data in admin dashboard (requires indexing)
