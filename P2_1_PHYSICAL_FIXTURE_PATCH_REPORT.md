# P2.1 Physical Fixture Patch Report

Date: 2026-09-08. P0 frozen; P1A equations accepted; P1B skipped; P2 engineering tests pass, benchmark external-review hold remains; P3 not started.

## 1. Executive Summary

**The targeted allocation correction was implemented and verified, but the v1.1 candidate did not resolve the control-authority conflict. No v1.1 baseline freeze is issued.**

Area-based allocation materially mismatched static building design loads. Replacing only within-zone flow weights with the requested deterministic design-load formula removes that mismatch and improves Normal compliance to 100%. However, comfort remains 0%, severe overheating remains 25%, and the same B01/B02/B04 remain above 25°C all day. Near still has an empty fixed-flow feasible supply interval.

All five allocation Gates, all 32 P1A physical Gates and all 20 legacy P2 Gates pass. Numerical correctness does not override the unresolved fixture review issue. The appropriate outcome is to stop for external review, not tune more parameters or promote this candidate.

## 2. Reason for Review

v1.0 Normal Winter reported 98.4375% compliance, 0% comfort, 67.1007% overheating, 25% severe overheating and 17.9268–29.0651°C indoors. External review suspected `flowShareWeight=heatedArea`, not controller malfunction. The investigation followed SPEC v1.2 and the accepted equations, using requested synthetic design conditions 21°C/−10°C with no solar. No conflicting SPEC design outdoor value was found; no climate-standard claim is made.

## 3. v1.0 Building-Level Diagnosis

Before introducing the v1.1 provider, `diagnose_p2_1_v1_0.py` reran historical Normal using its unchanged controller and 96-hour warm-up and checked every B01–B12 temperature against the existing 288-row CSV exactly. `P2_1_BUILDING_DIAGNOSTIC_V1_0.md` reports all requested static profiles, H/R/C/UA, weights, average allocated flows, design heat loss/maintenance load, temperature extrema, exposures, radiator power and required-load means.

Measurements use actual per-building `BuildingThermalState`, not inference from aggregate rates. The 99-file v1.0 historical hash inventory was captured and verified before changes.

## 4. Severe-Overheating Buildings

B01, B02 and B04 each have 288/288 endpoints above 25°C in v1.0 Normal: exactly 864/3,456 building-time samples = 25%. Their mean temperatures are 28.6318/28.8284/28.4527°C. This is a persistent three-building pattern, not different buildings briefly crossing the threshold.

In v1.1 Normal the means fall to 28.0420/28.2436/27.8602°C, but all three still have 288/288 severe samples. Their v1.1 minima remain above 27.64°C. Per-building outputs confirm that the same three buildings are severe throughout all five v1.1 evaluations.

## 5. Underheating Driver Buildings

Historical Normal underheating is B09, not B03: B09 has 54/288 samples below 18°C, minimum 17.9268°C; B03 stays above 18.0449°C but has little margin. v1.1 Normal has no underheating; B09 minimum becomes 18.4858°C and B03 minimum 19.0110°C. Under Cold Wave, v1.1 B03 still has 21 underheated samples and B09 103, making pooled underheating 3.5880%; this is lower than v1.0's 8.2176%.

## 6. Area-Based Allocation Analysis

Design-load share = building design maintenance heat / zone design maintenance heat. Area-flow share = building area / zone area. Normalized L1 mismatch = Σ|actual share−design share|, with range 0–2.

| Zone | v1.0 mismatch | v1.1 mismatch |
| --- | --- | --- |
| near | 0.315585 | 0.000000 |
| mid | 0.000000 | 0.000000 |
| far | 0.124632 | 0.000000 |

B02/B03 both have area 980 m² and internal gain 2,940 W, but design heat is 24,402 versus 51,744 W because their H values are 882 versus 1,764 W/K. Equal original flow shares 0.230047 were not design-load shares. Mid's uniform insulation/gain per area means its normalized shares legitimately remain unchanged.

## 7. Design-Load Allocation Formula

`H_envelope = 1/R`; `designRequiredHeatW = max(0,H_envelope×(21−(−10))−internalGainW)`; `flowShareWeight = max(1 W,designRequiredHeatW)`.

