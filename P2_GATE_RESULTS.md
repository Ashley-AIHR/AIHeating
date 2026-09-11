# Phase 2 Gate Results

20 passed, 0 failed, 0 skipped. Every entry is measured from the implemented controller/physical runner.

## G2.1 — Weather compensation monotonicity — PASS

**inputs:**

```json
{
  "outdoorRangeC": [
    -20,
    15
  ],
  "samples": 351
}
```

**baseline:**

```json
58.0
```

**changedInput:**

```json
"warming sweep"
```

**measured:**

```json
{
  "min": 40.0,
  "max": 58.0,
  "monotonicityViolations": 0
}
```

**threshold:**

```json
{
  "outputBounds": [
    40,
    60
  ],
  "violations": 0
}
```

**notes:**

```json
""
```

## G2.2 — Pump policy monotonicity — PASS

**inputs:**

```json
{
  "outdoorRangeC": [
    -20,
    15
  ],
  "samples": 351
}
```

**baseline:**

```json
48.0
```

**changedInput:**

```json
"warming sweep"
```

**measured:**

```json
{
  "min": 34.0,
  "max": 48.0,
  "monotonicityViolations": 0
}
```

**threshold:**

```json
{
  "outputBounds": [
    30,
    50
  ],
  "violations": 0
}
```

**notes:**

```json
""
```

## G2.3 — Absolute equipment bounds — PASS

**inputs:**

```json
{
  "scenarios": 5,
  "frames": 1440
}
```

**baseline:**

```json
"frozen limits"
```

**changedInput:**

```json
"five complete evaluations"
```

**measured:**

```json
{
  "violations": 0
}
```

**threshold:**

```json
{
  "violations": 0
}
```

**notes:**

```json
""
```

## G2.4 — Rate limits, 30-minute interval and fixed runtime valves — PASS

**inputs:**

```json
{
  "physicalStepSeconds": 300,
  "controlIntervalSeconds": 1800
}
```

**baseline:**

```json
"evaluation initial applied state"
```

**changedInput:**

```json
"all accepted transitions"
```

**measured:**

```json
{
  "rateViolations": 0,
  "offBoundaryChanges": 0,
  "valveChanges": 0,
  "maxSupplyDeltaC": 0.9000000000000057,
  "maxPumpDeltaHz": 0.9000000000000057
}
```

**threshold:**

```json
{
  "supplyMaxC": 2,
  "pumpMaxHz": 2,
  "runtimeValveChangePct": 0,
  "offBoundaryChanges": 0
}
```

**notes:**

```json
""
```

## G2.5 — No future-weather leakage — PASS

**inputs:**

```json
{
  "timestamp": 0,
  "commonStateHash": "13bc90fd1f1910622a68858f836f6d08208a025025ca1f67c449bc80922deb07"
}
```

**baseline:**

```json
{
  "controller_version": "traditional-v1.0",
  "raw_supply_target_c": 53.4,
  "applied_supply_c": 53.4,
  "raw_pump_target_hz": 45.2,
  "applied_pump_hz": 45.2,
  "fixed_valves": [
    0.5,
    0.6,
    0.85
  ],
  "last_boundary_s": 0,
  "next_boundary_s": 1800
}
```

**changedInput:**

```json
{
  "futureHour1": {
    "outdoor_c": 15.0,
    "solar_w_m2": 900.0,
    "wind_m_s": 10.0
  }
}
```

**measured:**

```json
{
  "controllerOutputA": {
    "controller_version": "traditional-v1.0",
    "raw_supply_target_c": 53.4,
    "applied_supply_c": 53.4,
    "raw_pump_target_hz": 45.2,
    "applied_pump_hz": 45.2,
    "fixed_valves": [
      0.5,
      0.6,
      0.85
    ],
    "last_boundary_s": 0,
    "next_boundary_s": 1800
  },
  "controllerOutputB": {
    "controller_version": "traditional-v1.0",
    "raw_supply_target_c": 53.4,
    "applied_supply_c": 53.4,
    "raw_pump_target_hz": 45.2,
    "applied_pump_hz": 45.2,
    "fixed_valves": [
      0.5,
      0.6,
      0.85
    ],
    "last_boundary_s": 0,
    "next_boundary_s": 1800
  },
  "differentFutureWeather": true
}
```

