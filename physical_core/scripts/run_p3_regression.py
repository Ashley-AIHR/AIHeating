"""Run P0/P1A/P2/P3 regressions without rewriting frozen evidence."""
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
    completed = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    output = completed.stdout + completed.stderr
    counts = {name: int(match.group(1)) if (match := re.search(rf"(\d+) {name}", output)) else 0
              for name in ("passed", "failed", "skipped")}
    print(f"{label}: exit {completed.returncode}; {counts}", flush=True)
    return {"label": label, "command": " ".join(args), "exitCode": completed.returncode,
            **counts, "output": output[-12000:]}


def main():
    freeze = json.loads((ROOT / "P2_BASELINE_FREEZE_MANIFEST_v1.2.json").read_text())
    before = verify_file_hashes(ROOT, freeze["acceptedP1AFileHashes"]) + verify_file_hashes(ROOT, freeze["artifactFileHashes"])
    p3_command = command("P3 tests", [sys.executable, "-m", "pytest",
        "physical_core/tests/test_p3_dataset.py", "-q"])
    fixture_command = command("P1.2 tests", [sys.executable, "-m", "pytest",
        "physical_core/tests/test_physical_fixture_v1_2.py", "-q"])
    import run_gate_suite
    import run_p2_gate_suite as p2
    original_run_command = p2.run_command

    def under_fixture(label, args):
        if label in ("P1A tests", "P2 tests"):
            args = [sys.executable, str(Path(__file__).with_name("run_p1_2_regression.py")),
                    "p1a" if label == "P1A tests" else "p2"]
        return original_run_command(label, args)

    config_payload = json.loads((ROOT / "p2_controller_config_v1.2.json").read_text())
    with fixture_context():
        p1a_gates = run_gate_suite.evaluate_gates()
        with patch.object(p2, "config_from_dict", lambda _: config_from_dict(config_payload)), \
             patch.object(p2, "scenarios", scenarios), patch.object(p2, "run_command", under_fixture):
            p2_gates, commands = p2.evaluate_p2()
    after = verify_file_hashes(ROOT, freeze["acceptedP1AFileHashes"]) + verify_file_hashes(ROOT, freeze["artifactFileHashes"])
    all_commands = [p3_command, fixture_command, *commands]
    result = {"phase": "P3 regression", "commands": all_commands,
        "P1AGates": {"passed": sum(g["status"] == "PASS" for g in p1a_gates), "total": len(p1a_gates)},
        "P2Gates": {"passed": sum(g["status"] == "PASS" for g in p2_gates), "total": len(p2_gates)},
        "freezeErrorsBefore": before, "freezeErrorsAfter": after}
    result["passed"] = (not before and not after and all(c["exitCode"] == 0 for c in all_commands)
        and result["P1AGates"]["passed"] == result["P1AGates"]["total"]
        and result["P2Gates"]["passed"] == result["P2Gates"]["total"])
    (ROOT / "p3_regression_results.json").write_text(json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(f"P3 regression: {'PASS' if result['passed'] else 'FAIL'}", flush=True)
    return not result["passed"]


if __name__ == "__main__":
    raise SystemExit(main())