The 1 W floor only protects a hypothetical zero-load profile's positive weight; it is inactive for every B01–B12. No solar, weather sequence, indoor observation, comfort KPI, P2 CSV, prediction or MPC output enters generation. There is one rule for all buildings, no B03 special case. Existing normalization remains `buildingFlow=zoneFlow×weight/ΣzoneWeights`.

The only runtime implementation addition is an independent v1.1 static parameter provider plus a scenario wrapper. Following the ponytail skill, accepted model/controller/runner code is reused without a new framework or dependency.

## 8. v1.1 Static Weights

| Building | Previous area weight | Design heat / new weight W |
| --- | --- | --- |
| B01 | 1200.000000 | 29880.000000 |
| B02 | 980.000000 | 24402.000000 |
| B03 | 980.000000 | 51744.000000 |
| B04 | 1100.000000 | 27390.000000 |
| B05 | 1100.000000 | 41030.000000 |
| B06 | 1050.000000 | 39165.000000 |
| B07 | 920.000000 | 34316.000000 |
| B08 | 1180.000000 | 44014.000000 |
| B09 | 900.000000 | 47520.000000 |
| B10 | 1050.000000 | 39165.000000 |
| B11 | 1300.000000 | 48490.000000 |
| B12 | 1150.000000 | 42895.000000 |

Export: `p1a_parameters_physical_fixture_v1.1.json`, fixtureVersion `physical-fixture-v1.1`, flowAllocationMethod `design-maintenance-load-share`, design 21/−10°C, solar 0, complete parameter data and previous weights. Canonical physical parameter SHA-256: `bd4b142e38b7c85a2749c34d129efdfe6f44d4c1f9bd9943cac7b4c7357c0260`. Independent profile-diff test allows only `flow_share_weight`; R/C/UA, gains, pump/pipe/FIFO/equipment data are unchanged.

## 9. Zone Flow Conservation

GFA1 measured maximum building-to-zone relative mass residual 1.4338946509806438e−16 across all 1,440 candidate frames (threshold <1e−6). GFA2 maximum share difference from normalized design weights is 5.551115123125783e−17 (threshold <1e−14). GFA3 compares same-area B02/B03 design loads; GFA4 audits static-only source dependencies; GFA5 confirms exact deterministic weights.

All five GFA Gates pass. Existing hydraulic equations solve the same total/zone flows as v1.0. Offline zone commissioning was rerun unchanged and again produces Near/Mid/Far 50/60/85%, because its static area-share inputs and branch resistances are unchanged.

## 10. Static Control-Authority Analysis

`P2_1_CONTROL_AUTHORITY_ANALYSIS.md` includes every building at −10°C/46 Hz and −5°C/44 Hz, no solar, with v1.0 and v1.1 allocations. It reports design envelope loss/internal gains/required heat, allocated flow, actual NTU conductance, radiator power at supply 47/51/55°C, supply needed for design 21°C, and each building's 18–25°C feasible interval.

Heat is not proportional to water flow: `G=m cp(1−exp(−UA/(m cp)))` saturates at UA. B03/B09 have Low insulation but radiator UA still scales only with area. At 55/21°C, even infinite water flow yields at most 46,648/42,840 W versus design demand 51,744/47,520 W. This establishes insufficient emitter capacity for that particular design duty and supply, not a defect in NTU physics or a universal statement about all possible operating conditions.

## 11. Near Feasible Supply Range

| Outdoor °C | Pump Hz | Lower supply °C | Upper supply °C | Fixed-flow result |
| --- | --- | --- | --- | --- |
| -10.000000 | 46.000000 | 55.659295 | 50.393066 | ZONE-LEVEL CONTROL AUTHORITY CONFLICT |
| -5.000000 | 44.000000 | 48.653898 | 46.590584 | ZONE-LEVEL CONTROL AUTHORITY CONFLICT |

Near bounds conflict: B03 sets the high lower requirement while B01/B02/B04 set the low upper limit. The reported lower endpoint exceeding the upper endpoint explicitly means EMPTY, not a usable range. At −5°C the gap is 2.0633°C; at −10°C it is 5.2662°C.

These intervals are clipped to 40–60°C and assume current static allocated flow. No full pump/valve feasible-region search or new control authority is claimed.

## 12. Mid Feasible Supply Range

