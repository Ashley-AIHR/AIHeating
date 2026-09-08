export type ZoneKey = 'near' | 'mid' | 'far';
export type ControlMode = 'traditional' | 'advisory' | 'optimised';
export type Language = 'en' | 'zh';
export type TerminalType = 'radiator' | 'floor_heating';
export type ForecastHorizon = 6 | 24 | 48;

export interface ControlAction { type: 'set_supply_temperature' | 'set_pump_frequency' | 'set_zone_valve'; target: string; value: number; unit: string; }
export interface HeatingStrategy { id: ControlMode; label: string; automatic: boolean; }
export interface OptimisationRecommendation { actions: ControlAction[]; rationale: string; status: 'fixture' | 'applied'; }
export interface PageRuntimeContext { page: 'overview' | 'simulation' | 'forecast' | 'results' | 'settings'; scenarioId: string; controlMode: ControlMode; simulationTime: string; }
export interface WeatherState { outdoorTemperatureC: number; solarRadiationWm2: number; windSpeedMs: number; }
export interface BuildingStaticProfile { id: string; areaM2: number; year: number; insulation: 'Low' | 'Medium' | 'High'; zone: ZoneKey; terminalType: TerminalType; }
export interface BuildingThermalState { indoorTemperatureC: number; }
export interface Building extends BuildingStaticProfile, BuildingThermalState {}
export interface ZoneState { key: ZoneKey; valveOpeningPct: number; flowM3h: number; transportDelayMin: number; }
export interface HeatingNetworkState {
  requiredHeatLoadMw: number; supplyTemperatureC: number; returnTemperatureC: number; totalFlowM3h: number; pumpFrequencyHz: number;
  differentialPressureKpa: number; currentHeatSupplyMw: number; pumpPowerKw: number; zones: Record<ZoneKey, ZoneState>;
}
export interface EquipmentLimits { supplyTemperatureC: { min: number; max: number; step: number }; pumpFrequencyHz: { min: number; max: number; step: number }; valveOpeningPct: { min: number; max: number; step: number }; }
export interface HeatingScenario { id: string; name: string; date: string; resetTime: string; weather: WeatherState; forecastOutdoorC: number[]; }
export interface ForecastSeries { labels: string[]; requiredHeatLoadMw: number[]; traditionalSupplyMw: number[]; plannedSupplyMw: number[]; traditionalIndoorC: number[]; optimisedIndoorC: number[]; }
export interface BuildingForecastRow { buildingId: string; predictedTraditionalC: number; predictedAiC: number; risk: 'comfortable' | 'overheating' | 'underheating' | 'watch'; confidence: 'High' | 'Medium' | 'Low'; }
export interface DistributionBin { label: string; traditional: number; optimised: number; }
export interface ForecastInsight { titleKey: string; textKey: string; }
export interface ForecastData {
  horizon: ForecastHorizon; forecastAsOf: string; forecastTargetTime: string; outdoorTemperatureC: number[]; requiredHeatLoadMw: number; plannedHeatSupplyMw: number; predictedIndoorTemperatureC: number; predictionIntervalC: [number, number]; overheatingRiskPct: number;
  predictedComplianceRate: number; predictedOverheatingCount: number; predictedUnderheatingCount: number; predictedComfortCount: number; predictedWatchCount: number; confidence: 'High' | 'Medium' | 'Low'; series: ForecastSeries;
  buildingForecasts: BuildingForecastRow[]; distributionBins: DistributionBin[]; insights: ForecastInsight[];
}
export interface SemanticActionRecord { type: string; at: string; detailKey: string; detailValue?: string; }
export interface SimulationTimelineFrame { time: string; outdoorTemperatureC: number; supplyTemperatureC: number; nearValvePct: number; midValvePct: number; farValvePct: number; }
export interface ModelValidationMetric { name: string; mae: number; rmse: number; r2?: number; }
export interface ResultsComparison { kpis: { traditional: number[]; optimised: number[] }; zoneFlow: { traditional: number[]; optimised: number[] }; windowEvents: { traditional: number[]; optimised: number[] }; hydraulicBalance: { traditional: number; optimised: number }; avoidableHeatLossMwh: number; aiPercentileC: [number, number, number]; }

