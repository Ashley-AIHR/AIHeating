# P3 Final Report

## Required answers

1. **What was built?** A reusable deterministic Simulation Dataset Factory producing versioned physical episodes, five data tables, per-episode QA, and content-addressed lineage manifests.
2. **Frozen inputs?** Accepted P1A engine and `physical-fixture-v1.2`, frozen `traditional-v1.2`, fixed 35/55/85% valves, and the frozen P2 v1.2 canonical forcing for holdout only.
3. **Parameter envelope?** R, C, gains, solar aperture, Kpipe, and Kvalve ±20%; pump parameters and radiator margin ±10%; transport volume nominal.
4. **Coherence?** The v1.2 sizing chain recomputes design load, design flow, and base radiator UA after independent building changes; emitter margin is applied last and every set is validated and hashed.
5. **Scenario variants?** All five families receive deterministic temperature offset/amplitude, solar, and wind changes; Hydraulic Imbalance also varies Far resistance from 1.5× to 3.0×. No physical response is directly forced.
6. **Warm-up?** A stratified 72h/96h study triggered the documented fallback; one global 96-hour controller-consistent warm-up is used for P3B.
7. **Outputs?** Per-episode gzip CSV shards for raw state, long building state, synthetic weather forecasts, load targets, and building-temperature targets, plus JSON manifests/reports.
8. **Schema?** `dataset_schema.json` is the authoritative field-by-field schema with exact order, type, unit, nullability, table, source, semantic description, and classification.
9. **Forecasts?** `synthetic_weather_forecast_v1` adds deterministic horizon-dependent error to future weather truth at 30-minute issues through 6 hours; forecasts are stored separately and are not claims of real accuracy.
10. **Load targets?** Same-episode accepted `required_heat_w` truth at 1/2/3/6-hour horizons, converted to MW; actual heat supply is not substituted.
11. **Temperature targets?** Same-episode building indoor truth at 0.5/1/2/3/6-hour horizons in a separate long label table.
12. **Splits?** Whole episodes, fixed before simulation: 350 train, 75 validation, 75 test; parameter/scenario/seed/forecast-seed identities are disjoint.
13. **Canonical isolation?** The five unmodified P2 v1.2 scenarios exist only in the five-row `benchmark_holdout` episode partition and never in pilot or ML splits.
14. **Counts?** 505 episodes. Total rows: raw 145,440; building 1,745,280; forecast 218,160; load labels 72,720; temperature labels 1,090,800. Per-split counts are in `P3_DATASET_QA_REPORT.md`.
15. **Simulation failures?** None: 505 fixed official descriptors completed; no failed episode was discarded or replaced.
16. **Physical Gate failures?** None. All pilot, one-factor stress, and official physical QA checks passed.
17. **Leakage failures?** None. B3/B4/B9/B10 and the explicit leakage audit passed with zero collision or canonical-isolation finding.
18. **Reproducibility?** Yes. All 15 pilot episodes and a stratified 30-episode official sample regenerated to identical shard hashes from their descriptors/manifests.
19. **Limitations?** Synthetic population and forecast errors; no claim of real customer representativeness; only five families; Traditional-controller trajectories only; no identification excitation; wind remains context-only in accepted physics; gzip CSV was used because Parquet support was unavailable and adding a dependency was unnecessary.
20. **P4 readiness?** Yes. Schemas, lineage, splits, forecasts, labels, hashes, QA, and regressions are complete; P4 may consume the frozen dataset after review.

## Regression and freeze status

P3A Gates: 15/15 PASS. P3B Gates: 14/14 PASS. P1A Gates: 32/32 PASS. P2 Gates: 20/20 PASS.

P3 tests 7 passed; P1.2 tests 4 passed; P2 tests 34 passed; P1A tests 84 passed; P0 typecheck, 62 tests, and production build all exited zero. Freeze hashes passed before and after regression. No accepted physical, controller, scenario, metric, or P0 contract file changed.

P3 Gate: PASS
