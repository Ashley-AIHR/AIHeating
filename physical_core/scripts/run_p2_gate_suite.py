"""G2.1–G2.20 with actual comparisons and recorded regression commands."""
import ast
from copy import deepcopy
from dataclasses import asdict, replace
import importlib.util
import inspect
import json
from pathlib import Path
import re
import subprocess
import sys

from ai_heating_core.benchmark.freeze import verify_file_hashes
from ai_heating_core.benchmark.runner import convergence, evaluate, run_baseline, serialized_output
from ai_heating_core.benchmark.state import content_hash, restore, stable_json
from ai_heating_core.control.traditional import ControllerState, TraditionalHeatingController, config_from_dict, interpolate
from ai_heating_core.p2_scenarios import scenarios

ROOT=Path(__file__).resolve().parents[2]


def run_command(label,args):
    result=subprocess.run(args,cwd=ROOT,capture_output=True,text=True,timeout=180)
    output=result.stdout+result.stderr
    counts={name:int(m.group(1)) if (m:=re.search(rf"(\d+) {name}",output)) else 0 for name in ("passed","failed","skipped")}
    record={"label":label,"command":" ".join(args),"exitCode":result.returncode,
            "passed":counts["passed"] if label in ("P2 tests","P1A tests","P0 tests") else None,
            "failed":counts["failed"],"skipped":counts["skipped"],"output":output}
    print(f"{label}: exit {result.returncode}; {counts}",flush=True)
    return record


