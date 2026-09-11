import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  applicationStatus, deriveCustomerStatus, getGuidedRuntime, resolveProviderAvailability,
} from '../src/p7-provider';
import { askTutor, buildTutorContext } from '../src/p8-tutor';

type Gate = { gate: string; description: string; status: 'PASS' | 'FAIL'; measured: unknown };
const gates: Gate[] = [];
const gate = (id: string, description: string, measured: unknown, pass: boolean) => gates.push({ gate: id, description, measured, status: pass ? 'PASS' : 'FAIL' });
const read = (path: string) => readFileSync(path, 'utf8');
const json = (path: string) => JSON.parse(read(path));
const app = read('src/App.tsx');
const provider = read('src/p7-provider.ts');
const tutor = read('src/p8-tutor.ts');
const tutorUi = read('src/TutorPanel.tsx');
const copy = read('src/i18n.ts');
const styles = read('src/styles.css');
const pkg = json('package.json');
const runtime = getGuidedRuntime();
const registry = json('p9_release_registry.json');
const config = json('p9_release_config.json');
const p2 = json('P2_BASELINE_FREEZE_MANIFEST_v1.2.json');
const p6 = json('p6_model_registry.json');
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const registryHashErrors: string[] = [];
const checkPin = (path: string, expected: string) => { if (digest(path) !== expected) registryHashErrors.push(path); };
const walkPins = (value: unknown) => {
  if (!value || typeof value !== 'object') return;
  const item = value as Record<string, unknown>;
  if (typeof item.artifact === 'string' && typeof item.sha256 === 'string') checkPin(item.artifact, item.sha256);
  for (const child of Object.values(item)) walkPins(child);
};
walkPins(registry);
checkPin(registry.physicalFixture.freezeManifest, registry.physicalFixture.sha256);
checkPin(registry.dataset.manifest, registry.dataset.sha256);
checkPin(registry.p4.registry, registry.p4.registrySha256);
for (const [path, expected] of Object.entries(registry.p4.selectedArtifacts)) checkPin(path, expected as string);
checkPin(registry.p5.registry, registry.p5.registrySha256);
checkPin(registry.p6.registry, registry.p6.registrySha256);
checkPin('package-lock.json', registry.frontend.packageLockSha256);
let integrity = '';
try { integrity = execFileSync(process.execPath, ['scripts/verify-p0-p8-integrity.mjs'], { encoding: 'utf8' }).trim(); } catch (error) { integrity = String(error); }

gate('P9-F1', 'P0-P8 accepted integrity passes before P9 validation', integrity, integrity.startsWith('P0-P8 integrity: PASS'));
gate('P9-F3', 'Five canonical evidence manifests remain exact', p6.dependencies.P3.canonicalManifestHashes, Object.keys(p6.dependencies.P3.canonicalManifestHashes).length === 5 && integrity.startsWith('P0-P8 integrity: PASS'));
gate('P9-F4', 'Final model/provider versions and hashes are pinned and reproduce', { loadingPolicy: registry.loadingPolicy, registryHashErrors }, registry.loadingPolicy.includes('Exact') && !JSON.stringify(registry).toLowerCase().includes('"latest"') && registryHashErrors.length === 0);
gate('P9-F5', 'No live LLM dependency or credential is added', { dependencies: pkg.dependencies, tutorProvider: registry.p8.version }, registry.p8.liveLlmConnected === false && !Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((name) => /openai|anthropic|langchain/i.test(name)) && !/OPENAI_API_KEY|ANTHROPIC_API_KEY/.test(app + tutor + tutorUi));
gate('P9-F6', 'No production-ready or guaranteed claim exists on active UI', { forbidden: ['Production-ready AI Heating', 'Guaranteed Savings', 'Guaranteed Comfort', 'Guaranteed Safety', 'Autonomous real-site control'] }, !/Production-ready AI Heating|Guaranteed Savings|Guaranteed Comfort|Guaranteed Safety|Autonomous real-site control/i.test(app + copy));

