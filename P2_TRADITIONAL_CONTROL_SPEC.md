# P2 Traditional Heating Control Specification

Version: traditional-v1.0. Synthetic PoC Controller Parameters, not regional standards or real-plant commissioning advice. Source priority: SPEC v1.2 → accepted P1A physics → frozen P0 contracts → P2 request. No physics/contract conflict required an accepted-file modification.

## 1. Scope

Deterministic engineering benchmark only: conventional outdoor reset, pump schedule, offline fixed-valve commissioning, physical warm-up, five evaluation scenarios, metrics and evidence. No React integration, APIs, AI, MPC, prediction, training data, occupant model or floor heating.

## 2. Traditional controller definition

`control/traditional.py::TraditionalHeatingController` holds immutable configuration; `ControllerState` is passed explicitly into each update. The runner passes current weather to accepted `SimulationEngine.step`, and commits the next controller state after a successful physical step. There is one controller implementation for all scenarios.

## 3. Allowed inputs

`update(timestamp_s, outdoor_c, state)`: current elapsed timestamp, current measured outdoor temperature, previous raw/applied targets and boundary state. Constructor receives fixed configuration. Current applied values are retained for slew limiting.

## 4. Forbidden inputs

No scenario identifier, weather trajectory, future timestamp sample, current/future indoor temperature, solar radiation, required load, predictor output or optimiser output enters the controller. Weather, solar and wind still enter physical equations through the runner. No constant-pressure controller or hidden solar correction exists.

## 5. Weather-compensation curve

| Outdoor °C | ≤−15 | −10 | −5 | 0 | 5 | ≥10 |
|---|---:|---:|---:|---:|---:|---:|
| Raw supply °C | 58 | 55 | 51 | 47 | 43 | 40 |

Original recommended breakpoints are unchanged. Absolute applied limit remains 40–60°C, not a new 40–58°C equipment limit.

## 6. Interpolation

Between ordered knots `(x0,y0),(x1,y1)`, `y=y0+(y1−y0)*(outdoor−x0)/(x1−x0)`. Clamp to endpoint targets outside the knot range. Validate finite values, increasing outdoor coordinates, non-increasing outputs and equipment bounds. No extrapolation or smoothing lag.

## 7. Supply slew rate

On a 30-minute boundary: `applied = previous + clamp(raw−previous, −2, +2)` °C. Record raw and applied separately. Between boundaries hold both the last computed raw target and applied control. Initial control is seeded from current outdoor temperature before warm-up, not reset at evaluation start.

## 8. Pump-frequency curve

| Outdoor °C | ≤−15 | −10 | −5 | 0 | 5 | ≥10 |
|---|---:|---:|---:|---:|---:|---:|
| Raw pump Hz | 48 | 46 | 44 | 42 | 38 | 34 |

Original recommended values unchanged; same interpolation rule. Equipment bounds remain 30–50 Hz. Accepted P1A pump curve determines actual pressure, flow and power.

## 9. Pump slew rate

`appliedHz = previousHz + clamp(rawHz−previousHz, −2, +2)` per accepted boundary. No indoor feedback, load optimiser or constant-ΔP loop.

## 10. Offline valve commissioning

At 45 Hz, compute area-proportional zone shares from static building metadata. Under accepted quadratic resistance, equal branch pressure requires `K_i * share_i²` to be equal. Anchor the limiting Far valve at 85%, solve other openings algebraically with accepted valve law, then round to practical 5-percentage-point increments. Validate with the accepted coupled hydraulic solver. No thermal scenario results enter this calculation.

## 11. Fixed valves

Near 50%, Mid 60%, Far 85%. These are fractions 0.50/0.60/0.85 internally and percentages in config/CSV. They are set before warm-up; every subsequent runtime valve change is exactly zero. See `p2_commissioning_report.md` for before/after evidence.

## 12. Controller interval

1800 seconds. State retains last/next boundary. Calls before the next boundary hold controls; calls at it recalculate. Backward time or skipped boundary is rejected. There is no scenario-specific delay; FIFO transit and thermal inertia remain physical effects.

## 13. Physical timestep and sample semantics

Default 300 seconds; 600/900 seconds also tested. Current left-end weather is held over each physical interval; the controller samples it only at control boundaries. P1A's integration, interval-mean heat/pump power and endpoint indoor states are unchanged. CSV timestamps label interval ends: 08:05 on January 15 through 08:00 January 16, 2025 (+08:00). Each first row covers 08:00–08:05; no interval is omitted. Plotted hours likewise label interval ends, not an additional controller delay.

## 14. Warm-up

Same controller and plant run over explicit repeated daily weather before evaluation. Initial prehistory temperature is 20°C, used only before warm-up. Comparison 72/96 h differed by 0.381411°C, failing the unchanged 0.2°C threshold. Adopt 96 h for all official scenarios; 96/120 h differs by 0.163100°C. Current elapsed coordinate starts negative and advances only through P1A steps to zero; controller boundary continuity, buffers and cumulative energy are preserved. Evaluation energy is integrated only from the following 24 hours, never lifetime totals.

## 15. Serializable state

