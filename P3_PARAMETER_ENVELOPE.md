# P3 Parameter Envelope

Official derived parameter sets start from `physical-fixture-v1.2`. Independent assumptions are sampled deterministically within the following multiplicative bounds:

| Dimension | Official | One-factor QA stress |
| --- | ---: | ---: |
| Envelope resistance R | 0.80–1.20 | 0.70–1.30 |
| Thermal capacitance C | 0.80–1.20 | 0.70–1.30 |
| Internal gains | 0.80–1.20 | 0.70–1.30 |
| Effective solar aperture | 0.80–1.20 | 0.70–1.30 |
| Pipe resistance Kpipe | 0.80–1.20 | 0.70–1.30 |
| Valve reference resistance Kvalve | 0.80–1.20 | 0.70–1.30 |
| Pump shutoff head / curve coefficient | 0.90–1.10 | 0.80–1.20 |
| Radiator sizing margin | 0.90–1.10 | 0.70–1.30 |
| Transport volume | 1.00 fixed | not varied |

After changing R, C, gains, or solar aperture, the accepted v1.2 sizing chain recomputes coherent design load, design mass flow, and base radiator UA. The radiator margin is applied only after that recomputation. Flow-share weights are the recomputed design flows. Every set receives a new ID/hash and must pass the coherence validator; the accepted base fixture is never overwritten.

The wider one-factor sweep is engineering QA only and is not part of the official sampling distribution.
