# P3 Split Policy

The official population is fixed before simulation:

| Split | Per family | Families | Episodes |
| --- | ---: | ---: | ---: |
| train | 70 | 5 | 350 |
| validation | 15 | 5 | 75 |
| test | 15 | 5 | 75 |
| benchmark_holdout | 1 canonical | 5 | 5 |

An entire episode belongs to one split. Seeds are SHA-256-derived from dataset version, split, family, and episode index. Parameter-set hashes/IDs, scenario-variant IDs, generation seeds, and forecast seeds must be disjoint across train, validation, and test. Family names may repeat across splits.

The five canonical P2 v1.2 scenario IDs exist only in `benchmark_holdout`; that partition is prohibited from training, hyperparameter selection, feature selection, and threshold tuning. The separate 15-episode `pilot` partition is factory validation evidence and is not part of the official dataset.
