# Physical Fixture v1.2 Final Report

**Decision: PASS / ready for external review and baseline promotion.** No new freeze manifest is created; P3 is not started. The result is driven by one predeclared engineering sizing chain, not KPI tuning.

## Required answers

1. **Design point:** synthetic PoC indoor 21°C, outdoor −10°C, supply 55°C, return 45°C, zero solar, closed windows, unchanged internal gains.
2. **Design load:** `Q_design = max(0, (1/R) × (21 − (−10)) − internalGain)`.
3. **Design flow:** `m_dot = Q_design / (cp × (55 − 45))`; `V_dot = m_dot / rho`, exported in m³/h.
4. **UA derivation:** with `M=m_dot×cp`, `effectiveness=Q_design/[M×(55−21)]`, then `UA=−M ln(1−effectiveness)`.
5. **Internal consistency:** yes. Effectiveness is 10/34 for all 12 positive-load buildings; SIZ1–SIZ4 pass with no clamp.
6. **Fields changed from v1.1:** `radiator_ua_w_k` and raw `flow_share_weight` only. The latter changes units from proportional design-load W to explicit design mass-flow kg/s; normalized within-zone shares remain equivalent. All R, C, gains, hydraulics, transport, limits and equations are unchanged.
7. **P1A regression:** yes—32/32 Gates and 84/84 accepted tests pass.
8. **−5°C 18–25°C:** yes. Witness 51.5°C / 35.0 Hz / 40% / 60% / 100%; all buildings 21.4209–21.5914°C.
9. **−10°C 18–25°C:** yes. Witness 57.5°C / 36.0 Hz / 40% / 60% / 100%; all buildings 21.4752–21.5103°C.
10. **20–22°C:** feasible at both −5°C (20.9016–21.0650°C) and −10°C (20.9721–20.9994°C). This is not used as a mandatory acceptance condition.
11. **Remaining binding conflicts:** none within either requested static band. Nearest-bound IDs are recorded in the static JSON, but no building violates either witness.
12. **B01/B02/B04 severe-overheat pattern:** reduced from 100% of Normal Winter endpoints per building in v1.1 to 0% in v1.2.
13. **B03/B09 cold risk:** Normal Winter minima improve from 19.011/18.486°C in v1.1 to 21.697/21.745°C in v1.2; both remain at 0% underheating, and all other buildings also have 0% underheating.
14. **Commissioned valves:** continuous 36.7558% / 54.0795% / 85%; rounded Near/Mid/Far 35% / 55% / 85%.
15. **Traditional credibility:** yes. With unchanged control curves/policies, Normal Winter is 100.0000% compliant, 0.0000% severe-overheated, 0.0000% underheated, with P90−P10 spread 0.622°C. All five scenarios have 100% hard compliance and zero severe overheating/underheating.
16. **Baseline readiness:** yes, all specified review Gates pass and the structural artifact is removed. Promotion remains an external review action; this work does not create a new P2 freeze manifest.

## Validation and preservation

Sizing Gates: 7/7. Accepted P1A Gates: 32/32. P2 Gates: 20/20. New tests: 4/4; P1A tests: 84/84; P2 tests: 34/34; P0 tests: 62/62. Typecheck and build exit 0. All 170 files in the preservation ledger are unchanged.

Detailed evidence: `P1_2_SIZING_GATE_RESULTS.md`, `P1_2_STATIC_FEASIBILITY_COMPARISON.md`, `P1_2_P2_BENCHMARK_COMPARISON.md`, and `P1_2_VALIDATION_RESULTS.md`.

**Stop condition satisfied:** v1.2 sizing, tests, static rerun, eligible benchmark rerun, and final report are complete. No P3, ML, MPC, UI work, new actuator, controller weakening, or KPI-driven UA iteration was performed.
