# P4 UI/Data Alignment Patch Plan

1. Extend `p4-guided-preview-provider-v1` with existing frozen 10:30 raw/building/zone state, a derived five-bin snapshot distribution, and accepted P4 configuration metadata.
2. Route active Simulation and Settings pages to compact provider-backed views; retain legacy P0 components only for tests/development.
3. Make current/recommended/applied control semantics explicit, align the guided entry to 10:30, label Overview horizons/full-day verification, and format engineering values at display time.
4. Add UI-A1–UI-A15 invariants, EN/ZH five-route browser checks, inherited regressions, and `P4_UI_DATA_ALIGNMENT_REPORT.md`.

No model training, prediction/optimiser change, canonical rerun, P5 work, or frozen evidence mutation is in scope.