| Outdoor °C | Pump Hz | Lower supply °C | Upper supply °C | Fixed-flow result |
| --- | --- | --- | --- | --- |
| -10.000000 | 46.000000 | 46.582944 | 60.000000 | NONEMPTY |
| -5.000000 | 44.000000 | 41.203911 | 56.053562 | NONEMPTY |

This zone has a nonempty steady 18–25°C interval at both examined conditions. This does not guarantee 20–22°C comfort, nor that the fixed Traditional supply is inside the interval in every scenario.

These intervals are clipped to 40–60°C and assume current static allocated flow. No full pump/valve feasible-region search or new control authority is claimed.

## 13. Far Feasible Supply Range

| Outdoor °C | Pump Hz | Lower supply °C | Upper supply °C | Fixed-flow result |
| --- | --- | --- | --- | --- |
| -10.000000 | 46.000000 | 56.891800 | 60.000000 | NONEMPTY |
| -5.000000 | 44.000000 | 49.701400 | 56.495050 | NONEMPTY |

This zone has a nonempty steady 18–25°C interval at both examined conditions. This does not guarantee 20–22°C comfort, nor that the fixed Traditional supply is inside the interval in every scenario.

These intervals are clipped to 40–60°C and assume current static allocated flow. No full pump/valve feasible-region search or new control authority is claimed.

## 14. P1A Gate Regression

Accepted P1A equations/source files remain unchanged. All 84 accepted P1A pytest cases and all 32 physical Gates actually ran under the new parameter provider with original thresholds: H1–H5, D1–D3, R1–R4, T1–T6, C1–C5, I1, N1–N4, E1/E2, S1 and P0 adapter P1.

The wrapper rebinds parameter factories in process memory before collection, not assertions or physical functions. Fixture-independent component tests keep their explicit inputs; integration/default-parameter tests use v1.1. The legacy P2 suite additionally receives the candidate config/scenario input providers. There is no source modification to make tests pass. Historical/default Python regression runs separately.

| Actual command | Exit | Passed | Failed | Skipped |
| --- | --- | --- | --- | --- |
| /Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python -m pytest physical_core/tests/test_physical_fixture_v1_1.py -q | 0.000000 | 9.000000 | 0.000000 | 0.000000 |
| /Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python -m pytest physical_core/tests -q | 0.000000 | 127.000000 | 0.000000 | 0.000000 |
| /Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python physical_core/scripts/run_p2_1_regression.py gates-p1a | 0.000000 | 32.000000 | 0.000000 | 0.000000 |
| /Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python physical_core/scripts/run_p2_1_regression.py gates-p2 | 0.000000 | 20.000000 | 0.000000 | 0.000000 |
| /Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python /Users/yl/Documents/Codex/Heat/physical_core/scripts/run_p2_1_regression.py p2 | 0.000000 | 34.000000 | 0.000000 | 0.000000 |
| /Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python /Users/yl/Documents/Codex/Heat/physical_core/scripts/run_p2_1_regression.py p1a | 0.000000 | 84.000000 | 0.000000 | 0.000000 |
| npx tsc --noEmit | 0.000000 | N/A | 0.000000 | 0.000000 |
| npm run test | 0.000000 | 62.000000 | 0.000000 | 0.000000 |
| npm run build | 0.000000 | N/A | 0.000000 | 0.000000 |

Actual stdout/stderr, timing/build result, full gate index and unchanged thresholds are retained in `P2_1_GATE_RESULTS.md`, `p2_1_validation_commands.json`, `p2_1_p1a_gate_results.json`, and `p2_1_p2_gate_results.json`. Counts are not additive unique tests: 127 default cases include 84 P1A + 34 P2 + 9 new cases; the 84/34 were separately repeated under the v1.1 provider. All 20 P2 Gates and all P0 checks pass. Regression PASS is not fixture acceptance PASS.

## 15. Warm-up Recalculation

| Comparison | Max building Δ°C | Threshold | Decision |
| --- | --- | --- | --- |
| 72 vs 96 h | 0.372210 | <0.2°C | 72 h rejected |
| 96 vs 120 h | 0.162593 | <0.2°C | 96 h selected |

