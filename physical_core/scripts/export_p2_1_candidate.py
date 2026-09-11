"""Comparison-only runs of the failed-to-resolve candidate; never freezes a baseline."""
import ast
import csv
from dataclasses import asdict
import inspect
import json
from math import fsum
import os
from pathlib import Path
import tempfile

from ai_heating_core import physical_fixture_v1_1 as fixture
from ai_heating_core.benchmark.allocation_diagnostics import building_diagnostic
from ai_heating_core.benchmark.freeze import verify_file_hashes
from ai_heating_core.benchmark.runner import run_baseline
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.contracts import ZONES
from ai_heating_core.control.traditional import config_from_dict
from ai_heating_core.p2_1_scenarios import scenarios
from run_p2_baselines import plots, row_for

ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/"p2_1_candidate_results"


def main():
    config=config_from_dict(json.loads((ROOT/"p2_1_candidate_review.json").read_text())["config"])
    protected=json.loads((ROOT/"p2_1_historical_v1_0_hashes.json").read_text())
    if verify_file_hashes(ROOT,protected):
        raise ValueError("Historical evidence changed")
    DEST.mkdir(exist_ok=True)
    summaries=[];diagnostics={};mass_residual=share_residual=0.0
    with tempfile.TemporaryDirectory(prefix="p2-1-mpl-") as cache:
        os.environ["MPLCONFIGDIR"]=cache
        import matplotlib
        matplotlib.use("Agg")
        for s in scenarios():
            result=run_baseline(s,config)
            p=s.parameters()
            rows=[row_for(f,c) for f,c in zip(result.frames,result.controller_states,strict=True)]
            with (DEST/f"p2_{s.scenario_id}_v1.1.csv").open("w",newline="") as out:
                writer=csv.DictWriter(out,fieldnames=rows[0]);writer.writeheader();writer.writerows(rows)
            (DEST/f"initial_state_{s.scenario_id}_v1.1.json").write_text(json.dumps(result.initial_state,indent=2,allow_nan=False)+"\n")
            plots(rows,DEST/"plots"/s.scenario_id)
            summaries.append(result.summary)
            diagnostics[s.scenario_id]=building_diagnostic(p,result)
            for f in result.frames:
                for z,q in zip(ZONES,f.hydraulics.flows_m3_s):
                    peers=[b for b in p.buildings if b.zone==z]
                    total=p.water.rho_water*q
                    allocated=fsum(f.buildings[b.building_id].building_water_flow_kg_s for b in peers)
                    mass_residual=max(mass_residual,abs(allocated-total)/total)
                    weights=fsum(b.flow_share_weight for b in peers)
                    for b in peers:
                        share_residual=max(share_residual,abs(f.buildings[b.building_id].building_water_flow_kg_s/total-b.flow_share_weight/weights))
            print(f"{s.scenario_id}: 288 frames; compliance {result.summary['complianceRate']:.6%}; severe {result.summary['severeOverheatingRate']:.6%}")
    for name,value in (("summaries_v1.1.json",summaries),("building_diagnostics_v1.1.json",diagnostics),
                       ("scenarios_v1.1.json",[s.manifest(config) for s in scenarios()])):
        (DEST/name).write_text(json.dumps(value,indent=2,allow_nan=False)+"\n")
    high,low=fixture.design_load_parameters().buildings[1:3]
    source=inspect.getsource(fixture);tree=ast.parse(source)
    imports=[n.module for n in ast.walk(tree) if isinstance(n,ast.ImportFrom)]
    names={n.id for n in ast.walk(tree) if isinstance(n,ast.Name)}
    no_io=imports==["dataclasses","parameters"] and not any(isinstance(n,ast.Import) for n in ast.walk(tree)) and not (names & {"open","Path","read_csv","json","scenario","comfortRate","overheatingRate","forecast","mpc"})
    weights=lambda:{b.building_id:b.flow_share_weight for b in fixture.design_load_parameters().buildings}
    first,second=weights(),weights()
    measurements=[
        ("GFA1","Zone mass conservation",{"allFiveFrames":1440,"maxRelativeResidual":mass_residual},"<1e-6",mass_residual<1e-6),
        ("GFA2","Design-load proportionality",{"maxAbsoluteShareResidual":share_residual},"<1e-14",share_residual<1e-14),
        ("GFA3","Same-area insulation differentiation",{"high":"B02","low":"B03","areaM2":980,"internalGainW":2940,"highWeightW":high.flow_share_weight,"lowWeightW":low.flow_share_weight},"B03 load/share > B02, otherwise same design area/internal gains",low.flow_share_weight>high.flow_share_weight),
        ("GFA4","No benchmark-derived weights",{"imports":imports,"generationArguments":["static profile"],"sourceHash":content_hash(source),"noBenchmarkOrIO":no_io},"static profile/constants only",no_io),
        ("GFA5","Determinism",{"firstWeights":first,"repeatWeights":second,"sha256":content_hash(first)},"exact equality",first==second)]
    gates={"fixtureVersion":fixture.FIXTURE_VERSION,"gates":[{"gate":g,"description":d,"measured":m,"threshold":t,"status":"PASS" if ok else "FAIL"} for g,d,m,t,ok in measurements],"passed":sum(v[-1] for v in measurements),"failed":sum(not v[-1] for v in measurements),"skipped":0}
    (ROOT/"p2_1_allocation_gate_results.json").write_text(json.dumps(gates,indent=2,allow_nan=False)+"\n")
    print(f"Allocation Gates: {gates['passed']} passed, {gates['failed']} failed, 0 skipped; comparison-only, no baseline promotion")
    return bool(gates["failed"])


if __name__=="__main__":raise SystemExit(main())
