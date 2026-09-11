# Phase 1A Physical Model Specification

## 1. Scope and source authority

One heating substation, three parallel hydraulic zones, four radiator buildings per zone. Deterministic secondary-network physics only. SPEC v1.2 §§7.2, 8, 15.1 takes priority over frozen P0 contracts and the P1A prompt. The external SPEC remains at its supplied location; this implementation does not rewrite it. All numerical plant parameters are **Synthetic PoC Parameters**. Nothing is customer-calibrated or a claimed regional operating standard.

React and its fixtures remain unchanged. The only frontend-facing work is a serialization/contract proof. No Traditional controller, constant-ΔP loop, ML, MPC, floor heating, service API or Tutor is implemented.

## 2. Topology

One frequency-controlled centrifugal pump supplies common supply/return header resistance and three parallel branches: Near B01–B04, Mid B05–B08, Far B09–B12. Each branch consists of pipe resistance plus one zone valve. Within-zone building flow is allocated by fixed normalized weights, not an independent 12-branch network.

## 3. Explicit assumptions

Water is incompressible with constant rho/cp. Hydraulics equilibrate within each physical step; no pressure transients, elevation head around the closed loop, reverse flow, cavitation or temperature-dependent viscosity. Supply transport is adiabatic plug flow; no axial mixing. Return temperatures are mixed instantaneously without return-pipe storage. Radiators have no independent thermal capacitance; building mass is a single effective thermal node. Wind is preserved as weather context but does not change coefficients. No stochastic occupancy/window behavior.

Initial indoor temperature is 20°C for every building. Initial supply-pipe water is uniformly 50°C. This is a specified initial condition, not a claim of preceding steady state. Determinism applies to identical parameters/runtime, not bitwise identity across every CPU/SciPy release.

## 4. Internal units

| Quantity | Physics | Reporting |
| --- | --- | --- |
| Time | s | min, hours, timestamp |
| Volume / volumetric flow | m³ / m³/s | m³/h |
| Mass flow | kg/s | kg/s |
| Pressure / head | Pa / m water | kPa |
| Heat rate / energy | W / J | kW, MW / kWh, MWh |
| Temperature | °C, differences K-equivalent | °C |
| R / C / UA | K/W / J/K / W/K | unchanged |
| Valve / window opening | fraction 0–1 | percent |

All dimensional conversions are in `units.py`. No m³/h value enters hydraulic equations. Pump curve coefficient a has dimensions s²/m⁵; pressure resistance K has Pa s²/m⁶. Supply and indoor differences use °C differences identically to K differences.

## 5. Constants

`PhysicalConstants` validates rho=998 kg/m³, cp=4180 J/(kg K), g=9.80665 m/s². Parameters may supply another positive finite constant set. All engine modules receive that same set; no repeated water constants.

## 6. Central synthetic parameter fixture

`parameters.py::synthetic_parameters` is the sole physical fixture; exported completely to `p1a_parameters.json`. Static building identities, area/year/insulation/zone retain P0 metadata, but initial indoor temperature, physical coefficients and hydraulic operating point are independent of its display values. Twelve buildings total 12,910 m²; all terminals are `radiator`, with a synthetic six-floor metadata assumption.

| Parameter | Synthetic rule/value | Engineering interpretation |
| --- | --- | --- |
| Envelope H/area | Low 1.8; Medium 1.3; High 0.9 W/(m² K) | Differentiated effective whole-building loss |
| R | 1 / (H/area × area) | 0.000566893–0.001133787 K/W |
| C/area | 180,000–210,000 J/(m² K), cyclic by building index | Effective structure/furnishings + air, not air-only capacity |
| C | 162–260 MJ/K | Envelope-only RC time constants 27.78–64.81 hours |
| Radiator UA/area | 1.4 W/(m² K) | Aggregate radiators; UA=1,260–1,820 W/K per building |
| Effective solar area | 0.04 × heated area | Aggregated transmission/aperture factor, not a glazing measurement |
| Orientation factor | 0.75, 1.0, 0.85, 0.65 repeated | Deterministic exposure differences |
| Internal gain | 3 W/m² × area | Constant synthetic occupancy/appliance heat |
| Window conductance | 2 W/(m² K) × area at full opening | Additional ventilation heat loss, multiplied by input fraction |
| Flow share weight | Heated area | Deterministic allocation, not measured valve balancing |
| Target temperature | 21°C | PoC comfort target midpoint |

