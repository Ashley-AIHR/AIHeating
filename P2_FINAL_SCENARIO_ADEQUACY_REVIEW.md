# P2 Final Scenario Adequacy Review

## Decision

**A — CURRENT SCENARIO ADEQUATE.** Retain the existing 2× Far pipe-resistance disturbance unchanged as a secondary engineering benchmark for Near/Mid/Far flow redistribution, hydraulic coupling and valve-control behaviour. Rapid Daytime Warming is the primary AI/MPC benchmark; Sunny Winter is a primary or complementary predictive-control benchmark.

The choice is based on transparent hydraulic and thermal observability, not a future AI advantage. No indoor temperature, flow, fixture parameter, controller curve, valve, limit, or KPI was tuned.

## Exact current-reference reproduction

The existing v1.2 benchmark reproduces exactly: summary `True`, CSV `True`, initial state `True`. Every sweep case uses an identical healthy pre-disturbance physical/controller state; only `far.pipe_k_pa_s2_m6` changes at evaluation start.

Healthy pre-disturbance flows: Near 10.747246, Mid 13.519959, Far 14.999152 m³/h. At 2×, first-frame Far flow is 12.524471 m³/h, a 16.499% reduction. Near and Mid change by +3.834% and +3.834%.

## Deterministic disturbance-response sweep

| Far resistance | Far flow reduction | Near flow change | Mid flow change | Near mean ΔT | Mid mean ΔT | Far mean ΔT | Compliance | Overheating | Underheating | Spread °C | Solver failures |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1.0× | -0.000% | +0.000% | +0.000% | +0.000°C | +0.000°C | +0.000°C | 100.000% | 0.000% | 0.000% | 0.622 | 0 |
| 1.5× | 9.415% | +2.211% | +2.211% | +0.017°C | +0.018°C | -0.095°C | 100.000% | 0.000% | 0.000% | 0.662 | 0 |
| 2.0× | 16.499% | +3.834% | +3.834% | +0.029°C | +0.032°C | -0.179°C | 100.000% | 0.000% | 0.000% | 0.707 | 0 |
| 2.5× | 22.089% | +5.092% | +5.092% | +0.038°C | +0.041°C | -0.254°C | 100.000% | 0.000% | 0.000% | 0.784 | 0 |
| 3.0× | 26.653% | +6.103% | +6.103% | +0.045°C | +0.049°C | -0.323°C | 100.000% | 0.000% | 0.000% | 0.857 | 0 |

The 3× case reaches the preferred 25–35% Far-flow stress range, but increasing severity is unnecessary: the current 2× case already produces a 16.499% Far-flow loss, positive Near/Mid redistribution, and a 0.179°C Far-zone mean depression, all well above numerical residuals. Retaining it avoids manufacturing a harsher scenario after observing performance.

## Current 2× B01–B12 temperatures

| Building | Zone | Minimum °C | Mean °C | Maximum °C | Final °C |
| --- | --- | ---: | ---: | ---: | ---: |
| B01 | near | 22.046073 | 22.367996 | 22.588823 | 22.214156 |
| B02 | near | 22.237920 | 22.612341 | 22.877345 | 22.429244 |
| B03 | near | 21.698832 | 22.016505 | 22.282858 | 21.788551 |
| B04 | near | 21.904206 | 22.185320 | 22.349397 | 22.092894 |
| B05 | mid | 21.961194 | 22.271509 | 22.519620 | 22.066306 |
| B06 | mid | 22.098972 | 22.452800 | 22.745695 | 22.213738 |
| B07 | mid | 22.013373 | 22.326367 | 22.569647 | 22.131985 |
| B08 | mid | 21.896213 | 22.162047 | 22.350119 | 22.017133 |
| B09 | far | 21.391849 | 21.806864 | 22.123779 | 21.391849 |
| B10 | far | 21.831506 | 22.224598 | 22.553120 | 21.831506 |
| B11 | far | 21.758703 | 22.104467 | 22.382132 | 21.758703 |
| B12 | far | 21.651904 | 21.945757 | 22.166754 | 21.651904 |

## Current 2× aggregate result

Zone mean indoor changes relative to healthy: Near +0.028712°C, Mid +0.031577°C, Far -0.178543°C.

Compliance 100.000000%; overheating 0.000000%; underheating 0.000000%; minimum/maximum 21.391849/22.877345°C; P90−P10 spread 0.706715°C. These KPIs describe the response and did not define selection.

## Regression and freeze

Affected scenario test: 1 passed, exit 0. Sizing Gates 7/7; P1A Gates 32/32 and 84 tests; P2 Gates 20/20 and 34 tests; P0 typecheck/test/build all exit 0 with 62 tests. Historical accepted-file changes: `[]`.

The approved baseline freezes physical-fixture-v1.2, Traditional controller v1.2, the unchanged five scenarios including the 2× Hydraulic Imbalance definition, 35/55/85% commissioned valves, 72-hour daily-repeat warm-up, existing metric definitions, deterministic initial-state generation, and content hashes. Any later change requires a new version.

P3 is ready to proceed in a subsequent task; it was not started here.

P3 Readiness: GO
P2 v1.2 Baseline Freeze: PASS
