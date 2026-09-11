# P8 Tutor Provider Contract

`TutorLLMProvider.generate()` accepts:

- immutable instruction boundary;
- current `TutorContextPacket`;
- selected knowledge items;
- at most six recent conversation turns;
- current question, language and routed category.

It returns answer text/type/language, `contextId`, evidence and knowledge references, source boundary, confidence, limitations, control-request flag, provider/model metadata and question category. `askTutor()` adds latency, validation status, validation reasons and fallback-response status.

No vendor is hard-coded in application pages. The repository has no existing live LLM connection, so the default is `Built-in Grounded Tutor / deterministic-grounded-v1`. Tests can inject any provider, including unsafe, failed and timeout stubs. There are no source-code API keys.

The provider has no tool or callback for supply, pump, valve, Apply, PLC or DCS actions. A timeout or provider exception returns a deterministic safe explanation and cannot modify P1A–P7 state.
