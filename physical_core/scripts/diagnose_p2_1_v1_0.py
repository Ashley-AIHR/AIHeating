"""Read-only replay of historical P2; outputs only new P2.1 diagnostic files."""
import csv
import json
from pathlib import Path

from ai_heating_core.benchmark.allocation_diagnostics import authority, building_diagnostic, diagnostic_markdown
from ai_heating_core.benchmark.freeze import file_hash, verify_freeze, write_immutable_json
from ai_heating_core.benchmark.runner import run_baseline
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.p2_scenarios import scenarios

ROOT=Path(__file__).resolve().parents[2]


def main():
    if verify_freeze(ROOT):
        raise ValueError("Historical P2 freeze must be intact before diagnosis")
    frozen=json.loads((ROOT/"P2_BASELINE_FREEZE_MANIFEST.json").read_text())
    protected={**frozen["artifactFileHashes"],**frozen["acceptedP1AFileHashes"]}
    protected.update({name:file_hash(ROOT/name) for name in ("P2_BASELINE_FREEZE_MANIFEST.json","P2_FINAL_REPORT.md")})
    write_immutable_json(ROOT/"p2_1_historical_v1_0_hashes.json",protected)
    config=config_from_dict(json.loads((ROOT/"p2_controller_config.json").read_text()))
    scenario=scenarios()[0]
    result=run_baseline(scenario,config)
    with (ROOT/"p2_normal_winter.csv").open() as source:
        rows=list(csv.DictReader(source))
    assert len(rows)==len(result.frames)==288
    for row,frame in zip(rows,result.frames):
        for key,state in frame.buildings.items():
            assert float(row[f"{key}_indoor_c"])==state.indoor_temperature_c
    data=building_diagnostic(scenario.parameters(),result)
    data["staticAuthority"]=[authority(scenario.parameters(),config,t) for t in (-10,-5)]
    write_immutable_json(ROOT/"p2_1_diagnostic_v1_0.json",data)
    (ROOT/"P2_1_BUILDING_DIAGNOSTIC_V1_0.md").write_text(diagnostic_markdown(data,"P2.1 Building Diagnostic — Historical v1.0"))
    print(json.dumps({"csvReplay":"EXACT","mismatch":data["normalizedShareMismatch"],
        "severeBuildings":[r["buildingId"] for r in data["buildings"] if r["severeOverheatingFrames"]],
        "underheatingBuildings":[r["buildingId"] for r in data["buildings"] if r["underheatingFrames"]]},indent=2))


if __name__=="__main__":main()
