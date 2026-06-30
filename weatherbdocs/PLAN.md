# weatherB Public Docs Plan (Enhanced)

## Goals
- Make the app feel simple and safe for first-time bettors.
- Explain how outcomes are decided, and where data comes from.
- Clarify rules and edge cases (ties, closed betting, refunds, no winners).
- Keep voice on-brand: confident, clear, minimal hype.

## Audience
- First-time users who need a 3-minute walkthrough.
- Returning users who want to track and claim.
- Curious visitors who want to verify fairness and trust assumptions.
- Community members who want to suggest/vote on markets.

## Source of Truth (for accuracy)
- Contract: `contracts/src/WeatherMarketV2.sol`
- Scheduler: `apps/web/src/app/api/cron/schedule-daily/route.ts`
- Settler: `apps/web/src/app/api/cron/settle-markets/route.ts`
- Frontend UX: `apps/web/src/app` and `apps/web/src/components`
- Weather providers: `packages/shared/src/providers`

## Information Architecture (Top-Level Pages)

### 1. Overview
- One-line explanation: binary temperature markets on Flare.
- What makes it different: parimutuel, 5 markets/day, automated settlement.
- Quick trust signals: on-chain, verifiable outcomes, transparent rules.

### 2. Getting Started
- Connect wallet (Thirdweb).
- Pick a market.
- Place a bet (min 0.01 FLR).
- Track and claim later.

### 3. Markets 101 (How It Works)
- Market question format: "Will temp be >= X F at time T in City?"
- Thresholds stored in tenths (e.g., 853) but shown as whole degrees.
- Tie rule: temp == threshold means YES wins.
- Betting closes 10 minutes before resolve time.
- Multiple bets per wallet are allowed (bets accumulate).

### 4. Betting and Odds
- Parimutuel pools (YES and NO).
- Implied odds from pool sizes.
- Fee from losing pool (1% default, 10% max).
- Payout example with a small numeric walkthrough.

### 5. Settlement and Data Sources (Trust)
- Settler-only resolution; contract enforces roles.
- Tomorrow.io as the single weather provider.
- "First reading at or after T" rule.
- What happens if data is missing (cancel/no winners).

### 6. Using the App (UX Walkthrough)
- Markets page: hero carousel, market grid, past markets drawer.
- Bet flow: modal, payout preview, wallet connect, explorer link.
- Market summary: resolved temp, pools, outcome.
- Positions page: stats, tabs (active/claimable/claimed/past), claim/refund.
- Suggestions page: suggest a market, vote, trending list.

### 7. Refunds, Cancellations, and No Winners
- Cancelled markets => refunds.
- No winners => refunds (if winning pool is zero).
- Claim flow in-app and on-chain.

### 8. Security and Governance (Transparency)
- Upgradeability (UUPS) and owner role.
- Settler role and limitations.
- Pause controls and fee limits.
- What admin can and cannot do.

### 9. FAQ
- Why only 5 markets/day?
- Why does betting close early?
- Can I bet both sides?
- When will I see my winnings?
- What network is available?

### 10. Glossary
- Market, resolve time, threshold, pool, parimutuel, settler, no winners.

### 11. Status and Roadmap

#### Current State (Testnet)
- **Network**: Coston2 (Flare testnet)
- **Settlement**: Trusted settler role (centralized oracle)
- **Markets**: rotating cities (8 in the current rotation), temperature-only, 5 markets/day
- **Features**: Core betting, parimutuel pools, automated settlement, suggestion voting (Epic 7)

#### Technical Maturity Stages

**Stage 1: Foundation (Epics 0-7)** ✅ Complete
- Parimutuel contract with UUPS upgradeability
- Tomorrow.io weather data (single provider)
- Admin panel for market management
- Community suggestion and voting system

**Stage 2: Testing & Reliability (Epic 8)** 🔄 In Progress
- Automated test market system with ~4.5-hour end-to-end validation
- Weekly AI-generated performance reports (planned)
- Enhanced monitoring and diagnostics

**Stage 3: Indexing & Performance (Epic 9)** ⏳ Planned
- Custom indexer (listener + Prisma) for historical data and analytics
- Optimized query performance for large datasets

