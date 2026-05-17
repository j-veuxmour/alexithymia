alexithymia/
│
├── apps/                                    # Deployable processes
│   │
│   ├── agent/                               # Main autonomous process — runs all core workers
│   │   ├── src/
│   │   │   ├── main.ts                      # Bootstrap, DI container, graceful shutdown
│   │   │   ├── container.ts                 # Dependency injection wiring
│   │   │   ├── lifecycle.ts                 # SIGTERM/SIGINT handling, startup hooks
│   │   │   │
│   │   │   ├── workers/                     # BullMQ worker consumers
│   │   │   │   ├── analyst.worker.ts
│   │   │   │   ├── portfolio.worker.ts
│   │   │   │   ├── execution.worker.ts
│   │   │   │   ├── learning.worker.ts
│   │   │   │   ├── reconciliation.worker.ts
│   │   │   │   ├── snapshot.worker.ts
│   │   │   │   ├── notification.worker.ts
│   │   │   │   ├── embedding.worker.ts
│   │   │   │   ├── simulation.worker.ts
│   │   │   │   ├── strategist.worker.ts
│   │   │   │   └── worker-registry.ts       # Registers + supervises all workers
│   │   │   │
│   │   │   ├── schedulers/                  # BullMQ repeatable job producers
│   │   │   │   ├── analyst.scheduler.ts
│   │   │   │   ├── portfolio.scheduler.ts
│   │   │   │   ├── reconciliation.scheduler.ts
│   │   │   │   ├── snapshot.scheduler.ts
│   │   │   │   ├── learning.scheduler.ts
│   │   │   │   ├── strategist.scheduler.ts
│   │   │   │   └── scheduler-registry.ts
│   │   │   │
│   │   │   └── healthcheck/
│   │   │       ├── health.server.ts         # /health, /ready, /metrics endpoints
│   │   │       └── probes.ts                # DB, Redis, RPC, queue depth probes
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                                 # REST/GraphQL ops + external trigger API
│   │   ├── src/
│   │   │   ├── main.ts                      # Fastify server bootstrap
│   │   │   ├── routes/
│   │   │   │   ├── positions.route.ts
│   │   │   │   ├── decisions.route.ts
│   │   │   │   ├── performance.route.ts
│   │   │   │   ├── killswitch.route.ts
│   │   │   │   ├── triggers.route.ts        # Manual cycle triggers, signal webhooks
│   │   │   │   └── metrics.route.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── rate-limit.middleware.ts
│   │   │   │   └── validation.middleware.ts
│   │   │   └── handlers/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── telegram-bot/                        # Isolated Telegram process
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── commands/                    # /positions, /close, /screen, /panic, /status
│   │   │   ├── handlers/                    # Message → intent → enqueue job
│   │   │   └── notifiers/                   # Outbound notification consumers
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                                 # Operator command-line tool
│       ├── src/
│       │   ├── main.ts
│       │   └── commands/                    # status, deploy, close, evolve, reconcile
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   │
│   ├── agents/                              # ── LLM JUDGMENT LAYER ──
│   │   │                                    #    (LangChain + LangGraph live here)
│   │   ├── core/
│   │   │   ├── src/
│   │   │   │   ├── graph-builder.ts          # LangGraph StateGraph factory helpers
│   │   │   │   ├── tool-registry.ts          # LangChain tool() wrappers + role gating
│   │   │   │   ├── prompt-registry.ts        # Pulls versioned prompts from LangFuse
│   │   │   │   ├── llm-router.ts             # Model tier selection per agent/task
│   │   │   │   ├── state-base.ts             # Shared LangGraph annotation primitives
│   │   │   │   ├── node-wrappers.ts          # Span/trace decorators for nodes
│   │   │   │   └── agent.types.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── analyst-manager/
│   │   │   ├── src/
│   │   │   │   ├── graph.ts                  # Analyst Manager StateGraph definition
│   │   │   │   ├── state.ts                  # Analyst Manager state annotation
│   │   │   │   ├── nodes/
│   │   │   │   │   ├── load-context.node.ts
│   │   │   │   │   ├── pre-filter.node.ts
│   │   │   │   │   ├── enrich.node.ts
│   │   │   │   │   ├── regime-check.node.ts
│   │   │   │   │   ├── retrieve-lessons.node.ts
│   │   │   │   │   ├── forensic-audit.node.ts   # Deep due-diligence on chosen pool
│   │   │   │   │   ├── llm-decide.node.ts
│   │   │   │   │   ├── validate-decision.node.ts
│   │   │   │   │   ├── risk-manager.node.ts      # Invokes Risk Manager sub-graph
│   │   │   │   │   ├── safety-pipeline.node.ts
│   │   │   │   │   ├── execute.node.ts
│   │   │   │   │   └── post-process.node.ts
│   │   │   │   ├── edges/
│   │   │   │   │   └── routing.ts               # Conditional edge logic
│   │   │   │   └── schemas/                      # zod output schemas
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── portfolio-manager/
│   │   │   ├── src/
│   │   │   │   ├── graph.ts
│   │   │   │   ├── state.ts
│   │   │   │   ├── nodes/
│   │   │   │   │   ├── load-positions.node.ts
│   │   │   │   │   ├── evaluate-position.node.ts # Parallel via Send API
│   │   │   │   │   ├── pnl-check.node.ts
│   │   │   │   │   ├── exit-trigger.node.ts
│   │   │   │   │   ├── llm-judge.node.ts
│   │   │   │   │   ├── merge-decisions.node.ts
│   │   │   │   │   └── post-process.node.ts
│   │   │   │   ├── edges/
│   │   │   │   └── schemas/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── risk-manager/
│   │   │   ├── src/
│   │   │   │   ├── graph.ts                   # Sub-graph: veto + portfolio arbiter
│   │   │   │   ├── state.ts
│   │   │   │   ├── nodes/
│   │   │   │   │   ├── portfolio-check.node.ts
│   │   │   │   │   ├── correlation-check.node.ts
│   │   │   │   │   ├── il-projection.node.ts
│   │   │   │   │   ├── llm-review.node.ts
│   │   │   │   │   └── verdict.node.ts
│   │   │   │   └── schemas/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── strategist-manager/
│   │   │   ├── src/
│   │   │   │   ├── graph.ts
│   │   │   │   ├── state.ts
│   │   │   │   ├── nodes/
│   │   │   │   │   ├── load-regime.node.ts
│   │   │   │   │   ├── load-performance.node.ts
│   │   │   │   │   ├── llm-strategize.node.ts
│   │   │   │   │   └── apply-preset.node.ts
│   │   │   │   └── schemas/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── learning-manager/
│   │   │   ├── src/
│   │   │   │   ├── graph.ts
│   │   │   │   ├── state.ts
│   │   │   │   ├── nodes/
│   │   │   │   │   ├── load-closed-position.node.ts
│   │   │   │   │   ├── load-cohort.node.ts
│   │   │   │   │   ├── llm-analyze.node.ts
│   │   │   │   │   ├── validate-lesson.node.ts
│   │   │   │   │   └── persist-lesson.node.ts
│   │   │   │   └── schemas/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── dispatch-officer/
│   │       ├── src/
│   │       │   ├── graph.ts
│   │       │   ├── state.ts
│   │       │   ├── nodes/
│   │       │   │   ├── classify-intent.node.ts
│   │       │   │   ├── retrieve-context.node.ts
│   │       │   │   ├── answer.node.ts            # Q&A read-only path
│   │       │   │   └── delegate-action.node.ts   # Routes write-ops to Analyst/Portfolio Manager
│   │       │   └── schemas/
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   ├── engines/                             # ── PURE LOGIC LAYER ──
│   │   │                                    #    NO I/O, NO LLM, NO framework deps
│   │   ├── risk-engine/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── portfolio-risk.ts
│   │   │   │   ├── position-risk.ts
│   │   │   │   ├── correlation.ts
│   │   │   │   ├── circuit-breakers.ts
│   │   │   │   └── risk.types.ts
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── strategy-engine/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── range-calculator.ts
│   │   │   │   ├── bin-selector.ts
│   │   │   │   ├── strategy-library.ts
│   │   │   │   ├── strategy-selector.ts
│   │   │   │   ├── slippage-calculator.ts
│   │   │   │   └── strategy.types.ts
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── signal-engine/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── scoring/
│   │   │   │   │   ├── candidate-scorer.ts
│   │   │   │   │   └── signal-weighter.ts
│   │   │   │   ├── bandits/
│   │   │   │   │   ├── thompson-sampler.ts
│   │   │   │   │   └── beta-bandit.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── hard-filters.ts
│   │   │   │   ├── classifiers/
│   │   │   │   │   └── narrative-classifier.ts
│   │   │   │   ├── regime-detector.ts
│   │   │   │   └── signal.types.ts
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── pricing-engine/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── pnl-calculator.ts
│   │   │   │   ├── il-calculator.ts          # Current + projected IL
│   │   │   │   ├── fee-projector.ts
│   │   │   │   ├── tvl-impact.ts
│   │   │   │   ├── oracle-reconciler.ts      # Pure math; raw prices passed in
│   │   │   │   ├── cost-basis.ts
│   │   │   │   └── pricing.types.ts
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── portfolio-engine/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── portfolio-aggregator.ts   # Canonical portfolio state
│   │   │   │   ├── exposure-breakdown.ts
│   │   │   │   ├── equity-curve.ts
│   │   │   │   └── portfolio.types.ts
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── learning-engine/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── lesson-extractor.ts       # Statistical significance gated
│   │   │   │   ├── threshold-evolver.ts      # Bayesian updates
│   │   │   │   ├── attribution.ts            # PnL → signal attribution
│   │   │   │   ├── statistics.ts             # p-value, significance helpers
│   │   │   │   └── learning.types.ts
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── simulation-engine/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── backtester.ts             # Moved from learning-engine
│   │   │   │   ├── counterfactual.ts         # Moved from learning-engine
│   │   │   │   ├── historical-replay.ts
│   │   │   │   └── simulation.types.ts
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── allocation-engine/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── kelly-sizing.ts           # Moved from risk-engine
│   │   │   │   ├── fractional-kelly.ts
│   │   │   │   ├── exposure-aware-allocation.ts
│   │   │   │   └── allocation.types.ts
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── dlmm-engine/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── bin-array-preflight.ts    # Pure preflight math (from infra/meteora)
│   │   │   │   ├── wide-range-path.ts        # >69 bins handling
│   │   │   │   ├── single-side-deploy.ts     # Single-side SOL deploy enforcement
│   │   │   │   ├── volatility-normalizer.ts  # Volatility timeframe normalization
│   │   │   │   └── dlmm.types.ts
│   │   │   ├── tests/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── tx-construction-engine/
│   │       ├── src/
│   │       │   ├── index.ts
│   │       │   ├── tx-builder.ts             # Compute budget, instruction assembly
│   │       │   ├── priority-fee-calculator.ts # Pure math; raw fee data passed in
│   │       │   ├── firewall.ts               # Invariant assertions pre-sign
│   │       │   ├── allowed-programs.ts
│   │       │   └── tx-construction.types.ts
│   │       ├── tests/
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   ├── services/                            # ── I/O INFRASTRUCTURE LAYER ──
│   │   ├── market-data/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── price-feed.ts             # Pyth / Birdeye price ingestion
│   │   │   │   ├── ohlcv-feed.ts             # Candle data ingestion
│   │   │   │   ├── pool-discovery.ts         # Candidate pool discovery (GMGN, etc.)
│   │   │   │   ├── oracle-feed.ts            # Oracle price ingestion
│   │   │   │   └── source-router.ts          # Multi-source health-aware routing
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── tx-submission/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── tx-submitter.ts           # Submit + retry + fee bump
│   │   │   │   ├── confirmation-watcher.ts   # WS subscribe + polling fallback
│   │   │   │   ├── rpc-pool.ts               # Multi-RPC health-aware routing
│   │   │   │   ├── jito-bundler.ts           # Optional MEV-protected path
│   │   │   │   ├── priority-fee-oracle.ts    # Fetches recent fees (I/O)
│   │   │   │   └── idempotency-guard.ts      # Redis-backed dedup
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── reconciliation/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── chain-reconciler.ts
│   │   │   │   ├── pnl-reconciler.ts
│   │   │   │   ├── balance-reconciler.ts
│   │   │   │   ├── orphan-detector.ts
│   │   │   │   └── backfill.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── notification/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── alert-router.ts           # Severity → channel routing
│   │   │   │   ├── template-renderer.ts
│   │   │   │   ├── rate-limiter.ts
│   │   │   │   ├── digest-builder.ts
│   │   │   │   ├── briefing-generator.ts
│   │   │   │   └── channels/
│   │   │   │       ├── telegram.channel.ts
│   │   │   │       ├── discord.channel.ts
│   │   │   │       └── pagerduty.channel.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── context/
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── context-builder.ts        # Assembles agent context
│   │   │   │   ├── lesson-retriever.ts       # pgvector semantic search
│   │   │   │   ├── decision-retriever.ts     # Similar past decisions
│   │   │   │   └── embedder.ts               # Embedding model client
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── repository/                       # Centralized DB CRUD (Kysely)
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── position.repository.ts
│   │   │   │   ├── decision.repository.ts
│   │   │   │   ├── lesson.repository.ts
│   │   │   │   ├── pool-memory.repository.ts
│   │   │   │   ├── blacklist.repository.ts
│   │   │   │   ├── smart-wallet.repository.ts
│   │   │   │   ├── pnl-tick.repository.ts          # TimescaleDB
│   │   │   │   ├── signal-snapshot.repository.ts   # TimescaleDB
│   │   │   │   ├── ohlcv.repository.ts             # TimescaleDB
│   │   │   │   ├── lesson-embedding.repository.ts  # pgvector
│   │   │   │   ├── pool-embedding.repository.ts    # pgvector
│   │   │   │   └── decision-embedding.repository.ts # pgvector
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── signing/                          # Moved from packages/security/wallet
│   │       ├── src/
│   │       │   ├── signer.interface.ts
│   │       │   ├── local-aes-signer.ts       # AES-256-GCM + scrypt
│   │       │   ├── aws-kms-signer.ts
│   │       │   ├── turnkey-signer.ts
│   │       │   └── signer-factory.ts
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   ├── infra/                               # ── EXTERNAL ADAPTERS ──
│   │   ├── solana/
│   │   │   ├── src/
│   │   │   │   ├── connection-factory.ts
│   │   │   │   └── solana.types.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── meteora/
│   │   │   ├── src/
│   │   │   │   ├── dlmm-client.ts            # Wraps @meteora-ag/dlmm
│   │   │   │   ├── deploy.ts
│   │   │   │   ├── close.ts
│   │   │   │   ├── claim.ts
│   │   │   │   ├── pnl.ts
│   │   │   │   ├── positions.ts
│   │   │   │   └── pool-fetch.ts             # Raw pool data I/O (used by market-data)
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── jupiter/
│   │   │   ├── src/
│   │   │   │   ├── swap-client.ts
│   │   │   │   ├── price-client.ts
│   │   │   │   └── token-audit-client.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── helius/
│   │   │   ├── src/
│   │   │   │   ├── wallet-client.ts
│   │   │   │   └── enhanced-rpc.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── okx/
│   │   │   ├── src/
│   │   │   │   ├── onchain-os-client.ts
│   │   │   │   └── smart-money-client.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── llm/                             # ── LangChain provider adapters ──
│   │   │   ├── src/
│   │   │   │   ├── anthropic-provider.ts     # ChatAnthropic wrapper
│   │   │   │   ├── openrouter-provider.ts    # ChatOpenAI → OpenRouter
│   │   │   │   ├── local-provider.ts         # LM Studio
│   │   │   │   ├── provider-router.ts        # Tiered + fallback + circuit breaker
│   │   │   │   ├── cost-tracker.ts
│   │   │   │   └── embedding-provider.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── telegram/
│   │   │   ├── src/telegram-client.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── discord/                         # Official Bot API (NOT selfbot)
│   │   │   ├── src/discord-client.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── hivemind/                        # Signed-payload federation
│   │       ├── src/
│   │       │   ├── hivemind-client.ts
│   │       │   └── signature-verifier.ts    # Ed25519 verification
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   ├── persistence/                         # ── DATA ACCESS LAYER ──
│   │   ├── postgres/
│   │   │   ├── src/
│   │   │   │   ├── pool.ts                   # pg connection pool
│   │   │   │   ├── kysely-client.ts          # Typed query builder
│   │   │   │   ├── transaction.ts
│   │   │   │   ├── langgraph-checkpointer.ts  # LangGraph PostgresSaver wiring
│   │   │   │   └── database.types.ts         # Codegen'd from schema
│   │   │   ├── migrations/
│   │   │   │   ├── 001_extensions.sql        # timescaledb, vector, pgcrypto
│   │   │   │   ├── 002_schemas.sql           # app, timeseries, embeddings, langgraph
│   │   │   │   ├── 003_positions.sql
│   │   │   │   ├── 004_decisions.sql
│   │   │   │   ├── 005_lessons.sql
│   │   │   │   ├── 006_pool_memory.sql
│   │   │   │   ├── 007_blacklists.sql
│   │   │   │   ├── 008_smart_wallets.sql
│   │   │   │   ├── 009_signal_snapshots_hypertable.sql
│   │   │   │   ├── 010_pnl_ticks_hypertable.sql
│   │   │   │   ├── 011_ohlcv_hypertable.sql
│   │   │   │   ├── 012_continuous_aggregates.sql
│   │   │   │   ├── 013_lesson_embeddings.sql
│   │   │   │   ├── 014_pool_embeddings.sql
│   │   │   │   ├── 015_decision_embeddings.sql
│   │   │   │   └── 016_langgraph_checkpoints.sql
│   │   │   ├── seeds/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── redis/
│   │   │   ├── src/
│   │   │   │   ├── client-factory.ts
│   │   │   │   ├── cache.ts                  # Typed TTL cache
│   │   │   │   ├── distributed-lock.ts       # Redlock
│   │   │   │   ├── rate-limiter.ts           # Token bucket (Lua)
│   │   │   │   ├── pubsub.ts
│   │   │   │   └── session-store.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── queues/                          # ── BullMQ definitions ──
│   │       ├── src/
│   │       │   ├── queue-factory.ts
│   │       │   ├── job-types.ts              # zod-typed job payloads
│   │       │   ├── retry-policies.ts
│   │       │   └── queues/
│   │       │       ├── analyst.queue.ts
│   │       │       ├── portfolio.queue.ts
│   │       │       ├── execution.queue.ts
│   │       │       ├── learning.queue.ts
│   │       │       ├── reconciliation.queue.ts
│   │       │       ├── notification.queue.ts
│   │       │       ├── snapshot.queue.ts
│   │       │       ├── embedding.queue.ts
│   │       │       ├── simulation.queue.ts
│   │       │       └── strategist.queue.ts
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   ├── security/                            # ── SECURITY LAYER ──
│   │   ├── secret-vault/
│   │   │   ├── src/
│   │   │   │   ├── envelope-crypto.ts
│   │   │   │   └── kdf.ts                    # scrypt / Argon2id
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── input-sanitizer/
│   │   │   ├── src/
│   │   │   │   ├── prompt-injection-filter.ts
│   │   │   │   ├── untrusted-text.ts
│   │   │   │   └── url-validator.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── kill-switch/
│   │       ├── src/
│   │       │   ├── pause-controller.ts
│   │       │   └── flatten-positions.ts
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   ├── observability/                       # ── CROSS-CUTTING OBSERVABILITY ──
│   │   ├── langfuse/                        # ── LangFuse integration ──
│   │   │   ├── src/
│   │   │   │   ├── client.ts                 # LangFuse client factory
│   │   │   │   ├── callback-handler.ts       # LangChain/LangGraph → LangFuse
│   │   │   │   ├── trace-helpers.ts          # createCycleTrace, span helpers
│   │   │   │   ├── prompt-loader.ts          # Versioned prompt fetching
│   │   │   │   ├── score-publisher.ts        # Outcome scoring
│   │   │   │   └── eval-runner.ts            # Dataset evaluation
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── logging/
│   │   │   ├── src/pino-logger.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── metrics/
│   │   │   ├── src/prometheus-registry.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── tracing/
│   │       ├── src/otel-tracer.ts            # OpenTelemetry (non-LLM tracing)
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   └── shared/                              # ── CROSS-CUTTING UTILITIES ──
│       ├── config/
│       │   ├── src/
│       │   │   ├── env.ts                    # zod-validated env loader
│       │   │   ├── config.ts                 # Typed config object
│       │   │   └── config.schema.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       │
│       ├── domain/                          # Domain entities + value objects (pure)
│       │   ├── src/
│       │   │   ├── entities/
│       │   │   │   ├── position.entity.ts
│       │   │   │   ├── pool.entity.ts
│       │   │   │   ├── wallet.entity.ts
│       │   │   │   ├── decision.entity.ts
│       │   │   │   ├── lesson.entity.ts
│       │   │   │   └── signal-snapshot.entity.ts
│       │   │   ├── value-objects/
│       │   │   │   ├── sol-amount.vo.ts
│       │   │   │   ├── bin-range.vo.ts
│       │   │   │   ├── pnl.vo.ts
│       │   │   │   └── risk-budget.vo.ts
│       │   │   └── index.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       │
│       ├── errors/
│       │   ├── src/
│       │   │   ├── base-error.ts
│       │   │   ├── domain-errors.ts
│       │   │   ├── infra-errors.ts
│       │   │   └── result.ts                 # Result<T, E> pattern
│       │   ├── package.json
│       │   └── tsconfig.json
│       │
│       ├── types/
│       │   ├── src/index.ts                  # Shared TS types
│       │   ├── package.json
│       │   └── tsconfig.json
│       │
│       ├── feature-flags/
│       │   ├── src/flags.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       │
│       └── utils/
│           ├── src/
│           │   ├── number.ts
│           │   ├── time.ts
│           │   ├── retry.ts
│           │   └── async.ts
│           ├── package.json
│           └── tsconfig.json
│
├── tests/
│   ├── unit/                                # Per-engine, fast, pure
│   ├── integration/                         # Services + mocked adapters
│   ├── e2e/                                 # Full agent + devnet + canned LLM
│   ├── fixtures/                            # Canonical state, decisions, pools
│   └── helpers/                             # Test utilities, fakes
│
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.agent
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.telegram-bot
│   │   ├── docker-compose.yml               # postgres+timescale+pgvector, redis,
│   │   │                                    #   langfuse, prometheus, grafana, bull-board
│   │   └── docker-compose.dev.yml
│   ├── k8s/                                 # Optional Kubernetes manifests
│   │   ├── agent-deployment.yaml
│   │   ├── api-deployment.yaml
│   │   └── ...
│   ├── grafana/
│   │   ├── dashboards/                      # Dashboards as code
│   │   └── datasources/
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── terraform/                           # Optional IaC
│
├── docs/
│   ├── adr/                                 # Architecture Decision Records
│   ├── runbooks/                            # Incident playbooks
│   ├── architecture/                        # Diagrams, layer docs
│   └── api/                                 # Generated API docs
│
├── scripts/
│   ├── setup-wizard.ts                      # Interactive operator onboarding
│   ├── migrate.ts                           # Run DB migrations
│   ├── codegen-db-types.ts                  # Schema → TS types
│   ├── encrypt-keystore.ts                  # Wallet keystore encryption
│   └── seed-prompts.ts                      # Push initial prompts to LangFuse
│
├── .github/
│   └── workflows/
│       ├── ci.yml                           # lint, typecheck, test, build
│       ├── deploy-staging.yml
│       └── deploy-prod.yml
│
├── .env.example
├── biome.json                               # Lint + format config
├── tsconfig.base.json                       # Shared TS config
├── pnpm-workspace.yaml                      # Monorepo workspace definition
├── package.json                             # Root workspace
├── lefthook.yml                             # Git hooks
└── README.md