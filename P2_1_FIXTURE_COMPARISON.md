# P2.1 Fixture Comparison — v1.0 vs v1.1 Candidate

**Decision: not promoted. Physical Fixture v1.1 candidate did not resolve the control-authority conflict.** Five v1.1 runs are comparison-only diagnostics, not a new accepted baseline or AI savings demonstration.

## Controlled change ledger

| Item | Status |
| --- | --- |
| Physical equations / topology / water / limits / dt | UNCHANGED |
| R, C, UA, solar aperture, internal gains, window conductance | UNCHANGED |
| Pump parameters / pipe resistance / FIFO volumes | UNCHANGED (same declared Far ×2 stress disturbance) |
| Weather compensation / pump policy / slew / interval | UNCHANGED |
| Scenario weather / solar / wind / prehistory definitions | UNCHANGED |
| Within-zone building flow method | AREA → DESIGN MAINTENANCE LOAD |
| Zone commissioning | SAME static area-share algorithm, recomputed; still 50/60/85% |
| Warm-up | RECOMPUTED; 72/96 failed, 96/120 passed; official candidate 96 h |
| Initial physical states | NEW v1.1 states, no v1.0 snapshot reused |
| Metrics | UNCHANGED lower-order quantiles and building-time exposures |
| Version IDs | physical-fixture-v1.1 / traditional-v1.1 CANDIDATE ONLY |

Each scenario has identical evaluation weather, controls and time sampling across versions. Because the fixture changes thermal response, prehistory forcing is identical but warmed indoor states are recomputed, as requested. No claim that those different-fixture initial indoor states are identical. This is not the same-state future Traditional-vs-MPC experiment.

## normal_winter

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Compliance | 98.4375% | 100.0000% | 1.5625 pp |
| Comfort | 0.0000% | 0.0000% | 0.0000 pp |
| Overheating | 67.1007% | 57.2917% | -9.8090 pp |
| Severe >25°C | 25.0000% | 25.0000% | 0.0000 pp |
| Underheating | 1.5625% | 0.0000% | -1.5625 pp |

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Min indoor °C | 17.926831 | 18.485793 | 0.558961 |
| Max indoor °C | 29.065109 | 28.482801 | -0.582308 |
| P10 °C | 18.410923 | 19.125622 | 0.714699 |
| P50 °C | 23.161718 | 23.084079 | -0.077640 |
| P90 °C | 28.680672 | 28.093055 | -0.587617 |
| P90−P10 °C | 10.269749 | 8.967433 | -1.302316 |
| Heat MWh | 9.978827 | 9.977267 | -0.001561 |
| Pump kWh | 26.001788 | 26.001788 | 0.000000 |
| Excess delivered heat MWh | 0.872549 | 0.870988 | -0.001561 |
| HBI | 0.996223 | 0.996223 | 0.000000 |
| Solver failures | 0.000000 | 0.000000 | 0.000000 |

## cold_wave

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Compliance | 91.7824% | 96.4120% | 4.6296 pp |
| Comfort | 0.0000% | 0.0000% | 0.0000 pp |
| Overheating | 52.2280% | 44.8785% | -7.3495 pp |
| Severe >25°C | 25.0000% | 25.0000% | 0.0000 pp |
| Underheating | 8.2176% | 3.5880% | -4.6296 pp |

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Min indoor °C | 16.710537 | 17.304569 | 0.594032 |
| Max indoor °C | 28.776916 | 28.195713 | -0.581204 |
| P10 °C | 18.338961 | 18.985829 | 0.646868 |
| P50 °C | 23.029879 | 22.912775 | -0.117104 |
| P90 °C | 28.481316 | 27.880976 | -0.600339 |
| P90−P10 °C | 10.142355 | 8.895148 | -1.247207 |
| Heat MWh | 11.497637 | 11.489182 | -0.008454 |
| Pump kWh | 29.890133 | 29.890133 | 0.000000 |
| Excess delivered heat MWh | 0.434796 | 0.431504 | -0.003292 |
| HBI | 0.996223 | 0.996223 | 0.000000 |
| Solver failures | 0.000000 | 0.000000 | 0.000000 |

