import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const provider = await readFile(new URL('../src/p7-provider.ts', import.meta.url), 'utf8');
const copy = await readFile(new URL('../src/i18n.ts', import.meta.url), 'utf8');
const data = JSON.parse(await readFile(new URL('../src/p7-runtime-data.json', import.meta.url)));
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed += 1; };

check(app.includes("from './p7-provider'") && !app.includes("from './p4-provider'"), 'P7 provider is the active UI seam');
check(['SimulationProvider', 'PredictionProvider', 'ThermalPredictionProvider', 'OptimisationProvider', 'ResultsProvider', 'ScenarioProvider', 'ApplicationStateProvider'].every((name) => provider.includes(`export const ${name}`)), 'All provider seams exist');
check(['journeyNow', 'journeyForecast', 'journeyPredict', 'journeyOptimise', 'journeyVerify'].every((key) => app.includes(`t('${key}')`)), 'Five-step journey remains');
check(app.includes('guidedRuntime.predictions.map') && app.includes('guidedRuntime.thermalPrediction.points'), 'Forecast separates P4 and P5');
check(app.includes("t('currentAppliedControls')"), 'Simulation shows applied controls');
check(app.includes("t('optimisationStatus')") && app.includes("t('verificationStatus')") && app.includes("t('fallbackStatus')") && app.includes("t('safetyStatus')") && app.includes("t('applicationStatus')"), 'Five status dimensions render');
check(app.includes('guidedRuntime.optimisation.trajectories'), 'Simulation renders P6 trajectory');
check(app.includes('comparison.traditional') && app.includes('comparison.preview') && app.includes('comparison.mpc'), 'Results has Traditional/Preview/MPC');
check(app.includes('guidedRuntime.ablation.map') && copy.includes('Supply-temperature adjustment is the primary control lever'), 'Accepted actuator story is provider-backed');
check(app.includes('thermalPredictionHorizonsHours') && app.includes('mpcHorizonHours') && app.includes('controlIntervalMinutes'), 'Settings has P4/P5/P6 configuration');
check(!/Production MPC|Autonomous Production Control|Real-world Savings|Guaranteed Real-site Safety/i.test(app + copy), 'No forbidden production claim');
check(data.providers.loadPrediction.version === 'P4 Predictor v1' && data.providers.thermalPrediction.version === 'P5 Thermal Model v1' && data.providers.optimisation.version === 'Formal MPC v1', 'Friendly versions are explicit');
check(data.predictions.map((item) => item.horizonHours).join(',') === '1,2,3,6', 'P4 horizons are exact');
check(data.thermalPrediction.horizonsHours.join(',') === '0.5,1,2,3,6', 'P5 horizons are exact');
check(data.configuration.mpcHorizonHours === 3 && data.configuration.controlIntervalMinutes === 30, 'MPC horizon/control interval are exact');
check(!Object.hasOwn(data.optimisation, 'applied'), 'Application state is outside optimisation response');
check(['simulationTime', 'forecastAsOf', 'recommendationCreatedAt', 'recommendationEffectiveAt', 'resultEvaluationWindow'].every((key) => Object.hasOwn(data, key)), 'Distinct timestamps are retained');
check(app.match(/guidedRuntime/g)?.length > 25, 'Active pages share one provider snapshot');
check(!/calculateRequiredHeat|calculateThermal|calculateObjective|calculateFallback|calculateSafety/.test(app), 'No frontend engineering calculator');

const dictionaryBlocks = [...copy.matchAll(/\b(en|zh):\s*\{([\s\S]*?)\n\s*\},(?=\n\s*(?:zh:|\};))/g)];
check(dictionaryBlocks.length === 2, 'Both locale dictionaries found');
const keys = dictionaryBlocks.map((match) => [...match[2].matchAll(/^\s{4}([A-Za-z0-9_]+):/gm)].map((entry) => entry[1]).sort());
check(keys[0].length > 0 && JSON.stringify(keys[0]) === JSON.stringify(keys[1]), 'EN/ZH key parity');
check(['MPC Optimal', 'Verified in Digital Twin', 'Verified Fallback', 'Constraint Infeasible', 'Safety Not Guaranteed', 'Solver Limit Reached'].every((value) => copy.includes(value)), 'Required EN status labels exist');
check(['MPC 最优', '已在数字孪生中验证', '已验证回退', '约束不可行', '无法保证安全', '达到求解器上限'].every((value) => copy.includes(value)), 'Required ZH status labels exist');

console.log(`P7 UI/provider invariants: ${passed} passed, 0 failed, 0 skipped`);
