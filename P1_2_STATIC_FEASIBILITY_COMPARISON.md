# P1.2 Static Feasibility Comparison

The exact P2.2 methodology was repeated with physical-fixture-v1.2: the same 40–60°C supply, 30–50 Hz pump, 20–100% valves, 8,250-point coarse grid per outdoor case, local refinement, independent DE seeds 7/23, Powell polish, and unchanged 1e−7°C feasibility tolerance.

## v1.1 versus v1.2 whole-system result

| Outdoor | Band | v1.1 best violation | v1.1 | v1.2 best violation | v1.2 |
| ---: | --- | ---: | --- | ---: | --- |
| -5°C | 18–25°C | 0.000000°C | FEASIBLE | 0.000000°C | FEASIBLE |
| -5°C | 20–22°C | 2.085637°C | INFEASIBLE | 0.000000°C | FEASIBLE |
| -10°C | 18–25°C | 0.583716°C | INFEASIBLE | 0.000000°C | FEASIBLE |
| -10°C | 20–22°C | 2.921046°C | INFEASIBLE | 0.000000°C | FEASIBLE |

v1.2 restores the mandatory −10°C hard-band witness and also supplies narrow 20–22°C witnesses at both outdoor cases; narrow-band feasibility is reported as a result, not treated as an acceptance prerequisite.

## -5°C / 18–25°C witness

Supply 51.500000°C; pump 35.000000 Hz; Near/Mid/Far valves 40.000% / 60.000% / 100.000%. Indoor range 21.420863–21.591444°C; max violation 0.000000000°C.

| Building | Indoor °C |
| --- | ---: |
| B01 | 21.591444 |
| B02 | 21.591444 |
| B03 | 21.445882 |
| B04 | 21.591444 |
| B05 | 21.497054 |
| B06 | 21.497054 |
| B07 | 21.497054 |
| B08 | 21.497054 |
| B09 | 21.420863 |
| B10 | 21.476303 |
| B11 | 21.476303 |
| B12 | 21.476303 |

## -5°C / 20–22°C witness

Supply 50.500000°C; pump 36.000000 Hz; Near/Mid/Far valves 35.000% / 50.000% / 80.000%. Indoor range 20.901560–21.065013°C; max violation 0.000000000°C.

| Building | Indoor °C |
| --- | ---: |
| B01 | 21.065013 |
| B02 | 21.065013 |
| B03 | 20.901560 |
| B04 | 21.065013 |
| B05 | 20.922468 |
| B06 | 20.922468 |
| B07 | 20.922468 |
| B08 | 20.922468 |
| B09 | 20.947180 |
| B10 | 21.008401 |
| B11 | 21.008401 |
| B12 | 21.008401 |

## -10°C / 18–25°C witness

Supply 57.500000°C; pump 36.000000 Hz; Near/Mid/Far valves 40.000% / 60.000% / 100.000%. Indoor range 21.475237–21.510331°C; max violation 0.000000000°C.

| Building | Indoor °C |
| --- | ---: |
| B01 | 21.494060 |
| B02 | 21.494060 |
| B03 | 21.510331 |
| B04 | 21.494060 |
| B05 | 21.499575 |
| B06 | 21.499575 |
| B07 | 21.499575 |
| B08 | 21.499575 |
| B09 | 21.481046 |
| B10 | 21.475237 |
| B11 | 21.475237 |
| B12 | 21.475237 |

## -10°C / 20–22°C witness

Supply 56.000000°C; pump 38.000000 Hz; Near/Mid/Far valves 40.000% / 60.000% / 100.000%. Indoor range 20.972143–20.999411°C; max violation 0.000000000°C.

| Building | Indoor °C |
| --- | ---: |
| B01 | 20.999411 |
| B02 | 20.999411 |
| B03 | 20.999392 |
| B04 | 20.999411 |
| B05 | 20.995121 |
| B06 | 20.995121 |
| B07 | 20.995121 |
| B08 | 20.995121 |
| B09 | 20.972143 |
| B10 | 20.972478 |
| B11 | 20.972478 |
| B12 | 20.972478 |

## Numerical audit

| Item | Measured |
| --- | ---: |
| Candidate evaluations | 116692 |
| Accepted hydraulic solves | 28897 |
| Maximum hydraulic residual | 1.11498547e-12 |
| Maximum thermal residual W | 2.91038305e-11 |
| Maximum allocation mass residual | 2.21987555e-16 |

No infeasibility claim or interval certificate is needed for v1.2 because every whole-system and zone/band objective has an explicit legal witness.
