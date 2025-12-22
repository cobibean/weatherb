# WeatherB — Epic 5 UI Implementation

## Quick Context

You're building the **Web App UI (Epic 5)** for WeatherB, a temperature prediction market on Flare blockchain. Users bet YES/NO on questions like: _"Will it be ≥ 72°F in NYC at 2pm?"_

**What's Done:**
- ✅ Epics 0-4 complete (contracts, automation, providers)
- ✅ Next.js 16.1.0 + React 19.0 + Framer Motion installed
- ✅ Design system finalized ("Nostalgic Futurism" — sky gradients, textures, particles)
- ✅ All assets optimized and ready (hero bg, textures, cloud sprites)

**Where We Left Off:**
- Design system documented in `/docs/design-system.md`
- Epic 5 plan revised in `/docs/epics/epic-5-webapp.md`
- Assets documented in `/apps/web/public/ASSETS_README.md`
- ParticleSystem component created at `/apps/web/src/components/ui/particle-system.tsx`

**What's Next:**
Start building the actual UI components, starting with the homepage layout.

---

## Your Task

Build the WeatherB homepage with these components (in this order):

### 1. Header Component (Liquid Glass)
**File:** `/apps/web/src/components/layout/header.tsx`

**Requirements:**
- Liquid glass effect (backdrop blur, gradient background)
- Auto-hide on scroll down, show on scroll up
- Fixed position at top
- Contains: Logo (text "WeatherB"), nav links, custom "Log In" button
- Mobile responsive (hamburger menu below 768px)

**Design specs:** See `/docs/design-system.md` section "Liquid Glass Header"

---

### 2. Custom Wallet Button
**File:** `/apps/web/src/components/layout/wallet-button.tsx`

**Requirements:**
- Wrapper around Thirdweb's ConnectButton
- Label: "Log In" instead of "Connect Wallet"
- Matches design system button styles (glass effect)
- Shows truncated address when connected (e.g., "0x1234...5678")

---

### 3. Hero Carousel
**Files:**
- `/apps/web/src/components/markets/hero-carousel.tsx`
- `/apps/web/src/components/markets/hero-card.tsx`

**Requirements:**
- Carousel that cycles through 5 markets
- Wide card design (different from grid cards)
- Smooth transitions (Framer Motion)
- Shows: City name, threshold, resolve time, Liquid Scale odds, total pool, bet buttons
- Use hero background: `/public/backgrounds/hero-clouds.jpg`
- Add ParticleSystem with clouds

**Design specs:** See `/docs/epics/epic-5-webapp.md` section "Hero Card (Wide)"

---

### 4. Market Card (Grid)
**Files:**
- `/apps/web/src/components/markets/market-card.tsx`
- `/apps/web/src/components/markets/market-grid.tsx`

**Requirements:**
- Compact card for grid layout
- Shows: City, threshold, countdown, Liquid Scale odds, bet buttons
- Glass morphism background with paper grain texture overlay
- Hover effect: subtle scale (1.02) + particle animation
- Mobile responsive (1 column on mobile, 2-3 on desktop)

**Design specs:** See `/docs/epics/epic-5-webapp.md` section "Grid Card (Compact)"

---

### 5. Odds Display ("Liquid Scale")
**File:** `/apps/web/src/components/markets/odds-display.tsx`

**Requirements:**
- **ISOLATED COMPONENT** with variant prop (easy to swap later)
- Dynamic balance visualization (shifts left/right based on pool ratio)
- Central fulcrum at 50/50
- Liquid gradient fills: YES = blue (left), NO = pink/orange (right)
- Particle effects flow toward heavier side
- Smooth animation on pool updates (Framer Motion spring)

**Design specs:** See `/docs/design-system.md` section "Odds Display: Liquid Scale Specification"

---

### 6. Homepage Assembly
**File:** `/apps/web/src/app/page.tsx`

Combine all components:
```
┌─────────────────────────────────┐
│  HEADER (liquid glass)          │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  HERO CAROUSEL                  │
│  (wide cards, 5 markets)        │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  MARKET GRID                    │
│  (compact cards, same 5 markets)│
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  FOOTER (simple for now)        │
└─────────────────────────────────┘
```

---

## Key Design Principles

**Read these docs first:**
1. `/docs/design-system.md` — Full design system (colors, effects, animations)
2. `/docs/epics/epic-5-webapp.md` — Epic 5 plan with revised layout
3. `/apps/web/public/ASSETS_README.md` — How to use hero bg, textures, particles

**Design Language:** "Nostalgic Futurism"
- Light, airy, minimal
- Sky gradients (blue → pink/orange)
- Glass morphism (backdrop blur, frosted effects)
- Paper grain texture overlays (3-5% opacity)
- Particle effects for micro-interactions
- Generous whitespace

**Color Palette:**
- Sky blues: `#5BA5E5`, `#87CEEB`
- Cloud whites: `#FFFFFF`, `#F8FBFF`
- Sunset accents: `#FFB347`, `#FF9AB3` (CTAs)

**Assets Available:**
- Hero BG: `/public/backgrounds/hero-clouds.jpg` (178KB)
- Paper grain: `/public/textures/paper-grain.jpg` (43KB)
- Halftone blue: `/public/textures/halftone-blue.jpg` (94KB)
- Cloud sprites: `/public/particles/cloudsvg1.svg` (236KB)

---

## Mock Data (For Now)

Since contracts aren't deployed yet, use this mock data:

```tsx
// Mock market data
const mockMarkets = [
  {
    id: '1',
    cityName: 'New York',
    thresholdF_tenths: 720, // 72.0°F
    resolveTime: Date.now() + 4 * 60 * 60 * 1000, // 4 hours from now
    yesPool: BigInt(1000e18), // 1000 FLR
    noPool: BigInt(500e18),   // 500 FLR
    status: 'open',
  },
  // ... 4 more markets
];
```

---

## Important Notes

1. **Use existing ParticleSystem:** Already built at `/apps/web/src/components/ui/particle-system.tsx`
2. **Framer Motion installed:** Use for all animations
3. **Tailwind + shadcn/ui:** Use for base styling
4. **Mobile-first:** Design for mobile, enhance for desktop
5. **Performance:** Keep bundle small, lazy load heavy components

---

## Success Criteria

When you're done, the homepage should:
- [ ] Display 5 mock markets in hero carousel
- [ ] Display same 5 markets in grid below
- [ ] Header auto-hides on scroll down
- [ ] Liquid Scale odds display animates smoothly
- [ ] Paper grain texture visible on cards (subtle)
- [ ] Particles float on carousel/cards
- [ ] Mobile responsive (works on 375px width)
- [ ] Matches design system aesthetic (sky gradients, glass effects)

---

## Files to Reference

**Must Read:**
- `/docs/design-system.md` — Design system spec
- `/docs/epics/epic-5-webapp.md` — Epic 5 plan
- `/apps/web/public/ASSETS_README.md` — Asset usage guide
- `/AGENTS.md` — Project context and constraints

**Code Reference:**
- `/apps/web/src/components/ui/particle-system.tsx` — Existing particle component
- `/packages/shared/src/types/` — TypeScript types for Market, Bet, etc.

---

## Questions?

- Check `/docs/design-system.md` for design specs
- Check `/docs/epics/epic-5-webapp.md` for component structure
- Check `/AGENTS.md` for project rules and constraints

Good luck! Build something beautiful. 🌤️
