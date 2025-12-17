# Epic 5 — Web App (Bettor UX)

> **Goal:** Build a beautiful, simple betting interface where users can view markets, place bets, and claim winnings.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | **Next.js 14+ (App Router)** | SSR, good Thirdweb support |
| Styling | **TailwindCSS + shadcn/ui** | Beautiful, fast, customizable |
| Wallet | **Thirdweb SDK** | Required per PRD, good DX |
| State | **React Query + Zustand** | Simple, effective |
| Price updates | **Polling (10s)** | Simple for V1, WebSocket later |

---

## ⚠️ Get This Answered From User

| Question | Why It Matters | Options |
|----------|----------------|---------|
| **Domain name?** | Need for deployment | Custom / subdomain / TBD |
| **Brand colors?** | Design system foundation | Blues / Greens / User choice |
| **Mobile priority?** | Responsive strategy | Mobile-first / Desktop-first |

---

## Design Philosophy

**Weather betting should feel:**
- **Clean** — Like a weather app, not a casino
- **Trustworthy** — Clear rules, transparent odds
- **Fast** — No page reloads, instant feedback
- **Accessible** — Works on mobile, clear typography

---

## Pages & Components

### Page Structure

```
apps/web/src/app/
├── layout.tsx                 # Root layout + wallet provider
├── page.tsx                   # Home / Market list
├── markets/
│   └── [id]/
│       └── page.tsx          # Market detail (may use drawer instead)
├── positions/
│   └── page.tsx              # My positions
└── api/
    └── markets/
        └── route.ts          # API routes for indexed data
```

### Key Components

```
apps/web/src/components/
├── layout/
│   ├── header.tsx            # Logo, nav, wallet button
│   ├── footer.tsx            # Links, status
│   └── status-banner.tsx     # Provider health, outage alerts
├── markets/
│   ├── market-card.tsx       # Individual market display
│   ├── market-list.tsx       # Grid of market cards
│   ├── market-drawer.tsx     # Detail view (lat/long, rules)
│   ├── odds-display.tsx      # YES/NO price bars
│   └── countdown.tsx         # Time until resolution
├── betting/
│   ├── bet-modal.tsx         # Amount input, confirmation
│   ├── bet-button.tsx        # YES/NO buttons
│   └── bet-success.tsx       # Confirmation animation
├── positions/
│   ├── position-card.tsx     # Single position
│   ├── position-list.tsx     # All user positions
│   └── claim-button.tsx      # Claim winnings
└── ui/                        # shadcn components
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    └── ...
```

---

## Market Card Design

```
┌─────────────────────────────────────┐
│  🌡️  NEW YORK CITY                  │
│                                     │
│      Will it be ≥ 72°F?             │
│      at 2:00 PM EST                 │
│                                     │
│  ┌─────────────┬─────────────┐      │
│  │    YES      │     NO      │      │
│  │    62%      │    38%      │      │
│  │  ████████░░ │ ████░░░░░░  │      │
│  └─────────────┴─────────────┘      │
│                                     │
│  [ Bet YES ]  [ Bet NO ]   [Details]│
│                              FLR 💎 │
└─────────────────────────────────────┘
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

### 5.2 Market Display
- [ ] Implement MarketCard component
- [ ] Implement MarketList with grid layout
- [ ] Implement OddsDisplay (visual bars)
- [ ] Implement Countdown timer
- [ ] Add market detail drawer/modal

### 5.3 Betting Flow
- [ ] Implement BetModal with amount input
- [ ] Calculate and display potential payout
- [ ] Handle "already bet" error gracefully
- [ ] Add success/error toasts
- [ ] Disable betting after deadline

### 5.4 Positions Page
- [ ] Create /positions page
- [ ] Show open bets with current value
- [ ] Show resolved positions with outcome
- [ ] Implement ClaimButton
- [ ] Show claim transaction status

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

