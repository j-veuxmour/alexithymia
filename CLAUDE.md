# ALEXITHYMIA — Project Context for Claude Code

> Baca file ini sepenuhnya sebelum melakukan pekerjaan apa pun.
> Ini adalah sumber kebenaran untuk arsitektur, konvensi, dan aturan proyek.

---

## 1. Apa Proyek Ini

ALEXITHYMIA adalah **Autonomous AI Trading Agent** yang fokus pada **Liquidity
Providing (LPing) di Meteora DLMM** pada blockchain Solana. Tujuannya: men-generate
fees secara berkelanjutan dan profitable melalui manajemen posisi likuiditas yang
otonom, cerdas, dan sadar-risiko.

Proyek ini adalah **major enhancement** dari Meridian. Codebase Meridian tersedia
sebagai referensi read-only di `_reference/meridian/`.

ALEXITHYMIA harus: Structured, Systematic, Deterministic, Risk-aware,
Volatility-aware, Liquidity-aware, Market-aware, Alpha-seeking, Modular, Scalable,
Resilient, Robust, Secure, Maintainable, Production-grade, Efficient, dan Dynamic.

---

## 2. Bahasa & Tech Stack (NON-NEGOTIABLE)

- **Bahasa:** TypeScript strict mode. TIDAK ADA JavaScript di kode sumber.
- **Monorepo:** pnpm workspaces.
- **Database:** PostgreSQL sebagai primary DB, dengan extension TimescaleDB
  (time-series) dan pgvector (embeddings). Satu database, beberapa schema.
- **Query builder:** Kysely (typed, bukan ORM berat).
- **Cache / locks / pub-sub:** Redis.
- **Job queues:** BullMQ (di atas Redis).
- **LLM framework:**
  - LangChain — abstraksi provider LLM, definisi tools, structured output.
  - LangGraph — orkestrasi agent (state graph, conditional routing, checkpointing).
  - LangFuse — observability LLM, prompt versioning, evaluation. Self-hosted.
- **Lint & format:** Biome.
- **Test:** Vitest.
- **Validation:** zod untuk SEMUA input eksternal dan output LLM.
- **Logging:** pino (structured JSON).
- **Metrics:** Prometheus. **Tracing non-LLM:** OpenTelemetry.
- **API server:** Fastify.

---

## 3. Arsitektur: The Quartet

Sistem terdiri dari EMPAT layer dengan boundary yang KETAT.

### Layer 1 — WORKERS (Orkestrasi)
- BullMQ job consumers. Long-running processes.
- Tugas: orkestrasi saja — menerima job, memanggil agents/engines/services,
  persist hasil. TIDAK ADA business logic di sini.
- Penulisan DB selalu didelegasikan ke Repository Service — worker tidak
  pernah menyentuh DB langsung.
- Lokasi: `apps/agent/src/workers/`

### Layer 2 — AGENTS (Judgment via LLM)
- LLM-driven. Setiap agent adalah sebuah LangGraph state graph.
- Tugas: keputusan yang butuh nuanced judgment.
- TIDAK boleh: raw math (delegasi ke engine), akses langsung DB/RPC (via tools).
- Lokasi: `packages/agents/`

### Layer 3 — ENGINES (Pure Logic)
- Pure TypeScript. Deterministic. Fully unit-testable.
- TIDAK ADA: I/O, LLM call, akses DB/Redis/RPC, dependency ke framework apa pun.
- Tugas: math, policy, classification, formula.
- Lokasi: `packages/engines/`

### Layer 4 — SERVICES (Infrastruktur I/O)
- Wrapper I/O. Boleh akses DB, Redis, RPC, HTTP.
- TIDAK ADA business logic (delegasi ke engine).
- Lokasi: `packages/services/`

Plus: **Infra Adapters** (`packages/infra/`) — adapter dumb ke sistem eksternal,
hanya dipakai oleh Services.

---

## 4. Dependency Rules (ENFORCE SECARA KETAT)

