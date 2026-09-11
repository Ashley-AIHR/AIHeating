# P4 Preview Benchmark Report

Preview configuration was validated on one deterministic `validation_select` episode from each family, then frozen before these canonical runs. Each comparison uses the same initial serialized P1A state, actual evaluation weather and 24-hour window. Preview decisions see issued forecasts only. All five runs made 32 decisions, used zero fallbacks, retained legal controls and predicted-safe candidates.

| Scenario | Heat MWh T→P | Pump kWh T→P | Compliance T→P | >23°C T→P | <18°C T→P | Excess heat MWh T→P |
| --- | --- | --- | --- | --- | --- | --- |
| Normal Winter | 9.625→9.275 | 26.359→26.359 | 100%→100% | 0%→0% | 0%→0% | 0.572→0.389 |
| Cold Wave | 11.014→10.661 | 30.300→30.300 | 100%→100% | 0%→0% | 0%→0% | 0.262→0.131 |
| Rapid Warming | 8.373→7.995 | 23.407→21.573 | 100%→100% | 61.92%→37.82% | 0%→0% | 1.480→1.251 |
| Sunny Winter | 8.793→8.409 | 24.956→22.878 | 100%→100% | 62.73%→38.19% | 0%→0% | 1.354→1.141 |
| Hydraulic Imbalance | 9.558→9.210 | 26.439→26.439 | 100%→100% | 0%→0% | 0%→0% | 0.534→0.357 |

Rapid Warming passes the directional Gate: no new underheating, unchanged compliance/severe overheating, legal controls, lower oversupply and >23°C exposure, and no heat increase. Sunny Winter provides the complementary predictive case with lower heat, pumping, overheating and excess heat. Cold Wave remains safe: its lower heat does not create underheating and comfort improves from 42.88% to 57.81%. Normal Winter is stable with no fallback or unsafe projection. Hydraulic Imbalance remains a secondary engineering benchmark; its frozen disturbance was not intensified.

Full metrics, percentiles, zone means, decisions and control histories are in `p4_preview_benchmarks.json`.

