# Epic 5 — Web App (Bettor UX)

> **Goal:** Build a beautiful, simple betting interface where users can view markets, place bets, and claim winnings.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | **Next.js 16.1.0 (App Router)** | Latest stable, React 19 support, SSR |
| React | **React 19.2** | Latest stable version |
| Styling | **TailwindCSS + shadcn/ui** | Beautiful, fast, customizable |
| Wallet | **Thirdweb SDK** | Required per PRD, custom "Log In" button wrapper |
| State | **React Query + Zustand** | Simple, effective |
| Price updates | **Polling (10s)** | Simple for V1, WebSocket later |
| Animations | **Framer Motion** | Smooth, performant micro-interactions |

---

## Design System: "Nostalgic Futurism"

**Visual Language:**
- **Light, airy, minimal** with rich textures
- **Sky gradient aesthetic** — bright blues to soft pinks/oranges
- **Ethereal particle effects** for micro-interactions
- **Glass morphism** — frosted glass headers/cards with backdrop blur
- **Vintage meets modern** — clean typography with optional texture overlays

**Color Palette:**
- Primary: Sky blues (`#5BA5E5`, `#87CEEB`)
- Cloud whites: (`#FFFFFF`, `#F8FBFF`)
- Sunset accents: Warm oranges/pinks (`#FFB347`, `#FF9AB3`) for CTAs
- Neutrals: Soft grays with film grain texture

**Effects:**
- Subtle noise/grain overlays
- Soft gradients (no harsh edges)
- Sparkle/particle systems on hover/interaction
- Liquid glass with backdrop blur
- Reflective surfaces (inspired by water/glass)

**Typography:**
- Clean sans-serif base (system fonts for performance)
- Optional texture overlays for hero text
- Generous whitespace

See `/docs/design-system.md` for detailed guidelines.

---

## Pages & Routes

### Page Structure

```
apps/web/src/app/
├── layout.tsx                 # Root layout + wallet provider
├── page.tsx                   # Home: Hero carousel + market grid
├── positions/
│   └── page.tsx              # Active bets + paginated history
└── api/
    ├── markets/
    │   └── route.ts          # GET active markets
    └── positions/
        └── route.ts          # GET user positions by wallet
```

**Removed:** Dedicated `/markets/[id]` page (using modals/drawers instead)

### Homepage Layout (Revised)

```
┌─────────────────────────────────────────────────┐
│  HEADER (liquid glass, auto-hide on scroll)     │
│  Logo | Nav Links | "Log In" (custom wallet)    │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  HERO CAROUSEL                                   │
│  Wide cards (different design) - cycle thru 5    │
│  markets with smooth transitions                 │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  MARKET GRID                                     │
│  Compact cards - same 5 markets in grid layout   │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  FOOTER                                          │
│  Links, status, project info                     │
└─────────────────────────────────────────────────┘
```

### Positions Page Layout

```
┌─────────────────────────────────────────────────┐
│  ACTIVE POSITIONS                                │
│  Cards for open markets user has bets in         │
│  Empty state if no active positions              │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  HISTORY (collapsible, default closed)           │
│  Resolved/cancelled markets (10 per page)        │
│  "Next" button for pagination if > 10            │
└─────────────────────────────────────────────────┘
```

### Component Structure (Revised)

```
apps/web/src/components/
├── layout/
│   ├── header.tsx            # Liquid glass header, auto-hide scroll
│   ├── footer.tsx            # Links, status
│   ├── wallet-button.tsx     # Custom "Log In" wrapper (Thirdweb)
│   └── status-banner.tsx     # Provider health alerts
├── markets/
│   ├── hero-carousel.tsx     # NEW: Wide card carousel
│   ├── hero-card.tsx         # NEW: Wide card variant
│   ├── market-card.tsx       # Compact grid card
│   ├── market-grid.tsx       # Grid container
│   ├── market-drawer.tsx     # Detail modal (lat/long, rules)
│   ├── odds-display.tsx      # Liquid Scale visualization (isolated!)
│   └── countdown.tsx         # Time until resolution
├── betting/
│   ├── bet-modal.tsx         # Amount input, confirmation
│   ├── bet-button.tsx        # YES/NO buttons
│   └── bet-success.tsx       # Confirmation animation
├── positions/
│   ├── active-positions.tsx  # Current open bets
│   ├── position-history.tsx  # NEW: Collapsible history w/ pagination
│   ├── position-card.tsx     # Single position display
│   └── claim-button.tsx      # Claim winnings
└── ui/                        # shadcn components
    ├── button.tsx
    ├── card.tsx
    ├── carousel.tsx           # NEW: For hero carousel
    ├── dialog.tsx
    └── ...
```

