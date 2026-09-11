"""Generate P5 persistent-site histories and freeze the identifiability decision."""
import hashlib
import json
from pathlib import Path
from statistics import median

import numpy as np

from ai_heating_core.p5.dataset import generate, read_csv
from ai_heating_core.p5.thermal import PARAMETER_NAMES, calibrate, identifiability
from ai_heating_core.physical_fixture_v1_2 import coherent_parameters

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "artifacts/p5_identification_dataset_v1_0"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def p3_history():
    root = ROOT / "artifacts/p3_dataset_v1/official/manifests"
    result = {}
    all_ids = []
    for directory in sorted(path for path in root.iterdir() if path.is_dir()):
        manifests = [json.loads(path.read_text()) for path in directory.glob("*.json")]
        ids = [item["physicalParameterSetId"] for item in manifests]
        all_ids += ids
        counts = {value: ids.count(value) for value in set(ids)}
        result[directory.name] = {"episodes": len(ids), "uniqueParameterSets": len(counts),
            "maximumEpisodesPerParameterSet": max(counts.values())}
    return {"bySplit": result, "episodes": len(all_ids),
            "uniqueParameterSets": len(set(all_ids)),
            "nonCanonicalRepeatedParameterSets": 0,
            "canonicalBaseFixtureEpisodes": all_ids.count("physical-fixture-v1.2"),
            "decision": "C — P3 excitation / same-asset history insufficient"}


