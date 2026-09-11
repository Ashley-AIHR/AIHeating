# Phase 1A Implementation Plan

Baseline: frozen P0 commit `7c3b89d`. React, `src/domain.ts`, P0 fixtures, npm commands, tests and P0 documents remain unchanged. The previous GitHub push was denied; this phase is local implementation, not publication.

## Source inspection and contract decisions

Read SPEC v1.2 (especially §§7.2, 8, 15.1), `P0_FUTURE_API_SEAMS.md`, `P0_FINAL_GATE.md`, `P0_FINAL_ACCEPTANCE.md`, domain types and invariant tests. P0 is React/TypeScript/Vite with `npx tsc --noEmit`, `npm run test`, `npm run build`. No physical engine exists. No contract conflict identified. SPEC's signed `+Q_window_loss` is represented as subtraction of a positive outward loss, consistent with its causality Gate. Floor heating is explicitly deferred.

## Structure and modules

Independent Python 3.12 project in `physical_core/`, with numpy/scipy, pytest and matplotlib for engineering plots. Dataclasses, no service framework. `src/ai_heating_core/{constants,units,contracts,parameters,hydraulics,transport,thermal,simulation,scenarios,adapters}.py`; hydraulics, transport, thermal and simulation have separate modules. Tests and scripts are local to this project. Lock dependencies for reproducibility. Root reports/CSV/JSON/plots are acceptance artifacts.

## Equations and units

- SI inside equations: s, m³/s, kg/s, Pa, W, J, K/W, J/K, W/K. Temperatures °C; differences K-equivalent. All reporting conversions in `units.py`.
- Constants: configurable rho=998 kg/m³, cp=4180 J/(kg K), g=9.80665 m/s².
- Shared pump: H=H0(f/50)²−a Qtotal²; dp=rho g H.
- Common loss: Kcommon Qtotal². Each branch: (Kpipe+Kvalve/u²) Qi². Solve three simultaneous residual equations with nonnegative bounds using scipy least_squares, analytic Jacobian, pressure normalization, prior flow warm start. Failure raises diagnostics before state mutation; no fabricated flow fallback.
- Transport: fixed-volume FIFO water packets; advance by Qi dt, preserving each outlet segment duration and its enthalpy. Delay estimate V/Q is diagnostic, not the implementation. Volumes derived from permitted nominal flow×delay references.
- Radiator: G=m cp [1−exp(−UA/(m cp))]; Q=G max(Ts−Ti,0), Tr=Ts−Q/(m cp). This NTU model avoids return below indoor temperature at small flows. Zero flow returns zero heat.
- 1R1C: C dTi/dt=G max(Ts−Ti,0)+solar+internal−(1/R+Gwindow w)(Ti−Tout). Solve analytically for each constant outlet segment, including a crossing of Ti=Ts if needed. Compute interval-mean temperature and all powers from exact integrals so water/building energy balance remains consistent.
- Required load=max(0,Hloss(Ttarget−Tout)−solar−internal), separate from actual=sum radiator power.
- Pump power=dp Qtotal/eta (eta=0.76 synthetic).
- Zone/station returns are mass-flow weighted. Station source input minus delivered radiator heat equals supply-pipe stored-energy change; return transport and pipe loss omitted explicitly.

## Parameters and dynamic state

Central synthetic fixture: 12 radiator profiles, differentiated area/R/C/UA/solar/orientation/internal gains/flow weights; three branch resistances; pump curve and common resistance. Building IDs, zone assignments and static metadata retain P0 identities; physical parameters and initial indoor temperatures are independent synthetic assumptions. No matching of P0 heat/pump/flow values. Export every parameter and weather fixture.

Dynamic state: clock; current controls; previous hydraulic solution; independent FIFO packet buffers; keyed indoor temperatures. Frames contain dynamic thermal terms, flows, returns, energy integrals, metrics and diagnostics, not static profiles. Initial transport inventory is explicitly uniform at initial supply temperature.

## Execution order and limits

Validate weather, window inputs and controls → solve hydraulics → clone/advance transport → allocate zone flow by normalized weights → integrate radiator/building per outlet segment → weighted returns → required/actual heat, pump power and rates → zone/station/pipe/building residuals → commit state and advance clock → optional adapter.

Physical step is 300/600/900 s. Control interval is independently 1800 s; changes allowed on these boundaries and bounded per accepted change (2°C, 2 Hz, 10 percentage points). Initialization checks absolute bounds without a fictional previous command. The +5°C transport unit Gate imposes a boundary perturbation directly on the delay line; integrated engine causality uses a legal +2°C step. Standalone hydraulic Gates likewise compare operating points, not illegal live control jumps.

## Validation sequence

1. Units/invalid parameters/equipment and H1–H5, inspect actual coupled flow changes.
2. FIFO volume/enthalpy, nominal +5°C arrivals and reduced Far flow delay.
3. R1–R4 and T1–T6, exact building energy and timestep stability.
4. Integrated delayed causality, water/building/pipe conservation, injected solver failure and atomic state, 24h at 5 min, 5 vs 10 min <0.3°C, 15 min sanity, deterministic repeats.
5. Adapter JSON checks and TypeScript structural check against extracted frozen seam and imported P0 domain types, with source=simulation_engine and solver=converged.
6. Export measured Gate JSON/Markdown, parameter JSON, 24h CSV and five plots. Review units/signs/weighting/solver/zero flow/storage/sensitivity/fixture leakage; run all P0 regressions; write final engineering report with exact command outcomes.

No Gate threshold changes. Unresolved critical failure means FAIL. Future baseline, floor heating, ML, MPC, API/UI integration and Tutor remain deferred; stop for external engineering review after artifacts and validation.
