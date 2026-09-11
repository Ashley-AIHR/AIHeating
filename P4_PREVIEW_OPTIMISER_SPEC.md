# Preview Look-ahead Optimiser v0 Specification

PreviewLookaheadOptimiserV0 is a bounded finite candidate search, not MPC. Every 30 minutes it evaluates 75 legal policies over a 180-minute horizon: supply offsets `[-2,-1,0,1,2]°C`, pump offsets `[-2,0,2] Hz`, and five fixed zone-valve patterns defined in `p4_candidate_policy_space_v0.json`.

The current serialized P1A engine is cloned independently for every candidate. Candidate schedules obey the accepted equipment bounds and per-decision rate limits. Traditional v1.2 provides the causal base control curve; P4 offsets it without changing the controller. Issued weather forecasts drive each cloned rollout. Actual future weather is available only to the evaluation environment after a decision.

The demand reference interpolates Selected P4 Predictor v1 predictions at 1h, 2h and 3h. The frozen objective is:

`1.00 oversupply + 0.15 pump energy + 2.00 mild >23°C degree-hours + 8.00 severe >25°C degree-hours + 1.00 below-20°C degree-hours + 0.05 control movement`.

Degree-hours are normalized per building-hour. A candidate predicting any indoor temperature below 18°C is rejected. If no safe candidate exists, the optimiser deterministically returns the legal Traditional action. Candidate space, weights, horizon and fallback were frozen after generated-validation evaluation and before canonical evaluation.

