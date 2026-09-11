# P8 Grounding and Validation Specification

## Evidence

Dynamic facts are stored under typed provenance references such as `buildings.B03.indoorC`, `loadPrediction.h2.pointMw`, `optimisation.firstAction.supplyC` and `comparison.mpc.heatEnergyMWh`. Generated numeric telemetry is emitted only through an evidence lookup and retains its reference.

## Deterministic checks

The validator rejects:

- response/context ID mismatch;
- unknown evidence reference;
- guaranteed-safe wording under `SAFETY_NOT_GUARANTEED`;
- positive “MPC Optimal” wording while fallback is active;
- measured/proven real-site savings claims;
- wording that calls a non-applied recommendation an applied system change.

The list is intentionally small and state-aware, not a giant phrase blacklist. Tests inject an unsafe provider response and confirm substitution. A second stub times out and confirms the same isolated fallback path.

## Missing and changing evidence

STALE/UNAVAILABLE/TIMEOUT provider values are omitted. Missing per-building prediction produces an explicit unavailable statement or a conceptual answer without a number. Changed B03 and Rapid→Cold conversation tests prove current packet authority and scenario isolation.

## Safe fallback

Invalid output is not displayed. The replacement states the actual structured condition: verified fallback, infeasible/safety-not-guaranteed, or generic validation failure. Validation reason, provider/model, latency and fallback usage remain available under technical details.
