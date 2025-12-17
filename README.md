# WeatherB 🌡️

A simple prediction market on **Flare** where users bet YES/NO on temperature outcomes.

> "Will it be ≥ 72°F in New York at 2pm?"

---

## Status

🚧 **Under Development** — Currently building Epic 0-3

---

## What This Is

- **Binary markets only**: Bet YES or NO on temperature thresholds
- **5 markets/day**: Limited supply, automated creation
- **Parimutuel payouts**: Winners split losers proportionally (1% fee)
- **Trustless settlement**: Uses Flare Data Connector (FDC) for verifiable weather data

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Blockchain | Flare (FLR) |
| Contracts | Foundry + Solidity 0.8.24+ |
| Frontend | Next.js 14+ / Thirdweb |
| Weather Data | MET Norway (primary) |
| Database | PostgreSQL + Prisma |

---

## Project Structure

```
weatherb/
├── contracts/        # Foundry — Solidity smart contracts
├── apps/web/         # Next.js — User-facing betting app
├── services/
│   ├── scheduler/    # Market creation cron
│   └── settler/      # Settlement bot (FDC proofs)
├── packages/shared/  # Types, ABIs, utils
└── docs/epics/       # Build plans
```

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Start local services (Postgres + Redis)
docker-compose up -d

# Run development
pnpm dev
```

See `.env.example` for required environment variables.

---

## Documentation

- [`AGENTS.md`](./AGENTS.md) — Project rules and conventions
- [`PRD.md`](./PRD.md) — Product requirements
- [`docs/epics/`](./docs/epics/) — Detailed build plans

---

## License

MIT
