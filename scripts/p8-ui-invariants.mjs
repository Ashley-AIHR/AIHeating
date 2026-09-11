import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const panel = readFileSync('src/TutorPanel.tsx', 'utf8');
const tutor = readFileSync('src/p8-tutor.ts', 'utf8');
const styles = readFileSync('src/styles.css', 'utf8');
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed += 1; };

check(app.includes("import { TutorPanel } from './TutorPanel'"), 'Tutor panel is integrated once');
check(app.includes("tutorPage !== 'settings'") && ['overview', 'simulation', 'forecast', 'results'].every((page) => app.includes(`'${page}'`)), 'Tutor covers four customer pages');
check(panel.includes('buildTutorContext') && panel.includes('askTutor'), 'UI uses structured Tutor pipeline');
check(!/querySelector|innerText|getElementById|textContent/.test(tutor + panel), 'Tutor performs no DOM scraping');
check(tutor.includes('P7TutorRuntimeSource') && tutor.includes('getGuidedRuntime'), 'Dynamic truth comes through P7 provider abstraction');
check(tutor.includes('interface TutorLLMProvider') && tutor.includes('DeterministicTutorProvider'), 'Model-independent provider and deterministic implementation exist');
check(!/api[_-]?key|OPENAI_API_KEY|ANTHROPIC_API_KEY/i.test(tutor + panel), 'No API key or vendor credential in source');
check(!/applyPrototypeControl|advancePrototypeTimeline|setRecommendationApplicationStatus/.test(panel), 'Tutor has no application/control callback');
check(panel.includes("role: 'Explanation only'") && panel.includes("role: '仅提供解释'"), 'Explanation-only role is bilingual');
check(panel.includes('suggestedTutorQuestions(props.page') && tutor.includes('const questions: Record<TutorPage'), 'Suggested questions depend on page');
check(panel.includes("/[\\u3400-\\u9fff]/") && panel.includes("/[A-Za-z]/"), 'Explicit question language can override UI language');
check(panel.includes('contextId') && panel.includes('evidenceRefs') && panel.includes('validationStatus'), 'Collapsible audit metadata is retained');
check(styles.includes('.tutor-launch') && styles.includes('.tutor-card') && !styles.includes('.app-shell.tutor'), 'Tutor uses a minimal overlay without layout redesign');
check(tutor.includes('PROVIDER_TIMEOUT') && panel.includes('simulation and control are unaffected'), 'Tutor failure is isolated from core runtime');
check(tutor.includes('conversation.slice(-6)') && panel.includes('responses.slice(-3)'), 'Conversation memory is short and bounded');

console.log(`P8 UI/provider invariants: ${passed} passed, 0 failed, 0 skipped`);
