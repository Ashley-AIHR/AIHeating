# P0 Data Consistency Report

Status: P0.1 fixture-backed frontend only. No physical simulation, backend, or production inference is implemented.

## Canonical fixture

The single scenario is `rapid-daytime-warming` (`Jan 15, 2025`). Its atomic state is defined in `src/domain.ts`:

- `scenario`: scenario ID, date, reset/current time, weather, outdoor forecast.
- `buildingProfiles`: B01–B12 static metadata: area, year, insulation, network zone, terminal type.
- `buildingStates`: one `indoorTemperatureC` per building.
- `network`: required heat load, supply/return temperatures, total flow, pump frequency, differential pressure, heat supply, pump power, zone valve/flow/delay state.
- `forecastFixtures[6|24|48]`: horizon-specific forecast series, KPIs, intervals, bins, building risks/confidence, and insights.
- `timeline`: seven explicit simulation frames from 08:00 through 14:00.
- `equipmentLimits`: supply 40–60°C / 2°C step, pump 30–50 Hz / 2 Hz step, valves 20–100% / 10 percentage-point step.
- `recommendationFixture`, `overviewFixture`, `resultComparison`, and `modelMetrics`: named P0 display fixtures.

The UI joins `buildingProfiles` and the current `buildingStates` in `App.tsx`; it does not create a second building fixture.

## Derived selectors and formulas

| Selector | Derivation | Consumers |
|---|---|---|
| `selectComplianceRate` | count(indoor ≥ 18°C) / building count | Overview KPI, fixture invariant |
| `selectComfortRate` | count(20°C ≤ indoor ≤ 22°C) / building count | Overview KPI |
| `selectOverheatingRate` | count(indoor > 23°C) / building count | Overview KPI |
| `selectUnderheatingRate` | count(indoor < 18°C) / building count | Overview KPI |
| `selectTemperaturePercentiles` | sorted shared indoor states; floor index `floor((n−1)·p)` for P10/P50/P90 | Results distribution |
| `selectAvoidableOversupply` | `max(0, plannedHeatSupplyMw − requiredHeatLoadMw)` | Forecast KPI and metrics |
| `selectForecastForHorizon` | `forecastFixtures[horizon]` | all Forecast surfaces |
| `selectForecastKpis` | selected horizon plus derived avoidable oversupply | Forecast KPI row and metrics |
| `selectBuildingForecasts` | selected horizon's 12 domain rows | Forecast table |
| `selectForecastInsights` / `selectDistributionBins` | selected horizon domain data | Forecast insight rail/chart |
| `selectResultsComparison` | named Traditional/AI comparison fixture | Results KPIs/charts/tables |

## Required arithmetic

For the canonical 6-hour forecast:

```text
Avoidable Oversupply = Planned Heat Supply − Required Heat Load
                     = 2.48 MW − 2.18 MW
                     = 0.30 MW
```

The same expression is executed in `selectAvoidableOversupply()` and asserted by `scripts/p0-invariants.ts`.

## Cross-page consistency verification

- Overview network values, Simulation controls/status/map, and Settings limits read the same `network`/`equipmentLimits` structures.
- Overview compliance/comfort/overheat/underheat and Results P10/P50/P90 read shared `buildingStates`; they are not separately hard-coded in page components.
- Forecast 6/24/48 KPIs, chart series, distribution bins, insights, confidence, risk counts, and all 12 table rows come from the selected `forecastFixtures` entry.
- Overview next-2h counts come from `overviewFixture`; compliance alert copy is selected by its domain key.
- Results comparison KPI arrays, hydraulic flows, simulated window events, avoidable heat-loss fixture, and hydraulic balance come from `resultComparison` through `selectResultsComparison`.
- Recommendation target supply/pump/valves come from `recommendationFixture`.
- Simulation selected-building predicted temperature comes from `recommendationFixture.selectedBuildingPredictedC`.
- Transport delays are displayed from `network.zones[*].transportDelayMin` in the map, status/detail, and Settings views.
- Pump Power is always rendered in `kW`; Pump Electricity is rendered in `kWh`/`MWh` on Results. No component converts or relabels pump power as energy.

## Remaining duplicated logical values in UI components

Primary domain values are centralized. The following presentation-only values remain in `src/App.tsx` and should be moved if P0 later requires a fully data-driven comparison narrative:

- Results delta notes (`−8.7%`, `−17.1%`, `+8.3 pp`, etc.) are static explanatory annotations; their base KPI values are domain-owned.
- Overview/Simulation day-over-day delta notes (`+0.3°C`, `↑ 1.8%`, `↑ 28%`, etc.) are reference annotations, not current state fields.
- Chart color choices, units, icons, and the 20–22°C comfort label are display metadata; they do not duplicate a physical state value.

No duplicated hard-coded 12-building KPI, forecast horizon, recommendation target, transport-delay, or Results comparison value remains in a page component.

## Automated evidence

`npm run test` executes 20 assertions covering oversupply arithmetic, forecast horizons, 12-row coverage, shared building metrics, percentile values, equipment bounds, and EN/ZH dictionary parity.