**threshold:**

```json
"outputs identical despite different future"
```

**notes:**

```json
""
```

## G2.6 — No indoor/prediction/AI feedback — PASS

**inputs:**

```json
{
  "allowedSignature": [
    "timestamp_s",
    "outdoor_c",
    "state"
  ]
}
```

**baseline:**

```json
"6b861d6091d3581f6fb68d4b1e31e06965bd22848c046c856234ca097997fd58"
```

**changedInput:**

```json
{
  "allInitialIndoorCAdded": 3
}
```

**measured:**

```json
{
  "changedStateActionsHash": "6b861d6091d3581f6fb68d4b1e31e06965bd22848c046c856234ca097997fd58",
  "physicalSummaryChanged": true
}
```

**threshold:**

```json
"same actions at all 48 boundaries; no indoor/AI argument"
```

**notes:**

```json
""
```

## G2.7 — Warm-up excluded from official metrics — PASS

**inputs:**

```json
{
  "warmupHours": 96
}
```

**baseline:**

```json
"lifetime accumulators include warmup"
```

**changedInput:**

```json
"evaluate [0,86400] seconds"
```

**measured:**

```json
{
  "normal_winter": {
    "firstEndSecond": 300,
    "lastEndSecond": 86400,
    "rows": 288,
    "warmupHeatJ": 148233690186.5959,
    "evaluationHeatJ": 35923778402.6554,
    "lifetimeDifferenceErrorJ": 0.00011444091796875
  },
  "cold_wave": {
    "firstEndSecond": 300,
    "lastEndSecond": 86400,
    "rows": 288,
    "warmupHeatJ": 140003335601.53925,
    "evaluationHeatJ": 41391492013.55874,
    "lifetimeDifferenceErrorJ": 8.392333984375e-05
  },
  "rapid_warming": {
    "firstEndSecond": 300,
    "lastEndSecond": 86400,
    "rows": 288,
    "warmupHeatJ": 148233690186.5959,
    "evaluationHeatJ": 31082240289.2556,
    "lifetimeDifferenceErrorJ": 7.62939453125e-05
  },
  "sunny_winter": {
    "firstEndSecond": 300,
    "lastEndSecond": 86400,
    "rows": 288,
    "warmupHeatJ": 143025989015.58936,
    "evaluationHeatJ": 32740395475.596767,
    "lifetimeDifferenceErrorJ": 6.4849853515625e-05
  },
  "hydraulic_imbalance": {
    "firstEndSecond": 300,
    "lastEndSecond": 86400,
    "rows": 288,
    "warmupHeatJ": 148233690186.5959,
    "evaluationHeatJ": 35674989193.55691,
    "lifetimeDifferenceErrorJ": 0.00023651123046875
  }
}
```

**threshold:**

```json
{
  "rowsPerCase": 288,
  "firstEndSecond": 300,
  "maxEnergyDifferenceErrorJ": 0.001
}
```

**notes:**

```json
"Exposure/percentiles are calculated only from these evaluation frames; no burn-in samples are passed to metrics."
```

## G2.8 — Warm-up convergence and documented fallback — PASS

**inputs:**

```json
{
  "initialComparisonHours": [
    72,
    96
  ]
}
```

**baseline:**