def evaluate_p2():
    adequacy=json.loads((ROOT/"p2_adequacy_review.json").read_text())
    config=config_from_dict(adequacy["config"])
    cases=scenarios()
    runs={s.scenario_id:run_baseline(s,config) for s in cases}
    records=[]
    def gate(number,description,inputs,baseline,changed,measured,threshold,passed,notes=""):
        records.append({"gate":f"G2.{number}","description":description,"inputs":inputs,"baseline":baseline,
                        "changedInput":changed,"measured":measured,"threshold":threshold,
                        "status":"PASS" if passed else "FAIL","notes":notes})
    outdoor=[i/10 for i in range(-200,151)]
    for number,curve,bounds,name in ((1,config.supply_curve,(40,60),"Weather compensation"),(2,config.pump_curve,(30,50),"Pump policy")):
        values=[interpolate(curve,t) for t in outdoor]
        violations=sum(b>a for a,b in zip(values,values[1:]))
        gate(number,name+" monotonicity",{"outdoorRangeC":[-20,15],"samples":len(outdoor)},values[0],"warming sweep",
             {"min":min(values),"max":max(values),"monotonicityViolations":violations},
             {"outputBounds":bounds,"violations":0},violations==0 and min(values)>=bounds[0] and max(values)<=bounds[1])
    bounds_errors=rate_errors=off_boundary_errors=valve_changes=0
    max_supply_delta=max_pump_delta=0.
    for run in runs.values():
        previous=ControllerState.from_dict(run.initial_state["controllerState"]).controls()
        for f in run.frames:
            try:f.controls.validate()
            except ValueError:bounds_errors+=1
            try:f.controls.validate(previous)
            except ValueError:rate_errors+=1
            if (f.elapsed_s-f.dt_s)%1800 and f.controls!=previous:off_boundary_errors+=1
            if f.controls.valves!=previous.valves:valve_changes+=1
            max_supply_delta=max(max_supply_delta,abs(f.controls.supply_c-previous.supply_c))
            max_pump_delta=max(max_pump_delta,abs(f.controls.frequency_hz-previous.frequency_hz))
            previous=f.controls
    gate(3,"Absolute equipment bounds",{"scenarios":5,"frames":1440},"frozen limits","five complete evaluations",{"violations":bounds_errors},{"violations":0},bounds_errors==0)
    gate(4,"Rate limits, 30-minute interval and fixed runtime valves",{"physicalStepSeconds":300,"controlIntervalSeconds":1800},"evaluation initial applied state","all accepted transitions",
         {"rateViolations":rate_errors,"offBoundaryChanges":off_boundary_errors,"valveChanges":valve_changes,"maxSupplyDeltaC":max_supply_delta,"maxPumpDeltaHz":max_pump_delta},
         {"supplyMaxC":2,"pumpMaxHz":2,"runtimeValveChangePct":0,"offBoundaryChanges":0},rate_errors==off_boundary_errors==valve_changes==0)

    c=TraditionalHeatingController(config)
    normal=cases[0]; run=runs[normal.scenario_id]
    alternate=replace(normal,knots=((0,-8,20,3),(1,15,900,10),(24,15,900,10)))
    state=ControllerState.from_dict(run.initial_state["controllerState"])
    a,b=c.update(0,normal.weather(0).outdoor_c,state),c.update(0,alternate.weather(0).outdoor_c,state)
    gate(5,"No future-weather leakage",{"timestamp":0,"commonStateHash":content_hash(asdict(state))},asdict(a),{"futureHour1":asdict(alternate.weather(3600))},
         {"controllerOutputA":asdict(a),"controllerOutputB":asdict(b),"differentFutureWeather":normal.weather(3600)!=alternate.weather(3600)},
         "outputs identical despite different future",a==b and normal.weather(3600)!=alternate.weather(3600))
    altered=deepcopy(run.initial_state)
    altered["buildingIndoorC"]={k:v+3 for k,v in altered["buildingIndoorC"].items()}
    hotter=evaluate(normal,config,altered)
    signature=list(inspect.signature(c.update).parameters)
    gate(6,"No indoor/prediction/AI feedback",{"allowedSignature":signature},content_hash([asdict(s) for s in run.controller_states]),{"allInitialIndoorCAdded":3},
         {"changedStateActionsHash":content_hash([asdict(s) for s in hotter.controller_states]),"physicalSummaryChanged":hotter.summary!=run.summary},
         "same actions at all 48 boundaries; no indoor/AI argument",run.controller_states==hotter.controller_states and signature==["timestamp_s","outdoor_c","state"])
    exclusions={}
    for key,r in runs.items():
        integrated=sum(f.actual_heat_w*f.dt_s for f in r.frames)
        lifetime=r.frames[-1].heat_energy_j
        delta=lifetime-r.initial_state["heatEnergyJ"]
        exclusions[key]={"firstEndSecond":r.frames[0].elapsed_s,"lastEndSecond":r.frames[-1].elapsed_s,"rows":len(r.frames),
                         "warmupHeatJ":r.initial_state["heatEnergyJ"],"evaluationHeatJ":integrated,"lifetimeDifferenceErrorJ":abs(delta-integrated)}
    gate(7,"Warm-up excluded from official metrics",{"warmupHours":config.warmup_hours},"lifetime accumulators include warmup","evaluate [0,86400] seconds",exclusions,
         {"rowsPerCase":288,"firstEndSecond":300,"maxEnergyDifferenceErrorJ":.001},all(v["rows"]==288 and v["firstEndSecond"]==300 and v["lifetimeDifferenceErrorJ"]<.001 for v in exclusions.values()),
         "Exposure/percentiles are calculated only from these evaluation frames; no burn-in samples are passed to metrics.")
    initial=convergence(normal,config)
    fallback=convergence(normal,config,(96,120)) if config.warmup_hours==96 else None
    selected=initial if config.warmup_hours==72 else fallback
    gate(8,"Warm-up convergence and documented fallback",{"initialComparisonHours":[72,96]},initial,{"officialWarmupHours":config.warmup_hours},
         {"fallbackComparison":fallback,"selectedMaxIndoorDifferenceC":selected["maxIndoorDifferenceC"]},
         {"maxDifferenceC":.2,"fallbackAllowed":96},selected["maxIndoorDifferenceC"]<.2,
         "72h fails; 96h adopted per specification, independently checked against 120h. Original 0.2°C threshold unchanged.")
    m=run.summary
    gate(9,"Normal Winter adequacy",{"predeclaredComplianceMinimum":.95},"recommended curves","96h warmup then 24h normal",m,
         {"complianceMinimum":.95,"solverFailures":0},m["complianceRate"]>=.95 and m["solverFailureCount"]==0,
         "Comfort=0 and high overheating are disclosed in fairness review; no narrow comfort requirement or stress tuning imposed.")
    cold_pairs=[]
    cold=runs["cold_wave"]
    for i in range(6,len(cold.frames),6):
        f0,f1=cold.frames[i-6],cold.frames[i]
        s0,s1=cold.controller_states[i-6],cold.controller_states[i]
        if f1.weather.outdoor_c<f0.weather.outdoor_c:
            cold_pairs.append((s1.raw_supply_target_c-s0.raw_supply_target_c,s1.raw_pump_target_hz-s0.raw_pump_target_hz))
    gate(10,"Cold-wave causality",{"case":"cold_wave"},"previous control-boundary outdoor/target","falling current outdoor",{"comparedTransitions":len(cold_pairs),"minimumSupplyDeltaC":min(x for x,y in cold_pairs),"minimumPumpDeltaHz":min(y for x,y in cold_pairs)},
         "targets rise or hold",bool(cold_pairs) and all(x>=0 and y>=0 for x,y in cold_pairs))
    warming=runs["rapid_warming"]
    warm_pairs=[]
    for i in range(6,len(warming.frames),6):
        if warming.frames[i].weather.outdoor_c>warming.frames[i-6].weather.outdoor_c:
            warm_pairs.append(warming.controller_states[i].raw_supply_target_c-warming.controller_states[i-6].raw_supply_target_c)
    gate(11,"Rapid-warming causality",{"case":"rapid_warming"},"prior raw target","increasing current outdoor",{"transitions":len(warm_pairs),"largestRawSupplyChangeC":max(warm_pairs)},
         "raw supply falls or holds; no added lag",bool(warm_pairs) and all(x<=0 for x in warm_pairs) and off_boundary_errors==0)
    sunny=replace(normal,knots=tuple((h,t,solar+300,wind) for h,t,solar,wind in normal.knots))
    sun=evaluate(sunny,config,run.initial_state)
    gate(12,"Solar cannot influence conventional actions",{"outdoorAndStartingControllerIdentical":True},content_hash([asdict(s) for s in run.controller_states]),{"solarWm2Added":300},
         {"changedSolarActionsHash":content_hash([asdict(s) for s in sun.controller_states]),"physicalHeatChanged":sun.summary["heatEnergyMWh"]!=run.summary["heatEnergyMWh"]},
         "all actions identical",sun.controller_states==run.controller_states)
    im=runs["hydraulic_imbalance"]
    gate(13,"Imbalance is a physical resistance disturbance",{"fixedValves":config.valves},
         {"farPipeK":normal.parameters().branches[2].pipe_k_pa_s2_m6,"firstZoneFlowsM3s":run.frames[0].hydraulics.flows_m3_s},
         {"farPipeMultiplier":2},{"firstZoneFlowsM3s":im.frames[0].hydraulics.flows_m3_s,"solver":asdict(im.frames[0].hydraulics.solver),
                                  "initialTemperaturesIdentical":run.initial_state["buildingIndoorC"]==im.initial_state["buildingIndoorC"]},
         "same warm physical state, lower Far flow, solver converges, valves fixed",im.frames[0].hydraulics.flows_m3_s[2]<run.frames[0].hydraulics.flows_m3_s[2] and run.initial_state["buildingIndoorC"]==im.initial_state["buildingIndoorC"] and valve_changes==0)
    stability={}
    stable=True
    for key,r in runs.items():
        stable_json(serialized_output(r))
        maxima={attr:max(getattr(f,attr) for f in r.frames) for attr in ("mass_residual","heat_balance_residual","pipe_heat_balance_residual","building_heat_balance_residual","pipe_volume_residual")}
        valid_returns=all(f.station_return_c<=f.controls.supply_c and all(f.zone_return_c[z]<=f.delivered_supply_c[z] for z in f.zone_return_c) for f in r.frames)
        min_flow=min(min(f.hydraulics.flows_m3_s) for f in r.frames)
        min_pump=min(f.hydraulics.pump_power_w for f in r.frames)
        max_hydraulic=max(f.hydraulics.solver.normalized_residual for f in r.frames)
        stability[key]={"frames":len(r.frames),"allFinite":True,"allReturnsValid":valid_returns,"minFlowM3s":min_flow,"minPumpW":min_pump,"maxHydraulicResidual":max_hydraulic,**maxima}
        stable &= valid_returns and min_flow>=0 and min_pump>=0 and max_hydraulic<1e-5 and r.summary["solverFailureCount"]==0 and maxima["mass_residual"]<1e-6 and max(maxima.values())<1e-5 and maxima["pipe_volume_residual"]<1e-10
    gate(14,"Five 24-hour evaluations remain physically stable",{"dtSeconds":300},"accepted P1A tolerances","five cases",stability,
         {"finite":True,"massResidualLt":1e-6,"heatResidualLt":1e-5,"solverFailures":0},stable)
    repeats={}; replay_ok=True
    first_frames={}
    for s in cases:
        original=runs[s.scenario_id]
        snapshot=json.loads(stable_json(original.initial_state))
        repeat=evaluate(s,config,snapshot)
        original_hash=content_hash(serialized_output(original)); repeated_hash=content_hash(serialized_output(repeat))
        repeats[s.scenario_id]={"originalSha256":original_hash,"repeatSha256":repeated_hash,"identical":original_hash==repeated_hash}
        replay_ok &= original_hash==repeated_hash
        first_frames[s.scenario_id]={"originalFirstFrameHash":content_hash(asdict(original.frames[0])),"restoredFirstFrameHash":content_hash(asdict(repeat.frames[0]))}
    gate(15,"Reproducibility from identical serialized evaluation state",{"scenarios":5},"first complete run","JSON round-trip and repeat",repeats,"byte-identical serialized frame/action/metric output",replay_ok)
    restored=ControllerState.from_dict(json.loads(stable_json(asdict(state))))
    gate(16,"Controller state serialization",{"retainedFields":list(asdict(state))},asdict(state),"JSON serialize/restore",asdict(restored),"state and next action identical",
         state==restored and c.update(0,-8,state)==c.update(0,-8,restored))
    gate(17,"Common physical initial-state export",{"includes":"temperature, controls, clock, hydraulic warm start, FIFO packets, energies, controller, config/parameter identity"},"original first frames","restore all five initial states",first_frames,
         "first frames exactly identical",all(v["originalFirstFrameHash"]==v["restoredFirstFrameHash"] for v in first_frames.values()))

    # Existing P1A Gate function is called read-only; accepted reports are not overwritten.
    specification=importlib.util.spec_from_file_location("accepted_p1a_gates",Path(__file__).with_name("run_gate_suite.py"))
    module=importlib.util.module_from_spec(specification);specification.loader.exec_module(module)
    p1a_gates=module.evaluate_gates()
    original=json.loads((ROOT/"p2_accepted_p1a_manifest.json").read_text())["files"]
    changed=verify_file_hashes(ROOT,original)
    commands=[run_command("P2 tests",[sys.executable,"-m","pytest","physical_core/tests/test_p2_control.py","physical_core/tests/test_p2_benchmark.py","physical_core/tests/test_p2_freeze.py","-q"]),
              run_command("P1A tests",[sys.executable,"-m","pytest","physical_core/tests/test_hydraulics.py","physical_core/tests/test_transport.py","physical_core/tests/test_thermal.py","physical_core/tests/test_validation.py","physical_core/tests/test_simulation.py","-q"])]
    gate(18,"Complete accepted P1A regression and immutable physics",{"acceptedManifest":"p2_accepted_p1a_manifest.json"},"84 tests, 32 Gates","add P2 modules only",
         {"testCommand":commands[-1],"gatePassCount":sum(g["status"]=="PASS" for g in p1a_gates),"gateFailCount":sum(g["status"]!="PASS" for g in p1a_gates),"changedAcceptedFiles":changed},
         "all tests/Gates pass; no accepted file changes",commands[-1]["exitCode"]==0 and all(g["status"]=="PASS" for g in p1a_gates) and not changed)
    commands += [run_command("P0 typecheck",["npx","tsc","--noEmit"]),run_command("P0 tests",["npm","run","test"]),run_command("P0 build",["npm","run","build"])]
    p0_diff=subprocess.run(["git","diff","--exit-code","HEAD","--","src","scripts","package.json","package-lock.json","tsconfig.json","index.html","P0_FUTURE_API_SEAMS.md","P0_FINAL_ACCEPTANCE.md"],cwd=ROOT,capture_output=True,text=True)
    gate(19,"Frozen P0 regression",{"commands":[x["command"] for x in commands[-3:]]},"frozen React/domain/seam","run checks after P2",{"commands":commands[-3:],"frozenSourceDiffExit":p0_diff.returncode},
         "typecheck/tests/build exit zero; no source changes",all(x["exitCode"]==0 for x in commands[-3:]) and p0_diff.returncode==0)
    controller_root=ROOT/"physical_core/src/ai_heating_core/control"
    imports=[]
    suspicious=[]
    forbidden={"lightgbm","xgboost","torch","tensorflow","cvxpy","osqp","forecast","prediction","p4","p5","p6"}
    for path in controller_root.glob("*.py"):
        tree=ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node,(ast.Import,ast.ImportFrom)):
                names=[a.name for a in node.names] if isinstance(node,ast.Import) else [node.module or ""]
                imports.extend(names)
                if any(part in forbidden for name in names for part in name.lower().split(".")):suspicious.append(str(path))
            if isinstance(node,ast.Name) and node.id.lower() in {"scenario","scenario_id","forecast","prediction","indoor_c","solar_w_m2"}:
                suspicious.append(str(path)+":"+node.id)
    gate(20,"No forbidden controller dependencies or scenario branches",{"files":[p.name for p in controller_root.glob('*.py')]},"no AI dependency permitted","AST source audit",{"imports":sorted(set(imports)),"suspiciousReferences":suspicious},
         "no ML/prediction/optimisation/scenario/indoor/solar inputs",not suspicious)
    return records,commands


