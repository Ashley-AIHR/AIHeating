# P8 Tutor Architecture

`P7 Runtime Provider → TutorContextBuilder → compact structured context + selected curated knowledge → deterministic router → TutorLLMProvider → grounded response → state-aware validator → Tutor UI`

## Components

| Component | Implementation | Boundary |
|---|---|---|
| Runtime source | `P7TutorRuntimeSource` | Calls the P7 provider abstraction; never reads page DOM |
| Context builder | `buildTutorContext` | Selects only page-relevant fields and current snapshot identity |
| Knowledge | `p8_domain_knowledge_v1.json` | 24 concise bilingual, project-referenced topics; no web retrieval |
| Router | `routeTutorQuestion` | Deterministic keyword/category routing; no second LLM |
| Provider contract | `TutorLLMProvider` | Vendor/model independent and test-stubbable |
| PoC provider | `DeterministicTutorProvider` | Grounded, repeatable default because no live LLM connection exists |
| Validator | `validateTutorResponse` | Evidence IDs, context binding, fallback/safety/application/real-site checks |
| Orchestrator | `askTutor` | Latency, timeout/failure isolation and safe-response substitution |
| UI | `TutorPanel` | Explanation-only overlay; no application/control callbacks |

Conversation memory is limited to six recent turns. It may guide wording, but every answer is bound to the newly built `contextId`; previous assistant text is never authoritative telemetry.

The ponytail implementation uses one context/response module, one UI component, JSON packages and existing React/TypeScript/Playwright tooling. No new dependency or speculative service hierarchy was added.
