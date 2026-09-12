import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  newSession,
  snapshot,
  advance,
  compare,
  optimise,
  dispatch,
} from "./twin-node.mjs";
const oracle = JSON.parse(
  readFileSync(new URL("./node-physics-oracle.json", import.meta.url)),
);
function close(a, b, label) {
  assert(Number.isFinite(a) && Number.isFinite(b));
  assert(
    Math.abs(a - b) < 1e-7 * Math.max(Math.abs(b), 1),
    `${label}: ${a} != ${b}`,
  );
}
function physical(a, b) {
  for (const k of [
    "elapsedMinutes",
    "supplyC",
    "returnC",
    "pumpHz",
    "pressureKpa",
    "flowM3h",
    "pumpKw",
    "loadKw",
    "heatKw",
    "sourceHeatKw",
    "pipeStorageKw",
    "heatKwh",
    "pumpKwh",
  ])
    close(a[k], b[k], k);
  for (let i = 0; i < 12; i++)
    for (const k of [
      "indoorC",
      "modelC",
      "heatKw",
      "flowM3h",
      "returnC",
      "envelopeKw",
      "windowKw",
      "solarKw",
      "storageKw",
    ])
      close(a.buildings[i][k], b.buildings[i][k], `B${i + 1}.${k}`);
  for (let i = 0; i < 3; i++)
    for (const k of [
      "flowM3h",
      "valvePct",
      "delayMinutes",
      "supplyC",
      "returnC",
    ])
      close(a.zones[i][k], b.zones[i][k], `${i}.${k}`);
  assert(a.energyResidual < 1e-7);
  assert(a.solverResidual < 1e-8);
}
for (const [scenario, golden] of Object.entries(oracle))
  test(`Node physics matches Python oracle: ${scenario}, all five 3-hour interventions`, () => {
    const s = newSession(scenario);
    physical(snapshot(s), golden.initial);
    const actual = compare(s);
    for (let i = 0; i < 5; i++) {
      const a = actual.candidates[i],
        b = golden.comparison.candidates[i];
      assert.equal(a.verified, b.verified);
      for (const k of [
        "heatKwh",
        "pumpKwh",
        "minimumC",
        "endMinimumC",
        "overheatingPct",
        "comfortPenalty",
      ])
        close(a[k], b[k], k);
      for (let j = 0; j < 6; j++) physical(a.trace[j].state, b.trace[j].state);
    }
    advance(s);
    physical(snapshot(s), golden.advanced);
  });
test("Node optimiser preserves fresh verification, ramps, session revision and one-use approval", () => {
  const session = "node-approval-test",
    before = dispatch(session, "snapshot");
  const plan = dispatch(session, "optimise", { objective: "balanced" });
  assert(plan.verification.passed);
  assert(plan.evaluations <= 62);
  assert(plan.recommendation.candidateId);
  assert.equal(dispatch(session, "snapshot").revision, before.revision);
  const after = dispatch(session, "apply", {
    candidateId: plan.recommendation.candidateId,
  });
  assert.equal(after.revision, before.revision + 1);
  assert.throws(
    () =>
      dispatch(session, "apply", {
        candidateId: plan.recommendation.candidateId,
      }),
    /expired/,
  );
  assert.throws(
    () => dispatch(session, "simulate", { supplyC: 60 }),
    /change exceeds/,
  );
});
test("Invalid controls roll back atomically; cold case never fabricates a feasible plan", () => {
  const s = newSession(),
    before = JSON.stringify(s);
  assert.throws(() =>
    advance(s, 6, { supplyC: NaN, pumpHz: 45, valvesPct: [60, 60, 60] }),
  );
  assert.equal(JSON.stringify(s), before);
  const result = optimise(newSession("cold"));
  assert.equal(Boolean(result.recommendation), result.verification.passed);
  if (result.recommendation) assert(result.verification.minimumC >= 18);
});
