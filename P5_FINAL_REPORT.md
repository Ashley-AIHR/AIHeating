# P5 Final Report — Building Thermal Prediction, Identifiability & Calibration

## Decision

P5 freezes `p5-thermal-model-v1`: the smallest supported grey-box model, with effective per-building H/C calibration, accepted P1A NTU/transport inputs, validation-only conformal intervals and a stable provider seam. All 32 P5 gates and all inherited regressions pass.

## Required questions

1. **What exactly does P5 predict?** B01–B12 indoor-temperature trajectories and terminal temperatures at 30m, 1h, 2h, 3h and 6h, with intervals and thermal-risk states. Three hours is the primary P6 control horizon; six hours is secondary planning.

2. **What information is available at prediction time?** Current/historical indoor and weather telemetry; configured area, zone, insulation, orientation, nominal thermal/emitter priors and design flow shares; issued forecasts; and delivered zone supply/flow derived from the accepted P1A planned-control rollout.

3. **Which simulation-truth fields are forbidden?** True R, C, UA, solar scale, sampled multipliers, privileged simulated building flow/radiator heat, future actual weather in forecast mode, and future indoor temperature. Calibration fails closed if truth-shaped keys enter its rows.

4. **Was P3 sufficient for site-specific calibration?** No. The P3 decision is C.

5. **Why / why not?** Training has 350 parameter sets for 350 one-day episodes; validation and TEST likewise have one parameter set per episode. Only the five forbidden canonical holdouts repeat the base fixture. P3 lacks persistent same-asset depth and identification excitation.

6. **Was a dedicated P5 Identification Dataset required?** Yes: `p5-identification-dataset-v1.0`, separate from unchanged P3.

7. **What excitation was used?** Deterministic supply ±1/±2°C patterns, pump ±1/±2 Hz and valve ±5/±10-point patterns, natural sunny variation, multi-hour inertia/recovery transitions and two independent mixed-operation days.

8. **Was it physically safe and reproducible?** Yes. Thirty development/validation/test sites plus one base site each keep one parameter set for six days. All 31 first attempts passed P1A, minimum temperature was 19.202°C, no nonfinite/solver failure occurred, all action bounds/rates passed, and 93 shard hashes reproduce.

9. **Which thermal parameters were initially considered?** Per-building H (reported equivalently as R where needed), C, radiator-UA scale and solar-gain scale. Internal-gain bias was optional.

10. **Which parameters were practically identifiable?** The reduced effective H/C scales: rank 2/2, maximum condition number 8.581 and maximum absolute correlation 0.402.

11. **Which parameters were confounded?** In the full H/C/UA/solar fit, at least one pair reached 0.999931 correlation despite rank 4. UA and solar cannot be claimed independently reliable with this design; internal-gain bias was dropped.

12. **Was the parameterisation reduced?** Yes. Effective H/C are fitted per building; UA, solar and internal gain remain configured priors.

13. **What calibration algorithm was selected?** Bounded log-parameter `scipy.optimize.least_squares`, Huber loss, three deterministic starts, daily multi-step trajectory residuals sampled at 30 minutes, and weak 0.02 log-prior regularisation.

14. **How well are synthetic parameters recovered?** Effective H median/P90 absolute relative error is 7.35%/15.71%, bias +0.55%, correlation 0.548. Effective C is 6.81%/13.62%, bias +1.06%, correlation 0.801. These are effective predictive estimates, not exact R/C/UA claims.

15. **How does Temperature Persistence perform?** Oracle MAE is 0.0632, 0.1256, 0.2459, 0.3574 and 0.6326°C from 30m through 6h.

16. **How does Nominal Grey-box perform?** Oracle MAE is 0.0162, 0.0320, 0.0619, 0.0898 and 0.1614°C.

17. **How does Calibrated Grey-box perform?** Oracle MAE is 0.0022, 0.0042, 0.0071, 0.0090 and 0.0144°C; it improves nominal by 86.4–91.1% and beats persistence at every horizon.

18. **What are MAE/RMSE/bias by horizon?** Oracle `MAE/RMSE/bias` is 30m `0.0022/0.0035/-0.0002`, 1h `0.0042/0.0065/-0.0004`, 2h `0.0071/0.0108/-0.0007`, 3h `0.0090/0.0135/-0.0011`, 6h `0.0144/0.0215/-0.0020°C`. Forecast-driven is `0.0085/0.0115/+0.0011`, `0.0150/0.0202/+0.0034`, `0.0270/0.0355/+0.0091`, `0.0379/0.0493/+0.0156`, `0.0646/0.0801/+0.0360°C`. P90/P95 and all slices are in `P5_PREDICTION_VALIDATION.md` and JSON.

