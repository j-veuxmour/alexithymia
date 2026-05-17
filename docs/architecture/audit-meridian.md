# Audit Meridian — Ringkasan

Hasil audit codebase Meridian (`_reference/meridian/`). Dipakai untuk memutuskan
apa yang dipertahankan dan apa yang dibuang di ALEXITHYMIA.

## Strengths Meridian (PERTAHANKAN konsepnya)
- Role-based tool gating (SCREENER/MANAGER/GENERAL) — kurangi blast radius.
- ReAct loop dengan safety discipline: once-per-session lock, no-retry untuk deploy,
  tool_choice=required untuk anti-hallucination.
- Structured decision log (reason, risks, rejected alternatives) — explainability.
- Transaction pre-sign simulation pada relay path (cek SOL drain & unknown mint debit).
- Domain knowledge kuat: bin array preflight, wide-range path (>69 bins),
  single-side SOL deploy enforcement, volatility timeframe normalization.
- Multi-layer learning: lessons + threshold evolution + signal weights + hivemind.
- DRY_RUN mode di semua write path.

## Weaknesses Meridian (PERBAIKI / BUANG)
- Security: XOR "encryption" untuk private key — tidak aman. Ganti AES-256-GCM.
- Monolith: dlmm.js 1900+ baris, index.js 2000+ baris — sulit di-test & maintain.
- Reliability: tidak ada priority fee / compute budget; sendAndConfirmTransaction
  single-shot tanpa retry robust; single RPC tanpa failover.
- JSON file sebagai DB; sync file I/O blocking event loop; multiple writer race.
- evolveThresholds() referensi key config yang salah — sebagian no-op.
- State drift: state.json bisa tidak sinkron dengan on-chain.
- Prompt bloat: full state JSON di-inject tiap cycle; math (bins_below) ada di prompt.
- Observability minim: hanya log file, tidak ada metrics/tracing.
- Testing nyaris nol: hanya syntax check + smoke script.
- Risk engineering: tidak ada portfolio-level drawdown, daily loss cap, exposure cap,
  IL tracking, dynamic slippage, kill switch.

## Keputusan untuk ALEXITHYMIA
Ambil konsep bagus, tulis ulang dengan arsitektur Quartet, TypeScript strict,
PostgreSQL, dan engineering practice production-grade.