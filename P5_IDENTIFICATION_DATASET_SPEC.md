# P5 Identification Dataset Specification

## Identity and purpose

`p5-identification-dataset-v1.0` is a separate system-identification dataset. It does not modify or replace `p3-dataset-v1.0` and is not P4 heat-load training data.

It contains 30 persistent virtual sites split by site into 20 development, 5 validation and 5 test sites, plus one separately labelled `P5-BASE-FIXTURE` history. Each site retains exactly one physical parameter set for six continuous days. Days 1–4 are calibration history; days 5–6 are unseen mixed-operation evaluation.

## Deterministic design

The day families are:

1. `identification_supply`: bounded supply pulses;
2. `identification_flow`: pump and opposite-direction zone-valve excitation;
3. `identification_solar`: natural sunny variation with bounded supply support;
4. `identification_inertia`: multi-hour alternating heating/recovery;
5. `evaluation_mixed_a`;
6. `evaluation_mixed_b`.

Controls change only on 30-minute boundaries. Limits are supply 40–60°C and ±2°C/change, pump 30–50 Hz and ±2 Hz/change, and valves 20–100% and ±10 percentage points/change. No state, flow, heat or parameter is directly perturbed. Weather and issued forecast errors use deterministic SHA-256-derived seeds.

If an initial design produces indoor temperature below 18°C, the generator records it and retries once at predefined amplitude 0.5. It never resamples based on recovery score. A second failure stops generation.

## Storage and lineage

For every site, separate gzip CSV shards store the site-observable and issued-forecast views; a physically separate JSON shard stores simulation truth. The selected calibration reads only `site_observable`. Fixed gzip timestamps make byte hashes reproducible.

The root manifest records all attempted designs, physical parameter hash, days/windows, row counts, paths, 93 SHA-256 file hashes, schema/config hashes, physical QA, bounds and split counts. No canonical P2 scenario ID appears in calibration lineage.