---

## Odds Display: "Liquid Scale"

**Concept:** Dynamic balance visualization that shifts left/right based on pool imbalance.

**Design Principles:**
- Central fulcrum at 50/50 equilibrium
- Liquid/gradient fills toward heavier side (YES = left, NO = right)
- Particle effects flow toward dominant side
- Uses sky gradient colors (blue → pink/orange)
- Smooth animations on odds updates

**Isolation:** Component is self-contained in `odds-display.tsx` with props:
```typescript
interface OddsDisplayProps {
  yesPool: bigint;
  noPool: bigint;
  variant?: 'liquid-scale' | 'future-alternative'; // Easy to swap later
}
```

This allows easy replacement with different visualization later without touching parent components.

---

## Card Designs

### Grid Card (Compact)

```
┌─────────────────────────────────────┐
│  NEW YORK CITY                      │
│  Will it be ≥ 72°F at 2:00 PM EST?  │
│                                     │
│  [Liquid Scale Odds Visualization]  │
│                                     │
│  Resolves in: 4h 23m                │
│  [ Bet YES ]  [ Bet NO ]            │
└─────────────────────────────────────┘
```

### Hero Card (Wide)

```
┌───────────────────────────────────────────────────────┐
│                                                       │
│  🌡️ NEW YORK CITY                                     │
│  Will it be ≥ 72°F?                                   │
│  Resolves: 2:00 PM EST • 4h 23m remaining             │
│                                                       │
│  [Wider Liquid Scale Visualization]                   │
│                                                       │
│  Total Pool: 1,234 FLR    [ Bet YES ]  [ Bet NO ]    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Core Flows

### 1. View Markets (Home)

```tsx
// app/page.tsx
export default async function HomePage() {
  const markets = await getActiveMarkets(); // From indexed DB
  
  return (
    <main className="container mx-auto py-8">
      <StatusBanner />
      <h1 className="text-3xl font-bold mb-8">Weather Markets</h1>
      <MarketList markets={markets} />
    </main>
  );
}
```

### 2. Place Bet

```tsx
// components/betting/bet-modal.tsx
export function BetModal({ market, side, onClose }) {
  const [amount, setAmount] = useState('');
  const { mutate: placeBet, isPending } = usePlaceBet();
  
  const handleSubmit = () => {
    placeBet({
      marketId: market.id,
      side,
      amount: parseEther(amount),
    }, {
      onSuccess: () => {
        toast.success('Bet placed!');
        onClose();
      },
      onError: (error) => {
        if (error.message.includes('Already bet')) {
          toast.error('You already have a bet on this market');
        } else {
          toast.error('Failed to place bet');
        }
      },
    });
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bet {side ? 'YES' : 'NO'} on {market.cityName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Amount (FLR)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            Potential payout: {calculatePotentialPayout(market, side, amount)} FLR
          </div>
          
          <Button onClick={handleSubmit} disabled={isPending} className="w-full">
            {isPending ? 'Confirming...' : `Bet ${amount} FLR`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. Claim Winnings

```tsx
// components/positions/claim-button.tsx
export function ClaimButton({ position }) {
  const { mutate: claim, isPending } = useClaim();
  
  if (!position.claimable) return null;
  
  return (
    <Button 
      onClick={() => claim(position.market.id)}
      disabled={isPending}
      className="bg-green-600 hover:bg-green-700"
    >
      {isPending ? 'Claiming...' : `Claim ${formatFLR(position.winnings)} FLR`}
    </Button>
  );
}
```

---

## Contract Integration

```typescript
// lib/contracts/weather-market.ts
import { useReadContract, useWriteContract } from 'thirdweb/react';
import { weatherMarketAbi } from '@weatherb/shared/abi';

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const response = await fetch('/api/markets');
      return response.json();
    },
    refetchInterval: 10_000, // Poll every 10s
  });
}

export function usePlaceBet() {
  const { mutateAsync: write } = useWriteContract();
  
  return useMutation({
    mutationFn: async ({ marketId, side, amount }) => {
      return write({
        contract: weatherMarketContract,
        method: 'placeBet',
        args: [marketId, side],
        value: amount,
      });
    },
  });
}

export function useClaim() {
  const { mutateAsync: write } = useWriteContract();
  
  return useMutation({
    mutationFn: async (marketId) => {
      return write({
        contract: weatherMarketContract,
        method: 'claim',
        args: [marketId],
      });
    },
  });
}
```

---

## Tasks

### 5.1 Project Setup
- [ ] Create Next.js 14+ app with App Router
- [ ] Configure Tailwind + shadcn/ui
- [ ] Add Thirdweb SDK and configure for Flare
- [ ] Set up React Query
- [ ] Create base layout with wallet connection

### 5.2 Layout & Header
- [ ] Implement liquid glass Header component
- [ ] Add auto-hide scroll behavior
- [ ] Create custom WalletButton ("Log In" styling)
- [ ] Implement Footer component

### 5.3 Market Display
- [ ] Implement HeroCarousel component
- [ ] Implement HeroCard (wide variant)
- [ ] Implement MarketCard (compact grid variant)
- [ ] Implement MarketGrid layout
- [ ] Implement OddsDisplay with Liquid Scale visualization (isolated!)
- [ ] Implement Countdown timer
- [ ] Add market detail drawer/modal

### 5.4 Betting Flow
- [ ] Implement BetModal with amount input
- [ ] Calculate and display potential payout
- [ ] Handle "already bet" error gracefully
- [ ] Add success/error toasts
- [ ] Disable betting after deadline

### 5.5 Positions Page
- [ ] Create /positions page layout
- [ ] Implement ActivePositions component
- [ ] Implement PositionHistory component (collapsible, paginated)
- [ ] Show open bets with current value
- [ ] Show resolved positions with outcome
- [ ] Implement ClaimButton
- [ ] Show claim transaction status
- [ ] Add pagination (10 per page, "Next" button)

### 5.5 Status & Health
- [ ] Implement StatusBanner for outages
- [ ] Show provider health indicator
- [ ] Handle wallet connection states

### 5.6 Polish
- [ ] Add loading skeletons
- [ ] Add animations (Framer Motion or CSS)
- [ ] Mobile responsive design
- [ ] Error boundaries
- [ ] Empty states

---

## API Routes (for indexed data)

```typescript
// app/api/markets/route.ts
import { db } from '@/lib/db';

export async function GET() {
  const markets = await db.market.findMany({
    where: { status: 'open' },
    orderBy: { resolveTime: 'asc' },
  });
  
  return Response.json(markets);
}
```

```typescript
// app/api/positions/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  
  if (!wallet) {
    return Response.json({ error: 'Wallet required' }, { status: 400 });
  }
  
  const positions = await db.bet.findMany({
    where: { wallet: wallet.toLowerCase() },
    include: { market: true },
  });
  
  return Response.json(positions);
}
```

---

## Acceptance Criteria

- [ ] Markets display with city, threshold, odds, countdown
- [ ] Wallet connects via Thirdweb/WalletConnect
- [ ] User can place YES or NO bet
- [ ] "Already bet" error handled gracefully
- [ ] Positions page shows all user bets
- [ ] User can claim winnings from resolved markets
- [ ] Status banner shows during outages
- [ ] Mobile responsive
- [ ] Fast page loads (< 2s)

---

## Dependencies

- **Epic 0:** Next.js scaffolding
- **Epic 2:** Contract deployed and ABI available
- **Epic 9:** Indexed data for fast queries (can use contract reads as fallback)

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Project setup | 3 hours |
| Market display | 6 hours |
| Betting flow | 6 hours |
| Positions page | 4 hours |
| Status & health | 2 hours |
| Polish & animations | 4 hours |
| Mobile responsive | 3 hours |
| **Total** | **~28 hours** |

