import { randomUUID } from "node:crypto";
import { p } from "./physics-node.mjs";

// Proposed equipment exists only in an isolated, explicitly commissioned model.
// There is no endpoint for installing it in a field controller.
export function engineeringStudy(s, args, tools) {
  if (args.revision !== s.revision || args.contextId !== s.contextId)
    throw Error(
      "Engineering context changed; refresh before comparing options",
    );
  if (s.engineeringOrigin)
    throw Error(
      "Return to the original scenario before starting another engineering study",
    );
  const goal = args.goal;
  if (
    goal?.metric !== "temperature" ||
    goal?.scope !== "asset" ||
    !goal.allowShared
  )
    throw Error(
      "Engineering studies require a building temperature goal and shared-control permission",
    );
  const initial = tools.snapshot(s),
    id = goal.assetId;
  const profile = p.buildings.find((b) => b.building_id === id);
  if (!profile) throw Error("Unknown engineering asset");
  const studyId = randomUUID(),
    rows = [],
    stored = {};
  const run = (key, label, design, assumptions) => {
    const copy = structuredClone(s);
    copy.candidates = {};
    copy.studies = {};
    copy.engine.design = design;
    if (design.localValves) {
      design.setpoints = { [id]: goal.target };
      // A design alternative starts with commissioned local valves; no claim
      // that installing or commissioning them takes zero real-world time.
      copy.engine.localOpenings = Object.fromEntries(
        Object.entries(copy.engine.temperatures).map(([bid, t]) => [
          bid,
          Math.max(
            1,
            Math.min(100, 40 + 80 * ((design.setpoints[bid] ?? 21) - t)),
          ),
        ]),
      );
    }
    const optimisation = tools.optimise(copy, { goal, objective: "comfort" });
    const result = optimisation.bestAttempt;
    // Do not expose an operating token belonging to the cloned scenario.
    delete result.candidateId;
    if (optimisation.recommendation)
      delete optimisation.recommendation.candidateId;
    optimisation.recommendation = null;
    const at = result.goalSamples.find(
      (v) => v.minutes === goal.deadlineMinutes,
    );
    const row = {
      id: key,
      label,
      kind: key === "operations" ? "operations" : "engineering",
      assumptions,
      goalResult: optimisation.goalResult,
      heatKwh: at.heatKwh,
      pumpKwh: at.pumpKwh,
      auxiliaryKwh: at.auxiliaryKwh,
      auxiliaryCapacityKw: design.buildings?.[id]?.auxiliaryKw || 0,
      emitterFactor: design.buildings?.[id]?.emitterFactor || 1,
      lossFactor: design.buildings?.[id]?.lossFactor || 1,
      passed: optimisation.verification.passed,
      optimisation,
    };
    stored[key] = {
      design,
      localOpenings: copy.engine.localOpenings,
      optimisation,
      label,
    };
    rows.push(row);
    return row;
  };
  run("operations", "Existing equipment", {}, [
    "Six half-hour stages; shared station and all branch valves may coordinate.",
  ]);
  run("local-valves", "Commissioned building valves", { localValves: true }, [
    "Twelve added building valves, commissioned at the start; normalised equivalent hydraulic resistance, not surveyed pipework.",
  ]);
  run(
    "emitters",
    "Building valves and larger emitter",
    { localValves: true, buildings: { [id]: { emitterFactor: 2 } } },
    [
      "Selected building emitter UA doubled; same thermal mass and initial temperature. Capacity and installation need engineering review.",
    ],
  );
  run(
    "emitters-3",
    "Building valves and triple emitter UA",
    { localValves: true, buildings: { [id]: { emitterFactor: 3 } } },
    [
      "Selected building emitter UA tripled, not heat output tripled. Space, circuit pressure drop and equipment capacity require verification; this is a proposed retrofit, not a repair already performed.",
    ],
  );
  run(
    "envelope",
    "Building valves and envelope retrofit",
    { localValves: true, buildings: { [id]: { lossFactor: 0.7 } } },
    [
      "Selected building envelope conductance reduced by 30%; not a measured insulation product performance.",
    ],
  );
  run(
    "resistance",
    "Building valves and lower branch resistance",
    { localValves: true, branchResistance: { [profile.zone]: 0.65 } },
    [
      "Selected branch pipe resistance reduced by 35%; an upgrade or verified obstruction-removal hypothesis, not an established fault.",
    ],
  );
  const capacities = [];
  for (const kw of [20, 40, 60, 80, 100, 120, 160, 200]) {
    const row = run(
      `auxiliary-${kw}`,
      "Building valves and local auxiliary heat",
      {
        localValves: true,
        buildings: { [id]: { auxiliaryKw: kw, targetC: goal.target } },
      },
      [
        "Added local electric resistance heat with ideal thermostat and COP 1; electrical supply, protection and installation must be verified separately.",
      ],
    );
    capacities.push({
      kw,
      passed: row.passed,
      achievedC: row.goalResult.achieved,
    });
    if (row.passed) break;
  }
  const feasible = rows.filter((r) => r.passed);
  const preferred = feasible[0] || null;
  const temperature = initial.buildings.find((b) => b.id === id).modelC;
  const output = {
    studyId,
    revision: s.revision,
    contextId: s.contextId,
    cityId: s.cityId,
    assetId: id,
    goal,
    initialC: temperature,
    storedHeatIncreaseKwh:
      (Math.max(0, goal.target - temperature) *
        profile.thermal_capacitance_j_k) /
      3.6e6,
    rows,
    capacities,
    preferredId: preferred?.id || null,
    authority:
      "Counterfactual engineering evidence only. Operator must explicitly open an isolated scenario. No field installation or actuation.",
    sizing:
      "First passing tested capacity, not a certified minimum; weather and physical parameters are uncalibrated.",
  };
  s.studies ||= {};
  if (Object.keys(s.studies).length >= 3)
    delete s.studies[Object.keys(s.studies)[0]];
  s.studies[studyId] = {
    revision: s.revision,
    contextId: s.contextId,
    expires: Date.now() + 600000,
    rows: stored,
    goal,
  };
  return output;
}

