# P9 Data Lineage

| Stage | Inputs | Output | Partition/role | Release use |
|---|---|---|---|---|
| Synthetic building definition | v1.2 physical parameters, 12 buildings, commissioned zone valves | physical-fixture-v1.2 | simulation truth | P1A authority |
| Weather/scenario generation | deterministic Normal Winter, Cold Wave, Rapid Warming, Sunny Winter and 2× Far-resistance Hydraulic Imbalance definitions | scenario drivers and issued forecast features | scenario input | synthetic only |
| P3 generation | P1A + Traditional v1.2 + parameter envelope | p3-dataset-v1.0 | 350 train, 75 validation, 75 test, 5 canonical holdouts | P4 training/evaluation |
| P4 training | P3 train | Persistence, Physics, Linear Regression and LightGBM candidates | training | fit only |
| P4 model selection/calibration | validation/model-selection and validation-calibration data | selected-p4-predictor-v1 + split-conformal intervals | validation | model selection and interval calibration |
| P4 final evaluation | unopened P3 test | MAE/RMSE/R² and coverage | held-out synthetic test | evaluation, not field accuracy |
| P5 identification data | separate deterministic excitation sites, observed-feature and simulation-truth packages | p5-identification-dataset-v1.0 | identification/training-like input | effective H/C identification |
| P5 calibration | identification/calibration partition | p5-calibrated-parameters + forecast-driven intervals | synthetic calibration | P5 provider |
| P5 validation/test | validation and held-out test/canonical cases | temperature errors, coverage and safety-case evidence | validation/test/canonical holdout | evaluation only |
| P6 development | development scenarios only | objective, linearisation, solver and safety policy | development | frozen before canonical evaluation |
| Canonical holdouts | five untouched benchmark families | Traditional/Preview/Formal MPC accepted comparisons | canonical holdout | customer evidence; never tuning data |
| P7 evidence export | accepted P4/P5/P6/P1A results | `src/p7-runtime-data.json` | guided runtime snapshot | all customer pages |
| P8 context | bounded P7 structured fields + curated domain knowledge | context ID and grounded deterministic answer | explanation runtime | no DOM scrape/control |

## Canonical scenario freeze

The exact P3 canonical manifest hashes are inherited from `p6_model_registry.json`: Normal Winter `1397dc…`, Cold Wave `b31b46…`, Rapid Warming `dd661b…`, Sunny Winter `1a1690…`, Hydraulic Imbalance `cffc0e…`. P9 verifies these through `scripts/verify-p0-p8-integrity.mjs`; it does not regenerate them.

## Meaning of partitions

- **Training** fits model parameters.
- **Validation** chooses components and calibrates uncertainty without opening test/canonical results.
- **Test** is held-out synthetic performance evaluation.
- **Canonical holdout** is the fixed scenario benchmark used for final evidence, never retuning.
- **Runtime display** is a deterministic copy of accepted evidence; it is not a fresh run.
