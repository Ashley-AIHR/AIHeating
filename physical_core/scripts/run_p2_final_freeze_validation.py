"""Run and record the affected scenario check plus the complete v1.2 regression."""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def command(label, args):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=360)
    output = result.stdout + result.stderr
    match = re.search(r"(\d+) passed", output)
    record = {"label": label, "command": " ".join(args), "exitCode": result.returncode,
              "passed": int(match.group(1)) if match else None, "output": output}
    print(f"{label}: exit {result.returncode}; passed={record['passed']}", flush=True)
    return record


def main():
    affected = command("Hydraulic Imbalance adequacy test", [sys.executable, "-m", "pytest",
                       "physical_core/tests/test_p2_final_scenario_adequacy.py", "-q"])
    full = command("Full v1.2 validation", [sys.executable,
                   "physical_core/scripts/run_p1_2_validation.py"])
    validation = json.loads((ROOT / "p1_2_validation_results.json").read_text())
    output = {"phase": "P2 v1.2 final freeze validation", "affectedScenarioCommand": affected,
        "fullValidationCommand": full, "sizingGatePasses": sum(g["status"] == "PASS" for g in validation["sizingGates"]),
        "P1AGatePasses": sum(g["status"] == "PASS" for g in validation["P1AGates"]),
        "P2GatePasses": sum(g["status"] == "PASS" for g in validation["P2Gates"]),
        "regressionCommands": validation["commands"], "historicalFileChanges": validation["historicalFileChanges"],
        "status": "PASS" if affected["exitCode"] == full["exitCode"] == 0 and validation["failed"] == 0
                  and not validation["historicalFileChanges"] else "FAIL"}
    (ROOT / "p2_final_freeze_validation_v1.2.json").write_text(json.dumps(output, indent=2, allow_nan=False) + "\n")
    print(f"P2 final freeze validation: {output['status']}")
    return output["status"] != "PASS"


if __name__ == "__main__":
    raise SystemExit(main())