## rapid_warming

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Compliance | 99.5370% | 100.0000% | 0.4630 pp |
| Comfort | 2.3148% | 10.1563% | 7.8414 pp |
| Overheating | 79.1667% | 77.6620% | -1.5046 pp |
| Severe >25°C | 25.0000% | 25.0000% | 0.0000 pp |
| Underheating | 0.4630% | 0.0000% | -0.4630 pp |

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Min indoor °C | 17.933243 | 18.491690 | 0.558447 |
| Max indoor °C | 30.115058 | 29.559336 | -0.555722 |
| P10 °C | 19.657759 | 20.358761 | 0.701003 |
| P50 °C | 24.023451 | 23.936606 | -0.086844 |
| P90 °C | 29.243028 | 28.694657 | -0.548371 |
| P90−P10 °C | 9.585269 | 8.335896 | -1.249374 |
| Heat MWh | 8.633956 | 8.637176 | 0.003220 |
| Pump kWh | 23.090458 | 23.090458 | 0.000000 |
| Excess delivered heat MWh | 1.626106 | 1.629562 | 0.003456 |
| HBI | 0.996223 | 0.996223 | 0.000000 |
| Solver failures | 0.000000 | 0.000000 | 0.000000 |

## sunny_winter

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Compliance | 100.0000% | 100.0000% | 0.0000 pp |
| Comfort | 0.0000% | 9.3171% | 9.3171 pp |
| Overheating | 82.3785% | 80.6424% | -1.7361 pp |
| Severe >25°C | 25.0000% | 25.0000% | 0.0000 pp |
| Underheating | 0.0000% | 0.0000% | 0.0000 pp |

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Min indoor °C | 18.286615 | 18.828966 | 0.542351 |
| Max indoor °C | 30.194791 | 29.639786 | -0.555005 |
| P10 °C | 19.516850 | 20.227559 | 0.710710 |
| P50 °C | 24.028058 | 23.950193 | -0.077866 |
| P90 °C | 29.334410 | 28.778885 | -0.555525 |
| P90−P10 °C | 9.817561 | 8.551326 | -1.266235 |
| Heat MWh | 9.094554 | 9.095425 | 0.000871 |
| Pump kWh | 24.618198 | 24.618198 | 0.000000 |
| Excess delivered heat MWh | 1.572028 | 1.572899 | 0.000871 |
| HBI | 0.996223 | 0.996223 | 0.000000 |
| Solver failures | 0.000000 | 0.000000 | 0.000000 |

## hydraulic_imbalance

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Compliance | 96.2674% | 100.0000% | 3.7326 pp |
| Comfort | 0.0000% | 0.0000% | 0.0000 pp |
| Overheating | 61.5451% | 54.9769% | -6.5683 pp |
| Severe >25°C | 25.0000% | 25.0000% | 0.0000 pp |
| Underheating | 3.7326% | 0.0000% | -3.7326 pp |

| Metric | v1.0 | v1.1 candidate | Change |
| --- | --- | --- | --- |
| Min indoor °C | 17.582127 | 18.213454 | 0.631327 |
| Max indoor °C | 29.088680 | 28.511810 | -0.576871 |
| P10 °C | 18.321221 | 19.113101 | 0.791880 |
| P50 °C | 23.119036 | 23.057740 | -0.061296 |
| P90 °C | 28.721263 | 28.140931 | -0.580333 |
| P90−P10 °C | 10.400042 | 9.027829 | -1.372213 |
| Heat MWh | 9.909719 | 9.908010 | -0.001709 |
| Pump kWh | 26.245431 | 26.245431 | 0.000000 |
| Excess delivered heat MWh | 0.803441 | 0.801732 | -0.001709 |
| HBI | 0.952134 | 0.952134 | 0.000000 |
| Solver failures | 0.000000 | 0.000000 | 0.000000 |

## Normal Winter — every building exposure

