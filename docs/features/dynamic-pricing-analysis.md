# Dynamic Share Pricing Analysis

## Executive Summary

**The WeatherB contract already implements dynamic pricing** via pari-mutuel pool-proportional payouts. The more bettors favor an outcome, the lower the return for that side. **No contract changes are needed**—only UI improvements to communicate this effectively to users.

---

## How Current Pricing Works

### The Pari-Mutuel Model

WeatherB uses a **pari-mutuel betting system** where:

1. All bets go into two pools: YES pool and NO pool
2. When the market resolves, winners split the losing pool
3. Each winner's share is proportional to their stake in the winning pool
4. A 1% fee is taken from the losing pool before distribution

### Payout Formula

```
payout = stake + (stake / winningPool) × losingPool × 0.99
```

Or equivalently:
```
multiplier = 1 + (losingPool × 0.99) / winningPool
```

### Example Scenarios

#### Scenario 1: Balanced Market (50/50)
- YES Pool: 50 FLR
- NO Pool: 50 FLR
- You bet 1 FLR on YES
- If YES wins: payout = 1 + (1/51) × 49.5 = **1.97 FLR** (~2x return)

#### Scenario 2: Lopsided Market (80/20)
- YES Pool: 80 FLR  
- NO Pool: 20 FLR
- **Betting YES (majority side):**
  - You bet 1 FLR on YES
  - If YES wins: payout = 1 + (1/81) × 19.8 = **1.24 FLR** (1.24x return)
- **Betting NO (minority side):**
  - You bet 1 FLR on NO
  - If NO wins: payout = 1 + (1/21) × 79.2 = **4.77 FLR** (4.77x return)

### Key Insight: Built-in Contrarian Incentive

The system **automatically** incentivizes contrarian bets:
- Heavy YES markets → Better returns for NO bettors
- Heavy NO markets → Better returns for YES bettors
- This naturally tends to balance markets over time

---

## Current UI Gaps

### What Users See Now

| Component | Shows | Missing |
|-----------|-------|---------|
| OddsDisplay | Pool percentages (70% / 30%) | Effective multipliers |
| BetModal | Bet amount input | Potential payout, impact on odds |
| MarketCard | Odds bar | Return multipliers |
| HeroCard | Pool total, odds bar | "If you bet X, you could win Y" |

### What Users Need to See

1. **Before betting:** "If you bet 1 FLR on NO, you could win 4.77 FLR"
2. **Multiplier display:** "YES: 1.2x | NO: 4.8x" alongside percentages
3. **Odds impact:** "Your bet will move odds from 80/20 to 79/21"

---

## Implementation Plan

### 1. Payout Calculation Utility (`packages/shared/src/utils/payout.ts`)

```typescript
export function calculatePotentialPayout(
  yesPool: bigint,
  noPool: bigint,
  betAmount: bigint,
  side: 'yes' | 'no'
): { payout: bigint; multiplier: number; newOddsPercent: number }
```

### 2. Enhanced BetModal

Add to the betting interface:
- Live payout preview as user types amount
- Multiplier badge (e.g., "4.77x if NO wins")
- New odds preview showing how bet affects market

### 3. Odds Display Enhancements

Add optional multiplier display:
- Show "YES 1.2x | NO 4.8x" below percentage bar
- Color-code based on value (green for high, neutral for balanced)

---

## Contract Reference

The relevant contract functions are already in place:

### `getImpliedPrices(marketId)` → `(yesBps, noBps)`
Returns implied probability in basis points (0-10000).

### `PayoutMath.payoutForWinner(winningPool, losingPool, stake)` → `(payout, fee)`
Calculates exact payout for a given stake.

---

## No Changes Needed To

- ❌ Contract logic (already correct)
- ❌ Fee structure (1% from losers)
- ❌ Settlement process
- ❌ Database schema

## Changes Needed

- ✅ Frontend payout utility
- ✅ BetModal payout preview
- ✅ OddsDisplay multiplier badges
- ✅ MarketCard/HeroCard return info

---

## Future Considerations

### LMSR (Logarithmic Market Scoring Rule)
For V2+, consider adopting LMSR pricing which:
- Provides continuous liquidity (no AMM needed)
- Has smoother price curves
- Is mathematically proven for prediction markets

However, the current pari-mutuel system is **perfectly adequate for V1** and is simpler to understand.

