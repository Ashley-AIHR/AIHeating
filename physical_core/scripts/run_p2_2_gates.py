"""Measured F1–F17 plus all accepted regressions, without old report writes."""
import csv
from dataclasses import asdict
import json
from math import prod
from pathlib import Path
import re
import subprocess
import sys
from unittest.mock import patch

from ai_heating_core.benchmark.freeze import verify_file_hashes
from ai_heating_core.benchmark.runner import evaluate
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.p2_1_scenarios import scenarios
from ai_heating_core.physical_fixture_v1_1 import design_load_parameters
from ai_heating_core.static_envelope_analysis import BOUNDS, StaticEvaluator
from run_p2_baselines import row_for
from run_p2_1_regression import fixture_context

ROOT=Path(__file__).resolve().parents[2]


def read(name):return json.loads((ROOT/name).read_text())


def command(label,args):
    r=subprocess.run(args,cwd=ROOT,capture_output=True,text=True,timeout=240)
    output=r.stdout+r.stderr
    values={name:int(m.group(1)) if (m:=re.search(rf"(\d+) {name}",output)) else 0 for name in ("passed","failed","skipped")}
    result={"label":label,"command":" ".join(args),"exitCode":r.returncode,**values,"output":output}
    print(f"{label}: exit {r.returncode}; {values}",flush=True)
    return result


def valid_certificate(certificate):
    intervals=sorted(certificate["excludedIntervals"],key=lambda r:r["flowIntervalM3s"][0])
    return certificate["certifiedInfeasible"] and bool(intervals) and intervals[0]["flowIntervalM3s"][0]==0 and intervals[-1]["flowIntervalM3s"][1]==certificate["relaxedFlowBoundsM3s"][1] and all(a["flowIntervalM3s"][1]==b["flowIntervalM3s"][0] for a,b in zip(intervals,intervals[1:])) and all(r["requiredSupplyLowerBoundC"]>r["allowedSupplyUpperBoundC"]+1e-7 for r in intervals)