export function openEngineeringScenario(s, args, tools) {
  const study = s.studies?.[args.studyId],
    chosen = study?.rows[args.optionId];
  if (
    !study ||
    !chosen ||
    study.revision !== s.revision ||
    study.contextId !== s.contextId ||
    Date.now() > study.expires ||
    s.engineeringOrigin
  )
    throw Error("Engineering proposal expired or context changed");
  if (
    !chosen.optimisation.verification.passed ||
    args.optionId === "operations"
  )
    throw Error(
      "Only a verified engineering alternative can open a modified scenario",
    );
  const origin = structuredClone({ ...s, studies: {}, candidates: {} });
  const copy = structuredClone(origin);
  copy.engine.design = structuredClone(chosen.design);
  copy.engine.localOpenings = structuredClone(chosen.localOpenings);
  // Re-solve from the unchanged starting state, then enact only one half-hour.
  const check = tools.optimise(copy, {
    goal: study.goal,
    objective: "comfort",
  });
  if (!check.verification.passed)
    throw Error("Engineering alternative failed fresh verification");
  copy.candidates = {};
  copy.contextId = randomUUID();
  copy.engineeringOrigin = origin;
  copy.engineeringLabel = chosen.label;
  copy.engineeringGoal = structuredClone(study.goal);
  copy.engineeringDeadline =
    origin.engine.elapsed / 60 + study.goal.deadlineMinutes;
  const first = check.bestAttempt.schedule[0];
  tools.advance(copy, 6, {
    supplyC: first.supplyC,
    pumpHz: first.pumpHz,
    valvesPct: first.valvesPct,
  });
  copy.events.push({
    time: tools.snapshot(copy).time,
    title: "Engineering scenario opened",
    detail:
      "Modified model only; first 30 minutes simulated. Original scenario preserved.",
  });
  Object.assign(s, copy);
  return tools.snapshot(s);
}
