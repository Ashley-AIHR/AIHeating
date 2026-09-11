# P5 Identifiability Specification

## Question and decision rule

Identifiability is assessed before final calibration. Optimizer convergence is not evidence of identifiability. The candidate vector is `log(H scale), log(C scale), log(UA scale), log(solar scale)`; internal-gain bias is excluded unless the four mandatory terms prove distinguishable.

For each controlled pilot building/site case, the process:

1. rolls the complete observable multi-step trajectory;
2. perturbs each log-parameter by `1e-4`;
3. scales temperature sensitivities by `0.1°C`;
4. constructs the numerical Jacobian;
5. reports singular values, rank at `s_max × 1e-6`, condition number, pseudoinverse covariance and correlation;
6. fits three deterministic bounded starts and measures post-fit recovery only after fitting.

Predeclared practical criteria are full numerical rank, condition number `≤10,000`, and maximum absolute off-diagonal correlation `≤0.98`.

## History and excitation assessment

P3 is tested for repeated physical parameter identity, not merely row count. A parameter set appearing in a single 24-hour episode is insufficient for realistic site-specific calibration. If P3 is insufficient, Decision C requires a separate persistent-site dataset; P3 must not be reshuffled or modified.

The dedicated pilot includes supply, flow/emitter, natural solar, inertia/recovery, and independent mixed evaluation conditions. Only legal supply, pump and valve controls are excited. Indoor temperature, flow, heat, and physical parameters are never directly perturbed during an episode.

## Allowed reduction

If the full vector fails correlation/confounding criteria, weak terms must be fixed to configured priors. The reduction order is full H/C/UA/solar, then effective H/C with UA/solar fixed, then a still smaller physical subset if needed. Individual estimates are claimed only at the level supported by the selected Jacobian.

Classification:

- A: identifiable from P3;
- B: predictively usable but individual parameters are not all reliably identifiable;
- C: P3 same-asset history/excitation is insufficient.

P3 sufficiency and the final model interpretation are reported separately.
