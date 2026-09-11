# Phase 2 Baseline Fairness Review

Self-review: **FAIR_WITH_DISCLOSED_LIMITATIONS**. External engineering review remains required.

## Is the baseline intentionally weak?

No. Supplied recommended curves are unchanged; area-share commissioning improves the network. No AI comparison exists.

## Does it use current outdoor conditions sensibly?

Yes. Piecewise-linear outdoor reset and pump schedules, recalculated at actual 30-minute boundaries.

## Does it heat more when colder?

Yes. Raw supply/pump curves are monotonic; Cold Wave actions and delivered heat are measured.

## Does it back off when warmer?

Yes. Raw targets fall; applied values follow only documented slew and interval constraints.

## Does it use reasonable fixed commissioning?

Yes. Static area shares at 45 Hz, limiting valve 85%, practical 5pp rounding; valves fixed at 50/60/85%.

## Does it violate comfort simply to save energy?

No energy minimisation is performed. Normal comfort is 0% and overheating 67.10%, disclosed as a real limitation of these curves with the heterogeneous accepted building fixture, not an energy-saving target.

## Was it tuned using stress scenarios?

No. Normal and Cold Wave were evaluated before the three stress families; no breakpoint was changed using any scenario.

## Does it use future information?

No. Controller signature admits only timestamp/current outdoor/self state; paired differing-future tests prove identical actions.

## Is an arbitrary delay added?

No. Only 30-minute updates, frozen slew limits, accepted FIFO transit and building inertia.

## Is AI logic hidden inside it?

No. No predictor, optimiser, indoor/solar feedback or forbidden dependency is present.

## Poor comfort is disclosed, not hidden

The untouched recommended curve passes the predeclared ≥95% Normal compliance criterion (98.4375%), but Normal comfort is 0%, overheating is 67.1007%, severe overheating is 25%, and temperature ranges from 17.9268 to 29.0651°C. Cold Wave has 91.7824% compliance and minimum 16.7105°C. These results deserve external scrutiny; high compliance alone is not high comfort.

An offline explanatory calculation at current −5°C, zero solar and the commissioned Near flow shows a structural conflict within the same zone. This is not control feedback or tuning. B03's low insulation needs a higher supply to maintain 18°C than high-insulation B01 permits to stay below 25°C. Static area-based within-zone allocation is inherited from accepted P1A; a single zone supply/valve cannot satisfy both steady targets simultaneously. It would be misleading to claim perfect comfort or modify accepted thermal coefficients to hide this.

```json
{
  "B01": {
    "insulation": "High",
    "supplyNeededFor18C": 33.21154190955261,
    "supplyCeilingFor25C": 45.62581953837642
  },
  "B02": {
    "insulation": "High",
    "supplyNeededFor18C": 33.21154190955261,
    "supplyCeilingFor25C": 45.62581953837641
  },
  "B03": {
    "insulation": "Low",
    "supplyNeededFor18C": 51.001311261402265,
    "supplyCeilingFor25C": 68.82986651904989
  },
  "B04": {
    "insulation": "High",
    "supplyNeededFor18C": 33.21154190955261,
    "supplyCeilingFor25C": 45.62581953837642
  }
}
```

The temperature spread does not prove future MPC can eliminate it. Future comparisons must retain the same physical state/coefficients and disclose limits of zone-level authority. No accepted physics, equipment bound, curve or stress scenario was changed to manufacture an advantage.

## Freeze decision

Eligible for a versioned local comparison reference with these disclosed limitations; not evidence of calibrated real-plant performance. Do not begin P3 until external acceptance.
