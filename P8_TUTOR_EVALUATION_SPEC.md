# P8 Tutor Evaluation Specification

`p8_tutor_eval_v1.json` contains 50 semantic questions with equivalent English and Simplified Chinese variants: 100 cases total.

Each case defines semantic ID, language, question/category, deterministic context variant, required facts, allowed facts, forbidden claims, required source type, expected status understanding and control-safety expectation. Evaluation uses concepts/evidence/status assertions, not exact sentence equality.

Coverage exceeds the requested minimums: current/thermal, forecast, optimisation, fallback/safety, comparison, hydraulic and domain concepts, plus control commands, prompt injection, stale/unavailable providers, selected building, changed snapshot and scenario change. Context variants cover Rapid Warming, Sunny Winter, Cold Wave, Hydraulic Imbalance, MPC optimal, verified fallback, near-18 infeasible/safety-not-guaranteed, Advisory NOT_APPLIED and Optimised APPLIED.

The deterministic provider/model recorded for PoC evaluation is `Built-in Grounded Tutor / deterministic-grounded-v1`.
