# P5 Thermal Prediction Provider Contract

## Stable seam

`ThermalPredictionProvider.predict(current_state, issued_weather_forecast, planned_water_trajectory, horizon_minutes)` is the stable P6/P7 seam. It deliberately receives the output of the accepted P1A control-to-water adapter, not raw valve commands.

Inputs:

- current B01–B12 indoor temperatures;
- issued-as-of outdoor/solar forecast at 5-minute steps;
- P1A-resolved planned building water trajectory containing transported delivered zone supply and derived building flow;
- one of 30, 60, 120, 180, 360 minutes.

The upstream adapter must resolve `planned supply/pump/valves` through accepted P1A hydraulics, FIFO transport and within-zone configured design shares. Timestamps in weather and water trajectories must align. Missing horizon coverage, unsupported horizons and misalignment fail closed.

Output:

- `forecastAsOf`, `horizonMinutes`;
- per building: target-timestamp point trajectory, terminal `pointC`, `lowerC`, `upperC`, thermal state, underheat/overheat/severe flags;
- `modelVersion`, `calibrationVersion`, `calibrationId`, `inputSchemaVersion`;
- source metadata naming issued forecasts, P1A water trajectory and flow-share adapter;
- interval provenance label.

The registry pins `p5-thermal-model-v1`, `p5-calibration-method-v1`, schema, artifact hashes and conformal widths. Consumers must request an explicit calibration ID and must not load an ambiguous `latest` artifact. P6 must not access optimizer objects, simulation truth, or internal calibration rows.
