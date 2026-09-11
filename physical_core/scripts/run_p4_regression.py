"""Run inherited regressions under the accepted v1.2 fixture without rewriting frozen evidence."""
import json
from pathlib import Path
import re
import subprocess
import sys
from unittest.mock import patch

from ai_heating_core.benchmark.freeze import verify_file_hashes
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.p1_2_scenarios import scenarios
from run_p1_2_regression import fixture_context

ROOT = Path(__file__).resolve().parents[2]


def command(label, args, timeout=600):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    output = result.stdout + result.stderr
    counts = {key: int(match.group(1)) if (match := re.search(rf"(\d+) {key}", output)) else 0
              for key in ("passed", "failed", "skipped")}
    print(f"{label}: exit {result.returncode}; {counts}", flush=True)
    return {"label":label,"command":" ".join(args),"exitCode":result.returncode,**counts,"output":output[-12000:]}


def main():
    freeze = json.loads((ROOT / "P2_BASELINE_FREEZE_MANIFEST_v1.2.json").read_text())
    before = verify_file_hashes(ROOT, freeze["acceptedP1AFileHashes"]) + verify_file_hashes(ROOT, freeze["artifactFileHashes"])
    p4_tests = command("P4 model/leakage/Preview tests", [sys.executable,"-m","pytest","physical_core/tests/test_p4.py","-q"])
    p3_tests = command("P3 tests", [sys.executable,"-m","pytest","physical_core/tests/test_p3_dataset.py","-q"])
    import run_gate_suite
    import run_p2_gate_suite as p2
    original = p2.run_command
    def accepted_tests(label, args):
        if label in ("P1A tests", "P2 tests"):
            args = [sys.executable, str(Path(__file__).with_name("run_p1_2_regression.py")), "p1a" if label == "P1A tests" else "p2"]
        return original(label, args)
    config = json.loads((ROOT / "p2_controller_config_v1.2.json").read_text())
    with fixture_context():
        p1a = run_gate_suite.evaluate_gates()
        with patch.object(p2,"config_from_dict",lambda _:config_from_dict(config)), patch.object(p2,"scenarios",scenarios), patch.object(p2,"run_command",accepted_tests):
            p2_gates, inherited_commands = p2.evaluate_p2()
    legacy = next(item for item in p2_gates if item["gate"] == "G2.19")
    p0_commands = inherited_commands[-3:]
    domain_diff = subprocess.run(["git","diff","--exit-code","HEAD","--","src/domain.ts","src/chart.ts","P0_FUTURE_API_SEAMS.md"], cwd=ROOT, capture_output=True, text=True)
    legacy["notes"] = "P4 explicitly authorizes UI/provider extension. The legacy whole-P0-tree diff is recorded, while frozen domain/seam files, control-mode semantics, typecheck, tests and build are enforced."
    legacy["measured"]["legacyWholeP0DiffExit"] = legacy["measured"].pop("frozenSourceDiffExit")
    legacy["measured"]["frozenDomainSeamDiffExit"] = domain_diff.returncode
    legacy["passed"] = all(item["exitCode"] == 0 for item in p0_commands) and domain_diff.returncode == 0
    legacy["status"] = "PASS" if legacy["passed"] else "FAIL"
    after = verify_file_hashes(ROOT, freeze["acceptedP1AFileHashes"]) + verify_file_hashes(ROOT, freeze["artifactFileHashes"])
    p3_gates = json.loads((ROOT / "p3_gate_results.json").read_text())["gates"]
    p4_gates = json.loads((ROOT / "p4_gate_results.json").read_text())["gates"]
    result = {"phase":"P4 regression","commands":[p4_tests,p3_tests,*inherited_commands],
        "P1AGates":{"passed":sum(g["status"]=="PASS" for g in p1a),"total":len(p1a)},
        "P2Gates":{"passed":sum(g["status"]=="PASS" for g in p2_gates),"total":len(p2_gates),"gates":p2_gates},
        "P3Gates":{"passed":sum(g["status"]=="PASS" for g in p3_gates),"total":len(p3_gates),"datasetIntegrityVerifiedBy":"P4-P1"},
        "P4Gates":{"passed":sum(g["status"]=="PASS" for g in p4_gates),"total":len(p4_gates)},
        "freezeErrorsBefore":before,"freezeErrorsAfter":after,"legacyG2_19WholeP0DiffExit":legacy["measured"]["legacyWholeP0DiffExit"]}
    result["passed"] = not before and not after and all(item["exitCode"] == 0 for item in result["commands"]) and all(result[key]["passed"] == result[key]["total"] for key in ("P1AGates","P2Gates","P3Gates","P4Gates"))
    (ROOT / "p4_regression_results.json").write_text(json.dumps(result,indent=2,sort_keys=True,allow_nan=False)+"\n")
    print(f"P4 regression: {'PASS' if result['passed'] else 'FAIL'}", flush=True)
    return not result["passed"]


if __name__ == "__main__":
    raise SystemExit(main())
