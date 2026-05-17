# ALEXITHYMIA

Autonomous AI Trading Agent for Meteora DLMM liquidity providing on Solana.

See [CLAUDE.md](CLAUDE.md) and [docs/architecture/](docs/architecture/) for the
authoritative project context, layering rules, and tech stack.

## Requirements

- Node.js >= 22
- pnpm >= 9.15

## Getting Started

```bash
pnpm install
pnpm typecheck
pnpm test
```

## Workspace Layout

- `packages/shared/*` — foundation layer (errors, utils, domain)
- `packages/engines/*` — pure logic (no I/O, no LLM, no framework deps)
- `packages/services/*` — I/O infrastructure
- `packages/agents/*` — LLM-driven LangGraph state graphs
- `packages/infra/*` — external adapters
- `packages/persistence/*` — Postgres, Redis, BullMQ queue definitions
- `packages/observability/*` — LangFuse, logging, metrics, tracing
- `packages/security/*` — secret vault, input sanitizer, kill switch
- `apps/*` — deployable processes (agent, api, telegram-bot, cli)