- **Engines** hanya boleh import: `shared/domain`, `shared/utils`, `shared/errors`.
  Engines TIDAK PERNAH import LangChain, pg, ioredis, services, atau infra.
- **Engines** TIDAK PERNAH memanggil Services atau Agents.
- **Services** BOLEH memanggil Engines. Services TIDAK PERNAH memanggil Agents.
- **Agents** memanggil Engines/Services HANYA via LangChain tool wrappers.
- **Infra adapters** hanya dipakai oleh Services.
- **Workers** boleh memanggil Agents, Engines, Services, Persistence.
- **shared/*** tidak meng-import apa pun internal (ini foundation layer).
- Arah dependency tidak boleh terbalik. Jika ragu, jangan import — tanya dulu.

Setiap package punya `package.json` sendiri. Dependency yang tidak di-declare
TIDAK BOLEH di-import. Ini memaksa boundary secara mekanis.

---

## 5. Komponen Sistem

### 6 Agents (LLM-driven)
1. **Analyst Manager** — pool discovery & deploy decision.
2. **Portfolio Manager** — lifecycle posisi terbuka (hold/close/claim).
3. **Risk Manager** — portfolio risk arbiter; veto authority atas deploy + emergency close.
4. **Strategist Manager** — meta: regime narrative + pemilihan strategy preset.
5. **Learning Manager** — analisis forensik post-close, generate lessons.
6. **Dispatch Officer** — gateway interaksi operator (Q&A + delegasi action).

> Catatan penamaan: lima agent berakhiran "Manager" dan satu "Officer". Dalam
> kode selalu gunakan nama penuh (mis. `analyst-manager`), tidak disingkat.

### 10 Engines (pure logic)
1. **Risk Engine** — ukur & tegakkan batas risk (portfolio + posisi + circuit
   breakers). Memutuskan deploy BOLEH/TIDAK — bukan besarannya.
2. **Strategy Engine** — terjemahkan kondisi pasar → parameter posisi (range,
   bins, slippage).
3. **Signal Engine** — scoring, weighting (Thompson sampling bandits), regime
   detection, hard filters, narrative classifier.
4. **Pricing Engine** — semua kalkulasi finansial (PnL, IL, fee projection,
   cost basis). Menghitung di atas harga mentah dari Market Data Service.
5. **Portfolio Engine** — state portfolio kanonik (aggregation, exposure breakdown).
6. **Learning Engine** — outcome → improvement (lesson extraction statistik,
   threshold evolution, attribution).
7. **TX Construction Engine** — build transaksi, hitung priority fee, firewall
   assertions. Menyusun transaksi (no I/O) — pengiriman ada di TX Submission Service.
8. **Simulation Engine** — backtester, counterfactual, historical replay.
9. **DLMM Engine** — bin array preflight, wide-range path (>69 bins), single-side
   SOL deploy enforcement, volatility timeframe normalization.
10. **Allocation Engine** — Kelly sizing, fractional Kelly, exposure-aware
    allocation. Memutuskan BESARAN modal per posisi.

### 7 Services (I/O infrastructure)
1. **Market Data Service** — read-only ingestion data platform Solana
   (GMGN, Birdeye, Pyth, dll): harga, OHLCV, pool discovery, oracle.
2. **TX Submission Service** — submit tx, retry, confirm, RPC pool, Jito.
3. **Reconciliation Service** — konsistensi state DB vs on-chain.
4. **Notification Service** — alerting multi-channel.
5. **Context Service** — bangun konteks agent (semantic retrieval via pgvector).
6. **Repository Service** — CRUD aplikasi terpusat (Kysely); satu-satunya layer
   yang menyentuh DB untuk operasi normal.
7. **Signing Service** — manajemen kunci, dekripsi private key, signing transaksi.

### Workers (BullMQ consumers)
Analyst, Portfolio, Execution, Learning, Reconciliation, Snapshot,
Notification, Embedding, Simulation, Strategist.

> Worker dinamai per JENIS PEKERJAAN, bukan per agent. Simulation & Execution
> bersifat event-driven (tanpa scheduler). Strategist berjalan terjadwal.

---

## 6. Letak Framework

- **LangChain** → di dalam `packages/agents/*` (tool wrappers, structured output)
  dan `packages/infra/llm/*` (provider adapters).
- **LangGraph** → di dalam `packages/agents/*/graph.ts` (definisi graph) dan
  `packages/persistence/postgres/langgraph-checkpointer.ts` (checkpointing).
- **LangFuse** → terpusat di `packages/observability/langfuse/*`, di-import oleh
  agents (prompts) dan workers (traces).
- Engines TIDAK PERNAH import framework apa pun.

---

## 7. Konvensi Kode

- TypeScript strict. TIDAK ADA `any`. TIDAK ADA `// @ts-ignore` tanpa alasan tertulis.
- Pola error: gunakan `Result<T, E>` untuk operasi yang bisa gagal secara terduga;
  `throw` hanya untuk kondisi yang benar-benar exceptional.
- Semua input eksternal & output LLM divalidasi dengan zod schema.
- TIDAK ADA synchronous file I/O di runtime path (Meridian melakukan ini — jangan tiru).
- Setiap package: tulis types/schema dulu → implementasi → Vitest tests.
- Engines harus punya unit test dengan coverage tinggi (target ≥85%).
- Nama file: kebab-case. Suffix peran jelas: `*.entity.ts`, `*.vo.ts`, `*.node.ts`,
  `*.worker.ts`, `*.repository.ts`, `*.queue.ts`.
- Komentar secukupnya, jelaskan "kenapa" bukan "apa".

---

## 8. Keamanan (WAJIB)

- Wallet private key: enkripsi dengan **AES-256-GCM + KDF (scrypt/Argon2id)**.
  JANGAN gunakan XOR seperti Meridian — itu tidak aman.
- Signing hidup di **Signing Service** (`packages/services/signing/`). Signer
  harus pluggable: local-AES, AWS KMS, Turnkey. Definisikan interface dulu.
- Setiap transaksi WAJIB lewat TX Firewall (invariant assertions) sebelum sign.
  Firewall adalah pure logic di TX Construction Engine.
- Semua teks tidak tepercaya (token narrative, pool memory, dll) lewat
  `input-sanitizer` dengan prompt-injection filter.
- Idempotency key untuk SEMUA operasi write (deploy/close/claim/swap).
- Rahasia tidak pernah masuk ke log, ke prompt LLM, atau ke git.

---

## 9. Referensi Meridian

Codebase Meridian ada di `_reference/meridian/`. Gunakan untuk MEMAHAMI:
- Domain logic Meteora DLMM (deploy, close, claim, bin math, wide-range path).
- Pola screening pool, scoring, threshold.
- Alur agent.

JANGAN tiru anti-pattern Meridian:
- Monolith (`dlmm.js` 1900+ baris, `index.js` 2000+ baris).
- XOR "encryption" untuk private key.
- JSON file sebagai database.
- `node-cron` tanpa distributed locking.
- Math di dalam prompt LLM.
- Sync file I/O di runtime.
- Hardcoded fallback API keys.
- Selfbot Discord (langgar ToS).

`_reference/` ada di `.gitignore` — bukan bagian dari proyek, hanya untuk dibaca.

---

## 10. Cara Kerja yang Diharapkan

- Bangun **package demi package**, bukan semuanya sekaligus.
- Untuk tugas besar: buat RENCANA dulu, tunggu konfirmasi, baru implementasi.
- Setelah satu package selesai + test hijau: sarankan commit.
- Jika sebuah keputusan arsitektural ambigu atau tidak tercakup di file ini
  atau di `docs/architecture/`, BERTANYA dulu — jangan mengasumsikan.
- Selalu jalankan typecheck + test setelah perubahan signifikan.
- Dokumen detail arsitektur ada di `docs/architecture/` — baca saat relevan.
