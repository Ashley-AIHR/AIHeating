# P7 Cross-Page Consistency Report

All active pages read the same module-level `guidedRuntime` snapshot. No page-local engineering fixture overrides it.

| Field | Overview | Forecast | Simulation | Results | Settings |
|---|---:|---:|---:|---:|---:|
| Rapid Warming scenario / 10:30 snapshot | ✓ | ✓ | ✓ | ✓ | Header ✓ |
| P1A physical-fixture-v1.2 | NOW | Context | Current state | Evidence authority | Version |
| P4 Predictor v1 / LightGBM | PREDICT | Primary load layer | Input lineage | Model evidence | Version/horizons |
| P5 Thermal Model v1 | PREDICT | Separate thermal layer | Temperature trajectory | Evidence lineage | Version/horizons |
| Formal MPC v1 | OPTIMISE | — | Action/trajectory/status | Primary final comparison | Version/horizon |
| Traditional current controls | — | — | Current/comparison controls | Traditional column | Version |
| P6 recommended first action | Summary | — | Current recommendation | Accepted result lineage | Read-only policy |
| Optimisation/verification/fallback/safety | VERIFY | — | Five separate status rows | Summary | Policy |
| Application state | Mode semantics | — | Separate product state | — | Mode policy |

Time meanings remain separate: simulation, forecast issue, forecast target, recommendation creation, recommendation effective time, and result evaluation window. EN and ZH dictionaries have exact key parity and browser checks cover the same five pages and mode transitions.
