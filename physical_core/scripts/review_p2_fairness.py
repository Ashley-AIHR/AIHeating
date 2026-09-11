"""Engineering interpretation, without changing curves or evaluating alternatives."""
import json
from pathlib import Path

from ai_heating_core.control.traditional import config_from_dict, interpolate
from ai_heating_core.contracts import Controls
from ai_heating_core.hydraulics import solve_hydraulics
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core.thermal import radiator_conductance

ROOT=Path(__file__).resolve().parents[2]


def main():
    if (ROOT/"P2_BASELINE_FREEZE_MANIFEST.json").exists():
        raise RuntimeError("P2 is frozen; do not overwrite acceptance evidence")
    review=json.loads((ROOT/"p2_adequacy_review.json").read_text())
    summaries=json.loads((ROOT/"p2_baseline_summaries.json").read_text())
    config=config_from_dict(review["config"])
    p=synthetic_parameters()
    frequency=interpolate(config.pump_curve,-5)
    hydraulic=solve_hydraulics(p,Controls(51,frequency,config.valves))
    values={}
    for b in p.buildings[:4]:
        mass=p.water.rho_water*hydraulic.flows_m3_s[0]*b.flow_share_weight/sum(x.flow_share_weight for x in p.buildings if x.zone=="near")
        g=radiator_conductance(mass,b.radiator_ua_w_k,p.water)
        supply_for=lambda target: target+((target+5)/b.thermal_resistance_k_w-b.internal_gain_w)/g
        values[b.building_id]={"insulation":b.insulation_level,"supplyNeededFor18C":supply_for(18),"supplyCeilingFor25C":supply_for(25)}
    findings=[
        ("Is the baseline intentionally weak?","No. Supplied recommended curves are unchanged; area-share commissioning improves the network. No AI comparison exists."),
        ("Does it use current outdoor conditions sensibly?","Yes. Piecewise-linear outdoor reset and pump schedules, recalculated at actual 30-minute boundaries."),
        ("Does it heat more when colder?","Yes. Raw supply/pump curves are monotonic; Cold Wave actions and delivered heat are measured."),
        ("Does it back off when warmer?","Yes. Raw targets fall; applied values follow only documented slew and interval constraints."),
        ("Does it use reasonable fixed commissioning?","Yes. Static area shares at 45 Hz, limiting valve 85%, practical 5pp rounding; valves fixed at 50/60/85%."),
        ("Does it violate comfort simply to save energy?","No energy minimisation is performed. Normal comfort is 0% and overheating 67.10%, disclosed as a real limitation of these curves with the heterogeneous accepted building fixture, not an energy-saving target."),
        ("Was it tuned using stress scenarios?","No. Normal and Cold Wave were evaluated before the three stress families; no breakpoint was changed using any scenario."),
        ("Does it use future information?","No. Controller signature admits only timestamp/current outdoor/self state; paired differing-future tests prove identical actions."),
        ("Is an arbitrary delay added?","No. Only 30-minute updates, frozen slew limits, accepted FIFO transit and building inertia."),
        ("Is AI logic hidden inside it?","No. No predictor, optimiser, indoor/solar feedback or forbidden dependency is present."),
    ]
    allowed=review["normalAdequate"] and not review["curveChanges"] and config.warmup_hours==96
    machine={"selfReviewStatus":"FAIR_WITH_DISCLOSED_LIMITATIONS" if allowed else "FAIL",
             "freezeEligible":allowed,"externalReviewRequired":True,"curveChanges":review["curveChanges"],
             "questions":[{"question":q,"finding":a} for q,a in findings],"staticNearZoneFeasibility":values,
             "diagnosticConditions":{"outdoorC":-5,"solarWm2":0,"pumpHz":frequency,"fixedValves":config.valves},
             "normalSummary":summaries[0],"nonBlockingIssues":["Synthetic plant and conventional curves are uncalibrated", "High insulation buildings severely overheat while low insulation buildings approach compliance floor", "No within-zone individual balancing or indoor feedback is available in this accepted benchmark scope"]}
    (ROOT/"p2_fairness_review.json").write_text(json.dumps(machine,indent=2,allow_nan=False)+"\n")
    lines=["# Phase 2 Baseline Fairness Review","",f"Self-review: **{machine['selfReviewStatus']}**. External engineering review remains required.",""]
    for q,a in findings:
        lines += [f"## {q}","",a,""]
    lines += ["## Poor comfort is disclosed, not hidden","",
        "The untouched recommended curve passes the predeclared ≥95% Normal compliance criterion (98.4375%), but Normal comfort is 0%, overheating is 67.1007%, severe overheating is 25%, and temperature ranges from 17.9268 to 29.0651°C. Cold Wave has 91.7824% compliance and minimum 16.7105°C. These results deserve external scrutiny; high compliance alone is not high comfort.","",
        "An offline explanatory calculation at current −5°C, zero solar and the commissioned Near flow shows a structural conflict within the same zone. This is not control feedback or tuning. B03's low insulation needs a higher supply to maintain 18°C than high-insulation B01 permits to stay below 25°C. Static area-based within-zone allocation is inherited from accepted P1A; a single zone supply/valve cannot satisfy both steady targets simultaneously. It would be misleading to claim perfect comfort or modify accepted thermal coefficients to hide this.","",
        "```json",json.dumps(values,indent=2),"```","",
        "The temperature spread does not prove future MPC can eliminate it. Future comparisons must retain the same physical state/coefficients and disclose limits of zone-level authority. No accepted physics, equipment bound, curve or stress scenario was changed to manufacture an advantage.","",
        "## Freeze decision","", "Eligible for a versioned local comparison reference with these disclosed limitations; not evidence of calibrated real-plant performance. Do not begin P3 until external acceptance."]
    (ROOT/"P2_BASELINE_FAIRNESS_REVIEW.md").write_text("\n".join(lines)+"\n")
    print(machine["selfReviewStatus"])
    print(json.dumps(values,indent=2))


if __name__=="__main__":main()
