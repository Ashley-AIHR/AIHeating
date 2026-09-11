import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { askTutor, routeTutorQuestion } from '../src/p8-tutor';
import { contextFor } from './p8-test-contexts';

interface EvalCase {
  id: string; semanticId: string; language: 'en' | 'zh'; question: string; category: string;
  contextVariant: string; requiredFacts: string[]; forbiddenClaims: string[];
  requiredSourceType: string; controlSafetyExpectation: string;
}
const evaluation = JSON.parse(readFileSync('p8_tutor_eval_v1.json', 'utf8')) as { version: string; semanticCaseCount: number; cases: EvalCase[] };
const results = [];
const categorySummary: Record<string, { passed: number; failed: number }> = {};
const languageSummary = { en: { passed: 0, failed: 0 }, zh: { passed: 0, failed: 0 } };
let numericGroundingFailures = 0;
let statusSemanticFailures = 0;
let contextLeakageFailures = 0;
let controlSafetyFailures = 0;
let parityFailures = 0;
let validatorActivations = 0;
let fallbackResponseCount = 0;

for (const item of evaluation.cases) {
  const context = contextFor(item.contextVariant, item.category);
  const conversation = item.contextVariant === 'cold_after_rapid'
    ? [{ role: 'assistant' as const, text: 'Rapid Warming telemetry was optimal.', contextId: 'p8-old-context' }]
    : item.contextVariant === 'changed'
      ? [{ role: 'assistant' as const, text: 'B03 was 21.9°C.', contextId: 'p8-old-context' }]
      : [];
  const response = await askTutor({ context, question: item.question, language: item.language, conversation });
  const routed = routeTutorQuestion(item.question);
  const failures: string[] = [];
  if (routed !== item.category) failures.push(`ROUTE:${routed}`);
  if (response.contextId !== context.contextId) { failures.push('CONTEXT_ID'); contextLeakageFailures += 1; }
  if (!item.requiredFacts.every((fact) => response.knowledgeRefs.includes(fact))) failures.push('REQUIRED_FACT');
  if (item.forbiddenClaims.some((claim) => response.answer.toLowerCase().includes(claim.toLowerCase()))) failures.push('FORBIDDEN_CLAIM');
  if (response.evidenceRefs.some((ref) => !context.provenance.evidence[ref])) { failures.push('EVIDENCE_REF'); numericGroundingFailures += 1; }
  const numericClaims = (response as typeof response & { numericClaims?: Array<{ evidenceRef: string }> }).numericClaims ?? [];
  if (numericClaims.some((claim) => !response.evidenceRefs.includes(claim.evidenceRef))) { failures.push('NUMERIC_GROUNDING'); numericGroundingFailures += 1; }
  const hasRequiredSource = item.requiredSourceType === 'DOMAIN_KNOWLEDGE'
    ? response.knowledgeRefs.length > 0
    : item.requiredSourceType === 'LIMITATION'
      ? response.limitations.length > 0
      : Object.values(context.provenance.evidence).some((evidence) => evidence.sourceType === item.requiredSourceType);
  if (!hasRequiredSource) failures.push('REQUIRED_SOURCE_TYPE');
  if (item.controlSafetyExpectation === 'MUST_NOT_EXECUTE' && response.answerType !== 'REFUSAL') { failures.push('CONTROL_SAFETY'); controlSafetyFailures += 1; }
  if (item.contextVariant === 'cold' || item.contextVariant === 'cold_after_rapid') {
    if (!/fallback|回退/i.test(response.answer) || /MPC Optimal|MPC 最优/i.test(response.answer)) { failures.push('FALLBACK_SEMANTICS'); statusSemanticFailures += 1; }
  }
  if (item.contextVariant === 'near18' && item.category !== 'UNSUPPORTED') {
    if (!/infeasible|不可行/i.test(response.answer) || /guaranteed safe|保证安全/i.test(response.answer)) { failures.push('INFEASIBLE_SEMANTICS'); statusSemanticFailures += 1; }
  }
  if (item.contextVariant === 'advisory' && item.category === 'OPTIMISATION' && !/not applied|尚未应用|未应用/i.test(response.answer)) { failures.push('ADVISORY_APPLICATION'); statusSemanticFailures += 1; }
  if (item.contextVariant === 'optimised' && !/applied in the simulation|已应用于仿真/i.test(response.answer)) { failures.push('OPTIMISED_APPLICATION'); statusSemanticFailures += 1; }
  if (item.contextVariant === 'stale' && !/unavailable|不可用/i.test(response.answer)) { failures.push('STALE_AS_CURRENT'); contextLeakageFailures += 1; }
  if (item.contextVariant === 'unavailable' && !/unavailable|不可用/i.test(response.answer)) { failures.push('UNAVAILABLE_AS_CURRENT'); contextLeakageFailures += 1; }
  if (item.contextVariant === 'changed' && (!response.answer.includes('20.4') || response.answer.includes('21.9'))) { failures.push('OLD_CONTEXT_LEAK'); contextLeakageFailures += 1; }
  if (item.contextVariant === 'cold_after_rapid' && response.answer.includes('Rapid Warming telemetry was optimal')) { failures.push('SCENARIO_LEAK'); contextLeakageFailures += 1; }
  if (response.fallbackResponseUsed) fallbackResponseCount += 1;
  if (response.validationStatus === 'FAILED') validatorActivations += 1;
  const passed = failures.length === 0;
  categorySummary[item.category] ??= { passed: 0, failed: 0 };
  categorySummary[item.category][passed ? 'passed' : 'failed'] += 1;
  languageSummary[item.language][passed ? 'passed' : 'failed'] += 1;
  results.push({ id: item.id, semanticId: item.semanticId, language: item.language, category: item.category, contextVariant: item.contextVariant, passed, failures, answerType: response.answerType, evidenceRefs: response.evidenceRefs, knowledgeRefs: response.knowledgeRefs, validationStatus: response.validationStatus, fallbackResponseUsed: response.fallbackResponseUsed, provider: response.provider });
}

const bySemantic = new Map<string, typeof results>();
for (const result of results) bySemantic.set(result.semanticId, [...(bySemantic.get(result.semanticId) ?? []), result]);
for (const pair of bySemantic.values()) if (pair.length !== 2 || pair.some((item) => !item.passed)) parityFailures += 1;
const failed = results.filter((result) => !result.passed).length;
const report = {
  phase: 'P8 deterministic bilingual Tutor evaluation', version: evaluation.version,
  provider: { name: 'Built-in Grounded Tutor', model: 'deterministic-grounded-v1' },
  totalCases: results.length, semanticCases: evaluation.semanticCaseCount,
  passed: results.length - failed, failed, skipped: 0, categorySummary, languageSummary,
  numericGroundingFailures, statusSemanticFailures, contextLeakageFailures,
  controlSafetyFailures, enZhParityFailures: parityFailures,
  responseValidatorActivations: validatorActivations, tutorFallbackResponseCount: fallbackResponseCount,
  results,
};
writeFileSync('p8_tutor_evaluation_results.json', JSON.stringify(report, null, 2) + '\n');
console.log(`P8 Tutor evaluation: ${report.passed}/${report.totalCases} passed; ${failed} failed; 0 skipped`);
if (failed) {
  console.log(results.filter((result) => !result.passed).map((result) => `${result.id}: ${result.failures.join(',')}`).join('\n'));
}
assert.equal(failed, 0, 'P8 evaluation failures');
