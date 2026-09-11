"""Run accepted P1A/P2 suites and Gates under fixture v1.2 without old report writes."""
from contextlib import ExitStack
import importlib
import json
from pathlib import Path
import sys
from unittest.mock import patch

import pytest

from ai_heating_core.physical_fixture_v1_2 import coherent_parameters

ROOT = Path(__file__).resolve().parents[2]
P1A_FILES = ["test_hydraulics.py", "test_transport.py", "test_thermal.py", "test_validation.py", "test_simulation.py"]
P2_FILES = ["test_p2_control.py", "test_p2_benchmark.py", "test_p2_freeze.py"]


def fixture_context():
    stack = ExitStack()
    for name in ("parameters", "simulation", "scenarios", "p2_scenarios"):
        module = importlib.import_module("ai_heating_core." + name)
        stack.enter_context(patch.object(module, "synthetic_parameters", coherent_parameters))
    return stack


def main():
    mode = sys.argv[1]
    with fixture_context():
        if mode in ("p1a", "p2"):
            files = P1A_FILES if mode == "p1a" else P2_FILES
            print("Fixture override: physical-fixture-v1.2; assertions/thresholds unchanged", flush=True)
            return pytest.main([*[str(ROOT / "physical_core/tests" / name) for name in files], "-q"])
        if mode == "gates-p1a":
            import run_gate_suite
            records = run_gate_suite.evaluate_gates()
            result = {"fixtureVersion": "physical-fixture-v1.2", "gates": records,
                "passed": sum(r["status"] == "PASS" for r in records),
                "failed": sum(r["status"] != "PASS" for r in records), "skipped": 0}
            (ROOT / "p1_2_p1a_gate_results.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
            print(f"P1A Gates under v1.2: {result['passed']} passed, {result['failed']} failed")
            return bool(result["failed"])
        raise ValueError("Choose p1a, p2 or gates-p1a")


if __name__ == "__main__":
    raise SystemExit(main())
