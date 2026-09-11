import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { askTutor, buildTutorContext } from '../src/p8-tutor';
import { deriveCustomerStatus, getGuidedRuntime } from '../src/p7-provider';

const runs = [];
for (let index = 0; index < 5; index += 1) {
  const runtime = getGuidedRuntime();
  const status = deriveCustomerStatus(runtime.optimisation.status);
  const context = buildTutorContext({
    page: 'results', controlMode: 'optimised', selectedBuildingId: 'B03',
    applicationState: 'APPLIED', createdAt: '2026-09-11T00:00:00.000Z',
  });
  const response = await askTutor({
    context, language: 'en', question: 'Why did MPC reduce overheating?',
  });
  const snapshot = {
    scenario: runtime.scenario,
    simulationTime: runtime.simulationTime,
    forecastAsOf: runtime.forecastAsOf,
    recommendationId: runtime.optimisation.status.recommendationId,
    status,
    current: runtime.now,
    prediction: runtime.predictions,
    thermal: runtime.thermalPrediction,
    recommendation: runtime.recommendation,
    comparison: runtime.comparison,
    contextId: context.contextId,
    tutorClass: response.answerType,
    tutorCategory: response.questionCategory,
    tutorValidation: response.validationStatus,
    tutorEvidence: response.evidenceRefs,
    tutorAnswer: response.answer,
  };
  const sha256 = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  runs.push({ run: index + 1, sha256, scenario: runtime.scenario, contextId: context.contextId, recommendationId: runtime.optimisation.status.recommendationId, tutorClass: response.answerType, tutorCategory: response.questionCategory, tutorValidation: response.validationStatus });
}
assert.equal(new Set(runs.map((run) => run.sha256)).size, 1, 'Guided replay drifted');
assert.equal(runs[0].scenario, 'Rapid Daytime Warming');
assert.equal(runs[0].tutorValidation, 'PASSED');
const result = { phase: 'P9 guided deterministic replay', passed: 5, failed: 0, skipped: 0, total: 5, identical: true, runs };
writeFileSync('p9_guided_replay_results.json', JSON.stringify(result, null, 2) + '\n');
console.log(`P9 guided replay: ${result.passed}/${result.total} identical runs PASS (${runs[0].sha256})`);
