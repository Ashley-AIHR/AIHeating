import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dispatch } from "../server/twin-node.mjs";
const id = randomUUID(),
  initial = dispatch(id, "reset", { cityId: "beijing", scenario: "imbalance" });
const goal = {
  metric: "temperature",
  scope: "asset",
  assetId: "B10",
  target: 21,
  deadlineMinutes: 120,
  minC: 18,
  maxC: 23,
  allowShared: true,
};
const study = dispatch(id, "engineering_study", {
  goal,
  revision: initial.revision,
  contextId: initial.contextId,
});
const summary = (s) => ({
  minutes: s.elapsedMinutes - initial.elapsedMinutes,
  buildingC: s.buildings.find((b) => b.id === "B10").modelC,
  minimumC: Math.min(...s.buildings.map((b) => b.modelC)),
  maximumC: Math.max(...s.buildings.map((b) => b.modelC)),
  auxiliaryKwh: s.engineering?.auxiliaryKwh || 0,
  supplyC: s.supplyC,
  pumpHz: s.pumpHz,
  valvesPct: s.zones.map((z) => z.valvePct),
  energyResidual: s.energyResidual,
});
const executions = {};
for (const optionId of ["emitters-3", "auxiliary-60"]) {
  const actual = [summary(initial)];
  const start = dispatch(id, "snapshot");
  const refreshed = dispatch(id, "engineering_study", {
    goal,
    revision: start.revision,
    contextId: start.contextId,
  });
  let s = dispatch(id, "engineering_open", {
    studyId: refreshed.studyId,
    optionId,
  });
  actual.push(summary(s));
  for (let i = 0; i < 3; i++) {
    const r = dispatch(id, "engineering_step", { revision: s.revision });
    if (!r.applied) throw Error("Goal execution failed");
    s = r.state;
    actual.push(summary(s));
  }
  executions[optionId] = actual;
  dispatch(id, "engineering_restore", { revision: s.revision });
}
const data = {
  model: "P1A-node-engineering-v2",
  city: "beijing",
  simulationStart: initial.time,
  goal,
  initial: summary(initial),
  storedHeatIncreaseKwh: study.storedHeatIncreaseKwh,
  preferredId: study.preferredId,
  alternatives: study.rows.map(({ optimisation, ...row }) => ({
    ...row,
    schedule: optimisation.bestAttempt.schedule,
    evaluations: optimisation.evaluations,
    verification: optimisation.verification,
  })),
  executions,
  caveats: [
    study.authority,
    study.sizing,
    "All energy results are model outputs. Heat and electricity are separate carriers; this comfort-recovery test is not an economic or carbon comparison.",
  ],
};
writeFileSync(
  new URL("../docs/beijing-engineering-results.json", import.meta.url),
  JSON.stringify(data, null, 2) + "\n",
);
console.log("Exported reproducible Beijing engineering results");
