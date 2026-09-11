# P9 Technical Demo Script (15–20 minutes)

## 1. Release boundary (2 minutes)

Identify RC1 as a Synthetic Digital Twin PoC. Run `node scripts/verify-p0-p8-integrity.mjs`. Explain that P0–P8 accepted artifacts are hash-bound and canonical evidence is consumed without regeneration. The browser is a Guided Evidence Runtime; no active interval-by-interval model orchestration exists.

## 2. P1A physics (2 minutes)

Cover the secondary-network pump curve, coupled hydraulic solve, flow-dependent zone transport delay, radiator heat transfer and building thermal state. Physical Fixture v1.2 uses commissioned Near/Mid/Far valves 0.35/0.55/0.85. Hydraulic Imbalance retains the 2× Far resistance and is a secondary engineering benchmark.

## 3. P4 prediction (2 minutes)

Trace p3-dataset-v1.0 through Persistence, Physics, Linear Regression and selected LightGBM. Show 60/120/180/360-minute artifacts and split-conformal intervals. Emphasise issued-forecast features, leakage controls and held-out synthetic metrics.

## 4. P5 thermal model (2 minutes)

Describe nominal versus calibrated grey-box prediction. Only effective H/C scales were selected because UA/solar/internal gains were confounded and remain priors. Explain forecast-driven intervals and the three-hour primary control use. State sensor-noise, distribution-shift and `<18°C` TEST limitations.

## 5. P6 Formal MPC (3 minutes)

Show the frozen objective, 30-minute control interval, 3-hour horizon, supply/pump/valve limits and local sensitivity model. Explain candidate solve, robust lower-bound constraint, nonlinear P1A verification and application eligibility. Distinguish Preview v0 from final Formal MPC v1.

## 6. Status, fallback and safety (2 minutes)

Demonstrate three branches: Rapid optimal/verified, Cold Wave solver limit/verified fallback, and near-18 infeasible/unverified fallback/Safety Not Guaranteed. State that an unverified fallback cannot apply. Keep technical OSQP status in layered detail. Note valve chatter, actuator deadband/hold-time/wear/backlash/latency as follow-up; do not retune here.

## 7. P7 provider architecture (2 minutes)

Open `src/p7-provider.ts`. Show static accepted payload providers and the separate availability, optimisation, verification, fallback, safety and application dimensions. Explain cross-page time/version consistency and why raw model files are not read by customer pages.

## 8. P8 grounding (2 minutes)

Show context construction, deterministic routing/provider, response validator and UI failure boundary. The Tutor uses P7 structured context plus curated knowledge, never DOM scraping, has no control callback, is bilingual and rejects control/prompt-injection requests. No live LLM/API key is present.

## 9. Evidence and reproducibility (2 minutes)

Run P9 gates, five-run deterministic replay, browser checks, clean temporary install/build and full regression. Show `p9_regression_results.json`, the final acceptance matrix and release manifest verification.

## 10. Real-site transition (1 minute)

Walk through read-only integration → data validation → calibration → shadow prediction → shadow MPC → operator advisory → limited supervisory loop → production hardening. Closed loop requires independent PLC/DCS protections, bounds, watchdog, stale/timeout policies, override, audit, rollback and alarms.
