# P5 Return-Network Review

## Dependency trace

The accepted simulation order is:

`controls → hydraulics → supply FIFO transport → delivered zone supply/flow → building heat/state integration → zone/station return calculation`.

P5 consumes delivered supply after FIFO transport, derived building flow, weather, current temperature and configured building priors. The instantaneous zone/station return temperatures are calculated after the building step. They do not feed the coupled hydraulic solver, the supply delay lines, delivered supply temperature, building-flow allocation, or the next P5 thermal state under the frozen planned-control boundary.

Therefore replacing instantaneous return mixing with transported return mixing has exactly no dependency path to P5 indoor prediction in the current P1A model. A numerical shadow cannot reveal a temperature effect because the relevant edge does not exist; adding one would change P1A/P6 plant/accounting scope rather than calibrate P5.

## Decision

**DEFERRED / NON-BLOCKING.** Expected aggregate 3h indoor-prediction effect is 0.000°C, below the suggested 0.05°C materiality trigger. Return transport could matter later to station heat-meter timing, return-temperature constraints, or pump/heat accounting in P6. Those concerns should be reviewed when such feedback or objectives are introduced, without changing this frozen P5 predictor.
