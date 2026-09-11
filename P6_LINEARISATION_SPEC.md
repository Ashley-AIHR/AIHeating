# P6 Local Linearisation Specification

At every decision, the exact cloned state is rolled forward under a legal Traditional v1.2 issued-forecast continuation. Deterministic finite differences perturb supply by ±0.5°C, pump by ±0.5 Hz and each valve by ±2 percentage points. Central differences are used when both trajectories are legal; an appropriate one-sided difference is used at a boundary. If neither side is legal because of a rate boundary, the local column is fixed at zero.

Every perturbation traverses the accepted P1A nonlinear pump curve, coupled branch hydraulics, radiator/FIFO transport and calibrated P5 H/C thermal chain. The affine outputs are B01–B12 endpoint temperatures, actual heat supply, three zone flows and pump power:

`y = y_ref + S (u - u_ref)`

The surrogate is valid only inside the ±2°C, ±2 Hz, ±10 pp trust region and the hard equipment/rate envelope. It is not claimed to be globally valid. One shrink-and-relinearise attempt is allowed after nonlinear verification mismatch; otherwise the controller falls back.

Settings were frozen in `p6_sensitivity_config.json` before canonical evaluation and were never tuned from canonical evidence.
