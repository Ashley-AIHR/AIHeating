# P8 Gate Results

Machine source: `p8_gate_results.json`. Summary: **38/38 PASS, 0 failed, 0 skipped**.

| Group | Gates | Result | Key evidence |
|---|---:|---|---|
| Context | C1–C8 | 8/8 PASS | P7-only source, page/selected-building context, identity changes, freshness omission, <24 KB, no hidden truth |
| Grounding | G1–G8 | 8/8 PASS | Evidence refs, missing telemetry, epistemic distinctions, current-context/scenario isolation |
| MPC/Safety | S1–S8 | 8/8 PASS | Optimal, solver limit, verified fallback, infeasible, safety, physical cause, control refusal, Advisory |
| Domain | D1–D7 | 7/7 PASS | Supply/demand, fair Traditional, delay/inertia, coupled hydraulics, P4/P5/P6, ablation, synthetic boundary |
| Language/UI | U1–U7 | 7/7 PASS | EN/ZH 50 each, unchanged pages, contextual prompts, isolated timeout, explanation label |

The complete regression in `p8_regression_results.json` records zero exit codes for P8 context/evaluation/UI/Gates/browser, P7 integration, P6, P5, P4, P3, Fixture v1.2, P2, P1A, P0 typecheck/tests/build, and P0–P7 integrity before and after.

Non-blocking limitations: the default PoC provider is deterministic rather than a connected external LLM; all evidence is synthetic; and the accepted static P7 snapshot provides aggregate P5 thermal trajectories, so per-building P5 values are explicitly unavailable unless supplied by a future structured runtime provider.
