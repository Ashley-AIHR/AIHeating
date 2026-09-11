"""Run untouched accepted suites with an explicit process-local fixture injection.

Only parameter factories are rebound, before test collection. No source/expected
value/threshold is edited. The ordinary historical invocation remains unchanged.
"""
from contextlib import ExitStack
import importlib
import json
from pathlib import Path
import sys
from unittest.mock import patch

import pytest

from ai_heating_core.physical_fixture_v1_1 import design_load_parameters

ROOT=Path(__file__).resolve().parents[2]
P1A_FILES=["test_hydraulics.py","test_transport.py","test_thermal.py","test_validation.py","test_simulation.py"]
P2_FILES=["test_p2_control.py","test_p2_benchmark.py","test_p2_freeze.py"]


def fixture_context():
    stack=ExitStack()
    for name in ("parameters","simulation","scenarios","p2_scenarios"):
        module=importlib.import_module("ai_heating_core."+name)
        stack.enter_context(patch.object(module,"synthetic_parameters",design_load_parameters))
    return stack


def main():
    mode=sys.argv[1]
    with fixture_context():
        if mode in ("p1a","p2"):
            files=P1A_FILES if mode=="p1a" else P2_FILES
            print("Fixture override: physical-fixture-v1.1; assertions/thresholds unchanged",flush=True)
            return pytest.main([*[str(ROOT/"physical_core/tests"/p) for p in files],"-q"])
        if mode=="gates-p1a":
            import run_gate_suite
            records=run_gate_suite.evaluate_gates()  # Never call historical main/export.
            result={"fixtureVersion":"physical-fixture-v1.1","gates":records,
                "passed":sum(r["status"]=="PASS" for r in records),"failed":sum(r["status"]!="PASS" for r in records),"skipped":0}
            (ROOT/"p2_1_p1a_gate_results.json").write_text(json.dumps(result,indent=2,allow_nan=False)+"\n")
            print(f"P1A Gates under v1.1: {result['passed']} passed, {result['failed']} failed, 0 skipped")
            return bool(result["failed"])
        if mode=="gates-p2":
            import run_p2_gate_suite as suite
            from ai_heating_core.control.traditional import config_from_dict
            from ai_heating_core.p2_1_scenarios import scenarios
            payload=json.loads((ROOT/"p2_1_candidate_review.json").read_text())["config"]
            run_command=suite.run_command
            def under_fixture(label,args):
                if label in ("P1A tests","P2 tests"):
                    args=[sys.executable,str(Path(__file__).resolve()),"p1a" if label=="P1A tests" else "p2"]
                return run_command(label,args)
            # Legacy suite has no config argument. Rebind its INPUT providers,
            # not checks, outcomes, metrics, thresholds or controller functions.
            with patch.object(suite,"config_from_dict",lambda _:config_from_dict(payload)), \
                 patch.object(suite,"scenarios",scenarios),patch.object(suite,"run_command",under_fixture):
                records,commands=suite.evaluate_p2()
            result={"fixtureVersion":"physical-fixture-v1.1","controllerVersion":"traditional-v1.1",
                "inputAdapter":"Process-local static parameter/config/scenario providers; same Gate checks and thresholds",
                "gates":records,"commands":commands,"passed":sum(r["status"]=="PASS" for r in records),
                "failed":sum(r["status"]!="PASS" for r in records),"skipped":0}
            (ROOT/"p2_1_p2_gate_results.json").write_text(json.dumps(result,indent=2,allow_nan=False)+"\n")
            print(f"P2 Gates under v1.1: {result['passed']} passed, {result['failed']} failed, 0 skipped")
            return bool(result["failed"] or any(c["exitCode"] for c in commands))
        raise ValueError("Choose p1a, p2, gates-p1a or gates-p2")


if __name__=="__main__":raise SystemExit(main())
