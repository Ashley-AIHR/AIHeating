# P6 Solver and Computational Performance

The documented final run used Python 3.12.13, NumPy 2.5.3, cvxpy 1.9.2 and OSQP 1.1.3. Warm start was disabled.

Across 160 canonical decisions, end-to-end time was 0.521 s median, 1.014 s P95 and 1.045 s maximum, comfortably inside the review target of P95 ≤5 s. Median OSQP iterations were 8,512.5. Statuses were 151 `optimal`, 2 `optimal_inaccurate`, and 7 `user_limit`. The seven non-accepted statuses were never relabelled optimal: one Normal and six Cold decisions used the predeclared Traditional continuation, and all seven fallbacks passed nonlinear verification. There were zero accepted-candidate verification failures and zero relinearisation events.

Because the performance target passed, component-level profiling was not required. Sensitivity generation and nonlinear verification dominate the end-to-end path conceptually; weakening physics is not an accepted optimisation route.