At a 26 K indoor/outdoor difference envelope design loss is 23.4–46.8 W/m² before gains. This supports the order of magnitude of this synthetic fixture, without claiming measured realism. High insulation can overheat under the predefined supply schedule; temperatures are not clipped to the comfort band or tuned to P0.

## 7. Pump curve

`s=f/f_ref`; `H_p=H0 s²−a Q_total²`; `ΔP_p=rho g H_p`.

Synthetic H0=16 m at 50 Hz; a=40,000 s²/m⁵; f_ref=50 Hz. At any fixed frequency, head decreases with flow. At a fixed flow, frequency increases head. Negative-head operating solutions are rejected. Active equipment frequency bounds are 30–50 Hz. No constant-ΔP controller exists.

## 8. Common network loss

`ΔP_common=K_common Q_total |Q_total|`, with K_common=1.5×10⁸ Pa s²/m⁶. `ΔP_available=ΔP_p−ΔP_common`. All branches see this same available pressure. No zone-specific pressure factor is injected after solving.

## 9. Valve law and branch resistances

`K_valve(u)=K_ref / max(u,0.2)²`, with valid u in [0.2,1]. Increasing opening decreases resistance monotonically. Invalid opening is rejected before evaluating the law.

| Zone | K_pipe (Pa s²/m⁶) | K_ref (Pa s²/m⁶) | K_total at u=0.6 |
| --- | --- | --- | --- |
| Near | 0.6×10⁹ | 0.8×10⁹ | 2.822222222×10⁹ |
| Mid | 1.2×10⁹ | 1.0×10⁹ | 3.977777778×10⁹ |
| Far | 2.0×10⁹ | 1.2×10⁹ | 5.333333333×10⁹ |

These are explicit synthetic branch resistance choices, with appreciable valve authority and common-path/pump impedance. They are not fitted to an expected Gate flow or dashboard target.

## 10. Nonlinear hydraulic equations

Unknown q=(Q_near,Q_mid,Q_far)≥0. `Q_total=Σq_i`.

`F_i(q)=rho g H0(f/f_ref)²−(rho g a+K_common)(Σq)²−(K_pipe,i+K_valve,i)q_i²=0`.

Three simultaneous equations establish both the pump operating point and branch flows. There are no separate independent branch solves or post-solve coupling corrections.

## 11. Numerical hydraulic solver

SciPy bounded `least_squares`, trust-region reflective method, linear loss, nonnegative bounds, analytic Jacobian. Every equation is divided by current-frequency shutoff pressure. Reported residual is max absolute normalized equation residual. `ftol=xtol=gtol=1e-12`, max_nfev=100. Internal convergence requires optimizer success and normalized residual <1e-8 (stricter than Gate <1e-5). First guess/variable scale is a characteristic flow calculated from shutoff pressure and aggregate resistance; subsequent steps warm-start from prior valid flows.

Jacobian entry: `∂F_i/∂q_j=−2(rho g a+K_common)Σq−2K_i q_i δ_ij`, with the same pressure normalization. Failure raises `HydraulicFailure` with status/residual/function evaluations/message. `iterations` maps to SciPy nfev, explicitly function evaluations rather than a claimed iteration count. If SciPy raises before an evaluable result, residual is null; no made-up number or valid-frame fallback. The integrated engine commits no state on failure.

Solver behavior was checked against the [official SciPy least_squares documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html).

H3's ≥5% Near increase and ≥1% other-branch decrease are **fixture-specific fixed-frequency-pump Gates**, not universal laws. An ideal future constant-ΔP controller could behave differently.

## 12. Volume FIFO transport

Each zone owns a deque of `(volume_m3, temperature_c)` packets. A step inserts `Q_i dt` at station temperature and removes exactly that volume from the oldest end. Adjacent equal-temperature inlet packets are merged. Removed packets yield outlet segments `(duration=removed_volume/Q_i, temperature)`; the building integrator uses their actual order/durations, including fronts arriving partway through a physical step.

Total stored volume remains V. Energy inventory is `E_pipe=rho cp Σ(V_packet T_packet)` relative to 0°C. A flow change advances preexisting packets at the new rate. Estimated delay is `V/Q` at current flow, not a fixed-temperature index. Zero flow preserves inventory, delivers no heat and has undefined delay (`None`); active P1A pump/valve bounds yield positive flow in adapter frames.

## 13. Equivalent volumes and arrival measurement

Permitted nominal design references are used only here:

| Zone | Nominal m³/h | Nominal min | Derived V, m³ |
| --- | --- | --- | --- |
| Near | 17.8 | 10 | 2.966666667 |
| Mid | 14.2 | 20 | 4.733333333 |
| Far | 10.6 | 35 | 6.183333333 |