19. **What is the worst building?** B05: Oracle MAE 0.0142°C at 3h and 0.0235°C at 6h, well within 0.75/1.00°C.

20. **What is performance by zone/class?** Oracle 3h/6h MAE is Near `0.0093/0.0158`, Mid `0.0094/0.0152`, Far `0.0083/0.0121°C`; High `0.0077/0.0136`, Medium `0.0087/0.0135`, Low `0.0121/0.0186°C`.

21. **What is Oracle Exogenous performance?** Aggregate MAE is `0.0022/0.0042/0.0071/0.0090/0.0144°C`; all five frozen thresholds pass. This mode isolates thermal/model calibration with actual future exogenous inputs and is diagnostic only.

22. **What is Forecast-driven performance?** Aggregate MAE is `0.0085/0.0150/0.0270/0.0379/0.0646°C`; 1h, 3h and 6h gates pass by wide margins using issued forecasts.

23. **Are physical causality tests satisfied?** Yes. Higher delivered supply, lower outdoor temperature, higher solar, lower flow, higher C, higher H and pre-transport supply timing all respond in the required directions.

24. **Is transport delay handled explicitly?** Yes. Planned controls pass through P1A hydraulics and FIFO transport before P5 sees delivered zone supply and allocated building flow.

25. **Was C ever used to compensate network delay?** No. Calibration uses delivered supply. An intentionally wrong same-time station-supply shadow worsens 3h Oracle MAE from 0.0090 to 0.0204°C.

26. **Does instantaneous return mixing materially affect P5?** No under the accepted dependency graph: return is calculated after building integration and does not feed P5 inputs or next state. Expected 3h effect is 0.000°C; return transport is deferred/non-blocking.

27. **What uncertainty method is used?** Symmetric split-conformal absolute-residual intervals, pooled by evaluation mode and horizon, calibrated only on validation sites.

28. **What TEST coverage is achieved?** Oracle coverage is 92.78–93.20%; forecast-driven is 93.22–96.41%. Mean widths grow sensibly to 0.0829°C Oracle and 0.3333°C forecast-driven at 6h. The 96.41% 6h result is mildly conservative and is not retuned.

29. **What happens on Rapid Daytime Warming?** Actual temperatures reach 24.329°C, giving meaningful >23°C risk support. Forecast MAE is 0.0448°C at 3h and 0.0563°C at 6h. The model carries C-driven inertia, transported delayed heating, reduced-input after-effects and building-specific response rates; P5 predicts these and does not control them.

30. **What happens on Sunny Winter?** Actual temperatures reach 24.427°C; solar remains a configured physical prior and issued forecast input. Forecast MAE is 0.0372°C at 3h and 0.0854°C at 6h, representing overheating-risk development without truth leakage.

31. **What happens on Cold Wave?** Forecast MAE is 0.0402°C at 3h and 0.0791°C at 6h; actual minimum is 20.934°C. Lower outdoor temperature produces stronger loss, satisfying directional safety. TEST has no `<18°C` positives, so underheat classification accuracy is not claimed.

32. **What happens on Hydraulic Imbalance?** Forecast MAE is 0.0290°C at 3h and 0.0522°C at 6h. P1A Far-zone flow/supply differences produce distinct thermal inputs/trajectories. It remains the unchanged secondary engineering benchmark; no stronger disturbance is introduced.

33. **Were P0–P4 frozen artifacts changed?** No hash-bound physical, controller, P2 scenario, P3 dataset or accepted P4 model artifact changed. P2 freeze before/after, P2/P3 integrity and P4 artifact hash checks all report zero errors. P4 Preview and UI were not modified.

34. **Is the model suitable for P6 MPC prediction?** Yes for synthetic supervisory PoC work: it is causal, transport-aware, stable, versioned, uncertainty-bearing, materially better than baselines and comfortably within 3h robustness gates. It is not validated for real sites or room-level control.

35. **Is P6 ready to proceed?** Yes, with the frozen provider/registry boundary and explicit limitations below.

## Freeze and limitations

Versions are `p5-thermal-model-v1`, `p5-calibration-method-v1`, `p5-observability-schema-v1`, `p5-identification-dataset-v1.0` and `p5-base-fixture-calibration-v1`. All 372 building calibration records include full lineage, diagnostics and held-out metrics. The registry pins all selected artifact hashes.

Non-blocking limitations: all evidence is synthetic; representative indoor sensors and configured building flow shares are assumed; real sensor noise and distribution shift are not calibrated; UA/solar/internal gain remain priors; underheat positives are insufficient; issued forecast errors are synthetic; return transport is deferred; and the scope is supervisory MPC, not room control.

P6 Readiness: GO

P5 Gate: PASS WITH NON-BLOCKING ISSUES