```json
{
  "hoursCompared": [
    72,
    96
  ],
  "perBuildingDifferenceC": {
    "B01": 0.2756307269810101,
    "B02": 0.31880099779056437,
    "B03": 0.030245793710797386,
    "B04": 0.38141118486770864,
    "B05": 0.05743611872642518,
    "B06": 0.0707908432241453,
    "B07": 0.07944703292135102,
    "B08": 0.08674939009544502,
    "B09": 0.022041074342016742,
    "B10": 0.07099026721724755,
    "B11": 0.07969303672591366,
    "B12": 0.0870472990310418
  },
  "maxIndoorDifferenceC": 0.38141118486770864,
  "maxDeliveredSupplyDifferenceC": 0.0,
  "maxFlowDifferenceM3s": 0.0,
  "packetInventoriesIdentical": false,
  "maxInventoryEnergyDifferenceJ": 3.5762786865234375e-07,
  "maxInventoryVolumeDifferenceM3": 1.7763568394002505e-15,
  "firstFrameStationReturnDifferenceC": 0.0389354590457458,
  "thresholdC": 0.2,
  "recommendedWarmupHours": 96
}
```

**changedInput:**

```json
{
  "officialWarmupHours": 96
}
```

**measured:**

```json
{
  "fallbackComparison": {
    "hoursCompared": [
      96,
      120
    ],
    "perBuildingDifferenceC": {
      "B01": 0.10230543138582959,
      "B02": 0.12466509925045344,
      "B03": 0.008402823581640462,
      "B04": 0.16310013987602545,
      "B05": 0.017630501124717313,
      "B06": 0.02312344140943523,
      "B07": 0.027444119226188946,
      "B08": 0.03152247791413032,
      "B09": 0.005318425859751841,
      "B10": 0.02317348555885701,
      "B11": 0.027512071988098796,
      "B12": 0.03161209817934463
    },
    "maxIndoorDifferenceC": 0.16310013987602545,
    "maxDeliveredSupplyDifferenceC": 0.0,
    "maxFlowDifferenceM3s": 0.0,
    "packetInventoriesIdentical": false,
    "maxInventoryEnergyDifferenceJ": 4.76837158203125e-07,
    "maxInventoryVolumeDifferenceM3": 1.7763568394002505e-15,
    "firstFrameStationReturnDifferenceC": 0.014899138119297106,
    "thresholdC": 0.2,
    "recommendedWarmupHours": 96
  },
  "selectedMaxIndoorDifferenceC": 0.16310013987602545
}
```

**threshold:**

```json
{
  "maxDifferenceC": 0.2,
  "fallbackAllowed": 96
}
```

**notes:**

```json
"72h fails; 96h adopted per specification, independently checked against 120h. Original 0.2\u00b0C threshold unchanged."
```

## G2.9 — Normal Winter adequacy — PASS

**inputs:**

```json
{
  "predeclaredComplianceMinimum": 0.95
}
```

**baseline:**

```json
"recommended curves"
```

**changedInput:**

```json
"96h warmup then 24h normal"
```

**measured:**

```json
{
  "scenarioId": "normal_winter",
  "controllerVersion": "traditional-v1.0",
  "metricDefinitionVersion": "building-time-endpoints-lower-percentiles-v1",
  "evaluationHours": 24,
  "frameCount": 288,
  "complianceRate": 0.984375,
  "comfortRate": 0.0,
  "overheatingRate": 0.6710069444444444,
  "severeOverheatingRate": 0.25,
  "underheatingRate": 0.015625,
  "minimumIndoorC": 17.92683134799679,
  "maximumIndoorC": 29.065108807953738,
  "P10C": 18.410923401669873,
  "P50C": 23.161718275320148,
  "P90C": 28.680672416844427,
  "temperatureSpreadC": 10.269749015174554,
  "heatEnergyMWh": 9.978827334070946,
  "pumpElectricityKWh": 26.001787725445993,
  "excessDeliveredHeatMWh": 0.8725489340709457,
  "excessHeatLabel": "Excess Delivered Heat Above Instantaneous Required Load",
  "hydraulicBalanceIndex": 0.9962228105057934,
  "solverFailureCount": 0
}
```

**threshold:**