export const zoneKeys: ZoneKey[] = ['near', 'mid', 'far'];
export const equipmentLimits: EquipmentLimits = { supplyTemperatureC: { min: 40, max: 60, step: 2 }, pumpFrequencyHz: { min: 30, max: 50, step: 2 }, valveOpeningPct: { min: 20, max: 100, step: 10 } };
export const scenario: HeatingScenario = { id: 'rapid-daytime-warming', name: 'Rapid Daytime Warming', date: 'Jan 15, 2025', resetTime: '08:00', weather: { outdoorTemperatureC: -2, solarRadiationWm2: 320, windSpeedMs: 3.4 }, forecastOutdoorC: [-2, -1.1, .2, 1.3, 2.8, 3.8, 4.5] };
export const buildingProfiles: BuildingStaticProfile[] = [
  ['B01', 1200, 2018, 'High', 'near'], ['B02', 980, 2010, 'High', 'near'], ['B03', 980, 1978, 'Low', 'near'], ['B04', 1100, 2015, 'High', 'near'],
  ['B05', 1100, 2015, 'Medium', 'mid'], ['B06', 1050, 2012, 'Medium', 'mid'], ['B07', 920, 2008, 'Medium', 'mid'], ['B08', 1180, 2014, 'Medium', 'mid'],
  ['B09', 900, 2005, 'Low', 'far'], ['B10', 1050, 2012, 'Medium', 'far'], ['B11', 1300, 2008, 'Medium', 'far'], ['B12', 1150, 2014, 'Medium', 'far'],
].map(([id, areaM2, year, insulation, zone]) => ({ id, areaM2, year, insulation, zone, terminalType: 'radiator' } as BuildingStaticProfile));
export const buildingStates: BuildingThermalState[] = [22.7, 23.6, 24.1, 22.4, 21.2, 20.5, 21.8, 20.9, 19.7, 18.8, 18.4, 19.1].map((indoorTemperatureC) => ({ indoorTemperatureC }));
export const buildings: Building[] = buildingProfiles.map((profile, i) => ({ ...profile, ...buildingStates[i] }));
export const network: HeatingNetworkState = { requiredHeatLoadMw: 2.45, supplyTemperatureC: 48, returnTemperatureC: 37.1, totalFlowM3h: 42.6, pumpFrequencyHz: 46, differentialPressureKpa: 68, currentHeatSupplyMw: 2.78, pumpPowerKw: 18.5, zones: { near: { key: 'near', valveOpeningPct: 76, flowM3h: 17.8, transportDelayMin: 10 }, mid: { key: 'mid', valveOpeningPct: 65, flowM3h: 14.2, transportDelayMin: 20 }, far: { key: 'far', valveOpeningPct: 48, flowM3h: 10.6, transportDelayMin: 35 } } };