`benchmark/state.py` exports schema/version, parameter/config hashes, physical elapsed time/timestep, applied controls, twelve indoor temperatures, previous hydraulic flows, cumulative heat and pump energy, and all three transport inventories (equivalent volume, ordered volume/temperature packets, last delivered supply and current flow). Controller state includes version, raw/applied supply and pump, fixed valves, last/next boundary.

The evaluation starts at elapsed zero with the boundary at zero pending, preserving the preceding −1800 boundary rather than prematurely updating controls. Restore checks hashes, dimensions, equipment state and FIFO volume; next step performs the zero boundary update. Static parameters must be supplied from the hash-bound scenario. Quasi-steady pressure and return temperature are recalculated, not independent persistent state. All five restored first frames and full runs match the original serialized outputs exactly in the locked runtime.

## 16. Five scenarios

| ID | Evaluation forcing | Warm-up | Network change |
|---|---|---|---|
| normal_winter | −8→−2→−8°C; solar max 180 W/m² | Repeated normal day | None |
| cold_wave | −5→−14→−12°C; solar max 130 W/m² | Mild pre-cold day | None |
| rapid_warming | −8→5→−8°C; solar max 480 W/m² | Repeated normal day | None |
| sunny_winter | −6→0→−6°C; solar max 500 W/m² | Moderate pre-sunny day | None |
| hydraulic_imbalance | Same evaluation weather as normal | Healthy normal network | Far pipe resistance ×2 at elapsed zero |

All versions 1.0; start 2025-01-15T08:00:00+08:00; 24 h evaluation, 96 h warm-up, 5 min default steps. Exact outdoor/solar/wind knots, prehistory and parameter override are in `p2_baseline_scenarios.json`. No randomness or manual temperature/flow injection. Imbalance snapshot retains healthy dynamic state but is bound to disturbed evaluation parameters, making the disturbance reproducible in both future forks.

## 17. Metrics and units

For each equally weighted building-time sample: compliance `T≥18`; comfort `20≤T≤22`; overheating `T>23`; severe overheating `T>25`; underheating `T<18`. Boundaries are deliberate; 22–23°C is neither comfort nor overheating. Summaries pool all 12×288=3456 endpoint samples; CSV rates use 12 samples per frame. Each summary rate equals the time-average frame rate for constant timestep. No area weighting.

Percentile uses sorted samples at zero-based `floor((n−1)*p)`, retaining the frozen P0 lower-order-statistic convention. P50 is therefore the lower median, not an interpolated median. Summary P10/P50/P90 are pooled building-time quantiles, not averages of per-frame quantiles; spread = P90−P10. Min/max cover every building and evaluation frame.

`heatEnergyMWh = Σ(actualHeatW*dtS)/3.6e9`; `pumpElectricityKWh = Σ(pumpPowerW*dtS)/3.6e6`. Power labels use kW, heat-rate labels MW, flow m³/h, pressure kPa, transport delay minutes. Required heat is the accepted P1A instantaneous reference-load calculation, not a prediction. `excessDeliveredHeatMWh = Σ(max(0,actualHeatW−requiredHeatW)*dtS)/3.6e9`, labelled **Excess Delivered Heat Above Instantaneous Required Load**, never AI savings or guaranteed waste.

`HBI = 1−0.5*Σ_zone|actualFlowShare−staticTargetShare|`, time-averaged over evaluation. It is a 0–1 synthetic distribution diagnostic, not an industry standard or proof of indoor comfort. Under common quadratic branch resistance, healthy shares remain nearly constant as frequency changes; high HBI cannot resolve unequal within-zone thermal needs.

## 18. Fairness boundaries

Normal/Cold Wave adequacy was evaluated before stress cases. No breakpoint was adjusted, no energy-minimising objective was introduced, and no P0 visual KPI was targeted. Initial ≥95% Normal compliance criterion was written before the evaluation; it does not imply high comfort. Fixed commissioning reduces area-share mismatch without fitting thermal outcomes. Engineering self-review remains subject to external acceptance.

## 19. Known limitations

Synthetic weather, R/C coefficients and conventional curves are uncalibrated. Normal compliance 98.4375% coexists with comfort 0%, overheating 67.1007% and severe overheating 25%. The accepted heterogeneous near-zone buildings have conflicting supply needs under fixed within-zone allocation; no accepted physical coefficient was changed to hide the result. No indoor/solar/occupancy feedback, individual building valves, return FIFO refinement, floor heating or real-plant integration. Five deterministic cases do not establish general performance or future AI savings.

## 20. Future P6 comparison contract

Load `P2_BASELINE_FREEZE_MANIFEST.json`, verify byte and canonical hashes, load the matching scenario parameters and `p2_initial_states/<id>.json`, and fork that exact physical state into both controllers. Keep weather samples, parameter override, timestep, limits, horizon and metric definitions identical. Preserve controller state for Traditional; initialise a future controller from the same applied equipment state so it cannot gain an immediate slew-limit exemption. Subtract the same warm-up energy origin. Never give a comparator a separately equilibrated indoor/FIFO state. Any approved change to the baseline requires a new explicit P2 version; do not silently rewrite v1.0. P3/P6 are not implemented here.
