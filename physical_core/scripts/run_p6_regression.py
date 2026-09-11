"""Run P6 and every inherited accepted regression with hash evidence."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

from ai_heating_core.benchmark.freeze import verify_file_hashes


ROOT = Path(__file__).resolve().parents[2]


def command(label, args, timeout=1800):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True,
                            timeout=timeout)
    output = result.stdout + result.stderr
    counts = {name: int(match.group(1)) if
              (match := re.search(rf"(\d+) {name}", output)) else 0
              for name in ("passed", "failed", "skipped")}
    print(f"{label}: exit {result.returncode}; {counts}", flush=True)
    return {"label": label, "command": " ".join(args),
            "exitCode": result.returncode, **counts, "output": output[-12000:]}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def registry_errors():
    registry = json.loads((ROOT / "p6_model_registry.json").read_text())
    errors = []
    for group in ("configurationHashes", "sourceHashes", "resultHashes"):
        for name, expected in registry[group].items():
            if digest(ROOT / name) != expected:
                errors.append(f"{group}:{name}")
    dependencies = registry["dependencies"]
    checks = ((dependencies["P1A"]["freezeManifest"],
               dependencies["P1A"]["freezeManifestHash"]),
              (dependencies["P2"]["controllerConfig"],
               dependencies["P2"]["controllerConfigHash"]),
              (dependencies["P3"]["generationManifest"],
               dependencies["P3"]["generationManifestHash"]),
              (dependencies["P4"]["registry"], dependencies["P4"]["registryHash"]),
              (dependencies["P5"]["registry"], dependencies["P5"]["registryHash"]),
              (dependencies["P5"]["calibrationArtifact"],
               dependencies["P5"]["calibrationArtifactHash"]))
    errors += [f"dependency:{name}" for name, expected in checks
               if digest(ROOT / name) != expected]
    errors += [f"P3:{name}" for name, expected in
               dependencies["P3"]["canonicalManifestHashes"].items()
               if digest(ROOT / name) != expected]
    return errors


def main():
    freeze = json.loads((ROOT / "P2_BASELINE_FREEZE_MANIFEST_v1.2.json").read_text())
    groups = freeze["acceptedP1AFileHashes"], freeze["artifactFileHashes"]
    freeze_before = sum((verify_file_hashes(ROOT, group) for group in groups), [])
    commands = [
        command("P6 unit tests", [sys.executable, "-m", "pytest",
                                  "physical_core/tests/test_p6.py", "-q"]),
        command("P6 linearisation, safety, solver and canonical gates",
                [sys.executable, "physical_core/scripts/run_p6_evaluation.py"]),
        command("P5 and inherited P4/P3/P2/P1A/P0 regression",
                [sys.executable, "physical_core/scripts/run_p5_regression.py"]),
        command("P4 UI data alignment invariants",
                ["npm", "run", "test:p4-alignment"]),
    ]
    p6_gates = json.loads((ROOT / "p6_gate_results.json").read_text())
    p5_regression = json.loads((ROOT / "p5_regression_results.json").read_text())
    p4_regression = json.loads((ROOT / "p4_regression_results.json").read_text())
    registry = registry_errors()
    freeze_after = sum((verify_file_hashes(ROOT, group) for group in groups), [])
    result = {"phase": "P6 regression", "commands": commands,
        "P6Gates": {key: p6_gates[key] for key in ("passed", "failed", "skipped")},
        "P5RegressionPassed": p5_regression["passed"],
        "inheritedRegression": {"P1AGates": p4_regression["P1AGates"],
            "P2Gates": {key: p4_regression["P2Gates"][key]
                         for key in ("passed", "total")},
            "P3Gates": p4_regression["P3Gates"],
            "P4Gates": p4_regression["P4Gates"]},
        "browserUITests": {"skipped": 1,
            "reason": "P6 made no UI-visible change; browser tests are not required"},
        "P6RegistryErrors": registry, "freezeErrorsBefore": freeze_before,
        "freezeErrorsAfter": freeze_after}
    result["passed"] = (all(item["exitCode"] == 0 for item in commands)
        and p6_gates["failed"] == 0 and p5_regression["passed"]
        and not registry and not freeze_before and not freeze_after)
    (ROOT / "p6_regression_results.json").write_text(
        json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(f"P6 regression: {'PASS' if result['passed'] else 'FAIL'}", flush=True)
    return not result["passed"]


if __name__ == "__main__":
    raise SystemExit(main())