def main():
    schema_hash = digest(ROOT / "p5_observability_schema.json")
    config_hash = digest(ROOT / "p5_calibration_config.json")
    manifest = generate(DATA, schema_hash, config_hash)
    serialized_manifest = json.dumps(
        manifest, indent=2, sort_keys=True, allow_nan=False) + "\n"
    (ROOT / "p5_identification_manifest.json").write_text(serialized_manifest)
    (DATA / "p5_identification_manifest.json").write_text(serialized_manifest)

    nominal = {profile.building_id: profile for profile in coherent_parameters().buildings}
    pilot_sites = [site for site in manifest["sites"] if site["split"] == "development"][:3]
    pilots = []
    for site in pilot_sites:
        rows = read_csv(DATA / site["files"]["siteObservable"])
        truth = json.loads((DATA / site["files"]["simulationTruth"]).read_text())
        for building_id in ("B01", "B06", "B11"):
            history = [row for row in rows if row["building_id"] == building_id
                       and int(row["day_index"]) < 4]
            fit = calibrate(history, nominal[building_id])
            diagnostic = identifiability(history, nominal[building_id], fit.parameters)
            actual = truth["buildings"][building_id]
            true_scales = {"h_scale": (1 / actual["true_thermal_resistance_k_w"]) /
                    (1 / nominal[building_id].thermal_resistance_k_w),
                "c_scale": actual["true_thermal_capacitance_j_k"] /
                    nominal[building_id].thermal_capacitance_j_k,
                "ua_scale": actual["true_radiator_ua_w_k"] /
                    nominal[building_id].radiator_ua_w_k,
                "solar_scale": actual["true_solar_scale"]}
            pilots.append({"siteId": site["site_id"], "buildingId": building_id,
                "trajectoryFitMaeC": fit.residual_mae_c,
                "fittedScales": vars(fit.parameters), "trueScalesPostFit": true_scales,
                "absoluteRelativeRecoveryError": {name: abs(getattr(fit.parameters, name)
                    / true_scales[name] - 1) for name in PARAMETER_NAMES},
                "diagnostic": diagnostic})
    criteria = json.loads((ROOT / "p5_calibration_config.json").read_text())["identifiabilityAcceptance"]
    full_pass = all(item["diagnostic"]["numericalRank"] == 4
        and item["diagnostic"]["conditionNumber"] <= criteria["maximumConditionNumber"]
        and item["diagnostic"]["maximumAbsoluteOffDiagonalCorrelation"] <=
            criteria["maximumAbsoluteParameterCorrelation"] for item in pilots)
    if full_pass:
        selected, status = list(PARAMETER_NAMES), "A — identifiable from dedicated P5 persistent-site histories"
    else:
        selected, status = ["h_scale", "c_scale"], "B — predictive effective H/C; UA/solar fixed to configured priors"
    selected_pilots = []
    for site in pilot_sites:
        rows = read_csv(DATA / site["files"]["siteObservable"])
        for building_id in ("B01", "B06", "B11"):
            history = [row for row in rows if row["building_id"] == building_id
                       and int(row["day_index"]) < 4]
            fit = calibrate(history, nominal[building_id], selected)
            selected_pilots.append({"siteId": site["site_id"], "buildingId": building_id,
                "trajectoryFitMaeC": fit.residual_mae_c,
                "fittedScales": vars(fit.parameters),
                "diagnostic": identifiability(history, nominal[building_id],
                                                fit.parameters, selected)})
    excitation = {}
    sample_rows = read_csv(DATA / pilot_sites[0]["files"]["siteObservable"])
    for name in ("station_supply_setpoint_c", "pump_frequency_hz",
                 "zone_valve_fraction", "solar_radiation_w_m2",
                 "delivered_zone_supply_c", "derived_building_flow_kg_s"):
        values = np.asarray([float(row[name]) for row in sample_rows])
        excitation[name] = {"minimum": float(values.min()), "maximum": float(values.max()),
                            "standardDeviation": float(values.std())}
    result = {"version": "p5-identifiability-results-v1",
        "p3HistoryAssessment": p3_history(), "p3Decision": "C",
        "dedicatedDatasetRequired": True,
        "initialCandidateParameterisation": list(PARAMETER_NAMES),
        "internalGainBiasDecision": "dropped before TEST; confounded with envelope/solar forcing",
        "pilotCases": pilots,
        "aggregate": {"pilotCount": len(pilots),
            "minimumRank": min(item["diagnostic"]["numericalRank"] for item in pilots),
            "maximumConditionNumber": max(item["diagnostic"]["conditionNumber"] for item in pilots),
            "maximumAbsoluteCorrelation": max(item["diagnostic"]["maximumAbsoluteOffDiagonalCorrelation"] for item in pilots),
            "medianTrajectoryFitMaeC": median(item["trajectoryFitMaeC"] for item in pilots),
            "medianRecoveryError": {name: median(item["absoluteRelativeRecoveryError"][name]
                for item in pilots) for name in PARAMETER_NAMES}},
        "excitationRichness": excitation, "fullParameterisationPasses": full_pass,
        "selectedParameterisation": selected, "classification": status,
        "selectedPilotCases": selected_pilots,
        "selectedAggregate": {
            "minimumRank": min(item["diagnostic"]["numericalRank"] for item in selected_pilots),
            "maximumConditionNumber": max(item["diagnostic"]["conditionNumber"] for item in selected_pilots),
            "maximumAbsoluteCorrelation": max(item["diagnostic"]["maximumAbsoluteOffDiagonalCorrelation"] for item in selected_pilots),
            "medianTrajectoryFitMaeC": median(item["trajectoryFitMaeC"] for item in selected_pilots)},
        "selectionFrozenBeforeFinalCalibration": True,
        "truthAccess": "simulation_truth loaded only after calibrate() returned, for recovery reporting",
        "datasetManifestHash": digest(ROOT / "p5_identification_manifest.json"),
        "configurationHash": config_hash, "observabilitySchemaHash": schema_hash}
    (ROOT / "p5_identifiability_results.json").write_text(
        json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(json.dumps({"p3Decision": result["p3Decision"],
        "datasetSites": len(manifest["sites"]), "attempts": len(manifest["attemptedDesigns"]),
        "identifiability": result["aggregate"], "selected": selected}, indent=2))


if __name__ == "__main__":
    main()