```json
{
  "complianceMinimum": 0.95,
  "solverFailures": 0
}
```

**notes:**

```json
"Comfort=0 and high overheating are disclosed in fairness review; no narrow comfort requirement or stress tuning imposed."
```

## G2.10 — Cold-wave causality — PASS

**inputs:**

```json
{
  "case": "cold_wave"
}
```

**baseline:**

```json
"previous control-boundary outdoor/target"
```

**changedInput:**

```json
"falling current outdoor"
```

**measured:**

```json
{
  "comparedTransitions": 18,
  "minimumSupplyDeltaC": 0.29999999999999716,
  "minimumPumpDeltaHz": 0.19999999999999574
}
```

**threshold:**

```json
"targets rise or hold"
```

**notes:**

```json
""
```

## G2.11 — Rapid-warming causality — PASS

**inputs:**

```json
{
  "case": "rapid_warming"
}
```

**baseline:**

```json
"prior raw target"
```

**changedInput:**

```json
"increasing current outdoor"
```

**measured:**

```json
{
  "transitions": 12,
  "largestRawSupplyChangeC": -0.7999999999999972
}
```

**threshold:**

```json
"raw supply falls or holds; no added lag"
```

**notes:**

```json
""
```

## G2.12 — Solar cannot influence conventional actions — PASS

**inputs:**

```json
{
  "outdoorAndStartingControllerIdentical": true
}
```

**baseline:**

```json
"6b861d6091d3581f6fb68d4b1e31e06965bd22848c046c856234ca097997fd58"
```

**changedInput:**

```json
{
  "solarWm2Added": 300
}
```

**measured:**

```json
{
  "changedSolarActionsHash": "6b861d6091d3581f6fb68d4b1e31e06965bd22848c046c856234ca097997fd58",
  "physicalHeatChanged": true
}
```

**threshold:**

```json
"all actions identical"
```

**notes:**

```json
""
```

## G2.13 — Imbalance is a physical resistance disturbance — PASS

**inputs:**

```json
{
  "fixedValves": [
    0.5,
    0.6,
    0.85
  ]
}
```

**baseline:**

```json
{
  "farPipeK": 2000000000.0,
  "firstZoneFlowsM3s": [
    0.0038438689038090895,
    0.003756990589319157,
    0.003916214340150946
  ]
}
```

**changedInput:**

```json
{
  "farPipeMultiplier": 2
}
```

**measured:**

```json
{
  "firstZoneFlowsM3s": [
    0.003990749866653793,
    0.003900551779611274,
    0.003269667404550739
  ],
  "solver": {
    "status": "converged",
    "normalized_residual": 0.0,
    "iterations": 6,
    "message": "`gtol` termination condition is satisfied."
  },
  "initialTemperaturesIdentical": true
}
```

**threshold:**

```json
"same warm physical state, lower Far flow, solver converges, valves fixed"
```

**notes:**

```json
""
```

## G2.14 — Five 24-hour evaluations remain physically stable — PASS

**inputs:**

```json
{
  "dtSeconds": 300
}
```

**baseline:**

```json
"accepted P1A tolerances"
```

**changedInput:**

```json
"five cases"
```

**measured:**

