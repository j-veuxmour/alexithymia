# Tech Stack & Integrasi Framework

## Stack
- Bahasa: TypeScript strict. Monorepo: pnpm workspaces.
- DB: PostgreSQL + TimescaleDB (time-series) + pgvector (embeddings).
  Satu database, schema: app, timeseries, embeddings, langgraph.
- Query builder: Kysely.
- Cache/locks/pub-sub: Redis. Job queues: BullMQ.
- LLM: LangChain + LangGraph + LangFuse (self-hosted).
- Lint/format: Biome. Test: Vitest. Validation: zod.
- Logging: pino. Metrics: Prometheus. Tracing: OpenTelemetry.
- API: Fastify.

## Peran Tiap Framework
- LangChain: abstraksi provider LLM, definisi tools (dengan zod schema),
  structured output parsing. TIDAK untuk orchestration/memory.
- LangGraph: state machine agent — nodes, edges, conditional routing,
  sub-graphs, checkpointing (PostgresSaver). TIDAK untuk worker orchestration.
- LangFuse: observability LLM, prompt registry (versioned), evaluation,
  cost tracking, outcome scoring. TIDAK untuk production logging/metrics.

## Letak Framework di Codebase
- LangChain → packages/agents/* (tools, structured output)
  + packages/infra/llm/* (provider adapters: anthropic, openrouter, local).
- LangGraph → packages/agents/*/graph.ts (graph definitions)
  + packages/persistence/postgres/langgraph-checkpointer.ts.
- LangFuse → packages/observability/langfuse/* (terpusat),
  di-import oleh agents (prompts) & workers (traces).
- Engines TIDAK PERNAH import framework.

## Model LLM (tiered)
- Premium (reasoning berat: Analyst Manager, Risk Manager, Strategist Manager): Claude Opus.
- Balanced (Portfolio Manager, Learning Manager, Dispatch Officer): Claude Sonnet.
- Cheap (klasifikasi rutin): Claude Haiku.
- Fallback: OpenRouter. Local opsional: LM Studio.

## Database Topology
Satu PostgreSQL database `alexithymia` dengan extension timescaledb + vector + pgcrypto.
- schema app: positions, decisions, lessons, pool_memory, blacklists, smart_wallets.
- schema timeseries: signal_snapshots, pnl_ticks, pool_ohlcv (hypertables) +
  continuous aggregates.
- schema embeddings: lesson_embeddings, pool_embeddings, decision_embeddings (pgvector hnsw).
- schema langgraph: checkpoints (LangGraph PostgresSaver).

## Infra Lokal (Docker Compose)
postgres (timescale/timescaledb-ha pg17, sudah include pgvector), redis,
langfuse + langfuse-db, prometheus, grafana, bull-board.
