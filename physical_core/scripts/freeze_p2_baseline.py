"""Freeze verified local P2 evidence, or verify an existing immutable reference."""
import csv
from dataclasses import asdict
import json
from pathlib import Path
import sys

from ai_heating_core.benchmark.freeze import file_hash, verify_file_hashes, verify_freeze, write_immutable_json
from ai_heating_core.benchmark.metrics import METRIC_VERSION
from ai_heating_core.benchmark.runner import evaluate
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core.p2_scenarios import scenarios
from run_p2_baselines import row_for

ROOT=Path(__file__).resolve().parents[2]


def read(name):
    return json.loads((ROOT/name).read_text())


def main():
    if (ROOT/"P2_BASELINE_FREEZE_MANIFEST.json").exists() or "--verify" in sys.argv:
        errors=verify_freeze(ROOT)
        print(json.dumps({"freezeVerification":"FAIL" if errors else "PASS","changedOrMissingFiles":errors}))
        return bool(errors)

    gates=read("p2_gate_results.json")
    commands=read("p2_validation_commands.json")
    fairness=read("p2_fairness_review.json")
    adequacy=read("p2_adequacy_review.json")
    accepted=read("p2_accepted_p1a_manifest.json")["files"]
    if gates["passed"]!=20 or gates["failed"] or gates["skipped"] or any(g["status"]!="PASS" for g in gates["gates"]):
        raise ValueError("All 20 P2 Gates must pass before freezing")
    if len(commands)!=5 or any(c["exitCode"] or c["failed"] or c["skipped"] for c in commands):
        raise ValueError("P2/P1A/P0 regression commands must pass without skipped tests")
    if not fairness["freezeEligible"] or fairness["selfReviewStatus"]!="FAIR_WITH_DISCLOSED_LIMITATIONS":
        raise ValueError("Fairness review does not permit freeze")
    if verify_file_hashes(ROOT,accepted):
        raise ValueError("Accepted P1A files changed")

    config_payload=adequacy["config"]
    config=config_from_dict(config_payload)
    scenario_manifest=read("p2_baseline_scenarios.json")
    if content_hash(scenario_manifest)!=content_hash([s.manifest(config) for s in scenarios()]):
        raise ValueError("Exported scenario manifest differs from executed definitions")
    summaries=read("p2_baseline_summaries.json")
    replay=[]
    for scenario,expected in zip(scenarios(),summaries,strict=True):
        initial=read(f"p2_initial_states/{scenario.scenario_id}.json")
        result=evaluate(scenario,config,initial)
        with (ROOT/f"p2_{scenario.scenario_id}.csv").open(newline="") as source:
            exported=list(csv.DictReader(source))
        actual=[{k:str(v) for k,v in row_for(f,c).items()} for f,c in zip(result.frames,result.controller_states,strict=True)]
        if exported!=actual or result.summary!=expected:
            raise ValueError(f"Exported CSV/summary fails exact restored replay: {scenario.scenario_id}")
        if len(list((ROOT/"p2_validation_plots"/scenario.scenario_id).glob("*.png")))!=6:
            raise ValueError("Six engineering plots required per scenario")
        replay.append({"scenarioId":scenario.scenario_id,"csvRows":len(exported),"csvColumns":len(exported[0]),"exactCsvAndSummaryReplay":True})

    required_docs=["P2_IMPLEMENTATION_PLAN.md","P2_TRADITIONAL_CONTROL_SPEC.md","p2_commissioning_report.md",
                   "P2_GATE_RESULTS.md","P2_BASELINE_FAIRNESS_REVIEW.md"]
    if any(not (ROOT/name).is_file() for name in required_docs):
        raise ValueError("Required pre-freeze review document missing")
    write_immutable_json(ROOT/"p2_controller_config.json",config_payload)
    patterns=["p2_*.json","p2_*.csv","P2_*.md","p2_commissioning_report.md","p2_initial_states/*.json",
              "p2_validation_plots/*/*.png","physical_core/src/ai_heating_core/control/*.py",
              "physical_core/src/ai_heating_core/benchmark/*.py","physical_core/src/ai_heating_core/p2_scenarios.py",
              "physical_core/tests/test_p2_*.py","physical_core/scripts/*p2*.py"]
    paths={p for pattern in patterns for p in ROOT.glob(pattern) if p.name!="P2_FINAL_REPORT.md"}
    artifacts={str(p.relative_to(ROOT)):file_hash(p) for p in sorted(paths)}
    core={p:h for p,h in accepted.items() if p.startswith("physical_core/src/")}
    manifest={
        "schemaVersion":"p2-baseline-freeze-v1","controllerVersion":config.version,
        "controllerConfigHash":content_hash(config_payload),
        "P1APhysicalCoreVersion":"accepted-p1a-sha256:"+content_hash(core),
        "P1AParameterSetHash":content_hash(asdict(synthetic_parameters())),
        "scenarioVersions":{s["scenarioId"]:s["scenarioVersion"] for s in scenario_manifest},
        "scenarioManifestHash":content_hash(scenario_manifest),
        "scenarioParameterHashes":{s.scenario_id:content_hash(asdict(s.parameters())) for s in scenarios()},
        "commissioningResultHash":content_hash(adequacy["commissioning"]),
        "metricDefinitionVersion":METRIC_VERSION,"warmupPolicyVersion":"daily-repeat-96h-convergence-v1",
        "testSuiteResult":{"P2":{"passed":20,"failed":0,"skipped":0},
            "P1AGates":next(g["measured"]["gatePassCount"] for g in gates["gates"] if g["gate"]=="G2.18"),
            "commands":[{k:v for k,v in c.items() if k!="output"} for c in commands],"exportReplay":replay},
        "acceptedP1AFileHashes":accepted,"artifactFileHashes":artifacts,
        "hashAlgorithm":"SHA-256; file tables hash raw bytes; domain hashes use sorted compact JSON, finite values only",
        "freezeStatus":"LOCAL_VERSIONED_REFERENCE_PENDING_EXTERNAL_ACCEPTANCE",
        "fairnessStatus":fairness["selfReviewStatus"],"externalReviewRequired":True,
        "scope":"Traditional controller only; no P3; no P0/P1A physical changes",
        "immutabilityPolicy":"Never silently update this version. Verify hashes before comparison; changes require a new explicitly approved P2 version.",
        "reportBinding":"P2_FINAL_REPORT.md references this manifest and is excluded to avoid circular hashes. This manifest is not a signed or write-protected Git release."
    }
    write_immutable_json(ROOT/"P2_BASELINE_FREEZE_MANIFEST.json",manifest)
    errors=verify_freeze(ROOT)
    if errors:
        raise ValueError(f"New freeze verification failed: {errors}")
    print(f"P2 freeze: PASS; {len(artifacts)} artifacts + {len(accepted)} accepted P1A files verified")
    print(json.dumps(replay,indent=2))
    print("controllerConfigHash="+manifest["controllerConfigHash"])
    return 0


if __name__=="__main__":
    raise SystemExit(main())