The code computes `V=m3h_to_m3s(Q_nominal) × minutes_to_seconds(delay)` rather than hard-coding these results. No heat-loss or pressure coefficient is calibrated to these flows.

Arrival Gate: 45→50°C boundary, dt=300 s, first interval-mean delivered temperature ≥45.25°C. Ideal fronts arrive at 10/20/35 min; the first strictly positive interval-mean response is timestamped at 15/25/40 min, within the SPEC's one-step tolerance. This is end-of-interval sampling, not an extra physical delay. Thermal integration starts at the front's actual within-step arrival. At 80% Far nominal flow, physical V/Q=43.75 min, first sampled response=45 min.

## 14. Radiator formulation

Water heat-capacity rate `M=m_dot cp` (W/K). With indoor air treated as an instantaneous uniform thermal reservoir:

`G_rad=M [1−exp(−UA/M)]`;
`Q_rad=G_rad max(T_supply−T_indoor,0)`;
`T_return=T_supply−Q_rad/M`.

For M=0, Q=0 and return temperature is a finite no-transfer sentinel equal to supply. The use of `expm1` preserves accuracy for small UA/M. For positive heating, `0≤G_rad≤min(UA,M)` and `T_indoor≤T_return≤T_supply`. Thus low flow cannot imply unbounded heating or a return colder than indoor air. Negative heat extraction/cooling is outside the heating-only model.

