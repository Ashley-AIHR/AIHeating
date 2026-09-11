"""Capture actual regression outputs; historical evidence is never exported over."""
import json
from pathlib import Path
import re
import subprocess
import sys

from ai_heating_core.benchmark.freeze import verify_file_hashes, verify_freeze

ROOT=Path(__file__).resolve().parents[2]


def main():
    python=sys.executable
    commands=[("New fixture tests",[python,"-m","pytest","physical_core/tests/test_physical_fixture_v1_1.py","-q"]),
        ("Historical/default full Python regression",[python,"-m","pytest","physical_core/tests","-q"]),
        ("P1A Gates with v1.1 fixture",[python,"physical_core/scripts/run_p2_1_regression.py","gates-p1a"]),
        ("P2 Gates with v1.1 fixture and nested regressions",[python,"physical_core/scripts/run_p2_1_regression.py","gates-p2"])]
    results=[]
    for label,args in commands:
        run=subprocess.run(args,cwd=ROOT,capture_output=True,text=True,timeout=240)
        output=run.stdout+run.stderr
        counts={name:[int(n) for n in re.findall(rf"(\d+) {name}",output)] for name in ("passed","failed","skipped")}
        results.append({"label":label,"command":" ".join(args),"exitCode":run.returncode,
            **{k:v[-1] if v else 0 for k,v in counts.items()},"output":output})
        print(label+f": exit {run.returncode}\n"+output,flush=True)
    nested=json.loads((ROOT/"p2_1_p2_gate_results.json").read_text())["commands"]
    historical=json.loads((ROOT/"p2_1_historical_v1_0_hashes.json").read_text())
    changed=verify_file_hashes(ROOT,historical)
    result={"commands":results,"nestedActualCommands":nested,"historicalFileCount":len(historical),
        "changedHistoricalFiles":changed,"historicalFreezeErrors":verify_freeze(ROOT),
        "status":"PASS" if not changed and not any(r["exitCode"] for r in results+nested) else "FAIL"}
    (ROOT/"p2_1_validation_commands.json").write_text(json.dumps(result,indent=2,allow_nan=False)+"\n")
    return result["status"]!="PASS"


if __name__=="__main__":raise SystemExit(main())