Same explicit prehistory weather and controller, new physical allocation. No v1.0 warm-up snapshot was reused. Recomputed delivered supply/flows and inventory/return comparisons are in `p2_1_candidate_review.json`; no convergence threshold was relaxed. Both versions end up using 96 hours, allowing a comparison at equal prehistory duration while respecting distinct warmed thermal states.

## 16. Normal Winter v1.0 vs v1.1

| Metric | v1.0 | v1.1 candidate |
| --- | --- | --- |
| Compliance | 98.4375% | 100.0000% |
| Comfort | 0.0000% | 0.0000% |
| Overheating | 67.1007% | 57.2917% |
| Severe overheating | 25.0000% | 25.0000% |
| Underheating | 1.5625% | 0.0000% |
| Min °C | 17.926831 | 18.485793 |
| Max °C | 29.065109 | 28.482801 |
| P10 °C | 18.410923 | 19.125622 |
| P50 °C | 23.161718 | 23.084079 |
| P90 °C | 28.680672 | 28.093055 |
| P90−P10 °C | 10.269749 | 8.967433 |

Allocation improves the cold end without creating a new underheated population, but the severe pattern persists. No arbitrary minimum comfort percentage was targeted. A 12.68% narrower spread and higher compliance do not resolve this task's structural-overheating issue. Every building's before/after exposures are in `P2_1_FIXTURE_COMPARISON.md` and both building diagnostics.

## 17. Cold Wave Comparison

Compliance 91.7824% → 96.4120%; comfort 0.0000% → 0.0000%; overheating 52.2280% → 44.8785%; severe exposure remains 25%; underheating 8.2176% → 3.5880%. Spread 10.1424 → 8.8951°C. Solver failures 0.

Colder forcing still raises targets with identical policy. Candidate underheating is lower, not eliminated. B03 and B09 remain the cold-wave risk buildings.

## 18. Rapid Warming Comparison

Compliance 99.5370% → 100.0000%; comfort 2.3148% → 10.1563%; overheating 79.1667% → 77.6620%; severe exposure remains 25%; underheating 0.4630% → 0.0000%. Spread 9.5853 → 8.3359°C. Solver failures 0.

Required-load/weather inputs are unchanged. Candidate comfort improves under this transient, but all three Near high-insulation buildings remain severely overheated. This held-out output did not influence weights.

## 19. Sunny Winter Comparison

Compliance 100.0000% → 100.0000%; comfort 0.0000% → 9.3171%; overheating 82.3785% → 80.6424%; severe exposure remains 25%; underheating 0.0000% → 0.0000%. Spread 9.8176 → 8.5513°C. Solver failures 0.

Solar enters accepted physical gains, not Traditional control or design sizing. Candidate comfort improves during some periods, but severe exposure remains unchanged.

## 20. Hydraulic Imbalance Comparison

Compliance 96.2674% → 100.0000%; comfort 0.0000% → 0.0000%; overheating 61.5451% → 54.9769%; severe exposure remains 25%; underheating 3.7326% → 0.0000%. Spread 10.4000 → 9.0278°C. Solver failures 0.

Same physical Far pipe-resistance ×2 disturbance at evaluation start; healthy-network warm-up is rerun with v1.1 allocation. Zone flows/controls are unchanged across fixture versions while building thermal allocation differs.

## 21. Energy Impact

| Scenario | Heat v1.0 MWh | Heat candidate MWh | Δ MWh | Pump kWh (both) |
| --- | --- | --- | --- | --- |
| normal_winter | 9.978827 | 9.977267 | -0.001561 | 26.001788 |
| cold_wave | 11.497637 | 11.489182 | -0.008454 | 29.890133 |
| rapid_warming | 8.633956 | 8.637176 | 0.003220 | 23.090458 |
| sunny_winter | 9.094554 | 9.095425 | 0.000871 | 24.618198 |
| hydraulic_imbalance | 9.909719 | 9.908010 | -0.001709 | 26.245431 |

Pump electricity is identical because the zone hydraulics and control trajectories are unchanged. Heat changes are small and have both signs across scenarios; they are not guaranteed savings or a tuning objective. Metrics retain evaluation-only integration, MWh/kWh units and the unchanged excess-delivered-heat diagnostic.

## 22. Comfort / Compliance Impact

