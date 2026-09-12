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

Provider inactivity limit: 60 seconds. Per-provider-response maximum: 120 seconds. Whole investigation: four minutes; browser deadline: 255 seconds. Application heartbeats every ten seconds keep the viewer connection active; they do not reset the provider inactivity timer. Requests remain limited to four model rounds and eight tool calls. An empty public answer gets one bounded final-answer attempt without re-running tools. No automatic retry for provider HTTP or network errors.

Low reasoning effort is requested with a 3,500-token completion budget. This reduces latency but cannot guarantee provider availability or a completed explanation. Provider usage after an interrupted stream may be unavailable and must not be inferred as zero cost.

Implementation follows [OpenRouter streaming documentation](https://openrouter.ai/docs/api_reference/streaming) and [reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens). Tests cover split UTF-8/CRLF, SSE comments, fragmented tool calls, truncated streams, provider errors, idle timeout, cancellation, partial evidence retention and empty-answer recovery. The HTTP integration test uses a strictly test-only streamed provider fixture and the real Node physical solver, not paid provider calls.
