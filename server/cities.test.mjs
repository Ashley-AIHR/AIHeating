import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newSession, snapshot, dispatch, optimise } from "./twin-node.mjs";
import { worldContext } from "./world.mjs";
import { investigate } from "./immersive-agent.mjs";

test("Beijing has distinct simulated winter physics, retained control context and isolated resets", () => {
  const id = randomUUID(),
    b = dispatch(id, "reset", { cityId: "beijing" });
  assert.equal(b.cityId, "beijing");
  assert.equal(b.outdoorC, -4);
  assert.equal(b.supplyC, 49);
  const y = snapshot(newSession()),
    s = snapshot(newSession("imbalance", "shanghai"));
  assert(b.loadKw > s.loadKw && b.loadKw < y.loadKw);
  assert.equal(worldContext(b, "B10").site.id, "beijing-reference");
  const preview = dispatch(id, "control_preview", {
    revision: b.revision,
    assetId: "far",
    control: "valvePct",
    value: 45,
  });
  assert(preview.verified);
  assert.equal(preview.firstStep.cityId, "beijing");
  assert.equal(
    dispatch(id, "apply", { candidateId: preview.candidateId }).cityId,
    "beijing",
  );
  const cold = dispatch(id, "reset", { scenario: "cold" });
  assert.equal(cold.cityId, "beijing");
  assert.equal(cold.outdoorC, -11);
  const p = optimise(newSession("warming", "beijing"));
  assert(p.bestAttempt.trace.every((f) => f.state.cityId === "beijing"));
  const stale = dispatch(id, "control_preview", {
    revision: cold.revision,
    assetId: "far",
    control: "valvePct",
    value: cold.zones.find((z) => z.id === "far").valvePct,
  });
  dispatch(id, "reset", { cityId: "shanghai" });
  assert.throws(
    () => dispatch(id, "apply", { candidateId: stale.candidateId }),
    /expired|unknown/i,
  );
});

test("Beijing agent receives Beijing physical and fictional-site context", async () => {
  const id = randomUUID(),
    s = dispatch(id, "reset", { cityId: "beijing" });
  const result = await investigate({
    session: id,
    args: {
      revision: s.revision,
      role: "diagnostic",
      assetId: "B10",
      question: "Investigate this branch",
    },
    model: "fixture",
    rpc: async (session, method, args) => dispatch(session, method, args),
    complete: async ({ messages }) => {
      const context = JSON.parse(messages[1].content).context;
      assert.equal(context.site.id, "beijing-reference");
      assert.equal(context.state.outdoorC, -4);
      assert.match(context.site.scope, /synthetic/);
      assert.equal(context.site.city.name, "Beijing");
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content:
                "Beijing synthetic winter case: inspect the far branch before changing the heat source.",
            },
          },
        ],
      };
    },
  });
  assert.equal(result.context.siteId, "beijing-reference");
  assert.equal(dispatch(id, "snapshot").revision, s.revision);
});

test("Shanghai agent receives the selected city's physical context at the provider boundary", async () => {
  const id = randomUUID(),
    s = dispatch(id, "reset", { cityId: "shanghai" });
  const result = await investigate({
    session: id,
    args: {
      revision: s.revision,
      role: "diagnostic",
      assetId: "B10",
      question: "Investigate the cold branch",
    },
    model: "mock-provider",
    rpc: async (session, method, args) => dispatch(session, method, args),
    complete: async ({ messages }) => {
      const context = JSON.parse(messages[1].content).context;
      assert.equal(context.site.id, "shanghai-reference");
      assert.equal(context.state.outdoorC, 5);
      assert.equal(context.state.supplyC, 44);
      assert.match(context.assumptions.join(" "), /COP/);
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content:
                "Check the far branch against the model evidence before changing the source.",
            },
          },
        ],
      };
    },
  });
  assert.equal(result.context.siteId, "shanghai-reference");
  assert.equal(dispatch(id, "snapshot").revision, s.revision);
});

test("Shanghai changes weather, source controls and actual physical outputs", () => {
  const y = snapshot(newSession());
  const s = snapshot(newSession("imbalance", "shanghai"));
  assert.equal(y.cityId, "yinchuan");
  assert.equal(y.outdoorC, -8);
  assert.equal(s.outdoorC, 5);
  assert.equal(s.supplyC, 44);
  assert.equal(s.pumpHz, 40);
  assert(s.loadKw < y.loadKw);
  assert.notEqual(s.heatKw, y.heatKw);
  assert.match(s.assumptions.join(" "), /COP.*not modelled/);
  const context = worldContext(s, "B10");
  assert.equal(context.site.id, "shanghai-reference");
  assert.equal(context.site.city.name, "Shanghai");
  assert.match(context.geometryRevision, /shanghai/);
});

test("city reset invalidates plans and stale revisions, retains city on scenario reset", () => {
  const id = randomUUID(),
    initial = dispatch(id, "snapshot");
  const preview = dispatch(id, "control_preview", {
    revision: initial.revision,
    assetId: "far",
    control: "valvePct",
    value: 45,
  });
  const shanghai = dispatch(id, "reset", { cityId: "shanghai" });
  assert(shanghai.revision > initial.revision);
  assert.throws(
    () => dispatch(id, "apply", { candidateId: preview.candidateId }),
    /expired|unknown/i,
  );
  assert.throws(
    () =>
      dispatch(id, "control_preview", {
        revision: initial.revision,
        assetId: "far",
        control: "valvePct",
        value: 45,
      }),
    /revision|stale|State changed/i,
  );
  const cold = dispatch(id, "reset", { scenario: "cold" });
  assert.equal(cold.cityId, "shanghai");
  assert.equal(cold.outdoorC, 0);
  assert(dispatch(id, "replay").frames.every((f) => f.cityId === "shanghai"));
  assert.equal(dispatch(randomUUID(), "snapshot").cityId, "yinchuan");
  assert.throws(
    () => dispatch(id, "reset", { cityId: "unknown" }),
    /Unknown city/,
  );
  assert.deepEqual(dispatch(id, "snapshot"), cold);
});

test("Shanghai manual actuation and optimisation retain city in every predicted state", () => {
  const id = randomUUID(),
    s = dispatch(id, "reset", { cityId: "shanghai" });
  const preview = dispatch(id, "control_preview", {
    revision: s.revision,
    assetId: "far",
    control: "valvePct",
    value: 45,
  });
  assert(preview.verified);
  assert.equal(preview.firstStep.cityId, "shanghai");
  const applied = dispatch(id, "apply", { candidateId: preview.candidateId });
  assert.equal(applied.cityId, "shanghai");
  assert.equal(applied.zones.find((z) => z.id === "far").valvePct, 45);
  const plan = optimise(newSession("warming", "shanghai"));
  assert(plan.bestAttempt.trace.length > 0);
  assert(plan.bestAttempt.trace.every((f) => f.state.cityId === "shanghai"));
});
