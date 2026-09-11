# P5 Identifiability Review

## P3 history decision

P3 contains 350 training episodes with 350 unique parameter sets, 75/75 in validation, and 75/75 in test; each appears at most once. Only the five canonical holdout episodes share `physical-fixture-v1.2`, and those are forbidden for calibration. P3 therefore does not represent a site retaining one parameter set across a calibration history.

**P3 decision: C — same-asset history and excitation insufficient.** A separate `p5-identification-dataset-v1.0` was required.

## Full candidate result

Nine controlled pilot cases tested per-building H/C/UA/solar scales. The normalized Jacobian had minimum rank 4 and maximum condition number 424.398, but maximum absolute parameter correlation was 0.999931, exceeding the frozen 0.98 limit. The optimizer's tiny median trajectory MAE (`0.000000587°C`) and synthetic recovery errors near `1e-5` do not erase that local confounding. Internal-gain bias was therefore not added.

The full model is predictively expressive but its four quantities cannot be presented as independently reliable site estimates.

## Reduced result

The selected parameterisation estimates only effective per-building H and C scales. UA and solar scale remain at configured priors. Across the same pilot design:

- minimum numerical rank: 2 of 2;
- maximum condition number: 8.581;
- maximum absolute H/C correlation: 0.4022;
- median trajectory-fit MAE: 0.02415°C.

This supports the claimed interpretation: effective H/C values suitable for prediction, not exact recovery of every physical mechanism.

## Conclusion

Overall classification is **B — predictively usable effective H/C; UA/solar fixed to configured priors**. This is compatible with the earlier P3 Decision C: P3 was insufficient, while the dedicated persistent-site data made the reduced model identifiable enough for its limited claim. Full singular values, covariance/correlation matrices, pilot results and the P3 audit are in `p5_identifiability_results.json`.
