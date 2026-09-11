"""Run P5 and every inherited frozen regression, recording command evidence."""
import json
from pathlib import Path
import re
import subprocess
import sys

from ai_heating_core.benchmark.freeze import verify_file_hashes


ROOT = Path(__file__).resolve().parents[2]


def command(label, args, timeout=1200):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True,
                            timeout=timeout)
    output = result.stdout + result.stderr
    counts = {name: int(match.group(1)) if
              (match := re.search(rf"(\d+) {name}", output)) else 0
              for name in ("passed", "failed", "skipped")}
    record = {"label": label, "command": " ".join(args),
              "exitCode": result.returncode, **counts, "output": output[-12000:]}
    print(f"{label}: exit {result.returncode}; {counts}", flush=True)
    return record


def main():
    freeze = json.loads((ROOT / "P2_BASELINE_FREEZE_MANIFEST_v1.2.json").read_text())
    frozen_groups = freeze["acceptedP1AFileHashes"], freeze["artifactFileHashes"]
    freeze_before = sum((verify_file_hashes(ROOT, group) for group in frozen_groups), [])

    commands = [
        command("P5 identifiability and dataset gates",
                [sys.executable, "physical_core/scripts/run_p5_identifiability.py"]),
        command("P5 calibration and prediction gates",
                [sys.executable, "physical_core/scripts/run_p5_calibration.py"]),
        command("P5 tests", [sys.executable, "-m", "pytest",
                              "physical_core/tests/test_p5.py", "-q"]),
        command("P4 UI/provider invariants",
                ["npx", "tsx", "scripts/p4-invariants.ts"]),
        command("P4 artifact and hash verification",
                [sys.executable, "physical_core/scripts/run_p4_gates.py"]),
        command("P4/P3/P2/P1A/P0 inherited regression",
                [sys.executable, "physical_core/scripts/run_p4_regression.py"]),
    ]

    p5_gates = json.loads((ROOT / "p5_gate_results.json").read_text())
    p4_gates = json.loads((ROOT / "p4_gate_results.json").read_text())
    p4_regression = json.loads((ROOT / "p4_regression_results.json").read_text())
    p4_p1 = next(gate for gate in p4_gates["gates"] if gate["gate"] == "P4-P1")
    p4_p12 = next(gate for gate in p4_gates["gates"] if gate["gate"] == "P4-P12")
    freeze_after = sum((verify_file_hashes(ROOT, group) for group in frozen_groups), [])

    result = {
        "phase": "P5 regression",
        "commands": commands,
        "inheritedCommandEvidence": p4_regression["commands"],
        "browserUITests": {"skipped": 1,
            "reason": "P5 made no UI-visible change; browser run not required"},
        "P5Gates": {"passed": p5_gates["passed"],
                     "failed": p5_gates["failed"],
                     "skipped": p5_gates["skipped"]},
        "P4Gates": {"passed": p4_gates["passed"],
                     "failed": p4_gates["failed"],
                     "skipped": p4_gates["skipped"]},
        "P3IntegrityErrors": p4_p1["measured"]["p3Errors"],
        "P2IntegrityErrors": p4_p1["measured"]["p2Errors"],
        "P4ArtifactHashErrors": p4_p12["measured"]["artifactHashErrors"],
        "freezeErrorsBefore": freeze_before,
        "freezeErrorsAfter": freeze_after,
        "inheritedRegressionPassed": p4_regression["passed"],
    }
    result["passed"] = (all(item["exitCode"] == 0 for item in commands)
        and p5_gates["failed"] == 0 and p4_gates["failed"] == 0
        and not result["P3IntegrityErrors"] and not result["P2IntegrityErrors"]
        and not result["P4ArtifactHashErrors"] and not freeze_before
        and not freeze_after and p4_regression["passed"])
    (ROOT / "p5_regression_results.json").write_text(
        json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(f"P5 regression: {'PASS' if result['passed'] else 'FAIL'}", flush=True)
    return not result["passed"]


if __name__ == "__main__":
    raise SystemExit(main())