This is the explicitly allowed NTU alternative. It follows by solving the water-temperature decay against a uniform ambient node; effectiveness/NTU is a standard heat-exchanger modeling approach described in the [EnergyPlus Engineering Reference](https://energyplus.net/assets/nrel_custom/pdfs/pdfs_v25.1.0/EngineeringReference.pdf). Constant UA is a synthetic simplification, not a calibrated radiator emission curve.

## 15. Flow allocation and returns

`m_b=rho Q_zone weight_b / Σ_zone weight`.

`T_return,zone=Σ(m_b T_return,b)/Σm_b`.
`T_return,station=Σ(m_zone T_return,zone)/Σm_zone`.

Each building return uses its time-mean emitter heat and its constant interval flow. Zone/station averages are weighted by mass flow, not arithmetic temperature averages. Static profiles never repeat in dynamic frames.

## 16. Building 1R1C

`C dT/dt=G_rad max(T_supply−T,0)+Q_solar+Q_internal−(T−T_out)/R−G_window w(T−T_out)`.

The sign convention is positive envelope/window heat leaving the building. If outdoors is warmer, the signed term becomes a heat gain. This resolves the SPEC's signed `+Q_window_loss` notation consistently with its required window-cooling Gate.

## 17–19. Solar, internal gains, window input

`Q_solar=solarRadiationWm2 × effectiveSolarAreaM2 × orientationFactor`.

`Q_internal=profile.internal_gain_w`.

`Q_window=profile.window_conductance_w_k × windowOpenFraction × (T−T_out)`.

Default window fraction=0; finite values in [0,1] only. These are physical inputs, with no opening-event probability model or occupancy inference.

## 20. Required heat load

`H_loss=1/R+G_window w`.

`Q_required,b=max(0,H_loss(T_target−T_out)−Q_solar−Q_internal)`; station requirement is its sum. It describes the instantaneous power to maintain the 21°C target under current forcing. It is not an optimal control action, recovery load, forecast or alias for actual emitter heat.

## 21. Actual supplied heat and station storage

`Q_actual=ΣQ_rad,b=Σ_zone [m_zone cp (T_delivered,zone−T_return,zone)]`.

For water-side validation, use flow-weighted delivered supply: `T_delivered,weighted=Σ(m_zone T_delivered,zone)/m_total`.

`Q_actual=m_total cp(T_delivered,weighted−T_return,station)`.

Separately, `Q_source=m_total cp(T_station,setpoint−T_return,station)`.

During transport transients, `Q_source−Q_actual=ΔE_supply_pipe/dt`. Source heat, pipe storage, actual emitter heat and residuals are exported separately. Confusing source setpoint with delayed supply would incorrectly classify pipe inventory charging/discharging as a heat-balance error. Adapter `heatSupplyMw/currentHeatSupplyMw` follows the requested delivered-heat definition; pipe/source diagnostics remain in the independent core/CSV.

## 22. Pump power and energy

`P_hydraulic=ΔP_pump Q_total`; `P_electric=P_hydraulic/0.76`. Efficiency 0.76 is synthetic. W internally, kW in adapter and CSV. `E_pump=Σ(P_electric dt)` in J, convertible to kWh; heat energy likewise sums actual delivered W×s. Pump mechanical/electrical losses are not injected as heat into the water or building energy equations; these diagnostics are a separate equipment-power budget. Return-pipe and pump-temperature effects require later refinement if material.

## 23. Equipment and parameter validation

Supply 40–60°C, frequency 30–50 Hz, valves 0.2–1.0, matching frozen P0 limits. Each accepted control change ≤2°C, ≤2 Hz, ≤0.1 valve fraction. Initialization validates absolute limits; live changes also require a 1,800-second boundary. A unchanged command may be held over any physical step. No clamping or silent correction. Unsupported differential-pressure mode raises a descriptive error.

Validate positive finite R/C, water constants, volume, flow weights, pump reference/head/curve/efficiency; nonnegative finite pipe loss, UA, gains, wind, radiation and window conductance; efficiency ≤1; correct B01–B12 identities and four buildings/zone; finite weather and states. Invalid commands/windows are rejected before solving. Solver/numerical failure leaves the previous engine state unchanged.

## 24. Time stepping and frame semantics

Default dt=300 s, supported 600/900 s. Physical timestep differs from command interval=1,800 s. No future MPC timer is implemented.

For each constant transport outlet segment, while heating is active:

`A=H_loss+G_rad`, `T_eq=(H_loss T_out+solar+internal+G_rad T_supply)/A`.

`T_end=T_eq+(T_start−T_eq)exp(−A dt/C)`.

`T_mean=T_eq+(T_start−T_eq)(1−exp(−x))/x`, `x=A dt/C`.

Integrate radiator output using this exact mean. If the node crosses supply temperature, split at `t_cross=−(C/A)ln[(T_supply−T_eq)/(T_start−T_eq)]`; turn heating on/off and solve the remaining piece. A constant forcing can cross at most once. Thus both the zero-heating branch and thermal storage are conserved. No explicit Euler drift or clipping.

Execution: read clock/midpoint weather → validate controls/windows → solve hydraulics → clone buffers → advance transport/allocate flow → integrate buildings per outlet segment → flow-weight returns → compute load/heat/pump/energy → conservation/finite checks → commit all dynamic state/clock → serialize if requested.

Frames/CSV use **end-of-step timestamps**. Indoor temperature is the endpoint; heat rates, return and delivered supply temperatures are interval means; weather is midpoint-sampled and held over that interval. Controls/flows are piecewise constant. This sampling convention is documented for the proposed seam, which does not prescribe instantaneous vs averaged rates. First frame covers 08:00–08:05; final frame ends next day 08:00. No metadata fields are added to the frozen response.

## 25. Conservation diagnostics

Station flow residual: `|Q_total−ΣQ_zone|/max(Q_total,1e-15)`.

Allocation residual: `|Σm_building−m_zone|/max(m_zone,1e-15)`.

Zone/station heat residuals: `|water_heat−Σemitter_heat|/max(|Σemitter_heat|,1 W)`.

Pipe residual: `|source_heat−actual_heat−ΔE_pipe/dt|/max(|source_heat|,|actual_heat|,1 W)`.

Building residual: `|C ΔT/dt−(Q_rad+Q_solar+Q_internal−Q_envelope−Q_window)| / max(|Q_rad|+Q_solar+Q_internal,1 W)`.

Volume residual: `|Σpacket_volume−V|/V`.

The 1 W and tiny-flow denominator floors make zero-load diagnostics defined; they do not replace physical terms. Internal runtime conservation tolerance is 1e-7; volume FIFO tolerance is 1e-10. Acceptance Gates retain SPEC 1e-6 mass/1e-5 heat thresholds and 0.3°C timestep criterion without alteration.

## 26. Known limitations and reproducibility

No empirical calibration, air stratification, emitter inertia, dynamic within-zone balancing, pipe heat loss, return delay, wind-dependent infiltration or pump heat deposition. Uniform initial pipe water and midpoint weather are explicit choices. Constant controls/scheduled experiments are not a Traditional Baseline comparison. Compliance/comfort are derived for 12 building nodes, not a 120–240 household distribution.

The complete reproducible parameter/weather/control fixture is `p1a_parameters.json`; dependencies are pinned in `physical_core/uv.lock`. Individual time-step sensitivity, warm-start behavior, heating-mode crossing, failure transactionality and zero-flow tests are included. Reported very small residuals demonstrate internal conservation for this synthetic model, not accuracy against a real heating plant.
