"""Repeat the P2.2 coarse/refined/continuous static search for fixture v1.2."""
from dataclasses import asdict
from itertools import product
import json
from pathlib import Path
import time

import numpy as np
from scipy.optimize import differential_evolution, minimize

from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.physical_fixture_v1_2 import FIXTURE_VERSION, coherent_parameters
from ai_heating_core.static_envelope_analysis import BANDS, BOUNDS, StaticEvaluator, relaxed_zone_certificate

ROOT = Path(__file__).resolve().parents[2]
SCOPES = ("all", "near", "mid", "far")


def ranking(evaluator, record, band, scope):
    temperatures = list(record["buildingIndoorC"].values())
    lo, hi = BANDS[band]
    slack = min(min(temperatures[i] - lo, hi - temperatures[i]) for i in evaluator.indices[scope])
    return evaluator.score(record, band, scope), -slack


def refined_axis(center, radius, step, bounds):
    return sorted({round(min(bounds[1], max(bounds[0], center + offset)), 10)
                   for offset in np.arange(-radius, radius + step / 2, step)})


def main():
    start = time.monotonic()
    parameters = coherent_parameters()
    evaluator = StaticEvaluator(parameters)
    coarse_axes = [list(range(40, 61, 2)), list(range(30, 51, 4)),
                   [.2, .4, .6, .8, 1.], [.2, .4, .6, .8, 1.], [.2, .4, .6, .8, 1.]]
    cases = []
    for outdoor in (-5, -10):
        coarse = [evaluator.evaluate(x, outdoor) for x in product(*coarse_axes)]
        print(f"outdoor {outdoor}: coarse grid {len(coarse)} exact candidates", flush=True)
        objectives = []
        for band, scope in product(BANDS, SCOPES):
            ordered = sorted(coarse, key=lambda r: ranking(evaluator, r, band, scope))
            seeds = []
            for record in ordered:
                x = np.array(record["actuatorVector"])[1:] / np.array([20., .8, .8, .8])
                if all(np.linalg.norm(x - np.array(s["actuatorVector"])[1:] / np.array([20., .8, .8, .8])) >= .15 for s in seeds):
                    seeds.append(record)
                if len(seeds) == 3:
                    break
            local_best, seen = ordered[0], set()
            for seed_record in seeds:
                axes = [refined_axis(c, radius, step, bound) for c, radius, step, bound in zip(
                    seed_record["actuatorVector"], (1, 2, .1, .1, .1), (.5, 1, .05, .05, .05), BOUNDS)]
                for x in product(*axes):
                    if x in seen:
                        continue
                    seen.add(x)
                    record = evaluator.evaluate(x, outdoor)
                    if ranking(evaluator, record, band, scope) < ranking(evaluator, local_best, band, scope):
                        local_best = record
            continuous = []
            for random_seed in (7, 23):
                def objective(x):
                    return evaluator.score(evaluator.evaluate(x, outdoor), band, scope)
                result = differential_evolution(objective, BOUNDS, seed=random_seed, popsize=10,
                    maxiter=180, tol=1e-8, atol=1e-10, polish=False, workers=1)
                record = evaluator.evaluate(result.x, outdoor)
                polished = minimize(objective, result.x, method="Powell", bounds=BOUNDS,
                                    options={"xtol": 1e-9, "ftol": 1e-10, "maxiter": 120})
                polished_record = evaluator.evaluate(polished.x, outdoor)
                if ranking(evaluator, polished_record, band, scope) < ranking(evaluator, record, band, scope):
                    record = polished_record
                continuous.append({"seed": random_seed, "deSuccess": bool(result.success),
                    "deMessage": str(result.message), "deEvaluations": result.nfev,
                    "deGenerations": result.nit, "powellSuccess": bool(polished.success),
                    "powellEvaluations": polished.nfev, "best": evaluator.annotate(record, band, scope)})
            best = min([ordered[0], local_best, *[x["best"] for x in continuous]],
                       key=lambda r: ranking(evaluator, r, band, scope))
            certificates = []
            if evaluator.score(best, band, scope) > 1e-7:
                for zone in (("near", "mid", "far") if scope == "all" else (scope,)):
                    certificates.append(relaxed_zone_certificate(parameters, outdoor, zone, band))
            objectives.append({"band": band, "scope": scope,
                "coarse": {"candidateCount": len(coarse), "best": evaluator.annotate(ordered[0], band, scope)},
                "refined": {"candidateCount": len(seen), "seedVectors": [s["actuatorVector"] for s in seeds],
                            "best": evaluator.annotate(local_best, band, scope)},
                "continuous": continuous, "best": evaluator.annotate(best, band, scope),
                "relaxedZoneCertificates": certificates})
            print(f"{outdoor} {band} {scope}: best={evaluator.score(best, band, scope):.9f} feasible={evaluator.score(best, band, scope) <= 1e-7}", flush=True)
        cases.append({"outdoorC": outdoor, "objectives": objectives})
    output = {"analysisVersion": "p1.2-static-envelope-v1", "physicalFixtureVersion": FIXTURE_VERSION,
        "physicalParameterHash": content_hash(asdict(parameters)), "bounds": BOUNDS,
        "coarseAxes": coarse_axes, "refinementSteps": [.5, 1, .05, .05, .05],
        "continuousSeeds": [7, 23], "feasibilityToleranceC": 1e-7,
        "thermalResidualToleranceW": 1e-6, "cases": cases,
        "audit": {"candidateEvaluations": evaluator.evaluations,
            "acceptedHydraulicSolverCalls": evaluator.hydraulic_solves,
            "maxHydraulicResidual": evaluator.max_hydraulic_residual,
            "maxAbsoluteThermalResidualW": evaluator.max_thermal_residual_w,
            "maxAllocationMassResidual": evaluator.max_mass_residual,
            "elapsedSeconds": time.monotonic() - start},
        "method": "Unchanged P2.2 legal bounds, 8250-point coarse grid per case, local refinement, DE seeds 7/23, Powell polish, and interval exclusion for negative claims."}
    (ROOT / "p1_2_static_feasible_envelope.json").write_text(json.dumps(output, indent=2, allow_nan=False) + "\n")
    print(json.dumps(output["audit"], indent=2))


if __name__ == "__main__":
    main()