Fractions below use 288 endpoint samples per building; not area weighted. Total severe exposure remains (3×288)/(12×288)=25%.

| Building | Mean Ti v1.0→v1.1 °C | Min Ti v1.0→v1.1 °C | Max Ti v1.0→v1.1 °C | Comfort old→new | Overheat old→new | Severe old→new | Underheat old→new |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | 28.6318 → 28.0420 | 28.4094 → 27.8132 | 28.8216 → 28.2343 | 0.0000 → 0.0000 | 1.0000 → 1.0000 | 1.0000 → 1.0000 | 0.0000 → 0.0000 |
| B02 | 28.8284 → 28.2436 | 28.5502 → 27.9596 | 29.0651 → 28.4828 | 0.0000 → 0.0000 | 1.0000 → 1.0000 | 1.0000 → 1.0000 | 0.0000 → 0.0000 |
| B03 | 18.3614 → 19.3207 | 18.0449 → 19.0110 | 18.6630 → 19.6170 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B04 | 28.4527 → 27.8602 | 28.2373 → 27.6405 | 28.5859 → 27.9958 | 0.0000 → 0.0000 | 1.0000 → 1.0000 | 1.0000 → 1.0000 | 0.0000 → 0.0000 |
| B05 | 23.0878 → 23.0878 | 22.8357 → 22.8357 | 23.3363 → 23.3363 | 0.0000 → 0.0000 | 0.6285 → 0.6285 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B06 | 23.2718 → 23.2718 | 22.9773 → 22.9773 | 23.5663 → 23.5663 | 0.0000 → 0.0000 | 0.9340 → 0.9340 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B07 | 23.1528 → 23.1528 | 22.8983 → 22.8983 | 23.3976 → 23.3976 | 0.0000 → 0.0000 | 0.7431 → 0.7431 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B08 | 22.9957 → 22.9957 | 22.7869 → 22.7869 | 23.1848 → 23.1848 | 0.0000 → 0.0000 | 0.4931 → 0.4931 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B09 | 18.2637 → 18.8182 | 17.9268 → 18.4858 | 18.5830 → 19.1344 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.0000 → 0.0000 | 0.1875 → 0.0000 |
| B10 | 23.2882 → 23.0857 | 22.9908 → 22.7870 | 23.5862 → 23.3845 | 0.0000 → 0.0000 | 0.9549 → 0.6007 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B11 | 23.1693 → 22.9662 | 22.9119 → 22.7078 | 23.4173 → 23.2151 | 0.0000 → 0.0000 | 0.7743 → 0.4444 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |
| B12 | 23.0122 → 22.8084 | 22.8007 → 22.5962 | 23.2044 → 23.0015 | 0.0000 → 0.0000 | 0.5243 → 0.0313 | 0.0000 → 0.0000 | 0.0000 → 0.0000 |

## Interpretation / failure boundary

Normal compliance improves 98.4375→100%; underheating disappears. Spread falls 1.302316°C (about 12.68%) and >23°C exposure falls 9.8090 percentage points. These are genuine physical improvements without new underheating. However, Normal comfort stays zero and all three originally severe buildings remain severe for the entire day. No minimum material-improvement threshold was invented after the result; this fails to resolve the specific persistent severe-overheat problem motivating the external hold.

All five scenarios remain stable and all five still have 25% severe exposure. Mid profiles' normalized weights are mathematically unchanged because their design loss/gain per area is uniform; their indoor trajectories remain unchanged. Pump kWh and hydraulic HBI remain identical because zone-level hydraulic parameters, controls and commissioning did not change. The small heat changes can have either sign, showing this was not an energy-minimising calibration.

The remaining Near fixed-flow common-supply interval is empty. NTU saturation and accepted area-only UA sizing limit the effect of extra low-insulation flow. See `P2_1_CONTROL_AUTHORITY_ANALYSIS.md` and `P2_1_UNRESOLVED_FIXTURE_ISSUES.md`. No secondary fixture change, control retuning or stress-case tuning was applied. No v1.1 baseline freeze is issued; v1.0 remains intact and is not marked superseded.

