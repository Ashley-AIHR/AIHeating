"""Only the two permitted commissioning/adequacy cases are evaluated here."""
from dataclasses import replace
import json
from pathlib import Path

from ai_heating_core.benchmark.runner import convergence, run_baseline
from ai_heating_core.control.commissioning import commission
from ai_heating_core.control.traditional import ControllerConfig, config_to_dict
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core.p2_scenarios import scenarios

ROOT = Path(__file__).resolve().parents[2]


def main():
    if (ROOT/"P2_BASELINE_FREEZE_MANIFEST.json").exists():
        raise RuntimeError("P2 is frozen; do not overwrite acceptance evidence")
    commissioned = commission(synthetic_parameters())
    config = ControllerConfig(valves=tuple(commissioned["fixedValveFractions"]))
    normal,cold = scenarios()[:2]
    warmup = convergence(normal, config)
    config = replace(config, warmup_hours=warmup["recommendedWarmupHours"])
    fallback = convergence(normal, config, (96,120)) if config.warmup_hours==96 else None
    results = [run_baseline(s,config).summary for s in (normal,cold)]
    review = {"label":"Initial recommended curves, before stress-scenario evaluation",
              "allowedTuningScenarios":["normal_winter","cold_wave"], "normalComplianceThreshold":.95,
              "config":config_to_dict(config), "commissioning":commissioned, "warmupComparison":warmup,
              "fallbackConvergence":fallback,
              "results":results, "curveChanges":[], "normalAdequate":results[0]["complianceRate"]>=.95}
    (ROOT/"p2_adequacy_review.json").write_text(json.dumps(review,indent=2,allow_nan=False)+"\n")
    print(json.dumps(review,indent=2,allow_nan=False))


if __name__=="__main__":
    main()
