"""Generate physical-fixture-v1.2 and its seven sizing Gates."""
from dataclasses import asdict
import ast
import inspect
import json
from math import exp, fsum, isfinite
from pathlib import Path

from ai_heating_core.benchmark.state import content_hash
from ai_heating_core.contracts import ZONES
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core import physical_fixture_v1_2 as fixture
from ai_heating_core.physical_fixture_v1_1 import design_load_parameters as v1_1_parameters

ROOT = Path(__file__).resolve().parents[2]


def main():
    base = synthetic_parameters()
    old = v1_1_parameters()
    new = fixture.coherent_parameters()
    rows = []
    radiator_error = water_error = 0.0
    for source, previous, profile in zip(base.buildings, old.buildings, new.buildings, strict=True):
        sizing = fixture.size_profile(source, new.water)
        capacity = sizing.design_mass_flow_kg_s * new.water.cp_water
        output = capacity * (1 - exp(-sizing.radiator_ua_w_k / capacity)) * (fixture.DESIGN_SUPPLY_C - fixture.DESIGN_INDOOR_C)
        radiator_error = max(radiator_error, abs(output - sizing.design_heat_load_w))
        water_error = max(water_error, abs(capacity * (fixture.DESIGN_SUPPLY_C - fixture.DESIGN_RETURN_C) - sizing.design_heat_load_w))
        rows.append({
            "buildingId": profile.building_id, "R": profile.thermal_resistance_k_w,
            "C": profile.thermal_capacitance_j_k, "designHeatLoadW": sizing.design_heat_load_w,
            "designMassFlowKgS": sizing.design_mass_flow_kg_s,
            "designVolumetricFlowM3H": sizing.design_volumetric_flow_m3_h,
            "designSupplyC": fixture.DESIGN_SUPPLY_C, "designReturnC": fixture.DESIGN_RETURN_C,
            "designIndoorC": fixture.DESIGN_INDOOR_C, "radiatorUA_WK": sizing.radiator_ua_w_k,
            "flowShareWeight": profile.flow_share_weight, "effectiveness": sizing.effectiveness,
            "previousV1_1RadiatorUA_WK": previous.radiator_ua_w_k,
            "previousV1_1FlowShareWeight": previous.flow_share_weight,
        })
    share_error = max(abs(fsum(b.flow_share_weight / fsum(x.flow_share_weight for x in new.buildings if x.zone == z)
                                for b in new.buildings if b.zone == z) - 1) for z in ZONES)
    changed = {}
    for before, after in zip(old.buildings, new.buildings, strict=True):
        a, b = asdict(before), asdict(after)
        changed[before.building_id] = [key for key in a if a[key] != b[key]]
    source = inspect.getsource(fixture)
    tree = ast.parse(source)
    banned = {"benchmark", "scenario", "comfort", "overheating", "mpc", "csv"}
    source_names = {n.id.lower() for n in ast.walk(tree) if isinstance(n, ast.Name)}
    source_text = source.lower()
    no_kpi_inputs = not any(word in source_text or word in source_names for word in banned)
    finite_ua = all(isfinite(r["radiatorUA_WK"]) and r["radiatorUA_WK"] > 0 for r in rows)
    finite_flow = all(isfinite(r["designMassFlowKgS"]) and r["designMassFlowKgS"] > 0 for r in rows)
    old_sections, new_sections = asdict(old), asdict(new)
    unchanged_sections = all(old_sections[key] == new_sections[key]
                             for key in ("branches", "pump", "water", "common_k_pa_s2_m6", "target_indoor_c"))
    only_allowed = unchanged_sections and all(set(fields) == {"radiator_ua_w_k", "flow_share_weight"} for fields in changed.values())
    gates = [
        ("SIZ1", "Radiator output equals design load", radiator_error, "absolute error < 1e-8 W", radiator_error < 1e-8),
        ("SIZ2", "Water-side design balance", water_error, "absolute error < 1e-8 W", water_error < 1e-8),
        ("SIZ3", "All UA values positive and finite", finite_ua, "true", finite_ua),
        ("SIZ4", "All positive-load design flows positive and finite", finite_flow, "true", finite_flow),
        ("SIZ5", "Within-zone shares normalize", share_error, "absolute residual < 1e-15", share_error < 1e-15),
        ("SIZ6", "Generator has no benchmark/KPI/scenario input", {"bannedTerms": sorted(banned), "present": sorted(w for w in banned if w in source_text or w in source_names)}, "none present", no_kpi_inputs),
        ("SIZ7", "Only allowed fixture fields differ from v1.1 physical values", {"buildingChangedFields": changed, "allNonBuildingSectionsUnchanged": unchanged_sections}, "radiator_ua_w_k and flow_share_weight only", only_allowed),
    ]
    result = {"fixtureVersion": fixture.FIXTURE_VERSION, "designPoint": {"indoorC": fixture.DESIGN_INDOOR_C,
        "outdoorC": fixture.DESIGN_OUTDOOR_C, "supplyC": fixture.DESIGN_SUPPLY_C,
        "returnC": fixture.DESIGN_RETURN_C, "solarWm2": 0, "windows": "closed"},
        "gates": [{"gate": g, "description": d, "measured": m, "threshold": t,
                   "status": "PASS" if ok else "FAIL"} for g, d, m, t, ok in gates],
        "passed": sum(ok for *_, ok in gates), "failed": sum(not ok for *_, ok in gates), "skipped": 0}
    export = {"fixtureVersion": fixture.FIXTURE_VERSION, "sizingRule": "design-load -> design-water-flow -> NTU-UA",
              "physicalParameterHash": content_hash(asdict(new)), "designPoint": result["designPoint"],
              "buildings": rows, "parameters": asdict(new)}
    (ROOT / "p1a_parameters_physical_fixture_v1.2.json").write_text(json.dumps(export, indent=2, allow_nan=False) + "\n")
    (ROOT / "p1_2_sizing_gate_results.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    lines = ["# P1.2 Sizing Gate Results", "", f"{result['passed']} PASS / {result['failed']} FAIL / 0 SKIPPED.", ""]
    for gate in result["gates"]:
        lines += [f"## {gate['gate']} — {gate['description']} — {gate['status']}", "",
                  f"Threshold: `{gate['threshold']}`", "", "```json", json.dumps(gate["measured"], indent=2), "```", ""]
    (ROOT / "P1_2_SIZING_GATE_RESULTS.md").write_text("\n".join(lines))
    print(f"Sizing Gates: {result['passed']} passed, {result['failed']} failed, 0 skipped")
    return bool(result["failed"])


if __name__ == "__main__":
    raise SystemExit(main())
