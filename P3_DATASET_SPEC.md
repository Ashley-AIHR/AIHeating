# P3 Dataset Specification

Dataset version: `p3-dataset-v1.0`. Generator version: `p3-dataset-factory-v1.0`.

Each episode is a 24-hour accepted-engine evaluation at a 5-minute physical step after controller-consistent warm-up. Operational trajectories use the frozen `traditional-v1.2` controller and fixed 35/55/85% valves. Large outputs are deterministic gzip-compressed RFC 4180 CSV shards, partitioned by split and scenario family. Gzip headers use a fixed timestamp, so identical input manifests reproduce identical bytes without adding a Parquet dependency.

Five tables are produced per episode:

| Table | Grain | Rows/episode | Role |
| --- | --- | ---: | --- |
| `raw_state` | station/network × 5 min | 288 | current feature/diagnostic state |
| `building_state` | building × 5 min | 3,456 | current building feature state |
| `weather_forecast` | 30-min issue × 30-min horizon to 6h | 432 | synthetic forecast features |
| `load_target` | 30-min anchor × 1/2/3/6h | 144 | future required-load labels |
| `building_temperature_target` | building × anchor × 0.5/1/2/3/6h | 2,160 | future indoor-temperature labels |

All rows carry dataset, episode, split, scenario, fixture, parameter, controller, generator, seed, and simulation-time lineage. Field-level types, units, sources, nullability, semantics, and classifications are frozen in `dataset_schema.json`.

Forecasts equal future weather truth plus deterministic zero-mean Gaussian errors whose scale increases with horizon. The forecast table contains only synthetic forecast values—not hidden future actual fields. Future truth remains in separate label tables.
