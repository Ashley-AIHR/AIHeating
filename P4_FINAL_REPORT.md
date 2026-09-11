# P4 Final Report

## Required answers

1. **Exact target.** Required Heat Load is the accepted `required_load` sum at target time, in MW, stored separately as P3 `load_target.required_heat_load_mw`. It is not Actual/Planned Heat Supply, recovery energy, a control command or consumption.

2. **Prediction-time features.** Thirty-one frozen features cover requested horizon; current weather/load; 30/60/120-minute load lags; issued target/path weather; clock; current building/zone indoor summaries; configured synthetic envelope, gain, solar-aperture, capacitance and radiator aggregates; and Physics Predictor v0 output.

3. **Leakage prevention.** Whole episodes retain frozen P3 splits. Features are constructed at `forecast_as_of`; histories end there; weather comes only from that issue's forecast; labels remain in the separate target table. Feature names reject split/episode/scenario/seed/target/future-truth identity classes. Benchmark holdout was not used for tuning.

4. **Persistence.** Test weighted MAE 0.046808 MW, RMSE 0.066698 MW, R² 0.6552.

5. **Physics Predictor v0.** Test weighted MAE 0.020453 MW, RMSE 0.027538 MW, R² 0.9412. It uses accepted Required Heat Load physics with issued weather and privileged configured synthetic parameters.

6. **Linear Regression.** Test weighted MAE 0.008370 MW, RMSE 0.011427 MW, R² 0.9899.

7. **LightGBM.** Test weighted MAE 0.004494 MW, RMSE 0.006373 MW, R² 0.9969. Horizon MAEs are 0.003009/0.004447/0.005233/0.005287 MW at 1/2/3/6h.

8. **Selection.** LightGBM is Selected P4 Predictor v1 because its validation weighted MAE was 0.004892 MW, well outside the 1% simpler-model tie window. Test/holdout evidence did not drive selection.

9. **Material Persistence improvement.** Yes. Test Skill_vs_Persistence is 90.40%; horizon-specific skills are 85.45%, 88.24%, 89.81% and 93.17%, all above the predeclared 10% aggregate Gate.

10. **Value over Physics Predictor.** Yes on this synthetic test: LightGBM reduces weighted MAE by about 78.0% versus Physics Predictor v0. LightGBM was not required to win.

11. **Ablations.** Validation weighted MAE: full 0.004892; minus forecast 0.004823; minus indoor 0.004815; minus lagged load 0.005163; minus solar 0.004896 MW. Lagged load helps; solar is neutral; forecast/indoor features do not add aggregate validation skill here and are an honest synthetic-data limitation.

12. **Uncertainty.** Horizon-specific split-conformal absolute-residual intervals calibrated only on `validation_calibration`, labelled 95% simulation-calibrated.

13. **Coverage.** Aggregate empirical test coverage is 95.05%, with 0.025974 MW mean width. Horizon coverages are 94.63%, 94.96%, 95.79% and 94.83%.

14. **Preview Optimiser v0.** Every 30 minutes, it predicts 1/2/3h demand, interpolates a 3-hour demand reference, independently clones the exact physical state, evaluates every policy through full P1A rollouts, rejects unsafe candidates and deterministically minimizes the frozen objective. It is not MPC.

15. **Candidate space.** Seventy-five policies: five supply offsets × three pump offsets × five zone-valve patterns, with accepted bounds and supply/pump/valve rate limits.

16. **Use of P4 predictions.** Selected P4 Predictor v1 supplies 1h/2h/3h demand anchors; deterministic interpolation produces the finer rollout demand reference. The 6h prediction is exposed for forecasting but lies outside the 3h Preview horizon.

17. **Forecast-only rollouts.** The decision boundary rejects forecast rows containing actual/truth/required-load/indoor fields. Cloned rollouts receive current weather plus the issued weather forecast; actual future weather is used only by the evaluation environment.

18. **No-safe-candidate behavior.** The explicit deterministic fallback continues the legal Traditional v1.2 action. No canonical case needed fallback.

19. **Rapid Daytime Warming.** From the same initial state, Preview preserves 100% compliance and 0% underheating/severe overheating while heat falls 8.373→7.995 MWh, pump electricity 23.407→21.573 kWh, >23°C exposure 61.92%→37.82%, and excess heat 1.480→1.251 MWh. The directional Gate passes without a required savings threshold.

20. **Sunny Winter.** Preview preserves 100% compliance/0% underheating while reducing heat 8.793→8.409 MWh, pump electricity 24.956→22.878 kWh, >23°C exposure 62.73%→38.19%, and excess heat 1.354→1.141 MWh.

21. **Cold Wave safety.** Safe. Compliance remains 100%, underheating remains 0%, comfort improves 42.88%→57.81%, and lower heat does not manufacture savings through cold buildings.

22. **Hydraulic Imbalance.** The unchanged 2× Far-resistance case remains a secondary engineering benchmark. Preview retains 100% compliance/0% underheating, reduces excess heat 0.534→0.357 MWh and does not make the scenario artificially dramatic.

23. **Baseline modifications.** None. P2 accepted/artifact hashes and P3 schema/505 episode manifests/all shard hashes pass before finalization. Physical fixture v1.2, P1A physics, Traditional v1.2, 35/55/85 valves, forcing, warm-up, metrics, canonical results and P3 split identities are unchanged.

24. **Client journey.** Yes. Overview visibly explains NOW→FORECAST→PREDICT→OPTIMISE→VERIFY, exposes a one-click guided entry and uses the same 10:30 provider snapshot on Overview, Forecast and Results. Browser checks pass in English and Chinese.

25. **Intentional simplifications.** Synthetic data and forecast errors; configured synthetic Physics Predictor parameters; accepted but not P5/site-calibrated thermal rollout; 75-policy finite search; PoC objective weights; no real-plant calibration or PLC/DCS action; no formal P6 MPC.

26. **Customer Preview readiness.** GO for a clearly labelled simulation preview. It must not be presented as production/autonomous control or real-site savings.

27. **P5 readiness.** GO. P4's frozen data lineage, prediction provider, uncertainty, Preview boundary and evidence are ready for external review before P5 begins.

## Verification summary

Training reproducibility rerun produced byte-identical model artifacts. P4 tests 11/11, P3 tests 7/7, accepted P2 tests 34/34, accepted P1A tests 84/84, P0 invariants 62/62, P4 UI/provider invariants 20/20, browser routes 4/4, P1A gates 32/32, P2 gates 20/20, P3 gates 14/14, and P4 gates 32/32 all pass with zero failed/skipped tests.

Customer Preview Readiness: GO

P5 Readiness: GO

P4 Gate: PASS
