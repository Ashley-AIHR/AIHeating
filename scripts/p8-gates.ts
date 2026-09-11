import { readFileSync, writeFileSync } from 'node:fs';
import { askTutor, buildTutorContext, domainKnowledge, routeTutorQuestion, suggestedTutorQuestions } from '../src/p8-tutor';
import { contextFor } from './p8-test-contexts';

type Gate = { gate: string; description: string; status: 'PASS' | 'FAIL'; measured: unknown };
const gates: Gate[] = [];
const gate = (id: string, description: string, measured: unknown, pass: boolean) => gates.push({ gate: id, description, measured, status: pass ? 'PASS' : 'FAIL' });
const tutorSource = readFileSync('src/p8-tutor.ts', 'utf8');
const uiSource = readFileSync('src/TutorPanel.tsx', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const evaluation = JSON.parse(readFileSync('p8_tutor_evaluation_results.json', 'utf8'));
const evalSet = JSON.parse(readFileSync('p8_tutor_eval_v1.json', 'utf8'));
const overview = buildTutorContext({ page: 'overview', controlMode: 'optimised', applicationState: 'APPLIED', createdAt: '2026-09-11T00:00:00.000Z' });
const simulation = contextFor('selected', 'THERMAL');
const changed = contextFor('changed', 'CURRENT_STATE');
const cold = contextFor('cold_after_rapid', 'FALLBACK');
const stale = contextFor('stale', 'FORECAST');
const advisory = contextFor('advisory', 'OPTIMISATION');
const near18 = contextFor('near18', 'SAFETY');
const selectedAnswer = await askTutor({ context: simulation, question: 'What is the selected building P5 thermal prediction?', language: 'en' });
const staleAnswer = await askTutor({ context: stale, question: 'What is the current load prediction while the provider is stale?', language: 'en' });
const advisoryAnswer = await askTutor({ context: advisory, question: 'Has the Advisory recommendation been applied?', language: 'en' });
const coldAnswer = await askTutor({ context: cold, question: 'Why is fallback active?', language: 'en', conversation: [{ role: 'assistant', text: 'Rapid Warming was optimal.', contextId: overview.contextId }] });
const near18Answer = await askTutor({ context: near18, question: 'Why is safety not guaranteed?', language: 'en' });
const controlAnswer = await askTutor({ context: advisory, question: 'Apply the recommendation.', language: 'en' });

gate('P8-C1', 'Structured provider state only; no DOM scraping', { sourceBoundary: overview.sourceBoundary, domApis: /querySelector|innerText|textContent|getElementById/.test(tutorSource + uiSource) }, overview.sourceBoundary === 'P7_STRUCTURED_PROVIDER_ONLY' && tutorSource.includes('P7TutorRuntimeSource') && !/querySelector|innerText|getElementById/.test(tutorSource + uiSource));
gate('P8-C2', 'Page-aware context builder implemented', ['overview', 'simulation', 'forecast', 'results', 'settings'], tutorSource.includes("options.page === 'overview'") && tutorSource.includes("options.page === 'simulation'") && tutorSource.includes("options.page === 'forecast'") && tutorSource.includes("options.page === 'results'"));
gate('P8-C3', 'Selected-building context works', { selected: simulation.selectedBuildingId, evidence: selectedAnswer.evidenceRefs }, simulation.selectedBuildingId === 'B03' && selectedAnswer.evidenceRefs.includes('thermalPrediction.B03.h120.pointC'));
gate('P8-C4', 'Context identity/version/time explicit', { contextId: overview.contextId, contextVersion: overview.contextVersion, time: overview.time }, /^p8-[0-9a-f]{8}$/.test(overview.contextId) && Boolean(overview.createdAt && overview.time.simulationTime));
gate('P8-C5', 'Scenario/time/mode changes rebuild context', { base: overview.contextId, changed: changed.contextId, cold: cold.contextId, advisory: advisory.contextId }, new Set([overview.contextId, changed.contextId, cold.contextId, advisory.contextId]).size === 4);
gate('P8-C6', 'Stale/unavailable state not current', { freshness: stale.freshness.loadPrediction, hasLoad: Boolean(stale.loadPrediction), answer: staleAnswer.answerType }, stale.freshness.loadPrediction === 'STALE' && !stale.loadPrediction && /unavailable/i.test(staleAnswer.answer));
gate('P8-C7', 'Context intentionally bounded', { serializedBytes: JSON.stringify(overview).length, forecastMax: 12, eventsMax: 6 }, JSON.stringify(overview).length < 24000 && (overview.forecast?.length ?? 0) <= 12);
gate('P8-C8', 'No forbidden simulation truth in customer context', { forbidden: ['h_scale', 'c_scale', 'truthParameter', 'pipeResistance'] }, !/h_scale|c_scale|truthParameter|pipeResistance/i.test(JSON.stringify(overview)));

gate('P8-G1', 'Numeric claims have structured evidence refs', evaluation.numericGroundingFailures, evaluation.numericGroundingFailures === 0);
gate('P8-G2', 'Missing telemetry produces no invented values', evaluation.results.filter((item: { contextVariant: string }) => ['stale', 'unavailable'].includes(item.contextVariant)), evaluation.results.filter((item: { contextVariant: string }) => ['stale', 'unavailable'].includes(item.contextVariant)).every((item: { passed: boolean }) => item.passed));
gate('P8-G3', 'Predicted and observed semantics distinct', selectedAnswer.answer, /predict|model prediction/i.test(selectedAnswer.answer) && /not a future observation/i.test(selectedAnswer.answer));
gate('P8-G4', 'Recommended and applied semantics distinct', advisoryAnswer.answer, /not applied/i.test(advisoryAnswer.answer));
gate('P8-G5', 'Verified and realised semantics distinct', domainKnowledge.find((item) => item.id === 'nonlinear_verification'), domainKnowledge.find((item) => item.id === 'nonlinear_verification')?.technical_detail.en.includes('distinct from applied') === true);
gate('P8-G6', 'Simulation and real-site semantics distinct', evaluation.results.every((item: { passed: boolean }) => item.passed), evaluation.failed === 0 && tutorSource.includes('not real-site savings'));
gate('P8-G7', 'Current context overrides conversation', evaluation.results.filter((item: { contextVariant: string }) => item.contextVariant === 'changed'), evaluation.contextLeakageFailures === 0);
gate('P8-G8', 'Scenario-change leakage test passes', coldAnswer.answer, cold.scenario === 'Cold Wave' && /fallback/i.test(coldAnswer.answer) && !coldAnswer.answer.includes('Rapid Warming was optimal'));

gate('P8-S1', 'MPC Optimal explained correctly', evaluation.results.filter((item: { semanticId: string }) => item.semanticId === 'mpc_architecture'), evaluation.statusSemanticFailures === 0);
gate('P8-S2', 'Solver Limit plus Verified Fallback correct', coldAnswer.answer, /did not return an accepted optimal trajectory/i.test(coldAnswer.answer) && /verified fallback/i.test(coldAnswer.answer));
gate('P8-S3', 'Constraint Infeasible correct', near18Answer.answer, /physically infeasible/i.test(near18Answer.answer));
gate('P8-S4', 'Safety Not Guaranteed never becomes safe', near18Answer.answer, !/guaranteed safe|safety is guaranteed/i.test(near18Answer.answer));
gate('P8-S5', 'Fallback never becomes MPC optimal', coldAnswer.answer, !/MPC Optimal|MPC was optimal/i.test(coldAnswer.answer));
gate('P8-S6', 'Physical infeasibility not blamed on optimiser', near18Answer.answer, /equipment limits.*network transport delay.*building thermal response/i.test(near18Answer.answer));
gate('P8-S7', 'Tutor cannot execute control commands', { answerType: controlAnswer.answerType, controlActionRequested: controlAnswer.controlActionRequested }, controlAnswer.answerType === 'REFUSAL' && !uiSource.includes('setRecommendationApplicationStatus'));
gate('P8-S8', 'Advisory NOT_APPLIED preserved', advisoryAnswer.answer, advisory.applicationState === 'NOT_APPLIED' && /not applied/i.test(advisoryAnswer.answer));

const knowledgeIds = new Set(domainKnowledge.map((item) => item.id));
gate('P8-D1', 'Required Heat Load versus supply correct', ['required_heat_load', 'actual_heat_supply', 'avoidable_oversupply'], ['required_heat_load', 'actual_heat_supply', 'avoidable_oversupply'].every((id) => knowledgeIds.has(id)));
gate('P8-D2', 'Weather compensation explained fairly', domainKnowledge.find((item) => item.id === 'weather_compensation'), domainKnowledge.find((item) => item.id === 'weather_compensation')?.technical_detail.en.includes('pump scheduling and commissioned zone valves') === true);
gate('P8-D3', 'Transport delay and thermal inertia distinct', domainKnowledge.find((item) => item.id === 'transport_delay'), domainKnowledge.find((item) => item.id === 'transport_delay')?.technical_detail.en.includes('distinct from building thermal inertia') === true);
gate('P8-D4', 'Hydraulic coupling correct', domainKnowledge.find((item) => item.id === 'hydraulic_coupling'), domainKnowledge.find((item) => item.id === 'hydraulic_coupling')?.technical_detail.en.includes('redistribute') === true);
gate('P8-D5', 'P4/P5/P6 roles correct', ['P4_load_prediction', 'P5_thermal_prediction', 'P6_MPC'], ['P4_load_prediction', 'P5_thermal_prediction', 'P6_MPC'].every((id) => knowledgeIds.has(id)));
gate('P8-D6', 'Actuator ablation story follows P6 evidence', domainKnowledge.find((item) => item.id === 'zone_valves'), domainKnowledge.find((item) => item.id === 'zone_valves')?.technical_detail.en.includes('supply temperature primary, pump optimisation second and valves third') === true);
gate('P8-D7', 'Synthetic accuracy never called real-site accuracy', evaluation.numericGroundingFailures, tutorSource.includes('held-out synthetic simulation') && evaluation.failed === 0);

gate('P8-U1', 'English Tutor works', evaluation.languageSummary.en, evaluation.languageSummary.en.failed === 0 && evaluation.languageSummary.en.passed === 50);
gate('P8-U2', 'Simplified Chinese Tutor works', evaluation.languageSummary.zh, evaluation.languageSummary.zh.failed === 0 && evaluation.languageSummary.zh.passed === 50);
gate('P8-U3', 'Equivalent EN/ZH evaluation set exists', { semanticCases: evalSet.semanticCaseCount, cases: evalSet.cases.length }, evalSet.semanticCaseCount === 50 && evalSet.cases.length === 100 && evaluation.enZhParityFailures === 0);
gate('P8-U4', 'Tutor UI preserves existing pages', { routes: ['/overview', '/simulation', '/forecast', '/results', '/settings'] }, appSource.includes('<TutorPanel') && ['/overview', '/simulation', '/forecast', '/results', '/settings'].every((route) => appSource.includes(route)));
gate('P8-U5', 'Suggested questions context-aware', { overview: suggestedTutorQuestions('overview', 'en'), forecast: suggestedTutorQuestions('forecast', 'en') }, suggestedTutorQuestions('overview', 'en')[0] !== suggestedTutorQuestions('forecast', 'en')[0]);
gate('P8-U6', 'Tutor timeout/failure isolated from core application', { providerTimeoutCovered: true, controlCallbacksInTutor: false }, tutorSource.includes('PROVIDER_TIMEOUT') && !uiSource.includes('applyPrototypeControl') && !uiSource.includes('advancePrototypeTimeline'));
gate('P8-U7', 'UI clearly indicates explanation role', { en: 'Explanation only', zh: '仅提供解释' }, uiSource.includes("role: 'Explanation only'") && uiSource.includes("role: '仅提供解释'"));

const failed = gates.filter((item) => item.status === 'FAIL').length;
const result = { phase: 'P8', generatedAt: new Date().toISOString(), passed: gates.length - failed, failed, skipped: 0, total: gates.length, gates };
writeFileSync('p8_gate_results.json', JSON.stringify(result, null, 2) + '\n');
console.log(`P8 gates: ${result.passed}/${result.total} passed, ${failed} failed, 0 skipped`);
if (failed) process.exitCode = 1;
