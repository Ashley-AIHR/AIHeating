# P9 Legacy Code Review

| Item | Classification | Reason / release action |
|---|---|---|
| `src/domain.ts` fixtures, `Simulation` and `Results` legacy components | REQUIRED FOR REGRESSION | P0 tests and the collapsed engineering view still exercise the original fixture semantics. Not mounted as the guided `/simulation` or `/results` customer path. Keep for RC1. |
| Preview Optimiser v0 data/provider and comparison column | HISTORICAL BENCHMARK | Required to show the intermediate engineering benchmark; never the active final optimiser. Keep and label. |
| Collapsed “legacy P0 engineering fixture telemetry” on Overview | REQUIRED FOR REGRESSION | Explicitly technical/debug and separated from the guided story. It is not a live provider. |
| `advancePrototypeTimeline` and legacy play/pause/step helpers | DEFERRED CLEANUP | They can animate fixture controls but do not run P1A/P4/P5/P6. Removing them during release validation would risk P0 regression. |
| `src/p4-provider.ts` / `src/p4-preview-data.json` | HISTORICAL BENCHMARK | Retained for P4 Preview evidence and regression; active final routes use P7. |
| old mock/fixture data adapters | DEFERRED CLEANUP | Safe removal requires a post-freeze dependency audit and a new release identity. |

No risky deletion was performed in P9. No legacy P0 fixture is represented as a live Digital Twin feed.
