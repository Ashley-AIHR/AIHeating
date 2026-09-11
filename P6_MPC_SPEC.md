# P6 Formal Supervisory MPC Specification

## Scope and architecture

`p6-mpc-v1` is a 3-hour supervisory optimiser on six 30-minute intervals. P4 supplies issued-at-decision Required Heat Load predictions; P5 supplies calibrated building thermal dynamics and forecast-driven uncertainty; deterministic finite differences through P1A/P5 form a local affine surrogate; cvxpy formulates the convex QP and OSQP solves it. The complete candidate is then replayed through the full nonlinear P1A hydraulics/FIFO plus accepted P5 chain. P1A/P5 verification, never the QP surrogate, is the acceptance authority.

The stable backend seam is `FormalSupervisoryMPC.recommend(...) -> MPCRecommendation`. The response contains recommendation identity, forecast issue time, horizon/grid, all five trajectories, first action, objective components, solver evidence, predicted B01–B12 trajectories, uncertainty, verification/fallback status, model versions and constraint margins. It intentionally has no `applied` field.

## Inputs and causality

Decision inputs are the cloned current state, history available at the decision time, weather forecast issued at that time, Selected P4 Predictor v1, accepted P5 parameters/uncertainty, frozen Traditional v1.2 reference and pinned equipment configuration. `assert_causal_forecast` rejects future-truth/scenario/parameter/episode/split/seed fields. Actual future weather is read only by the evaluation environment after action selection.

## Controls and constraints

Each interval chooses secondary supply temperature, pump frequency, and Near/Mid/Far valve fractions. Bounds are 40–60°C, 30–50 Hz and 20–100%. Per-step rate limits are 2°C, 2 Hz and 10 percentage points. The same magnitudes define the local trust region around the fair Traditional issued-forecast continuation. All bounds, rates, trust limits and robust indoor lower bounds are constraints inside the QP; no result is post-clamped.

## Objective

The frozen normalized objective combines avoidable heat oversupply, pump electricity, mild below/above-comfort deviation, overheating above 23°C, severe overheating above 25°C, and squared control movement. Underheating is not bought as an energy trade-off: the P5 lower prediction bound must remain at or above the official 18°C floor.

## Decision pipeline and modes

OSQP statuses `optimal` and `optimal_inaccurate` are eligible for nonlinear verification. A failed verification permits one relinearisation around the candidate with a 0.5 trust-region scale. A second failure or non-accepted solver status invokes the predeclared legal fallback and preserves the real solver/fallback status.

Traditional mode remains frozen Traditional control. AI Advisory produces a recommendation for explicit application. AI Optimised may apply only an accepted feasible first action in the simulation environment. Tutor/LLM code has no actuation authority. UI/provider replacement is deferred to P7.

The callback-based horizon adapter keeps a later 6-hour extension possible without changing the recommendation boundary, but P6 v1 intentionally requires six intervals.

P6 runtime packages are isolated from the frozen P0–P5 project lock and pinned in `physical_core/p6-requirements.txt`; this preserves the accepted `physical_core/pyproject.toml` and `uv.lock` byte-for-byte.
