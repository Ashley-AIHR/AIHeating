# P9 Real-site Pilot Transition Plan

P9 documents this plan only. Synthetic performance must not be assumed to transfer.

## Stages

1. **Read-only data integration** — connect historian/weather sources without any command path; establish time synchronisation and asset mapping.
2. **Data-quality and sensor validation** — quantify gaps, bias, drift, plausibility, sampling, latency and stale-data behavior.
3. **Site calibration** — identify site-specific hydraulic/thermal parameters and uncertainty; validate season and operating-envelope coverage.
4. **Shadow prediction** — run P4 and P5 with issued forecasts and live read-only inputs; separately assess load and temperature prediction.
5. **Shadow MPC recommendation** — solve without applying; validate feasibility, solver reliability, fallback and nonlinear/site-surrogate checks.
6. **Operator advisory** — expose bounded recommendations, reasons and manual acknowledgement; record acceptance/rejection and outcomes.
7. **Limited closed-loop supervisory control** — only after safety approval, start with restricted assets/time windows and immediate fallback/manual override.
8. **Production hardening** — monitoring, redundancy, cyber review, support, change control, training, alarms, rollback and operational certification.

## Minimum signals

- outdoor temperature and issued weather forecast;
- secondary supply/return temperature, total flow and timestamps;
- pump frequency;
- zone valve positions;
- representative indoor temperatures;
- equipment limits and operating modes;
- pressure/differential pressure where available;
- building/zone metadata.

Optional signals: zone flow, zone supply/return temperature, solar/irradiance and richer occupancy/internal-gain proxies.

## Safety prerequisites before any closed loop

Operator approval; hard equipment interlocks; independent PLC/DCS protection; command/rate bounds; watchdog; fail-safe fallback; communication-loss, stale-data and solver-timeout policies; manual override; immutable audit logging; rollback; alarm integration; cybersecurity and commissioning approval.

## Independent validation workstreams

Validate P4 load prediction, P5 building-temperature prediction, P6 action feasibility, P6 simulation/field savings and P6 safety separately. Define acceptance thresholds before observation, retain shadow holdouts, and never infer safety from aggregate energy performance.
