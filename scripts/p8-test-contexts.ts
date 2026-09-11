import { applicationStatus, deriveCustomerStatus, getGuidedRuntime } from '../src/p7-provider';
import { buildTutorContext, type TutorContextPacket, type TutorPage, type TutorRuntimeSource } from '../src/p8-tutor';

const pageFor = (category: string): TutorPage => category === 'FORECAST' ? 'forecast'
  : category === 'COMPARISON' ? 'results'
    : category === 'DOMAIN_CONCEPT' || category === 'UNSUPPORTED' ? 'overview' : 'simulation';

export function contextFor(variant: string, category = 'CURRENT_STATE'): TutorContextPacket {
  const runtime = structuredClone(getGuidedRuntime());
  let statusOverride = runtime.optimisation.status;
  let controlMode: 'traditional' | 'advisory' | 'optimised' = 'optimised';
  let applicationState: 'NOT_APPLIED' | 'APPLIED' | 'FAILED_TO_APPLY' = 'APPLIED';
  let freshness: Parameters<typeof buildTutorContext>[0]['freshness'];
  let selectedBuildingId: string | null = variant === 'selected' || variant === 'changed' ? 'B03' : null;
  let selectedBuildingPrediction: Parameters<typeof buildTutorContext>[0]['selectedBuildingPrediction'];
  if (variant === 'sunny') { runtime.scenario = 'Sunny Winter'; runtime.scenarioFamily = 'sunny_winter'; }
  if (variant === 'hydraulic') { runtime.scenario = 'Hydraulic Imbalance'; runtime.scenarioFamily = 'hydraulic_imbalance'; }
  if (variant === 'cold' || variant === 'cold_after_rapid') {
    runtime.scenario = 'Cold Wave'; runtime.scenarioFamily = 'cold_wave';
    statusOverride = runtime.statusScenarios.coldVerifiedFallback;
    applicationState = 'APPLIED';
  }
  if (variant === 'near18') {
    runtime.scenario = 'Near-18 Engineering Stress'; runtime.scenarioFamily = 'near_18_stress';
    statusOverride = runtime.statusScenarios.near18Infeasible;
    applicationState = 'FAILED_TO_APPLY';
  }
  if (variant === 'advisory') { controlMode = 'advisory'; applicationState = 'NOT_APPLIED'; }
  if (variant === 'optimised') { controlMode = 'optimised'; applicationState = 'APPLIED'; }
  if (variant === 'stale') freshness = { loadPrediction: 'STALE' };
  if (variant === 'unavailable') freshness = { thermalPrediction: 'UNAVAILABLE' };
  if (variant === 'selected') selectedBuildingPrediction = {
    buildingId: 'B03', source: 'P5_STRUCTURED_PROVIDER', points: [
      { horizonMinutes: 60, targetTime: '2025-01-15T11:30:00+08:00', pointC: 22.08, halfWidthC: 0.0418, risk: 'normal' },
      { horizonMinutes: 120, targetTime: '2025-01-15T12:30:00+08:00', pointC: 22.24, halfWidthC: 0.0685, risk: 'normal' },
    ],
  };
  if (variant === 'changed') {
    const b03 = runtime.buildings.find((building) => building.id === 'B03')!;
    b03.indoorC = 20.4;
    runtime.simulationTime = '2025-01-15T11:00:00+08:00';
  }
  const source: TutorRuntimeSource = { current: () => runtime };
  const status = deriveCustomerStatus(statusOverride);
  if (variant === 'cold') applicationState = applicationStatus('optimised', status) as typeof applicationState;
  return buildTutorContext({
    source, page: pageFor(category), controlMode, selectedBuildingId,
    applicationState, freshness, statusOverride, selectedBuildingPrediction,
    semanticEvents: [{ type: 'context_variant', at: runtime.simulationTime }],
    createdAt: '2026-09-11T00:00:00.000Z',
  });
}
