# P6 Implementation Plan

## Baseline decision

Pre-implementation verification passed: P2 freeze errors `[]`, P3/P4 integrity errors `[]`, P4 gates 32/32, P5 gates 32/32, all P5 registry hashes match, and the accepted P5 regression is PASS. Any later inherited-integrity failure stops P6 acceptance.

## Frozen implementation sequence

1. Keep P4 demand, P5 temperature prediction, P6 optimisation, and P1A physical verification as separate provider boundaries.
2. Create a deterministic six-step, 30-minute Traditional v1.2 forecast continuation. Interpolate Selected P4 Predictor v1 outputs at 1/2/3h to the MPC grid.
3. Clone the exact P1A state and run the reference plus small legal finite-difference trajectories through P1A hydraulics/FIFO and the frozen P5 calibrated H/C predictor. Build one local affine surrogate for building temperature, heat, flow and pump power.
4. Solve a DCP-valid convex problem with cvxpy/OSQP. Put equipment, rate, trust-region, actuator-ablation and P5 lower-confidence-bound constraints inside the problem.
5. Verify every candidate through a fresh full nonlinear P1A/P5 clone using only the issued forecast. Permit at most one shrunken-trust-region relinearisation, then return an explicitly labelled Traditional/safe fallback.
6. Validate the surrogate on deterministic non-canonical Normal/Cold/Rapid/Sunny/Hydraulic development states from multiple persistent P5 fixtures. Freeze the objective/config before opening canonical scenarios.
7. Physically precondition separate near-18°C stress cases without overwriting temperature state; verify robust safety and infeasible fallback behavior.
8. Run supply-only, supply+pump and full-actuator ablations, then one closed-loop pass over the five untouched canonical scenarios and compare against frozen Traditional v1.2 and Preview v0 evidence.
9. Freeze registry, machine results, reports, all P6 gates, and the complete P0–P6 regression. Make no UI change and stop before P7.

The ponytail constraint keeps one callback-driven lineariser/solver/verification path for development, safety, ablation and canonical evaluation. No parallel optimiser framework or speculative 6h controller is added.
