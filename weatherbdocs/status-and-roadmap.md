# Status and Roadmap

This page summarizes the current release stage and what is planned next.

## What you can do here
- Understand what is live today and what is still in progress.
- See the path from testnet to mainnet.

## Current state (testnet)
- Network: Coston2 (Flare testnet)
- Settlement: Trusted settler role (centralized oracle)
- Markets: rotating cities (configurable), temperature-only, 5 markets/day
- Features: Core betting, parimutuel pools, automated settlement, suggestion voting

## Technical maturity stages

Stage 1: Foundation (Epics 0-7) - Complete
- Parimutuel contract with UUPS upgradeability
- Tomorrow.io weather data (single provider)
- Admin panel for market management
- Community suggestion and voting system

Stage 2: Testing and Reliability (Epic 8) - In Progress
- Automated test market system with ~4.5-hour end-to-end validation
- Weekly AI-generated performance reports (planned)
- Enhanced monitoring and diagnostics

Stage 3: Indexing and Performance (Epic 9) - Planned
- Custom indexer (listener + Prisma) for historical data and analytics
- Optimized query performance for large datasets

Stage 4: Security Hardening (Epic 10) - Planned
- Formal security audit
- Emergency pause mechanisms refinement
- Role-based access control review

## Path to mainnet

Phase 1: Testnet validation (current)
- Continuous testing on Coston2
- Gather feedback from early users
- Refine UX based on real usage patterns
- Automated testing of edge cases and settlement reliability

Phase 2: Mainnet beta (user validation)
- Deploy to Flare mainnet with limited exposure
- Invite-only or soft launch to community
- Monitor real-money markets with low caps
- Validate economic assumptions and payout mechanics

Phase 3: Public launch (growth and marketing)
- Full public access on Flare mainnet
- Marketing campaigns and community growth
- Expand to more cities and weather types
- Potential for governance token or community rewards

## Future possibilities (not committed)
- Multi-chain expansion beyond Flare
- Decentralized oracle network (replace trusted settler)
- Custom market creation by users
- Sports, events, or other prediction types

## Contract and Explorer
- App: https://weatherb.app
- Contract (Coston2): 0x716186B29043840a165e1Faf49b85bc2101fAaC7
- Explorer: https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7
