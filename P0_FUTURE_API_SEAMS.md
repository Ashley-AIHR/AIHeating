# P0 Future API Seams

P0 remains fixture-only. These are proposed frontend-facing contracts, not implemented APIs. Each seam replaces the named provider behind existing domain selectors and page components; no generic platform framework is proposed.

## Shared state vocabulary

Static building metadata and time-varying thermal state are intentionally separate:

```ts
interface BuildingStaticProfile {
  id: string; areaM2: number; year: number;
  insulation: 'Low' | 'Medium' | 'High';
  zone: 'near' | 'mid' | 'far'; terminalType: 'radiator' | 'floor_heating';
}
interface BuildingThermalState { indoorTemperatureC: number; }
```

## A. Simulation Engine

### Request

```ts
interface SimulationFrameRequest {
  scenarioId: string;
  simulationTime: string;
  stepMinutes: 5 | 10 | 15;
  controlIntervalMinutes: 30;
  weather: WeatherState;
  controls: {
    supplyTemperatureC: number;
    pumpControl:
      | { mode: 'frequency'; frequencyHz: number }
      | { mode: 'differential_pressure'; setpointKPa: number };
    zoneValveOpeningPct: Record<'near' | 'mid' | 'far', number>;
  };
}
```

### Response

```ts
interface SimulationFrameResponse {
  simulationTime: string;
  weather: WeatherState;
  networkState: HeatingNetworkState;
  buildingStates: Record<string, BuildingThermalState>;
  transport: Record<'near' | 'mid' | 'far', {
    delayMin: number; deliveredSupplyTemperatureC: number;
  }>;
  metrics: {
    requiredHeatLoadMw: number; heatSupplyMw: number; pumpPowerKw: number;
    complianceRate: number; comfortRate: number;
  };
  source: 'fixture' | 'simulation_engine';
  solver?: { status: 'converged' | 'infeasible' | 'failed'; residual?: number; iterations?: number; message?: string };
}
```

Current fixture provider to replace: `scenario`, `buildingProfiles`, `buildingStates`, `network`, `timeline`, `advancePrototypeTimeline`, and `applyPrototypeControl` in `src/domain.ts`.

Consumers: Simulation `NetworkMap`, controls, selected-building detail, trends, event semantics; Overview `SystemStatus` and network map.

## B. Prediction Engine

### Request

```ts
interface PredictionRequest {
  scenarioId: string; forecastAsOf: string; horizonHours: 6 | 24 | 48;
  weatherForecast: WeatherState[];
  buildingProfiles: BuildingStaticProfile[];
  buildingStates: Record<string, BuildingThermalState>;
  networkState: HeatingNetworkState;
}
```

### Response

```ts
interface PredictionResponse {
  forecastAsOf: string;
  horizonHours: 6 | 24 | 48;
  outdoorTemperatureC: number[];
  series: ForecastSeries;
  buildingForecasts: Array<{
    buildingId: string;
    predictedTraditionalC: number;
    predictedAiC: number;
    risk: 'comfortable' | 'overheating' | 'underheating' | 'watch';
    confidence: 'High' | 'Medium' | 'Low';
  }>;
  metrics: {
    requiredHeatLoadMw: number; plannedHeatSupplyMw: number;
    predictedComplianceRate: number; predictedOverheatingCount: number;
    predictedUnderheatingCount: number; predictedComfortCount: number;
    predictedWatchCount: number; overheatingRiskPct: number;
    predictionIntervalC: [number, number];
  };
  model: { name: string; version: string; validationSet: string };
}
```

Current fixture provider to replace: `forecastFixtures`, `selectForecastForHorizon`, `selectForecastKpis`, `selectBuildingForecasts`, `selectForecastInsights`, and `selectDistributionBins`.

Consumers: Forecast horizon tabs, KPI cards, all four charts, interval/confidence display, 12-row building table, insights, and Key Forecast Metrics.

## C. Optimisation / MPC Engine

### Request

```ts
interface OptimisationRequest {
  scenarioId: string; simulationTime: string;
  networkState: HeatingNetworkState;
  buildingForecasts: PredictionResponse['buildingForecasts'];
  equipmentLimits: EquipmentLimits;
  strategy: 'traditional' | 'advisory' | 'optimised';
}
```

### Response

```ts
interface OptimisationResponse {
  recommendationId: string;
  strategy: 'traditional' | 'advisory' | 'optimised';
  actions: ControlAction[];
  pumpControl:
    | { mode: 'frequency'; frequencyHz: number }
    | { mode: 'differential_pressure'; setpointKPa: number };
  objective: { compliance: number; comfort: number; oversupplyMw: number; pumpElectricityKwh: number; movement: number };
  feasibility: { status: 'feasible' | 'infeasible' | 'fallback'; reason?: string };
  solver?: { status: 'converged' | 'infeasible' | 'failed'; residual?: number; message?: string };
}
```

Current fixture provider to replace: `recommendationFixture`, `applyPrototypeRecommendation`, `changeMode`, `advancePrototypeTimeline`, and the semantic `mpc_*` events.

Application is intentionally a frontend control-mode transition, not a response field: Advisory waits for the operator’s Apply action; Optimised applies automatically.

Consumers: Overview and Simulation Recommendation cards, mode state machine, bounded control updates, and semantic event log. Advisory and Optimised remain different UI workflows after integration.

## D. AI Tutor Context

### Request / context

```ts
interface HeatingTutorContext {
  page: PageRuntimeContext;
  scenario: HeatingScenario;
  weather: WeatherState;
  networkState: HeatingNetworkState;
  buildingProfiles: BuildingStaticProfile[];
  buildingStates: Record<string, BuildingThermalState>;
  selectedBuildingId?: string;
  forecast?: ForecastData;
  recommendation?: OptimisationRecommendation;
  recentActions: SemanticActionRecord[];
  boundary: 'fixture' | 'simulation_engine' | 'production';
}
```

### Response

```ts
interface HeatingTutorResponse {
  answer: string;
  citedState: Array<{ field: string; value: string }>;
  uncertainty: 'low' | 'medium' | 'high';
  suggestedAction?: { label: string; semanticAction: string };
}
```

Current provider: none. Existing structured domain state is the future context source; the Tutor must not scrape DOM text or directly execute equipment commands.

Consumers later: page-level explanation/Tutor surfaces.

## Seam constraints

- Keep contracts specific to scenarios, buildings, heating networks, forecasts, controls, and semantic actions.
- Preserve explicit equipment limits and feasibility status.
- Do not send full static `Building` objects in every simulation frame; send `buildingStates` keyed by building ID and join with static profiles in the frontend selector layer.
- Replace fixture providers behind existing selectors/components; do not add a generic simulator framework.
