# Phase 1A physical core

Standalone deterministic Python 3.12 simulation using **Synthetic PoC Parameters**. No React integration, controller, ML, MPC, production API or real equipment connection.

From the repository root:

```sh
uv sync --project physical_core --extra validation --frozen
physical_core/.venv/bin/python -m pytest physical_core/tests -q
physical_core/.venv/bin/python physical_core/scripts/run_gate_suite.py
physical_core/.venv/bin/python physical_core/scripts/run_canonical_scenario.py
node physical_core/scripts/check-p0-contract.mjs physical_core/p0_frame_example.json
```

The contract test also requires the frozen root npm dependencies (`npm ci` on a clean checkout). `uv.lock` pins Python dependencies; no heavy simulation framework is used.

The two exporter scripts write the root acceptance artifacts: Gate Markdown/JSON, parameter JSON, canonical CSV and five plots. `p0_frame_example.json` is a real engine frame, checked against the interface extracted from the frozen seam documentation and types imported from `src/domain.ts`.

```python
from ai_heating_core.contracts import Weather
from ai_heating_core.simulation import SimulationEngine
from ai_heating_core.adapters import to_p0_frame

engine = SimulationEngine(dt_s=300)
frame = engine.step(Weather(outdoor_c=-8, solar_w_m2=50))
payload = to_p0_frame(frame)
```

See `P1A_PHYSICAL_MODEL_SPEC.md` for equations, sampling semantics, scope, energy accounting and all assumptions. Live control changes are validated independently of the frontend. Standalone component experiments may compare arbitrary valid operating points; the integrated engine additionally enforces per-change limits and 30-minute command boundaries.
