# P0 Control-Mode Behaviour Report

P0 uses a deterministic frontend state machine over the canonical fixture. It models interaction semantics only; it does not control equipment.

## State

The app state includes `mode`, `networkState`, `frameIndex`, `simulationTime`, `isPlaying`, `advisoryApplied`, `latestRecommendation` (the canonical recommendation fixture), and semantic `events`. Reset restores frame 0 / 08:00, the initial network/building state, selected building B03, 6-hour forecast context, no advisory apply, and one clean `simulation_reset` event.

## Mode matrix

| Mode | Recommendation visibility | Manual Apply | Auto-application | Resulting transition | Semantic event log |
|---|---|---|---|---|---|
| Traditional Weather Compensation | Visible as comparison context | No | No AI application | Mode changes to `traditional`; network remains unchanged by the AI recommendation; Step/Play records fixture progression only | `control_mode_changed`, then `simulation_step` for timeline actions |
| AI Advisory | Visible with operator action | Yes, only `Apply to Simulation` | No | Mode changes to `advisory`; network remains unchanged until Apply; Apply performs one bounded recommendation update and sets `advisoryApplied=true` | `control_mode_changed`; on Apply, `recommendation_applied` |
| AI Optimised (MPC) | Visible with active status | No Apply button | Yes | Mode changes to `optimised`; an immediate bounded recommendation update is applied; subsequent Step/Play timeline frames auto-apply bounded fixture actions | `control_mode_changed`, `mpc_recommendation_generated`, `mpc_control_auto_applied`; each later tick adds `mpc_control_auto_applied` |

## Transition details

### Traditional

Selecting Traditional records the mode change and clears the Advisory-applied flag. The Recommendation card shows comparison-only status and no Apply control. Timeline movement does not call `applyPrototypeRecommendation` or auto-apply MPC actions.

### AI Advisory

Selecting Advisory records the mode change and leaves network values unchanged. The Apply button is rendered only in this mode. Clicking it calls the bounded `applyPrototypeRecommendation` selector path, changes the network state, sets `advisoryApplied`, and records the operator-confirmed semantic event. Repeated clicks remain bounded by the shared equipment limits.

### AI Optimised (MPC)

Selecting Optimised immediately performs the first available fixture control tick: it generates the recommendation and applies one bounded recommendation update. The header/card displays `MPC Active` and `Auto-applied`; no Apply button is rendered. Each Step/Play tick calls `advancePrototypeTimeline` and records an `mpc_control_auto_applied` event.

## Acceptance confirmation

- AI Advisory = manual Apply: confirmed by `scripts/capture-p0.mjs` and the Advisory runtime screenshot.
- AI Optimised = automatic apply, no Apply: confirmed by `scripts/capture-p0.mjs` and the Optimised runtime screenshot.
- Traditional = comparison-only, no AI auto-application: confirmed by the same capture assertion.
- Event log uses localized display keys (`eventControlModeChanged`, `eventMpcRecommendationGenerated`, `eventMpcControlAutoApplied`, `eventRecommendationApplied`, `eventSimulationStep`) rather than exposing raw snake_case labels.
