# P1.2 Sizing Gate Results

7 PASS / 0 FAIL / 0 SKIPPED.

## SIZ1 — Radiator output equals design load — PASS

Threshold: `absolute error < 1e-8 W`

```json
1.4551915228366852e-11
```

## SIZ2 — Water-side design balance — PASS

Threshold: `absolute error < 1e-8 W`

```json
7.275957614183426e-12
```

## SIZ3 — All UA values positive and finite — PASS

Threshold: `true`

```json
true
```

## SIZ4 — All positive-load design flows positive and finite — PASS

Threshold: `true`

```json
true
```

## SIZ5 — Within-zone shares normalize — PASS

Threshold: `absolute residual < 1e-15`

```json
0.0
```

## SIZ6 — Generator has no benchmark/KPI/scenario input — PASS

Threshold: `none present`

```json
{
  "bannedTerms": [
    "benchmark",
    "comfort",
    "csv",
    "mpc",
    "overheating",
    "scenario"
  ],
  "present": []
}
```

## SIZ7 — Only allowed fixture fields differ from v1.1 physical values — PASS

Threshold: `radiator_ua_w_k and flow_share_weight only`

```json
{
  "buildingChangedFields": {
    "B01": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B02": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B03": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B04": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B05": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B06": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B07": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B08": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B09": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B10": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B11": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ],
    "B12": [
      "radiator_ua_w_k",
      "flow_share_weight"
    ]
  },
  "allNonBuildingSectionsUnchanged": true
}
```
