# P5 Observability Specification

Version: `p5-observability-schema-v1`.

The selected thermal calibration and prediction path accepts only A–E inputs defined in `p5_observability_schema.json`. Exact synthetic R, C, radiator UA, solar multipliers, sampled parameter multipliers, simulated building flow, radiator heat, future actual weather in forecast-driven mode, and future indoor temperature are class F. They are physically separated from the site-observable shards and may be opened only by post-fit recovery/evaluation code.

The practical building-side input is delivered zone supply after the accepted P1A FIFO plus building flow derived from accepted zone flow and configured within-zone design-flow share. Station supply, pump frequency, and valves are upstream inputs to P1A hydraulics/transport; P5 has no direct valve-to-temperature mapping. Wind remains observable context but is coefficient-neutral because accepted P1A has no wind-dependent infiltration term.

Current indoor temperature is A; past indoor trajectory is C; issued future weather is D. Oracle future weather is an evaluation-only diagnostic and cannot enter forecast-driven prediction. Static v1.2 building values are bounded priors/configuration, not hidden fitted answers.
