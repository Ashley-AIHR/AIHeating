// A numerical contract, not free-form LLM instructions. It never grants actuation.
export function operatingGoal(input, snapshot) {
  if (input == null) return null;
  const keys = [
    "metric",
    "scope",
    "assetId",
    "target",
    "deadlineMinutes",
    "minC",
    "maxC",
    "allowShared",
  ];
  if (
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !keys.includes(k))
  )
    throw Error("Invalid operating goal");
  const {
    metric,
    scope,
    assetId,
    target,
    deadlineMinutes,
    minC,
    maxC,
    allowShared,
  } = input;
  const ranges = {
    temperature: [18, 24],
    heatReduction: [0, 40],
    pumpReduction: [0, 40],
    temperatureSpread: [0.2, 8],
  };
  if (
    !Object.hasOwn(ranges, metric) ||
    !["asset", "branch", "district"].includes(scope) ||
    !Number.isFinite(target) ||
    target < ranges[metric][0] ||
    target > ranges[metric][1] ||
    ![30, 60, 90, 120, 150, 180].includes(deadlineMinutes) ||
    !Number.isFinite(minC) ||
    !Number.isFinite(maxC) ||
    minC < 18 ||
    maxC > 26 ||
    minC >= maxC ||
    typeof allowShared !== "boolean"
  )
    throw Error("Invalid operating goal bounds");
  if (metric === "pumpReduction" && scope !== "district")
    throw Error("Pump electricity is shared; use district scope");
  if (metric === "temperatureSpread" && scope === "asset")
    throw Error("Temperature spread requires a branch or district");
  const buildings = snapshot.buildings.filter(
    (b) =>
      scope === "district" ||
      (scope === "asset" ? b.id === assetId : b.zone === assetId),
  );
  if (!buildings.length || (scope === "district" && assetId !== "ST01"))
    throw Error("Unknown operating goal scope");
  if (metric === "temperature" && (target < minC || target > maxC))
    throw Error("Temperature target is outside the comfort guardrails");
  return {
    metric,
    scope,
    assetId,
    target,
    deadlineMinutes,
    minC,
    maxC,
    allowShared,
    buildingIds: buildings.map((b) => b.id),
    branchIds: [...new Set(buildings.map((b) => b.zone))],
    toleranceC: 0.3,
    initialTemperatures: Object.fromEntries(
      snapshot.buildings.map((b) => [b.id, b.modelC]),
    ),
    authority:
      "Operator-defined simulator goal. All buildings must satisfy the comfort band from the deadline onwards. Before it, do not worsen existing band violations. Shared physical controls only; no individual building valve exists.",
  };
}

export function assessGoal(goal, row, baseline) {
  if (!goal) return null;
  const sample = row.goalSamples.find(
    (s) => s.minutes === goal.deadlineMinutes,
  );
  const base = baseline.goalSamples.find(
    (s) => s.minutes === goal.deadlineMinutes,
  );
  const temperatures = goal.buildingIds.map((id) => sample.temperatures[id]);
  const heat = (s) =>
    goal.scope === "district"
      ? s.heatKwh
      : goal.buildingIds.reduce((sum, id) => sum + s.buildingHeatKwh[id], 0);
  let achieved, unit, error;
  if (goal.metric === "temperature") {
    achieved =
      temperatures.reduce((sum, t) => sum + t, 0) / temperatures.length;
    unit = "°C";
    error = Math.max(
      ...temperatures.map((t) =>
        Math.max(0, Math.abs(t - goal.target) - goal.toleranceC),
      ),
    );
  } else if (goal.metric === "temperatureSpread") {
    achieved = Math.max(...temperatures) - Math.min(...temperatures);
    unit = "°C";
    error = Math.max(0, achieved - goal.target);
  } else {
    const a = goal.metric === "pumpReduction" ? sample.pumpKwh : heat(sample);
    const b = goal.metric === "pumpReduction" ? base.pumpKwh : heat(base);
    achieved = b > 1e-9 ? ((b - a) / b) * 100 : 0;
    unit = "%";
    error = Math.max(0, goal.target - achieved) / 10;
  }
  let violation = 0;
  const affected = new Set();
  for (const s of row.goalSamples)
    for (const [id, t] of Object.entries(s.temperatures)) {
      const lo =
        s.minutes >= goal.deadlineMinutes
          ? goal.minC
          : Math.min(goal.minC, goal.initialTemperatures[id]);
      const hi =
        s.minutes >= goal.deadlineMinutes
          ? goal.maxC
          : Math.max(goal.maxC, goal.initialTemperatures[id]);
      const miss = Math.max(0, lo - t, t - hi);
      if (miss > 1e-6) affected.add(id);
      violation += (miss * miss) / row.goalSamples.length;
    }
  return {
    target: goal.target,
    achieved,
    unit,
    deadlineMinutes: goal.deadlineMinutes,
    targetMet: error < 1e-6,
    guardrailsMet: violation < 1e-10,
    passed: error < 1e-6 && violation < 1e-10,
    targetError: error,
    guardrailPenalty: violation,
    violatingAssets: [...affected],
    targetBuildings: Object.fromEntries(
      goal.buildingIds.map((id) => [id, sample.temperatures[id]]),
    ),
    message:
      error < 1e-6 && violation < 1e-10
        ? "Goal achieved in model"
        : "Requested goal not reached within the tested control envelope",
    scope: goal.scope,
    assetId: goal.assetId,
    metric: goal.metric,
  };
}
