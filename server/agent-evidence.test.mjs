import { test } from "node:test";
import assert from "node:assert/strict";
import { numericalEvidence, guardNarrative } from "./agent-evidence.mjs";
test("numeric evidence distinguishes trajectory minimum from end minimum", () => {
  const baseline = {
    id: "hold",
    label: "Hold",
    heatKwh: 1239,
    pumpKwh: 3.42,
    minimumC: 18.61648,
    endMinimumC: 18.71,
    verified: true,
  };
  const recommendation = {
    ...baseline,
    id: "balance",
    label: "Balance",
    heatKwh: 1260,
    endMinimumC: 18.80329,
  };
  const result = numericalEvidence([
    {
      tool: "compare_interventions",
      result: {
        revision: 1,
        baseline,
        recommendation,
        candidates: [baseline, recommendation],
      },
    },
  ]);
  assert.equal(result.rows[0].minimumC, 18.61648);
  assert.equal(result.rows[0].endMinimumC, 18.80329);
});
test("generated numerical claims are withheld; qualitative explanation and asset IDs allowed", () => {
  assert.equal(
    guardNarrative("The minimum temperature is 18.80°C.").narrativeWithheld,
    true,
  );
  assert.equal(
    guardNarrative("Inspect B10 and check the far branch valve.")
      .narrativeWithheld,
    false,
  );
});
