# P5 Thermal Prediction Specification

## Scope and boundary

`p5-thermal-model-v1` predicts B01–B12 indoor-temperature trajectories at 30, 60, 120, 180 and 360 minutes. Its primary intended use is 3-hour P6 supervisory control; 6 hours is secondary planning support.

The forward chain is fixed:

`planned supply/pump/valves → P1A hydraulics → P1A FIFO transport → delivered zone supply and zone flow → configured within-zone building flow share → P5 thermal response`.

P5 does not map valves directly to indoor temperature and does not replace or estimate hydraulics or transport. The building input is the transported zone supply temperature plus `rho_water × zone_flow × design_flow_share / sum(zone design_flow_share)`.

## Equations

For building `i`, P5 retains the accepted P1A 1R1C form:

`C_i dT_i/dt = Q_radiator,i + Q_solar,i + Q_internal,i - H_i(T_i - T_out)`

Radiator conductance uses the accepted NTU form in `ai_heating_core.thermal.radiator_conductance`; state propagation uses the accepted exact constant-forcing `linear_update`. P5 changes neither equation. It applies positive calibration scales to nominal `H` and `C`; radiator UA, solar aperture/scale and internal gain remain configured priors in the selected model.

The implementation runs at the accepted 300-second physics step and consumes only inputs allowed by `p5-observability-schema-v1`.

## Output

For every requested building and horizon, the provider returns:

- target-timestamp trajectory and terminal point temperature;
- validation-calibrated lower/upper interval;
- thermal state and underheat/overheat/severe-overheat flags;
- model, calibration method, calibration ID, and input-schema versions.

States are: underheat `<18°C`, cool `18–<20°C`, comfort `20–22°C`, warm `>22–23°C`, overheating `>23–25°C`, and severe overheating `>25°C`. Statistical underheat-classifier accuracy is not claimed because TEST contains no positive underheat examples.

## Evaluation modes

- **Oracle Exogenous Evaluation:** actual future weather and actual historical control trajectory, solely to isolate thermal/calibration error.
- **Forecast-driven Evaluation:** issued weather forecasts and the known planned water trajectory, representing the P6 operating boundary.

Actual future weather is forbidden from the forecast-driven path. Oracle-parameter results are diagnostic only and are not selectable production artifacts.

## Numerical and physical constraints

All fitted scales are log-parameterised, bounded to `[0.5, 1.5]`, positive and finite. Six-hour rollouts must remain finite and within the predeclared sanity range `(-50, 80)°C`. Controlled tests enforce all seven required causal directions, including delayed supply response through P1A transport.