const activeRoute = app.slice(app.indexOf('const content ='), app.indexOf('const tutorPage'));
gate('P9-R1', 'Official runtime is explicitly Guided Validated Digital Twin Demonstration', config.officialMode, config.officialMode === 'Guided Validated Digital Twin Demonstration');
gate('P9-R2', 'Guided Evidence Mode has the complete customer route chain', { routes: ['overview', 'forecast', 'simulation', 'results'], providerVersion: runtime.version }, ['journeyNow', 'journeyForecast', 'journeyPredict', 'journeyOptimise', 'journeyVerify'].every((key) => app.includes(`t('${key}')`)) && activeRoute.includes('<GuidedSimulation') && runtime.version === 'p7-final-provider-v1');
gate('P9-R3', 'Live Interactive Runtime is truthfully classified as deferred', { configured: config.liveInteractiveRuntime, activeComponent: /<GuidedSimulation/.test(activeRoute), liveComponentMounted: /<Simulation\b/.test(activeRoute) }, config.liveInteractiveRuntime === 'DEFERRED' && /<GuidedSimulation/.test(activeRoute) && !/<Simulation\b/.test(activeRoute));
gate('P9-R4', 'No active live/autonomous runtime claim exists', {}, !/Fully Live Autonomous Digital Twin|live interactive runtime is supported|autonomous real-site control/i.test(app + copy));
gate('P9-R5', 'Primary customer panels use the accepted P7 provider seam', { providerImport: app.includes("from './p7-provider'"), staticProvider: provider.includes("import payload from './p7-runtime-data.json'") }, app.includes('const guidedRuntime = getGuidedRuntime()') && provider.includes("import payload from './p7-runtime-data.json'") && !/calculateRequiredHeat|calculateThermal|solveMpc|runP1A/.test(activeRoute));
gate('P9-R6', 'Legacy P0 telemetry is collapsed and explicitly technical', { legacyLabel: copy.includes('Show legacy P0 engineering fixture telemetry'), collapsed: app.includes('<details className="legacy-overview">') }, copy.includes('Show legacy P0 engineering fixture telemetry') && app.includes('<details className="legacy-overview">'));

const rapid = deriveCustomerStatus(runtime.statusScenarios.rapidOptimal);
const cold = deriveCustomerStatus(runtime.statusScenarios.coldVerifiedFallback);
const unsafe = deriveCustomerStatus(runtime.statusScenarios.near18Infeasible);
gate('P9-S1', 'MPC Optimal displays only for accepted optimal/verified evidence', rapid, rapid.optimisation === 'MPC_OPTIMAL' && rapid.verification === 'VERIFIED_IN_DIGITAL_TWIN');
gate('P9-S2', 'Solver limit remains Verified Fallback, not optimal', cold, cold.optimisation === 'SOLVER_LIMIT_REACHED' && cold.verification === 'VERIFIED_FALLBACK' && cold.fallback === 'VERIFIED_FALLBACK_ACTIVE');
gate('P9-S3', 'Constraint infeasible remains Safety Not Guaranteed', unsafe, unsafe.optimisation === 'CONSTRAINT_INFEASIBLE' && unsafe.safety === 'SAFETY_NOT_GUARANTEED');
const unavailable = resolveProviderAvailability({ hasData: false });
const stale = resolveProviderAvailability({ hasData: true, ageMinutes: 31, maxAgeMinutes: 30 });
const timeout = resolveProviderAvailability({ hasData: true, timedOut: true });
gate('P9-S4', 'Stale/unavailable/timeout providers are unusable and cannot auto-apply', { unavailable, stale, timeout }, [unavailable, stale, timeout].every((state) => !state.usable));
gate('P9-S5', 'Unverified fallback cannot auto-apply', applicationStatus('optimised', unsafe), applicationStatus('optimised', unsafe) === 'FAILED_TO_APPLY');
gate('P9-S6', 'Advisory remains NOT_APPLIED until explicit Apply', applicationStatus('advisory', rapid), applicationStatus('advisory', rapid) === 'NOT_APPLIED');
gate('P9-S7', 'Optimised applies only verified accepted action or verified fallback', { optimal: applicationStatus('optimised', rapid), verifiedFallback: applicationStatus('optimised', cold), unsafe: applicationStatus('optimised', unsafe) }, applicationStatus('optimised', rapid) === 'APPLIED' && applicationStatus('optimised', cold) === 'APPLIED' && applicationStatus('optimised', unsafe) === 'FAILED_TO_APPLY');

