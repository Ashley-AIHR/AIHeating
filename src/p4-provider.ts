import payload from './p4-preview-data.json';

export interface PreviewSimulationMetrics {
  heatEnergyMWh: number;
  pumpElectricityKWh: number;
  complianceRate: number;
  comfortRate: number;
  overheatingRate: number;
  severeOverheatingRate: number;
  underheatingRate: number;
  excessDeliveredHeatMWh: number;
  P10C: number;
  P50C: number;
  P90C: number;
}

export interface GuidedPreviewProviderData {
  version: string;
  scenario: string;
  simulationTime: string;
  forecastAsOf: string;
  model: {
    displayName: string;
    type: string;
    version: string;
    interval: string;
  };
  now: {
    outdoorC: number;
    solarWm2: number;
    windMs: number;
    requiredLoadMw: number;
    heatSupplyMw: number;
    returnC: number;
    totalFlowM3h: number;
    pressureKpa: number;
    pumpPowerKw: number;
    traditionalControls: {
      supplyC: number;
      pumpHz: number;
      valvesPct: number[];
    };
    indoorP10C: number;
    indoorP50C: number;
    indoorP90C: number;
  };
  zones: Array<{
    key: 'near' | 'mid' | 'far';
    flowM3h: number;
    transportDelayMin: number;
    deliveredSupplyC: number;
  }>;
  buildings: Array<{
    id: string;
    zone: 'near' | 'mid' | 'far';
    indoorC: number;
    requiredHeatKw: number;
    radiatorHeatKw: number;
  }>;
  temperatureDistribution: Array<{
    key: 'under18' | 'cool18To20' | 'comfort20To22' | 'warm22To23' | 'over23';
    count: number;
    fraction: number;
  }>;
  forecast: Array<{
    horizonMinutes: number;
    targetTime: string;
    outdoorC: number;
    solarWm2: number;
  }>;
  predictions: Array<{
    horizonHours: number;
    targetTime: string;
    pointMw: number;
    lowerMw: number;
    upperMw: number;
  }>;
  recommendation: {
    supplyC: number;
    pumpHz: number;
    valvesPct: number[];
    reason: string;
  };
  projection: Record<string, number>;
  comparison: {
    traditional: PreviewSimulationMetrics;
    preview: PreviewSimulationMetrics;
  };
  modelComparison: Array<{
    name: string;
    maeMw: number;
    rmseMw: number;
    r2: number;
  }>;
  configuration: {
    physicalFixtureVersion: string;
    controllerVersion: string;
    predictionHorizonsHours: number[];
    forecastDisplayWindowsHours: number[];
    objectiveVersion: string;
    objective: {
      hardConstraint: string;
      weights: Record<string, number>;
    };
    optimiserVersion: string;
    decisionIntervalMinutes: number;
    previewHorizonMinutes: number;
  };
  labels: Record<string, string>;
}

export const getGuidedPreview = (): GuidedPreviewProviderData =>
  payload as GuidedPreviewProviderData;
