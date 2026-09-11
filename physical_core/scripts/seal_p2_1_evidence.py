"""Hash comparison evidence only. A rejected candidate is not a baseline freeze."""
import csv
from dataclasses import asdict
import json
from pathlib import Path

from ai_heating_core.benchmark.freeze import file_hash, verify_file_hashes, verify_freeze, write_immutable_json
from ai_heating_core.benchmark.runner import evaluate
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core.p2_1_scenarios import scenarios
from ai_heating_core.physical_fixture_v1_1 import design_load_parameters
from run_p2_baselines import row_for

ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/"p2_1_candidate_results"


def main():
    historical=json.loads((ROOT/"p2_1_historical_v1_0_hashes.json").read_text())
    errors=verify_file_hashes(ROOT,historical)+verify_freeze(ROOT)
    if errors:
        raise ValueError(f"Historical evidence changed: {errors}")
    config_payload=json.loads((ROOT/"p2_1_candidate_review.json").read_text())["config"]
    config=config_from_dict(config_payload)
    summaries=json.loads((DEST/"summaries_v1.1.json").read_text())
    replay=[]
    control_keys=["raw_supply_target_c","applied_supply_setpoint_c","raw_pump_target_hz","applied_pump_frequency_hz","near_valve_pct","mid_valve_pct","far_valve_pct"]
    for s,summary in zip(scenarios(),summaries,strict=True):
        path=DEST/f"initial_state_{s.scenario_id}_v1.1.json"
        initial=json.loads(path.read_text())
        run=evaluate(s,config,initial)
        with (DEST/f"p2_{s.scenario_id}_v1.1.csv").open(newline="") as f:
            exported=list(csv.DictReader(f))
        actual=[{k:str(v) for k,v in row_for(f,c).items()} for f,c in zip(run.frames,run.controller_states,strict=True)]
        with (ROOT/f"p2_{s.scenario_id}.csv").open(newline="") as f:
            previous=list(csv.DictReader(f))
        assert actual==exported and run.summary==summary
        assert all(all(a[k]==b[k] for k in control_keys) for a,b in zip(previous,exported,strict=True))
        assert initial["physicalParameterHash"]!=json.loads((ROOT/"p2_initial_states"/f"{s.scenario_id}.json").read_text())["physicalParameterHash"]
        replay.append({"scenarioId":s.scenario_id,"rows":len(exported),"columns":len(exported[0]),
            "exactCsvAndSummaryReplay":True,"controlsExactlyMatchV1_0":True,
            "initialStateFileHash":file_hash(path),"physicalParameterHash":initial["physicalParameterHash"]})
    old,new=synthetic_parameters(),design_load_parameters()
    changed={b.building_id:[k for k in asdict(b) if asdict(b)[k]!=asdict(a)[k]] for a,b in zip(old.buildings,new.buildings)}
    assert all(keys==["flow_share_weight"] for keys in changed.values())
    assert all(asdict(old)[k]==asdict(new)[k] for k in asdict(old) if k!="buildings")
    patterns=["P2_1_*.md","p2_1_*.json","p1a_parameters_physical_fixture_v1.1.json","p2_1_candidate_results/**/*",
        "physical_core/src/ai_heating_core/physical_fixture_v1_1.py","physical_core/src/ai_heating_core/p2_1_scenarios.py",
        "physical_core/src/ai_heating_core/benchmark/allocation_diagnostics.py","physical_core/scripts/*p2_1*.py",
        "physical_core/tests/test_physical_fixture_v1_1.py"]
    paths={p for pattern in patterns for p in ROOT.glob(pattern) if p.is_file()}
    record={"schemaVersion":"fixture-candidate-evidence-v1","physicalFixtureVersion":"physical-fixture-v1.1",
        "candidateControllerIdentity":"traditional-v1.1","candidateAcceptance":"FAIL_UNRESOLVED_AUTHORITY_CONFLICT",
        "baselinePromotion":False,"supersedesV1_0":False,"P3Started":False,
        "controllerConfigHash":content_hash(config_payload),"physicalParameterHash":content_hash(asdict(new)),
        "changedProfileFields":changed,"exportReplay":replay,"historicalFileCount":len(historical),
        "historicalFileHashes":historical,"artifactFileHashes":{str(p.relative_to(ROOT)):file_hash(p) for p in sorted(paths)},
        "meaning":"Integrity/replay record of an unaccepted candidate; NOT P2_BASELINE_FREEZE_MANIFEST_v1.1.json. External review required."}
    write_immutable_json(ROOT/"P2_1_CANDIDATE_EVIDENCE_MANIFEST.json",record)
    print(f"Candidate evidence verified: {len(paths)} files; {len(historical)} historical files unchanged; 5 exact replays; baselinePromotion=false")
    return 0


if __name__=="__main__":raise SystemExit(main())