**Stage 4: Security Hardening (Epic 10)** ⏳ Planned
- Formal security audit
- Emergency pause mechanisms refinement
- Role-based access control review

#### Path to Mainnet

**Phase 1: Testnet Validation** (Current)
- Continuous testing on Coston2
- Gather feedback from early users
- Refine UX based on real usage patterns
- Automated testing of edge cases and settlement reliability

**Phase 2: Mainnet Beta** (User Validation)
- Deploy to Flare mainnet with limited exposure
- Invite-only or soft launch to community
- Monitor real-money markets with low caps
- Validate economic assumptions and payout mechanics

**Phase 3: Public Launch** (Growth & Marketing)
- Full public access on Flare mainnet
- Marketing campaigns and community growth
- Expand to more cities and weather types
- Potential for governance token or community rewards

#### Future Possibilities (Not Committed)
- Multi-chain expansion beyond Flare
- Decentralized oracle network (replace trusted settler)
- Custom market creation by users
- Sports, events, or other prediction types

### 12. Community

#### Stay Connected
Follow **@weatherbapp** on Twitter/X for:
- Market announcements and highlights
- Settlement results and interesting outcomes
- Platform updates and new features
- Community spotlights and top suggestions

#### Contributing Ideas
- Use the **Suggestions page** in the app to propose new markets
- Vote on trending suggestions from other users
- Top-voted suggestions are reviewed first, but scheduling is not guaranteed
- See "Using the App" (Section 6) for the full suggestion workflow

#### Code & Transparency
- App: https://weatherb.app
- Contract (Coston2): 0x716186B29043840a165e1Faf49b85bc2101fAaC7
- Explorer: https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7

## Page-Level Detail Checklist (for writing)
- Each page starts with a short summary + a "what you can do here" blurb.
- Include at least one plain-language example per critical concept.
- Link to contract address and explorer (network-specific).
- Use screenshots where it reduces confusion (bet modal, positions, past markets).

## Required Assets

### Screenshots (7-9 total)
- Markets page: hero carousel + grid view
- Bet modal: threshold, pool sizes, payout preview
- Positions page: stats dashboard + active/claimable tabs
- Claim flow: before/after claiming winnings
- Suggestions page: voting interface + trending list
- Market summary modal: resolved outcome + temperature reading
- Admin panel (optional): shows transparency of market management

### Diagrams (2-3)
- Market lifecycle flowchart (open → betting closes → resolves → settled/cancelled/no winners)
- Payout calculation example (visual breakdown of pool math and fees)
- Settlement data flow (weather providers → settler → contract → payouts)

### Tables/Reference Cards
- Rules & constraints matrix (min bet, tie rule, close buffer, fee structure)
- Weather provider data flow (Tomorrow.io)
- Admin capabilities vs. limitations (trust transparency)

## Publishing Strategy

### Recommended Approach

**Phase 1 (Testnet): Next.js MDX Route**
- Path: `/apps/web/src/app/docs`
- Pros: Same deployment, stays in-sync, easy navigation integration
- Cons: Couples docs to app deployment
- Best for: MVP, testing with early users

**Phase 2 (Mainnet Launch): GitBook with Git Sync**
- Sync from `/weatherbdocs`
- Pros: Professional UI, version control, search, analytics
- Cons: External dependency, needs setup
- Best for: Public launch phase with broader audience

**Alternative: Vercel-hosted static docs**
- Separate Docusaurus/Nextra site from `/weatherbdocs`
- Pros: Dedicated subdomain (docs.weatherB.io), optimized for docs
- Cons: Extra deployment pipeline
- Best for: Post-launch when docs become a major resource

## Open Questions to Resolve Before Writing
- ~~Target chain~~ → **Answered**: Coston2 (testnet), Flare (mainnet)
- Contract addresses → Coston2 known, mainnet TBD
- Tone → **Confirmed**: confident, clear, minimal hype
- Legal disclaimers → Consider adding: "Not financial advice, experimental software, use at own risk"
- ~~Upgradeability emphasis~~ → **Covered** in Security section (Section 8)
- Twitter/X handle: @weatherbapp
- Code visibility → Private during testnet
