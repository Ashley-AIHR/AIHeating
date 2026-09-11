# Physical Fixture v1.2 Implementation Plan

1. Validate the fixed synthetic 21/−10/55/45°C design point before generating any UA.
2. Derive every building's design load, water flow, within-zone share, and NTU UA from the same equations.
3. Export a new versioned fixture; preserve all v1.0/v1.1 evidence and the Traditional control curves.
4. Run SIZ1–SIZ7, the accepted P1A tests and 32 Gates, and the P2.2 static search without weaker bounds.
5. Only if a −10°C hard-band witness exists, recommission zone valves from summed design flows and rerun all five P2 scenarios from fresh warm-up states.
6. Run the full P2 and P0 regressions, compare v1.0/v1.1/v1.2, report readiness, and stop before P3 or baseline freeze.

No KPI or scenario result is an input to sizing. A failed hard-feasibility result is reported without further UA changes.