Normal compliance improves from 98.4375% to 100%, with no underheated building-time sample. Comfort stays 0%. The severe-overheated buildings remain exactly B01/B02/B04; the problem is not hidden by a mean KPI. All five cases preserve or improve pooled compliance and reduce or preserve underheating. No artificial underheating was introduced to reduce overheat.

`P2_1_FIXTURE_COMPARISON.md` includes every requested aggregate metric for every scenario and B01–B12 Normal exposures. Rates use identical equally weighted building-time endpoint definitions; quantiles use identical lower-order statistics. Diagnostic benchmark values are outputs, never inputs to the new weight formula.

## 23. Remaining Structural Conflicts

Near's fixed-flow common-supply interval is empty at both examined winter conditions. Extra low-insulation flow cannot overcome the emitter UA ceiling, and the unchanged supply still overheats better-insulated peers. The design fixture therefore contains an unresolved emitter/load/common-supply sizing mismatch beyond area allocation.

`P2_1_UNRESOLVED_FIXTURE_ISSUES.md` proposes only externally reviewed follow-up options: coherent static emitter sizing or explicitly expanded building/riser/terminal authority with adequate emitter capacity. No R/C/UA/gain/window/pump/pipe correction was applied. No full-control-envelope optimization was attempted; do not claim that all conceivable future MPC operation is impossible.

## 24. Controller Fairness Confirmation

Traditional weather-compensation and pump curves, 30-minute interval, rate limits, fixed-valve commissioning algorithm and scenario weather/solar/disturbances are unchanged. The same area-based zone commissioning calculation is rerun and returns identical 50/60/85% valves. All original controller source remains hash-identical.

The only profile change is a static design-load flow weight. There was one candidate formula, no manual B03 multiplier, no search over KPI results and no stress-scenario fitting. Five candidate runs are retained solely to complete the requested comparison/stability evidence after the Normal shortfall was identified; this is not promotion to an accepted benchmark. No second parameter experiment was performed.

## 25. Freeze / Version Changes

New parameter export has `physical-fixture-v1.1` identity and a new physical hash. Candidate config in `p2_1_candidate_review.json` reserves `traditional-v1.1`; every new CSV/state/scenario artifact has a new path/version/hash identity under `p2_1_candidate_results/`. The original 99 captured historical files, existing freeze and final P2 report remain unchanged.

**Not created:** `p2_controller_config_v1.1.json` and `P2_BASELINE_FREEZE_MANIFEST_v1.1.json`. Their creation was conditional on external-readiness self-review, which failed. v1.0 is historical and still under external hold, but is NOT marked superseded by this unaccepted candidate. Its bytes and freeze are not rewritten.

`P2_1_CANDIDATE_EVIDENCE_MANIFEST.json` is an integrity/replay record only, explicitly `baselinePromotion=false`, not a new baseline freeze. It binds the parameter hash, candidate config hash, reports/code/output files and original historical hashes. The seal verifies exact exported CSV/summary replay from each new state and checks control trajectories match v1.0. Default production/test parameter provider remains v1.0; v1.1 is opt-in.

## 26. P3 Readiness

NOT READY. The corrected allocation is explainable and numerically valid, but the severe-overheat/control-authority issue motivating the hold is unresolved. P3 remains stopped. No P4/P5/P6, prediction, MPC, new control authority or UI integration was implemented.

## 27. Blocking Issues

The persistent three-building severe-overheating pattern is not reduced; Near still has no common fixed-flow supply meeting the examined 18–25°C bounds. These block this candidate's promotion as a resolved fixture patch. Passing technical Gates and explaining the remaining limitation do not justify quietly accepting a new AI comparison reference.

All mandatory diagnostics, regression and comparison evidence have been completed. The blocker is the need for external engineering direction on coherent emitter sizing/additional authority, not a failing numerical solver. No extra correction will be applied automatically.

## 28. Final Self-Assessment

Physical Fixture v1.1 candidate did not resolve the control-authority conflict.

The proposed static flow correction was implemented exactly and improves some measured outcomes, but the core severe-overheat pattern remains. Report **FAIL for corrective fixture acceptance / baseline promotion**, while separately reporting every passing technical regression. This is the requested failure-path outcome, not an attempt to hide failures or manipulate values until they look acceptable.

Stop here for external review. All v1.0 frozen evidence remains intact; no new baseline was approved and no later phase started.

Physical Fixture v1.1 Gate: FAIL

