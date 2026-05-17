# Komponen — 6 Agents, 10 Engines, 7 Services, Workers

## 6 AGENTS (LLM-driven, LangGraph state graphs)

1. ANALYST MANAGER — Pool discovery & deploy decision.
   Pilih satu pool terbaik dari kandidat, putuskan DEPLOY/SKIP, jelaskan reasoning.
   Model: premium. Trigger: tiap 30 menit / on-demand.

2. PORTFOLIO MANAGER — Lifecycle posisi terbuka.
   Evaluasi tiap posisi: HOLD/CLOSE/CLAIM. Eksekusi swap setelah close.
   Per-posisi paralel (LangGraph Send API). Model: balanced. Trigger: tiap 5-10 menit.

3. RISK MANAGER — Portfolio risk arbiter.
   Veto authority atas deploy. Authority memerintah emergency close (pilih mana).
   Sub-graph dipanggil dari Analyst Manager. Model: premium.

4. STRATEGIST MANAGER — Meta-agent regime & preset.
   Baca market regime, pilih strategy preset, keluarkan season-note.
   Scope: regime narrative + preset selection saja. Model: premium.
   Trigger: tiap 4-6 jam / regime change.

5. LEARNING MANAGER — Analisis forensik post-close.
   Analisa kenapa posisi menang/kalah, usulkan lesson (dengan backing statistik
   dari Learning Engine). Model: balanced. Trigger: per position close.

6. DISPATCH OFFICER — Gateway operator.
   Q&A read-only + delegasi action ke Analyst Manager / Portfolio Manager.
   Bukan god-executor. Model: balanced/haiku. Trigger: on-demand.

## 10 ENGINES (pure logic, no I/O, no LLM)

1. RISK ENGINE — Portfolio risk, position risk, correlation, circuit breakers.
   Output: policy decision (deploy allowed/denied). Consume Pricing.
   Catatan: memutuskan BOLEH/TIDAK deploy — bukan besarannya (lihat Allocation).

2. STRATEGY ENGINE — Range calculator, bin selector, strategy library,
   strategy selector, slippage calculator. Terjemahkan kondisi → parameter posisi.

3. SIGNAL ENGINE — Candidate scorer, signal weighter, Thompson sampling bandits,
   narrative classifier, hard filters, regime detector.

4. PRICING ENGINE — PnL calculator, IL calculator (current + projected),
   fee projector, TVL impact, oracle reconciler, cost basis. Semua math finansial.
   Catatan: menghitung di atas harga mentah dari Market Data Service — tidak fetch.

5. PORTFOLIO ENGINE — Portfolio aggregator (state kanonik), exposure breakdown,
   equity curve. Single source of truth untuk "state portfolio saat ini".

6. LEARNING ENGINE — Lesson extractor (statistical significance gated),
   threshold evolver (Bayesian), attribution.

7. TX CONSTRUCTION ENGINE — TX builder (compute budget, instruction assembly),
   priority fee calculator (math), firewall (invariant assertions), allowed programs.
   Catatan: menyusun transaksi (no I/O) — pengiriman ada di TX Submission Service.

8. SIMULATION ENGINE — Backtester, counterfactual, historical replay.
   Mesin simulasi historis. Dipisah dari Learning Engine karena beda sifat
   (simulasi historis vs ekstraksi lesson real-time).

9. DLMM ENGINE — Bin array preflight, wide-range path (>69 bins),
   single-side SOL deploy enforcement, volatility timeframe normalization.
   Logika murni khas DLMM.

10. ALLOCATION ENGINE — Kelly sizing, fractional Kelly, exposure-aware allocation,
    sisa kapasitas portfolio. Menjawab "BERAPA" — besaran modal per posisi.
    Catatan: Risk Engine memutuskan boleh/tidak; Allocation memutuskan besarannya.

## 7 SERVICES (I/O infrastructure)

1. MARKET DATA SERVICE — Read-only ingestion platform Solana
   (GMGN, Birdeye, Pyth, dll). Fetch harga, OHLCV, kandidat pool, oracle price.
   Mem-feed Signal, Pricing, DLMM, Simulation. Tidak pernah menulis ke chain.

2. TX SUBMISSION SERVICE — Write path ke chain (Helius, Jupiter, Meteora, Jito).
   Submit tx, retry + fee bump, confirmation watcher, multi-RPC pool dengan
   failover, Jito bundler, idempotency guard (Redis).

3. RECONCILIATION SERVICE — Chain reconciler, PnL reconciler, balance reconciler,
   orphan detector, backfill. Jaga konsistensi DB vs on-chain.

4. NOTIFICATION SERVICE — Alert router (severity → channel), template renderer,
   rate limiter, digest builder, briefing generator. Channels: Telegram/Discord/PagerDuty.

5. CONTEXT SERVICE — Context builder untuk agent, lesson retriever (pgvector
   semantic search), decision retriever, embedder.

6. REPOSITORY SERVICE — CRUD aplikasi terpusat (Kysely). Penulisan & pembacaan
   tabel app, hypertable timeseries, dan tabel embeddings. Satu-satunya layer
   yang menyentuh DB untuk operasi normal (Reconciliation tetap terpisah —
   tugasnya konsistensi, bukan CRUD biasa).

7. SIGNING SERVICE — Manajemen kunci, dekripsi private key (AES-256-GCM),
   signing transaksi. I/O sensitif yang diisolasi dari TX Submission.

## WORKERS (BullMQ consumers)
Analyst, Portfolio, Execution, Learning, Reconciliation, Snapshot,
Notification, Embedding, Simulation, Strategist. Lokasi: apps/agent/src/workers/.

Catatan: worker dinamai per JENIS PEKERJAAN, bukan per agent. Worker hanya
orkestrasi — penulisan DB tetap didelegasikan ke Repository Service.
- Snapshot Worker: cron → Market Data Service → Pricing Engine → Repository Service
  (tulis hypertable timeseries).
- Embedding Worker: event-driven → embedder (Context Service) → Repository Service
  (tulis tabel embeddings).
- Simulation Worker: backtest terjadwal/berat — worker sendiri, tidak menebeng.
- Strategist Worker: menjalankan Strategist Manager (terjadwal 4-6 jam / regime change).

## Pemetaan Agent → Engine
Catatan: engine bersifat shared — dipakai banyak agent. Pemetaan ini mencerminkan
ketergantungan nyata, bukan kepemilikan eksklusif.
- Analyst Manager: Signal, Strategy, Pricing, DLMM, Allocation
- Portfolio Manager: Risk, Pricing, Strategy, DLMM
- Risk Manager: Risk (semua submodule), Portfolio, Allocation
- Strategist Manager: Signal (regime), Risk, Learning
- Learning Manager: Learning, Simulation, Pricing, Signal
- Dispatch Officer: semua (mostly read-only)
