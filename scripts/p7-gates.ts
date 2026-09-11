import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  applicationStatus,
  deriveCustomerStatus,
  getGuidedRuntime,
} from '../src/p7-provider';

type Gate = { gate: string; description: string; status: 'PASS' | 'FAIL'; measured: unknown };
const gates: Gate[] = [];
const gate = (id: string, description: string, measured: unknown, passes: boolean) =>
  gates.push({ gate: id, description, status: passes ? 'PASS' : 'FAIL', measured });
const runtime = getGuidedRuntime();
const app = readFileSync('src/App.tsx', 'utf8');
const provider = readFileSync('src/p7-provider.ts', 'utf8');
const copy = readFileSync('src/i18n.ts', 'utf8');

let integrity = '';
try { integrity = execFileSync(process.execPath, ['scripts/verify-p0-p6-integrity.mjs'], { encoding: 'utf8' }).trim(); }
catch (error) { integrity = String(error); }
gate('P7-P1', 'P0-P6 integrity verification passes', integrity, integrity.startsWith('P0-P6 integrity: PASS'));
gate('P7-P2', 'P6 Formal MPC is the final AI Optimised provider', runtime.providers.optimisation, runtime.providers.optimisation.version === 'Formal MPC v1' && app.includes("from './p7-provider'"));
gate('P7-P3', 'P4 Preview is not the active final provider', runtime.legacyPreview, !app.includes("from './p4-provider'") && runtime.legacyPreview.role.includes('Engineering Benchmark'));
gate('P7-P4', 'No frontend hard-coded engineering result on active customer path', { sharedPayload: 'src/p7-runtime-data.json', engineeringCalculators: [] }, !/calculateRequiredHeat|calculateThermal|calculateObjective|calculateFallback|calculateSafety/.test(app));
gate('P7-P5', 'P4/P5/P6 versions are explicit', runtime.providers, ['P4 Predictor v1', 'P5 Thermal Model v1', 'Formal MPC v1'].every((version) => JSON.stringify(runtime.providers).includes(version)));
gate('P7-P6', 'Simulation/Predict/Optimise timestamps and state are compatible', { simulationTime: runtime.simulationTime, forecastAsOf: runtime.forecastAsOf, recommendationCreatedAt: runtime.recommendationCreatedAt, recommendationEffectiveAt: runtime.recommendationEffectiveAt }, runtime.simulationTime === runtime.forecastAsOf && runtime.optimisation.status.forecastAsOf === runtime.forecastAsOf && runtime.recommendationEffectiveAt > runtime.recommendationCreatedAt);

const rapid = deriveCustomerStatus(runtime.statusScenarios.rapidOptimal);
const cold = deriveCustomerStatus(runtime.statusScenarios.coldVerifiedFallback);
const near18 = deriveCustomerStatus(runtime.statusScenarios.near18Infeasible);
gate('P7-S1', 'Optimal + Verified displays correctly', rapid, rapid.optimisation === 'MPC_OPTIMAL' && rapid.verification === 'VERIFIED_IN_DIGITAL_TWIN' && rapid.safety === 'NORMAL_VERIFIED');
gate('P7-S2', 'Fallback + Verified displays correctly', cold, cold.verification === 'VERIFIED_FALLBACK' && cold.fallback === 'VERIFIED_FALLBACK_ACTIVE' && cold.safety === 'VERIFIED_FALLBACK');
gate('P7-S3', 'Infeasible + Safety Not Guaranteed displays correctly', near18, near18.optimisation === 'CONSTRAINT_INFEASIBLE' && near18.fallback === 'FALLBACK_ACTIVE' && near18.safety === 'SAFETY_NOT_GUARANTEED');
gate('P7-S4', 'Solver user_limit does not appear as MPC success', { raw: runtime.statusScenarios.coldVerifiedFallback.optimisationStatus, derived: cold.optimisation }, runtime.statusScenarios.coldVerifiedFallback.optimisationStatus === 'user_limit' && cold.optimisation === 'SOLVER_LIMIT_REACHED');
gate('P7-S5', 'Fallback does not appear as optimal MPC', cold, cold.optimisation !== 'MPC_OPTIMAL');
gate('P7-S6', 'Application state is separate from optimisation state', { optimisationHasApplied: Object.hasOwn(runtime.optimisation, 'applied'), applicationStates: ['NOT_APPLIED', 'APPLIED', 'SUPERSEDED', 'FAILED_TO_APPLY'] }, !Object.hasOwn(runtime.optimisation, 'applied'));
gate('P7-S7', 'Advisory never auto-applies', applicationStatus('advisory', rapid), applicationStatus('advisory', rapid) === 'NOT_APPLIED');
gate('P7-S8', 'Optimised auto-applies only accepted verified action/fallback', { optimal: applicationStatus('optimised', rapid), verifiedFallback: applicationStatus('optimised', cold), unsafeFallback: applicationStatus('optimised', near18) }, applicationStatus('optimised', rapid) === 'APPLIED' && applicationStatus('optimised', cold) === 'APPLIED' && applicationStatus('optimised', near18) === 'FAILED_TO_APPLY');

