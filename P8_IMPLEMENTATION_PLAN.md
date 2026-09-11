# P8 Implementation Plan

## Pre-code boundary check

P0–P6 registered hashes passed, P7 Gates were 22/22, P7 regression passed, and the P7 provider/state contract files were unchanged. P8 does not edit P1A physics, P2 baseline, P3 data, P4 models, P5 calibration, P6 MPC, or P7 provider/state semantics.

## Minimal implementation

1. Build one typed, page-aware `TutorContextPacket` from the P7 runtime provider abstraction.
2. Add one concise bilingual domain-knowledge package and deterministic question router.
3. Define a model-independent `TutorLLMProvider`; use a deterministic grounded provider because the repository has no existing LLM connection.
4. Validate evidence and state-sensitive claims, replacing invalid/provider-failed responses with a safe structured fallback.
5. Add one small Tutor overlay on Overview, Simulation, Forecast and Results without changing page structure.
6. Evaluate bilingual facts, forbidden claims, context changes, safety, control refusal and grounding; run full P8→P0 regression and before/after integrity checks.

No web retrieval, API key, control tool, new prediction/control algorithm, general RAG system, or P9 live-runtime implementation is included.
