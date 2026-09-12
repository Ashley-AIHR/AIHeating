import { randomUUID, createHash } from "node:crypto";
import { p, createEngine, step, validate } from "./physics-node.mjs";
export const SCENARIOS = {
  imbalance: {
    name: "Cold at the end of the network",
    outdoor: -8,
    solar: 45,
    description:
      "Restricted far-zone valve; warm near-zone buildings and colder far-zone buildings.",
  },
  warming: {
    name: "Sunrise demand drop",
    outdoor: -3,
    solar: 240,
    description:
      "Rising outdoor temperature and solar gains reduce demand while stored heat arrives later.",
  },
  cold: {
    name: "Cold-front resilience",
    outdoor: -14,
    solar: 15,
    description:
      "A cold front tests network capacity and stored building heat.",
  },
  sensor: {
    name: "A reading that does not fit",
    outdoor: -8,
    solar: 45,
    description:
      "B10 has an injected sensor bias; model temperature remains separate.",
  },
  window: {
    name: "Local building heat loss",
    outdoor: -8,
    solar: 45,
    description:
      "Additional ventilation loss in B03; investigate locally before raising network supply.",
  },
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length,
  sessions = new Map();
function weather(s, offset = 0) {
  const w = SCENARIOS[s.scenario];
  return {
    outdoor:
      w.outdoor +
      (s.scenario === "warming"
        ? Math.min((s.engine.elapsed + offset) / 3600, 6) * 1.2
        : 0),
    solar: w.solar,
    wind: 3.4,
  };
}
export function newSession(scenario = "imbalance") {
  if (!Object.hasOwn(SCENARIOS, scenario)) throw Error("Unknown scenario");
  const initial = [
    23.5, 23.1, 22.5, 23.6, 21.3, 21.6, 21.1, 21.4, 19, 18.6, 18.9, 19.1,
  ];
  const temperatures = Object.fromEntries(
    p.buildings.map((b, i) => [
      b.building_id,
      scenario === "imbalance" ? initial[i] : 21 + (i % 4) * 0.15,
    ]),
  );
  const s = {
    scenario,
    engine: createEngine(
      {
        supplyC: 52,
        pumpHz: 45,
        valvesPct: scenario === "imbalance" ? [78, 58, 35] : [60, 65, 85],
      },
      temperatures,
    ),
    history: [],
    events: [],
    revision: 0,
    candidates: {},
    frames: [],
    touched: Date.now(),
    windows: scenario === "window" ? { B03: 0.45 } : {},
  };
  advance(s, 6);
  s.events.push({
    time: snapshot(s).time,
    title: "Session initialised",
    detail: "Winter-city vision · Node.js physical model · 5-minute substeps",
  });
  return s;
}
export function snapshot(s, history = true) {
  const f = s.frame,
    e = s.engine;
  const buildings = p.buildings.map((b, i) => {
    const v = f.buildings[b.building_id],
      biased = s.scenario === "sensor" && b.building_id === "B10";
    return {
      id: b.building_id,
      zone: b.zone,
      areaM2: b.heated_area_m2,
      year: b.construction_year,
      insulation: b.insulation_level,
      floors: b.floors,
      indoorC: v.temp - (biased ? 3.2 : 0),
      modelC: v.temp,
      quality: biased ? "suspect" : "simulated",
      heatKw: v.heat / 1000,
      flowM3h: (v.mass / p.water.rho_water) * 3600,
      returnC: v.returnC,
      envelopeKw: v.envelope / 1000,
      windowKw: v.windowLoss / 1000,
      solarKw: v.solar / 1000,
      storageKw: v.storage / 1000,
      position: [-14 + (i % 4) * 9, -11 + Math.floor(i / 4) * 12],
    };
  });
  const time = new Date(Date.UTC(2025, 0, 15, 8) + e.elapsed * 1000)
    .toISOString()
    .replace(".000Z", "+08:00");
  return {
    scenario: s.scenario,
    scenarioName: SCENARIOS[s.scenario].name,
    scenarioDescription: SCENARIOS[s.scenario].description,
    revision: s.revision,
    time,
    elapsedMinutes: e.elapsed / 60,
    source: "Yinchuan-inspired vision · simulated P1A · native Node.js",
    outdoorC: f.w.outdoor,
    solarWm2: f.w.solar,
    windMs: f.w.wind,
    supplyC: e.controls.supplyC,
    returnC: f.returnC,
    pumpHz: e.controls.pumpHz,
    pressureKpa: f.h.available / 1000,
    flowM3h: f.h.total * 3600,
    pumpKw: f.h.power / 1000,
    loadKw: f.load / 1000,
    heatKw: f.heat / 1000,
    sourceHeatKw: f.source / 1000,
    pipeStorageKw: f.pipeStorage / 1000,
    heatKwh: e.heatJ / 3.6e6,
    pumpKwh: e.pumpJ / 3.6e6,
    solverResidual: f.h.residual,
    energyResidual: f.residual,
    buildings,
    zones: f.branch,
    history: history ? s.history : [],
    events: s.events.slice(-30),
    thresholdC: 18,
    targetC: 21,
    limits: {
      supplyC: [40, 60],
      pumpHz: [30, 50],
      valvePct: [20, 100],
      stepSupplyC: 2,
      stepPumpHz: 2,
      stepValvePct: 10,
    },
    assumptions: [
      "Authored winter-city district; 12 aggregate thermal loads, not surveyed buildings",
      "Adiabatic supply transport; return delay and pipe heat loss are not modelled",
      "18°C is a demonstration floor, not a nationwide compliance certification",
      "Simulated operation; no real SCADA, weather feed or field controls connected",
    ],
  };
}
export function advance(s, steps = 6, controls) {
  if (s.engine.elapsed + steps * 300 > 86400)
    throw Error("24-hour demonstration complete; reset to start again");
  const next = structuredClone(s);
  for (let i = 0; i < steps; i++)
    next.frame = step(
      next.engine,
      weather(next),
      i === 0 ? controls : null,
      next.windows,
    );
  next.revision++;
  next.candidates = {};
  const record = snapshot(next, false);
  next.frames = [...next.frames, record].slice(-48);
  next.history = [
    ...next.history,
    {
      time: record.time.slice(11, 16),
      elapsedMinutes: record.elapsedMinutes,
      supplyC: record.supplyC,
      returnC: record.returnC,
      loadKw: record.loadKw,
      heatKw: record.heatKw,
      minimumC: Math.min(...record.buildings.map((b) => b.indoorC)),
      meanC: mean(record.buildings.map((b) => b.indoorC)),
    },
  ].slice(-48);
  Object.assign(s, next);
}
export function candidateControls(s, args) {
  return validate({ ...s.engine.controls, ...args }, s.engine.controls);
}
export function rollout(s, controls, hours = 3, second) {
  const e = structuredClone(s.engine),
    initialHeat = e.heatJ,
    initialPump = e.pumpJ,
    trace = [];
  let minimumC = Math.min(...Object.values(e.temperatures)),
    overheated = 0,
    count = 0,
    comfortPenalty = 0,
    maxResidual = 0,
    maxPressureKpa = 0;
  for (let i = 0; i < hours * 12; i++) {
    const f = step(
        e,
        weather(s, i * 300),
        i === 0 ? controls : i === 18 ? second : null,
        s.windows,
      ),
      temps = Object.values(e.temperatures);
    maxResidual = Math.max(maxResidual, f.h.residual, f.residual);
    maxPressureKpa = Math.max(maxPressureKpa, f.h.available / 1000);
    minimumC = Math.min(minimumC, ...temps);
    overheated += temps.filter((t) => t > 23).length;
    count += temps.length;
    comfortPenalty +=
      temps.reduce(
        (sum, t) => sum + Math.max(20 - t, 0) ** 2 + Math.max(t - 22, 0) ** 2,
        0,
      ) / 12;
    if ((i + 1) % 6 === 0)
      trace.push({
        minutes: (i + 1) * 5,
        minimumC: Math.min(...temps),
        meanC: mean(temps),
        state: snapshot({ ...s, engine: e, frame: f }, false),
        heatKw: f.heat / 1000,
        returnC: f.returnC,
        buildings: Object.fromEntries(
          Object.entries(f.buildings).map(([id, b]) => [
            id,
            { indoorC: b.temp, heatKw: b.heat / 1000, returnC: b.returnC },
          ]),
        ),
      });
  }
  return {
    heatKwh: (e.heatJ - initialHeat) / 3.6e6,
    pumpKwh: (e.pumpJ - initialPump) / 3.6e6,
    minimumC,
    endMinimumC: Math.min(...Object.values(e.temperatures)),
    overheatingPct: (100 * overheated) / count,
    comfortPenalty,
    trace,
    verified: minimumC >= 18,
    verification:
      minimumC >= 18
        ? "Passed 18°C simulation floor"
        : "Rejected: 18°C simulation floor violated",
    controls: structuredClone(controls),
    maxResidual,
    maxPressureKpa,
    method: "P1A nonlinear rollout · native Node.js · 3 h · not P6 MPC",
    hours,
  };
}
export function diagnose(s, buildingId) {
  const view = snapshot(s),
    findings = [];
  for (const b of view.buildings) {
    if (b.quality === "suspect")
      findings.push({
        id: "sensor-" + b.id,
        severity: "warning",
        asset: b.id,
        title: "Temperature measurement disagreement",
        evidence: `Reading ${b.indoorC.toFixed(2)}°C differs from synthetic model ${b.modelC.toFixed(2)}°C by -3.20°C.`,
        action:
          "Check a reference thermometer and timestamp before changing heat supply.",
        certainty:
          "Injected demonstration fault; no trained virtual-sensor model.",
      });
    else if (b.indoorC < 20) {
      const z = view.zones.find((z) => z.id === b.zone);
      findings.push({
        id: "cold-" + b.id,
        severity: b.indoorC < 18 ? "critical" : "warning",
        asset: b.id,
        title: "Building below comfort band",
        evidence: `${b.indoorC.toFixed(2)}°C; branch flow ${z.flowM3h.toFixed(2)} m³/h; valve ${z.valvePct.toFixed(0)}%; delay ${z.delayMinutes.toFixed(1)} min.`,
        action:
          "Compare branch balancing with a station supply increase; inspect local losses.",
        certainty:
          "Observed in simulation; root cause requires comparison and site measurements.",
      });
    }
    if (b.windowKw > 1)
      findings.push({
        id: "loss-" + b.id,
        severity: "warning",
        asset: b.id,
        title: "Additional local ventilation loss",
        evidence: `Injected ventilation term contributes ${b.windowKw.toFixed(2)} kW.`,
        action:
          "Inspect the local ventilation condition; retain resident ventilation requirements.",
        certainty:
          "Known scenario input, not inferred window-opening detection.",
      });
  }
  const warm = view.buildings
    .filter((b) => b.indoorC > 23 && b.quality !== "suspect")
    .map((b) => b.id);
  if (warm.length)
    findings.push({
      id: "overheat",
      severity: "info",
      asset: warm[0],
      title: "Uneven heat distribution",
      evidence:
        warm.join(", ") + " exceed the demo 23°C overheating threshold.",
      action:
        "Test flow redistribution before adding heat for the whole network.",
      certainty:
        "Temperature spread is observed; a cause is not established by correlation alone.",
    });
  return {
    revision: s.revision,
    selected: view.buildings.find((b) => b.id === buildingId) || null,
    findings,
    summary: `${findings.length} findings across 12 simulated buildings`,
    source: "P1A numerical evidence + explicit diagnostic rules",
  };
}
function storePlan(s, data) {
  const keys = Object.keys(s.candidates);
  if (keys.length >= 20) delete s.candidates[keys[0]];
  const id = randomUUID();
  s.candidates[id] = { revision: s.revision, ...data };
  return id;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function compare(s) {
  const c = s.engine.controls,
    v = c.valvesPct;
  const options = [
    ["hold", "Hold current controls", c],
    [
      "balance",
      "Redistribute branch flow",
      {
        ...c,
        valvesPct: [clamp(v[0] - 10, 20, 100), v[1], clamp(v[2] + 10, 20, 100)],
      },
    ],
    [
      "cool",
      "Reduce supply by 2°C",
      { ...c, supplyC: clamp(c.supplyC - 2, 40, 60) },
    ],
    [
      "warm",
      "Raise supply by 2°C",
      { ...c, supplyC: clamp(c.supplyC + 2, 40, 60) },
    ],
    [
      "pump",
      "Raise pump by 2 Hz",
      { ...c, pumpHz: clamp(c.pumpHz + 2, 30, 50) },
    ],
  ];
  const candidates = options.map(([id, label, c]) => ({
    ...rollout(s, c),
    id,
    label,
  }));
  const feasible = candidates
    .filter((r) => r.verified)
    .sort(
      (a, b) =>
        a.heatKwh * 0.01 +
        a.pumpKwh * 0.1 +
        a.comfortPenalty -
        (b.heatKwh * 0.01 + b.pumpKwh * 0.1 + b.comfortPenalty),
    );
  const recommendation = feasible[0] || null;
  if (recommendation)
    recommendation.candidateId = storePlan(s, {
      controls: recommendation.controls,
    });
  return {
    revision: s.revision,
    candidates,
    recommendation,
    baseline: candidates[0],
    objective:
      "Illustrative weighted heat + pump energy + quadratic discomfort; not a tariff or savings guarantee.",
  };
}
export function optimise(s, args = {}) {
  const objective = args.objective || "balanced",
    weights = {
      balanced: [0.01, 0.1, 1],
      comfort: [0.002, 0.02, 3],
      energy: [0.03, 0.3, 1],
    }[objective];
  if (!weights) throw Error("Unknown optimisation objective");
  const c = s.engine.controls,
    start = [c.supplyC, c.pumpHz, ...c.valvesPct],
    lo = [40, 30, 20, 20, 20],
    hi = [60, 50, 100, 100, 100],
    ramp = [2, 2, 10, 10, 10],
    cache = new Map();
  const controls = (x) => {
    const a = start.map((v, i) => clamp(v + x[i] * ramp[i], lo[i], hi[i])),
      b = a.map((v, i) => clamp(v + x[i + 5] * ramp[i], lo[i], hi[i]));
    return [a, b].map((v) => ({
      supplyC: v[0],
      pumpHz: v[1],
      valvesPct: v.slice(2),
    }));
  };
  const valid = (r) =>
    r.verified && r.maxResidual <= 1e-6 && r.maxPressureKpa <= 250;
  const evaluate = (x) => {
    const key = x.map((v) => v.toFixed(5)).join(",");
    if (!cache.has(key)) {
      const [a, b] = controls(x),
        row = rollout(s, a, 3, b),
        cost =
          weights[0] * row.heatKwh +
          weights[1] * row.pumpKwh +
          weights[2] * row.comfortPenalty;
      cache.set(key, [
        valid(row) ? cost : 1e9 + Math.max(0, 18 - row.minimumC) * 1e6 + cost,
        row,
      ]);
    }
    return cache.get(key);
  };
  let x = Array(10).fill(0);
  const baseline = evaluate(x)[1];
  for (const mesh of [1, 0.5])
    for (let i = 0; i < 10; i++) {
      const trials = [
        x,
        ...[-1, 1].map((d) =>
          x.map((v, j) => (i === j ? clamp(v + d * mesh, -1, 1) : v)),
        ),
      ];
      x = trials.reduce((best, t) =>
        evaluate(t)[0] < evaluate(best)[0] ? t : best,
      );
    }
  const chosen = evaluate(x)[1],
    [a, b] = controls(x),
    check = rollout(s, a, 3, b),
    feasible = valid(check);
  const schedule = [
      { minute: 0, ...a },
      { minute: 90, ...b },
    ],
    planHash = createHash("sha256")
      .update(
        JSON.stringify({
          revision: s.revision,
          scenario: s.scenario,
          schedule,
          model: "P1A-coherent-v1.2-node",
        }),
      )
      .digest("hex");
  const result = {
    ...chosen,
    id: "optimised",
    label: "Numerically optimised schedule",
    verified: feasible,
    schedule,
    planHash,
  };
  if (feasible)
    result.candidateId = storePlan(s, {
      controls: a,
      second: b,
      expires: Date.now() + 300000,
      optimised: true,
    });
  return {
    revision: s.revision,
    objective,
    baseline,
    recommendation: feasible ? result : null,
    bestAttempt: result,
    evaluations: cache.size + 1,
    solver: "Bounded coordinate pattern search; two 90-minute control blocks",
    status: feasible ? "feasible best found" : "no feasible plan found",
    verification: {
      passed: feasible,
      minimumC: check.minimumC,
      maxResidual: check.maxResidual,
      maxPressureKpa: check.maxPressureKpa,
      planHash,
      scope:
        "Fresh rollout using the same model; not independent field validation",
    },
    limitations: [
      "No global optimality guarantee; fixed evaluation budget",
      "Synthetic forecast and uncalibrated aggregate building parameters",
      "18°C and 250 kPa are demonstration gates, not site operating limits",
      "Apply commits only the next 30 minutes in simulation; re-optimise afterwards",
      "Uncertainty is not quantified; no field actuation",
    ],
  };
}
export function dispatch(id, method, args = {}) {
  for (const [key, s] of sessions)
    if (Date.now() - s.touched > 3600000) sessions.delete(key);
  if (!sessions.has(id)) {
    if (sessions.size >= 100)
      throw Error("Demo capacity reached; try again later");
    sessions.set(id, newSession());
  }
  const s = sessions.get(id);
  s.touched = Date.now();
  if (method === "reset") {
    const next = newSession(args.scenario || "imbalance");
    sessions.set(id, next);
    return snapshot(next);
  }
  if (method === "snapshot") return snapshot(s);
  if (method === "replay")
    return {
      frames: s.frames,
      revision: s.revision,
      mode: "simulation replay",
    };
  if (method === "advance") {
    advance(s);
    return snapshot(s);
  }
  if (method === "diagnose") return diagnose(s, args.buildingId);
  if (method === "compare") return compare(s);
  if (method === "simulate") return rollout(s, candidateControls(s, args));
  if (method === "optimise") return optimise(s, args);
  if (method === "apply") {
    const proposal = s.candidates[args.candidateId];
    if (
      !proposal ||
      proposal.revision !== s.revision ||
      Date.now() > (proposal.expires || Infinity)
    )
      throw Error(
        "Recommendation expired; compare again against the current state",
      );
    const controls = candidateControls(s, proposal.controls),
      check = rollout(s, controls, 3, proposal.second);
    if (!check.verified)
      throw Error("Trajectory did not pass the simulation floor");
    if (
      proposal.optimised &&
      (check.maxResidual > 1e-6 || check.maxPressureKpa > 250)
    )
      throw Error("Independent numerical verification failed");
    advance(s, 6, controls);
    s.events.push({
      time: snapshot(s).time,
      title: "Operator applied simulated controls",
      detail: `Supply ${controls.supplyC.toFixed(1)}°C · pump ${controls.pumpHz.toFixed(1)} Hz · verified 3-hour model rollout`,
    });
    return snapshot(s);
  }
  throw Error("Unknown twin tool");
}
