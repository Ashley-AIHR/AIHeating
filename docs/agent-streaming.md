# Agent streaming and failure recovery

The immersive diagnostic and optimisation paths now share a streaming pipeline:
OpenRouter SSE → bounded server-side agent loop → NDJSON → live mission panel.

The former provider timeout was 35 seconds and the provider request was non-streaming. Full forecast snapshots were also repeatedly included in tool messages. The updated context excludes history and repeated scene states from forecast traces while retaining their numerical samples, limits and city context. Full physical results remain in the UI and verified candidate store.

## User-visible behaviour

- Timestamped tool starts, validated inputs, completion/errors and expandable numerical results.
- Public assistant response text streams as a clearly labelled unverified draft. Private reasoning is neither requested for display nor forwarded.
- A final narrative guard replaces the draft on completion. Draft text never drives actuation.
- A partial response preserves completed diagnostic/optimisation results, identifies the failure and stops autonomous application. A verified retained plan may still be reviewed and explicitly applied while its token is valid.
- Stop investigation aborts the browser request and upstream provider connection; the server releases the session lock. Closing the viewer also cancels upstream work.

## Bounds

Provider inactivity limit: 60 seconds. Per-provider-response maximum: 120 seconds. Whole investigation: four minutes; browser deadline: 255 seconds. Application heartbeats every ten seconds keep the viewer connection active; they do not reset the provider inactivity timer. Requests allow up to four tool-selection rounds and eight executed calls, followed by at most two independent public-report attempts. Report attempts do not repeat numerical tools. Provider HTTP/network errors are not retried; completed evidence may still be reported in the separate reporting phase, while failure status continues to prevent autonomous application.

The bounded operator loop now explicitly disables thinking throughout, with a 2,000-token tool-response budget and a 1,600-token public-report budget. Hiding reasoning alone does not stop it consuming the output budget. DeepSeek's [thinking-mode tool protocol](https://api-docs.deepseek.com/guides/thinking_mode/) also requires reasoning history to be passed back during tool conversations; this public-only transport deliberately does not retain it. Reporting uses a fresh evidence-only conversation with no tool definitions or tool-choice parameter. It therefore cannot accidentally continue the tool protocol at the reporting stage. Completion reasons and token counts remain visible as metadata, without private reasoning content.

The current actuator ramp envelope is included in the tool schema and error feedback. After a successful counterfactual or two exploratory turns, optimisation missions have a restricted decision stage: prepare a verified schedule or explicitly finish without one. A successful optimiser transitions directly to reporting. Empty or numerically rejected reports receive a bounded report-only repair. Known engineering identifiers are exempt from the lexical measurement guard, but numerical measurements remain checked. None of these measures guarantees provider availability or semantic correctness. The numerical solver remains authoritative; interrupted provider usage must not be inferred as zero cost.

Implementation follows [OpenRouter streaming documentation](https://openrouter.ai/docs/api_reference/streaming) and [reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens). Tests cover split UTF-8/CRLF, SSE comments, fragmented tool calls, truncated streams, provider errors, idle timeout, cancellation, partial evidence retention and empty-answer recovery. The HTTP integration test uses a strictly test-only streamed provider fixture and the real Node physical solver, not paid provider calls.

## Opt-in live verification

`LIVE_AI_TEST=1 BASE_URL=https://aiheating.onrender.com node scripts/live-agent-browser.mjs` exercises the actual default mission button in isolated browser sessions, consumes real provider output, checks verified plans and applies them to the simulator through the confirmation UI. It also tests the diagnostic button. There are no route mocks. `scripts/live-agent.mjs` is the HTTP counterpart; `TEST_APPLY=1` checks the isolated simulator application against its predicted state. These scripts make paid provider calls and are never part of ordinary tests or CI.