```json
{
  "normal_winter": {
    "frames": 288,
    "allFinite": true,
    "allReturnsValid": true,
    "minFlowM3s": 0.003557504363337608,
    "minPumpW": 978.3676041980879,
    "maxHydraulicResidual": 3.0413478861152326e-16,
    "mass_residual": 1.197369276100629e-16,
    "heat_balance_residual": 1.7171946003522358e-15,
    "pipe_heat_balance_residual": 7.93304154553426e-15,
    "building_heat_balance_residual": 7.159012088777079e-14,
    "pipe_volume_residual": 2.8441668496015247e-15
  },
  "cold_wave": {
    "frames": 288,
    "allFinite": true,
    "allReturnsValid": true,
    "minFlowM3s": 0.0036572474763288346,
    "minPumpW": 1062.9890389052437,
    "maxHydraulicResidual": 2.4750134849298585e-13,
    "mass_residual": 1.2167051069595872e-16,
    "heat_balance_residual": 1.971785675050142e-15,
    "pipe_heat_balance_residual": 5.58996638797174e-15,
    "building_heat_balance_residual": 6.519728271617872e-14,
    "pipe_volume_residual": 2.9938598416858152e-15
  },
  "rapid_warming": {
    "frames": 288,
    "allFinite": true,
    "allReturnsValid": true,
    "minFlowM3s": 0.0031585319113745123,
    "minPumpW": 684.7334539680123,
    "maxHydraulicResidual": 1.0511484785848551e-13,
    "mass_residual": 1.217024189548059e-16,
    "heat_balance_residual": 2.0524285065108548e-15,
    "pipe_heat_balance_residual": 8.060175733281978e-15,
    "building_heat_balance_residual": 1.0567589474794415e-13,
    "pipe_volume_residual": 2.2453948812643613e-15
  },
  "sunny_winter": {
    "frames": 288,
    "allFinite": true,
    "allReturnsValid": true,
    "minFlowM3s": 0.003491008954677092,
    "minPumpW": 924.5249332552503,
    "maxHydraulicResidual": 2.390551130416141e-13,
    "mass_residual": 1.222819542831622e-16,
    "heat_balance_residual": 2.0797446566639294e-15,
    "pipe_heat_balance_residual": 7.526474300912814e-15,
    "building_heat_balance_residual": 8.288331469073794e-14,
    "pipe_volume_residual": 5.987719683371631e-16
  },
  "hydraulic_imbalance": {
    "frames": 288,
    "allFinite": true,
    "allReturnsValid": true,
    "minFlowM3s": 0.0030960567459020266,
    "minPumpW": 987.5351363623581,
    "maxHydraulicResidual": 2.9111319225728784e-16,
    "mass_residual": 1.1772750948261534e-16,
    "heat_balance_residual": 1.7110017186792564e-15,
    "pipe_heat_balance_residual": 6.759873458168454e-15,
    "building_heat_balance_residual": 6.491925703932256e-14,
    "pipe_volume_residual": 3.2932458258543967e-15
  }
}
```

**threshold:**

```json
{
  "finite": true,
  "massResidualLt": 1e-06,
  "heatResidualLt": 1e-05,
  "solverFailures": 0
}
```

**notes:**

```json
""
```

## G2.15 — Reproducibility from identical serialized evaluation state — PASS

**inputs:**

```json
{
  "scenarios": 5
}
```

**baseline:**

```json
"first complete run"
```

**changedInput:**

```json
"JSON round-trip and repeat"
```

**measured:**

```json
{
  "normal_winter": {
    "originalSha256": "3cf0631f0790fa08b03b9034b978772e9e5e31a1b2703e3ac1bd6959bdeee040",
    "repeatSha256": "3cf0631f0790fa08b03b9034b978772e9e5e31a1b2703e3ac1bd6959bdeee040",
    "identical": true
  },
  "cold_wave": {
    "originalSha256": "4c049c0834255e9c2d422bcd953f2565861ca0972c03c900d568ecae193d8949",
    "repeatSha256": "4c049c0834255e9c2d422bcd953f2565861ca0972c03c900d568ecae193d8949",
    "identical": true
  },
  "rapid_warming": {
    "originalSha256": "62753d6941d4e02b73ede1f158891162f366f60bb6d3e867691724d83997bc57",
    "repeatSha256": "62753d6941d4e02b73ede1f158891162f366f60bb6d3e867691724d83997bc57",
    "identical": true
  },
  "sunny_winter": {
    "originalSha256": "f79e81ea81d9650da713da7210fb006a2d26fef0339ae6f833d4e0d2ee9ef76a",
    "repeatSha256": "f79e81ea81d9650da713da7210fb006a2d26fef0339ae6f833d4e0d2ee9ef76a",
    "identical": true
  },
  "hydraulic_imbalance": {
    "originalSha256": "3e6842f0230b9e381337542ba515740de8b66d18c3a8ba8aedea8bb6c5fd05f6",
    "repeatSha256": "3e6842f0230b9e381337542ba515740de8b66d18c3a8ba8aedea8bb6c5fd05f6",
    "identical": true
  }
}
```

