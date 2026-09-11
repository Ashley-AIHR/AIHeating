import { readFile, writeFile } from 'node:fs/promises';

const read = async (name) => JSON.parse(await readFile(new URL(`../${name}`, import.meta.url)));
const p4 = await read('src/p4-preview-data.json');
const p5 = await read('p5_model_registry.json');
const p6 = await read('p6_canonical_benchmark_results.json');
const safety = await read('p6_safety_stress_results.json');
const ablation = await read('p6_ablation_results.json');
const mpcConfig = await read('p6_mpc_config.json');
const safetyConfig = await read('p6_safety_policy_v1.json');
const objective = await read('p6_mpc_objective_v1.json');
const addMinutes = (iso, minutes) => {
  const [, sign, hours, minutePart] = iso.match(/([+-])(\d\d):(\d\d)$/) ?? [];
  const offsetMinutes = (sign === '-' ? -1 : 1) * (Number(hours) * 60 + Number(minutePart));
  const local = new Date(new Date(iso).getTime() + (minutes + offsetMinutes) * 60_000);
  return local.toISOString().slice(0, 19) + iso.slice(-6);
};

const scenario = (family) => p6.scenarios.find((item) => item.scenarioFamily === family);
const rapid = scenario('rapid_warming');
const atDecision = (item) => item.decisions.find((decision) => decision.forecast_as_of === p4.forecastAsOf) ?? item.decisions[0];
const coldFallback = scenario('cold_wave').decisions.find((decision) => decision.fallback_status === 'fallback_verified');
const infeasible = safety.cases.find((item) => item.case === 'infeasible_fallback');
const rapidDecision = atDecision(rapid);
const targetTimes = [30, 60, 90, 120, 150, 180].map((minutes) => ({
  horizonMinutes: minutes,
  targetTime: addMinutes(rapidDecision.forecast_as_of, minutes),
  minimumPointC: Math.min(...Object.values(rapidDecision.predicted_building_trajectories_c).map((values) => values[minutes / 30 - 1])),
  halfWidthC: rapidDecision.prediction_half_widths_c[minutes / 30 - 1],
}));

const statusRecord = (decision) => ({
  recommendationId: decision.recommendation_id,
  forecastAsOf: decision.forecast_as_of,
  optimisationStatus: decision.solver_status,
  verificationStatus: decision.nonlinear_verification_status,
  fallbackStatus: decision.fallback_status,
  fallbackReason: decision.fallback_reason,
  robustMarginC: decision.constraint_margins.minimumRobustTemperatureMarginC,
});

const payload = {
  ...p4,
  version: 'p7-final-provider-v1',
  scenarioFamily: 'rapid_warming',
  recommendationCreatedAt: rapidDecision.forecast_as_of,
  recommendationEffectiveAt: addMinutes(rapidDecision.forecast_as_of, 30),
  resultEvaluationWindow: '2025-01-15T08:00:00+08:00/2025-01-16T08:00:00+08:00',
  providers: {
    simulation: { name: 'Simulation Engine', version: 'physical-fixture-v1.2' },
    loadPrediction: { name: 'Required Heat Predictor', version: 'P4 Predictor v1', type: 'LightGBM' },
    thermalPrediction: { name: 'Thermal Predictor', version: 'P5 Thermal Model v1' },
    optimisation: { name: 'Optimiser', version: 'Formal MPC v1' },
    traditional: { name: 'Traditional Baseline', version: 'traditional-v1.2' },
  },
  thermalPrediction: {
    horizonsHours: [0.5, 1, 2, 3, 6],
    uncertaintySource: 'P5 forecast-driven simulation-calibrated intervals',
    sixHourHalfWidthC: p5.intervalHalfWidthsC.forecast_driven['360'],
    points: targetTimes,
  },
  recommendation: {
    supplyC: rapidDecision.first_action.supply_c,
    pumpHz: rapidDecision.first_action.frequency_hz,
    valvesPct: rapidDecision.first_action.valves.map((value) => value * 100),
    reason: 'Issued warming and solar forecasts reduce predicted Required Heat Load; Formal MPC reshapes supply first, pump second, and zone valves for hydraulic fine-tuning.',
  },
  optimisation: {
    status: statusRecord(rapidDecision),
    horizonMinutes: rapidDecision.horizon_minutes,
    controlStepMinutes: rapidDecision.control_step_minutes,
    firstAction: rapidDecision.first_action,
    trajectories: {
      supplyC: rapidDecision.supply_trajectory_c,
      pumpHz: rapidDecision.pump_trajectory_hz,
      valves: rapidDecision.valve_trajectories_fraction,
    },
    objectiveComponents: rapidDecision.objective_components,
    solveTimeS: rapidDecision.solve_time_s,
    relinearisationCount: rapidDecision.relinearisation_count,
    constraintMargins: rapidDecision.constraint_margins,
  },
  comparison: {
    traditional: rapid.traditional,
    preview: rapid.preview,
    mpc: {
      ...rapid.mpc,
      fallbackCount: rapid.decisions.filter((item) => item.fallback_status !== 'not_used').length,
      solverStatusSummary: Object.fromEntries([...new Set(rapid.decisions.map((item) => item.solver_status))]
        .map((status) => [status, rapid.decisions.filter((item) => item.solver_status === status).length])),
      verificationFailureCount: rapid.decisions.filter((item) => item.nonlinear_verification_status !== 'passed' && item.fallback_status === 'not_used').length,
    },
  },
  ablation: ablation.controllers,
  statusScenarios: {
    rapidOptimal: statusRecord(rapidDecision),
    sunnyOptimal: statusRecord(atDecision(scenario('sunny_winter'))),
    coldVerifiedFallback: statusRecord(coldFallback),
    near18Infeasible: {
      ...statusRecord(infeasible.recommendation),
      realisedMinimumC: infeasible.realisedSafety.minimumIndoorC,
    },
  },
  configuration: {
    ...p4.configuration,
    optimiserVersion: 'p6-mpc-v1',
    optimiserDisplayName: 'Formal MPC v1',
    thermalModelVersion: 'p5-thermal-model-v1',
    thermalPredictionHorizonsHours: [0.5, 1, 2, 3, 6],
    mpcHorizonHours: mpcConfig.horizonMinutes / 60,
    controlIntervalMinutes: mpcConfig.controlStepMinutes,
    equipmentBounds: mpcConfig.equipmentBounds,
    rateLimitsPerStep: mpcConfig.rateLimitsPerStep,
    robustSafety: 'Lower prediction bound >=18°C',
    fallbackPolicy: safetyConfig.primaryFallback + ' / ' + safetyConfig.nearComplianceFallback,
    objectiveVersion: objective.version,
    objective: { ...p4.configuration.objective, version: objective.version, weights: {
      belowComfortDegreeHoursBelow20: objective.weights.belowComfortDegreeHoursBelow20,
      mildOverheatingDegreeHoursAbove23: objective.weights.overheatingDegreeHoursAbove23,
      severeOverheatingDegreeHoursAbove25: objective.weights.severeOverheatingDegreeHoursAbove25,
      normalizedAvoidableOversupply: objective.weights.normalizedAvoidableOversupply,
      normalizedPumpElectricity: objective.weights.normalizedPumpElectricity,
      normalizedControlMovement: objective.weights.normalizedControlMovement,
    } },
  },
  legacyPreview: { role: 'Intermediate Prototype / Engineering Benchmark', version: 'Preview Optimiser v0' },
};

await writeFile(new URL('../src/p7-runtime-data.json', import.meta.url), JSON.stringify(payload, null, 2) + '\n');
