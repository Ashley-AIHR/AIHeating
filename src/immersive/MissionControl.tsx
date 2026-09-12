import { fmt, type Twin } from "../operations/types";
import { toolNames, type Mission } from "./mission";
import type { Optimisation } from "./Workspace";

type Props = {
  mission: Mission | null;
  optimisation: Optimisation | null;
  current: Twin;
  busy: boolean;
  stale: boolean;
  canRunAgent: boolean;
  forecastSide: "intervention" | "baseline";
  previewing: boolean;
  animating: boolean;
  onRun: (agent: boolean) => void;
  onPreview: (side: "intervention" | "baseline") => void;
  onAnimate: () => void;
  onApply: () => void;
  cyclesRemaining: number;
  onAutonomous: () => void;
  onStop: () => void;
};
const delta = (n: number, digits = 1) => `${n > 0 ? "+" : ""}${fmt(n, digits)}`;
export default function MissionControl(p: Props) {
  const m = p.mission,
    o = p.optimisation;
  const outcome = m?.phase === "applied" && m.after && m.baseline;
  const steps = [
    "Observe",
    "Investigate",
    "Test",
    "Preview",
    "Apply",
    "Measure",
  ];
  const stage = !m
    ? 0
    : m.phase === "applied"
      ? 5
      : m.phase === "ready"
        ? 3
        : m.events.some((e) =>
              ["simulate_controls", "optimise_network"].includes(e.tool),
            )
          ? 2
          : 1;
  const result = o?.recommendation;
  return (
    <section className="mission-control" aria-label="Agent mission control">
      <div className="eyebrow">INTENT → PHYSICAL CONSEQUENCE</div>
      <h3>Make the city respond.</h3>
      <p>
        Investigate the selected asset, test a control strategy and watch its
        effect propagate through the district.
      </p>
      <ol className="mission-steps" aria-label="Control loop progress">
        {steps.map((s, i) => (
          <li
            key={s}
            className={i === stage ? "current" : i < stage ? "done" : ""}
            aria-current={i === stage ? "step" : undefined}
          >
            <b>{i < stage ? "✓" : i + 1}</b>
            {s}
          </li>
        ))}
      </ol>
      <div className="dock-actions">
        <button
          className="primary"
          disabled={p.busy || !p.canRunAgent}
          onClick={() => p.onRun(true)}
        >
          ✧ Run agent mission
        </button>
        <button disabled={p.busy} onClick={() => p.onRun(false)}>
          Explore with numerical solver
        </button>
      </div>
      {!p.canRunAgent && (
        <p className="muted">
          Set the server’s OpenRouter key to enable agent missions. An operator
          password is needed only if explicitly enabled. The numerical route
          runs the same physics without an LLM.
        </p>
      )}
      <div className="mission-autonomy">
        <strong>Closed-loop operation</strong>
        <p>
          Let the agent investigate, test, apply a verified simulator step and
          reassess the changed network. Three cycles, each using a fresh
          physical state.
        </p>
        {p.cyclesRemaining > 0 ? (
          <button className="full" onClick={p.onStop}>
            Stop further cycles · {p.cyclesRemaining} remaining
          </button>
        ) : (
          <button
            className="full"
            disabled={p.busy || !p.canRunAgent}
            onClick={p.onAutonomous}
          >
            Run 3 agent control cycles
          </button>
        )}
        <small>
          Up to 3 paid agent runs · automatic simulator application only
        </small>
      </div>
      {m && (
        <>
          <div className={`mission-status ${m.phase}`} aria-live="polite">
            <small>
              {m.origin === "llm"
                ? "LLM-DIRECTED MISSION"
                : "NUMERICAL EXPLORATION"}{" "}
              · {m.assetId}
            </small>
            <strong>{m.message}</strong>
          </div>
          <div
            className="mission-events"
            aria-label="Executed mission activity"
          >
            {m.events.slice(-6).map((e, i) => (
              <div key={i} data-status={e.status}>
                <span>
                  {e.status === "completed"
                    ? "✓"
                    : e.status === "failed"
                      ? "!"
                      : "◌"}
                </span>
                {toolNames[e.tool] || e.tool}
              </div>
            ))}
          </div>
        </>
      )}
      {m && result && !outcome && (
        <>
          <h3>Two futures. One starting state.</h3>
          <p className="muted">Solver objective: {o.objective}.</p>
          <p className="muted">
            The same weather and initial state drive both three-hour rollouts.
            Values below are computed predictions.
          </p>
          <div className="mission-comparison">
            <span>3-hour outcome</span>
            <b>Unchanged</b>
            <b>Intervention</b>
            <span>Heat / kWh</span>
            <b>{fmt(o.baseline.heatKwh, 0)}</b>
            <b>{fmt(result.heatKwh, 0)}</b>
            <span>Pump / kWh</span>
            <b>{fmt(o.baseline.pumpKwh, 1)}</b>
            <b>{fmt(result.pumpKwh, 1)}</b>
            <span>End minimum / °C</span>
            <b>{fmt(o.baseline.endMinimumC, 2)}</b>
            <b>{fmt(result.endMinimumC, 2)}</b>
          </div>
          <h3>What physically changes</h3>
          <div className="mission-actuators">
            <div>
              <span>Supply setpoint</span>
              <b>
                {fmt(m.before.supplyC)} → {fmt(result.controls.supplyC)} °C
              </b>
            </div>
            <div>
              <span>Pump drive</span>
              <b>
                {fmt(m.before.pumpHz)} → {fmt(result.controls.pumpHz)} Hz
              </b>
            </div>
            {m.before.zones.map((z, i) => (
              <div key={z.id}>
                <span>{z.id} valve</span>
                <b>
                  {fmt(z.valvePct, 0)} → {fmt(result.controls.valvesPct[i], 0)}%
                </b>
              </div>
            ))}
          </div>
          <div
            className="segmented mission-futures"
            aria-label="Compare scene futures"
          >
            <button
              disabled={p.busy || p.stale}
              aria-pressed={p.previewing && p.forecastSide === "baseline"}
              onClick={() => p.onPreview("baseline")}
            >
              Continue unchanged
            </button>
            <button
              disabled={p.busy || p.stale}
              aria-pressed={p.previewing && p.forecastSide === "intervention"}
              onClick={() => p.onPreview("intervention")}
            >
              With intervention
            </button>
          </div>
          <div className="dock-actions">
            <button disabled={p.busy || p.stale} onClick={p.onAnimate}>
              {p.animating
                ? "Pause prediction"
                : "▶ Play physical consequences"}
            </button>
            <button
              className="primary"
              disabled={p.busy || p.stale}
              onClick={p.onApply}
            >
              Apply first 30 min to simulation
            </button>
          </div>
          {p.stale && (
            <p className="warning">
              State changed. Run a fresh mission before applying this plan.
            </p>
          )}
        </>
      )}
      {outcome && m?.after && m.baseline && (
        <div
          className="mission-outcome"
          aria-label="Measured simulation outcome"
        >
          <div className="eyebrow">CONTROL APPLIED · +30 SIMULATED MINUTES</div>
          <h3>The network has changed.</h3>
          <p>
            Computed response against continuing unchanged over the same period.
          </p>
          <div className="mission-actuators">
            <div>
              <span>Network flow</span>
              <b>{delta(m.after.flowM3h - m.baseline.flowM3h)} m³/h</b>
            </div>
            <div>
              <span>Pump demand</span>
              <b>{delta(m.after.pumpKw - m.baseline.pumpKw)} kW</b>
            </div>
            <div>
              <span>Delivered heat</span>
              <b>{delta(m.after.heatKw - m.baseline.heatKw)} kW</b>
            </div>
          </div>
          <h3>Building response / Δ°C vs unchanged</h3>
          <div className="mission-building-deltas">
            {m.after.buildings.map((b) => (
              <div key={b.id}>
                <span>{b.id}</span>
                <b>
                  {delta(
                    b.modelC -
                      (m.baseline!.buildings.find((v) => v.id === b.id)
                        ?.modelC ?? b.modelC),
                    2,
                  )}
                </b>
              </div>
            ))}
          </div>
          {m.predicted && (
            <p className="muted">
              Largest indoor model prediction residual:{" "}
              {fmt(
                Math.max(
                  ...m.after.buildings.map((b) =>
                    Math.abs(
                      b.modelC -
                        (m.predicted!.buildings.find((v) => v.id === b.id)
                          ?.modelC ?? b.modelC),
                    ),
                  ),
                ),
                4,
              )}{" "}
              °C. This checks model execution, not field accuracy.
            </p>
          )}
          {p.current.revision !== m.after.revision && (
            <p className="muted">
              Recorded outcome at revision {m.after.revision}; the current
              simulation has since advanced.
            </p>
          )}
        </div>
      )}
      <div className="mission-destinations">
        <span className="connected">● Simulator · controls enabled</span>
        <span>○ Real equipment · not connected</span>
      </div>
    </section>
  );
}
