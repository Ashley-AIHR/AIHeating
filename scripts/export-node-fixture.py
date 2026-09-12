"""Offline migration fixture and oracle; never needed by the deployed Node service."""
import json
import sys
from pathlib import Path
from dataclasses import asdict
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'server'))
import twin
fixture = asdict(twin.coherent_parameters())
(root / 'server/physical-fixture.json').write_text(json.dumps(fixture, indent=2) + '\n')
oracle = {}
for scenario in twin.SCENARIOS:
    s = twin.new_session(scenario)
    initial = twin.snapshot(s)
    comparison = twin.compare(s)
    twin.advance(s, 6)
    oracle[scenario] = {'initial': initial, 'advanced': twin.snapshot(s), 'comparison': comparison}
def deterministic(value):
    if isinstance(value, dict):
        return {k: deterministic(v) for k, v in value.items() if k != 'candidateId'}
    if isinstance(value, list):
        return [deterministic(v) for v in value]
    return value
(root / 'server/node-physics-oracle.json').write_text(json.dumps(deterministic(oracle), separators=(',', ':')) + '\n')
print('Exported deterministic physical parameters and five-scenario Python oracle.')
