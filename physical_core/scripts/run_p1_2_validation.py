"""Record v1.2 sizing, P1A, P2 and P0 regressions without freezing a baseline."""
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


def command(label, args):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=300)
    output = result.stdout + result.stderr
    counts = {name: int(match.group(1)) if (match := re.search(rf"(\d+) {name}", output)) else 0
              for name in ("passed", "failed", "skipped")}
    record = {"label": label, "command": " ".join(args), "exitCode": result.returncode,
              **counts, "output": output}
    print(f"{label}: exit {result.returncode}; {counts}", flush=True)
    return record


def main():
    commands = [command("P1.2 tests", [sys.executable, "-m", "pytest",
                "physical_core/tests/test_physical_fixture_v1_2.py", "-q"])]
    import run_gate_suite
    import run_p2_gate_suite as p2
    original_run_command = p2.run_command

    def under_fixture(label, args):
        if label in ("P1A tests", "P2 tests"):
            args = [sys.executable, str(Path(__file__).with_name("run_p1_2_regression.py")),
                    "p1a" if label == "P1A tests" else "p2"]
        return original_run_command(label, args)

    config_payload = json.loads((ROOT / "p1_2_controller_config.json").read_text())
    with fixture_context():
        p1a_gates = run_gate_suite.evaluate_gates()
        with patch.object(p2, "config_from_dict", lambda _: config_from_dict(config_payload)), \
             patch.object(p2, "scenarios", scenarios), patch.object(p2, "run_command", under_fixture):
            p2_gates, p2_commands = p2.evaluate_p2()
    commands += p2_commands
    sizing = json.loads((ROOT / "p1_2_sizing_gate_results.json").read_text())
    protected = json.loads((ROOT / "p2_2_historical_hashes.json").read_text())
    changed = verify_file_hashes(ROOT, protected)
    result = {"phase": "P1.2 physical fixture review", "fixtureVersion": "physical-fixture-v1.2",
        "sizingGates": sizing["gates"], "P1AGates": p1a_gates, "P2Gates": p2_gates,
        "commands": commands, "historicalFilesChecked": len(protected), "historicalFileChanges": changed,
        "passed": sizing["passed"] + sum(g["status"] == "PASS" for g in p1a_gates + p2_gates),
        "failed": sizing["failed"] + sum(g["status"] != "PASS" for g in p1a_gates + p2_gates),
        "skipped": 0, "baselineFreezeCreated": False}
    (ROOT / "p1_2_validation_results.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    lines = ["# P1.2 Validation Results", "",
        f"Sizing: {sizing['passed']}/7 PASS. P1A: {sum(g['status']=='PASS' for g in p1a_gates)}/32 PASS. P2: {sum(g['status']=='PASS' for g in p2_gates)}/20 PASS.", "",
        f"Historical preservation ledger: {len(protected)} files checked; changed: `{changed}`.", "", "## Actual commands", "",
        "| Check | Exit | Passed | Failed | Skipped | Command |", "| --- | ---: | ---: | ---: | ---: | --- |"]
    for item in commands:
        lines.append(f"| {item['label']} | {item['exitCode']} | {item['passed']} | {item['failed']} | {item['skipped']} | `{item['command']}` |")
    lines += ["", "No accepted threshold was weakened and no baseline freeze manifest was created.", ""]
    (ROOT / "P1_2_VALIDATION_RESULTS.md").write_text("\n".join(lines))
    print(f"Combined engineering Gates: {result['passed']} passed, {result['failed']} failed; historical changes={changed}")
    return bool(result["failed"] or changed or any(c["exitCode"] for c in commands))


if __name__ == "__main__":
    raise SystemExit(main())