gate('P7-U1', 'NOW to VERIFY journey remains understandable', ['journeyNow', 'journeyForecast', 'journeyPredict', 'journeyOptimise', 'journeyVerify'], ['journeyNow', 'journeyForecast', 'journeyPredict', 'journeyOptimise', 'journeyVerify'].every((key) => app.includes(`t('${key}')`)));
gate('P7-U2', 'Forecast separates P4 load and P5 thermal prediction', { p4: runtime.predictions.map((item) => item.horizonHours), p5: runtime.thermalPrediction.horizonsHours }, app.includes('guidedRuntime.predictions.map') && app.includes('guidedRuntime.thermalPrediction.points'));
gate('P7-U3', 'Simulation exposes final MPC status and applied controls', { statusDimensions: 5, trajectoryIntervals: runtime.optimisation.trajectories.supplyC.length }, app.includes('function MpcStatus') && app.includes("t('currentAppliedControls')") && app.includes('guidedRuntime.optimisation.trajectories'));
gate('P7-U4', 'Results supports Traditional / Preview / MPC', Object.keys(runtime.comparison), ['traditional', 'preview', 'mpc'].every((key) => Object.hasOwn(runtime.comparison, key)) && app.includes('comparison.mpc'));
gate('P7-U5', 'Settings reflects final P4/P5/P6 configuration', runtime.configuration, runtime.configuration.thermalPredictionHorizonsHours.join(',') === '0.5,1,2,3,6' && runtime.configuration.mpcHorizonHours === 3 && runtime.configuration.controlIntervalMinutes === 30);
gate('P7-U6', 'Predicted / optimised / verified / applied / realised are distinct', ['predicted', 'optimised', 'verified', 'applied', 'realised'], ['predictedState', 'optimisedState', 'verifiedState', 'appliedState', 'realisedState'].every((key) => copy.includes(key)));
const localeBlocks = [...copy.matchAll(/\b(en|zh):\s*\{([\s\S]*?)\n\s*\},(?=\n\s*(?:zh:|\};))/g)];
const localeKeys = localeBlocks.map((match) => [...match[2].matchAll(/^\s{4}([A-Za-z0-9_]+):/gm)].map((entry) => entry[1]).sort());
gate('P7-U7', 'EN/ZH parity passes', { locales: localeBlocks.map((match) => match[1]), keyCount: localeKeys[0]?.length }, localeKeys.length === 2 && JSON.stringify(localeKeys[0]) === JSON.stringify(localeKeys[1]));
const forbiddenClaims = ['Production MPC', 'Autonomous Production Control', 'Real-world Savings', 'Guaranteed Real-site Safety'];
gate('P7-U8', 'No misleading real-site validation claim appears', { forbiddenClaims }, forbiddenClaims.every((claim) => !app.includes(claim) && !copy.includes(claim)));

const failed = gates.filter((item) => item.status === 'FAIL').length;
const result = {
  phase: 'P7', generatedAt: new Date().toISOString(), passed: gates.length - failed,
  failed, skipped: 0, total: gates.length, gates,
};
writeFileSync('p7_gate_results.json', JSON.stringify(result, null, 2) + '\n');
console.log(`P7 gates: ${result.passed}/${result.total} passed, ${failed} failed, 0 skipped`);
if (failed) process.exitCode = 1;
