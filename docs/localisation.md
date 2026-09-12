# English and Simplified Chinese

The active immersive workspace supports `en` (British English) and `zh-CN` (Simplified Chinese). The header selector persists in `heatpilot.locale` local storage, synchronises across tabs and updates the document language and title. English remains the default and the fallback for unknown source messages. No third-party translation service or client-side API key is required.

`src/localisation/catalogue.ts` contains English source keys, Chinese translations and explicit parameterised messages. `tx` is used at presentation boundaries: labels, accessible names, operational messages, alerts and evidence descriptions. It preserves numeric values, React elements, canonical asset IDs, URLs and raw JSON evidence. The timeline uses the simulation's original ISO date and time; engineering units remain unchanged. The legacy `/legacy` prototype retains its existing translation catalogue; other archived prototype routes are not the active localised application.

Language changes do not reset the simulator, rebuild the orbitable scene, discard a plan, or rewrite a custom operator brief. The standard brief follows the selected language. Three-dimensional markers and BIM viewer controls update their accessible labels without changing geometry or selection. Raw BIM properties, tool argument keys and numerical tool-result JSON deliberately retain their source format for engineering auditability.

## Agent contract

`POST /api/investigation` accepts `locale: "en" | "zh-CN"`, defaulting to `en` for older clients. Invalid values are rejected before streaming or paid-request accounting. The chosen locale is pinned for the run and returned in its result and event metadata. The public tool-selection prose, no-intervention reason and separate report generation all receive explicit language instructions. Report repair retains those instructions. Chinese failures use Chinese fallback explanations; Unicode decimal measurements remain subject to the existing numerical-claim guard.

Switching the interface while an investigation is running does not rewrite its answer or change its controls. Original report language is shown beside the result and in its HTML `lang` attribute. Subsequent investigations use the newly selected language. The language setting never changes tool schemas, bounds, tokens, simulator verification or actuator approval rules.

## Verification

- `npm run test:i18n`: catalogue/template invariants and bilingual browser coverage using an explicitly labelled provider fixture. Exercises persistence, translated markers, manual controls, Chinese streamed output, plan application, original report language, custom briefs, Shanghai, BIM and mobile layout.
- `npm run test:operations`: includes both-locale prompt/stream tests, invalid-locale rejection, language repair, Chinese fallback and full-width numeral checks.
- `LIVE_AI_TEST=1 BASE_URL=https://aiheating.onrender.com node scripts/live-i18n-browser.mjs`: opt-in real paid provider test, without route mocks. Runs Chinese optimisation through the UI, applies a verified step in its isolated simulator, then switches to English and runs diagnosis. Never run this automatically in CI.
