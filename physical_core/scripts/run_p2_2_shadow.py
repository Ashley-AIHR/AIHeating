"""Two shadow dynamic evaluations; no controller policy or fixture tuning."""
import csv
from dataclasses import asdict, replace
import json
from pathlib import Path

from ai_heating_core.benchmark.allocation_diagnostics import building_diagnostic
from ai_heating_core.benchmark.runner import convergence, run_baseline
from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.control.traditional import config_from_dict, config_to_dict
from ai_heating_core.p2_1_scenarios import scenarios
from ai_heating_core.physical_fixture_v1_1 import design_load_parameters
from ai_heating_core.shadow_commissioning_analysis import compare_commissioning
from run_p2_baselines import row_for

ROOT=Path(__file__).resolve().parents[2]


def main():
    p=design_load_parameters()
    comparison=compare_commissioning(p)
    base=config_from_dict(json.loads((ROOT/"p2_1_candidate_review.json").read_text())["config"])
    config=replace(base,version="traditional-p2.2-shadow",valves=tuple(comparison["shadowDesignLoad"]["fixedValveFractions"]),warmup_hours=72)
    convergence_records=[]
    cases=scenarios()[:2]
    for s in cases:
        check=convergence(s,config,(72,96))
        fallback=convergence(s,config,(96,120)) if check["maxIndoorDifferenceC"]>=.2 else None
        if fallback is not None and fallback["maxIndoorDifferenceC"]>=.2:
            raise ValueError("Shadow warm-up has not converged; do not relax tolerance")
        convergence_records.append({"scenarioId":s.scenario_id,"initial":check,"fallback":fallback})
    hours=max(x["initial"]["recommendedWarmupHours"] for x in convergence_records)
    config=replace(config,warmup_hours=hours)
    runs=[]
    dest=ROOT/"p2_2_shadow_results";dest.mkdir(exist_ok=True)
    reference=json.loads((ROOT/"p2_1_candidate_results/summaries_v1.1.json").read_text())
    for s,baseline in zip(cases,reference):
        result=run_baseline(s,config)
        rows=[row_for(f,c) for f,c in zip(result.frames,result.controller_states,strict=True)]
        with (dest/f"{s.scenario_id}.csv").open("w",newline="") as f:
            writer=csv.DictWriter(f,fieldnames=rows[0]);writer.writeheader();writer.writerows(rows)
        (dest/f"{s.scenario_id}_initial_state.json").write_text(json.dumps(result.initial_state,indent=2,allow_nan=False)+"\n")
        diagnostic=building_diagnostic(p,result)
        means={z:sum(f.hydraulics.flows_m3_s[i]*3600 for f in result.frames)/len(result.frames) for i,z in enumerate(("near","mid","far"))}
        residuals={k:max(getattr(f,k) for f in result.frames) for k in ("mass_residual","heat_balance_residual","pipe_heat_balance_residual","building_heat_balance_residual","pipe_volume_residual")}
        runs.append({"scenarioId":s.scenario_id,"areaZoneReference":baseline,"shadow":result.summary,
            "buildingDiagnostic":diagnostic,"averageZoneFlowsM3h":means,"residualMaxima":residuals,
            "physicalParameterHash":result.initial_state["physicalParameterHash"]})
        print(f"{s.scenario_id}: {json.dumps(result.summary)}",flush=True)
    output={**comparison,"physicalParameterHash":content_hash(asdict(p)),"shadowConfig":config_to_dict(config),
        "referenceConfig":config_to_dict(base),"warmupConvergence":convergence_records,"selectedWarmupHours":hours,"dynamicComparison":runs}
    (ROOT/"p2_2_zone_commissioning_results.json").write_text(json.dumps(output,indent=2,allow_nan=False)+"\n")
    print("Shadow commissioning and two dynamic runs complete; no baseline promotion")


if __name__=="__main__":main()
