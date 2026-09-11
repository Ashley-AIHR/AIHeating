"""Three independent search stages; exact accepted hydraulics at every distinct point."""
from dataclasses import asdict
from itertools import product
import json
from pathlib import Path
import time

import numpy as np
from scipy.optimize import differential_evolution, minimize

from ai_heating_core.benchmark.freeze import file_hash, verify_file_hashes, write_immutable_json
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.physical_fixture_v1_1 import design_load_parameters
from ai_heating_core.static_envelope_analysis import BANDS, BOUNDS, StaticEvaluator, relaxed_zone_certificate

ROOT=Path(__file__).resolve().parents[2]
SCOPES=("all","near","mid","far")


def ranking(evaluator,r,band,scope):
    t=list(r["buildingIndoorC"].values());lo,hi=BANDS[band]
    slack=min(min(t[i]-lo,hi-t[i]) for i in evaluator.indices[scope])
    return evaluator.score(r,band,scope),-slack


def refined_axis(center,radius,step,bounds):
    return sorted({round(min(bounds[1],max(bounds[0],center+offset)),10)
                   for offset in np.arange(-radius,radius+step/2,step)})


def main():
    start=time.monotonic()
    historical=json.loads((ROOT/"P2_1_CANDIDATE_EVIDENCE_MANIFEST.json").read_text())
    hashes={**historical["historicalFileHashes"],**historical["artifactFileHashes"],
            "P2_1_CANDIDATE_EVIDENCE_MANIFEST.json":file_hash(ROOT/"P2_1_CANDIDATE_EVIDENCE_MANIFEST.json")}
    if verify_file_hashes(ROOT,hashes):
        raise ValueError("Existing frozen/candidate evidence has changed")
    write_immutable_json(ROOT/"p2_2_historical_hashes.json",hashes)
    p=design_load_parameters();e=StaticEvaluator(p)
    cases=[]
    coarse_axes=[list(range(40,61,2)),list(range(30,51,4)),[.2,.4,.6,.8,1.],[.2,.4,.6,.8,1.],[.2,.4,.6,.8,1.]]
    for outdoor in (-5,-10):
        coarse=[e.evaluate(x,outdoor) for x in product(*coarse_axes)]
        print(f"outdoor {outdoor}: coarse grid {len(coarse)} exact static candidates",flush=True)
        objectives=[]
        for band,scope in product(BANDS,SCOPES):
            ordered=sorted(coarse,key=lambda r:ranking(e,r,band,scope))
            seeds=[]
            for record in ordered:
                x=np.array(record["actuatorVector"])[1:]/np.array([20.,.8,.8,.8])
                if all(np.linalg.norm(x-np.array(s["actuatorVector"])[1:]/np.array([20.,.8,.8,.8]))>=.15 for s in seeds):
                    seeds.append(record)
                if len(seeds)==3:break
            local_best=ordered[0];seen=set()
            for seed in seeds:
                axes=[refined_axis(c,radius,step,bound) for c,radius,step,bound in zip(seed["actuatorVector"],(1,2,.1,.1,.1),(.5,1,.05,.05,.05),BOUNDS)]
                for x in product(*axes):
                    if x in seen:continue
                    seen.add(x);record=e.evaluate(x,outdoor)
                    if ranking(e,record,band,scope)<ranking(e,local_best,band,scope):local_best=record
            continuous=[]
            for seed in (7,23):
                def objective(x):
                    return e.score(e.evaluate(x,outdoor),band,scope)
                result=differential_evolution(objective,BOUNDS,seed=seed,popsize=10,maxiter=180,tol=1e-8,atol=1e-10,polish=False,workers=1)
                record=e.evaluate(result.x,outdoor)
                polished=minimize(objective,result.x,method="Powell",bounds=BOUNDS,options={"xtol":1e-9,"ftol":1e-10,"maxiter":120})
                polished_record=e.evaluate(polished.x,outdoor)
                if ranking(e,polished_record,band,scope)<ranking(e,record,band,scope):record=polished_record
                continuous.append({"seed":seed,"deSuccess":bool(result.success),"deMessage":str(result.message),"deEvaluations":result.nfev,"deGenerations":result.nit,
                    "powellSuccess":bool(polished.success),"powellEvaluations":polished.nfev,"best":e.annotate(record,band,scope)})
            best=min([ordered[0],local_best,*[x["best"] for x in continuous]],key=lambda r:ranking(e,r,band,scope))
            certificates=[]
            if e.score(best,band,scope)>1e-7:
                for z in (("near","mid","far") if scope=="all" else (scope,)):
                    certificates.append(relaxed_zone_certificate(p,outdoor,z,band))
            item={"band":band,"scope":scope,"coarse":{"candidateCount":len(coarse),"best":e.annotate(ordered[0],band,scope)},
                "refined":{"candidateCount":len(seen),"seedVectors":[s["actuatorVector"] for s in seeds],"best":e.annotate(local_best,band,scope)},
                "continuous":continuous,"best":e.annotate(best,band,scope),"relaxedZoneCertificates":certificates}
            objectives.append(item)
            print(f"{outdoor} {band} {scope}: coarse={e.score(ordered[0],band,scope):.8f}, refined={e.score(local_best,band,scope):.8f}, continuous={[round(x['best']['objectiveMaxViolationC'],8) for x in continuous]}, certified={any(x['certifiedInfeasible'] for x in certificates)}",flush=True)
        cases.append({"outdoorC":outdoor,"objectives":objectives})
    output={"analysisVersion":"p2.2-static-envelope-v1","physicalFixtureVersion":"physical-fixture-v1.1","physicalParameterHash":content_hash(asdict(p)),
        "bounds":BOUNDS,"coarseAxes":coarse_axes,"refinementSteps":[.5,1,.05,.05,.05],"continuousSeeds":[7,23],
        "feasibilityToleranceC":1e-7,"thermalResidualToleranceW":1e-6,"cases":cases,
        "audit":{"candidateEvaluations":e.evaluations,"acceptedHydraulicSolverCalls":e.hydraulic_solves,"maxHydraulicResidual":e.max_hydraulic_residual,
            "maxAbsoluteThermalResidualW":e.max_thermal_residual_w,"maxAllocationMassResidual":e.max_mass_residual,"elapsedSeconds":time.monotonic()-start},
        "hydraulicReuse":"Only identical pump/valve inputs reuse accepted solver results; Ts/outdoor do not occur in accepted hydraulic equations.",
        "limitations":"Finite searches find witnesses, not exhaustive continuous proofs. Certified exclusions use monotone interval bounds over a superset of physically legal zone flows. No MPC/runtime control or fixture change."}
    (ROOT/"p2_2_static_feasible_envelope.json").write_text(json.dumps(output,indent=2,allow_nan=False)+"\n")
    print(json.dumps(output["audit"],indent=2))


if __name__=="__main__":main()
