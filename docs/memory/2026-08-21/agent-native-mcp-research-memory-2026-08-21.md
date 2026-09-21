# Agent-native MCP research memory - 2026-08-21

## Session summary

- Completed pre-Wayfinder research on MCP `2026-07-28` and serverless deployment.
- Used five independent subagents with the same primary-source brief, then verified current MCP, Claude Code, Codex, TypeScript SDK, and Vercel documentation.
- Created the research baseline at `docs/research/mcp-2026-07-28-serverless-baseline.md`.
- Did not define the Wayfinder destination, create a map, or implement MCP code.

## What we learned

- MCP `2026-07-28` is the current stable protocol revision. It removes protocol initialization and sessions, so an MCP endpoint can run as an on-demand Next.js/Vercel route without a dedicated always-running MCP process.
- Stateless hosting was possible before, but this revision makes statelessness the core wire model.
- The official TypeScript SDK and Vercel `mcp-handler` 2 can serve modern `2026-07-28` and stateless 2025-era clients from one endpoint.
- Client rollout is uneven. Local Claude Code `2.1.211` predates its documented v2 runtime. Local Codex `0.149.0` has `mcp_2026_07_28` disabled as an under-development feature.
- MCP OAuth authenticates an API principal. It does not prove wallet ownership or authorize an on-chain wager.
- MCP retries do not provide exactly-once mutations. Financial actions need durable business idempotency, transaction lookup, and reconciliation.

## Decisions made

- No product or implementation decisions were made.
- The later Wayfinder work must use the exact `2026-07-28` protocol baseline and treat dual-era serving as an evidence-backed starting assumption, not a locked decision.

## Current project constraints

- WeatherB has public market and position read APIs but no general authenticated API that places bets for external users or agents.
- User betting currently signs through Thirdweb in the browser. The internal market bot signs with managed wallets through Viem.
- Active code still targets Coston2. The separate Base migration remains a plan and must not be silently decided by the MCP effort.
- The working tree already contained unrelated npm/Node migration edits. Those edits were preserved.
- x402 packages appear in the modified web package manifest, but there is no x402 application code yet.

## Files created

- `docs/research/mcp-2026-07-28-serverless-baseline.md`
- `docs/memory/2026-08-21/agent-native-mcp-research-memory-2026-08-21.md`

## Source-of-truth docs

- `docs/research/mcp-2026-07-28-serverless-baseline.md`
- `AGENTS.md`
- `BASE_MIGRATION_IMPLEMENTATION_PLAN.md`
- MCP `2026-07-28` specification and changelog linked from the research note

## Commands and verification

- `codex --version` returned `codex-cli 0.149.0`.
- `codex features list` showed `mcp_2026_07_28` as under development and disabled.
- `claude --version` returned `2.1.211 (Claude Code)`.
- `claude mcp --help` confirmed remote HTTP MCP configuration support.
- Exact repository searches found no MCP implementation and no x402 code usage.
- `git diff --check -- docs/research/mcp-2026-07-28-serverless-baseline.md` passed.

## Open decisions

- What does agent participation include: reads, transaction preparation, delegated betting, or WeatherB custody?
- Whose wallet signs and funds each value-moving action?
- Are unattended agents in scope?
- Which client versions must work at launch?
- What server-side confirmation, limit, idempotency, audit, and recovery guarantees are required?
- Which chain must the agent interface target?

## Recommended next work

Start the Wayfinder destination-grilling phase with one question:

> What does "participate in WeatherB" mean for an agent, and whose authority signs and funds each value-moving action?

Only after that answer should the destination and first decision tickets be charted.