const baseForecastSeries: ForecastSeries = { labels: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'], requiredHeatLoadMw: [2.6, 2.45, 2.28, 2.12, 2.02, 2.08, 2.18], traditionalSupplyMw: [3, 3, 2.9, 2.75, 2.5, 2.55, 2.7], plannedSupplyMw: [2.48, 2.32, 2.18, 2.02, 1.98, 2.08, 2.22], traditionalIndoorC: [21.4, 22, 22.8, 23.6, 24.1, 24.2, 24.1], optimisedIndoorC: [21.1, 21, 21.2, 21.3, 21.4, 21.3, 21.2] };
const forecastInsights: ForecastInsight[] = [{ titleKey: 'rapidWarmingInsightTitle', textKey: 'rapidWarmingInsightText' }, { titleKey: 'solarInsightTitle', textKey: 'solarInsightText' }, { titleKey: 'overheatingInsightTitle', textKey: 'overheatingInsightText' }, { titleKey: 'farInsightTitle', textKey: 'farInsightText' }];
const riskPlans: Record<ForecastHorizon, { overheating: number[]; underheating: number[]; watch: number[] }> = {
  6: { overheating: [1, 2, 3], underheating: [8], watch: [5] },
  24: { overheating: [1, 2, 3, 4], underheating: [8, 9], watch: [] },
  48: { overheating: [1, 2, 3, 4, 5], underheating: [7, 8], watch: [] },
};
const forecastRows = (horizon: ForecastHorizon, shift: number): BuildingForecastRow[] => {
  const plan = riskPlans[horizon];
  return buildings.map((building, i) => {
    const predictedTraditionalC = Number((building.indoorTemperatureC + (building.zone === 'near' ? 1.1 + shift : .2 + shift)).toFixed(1));
    const baseAiC = building.indoorTemperatureC + (building.zone === 'far' ? .1 : -.3) + shift / 2;
    const risk = plan.overheating.includes(i) ? 'overheating' : plan.underheating.includes(i) ? 'underheating' : plan.watch.includes(i) ? 'watch' : 'comfortable';
    const predictedAiC = risk === 'overheating' ? Math.max(23.4, baseAiC) : risk === 'underheating' ? Math.min(17.5, baseAiC) : risk === 'watch' ? 22.5 : baseAiC;
    return { buildingId: building.id, predictedTraditionalC, predictedAiC: Number(predictedAiC.toFixed(1)), risk, confidence: horizon === 6 ? (i === 8 ? 'Medium' : 'High') : horizon === 24 ? 'Medium' : 'Low' };
  });
};
const distributionBins = (traditional: number[], optimised: number[]): DistributionBin[] => ['<18°C', '18–20°C', '20–22°C', '22–23°C', '>23°C'].map((label, i) => ({ label, traditional: traditional[i] ?? 0, optimised: optimised[i] ?? 0 }));
const binsFor = (values: number[]): number[] => [values.filter((value) => value < 18).length, values.filter((value) => value >= 18 && value < 20).length, values.filter((value) => value >= 20 && value < 22).length, values.filter((value) => value >= 22 && value <= 23).length, values.filter((value) => value > 23).length];
const makeForecast = (horizon: ForecastHorizon, data: Partial<ForecastData> & { series: ForecastSeries }): ForecastData => {
  const buildingForecasts = forecastRows(horizon, horizon === 6 ? 0 : horizon === 24 ? .2 : .4);
  const predictedOverheatingCount = buildingForecasts.filter((row) => row.risk === 'overheating').length;
  const predictedUnderheatingCount = buildingForecasts.filter((row) => row.risk === 'underheating').length;
  const predictedComfortCount = buildingForecasts.filter((row) => row.risk === 'comfortable').length;
  const predictedWatchCount = buildingForecasts.filter((row) => row.risk === 'watch').length;
  return {
    horizon, forecastAsOf: scenario.resetTime, forecastTargetTime: getForecastTargetTime(scenario.resetTime, horizon),
    outdoorTemperatureC: data.outdoorTemperatureC ?? (horizon === 6 ? scenario.forecastOutdoorC : horizon === 24 ? [-2, -.4, 1.5, 3.8, 5.2, 6.1, 6.8, 7.2] : [-2, .8, 3.4, 5.8, 7.1, 8.2, 9, 9.4]),
    requiredHeatLoadMw: data.requiredHeatLoadMw!, plannedHeatSupplyMw: data.plannedHeatSupplyMw!, predictedIndoorTemperatureC: data.predictedIndoorTemperatureC!, predictionIntervalC: data.predictionIntervalC!,
    overheatingRiskPct: Number((predictedOverheatingCount / buildingForecasts.length * 100).toFixed(1)),
    predictedComplianceRate: (buildingForecasts.length - predictedUnderheatingCount) / buildingForecasts.length,
    predictedOverheatingCount, predictedUnderheatingCount, predictedComfortCount, predictedWatchCount,
    confidence: data.confidence ?? (horizon === 6 ? 'High' : horizon === 24 ? 'Medium' : 'Low'),
    series: data.series, buildingForecasts,
    distributionBins: distributionBins(binsFor(buildingForecasts.map((row) => row.predictedTraditionalC)), binsFor(buildingForecasts.map((row) => row.predictedAiC))),
    insights: forecastInsights,
  };
};
export const forecastFixtures: Record<ForecastHorizon, ForecastData> = {
  6: makeForecast(6, { requiredHeatLoadMw: 2.18, plannedHeatSupplyMw: 2.48, predictedIndoorTemperatureC: 21.1, predictionIntervalC: [20.8, 21.6], series: baseForecastSeries }),
  24: makeForecast(24, { requiredHeatLoadMw: 2.32, plannedHeatSupplyMw: 2.62, predictedIndoorTemperatureC: 21.4, predictionIntervalC: [20.7, 22.1], series: { labels: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00'], requiredHeatLoadMw: [2.32, 2.2, 2.1, 2.18, 2.32, 2.4, 2.5, 2.55], traditionalSupplyMw: [3, 2.9, 2.7, 2.6, 2.7, 2.8, 2.9, 3], plannedSupplyMw: [2.62, 2.45, 2.3, 2.35, 2.5, 2.55, 2.6, 2.65], traditionalIndoorC: [21.4, 22.8, 24.1, 24.3, 23.9, 23.5, 23.2, 23], optimisedIndoorC: [21.4, 21.3, 21.4, 21.5, 21.3, 21.2, 21.1, 21.2] } }),
  48: makeForecast(48, { requiredHeatLoadMw: 2.4, plannedHeatSupplyMw: 2.78, predictedIndoorTemperatureC: 21.7, predictionIntervalC: [20.4, 22.8], series: { labels: ['10:00', '14:00', '18:00', '22:00', '02:00', '06:00', '10:00', '14:00'], requiredHeatLoadMw: [2.4, 2.2, 2.35, 2.5, 2.65, 2.7, 2.55, 2.35], traditionalSupplyMw: [3, 2.8, 2.9, 3, 3.1, 3.1, 3, 2.8], plannedSupplyMw: [2.78, 2.5, 2.65, 2.8, 2.95, 2.95, 2.8, 2.6], traditionalIndoorC: [21.4, 23.4, 24.1, 23.8, 23.5, 24, 23.5, 22.9], optimisedIndoorC: [21.7, 21.5, 21.6, 21.7, 21.5, 21.4, 21.3, 21.4] } }),
};
export const timeline: SimulationTimelineFrame[] = [{ time: '08:00', outdoorTemperatureC: -5.2, supplyTemperatureC: 50, nearValvePct: 72, midValvePct: 62, farValvePct: 46 }, { time: '09:00', outdoorTemperatureC: -3.7, supplyTemperatureC: 49, nearValvePct: 74, midValvePct: 64, farValvePct: 47 }, { time: '10:00', outdoorTemperatureC: -2, supplyTemperatureC: 48, nearValvePct: 76, midValvePct: 65, farValvePct: 48 }, { time: '11:00', outdoorTemperatureC: -.5, supplyTemperatureC: 47, nearValvePct: 72, midValvePct: 65, farValvePct: 52 }, { time: '12:00', outdoorTemperatureC: 1.1, supplyTemperatureC: 46, nearValvePct: 68, midValvePct: 65, farValvePct: 56 }, { time: '13:00', outdoorTemperatureC: 2.8, supplyTemperatureC: 45, nearValvePct: 64, midValvePct: 64, farValvePct: 60 }, { time: '14:00', outdoorTemperatureC: 4.5, supplyTemperatureC: 44, nearValvePct: 60, midValvePct: 64, farValvePct: 64 }];

export const initialNetworkState = network;
export const recommendationFixture = { supplyTemperatureC: 46, pumpFrequencyHz: 44, valves: { near: 64, mid: 65, far: 60 } as Record<ZoneKey, number>, selectedBuildingPredictedC: 23.4 };
export const overviewFixture = { next2hOverheatingCount: 3, next2hUnderheatingCount: 1, complianceAlertKey: 'allBuildingsAboveCompliance' };
export const resultComparison: ResultsComparison = { kpis: { traditional: [62.4, 420, 91.7, 33.3, 25, 8.3], optimised: [57, 348, 100, 66.7, 8.3, 0] }, zoneFlow: { traditional: [22.4, 14.1, 8.9], optimised: [18.8, 14.6, 13.2] }, windowEvents: { traditional: [42, 18, 6], optimised: [19, 10, 2] }, hydraulicBalance: { traditional: .68, optimised: .92 }, avoidableHeatLossMwh: 5.4, aiPercentileC: [18.4, 20.8, 22.4] };
export const modelMetrics: ModelValidationMetric[] = [{ name: 'Linear Regression Baseline', mae: 1.42, rmse: 1.98, r2: .71 }, { name: 'LightGBM', mae: .63, rmse: .91, r2: .92 }, { name: 'GRU (Optional)', mae: .58, rmse: .86, r2: .93 }];

export function getFixtureScenario(): HeatingScenario { return scenario; }
export function getFixtureForecast(horizon: ForecastHorizon = 6): ForecastData { return selectForecastForHorizon(horizon); }
export function getFixtureOptimisedState(): HeatingNetworkState { return cloneNetwork(initialNetworkState); }
export function cloneNetwork(current: HeatingNetworkState): HeatingNetworkState { return { ...current, zones: { near: { ...current.zones.near }, mid: { ...current.zones.mid }, far: { ...current.zones.far } } }; }
export function applyPrototypeControl(current: HeatingNetworkState, patch: Partial<Pick<HeatingNetworkState, 'supplyTemperatureC' | 'pumpFrequencyHz'>> & { valves?: Partial<Record<ZoneKey, number>> }): HeatingNetworkState { const bounded = (value: number, limits: { min: number; max: number }) => Math.max(limits.min, Math.min(limits.max, value)); const rateLimited = (value: number, currentValue: number, limits: { min: number; max: number; step: number }) => bounded(currentValue + Math.max(-limits.step, Math.min(limits.step, value - currentValue)), limits); const supplyTemperatureC = rateLimited(patch.supplyTemperatureC ?? current.supplyTemperatureC, current.supplyTemperatureC, equipmentLimits.supplyTemperatureC); const pumpFrequencyHz = rateLimited(patch.pumpFrequencyHz ?? current.pumpFrequencyHz, current.pumpFrequencyHz, equipmentLimits.pumpFrequencyHz); const zones = { ...current.zones }; for (const key of Object.keys(patch.valves ?? {}) as ZoneKey[]) zones[key] = { ...zones[key], valveOpeningPct: rateLimited(patch.valves?.[key] ?? zones[key].valveOpeningPct, zones[key].valveOpeningPct, equipmentLimits.valveOpeningPct) }; return { ...current, supplyTemperatureC, pumpFrequencyHz, zones }; }
export function applyPrototypeRecommendation(current: HeatingNetworkState): HeatingNetworkState { return applyPrototypeControl(current, recommendationFixture); }
export function advancePrototypeTimeline(current: HeatingNetworkState, frame: SimulationTimelineFrame): HeatingNetworkState { return applyPrototypeControl(current, { supplyTemperatureC: frame.supplyTemperatureC, valves: { near: frame.nearValvePct, mid: frame.midValvePct, far: frame.farValvePct } }); }
function addHoursToClock(asOf: string, offsetHours: number): string {
  const [hour, minute] = asOf.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + offsetHours * 60;
  const dayOffset = Math.floor(totalMinutes / (24 * 60));
  const clock = [Math.floor((totalMinutes % (24 * 60)) / 60), totalMinutes % 60].map((value) => String(value).padStart(2, '0')).join(':');
  return dayOffset ? `+${dayOffset}d ${clock}` : clock;
}
export function getForecastTargetTime(forecastAsOf: string, forecastHorizonHours: ForecastHorizon): string {
  return addHoursToClock(forecastAsOf, forecastHorizonHours);
}
function forecastLabels(horizon: ForecastHorizon, asOf: string): string[] {
  const offsets = horizon === 6 ? [0, 1, 2, 3, 4, 5, 6] : horizon === 24 ? [0, 3, 6, 9, 12, 15, 18, 24] : [0, 6, 12, 18, 24, 30, 36, 48];
  return offsets.map((offset) => addHoursToClock(asOf, offset));
}
export function selectForecastForHorizon(horizon: ForecastHorizon, forecastAsOf = scenario.resetTime): ForecastData {
  const data = forecastFixtures[horizon];
  return { ...data, forecastAsOf, forecastTargetTime: getForecastTargetTime(forecastAsOf, horizon), series: { ...data.series, labels: forecastLabels(horizon, forecastAsOf) } };
}
export function selectForecastKpis(horizon: ForecastHorizon, forecastAsOf = scenario.resetTime) { const data = selectForecastForHorizon(horizon, forecastAsOf); return { ...data, avoidableOversupplyMw: selectAvoidableOversupply(data) }; }
export function selectBuildingForecasts(horizon: ForecastHorizon, forecastAsOf = scenario.resetTime): BuildingForecastRow[] { return selectForecastForHorizon(horizon, forecastAsOf).buildingForecasts; }
export function selectForecastInsights(horizon: ForecastHorizon, forecastAsOf = scenario.resetTime): ForecastInsight[] { return selectForecastForHorizon(horizon, forecastAsOf).insights; }
export function selectDistributionBins(horizon: ForecastHorizon, forecastAsOf = scenario.resetTime): DistributionBin[] { return selectForecastForHorizon(horizon, forecastAsOf).distributionBins; }
export function selectComplianceRate(items = buildings): number { return items.filter((b) => b.indoorTemperatureC >= 18).length / items.length; }
export function selectComfortRate(items = buildings): number { return items.filter((b) => b.indoorTemperatureC >= 20 && b.indoorTemperatureC <= 22).length / items.length; }
export function selectOverheatingRate(items = buildings): number { return items.filter((b) => b.indoorTemperatureC > 23).length / items.length; }
export function selectUnderheatingRate(items = buildings): number { return items.filter((b) => b.indoorTemperatureC < 18).length / items.length; }
export function selectAvoidableOversupply(data: ForecastData = forecastFixtures[6]): number { return Math.max(0, data.plannedHeatSupplyMw - data.requiredHeatLoadMw); }
export function selectTemperaturePercentiles(items = buildings): { p10: number; p50: number; p90: number; spread: number } { const values = items.map((b) => b.indoorTemperatureC).sort((a, b) => a - b); const percentile = (p: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))]; const p10 = percentile(.1), p50 = percentile(.5), p90 = percentile(.9); return { p10, p50, p90, spread: p90 - p10 }; }
export function selectResultsComparison(): ResultsComparison { return resultComparison; }