**threshold:**

```json
"byte-identical serialized frame/action/metric output"
```

**notes:**

```json
""
```

## G2.16 — Controller state serialization — PASS

**inputs:**

```json
{
  "retainedFields": [
    "controller_version",
    "raw_supply_target_c",
    "applied_supply_c",
    "raw_pump_target_hz",
    "applied_pump_hz",
    "fixed_valves",
    "last_boundary_s",
    "next_boundary_s"
  ]
}
```

**baseline:**

```json
{
  "controller_version": "traditional-v1.0",
  "raw_supply_target_c": 53.4,
  "applied_supply_c": 53.4,
  "raw_pump_target_hz": 45.2,
  "applied_pump_hz": 45.2,
  "fixed_valves": [
    0.5,
    0.6,
    0.85
  ],
  "last_boundary_s": -1800,
  "next_boundary_s": 0
}
```

**changedInput:**

```json
"JSON serialize/restore"
```

**measured:**

```json
{
  "controller_version": "traditional-v1.0",
  "raw_supply_target_c": 53.4,
  "applied_supply_c": 53.4,
  "raw_pump_target_hz": 45.2,
  "applied_pump_hz": 45.2,
  "fixed_valves": [
    0.5,
    0.6,
    0.85
  ],
  "last_boundary_s": -1800,
  "next_boundary_s": 0
}
```

**threshold:**

```json
"state and next action identical"
```

**notes:**

```json
""
```

## G2.17 — Common physical initial-state export — PASS

**inputs:**

```json
{
  "includes": "temperature, controls, clock, hydraulic warm start, FIFO packets, energies, controller, config/parameter identity"
}
```

**baseline:**

```json
"original first frames"
```

**changedInput:**

```json
"restore all five initial states"
```

**measured:**

```json
{
  "normal_winter": {
    "originalFirstFrameHash": "6b0abd36e941d81ddb024ce9f5c05dcd737a583191ac77ba44ae89898cabdf8d",
    "restoredFirstFrameHash": "6b0abd36e941d81ddb024ce9f5c05dcd737a583191ac77ba44ae89898cabdf8d"
  },
  "cold_wave": {
    "originalFirstFrameHash": "c8f256bc12bb45a04c6c6eca7d7125a5716818ed129da633e4272b33cb3e71b8",
    "restoredFirstFrameHash": "c8f256bc12bb45a04c6c6eca7d7125a5716818ed129da633e4272b33cb3e71b8"
  },
  "rapid_warming": {
    "originalFirstFrameHash": "6b0abd36e941d81ddb024ce9f5c05dcd737a583191ac77ba44ae89898cabdf8d",
    "restoredFirstFrameHash": "6b0abd36e941d81ddb024ce9f5c05dcd737a583191ac77ba44ae89898cabdf8d"
  },
  "sunny_winter": {
    "originalFirstFrameHash": "480c897699c185028bb0eb8df8ed4b685d27a58c8371b3ced3aa3152fdeff71e",
    "restoredFirstFrameHash": "480c897699c185028bb0eb8df8ed4b685d27a58c8371b3ced3aa3152fdeff71e"
  },
  "hydraulic_imbalance": {
    "originalFirstFrameHash": "25c48157598b9a335a0e4ff6874f0091aa3c4c3c05d2c27eba6d6e7deb66a2e0",
    "restoredFirstFrameHash": "25c48157598b9a335a0e4ff6874f0091aa3c4c3c05d2c27eba6d6e7deb66a2e0"
  }
}
```

