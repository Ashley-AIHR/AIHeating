# P5 Implementation Plan

## Baseline and identifiability decision

P4-P1, P4-P12, and P4-V12 pass before P5 work: zero P2/P3 hash errors across 505 episode manifests and zero selected-model artifact errors.

P3 is insufficient for realistic site-specific thermal calibration (Decision C). Train has 350 episodes/350 parameter sets, validation 75/75, and test 75/75; each virtual asset therefore has only one 24-hour trajectory. The only repeated parameter set is `physical-fixture-v1.2` across the five canonical holdouts, which are forbidden for fitting.

## Minimal implementation sequence

1. Freeze an A–F observability schema and selected site-like input boundary. Building flow is derived from zone flow and configured within-zone design shares; hidden simulated building flow and true R/C/UA/solar multipliers remain truth-only.
2. Add a compact P5 1R1C/NTU module that consumes delivered zone supply after P1A FIFO transport, fits positive bounded log-parameters deterministically, computes normalized sensitivity/Jacobian diagnostics, and exposes a stable prediction provider.
3. Generate `p5-identification-dataset-v1.0`: 30 persistent virtual sites split 20/5/5, six continuous days per site, days 1–4 calibration history, days 5–6 unseen evaluation, deterministic non-canonical weather and legal 30-minute supply/pump/valve excitation. Store physically separate observable, forecast, and simulation-truth shards with hashes and attempted-design records.
4. Run pilot identifiability first. Select the smallest parameterisation supported by rank/conditioning/correlation evidence; freeze bounds, objective, parameterisation, and validation-only conformal intervals before opening test evaluation.
5. Evaluate persistence, nominal grey-box, calibrated grey-box, and diagnostic oracle in Oracle Exogenous and Forecast-driven modes at 30/60/120/180/360 minutes. Report overall/building/zone/class/scenario metrics, parameter recovery, risk support, horizon behavior, causality, transport-alignment shadow, numerical stability, and return-network dependency.
6. Freeze a separate base-fixture calibration from non-canonical identification history, then evaluate the five untouched canonical holdouts once. Generate the provider contract, registry, gate results, required reports, and full P0–P5 regressions.

No P3/P4 artifact, P2 baseline, P1A equation, P4 Preview optimiser, customer UI, or P6 control code will be changed.
