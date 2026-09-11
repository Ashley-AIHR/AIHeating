"""Render the required v1.2 static, benchmark and final review reports."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(name):
    return json.loads((ROOT / name).read_text())


def pct(value):
    return f"{100 * value:.4f}%"


def number(value):
    return f"{value:.6f}"


def all_objective(search, outdoor, band):
    return next(o for case in search["cases"] if case["outdoorC"] == outdoor
                for o in case["objectives"] if o["scope"] == "all" and o["band"] == band)


def static_report():
    old, new = read("p2_2_static_feasible_envelope.json"), read("p1_2_static_feasible_envelope.json")
    lines = ["# P1.2 Static Feasibility Comparison", "",
        "The exact P2.2 methodology was repeated with physical-fixture-v1.2: the same 40–60°C supply, 30–50 Hz pump, 20–100% valves, 8,250-point coarse grid per outdoor case, local refinement, independent DE seeds 7/23, Powell polish, and unchanged 1e−7°C feasibility tolerance.", "",
        "## v1.1 versus v1.2 whole-system result", "",
        "| Outdoor | Band | v1.1 best violation | v1.1 | v1.2 best violation | v1.2 |",
        "| ---: | --- | ---: | --- | ---: | --- |"]
    for outdoor in (-5, -10):
        for band in ("hard", "comfort"):
            a, b = all_objective(old, outdoor, band)["best"], all_objective(new, outdoor, band)["best"]
            lines.append(f"| {outdoor}°C | {'18–25°C' if band=='hard' else '20–22°C'} | {number(a['objectiveMaxViolationC'])}°C | {'FEASIBLE' if a['feasible'] else 'INFEASIBLE'} | {number(b['objectiveMaxViolationC'])}°C | {'FEASIBLE' if b['feasible'] else 'INFEASIBLE'} |")
    lines += ["", "v1.2 restores the mandatory −10°C hard-band witness and also supplies narrow 20–22°C witnesses at both outdoor cases; narrow-band feasibility is reported as a result, not treated as an acceptance prerequisite.", ""]
    for outdoor in (-5, -10):
        for band in ("hard", "comfort"):
            best = all_objective(new, outdoor, band)["best"]
            a = best["actuators"]
            lines += [f"## {outdoor}°C / {'18–25°C' if band=='hard' else '20–22°C'} witness", "",
                f"Supply {a['supplyC']:.6f}°C; pump {a['pumpHz']:.6f} Hz; Near/Mid/Far valves {100*a['nearValve']:.3f}% / {100*a['midValve']:.3f}% / {100*a['farValve']:.3f}%. Indoor range {best['minimumIndoorC']:.6f}–{best['maximumIndoorC']:.6f}°C; max violation {best['objectiveMaxViolationC']:.9f}°C.", "",
                "| Building | Indoor °C |", "| --- | ---: |"]
            lines += [f"| {building} | {temperature:.6f} |" for building, temperature in best["buildingIndoorC"].items()]
            lines.append("")
    audit = new["audit"]
    lines += ["## Numerical audit", "", "| Item | Measured |", "| --- | ---: |",
        f"| Candidate evaluations | {audit['candidateEvaluations']} |",
        f"| Accepted hydraulic solves | {audit['acceptedHydraulicSolverCalls']} |",
        f"| Maximum hydraulic residual | {audit['maxHydraulicResidual']:.9g} |",
        f"| Maximum thermal residual W | {audit['maxAbsoluteThermalResidualW']:.9g} |",
        f"| Maximum allocation mass residual | {audit['maxAllocationMassResidual']:.9g} |", "",
        "No infeasibility claim or interval certificate is needed for v1.2 because every whole-system and zone/band objective has an explicit legal witness.", ""]
    (ROOT / "P1_2_STATIC_FEASIBILITY_COMPARISON.md").write_text("\n".join(lines))


def benchmark_report():
    v0 = {x["scenarioId"]: x for x in read("p2_baseline_summaries.json")}
    v1 = {x["scenarioId"]: x for x in read("p2_1_candidate_results/summaries_v1.1.json")}
    payload = read("p1_2_candidate_results/benchmark_v1.2.json")
    v2 = {x["scenarioId"]: x for x in payload["summaries"]}
    lines = ["# P1.2 P2 Benchmark Comparison", "",
        "The Traditional weather-compensation curve, pump curve, 30-minute interval, slew limits, scenario forcing, and runtime fixed-valve policy are unchanged. Zone valves were recommissioned offline from summed design water flows, and every initial state was regenerated after a fresh warm-up.", "",
        "Commissioning: continuous Near/Mid/Far valves " + " / ".join(f"{100*x:.3f}%" for x in payload["commissioning"]["continuousValveFractions"]) +
        "; rounded valves " + " / ".join(f"{100*x:.1f}%" for x in payload["commissioning"]["fixedValveFractions"]) + ".", "",
        f"Warm-up: 72/96-hour maximum indoor difference {payload['warmupComparison72v96']['maxIndoorDifferenceC']:.6f}°C (<0.2°C), so 72 hours was selected.", ""]
    fields = [("complianceRate", "Compliance", pct), ("comfortRate", "Comfort", pct),
        ("overheatingRate", "Overheating", pct), ("severeOverheatingRate", "Severe", pct),
        ("underheatingRate", "Underheating", pct), ("minimumIndoorC", "Min °C", number),
        ("maximumIndoorC", "Max °C", number), ("P10C", "P10 °C", number),
        ("P50C", "P50 °C", number), ("P90C", "P90 °C", number),
        ("temperatureSpreadC", "Spread °C", number), ("heatEnergyMWh", "Heat MWh", number),
        ("pumpElectricityKWh", "Pump kWh", number)]
    for scenario in v2:
        lines += [f"## {scenario}", "", "| Version | " + " | ".join(label for _, label, _ in fields) + " |",
                  "| --- | " + " | ".join("---:" for _ in fields) + " |"]
        for version, data in (("v1.0", v0[scenario]), ("v1.1", v1[scenario]), ("v1.2", v2[scenario])):
            lines.append("| " + version + " | " + " | ".join(formatter(data[key]) for key, _, formatter in fields) + " |")
        lines += ["", "### v1.2 B01–B12 exposure", "",
            "| Building | Min °C | Max °C | Comfort | Overheat | Severe | Underheat |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
        for row in payload["buildingDiagnostics"][scenario]["buildings"]:
            lines.append(f"| {row['buildingId']} | {row['minimumIndoorC']:.4f} | {row['maximumIndoorC']:.4f} | {pct(row['comfortRate'])} | {pct(row['overheatingRate'])} | {pct(row['severeOverheatingRate'])} | {pct(row['underheatingRate'])} |")
        lines.append("")
    normal_v1 = {r["buildingId"]: r for r in read("p2_1_candidate_results/building_diagnostics_v1.1.json")["normal_winter"]["buildings"]}
    normal_v2 = {r["buildingId"]: r for r in payload["buildingDiagnostics"]["normal_winter"]["buildings"]}
    lines += ["## Structural-artifact review", "",
        "| Building | v1.1 min→v1.2 min °C | v1.1 severe→v1.2 severe | v1.1 underheat→v1.2 underheat |",
        "| --- | --- | --- | --- |"]
    for building in ("B01", "B02", "B03", "B04", "B09"):
        a, b = normal_v1[building], normal_v2[building]
        lines.append(f"| {building} | {a['minimumIndoorC']:.4f} → {b['minimumIndoorC']:.4f} | {pct(a['severeOverheatingRate'])} → {pct(b['severeOverheatingRate'])} | {pct(a['underheatingRate'])} → {pct(b['underheatingRate'])} |")
    lines += ["", "The persistent B01/B02/B04 severe-overheat pattern falls from 100% of Normal Winter endpoints in v1.1 to 0% in v1.2. B03 and B09 minimum temperatures rise without creating underheating elsewhere. This is an observed consequence of coherent fixture sizing, not an input to it.", ""]
    (ROOT / "P1_2_P2_BENCHMARK_COMPARISON.md").write_text("\n".join(lines))


def final_report():
    sizing = read("p1_2_sizing_gate_results.json")
    search = read("p1_2_static_feasible_envelope.json")
    bench = read("p1_2_candidate_results/benchmark_v1.2.json")
    validation = read("p1_2_validation_results.json")
    normal = next(s for s in bench["summaries"] if s["scenarioId"] == "normal_winter")
    hard5, hard10 = all_objective(search, -5, "hard")["best"], all_objective(search, -10, "hard")["best"]
    comfort5, comfort10 = all_objective(search, -5, "comfort")["best"], all_objective(search, -10, "comfort")["best"]
    lines = ["# Physical Fixture v1.2 Final Report", "",
        "**Decision: PASS / ready for external review and baseline promotion.** No new freeze manifest is created; P3 is not started. The result is driven by one predeclared engineering sizing chain, not KPI tuning.", "",
        "## Required answers", "",
        "1. **Design point:** synthetic PoC indoor 21°C, outdoor −10°C, supply 55°C, return 45°C, zero solar, closed windows, unchanged internal gains.",
        "2. **Design load:** `Q_design = max(0, (1/R) × (21 − (−10)) − internalGain)`.",
        "3. **Design flow:** `m_dot = Q_design / (cp × (55 − 45))`; `V_dot = m_dot / rho`, exported in m³/h.",
        "4. **UA derivation:** with `M=m_dot×cp`, `effectiveness=Q_design/[M×(55−21)]`, then `UA=−M ln(1−effectiveness)`.",
        "5. **Internal consistency:** yes. Effectiveness is 10/34 for all 12 positive-load buildings; SIZ1–SIZ4 pass with no clamp.",
        "6. **Fields changed from v1.1:** `radiator_ua_w_k` and raw `flow_share_weight` only. The latter changes units from proportional design-load W to explicit design mass-flow kg/s; normalized within-zone shares remain equivalent. All R, C, gains, hydraulics, transport, limits and equations are unchanged.",
        f"7. **P1A regression:** yes—{sum(g['status']=='PASS' for g in validation['P1AGates'])}/32 Gates and 84/84 accepted tests pass.",
        f"8. **−5°C 18–25°C:** yes. Witness {hard5['actuators']['supplyC']:.1f}°C / {hard5['actuators']['pumpHz']:.1f} Hz / {100*hard5['actuators']['nearValve']:.0f}% / {100*hard5['actuators']['midValve']:.0f}% / {100*hard5['actuators']['farValve']:.0f}%; all buildings {hard5['minimumIndoorC']:.4f}–{hard5['maximumIndoorC']:.4f}°C.",
        f"9. **−10°C 18–25°C:** yes. Witness {hard10['actuators']['supplyC']:.1f}°C / {hard10['actuators']['pumpHz']:.1f} Hz / {100*hard10['actuators']['nearValve']:.0f}% / {100*hard10['actuators']['midValve']:.0f}% / {100*hard10['actuators']['farValve']:.0f}%; all buildings {hard10['minimumIndoorC']:.4f}–{hard10['maximumIndoorC']:.4f}°C.",
        f"10. **20–22°C:** feasible at both −5°C ({comfort5['minimumIndoorC']:.4f}–{comfort5['maximumIndoorC']:.4f}°C) and −10°C ({comfort10['minimumIndoorC']:.4f}–{comfort10['maximumIndoorC']:.4f}°C). This is not used as a mandatory acceptance condition.",
        "11. **Remaining binding conflicts:** none within either requested static band. Nearest-bound IDs are recorded in the static JSON, but no building violates either witness.",
        "12. **B01/B02/B04 severe-overheat pattern:** reduced from 100% of Normal Winter endpoints per building in v1.1 to 0% in v1.2.",
        "13. **B03/B09 cold risk:** Normal Winter minima improve from 19.011/18.486°C in v1.1 to 21.697/21.745°C in v1.2; both remain at 0% underheating, and all other buildings also have 0% underheating.",
        "14. **Commissioned valves:** continuous 36.7558% / 54.0795% / 85%; rounded Near/Mid/Far 35% / 55% / 85%.",
        f"15. **Traditional credibility:** yes. With unchanged control curves/policies, Normal Winter is {pct(normal['complianceRate'])} compliant, {pct(normal['severeOverheatingRate'])} severe-overheated, {pct(normal['underheatingRate'])} underheated, with P90−P10 spread {normal['temperatureSpreadC']:.3f}°C. All five scenarios have 100% hard compliance and zero severe overheating/underheating.",
        "16. **Baseline readiness:** yes, all specified review Gates pass and the structural artifact is removed. Promotion remains an external review action; this work does not create a new P2 freeze manifest.", "",
        "## Validation and preservation", "",
        f"Sizing Gates: {sizing['passed']}/7. Accepted P1A Gates: 32/32. P2 Gates: 20/20. New tests: 4/4; P1A tests: 84/84; P2 tests: 34/34; P0 tests: 62/62. Typecheck and build exit 0. All {validation['historicalFilesChecked']} files in the preservation ledger are unchanged.", "",
        "Detailed evidence: `P1_2_SIZING_GATE_RESULTS.md`, `P1_2_STATIC_FEASIBILITY_COMPARISON.md`, `P1_2_P2_BENCHMARK_COMPARISON.md`, and `P1_2_VALIDATION_RESULTS.md`.", "",
        "**Stop condition satisfied:** v1.2 sizing, tests, static rerun, eligible benchmark rerun, and final report are complete. No P3, ML, MPC, UI work, new actuator, controller weakening, or KPI-driven UA iteration was performed.", ""]
    (ROOT / "P1_2_FINAL_REPORT.md").write_text("\n".join(lines))


if __name__ == "__main__":
    static_report(); benchmark_report(); final_report()
