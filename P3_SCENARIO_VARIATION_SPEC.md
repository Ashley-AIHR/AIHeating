# P3 Scenario Variation Specification

Exactly five scenario families are used: Normal Winter, Cold Wave, Rapid Daytime Warming, Sunny Winter, and Hydraulic Imbalance. Their frozen P2 v1.2 canonical definitions remain unchanged and occur only in `benchmark_holdout`.

Generated variants transform only exogenous inputs. A deterministic seed applies an outdoor-temperature offset in −2°C to +2°C, a temperature-amplitude multiplier in 0.85–1.15, solar multiplier in 0.60–1.40, and wind multiplier in 0.85–1.15. Hydraulic Imbalance additionally applies a Far-pipe resistance multiplier in 1.5–3.0 at evaluation start after healthy-network warm-up. Other families retain a 1.0 resistance multiplier.

Pilot `low`, `nominal`, and `high` modes use fixed envelope points to exercise both sides deterministically. Indoor temperature, flow, required load, heat supply, and other responses are never forced; they emerge from the accepted simulation engine.
