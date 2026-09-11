import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('src/App.tsx');
const copy = read('src/i18n.ts');
const generator = read('physical_core/scripts/write_p4_ui_data.py');
const data = JSON.parse(read('src/p4-preview-data.json'));
const runtime = JSON.parse(read('src/p7-runtime-data.json'));
const section = (name, next) => app.slice(app.indexOf(`function ${name}`), app.indexOf(`function ${next}`));
const simulation = section('GuidedSimulation', 'Simulation');
const settings = section('GuidedSettings', 'App');
const results = section('PreviewResults', 'Results');
const checks = [];
const check = (id, condition, detail) => checks.push([id, condition, detail]);

const manifests = path.join(root, 'artifacts/p3_dataset_v1/official/manifests/benchmark_holdout');
const rapidManifest = fs.readdirSync(manifests)
  .map((name) => JSON.parse(fs.readFileSync(path.join(manifests, name), 'utf8')))
  .find((item) => item.scenarioFamily === 'rapid_warming');
const csvRows = (relativePath) => {
  const text = zlib.gunzipSync(fs.readFileSync(path.join(root, 'artifacts/p3_dataset_v1/official', relativePath))).toString();
  const [header, ...lines] = text.trim().split('\n').map((line) => line.split(','));
  return lines.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index]])));
};
const raw = csvRows(rapidManifest.outputFiles.raw_state).find(
  (row) => row.simulation_time === data.simulationTime,
);
const buildingRows = csvRows(rapidManifest.outputFiles.building_state).filter(
  (row) => row.simulation_time === data.simulationTime,
);
const temperatures = buildingRows.map((row) => Number(row.indoor_temperature_c));
const actualCounts = [
  temperatures.filter((value) => value < 18).length,
  temperatures.filter((value) => value >= 18 && value < 20).length,
  temperatures.filter((value) => value >= 20 && value <= 22).length,
  temperatures.filter((value) => value > 22 && value <= 23).length,
  temperatures.filter((value) => value > 23).length,
];

check('UI-A1', app.includes("path.startsWith('/simulation') ? (\n    <GuidedSimulation") && simulation.includes('guidedRuntime.now') && Number(raw.actual_heat_supply_mw) === runtime.now.heatSupplyMw, 'Simulation route/final provider');
check('UI-A2', !simulation.includes("t('fixture')") && data.labels.source === 'Simulation Engine', 'No active mock label');
check('UI-A3', simulation.includes("recommendationApplicationStatus === 'APPLIED'") && simulation.includes("t('recommendedNotApplied')") && simulation.includes("t('currentAppliedControls')"), 'Control-state semantics');
check('UI-A4', !app.includes('55.00000000000001') && simulation.includes('.toFixed(0)') && simulation.includes('.toFixed(3)'), 'Display precision');
check('UI-A5', runtime.simulationTime === runtime.forecastAsOf && app.includes("navigate('/simulation')") && app.includes("guidedRuntime.simulationTime.slice(11, 16)"), '10:30 snapshot semantics');
check('UI-A6', app.includes('item.horizonMinutes === 120') && app.includes('`+2h · P4 ${t(\'requiredHeat\')}') && app.includes('P5 ${t(\'minimumBuilding\')}'), 'Explicit +2h Overview horizon');
check('UI-A7', app.includes("t('fullDaySimulationResult')"), 'Full-day VERIFY label');
check('UI-A8', runtime.predictions.map((item) => item.horizonHours).join(',') === '1,2,3,6' && app.includes('guidedRuntime.predictions.map'), 'Provider-backed 1/2/3/6h predictions');
check('UI-A9', actualCounts.join(',') === runtime.temperatureDistribution.map((bin) => bin.count).join(',') && results.includes('guidedRuntime.temperatureDistribution') && generator.includes('current_buildings'), 'Simulation-derived distribution');
check('UI-A10', runtime.configuration.predictionHorizonsHours.join(',') === '1,2,3,6' && runtime.configuration.thermalPredictionHorizonsHours.join(',') === '0.5,1,2,3,6' && runtime.configuration.forecastDisplayWindowsHours.join(',') === '6,24,48' && settings.includes("t('predictionHorizons')") && settings.includes("t('thermalPredictionHorizons')") && settings.includes("t('forecastDisplayWindow')"), 'Separate horizon concepts');
check('UI-A11', settings.includes('configuration.objective.weights') && !settings.includes('equipmentLimits') && !settings.includes("t('objectiveCompliance')"), 'Accepted objective source');
check('UI-A12', settings.includes('zone.transportDelayMin.toFixed(1)') && settings.includes("t('flowDependentDelayNote')") && data.zones.some((zone) => ![10, 20, 35].includes(zone.transportDelayMin)), 'Flow-dependent delay semantics');
check('UI-A13', ['PredictiveJourney', 'GuidedSimulation', 'PreviewForecast', 'PreviewResults', 'GuidedSettings'].every((name) => section(name, name === 'GuidedSettings' ? 'App' : name === 'PredictiveJourney' ? 'Overview' : name === 'GuidedSimulation' ? 'Simulation' : name === 'PreviewForecast' ? 'Forecast' : 'Results').includes('guidedRuntime')), 'Shared cross-page provider');
const languageKeys = (start, end) => copy.slice(copy.indexOf(start), copy.indexOf(end)).match(/^    [A-Za-z0-9]+:/gm)?.map((line) => line.trim().slice(0, -1)) ?? [];
const enKeys = languageKeys('  en: {', '  zh: {');
const zhKeys = languageKeys('  zh: {', '\n};');
check('UI-A14', enKeys.length === zhKeys.length && enKeys.every((key) => zhKeys.includes(key)), 'EN/ZH key parity');
const domainUnchanged = execFileSync('git', ['diff', '--exit-code', '--', 'src/domain.ts'], { cwd: root }).length === 0;
check('UI-A15', domainUnchanged && app.includes("const modeKeys: ControlMode[] = ['traditional', 'advisory', 'optimised'];"), 'Frozen P0 domain/modes');

for (const [id, passed, detail] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${id} ${detail}`);
const failed = checks.filter(([, passed]) => !passed);
assert.equal(failed.length, 0, `${failed.length} failed: ${failed.map(([id]) => id).join(', ')}`);
console.log('P4 UI alignment gates: 15 passed, 0 failed, 0 skipped');
