# The Quartet — 4 Layer Arsitektur

ALEXITHYMIA dibangun dalam 4 layer dengan boundary ketat.

## Layer Definitions

### WORKERS — Orkestrasi
- BullMQ job consumers, long-running processes.
- Hanya orkestrasi: terima job → panggil agents/engines/services → persist hasil.
- TIDAK ada business logic.
- Lokasi: apps/agent/src/workers/

### AGENTS — Judgment (LLM)
- LLM-driven. Setiap agent = LangGraph state graph.
- Hanya keputusan yang butuh nuanced judgment.
- TIDAK ada raw math (delegasi ke engine), TIDAK akses DB/RPC langsung (via tools).
- Lokasi: packages/agents/

### ENGINES — Pure Logic
- Pure TypeScript. Deterministic. Fully unit-testable.
- TIDAK ada I/O, LLM, akses DB/Redis/RPC, atau dependency framework.
- Math, policy, classification, formula.
- Lokasi: packages/engines/

### SERVICES — Infrastruktur I/O
- Wrapper I/O (DB, Redis, RPC, HTTP).
- TIDAK ada business logic (delegasi ke engine).
- Lokasi: packages/services/

## Dependency Direction (WAJIB)
- Engines: import hanya shared/domain, shared/utils, shared/errors.
- Engines TIDAK PERNAH panggil Services atau Agents.
- Services BOLEH panggil Engines. Services TIDAK PERNAH panggil Agents.
- Agents panggil Engines/Services HANYA via LangChain tool wrappers.
- Infra adapters hanya dipakai Services.
- Workers boleh panggil semua.
- shared/* tidak import apa pun internal.

## Mental Model
- Worker = "Saat job datang, lakukan X"
- Agent = "Diberi konteks, putuskan Y"
- Engine = "Diberi input, hitung Z"
- Service = "Bicara ke sistem eksternal W"

## Mengapa Trinity+Workers
- Testing strategy jelas per layer.
- Failure domain terisolasi (engine bug ≠ service crash ≠ LLM outage).
- Cost optimization: engine gratis & cepat, service ada cost I/O, agent mahal (LLM).
- Boundary dipaksa secara mekanis via package.json dependency declaration.