**threshold:**

```json
"first frames exactly identical"
```

**notes:**

```json
""
```

## G2.18 — Complete accepted P1A regression and immutable physics — PASS

**inputs:**

```json
{
  "acceptedManifest": "p2_accepted_p1a_manifest.json"
}
```

**baseline:**

```json
"84 tests, 32 Gates"
```

**changedInput:**

```json
"add P2 modules only"
```

**measured:**

```json
{
  "testCommand": {
    "label": "P1A tests",
    "command": "/Users/yl/Documents/Codex/Heat/physical_core/.venv/bin/python -m pytest physical_core/tests/test_hydraulics.py physical_core/tests/test_transport.py physical_core/tests/test_thermal.py physical_core/tests/test_validation.py physical_core/tests/test_simulation.py -q",
    "exitCode": 0,
    "passed": 84,
    "failed": 0,
    "skipped": 0,
    "output": "........................................................................ [ 85%]\n............                                                             [100%]\n84 passed in 0.47s\n"
  },
  "gatePassCount": 32,
  "gateFailCount": 0,
  "changedAcceptedFiles": []
}
```

**threshold:**

```json
"all tests/Gates pass; no accepted file changes"
```

**notes:**

```json
""
```

## G2.19 — Frozen P0 regression — PASS

**inputs:**

```json
{
  "commands": [
    "npx tsc --noEmit",
    "npm run test",
    "npm run build"
  ]
}
```

**baseline:**

```json
"frozen React/domain/seam"
```

**changedInput:**

```json
"run checks after P2"
```

**measured:**

```json
{
  "commands": [
    {
      "label": "P0 typecheck",
      "command": "npx tsc --noEmit",
      "exitCode": 0,
      "passed": null,
      "failed": 0,
      "skipped": 0,
      "output": ""
    },
    {
      "label": "P0 tests",
      "command": "npm run test",
      "exitCode": 0,
      "passed": 62,
      "failed": 0,
      "skipped": 0,
      "output": "\n> ai-heating-optimisation-digital-twin@0.1.0 test\n> tsx scripts/p0-invariants.ts\n\nP0 invariant tests: 62 passed, 0 failed, 0 skipped\n"
    },
    {
      "label": "P0 build",
      "command": "npm run build",
      "exitCode": 0,
      "passed": null,
      "failed": 0,
      "skipped": 0,
      "output": "\n> ai-heating-optimisation-digital-twin@0.1.0 build\n> tsc -b && vite build\n\nvite v8.2.2 building client environment for production...\ntransforming...\n\u2713 19 modules transformed.\nrendering chunks...\ncomputing gzip size...\ndist/index.html                   0.47 kB \u2502 gzip:  0.30 kB\ndist/assets/index-C2i2aTou.css   17.11 kB \u2502 gzip:  4.67 kB\ndist/assets/index-Dx143W9w.js   252.56 kB \u2502 gzip: 78.48 kB\n\n\u2713 built in 51ms\n"
    }
  ],
  "frozenSourceDiffExit": 0
}
```

**threshold:**

```json
"typecheck/tests/build exit zero; no source changes"
```

**notes:**

```json
""
```

## G2.20 — No forbidden controller dependencies or scenario branches — PASS

**inputs:**

```json
{
  "files": [
    "__init__.py",
    "commissioning.py",
    "traditional.py"
  ]
}
```

**baseline:**

```json
"no AI dependency permitted"
```

**changedInput:**

```json
"AST source audit"
```

**measured:**

```json
{
  "imports": [
    "bisect",
    "constants",
    "contracts",
    "dataclasses",
    "hydraulics",
    "math",
    "parameters"
  ],
  "suspiciousReferences": []
}
```

**threshold:**

```json
"no ML/prediction/optimisation/scenario/indoor/solar inputs"
```

**notes:**

```json
""
```