def main():
    search=read("p2_2_static_feasible_envelope.json");shadow=read("p2_2_zone_commissioning_results.json")
    objectives=[o for case in search["cases"] for o in case["objectives"]]
    e=StaticEvaluator(design_load_parameters())
    rechecks=[]
    for case in search["cases"]:
        for o in case["objectives"]:
            checked=e.annotate(e.evaluate(o["best"]["actuatorVector"],case["outdoorC"]),o["band"],o["scope"])
            rechecks.append(abs(checked["objectiveMaxViolationC"]-o["best"]["objectiveMaxViolationC"])<1e-9)
    gates=[]
    def gate(n,description,measured,threshold,ok):
        gates.append({"gate":f"F{n}","description":description,"measured":measured,"threshold":threshold,"status":"PASS" if ok else "FAIL"})
    axes=search["coarseAxes"]
    full_grid=prod(map(len,axes))
    gate(1,"Legal envelope coverage",{"bounds":search["bounds"],"coarseAxes":axes,"gridPerCase":full_grid,"refinementSteps":search["refinementSteps"],"seeds":search["continuousSeeds"]},"whole legal box; 8250 grid points/case and global bounded search",full_grid==8250 and all(a[0]==b[0] and a[-1]==b[1] for a,b in zip(axes,BOUNDS)))
    gate(2,"Accepted coupled solver backs candidate flows",search["audit"],"nonzero actual solver calls; normalized residual <1e-8; no manual candidate flows",search["audit"]["acceptedHydraulicSolverCalls"]>0 and search["audit"]["maxHydraulicResidual"]<1e-8 and all(rechecks))
    gate(3,"All accepted witnesses/settings obey bounds",{"recheckedBestPoints":len(rechecks),"allPassed":all(rechecks)},"Controls validation on every evaluation",all(rechecks))
    gate(4,"Exact thermal-equilibrium substitution",{"maxAbsoluteResidualW":search["audit"]["maxAbsoluteThermalResidualW"],"equation":"accepted radiator + internal - accepted envelope = 0"},"absolute residual <1e-6 W",search["audit"]["maxAbsoluteThermalResidualW"]<1e-6)
    agreements=[]
    for o in objectives:
        stages=[o["coarse"]["best"]["objectiveMaxViolationC"],o["refined"]["best"]["objectiveMaxViolationC"],*[r["best"]["objectiveMaxViolationC"] for r in o["continuous"]]]
        certified=any(valid_certificate(c) for c in o["relaxedZoneCertificates"])
        agreements.append({"band":o["band"],"scope":o["scope"],"outdoorC":o["best"]["outdoorC"],"stageBestViolationsC":stages,"certifiedNonexistence":certified,
            "deGenerationCapCount":sum(not c["deSuccess"] for c in o["continuous"]),"consistentConclusion":all(x<=1e-7 for x in stages) if o["best"]["feasible"] else all(x>1e-7 for x in stages) and certified})
    gate(5,"No coarse-grid-only infeasibility claim",agreements,"stage conclusions agree; every negative conclusion has a conservative interval certificate, not an optimizer success claim",all(r["consistentConclusion"] for r in agreements))
    for number,outdoor in ((6,-5),(7,-10)):
        case=next(c for c in search["cases"] if c["outdoorC"]==outdoor)
        o=next(o for o in case["objectives"] if o["band"]=="hard" and o["scope"]=="all")
        gate(number,f"Whole-system 18–25°C result at {outdoor}°C",o["best"],"explicit witness or certified impossibility",o["best"]["feasible"] or any(valid_certificate(c) for c in o["relaxedZoneCertificates"]))
    comfort=[o for o in objectives if o["band"]=="comfort" and o["scope"]=="all"]
    gate(8,"Whole-system 20–22°C independent result",[o["best"] for o in comfort],"two explicit independently optimized results",len(comfort)==2 and all(o["best"]["feasible"] or any(valid_certificate(c) for c in o["relaxedZoneCertificates"]) for o in comfort))
    zones=[o for o in objectives if o["scope"]!="all"]
    gate(9,"Independent zone-level feasibility",[o["best"] for o in zones],"3 zones × 2 cases × 2 bands; coupled solver still used",len(zones)==12 and all(o["best"]["feasible"] or any(valid_certificate(c) for c in o["relaxedZoneCertificates"]) for o in zones))
    loads=shadow["zoneDesignLoadsW"];total=sum(loads.values())
    mismatch=max(abs(shadow["designLoadTargetShares"][z]-loads[z]/total) for z in loads)
    gate(10,"Zone design-load share arithmetic",{"loadsW":loads,"totalW":total,"shares":shadow["designLoadTargetShares"],"residual":mismatch},"normalized sums, no solar",mismatch<1e-14)
    a,b=shadow["area"],shadow["shadowDesignLoad"]
    same_settings=all(a[k]==b[k] for k in ("designFrequencyHz","anchorOpeningFraction","roundingIncrementFraction"))
    gate(11,"Same commissioning implementation, different target only",{"areaValves":a["fixedValveFractions"],"shadowValves":b["fixedValveFractions"],"sameSettings":same_settings,"adapter":shadow["adapter"]},"same function/45Hz/85% anchor/5pp rounding; original physical hydraulics rechecked",same_settings and not shadow["physicalFixtureChanged"])
    historical=read("p2_2_historical_hashes.json");changed=verify_file_hashes(ROOT,historical)
    current_hash=content_hash(asdict(design_load_parameters()))
    gate(12,"All accepted physical profiles/equations unchanged",{"historicalFiles":len(historical),"changedFiles":changed,"parameterHash":current_hash},"all hashes unchanged; same physical-fixture-v1.1",not changed and current_hash==search["physicalParameterHash"]==shadow["physicalParameterHash"])
    config_diff=[k for k,v in shadow["referenceConfig"].items() if shadow["shadowConfig"][k]!=v]
    gate(13,"Traditional policy remains unchanged",{"shadowConfigDifferentFields":config_diff,"note":"Only explicit shadow identity, fixed commissioned valves and recomputed warm-up are permitted; original config file untouched"},"no curve/rate/interval/mode changes",set(config_diff)<={"controllerVersion","fixedZoneValves","warmupHours"} and not changed)
    replay=[]
    config=config_from_dict(shadow["shadowConfig"])
    for s in scenarios()[:2]:
        result=evaluate(s,config,read(f"p2_2_shadow_results/{s.scenario_id}_initial_state.json"))
        with (ROOT/f"p2_2_shadow_results/{s.scenario_id}.csv").open(newline="") as f:
            exported=list(csv.DictReader(f))
        actual=[{k:str(v) for k,v in row_for(f,c).items()} for f,c in zip(result.frames,result.controller_states,strict=True)]
        summary=next(r["shadow"] for r in shadow["dynamicComparison"] if r["scenarioId"]==s.scenario_id)
        replay.append({"scenarioId":s.scenario_id,"csvAndSummaryExact":exported==actual and result.summary==summary,"frames":len(result.frames),"solverFailures":result.summary["solverFailureCount"]})
    gate(14,"Two stable reproducible shadow runs",{"replay":replay,"residuals":[r["residualMaxima"] for r in shadow["dynamicComparison"]]},"288 frames/case, zero solver failures, exact replay; engine enforces conservation",all(r["csvAndSummaryExact"] and r["frames"]==288 and r["solverFailures"]==0 for r in replay))

    commands=[command("P2.2 tests",[sys.executable,"-m","pytest","physical_core/tests/test_p2_2_analysis.py","-q"])]
    import run_gate_suite
    import run_p2_gate_suite as p2
    original_run_command=p2.run_command
    def regression_command(label,args):
        if label in ("P1A tests","P2 tests"):
            args=[sys.executable,str(Path(__file__).with_name("run_p2_1_regression.py")),"p1a" if label=="P1A tests" else "p2"]
        return original_run_command(label,args)
    candidate=read("p2_1_candidate_review.json")["config"]
    with fixture_context():
        p1a_gates=run_gate_suite.evaluate_gates()
        with patch.object(p2,"config_from_dict",lambda _:config_from_dict(candidate)),patch.object(p2,"scenarios",scenarios),patch.object(p2,"run_command",regression_command):
            p2_gates,p2_commands=p2.evaluate_p2()
    commands+=p2_commands
    p1a_test=next(c for c in commands if c["label"]=="P1A tests")
    p2_test=next(c for c in commands if c["label"]=="P2 tests")
    gate(15,"Full accepted P1A tests and Gates",{"tests":p1a_test,"gatePassed":sum(g["status"]=="PASS" for g in p1a_gates),"gateTotal":len(p1a_gates)},"84 tests, 32 Gates, no failures",p1a_test["exitCode"]==0 and p1a_test["passed"]==84 and p1a_test["failed"]==p1a_test["skipped"]==0 and len(p1a_gates)==32 and all(g["status"]=="PASS" for g in p1a_gates))
    gate(16,"Full accepted P2 tests and Gates",{"tests":p2_test,"gatePassed":sum(g["status"]=="PASS" for g in p2_gates),"gateTotal":len(p2_gates)},"34 tests, 20 Gates, no failures",p2_test["exitCode"]==0 and p2_test["passed"]==34 and p2_test["failed"]==p2_test["skipped"]==0 and len(p2_gates)==20 and all(g["status"]=="PASS" for g in p2_gates))
    p0=[c for c in commands if c["label"].startswith("P0")]
    gate(17,"P0 typecheck/test/build",p0,"all three commands exit 0; frozen source unchanged",len(p0)==3 and all(c["exitCode"]==0 for c in p0))
    hard=[o for o in objectives if o["band"]=="hard" and o["scope"]=="all"]
    hard_impossible=any(any(valid_certificate(c) for c in o["relaxedZoneCertificates"]) for o in hard)
    path="C" if hard_impossible else "B" if all(o["best"]["feasible"] for o in hard) and any(any(valid_certificate(c) for c in o["relaxedZoneCertificates"]) for o in comfort) else "A" if all(o["best"]["feasible"] for o in hard+comfort) else "INCONCLUSIVE"
    result={"phase":"P2.2 diagnostic","gates":gates,"passed":sum(g["status"]=="PASS" for g in gates),"failed":sum(g["status"]!="PASS" for g in gates),"skipped":0,
        "commands":commands,"P1AGates":p1a_gates,"P2Gates":p2_gates,"newTestExitCode":commands[0]["exitCode"],
        "historicalFileChangesAfterRegression":verify_file_hashes(ROOT,historical),"decisionPath":path,"baselinePromotion":False}
    (ROOT/"p2_2_gate_results.json").write_text(json.dumps(result,indent=2,allow_nan=False)+"\n")
    print(f"P2.2 Gates: {result['passed']} passed, {result['failed']} failed, 0 skipped; Path {path}; no baseline freeze")
    return bool(result["failed"] or any(c["exitCode"] for c in commands) or result["historicalFileChangesAfterRegression"])


if __name__=="__main__":raise SystemExit(main())
