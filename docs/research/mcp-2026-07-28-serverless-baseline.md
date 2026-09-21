# MCP 2026-07-28 serverless baseline

Status: research baseline, before Wayfinder destination definition  
Date: 2026-08-21

## Research question

Verify the claim that the latest MCP release supports serverless deployment, determine what that means in practice, and identify the facts WeatherB must carry into a later Wayfinder effort to become agent native.

This is research, not an implementation plan. It does not define which agent actions WeatherB will expose, who will sign transactions, or which chain the finished product will target.

## Method

- Five independent subagents received the same research brief.
- They used official MCP specifications, official SDKs, Anthropic and OpenAI product documentation, and first-party Vercel sources.
- The five passes agreed on the protocol version, serverless meaning, compatibility posture, and security gaps.
- Current local CLI versions and WeatherB code paths were checked separately.

## Verdict

The current stable protocol revision is MCP `2026-07-28`, released July 28, 2026. It removes the `initialize` lifecycle and `Mcp-Session-Id`, so ordinary MCP calls are independent requests that can reach any function instance. The MCP project calls this a stateless protocol core. Anthropic explicitly says this lets servers deploy on serverless and edge infrastructure. [MCP release announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/), [Anthropic announcement](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)

This means WeatherB can place an MCP endpoint in its existing Next.js/Vercel deployment. It does not inherently need a dedicated, always-running MCP process.

Three corrections matter:

1. Serverless MCP was possible before this release. Streamable HTTP introduced optional protocol sessions in `2025-03-26`, and SDKs had stateless modes. The new release makes statelessness the core protocol model and removes the remaining handshake and session assumptions. [2025-03-26 transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports), [2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
2. Serverless does not mean server-free. WeatherB still needs an HTTPS endpoint, deployed compute, authentication, its database, blockchain RPC access, transaction records, and any durable workers used by long operations.
3. This is an open MCP project release, not solely an Anthropic release. Anthropic donated MCP to the Linux Foundation's Agentic AI Foundation in December 2025. [Anthropic donation announcement](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)

## Version and transport baseline

| Revision | Relevant behavior |
| --- | --- |
| `2025-03-26` | Streamable HTTP arrived. Client messages used HTTP POST and servers could omit `Mcp-Session-Id`, but initialization remained mandatory. |
| `2025-11-25` | The previous stable revision still required `initialize` and retained legacy session and stream behavior. |
| `2026-07-28` | The current revision removes initialization and protocol sessions, adds `server/discover`, moves version and capabilities to each request, adds Multi Round-Trip Requests, and removes SSE resumption. |

The protocol revision and SDK version are separate identifiers. `2026-07-28` is the protocol. The matching TypeScript implementation is the official split v2 SDK, including `@modelcontextprotocol/server`. [TypeScript SDK v2](https://github.com/modelcontextprotocol/typescript-sdk), [protocol changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

The modern remote transport is still called Streamable HTTP. It is not a new transport named "serverless MCP."

For a modern HTTP server:

- The server exposes one MCP endpoint, commonly `/mcp`.
- Every JSON-RPC request uses a new HTTP POST.
- The response is one JSON object or an SSE stream scoped to that request.
- There is no protocol session ID, standalone GET stream, or sticky-instance requirement.
- Each request includes `MCP-Protocol-Version` and mirrors the method and tool/resource name into standard headers.
- Servers must implement `server/discover`; clients may use it to probe capabilities before another call.

See the [2026-07-28 Streamable HTTP specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) and [version compatibility rules](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning).

## What serverless changes

The official TypeScript handler builds a fresh MCP server instance for each HTTP request and keeps no protocol state between calls. Its handler uses the Web `Request` and `Response` interface, which can mount inside a Next.js route. [Official HTTP serving guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md)

Vercel's `mcp-handler` 2.x uses that SDK in Next.js Route Handlers. It serves `2026-07-28` natively and also serves stateless 2025-era Streamable HTTP from the same endpoint. It no longer uses Redis for MCP sessions. [Vercel `mcp-handler`](https://github.com/vercel/mcp-handler)

What goes away:

- A dedicated MCP daemon that must stay running.
- Sticky routing to the function instance that handled initialization.
- A shared store whose only job is retaining MCP transport sessions.
- Protocol-level session cleanup.

What remains:

- Cold starts and dependency initialization.
- Durable application data.
- OAuth state and access control.
- Blockchain signing, nonce handling, receipt tracking, and reconciliation.
- Rate limits, audit records, and transaction safety policy.
- Background execution for work that outlives a function request.

## State, streaming, and retries

Protocol statelessness does not make the application stateless.

Cross-call state must live in durable storage or in an explicit server-minted handle passed back on later calls. The server must authorize that handle again on every request. [MCP tools, "Stateful Tools"](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

Request-scoped progress may still use SSE. Dynamic change notifications use a long-lived `subscriptions/listen` POST response. Claude Code's current documentation says serverless hosts commonly close those streams and documents bounded reconnection behavior. [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http), [Claude Code notification streams](https://code.claude.com/docs/en/mcp)

WeatherB does not need push subscriptions for its basic market schedule. Pollable market reads are enough unless a later product decision requires real-time push.

Long work can use the optional Tasks extension, but Tasks only defines handles and polling. WeatherB would still need durable execution infrastructure, and client support cannot be assumed. [Tasks extension overview](https://modelcontextprotocol.io/extensions/tasks/overview)

The new protocol removes SSE resumption. If a response stream breaks, the client issues a new request with a new JSON-RPC request ID. That creates a financial safety requirement for WeatherB:

> A bet, claim, or other value-moving tool needs its own durable business idempotency key and transaction-status lookup. An MCP request ID and `idempotentHint` are not replay protection.

This is an inference from the specified retry behavior. It is especially important because WeatherB allows multiple bets per wallet. [2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

## Client compatibility as of 2026-08-21

### Claude Code

Claude Code recommends remote HTTP for cloud MCP servers and supports OAuth login from the terminal. Claude Code `2.1.232+` has a v2 runtime that can negotiate `2026-07-28` with remote HTTP servers. Some provider, gateway, web, and feature-flag configurations still use the v1 runtime or require explicit negotiation. [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

Local verification:

- Installed Claude Code: `2.1.211`
- This predates the documented `2.1.232` v2 runtime.
- Its CLI can still add remote HTTP MCP servers and can use a dual-era endpoint through the legacy path.

### Codex

Codex CLI, the IDE extension, and the ChatGPT desktop app support remote Streamable HTTP, bearer tokens, OAuth, Client ID Metadata Documents, and Dynamic Client Registration. [OpenAI Codex MCP documentation](https://developers.openai.com/codex/mcp/)

Local verification:

- Installed Codex: `0.149.0`
- `codex features list` reports `mcp_2026_07_28` as under development and disabled.
- The default client path must therefore be treated as legacy until the modern feature is enabled and tested.

### Compatibility conclusion

A modern-only endpoint would exclude this machine's current default Codex configuration and its installed Claude Code version. The evidence supports a dual-era endpoint as the compatibility baseline to evaluate during Wayfinder:

- Native MCP `2026-07-28` for modern clients.
- Stateless 2025-era Streamable HTTP fallback from the same route.
- No legacy HTTP+SSE transport unless a named target client proves it is required.

This is not a final product decision. It is the lowest-risk starting assumption supported by the current SDK and client rollout.

## Authentication is not wallet authority

For protected HTTP MCP servers, the current authorization profile uses the MCP endpoint as an OAuth 2.1 resource server. The server publishes RFC 9728 Protected Resource Metadata and clients discover the authorization server through `WWW-Authenticate` or well-known metadata. [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)

The current registration order is:

1. Pre-registered client credentials when available.
2. Client ID Metadata Documents when the authorization server advertises support.
3. Dynamic Client Registration as a compatibility fallback.

DCR is deprecated, but current clients still need it in some configurations. [MCP client registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration)

The server must validate token issuer, audience, scope, and expiry. Clients send bearer authorization on every HTTP request. The MCP token cannot be passed through as an upstream service token. [MCP authorization security](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)

Unattended machine agents are a separate case. MCP has an optional OAuth Client Credentials extension, with short-lived JWT assertions preferred over long-lived shared secrets. Both sides must advertise and support the extension. [OAuth Client Credentials extension](https://modelcontextprotocol.io/extensions/auth/oauth-client-credentials)

None of this signs a blockchain transaction.

OAuth can establish which WeatherB principal may call a tool. It does not prove that principal controls a wallet, approve a wager, pay gas, or define spending limits. MCP also does not define wallet custody, smart-account delegation, transaction nonces, or chain-specific signing.

The later design must choose among materially different authority models, such as:

- Prepare an unsigned transaction that a user-controlled wallet signs.
- Use delegated smart-account or session-key authority with explicit limits.
- Let WeatherB operate a custodial or relayer signer.

This research does not select one.

## Approval and financial safety

MCP tool annotations such as `readOnlyHint`, `destructiveHint`, and `idempotentHint` are hints. A server cannot trust every client to show a confirmation dialog, and clients may be configured to auto-approve tool use. [MCP tools security considerations](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

MRTR can return `input_required` so a client gathers confirmation or missing input and retries the same logical operation. Client support and approval UX still vary. A financial control cannot live only in MRTR, a tool description, or client UI.

WeatherB will need server-enforced policy for any value-moving action. Candidate policy dimensions for later decisions include:

- Exact wallet and chain.
- Market, side, and amount.
- Expiration and acceptable quote drift.
- Per-action, daily, and total spending limits.
- Replay protection and durable intent status.
- Audit record and transaction reconciliation.

Credentials, private keys, seed phrases, and payment secrets must never pass through normal tool arguments or form elicitation.

## Current WeatherB baseline

The repository has no MCP implementation today.

Existing read paths:

- `GET /api/markets` is a public market feed in `apps/web/src/app/api/markets/route.ts`.
- `GET /api/positions?wallet=...` reads public positions and statistics in `apps/web/src/app/api/positions/route.ts`.

Existing write paths:

- The user-facing bet flow calls `placeBet` through Thirdweb from `apps/web/src/components/markets/bet-modal.tsx`.
- The internal market bot calls `placeBet` with its own managed wallets through Viem in `apps/market-bot/src/transaction.ts`.
- There is no general authenticated API that places a bet for an external user or agent.

Current chain state:

- Active code and `.env.example` still target Flare Coston2.
- `BASE_MIGRATION_IMPLEMENTATION_PLAN.md` describes a future move to Base Sepolia and Base, but current code inspection still shows Coston2 transaction paths.
- The MCP effort must not silently settle this separate chain decision.

Current working-tree observation:

- x402 packages appear in the modified `apps/web/package.json`.
- No x402 usage exists in application code yet.
- x402 should not be treated as agent authentication, wallet authorization, or an implemented participation path without separate evidence.

## Facts the Wayfinder effort must carry forward

1. Target the `2026-07-28` protocol behavior, not a vague label such as "MCP v2."
2. Evaluate one serverless Streamable HTTP endpoint inside the existing web deployment before considering a separate service.
3. Preserve a dual-era path until the named client matrix proves a modern-only endpoint is acceptable.
4. Separate MCP identity and OAuth from wallet ownership and transaction authority.
5. Require application-level idempotency and reconciliation for all value-moving operations.
6. Treat Tasks, MRTR, subscriptions, and machine credentials as capability-gated extensions, not universal client features.

These are research constraints and evidence-backed starting assumptions. Wayfinder still owns the decisions.

## Questions revealed for Wayfinder

The first question is not "which MCP tools should we build?"

It is:

> What does "participate in WeatherB" mean for an agent, and whose authority signs and funds each value-moving action?

That answer determines the destination and the rest of the decision map. It separates at least four possible products:

- Read and analyze markets.
- Prepare transactions for a human-controlled wallet.
- Place bets under delegated limits.
- Place bets through WeatherB custody.

Other questions can be charted only after that authority boundary is clear:

- Which clients and minimum versions must work at launch?
- Are unattended agents in scope, or only interactive agents with a human present?
- Which actions are public reads, authenticated reads, prepared writes, or executed writes?
- What confirmation, limit, audit, and recovery guarantees define a safe wager?
- Does the target chain remain Flare, follow the pending Base plan, or stay chain-configurable?

## Primary sources

- [MCP 2026-07-28 release announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [Anthropic: Bringing MCP 2026-07-28 to Claude](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP versioning and compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview)
- [MCP OAuth Client Credentials extension](https://modelcontextprotocol.io/extensions/auth/oauth-client-credentials)
- [Official MCP TypeScript SDK HTTP serving guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md)
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
- [OpenAI Codex MCP documentation](https://developers.openai.com/codex/mcp/)
- [Vercel `mcp-handler` 2](https://github.com/vercel/mcp-handler)