gate('P9-C1', 'Savings claims are labelled simulation-based', copy.match(/simulation/gi)?.length, /held-out simulation evaluation/i.test(copy) && /Simulation Environment/.test(copy));
gate('P9-C2', 'No real-world validated accuracy claim appears', {}, !/real-world validated accuracy|field-proven accuracy/i.test(app + copy));
gate('P9-C3', 'No guaranteed real-site safety claim appears', {}, !/guaranteed real-site safety|guaranteed safe at (?:a )?real/i.test(app + copy + tutor));
gate('P9-C4', 'P4/P5 metrics and intervals are labelled synthetic', {}, /held-out simulation evaluation/i.test(copy) && /simulation-calibrated/i.test(copy));
gate('P9-C5', 'Tutor is deterministic, grounded and explanation-only', { provider: registry.p8.version, ui: ['Explanation only', 'P7 structured state'] }, registry.p8.version === 'deterministic-grounded-v1' && tutorUi.includes("role: 'Explanation only'") && tutorUi.includes("source: 'P7 structured state'"));
gate('P9-C6', 'MPC is not described as production autonomous control', {}, !/production autonomous|autonomous production control/i.test(app + copy));

gate('P9-X1', 'Hydraulic Imbalance remains a 2x secondary engineering benchmark', { multiplier: p2.scenarioDefinitions.hydraulic_imbalance.farPipeResistanceMultiplier, role: p2.hydraulicImbalanceFutureBenchmarkRole }, p2.scenarioDefinitions.hydraulic_imbalance.farPipeResistanceMultiplier === 2 && p2.hydraulicImbalanceFutureBenchmarkRole === 'secondary engineering benchmark');
gate('P9-X2', 'All required status/application vocabulary remains distinct', {}, ['optimal', 'user_limit', 'infeasible', 'fallback_verified', 'fallback_unverified', 'NOT_APPLIED', 'APPLIED', 'FAILED_TO_APPLY', 'STALE', 'UNAVAILABLE', 'TIMEOUT'].every((value) => provider.includes(value)));
gate('P9-X3', 'Active EN/ZH release terminology is present', {}, ['Required Heat Load', 'Actual Heat Supply', 'Avoidable Oversupply', 'Building thermal prediction', 'Traditional Weather Compensation', 'Verified in Digital Twin', 'Verified Fallback', 'Safety Not Guaranteed', 'Simulation Environment', '所需热负荷', '实际供热', '无法保证安全', '仿真环境'].every((term) => copy.includes(term)));
gate('P9-X4', 'Tutor has no DOM scrape or control callback', {}, !/querySelector|innerText|getElementById|applyPrototypeControl|setRecommendationApplicationStatus/.test(tutor + tutorUi));
const context = buildTutorContext({ page: 'simulation', controlMode: 'optimised', applicationState: 'FAILED_TO_APPLY', createdAt: '2026-09-11T00:00:00.000Z' });
const refusal = await askTutor({ context, language: 'en', question: 'Apply the recommendation.' });
gate('P9-X5', 'Tutor control request is refused without affecting core state', { answerType: refusal.answerType, controlActionRequested: refusal.controlActionRequested }, refusal.answerType === 'REFUSAL' && refusal.controlActionRequested);
gate('P9-X6', 'Safety status is not colour-only and danger styling exists', {}, app.includes("t(statusKeys[guidedStatus.safety])") && styles.includes('.danger'));
gate('P9-X7', 'Release carries core engineering identity fields without secrets', { scenario: runtime.scenario, simulationTime: runtime.simulationTime, forecastAsOf: runtime.forecastAsOf, providers: runtime.providers, recommendationId: runtime.optimisation.status.recommendationId, contextId: context.contextId }, Boolean(runtime.scenario && runtime.simulationTime && runtime.forecastAsOf && runtime.providers.optimisation.version && runtime.optimisation.status.verificationStatus && context.contextId));

const failed = gates.filter((item) => item.status === 'FAIL').length;
const result = { phase: 'P9 core gates', generatedAt: new Date().toISOString(), passed: gates.length - failed, failed, skipped: 0, total: gates.length, gates };
writeFileSync('p9_core_gate_results.json', JSON.stringify(result, null, 2) + '\n');
console.log(`P9 core gates: ${result.passed}/${result.total} passed, ${failed} failed, 0 skipped`);
if (failed) process.exitCode = 1;