def main():
    if (ROOT/"P2_BASELINE_FREEZE_MANIFEST.json").exists():
        raise RuntimeError("Frozen Gate evidence must not be overwritten; use separate review output for a new run.")
    records,commands=evaluate_p2()
    output={"phase":"P2","passed":sum(r["status"]=="PASS" for r in records),"failed":sum(r["status"]=="FAIL" for r in records),"skipped":0,"gates":records,"commands":commands}
    (ROOT/"p2_gate_results.json").write_text(json.dumps(output,indent=2,allow_nan=False)+"\n")
    (ROOT/"p2_validation_commands.json").write_text(json.dumps(commands,indent=2,allow_nan=False)+"\n")
    lines=["# Phase 2 Gate Results","",f"{output['passed']} passed, {output['failed']} failed, 0 skipped. Every entry is measured from the implemented controller/physical runner.",""]
    for r in records:
        lines += [f"## {r['gate']} — {r['description']} — {r['status']}",""]
        for key in ("inputs","baseline","changedInput","measured","threshold","notes"):
            lines += [f"**{key}:**","","```json",json.dumps(r[key],indent=2,allow_nan=False),"```",""]
    (ROOT/"P2_GATE_RESULTS.md").write_text("\n".join(lines))
    print(f"P2 Gates: {output['passed']} passed, {output['failed']} failed, 0 skipped",flush=True)
    return output["failed"]>0 or any(c["exitCode"] for c in commands)


if __name__=="__main__":raise SystemExit(main())
