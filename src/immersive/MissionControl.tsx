import { tx } from "../localisation";
import { fmt, type Twin } from "../operations/types";
import { useEffect, useRef } from "react";
import { toolNames, type Mission } from "./mission";
import type { Optimisation } from "./Workspace";
import { GoalOutcome } from "./GoalWorkbench";

type Props = {
  preciseGoal?: boolean;
  inspectionOnly?: boolean;
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
  const liveStatus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (p.mission?.phase === "investigating")
      liveStatus.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
  }, [p.mission?.phase]);
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
      : ["ready", "engineering"].includes(m.phase)
        ? 3
        : m.events.some((e) =>
              ["simulate_controls", "optimise_network"].includes(e.tool),
            )
          ? 2
          : 1;
  const result = o?.recommendation;
  return (
    <section
      className="mission-control"
      aria-label={tx("Agent mission control")}
    >
      <div className="eyebrow">{tx("INTENT → PHYSICAL CONSEQUENCE")}</div>
      <h3>{tx("Make the city respond.")}</h3>
      <p>
        {tx(
          "Investigate the selected asset, test a control strategy and watch its effect propagate through the district.",
        )}
      </p>
      <ol className="mission-steps" aria-label={tx("Control loop progress")}>
        {tx(
          steps.map((s, i) => (
            <li
              key={s}
              className={i === stage ? "current" : i < stage ? "done" : ""}
              aria-current={i === stage ? "step" : undefined}
            >
              <b>{tx(i < stage ? "✓" : i + 1)}</b>
              {tx(s)}
            </li>
          )),
        )}
      </ol>
      <div className="dock-actions">
        <button
          className="primary"
          disabled={p.busy || !p.canRunAgent}
          onClick={() => p.onRun(true)}
        >
          {tx("✧ Run agent mission")}
        </button>
        <button
          disabled={p.busy || p.inspectionOnly}
          onClick={() => p.onRun(false)}
        >
          {tx("Explore with numerical solver")}
        </button>
      </div>
      {tx(
        !p.canRunAgent && (
          <p className="muted">
            {tx(
              "Set the server’s OpenRouter key to enable agent missions. An operator password is needed only if explicitly enabled. The numerical route runs the same physics without an LLM.",
            )}
          </p>
        ),
      )}
      <div className="mission-autonomy">
        <strong>{tx("Closed-loop operation")}</strong>
        <p>
          {tx(
            "Let the agent investigate, test, apply a verified simulator step and reassess the changed network. Three cycles, each using a fresh physical state.",
          )}
        </p>
        {tx(
          p.cyclesRemaining > 0 ? (
            <button className="full" onClick={p.onStop}>
              {tx("Stop further cycles · ")}
              {tx(p.cyclesRemaining)}
              {tx(" remaining")}
            </button>
          ) : (
            <button
              className="full"
              disabled={
                p.busy || !p.canRunAgent || p.preciseGoal || p.inspectionOnly
              }
              onClick={p.onAutonomous}
            >
              {tx("Run 3 agent control cycles")}
            </button>
          ),
        )}
        <small>
          {tx("Up to 3 paid agent runs · automatic simulator application only")}
        </small>
        {p.preciseGoal && (
          <small>
            {tx(
              "Precise goals require review after each applied step so the deadline and savings baseline are not silently reset.",
            )}
          </small>
        )}
      </div>
      {o?.goalResult && <GoalOutcome result={o.goalResult} />}
      {o?.goalResult && !o.recommendation && (
        <div className="dock-actions">
          <button
            disabled={p.busy || p.stale}
            onClick={() => p.onPreview("intervention")}
          >
            {tx("Preview best tested trajectory · not applicable")}
          </button>
          <button
            disabled={p.busy || p.stale}
            onClick={() => p.onPreview("baseline")}
          >
            {tx("Continue unchanged")}
          </button>
        </div>
      )}
      {tx(
        m && (
          <>
            {tx(
              m.phase === "investigating" && (
                <button className="full" onClick={p.onStop}>
                  {tx("Stop investigation")}
                </button>
              ),
            )}
            <div
              ref={liveStatus}
              className={`mission-status ${m.phase}`}
              aria-live="polite"
            >
              <small>
                {tx(
                  m.origin === "llm"
                    ? "LLM-DIRECTED MISSION"
                    : "NUMERICAL EXPLORATION",
                )}
                {tx(" ")}· {tx(m.assetId)}
              </small>
              <strong>{tx(m.message)}</strong>
            </div>
            <div
              className="mission-events"
              aria-label={tx("Executed mission activity")}
            >
              {tx(
                m.events.map((e, i) => (
                  <div key={i} data-status={e.status}>
                    <span>
                      {tx(
                        e.status === "completed"
                          ? "✓"
                          : e.status === "failed"
                            ? "!"
                            : "◌",
                      )}
                    </span>
                    <section>
                      <small>
                        {tx(e.at.slice(11, 19))} · {tx(e.status)}
                      </small>
                      <strong>{tx(toolNames[e.tool] || e.tool)}</strong>
                      {tx(e.message && <p>{tx(e.message)}</p>)}
                      {tx(
                        !!(e.arguments || e.result) && (
                          <details>
                            <summary>
                              {tx(
                                e.arguments
                                  ? "Tool inputs"
                                  : "Tool result · model evidence",
                              )}
                            </summary>
                            <pre>
                              {tx(
                                JSON.stringify(
                                  e.arguments || e.result,
                                  null,
                                  2,
                                ),
                              )}
                            </pre>
                          </details>
                        ),
                      )}
                    </section>
                  </div>
                )),
              )}
            </div>
            <div
              className="agent-live-output"
              aria-label={tx("Live agent explanation")}
              lang={m.locale === "zh-CN" ? "zh-CN" : "en-GB"}
            >
              <small>
                {tx(
                  m.phase === "investigating"
                    ? "LIVE DRAFT · UNVERIFIED MODEL TEXT"
                    : "AGENT EXPLANATION",
                )}
              </small>
              <p>
                {m.draft ||
                  tx(
                    m.phase === "investigating"
                      ? "Connected. Waiting for public assistant output; executed tools appear above."
                      : "Review the retained tool activity above.",
                  )}
              </p>
              <small>
                {tx(
                  "Only public response text is shown, not private reasoning. Numerical tool results are authoritative; draft text never applies controls.",
                )}
              </small>
            </div>
          </>
        ),
      )}
      {tx(
        m && result && !outcome && (
          <>
            <h3>{tx("Two futures. One starting state.")}</h3>
            <p className="muted">
              {tx("Solver objective: ")}
              {tx(o.objective)}.
            </p>
            <p className="muted">
              {tx(
                "The same weather and initial state drive both three-hour rollouts. Values below are computed predictions.",
              )}
            </p>
            <div className="mission-comparison">
              <span>{tx("3-hour outcome")}</span>
              <b>{tx("Unchanged")}</b>
              <b>{tx("Intervention")}</b>
              <span>{tx("Heat / kWh")}</span>
              <b>{tx(fmt(o.baseline.heatKwh, 0))}</b>
              <b>{tx(fmt(result.heatKwh, 0))}</b>
              <span>{tx("Pump / kWh")}</span>
              <b>{tx(fmt(o.baseline.pumpKwh, 1))}</b>
              <b>{tx(fmt(result.pumpKwh, 1))}</b>
              <span>{tx("End minimum / °C")}</span>
              <b>{tx(fmt(o.baseline.endMinimumC, 2))}</b>
              <b>{tx(fmt(result.endMinimumC, 2))}</b>
            </div>
            <h3>{tx("What physically changes")}</h3>
            <div className="mission-actuators">
              <div>
                <span>{tx("Supply setpoint")}</span>
                <b>
                  {tx(fmt(m.before.supplyC))} →{" "}
                  {tx(fmt(result.controls.supplyC))}
                  {tx(" °C")}
                </b>
              </div>
              <div>
                <span>{tx("Pump drive")}</span>
                <b>
                  {tx(fmt(m.before.pumpHz))} → {tx(fmt(result.controls.pumpHz))}
                  {tx(" Hz")}
                </b>
              </div>
              {tx(
                m.before.zones.map((z, i) => (
                  <div key={z.id}>
                    <span>
                      {tx(z.id)}
                      {tx(" valve")}
                    </span>
                    <b>
                      {tx(fmt(z.valvePct, 0))} →{" "}
                      {tx(fmt(result.controls.valvesPct[i], 0))}%
                    </b>
                  </div>
                )),
              )}
            </div>
            <div
              className="segmented mission-futures"
              aria-label={tx("Compare scene futures")}
            >
              <button
                disabled={p.busy || p.stale}
                aria-pressed={p.previewing && p.forecastSide === "baseline"}
                onClick={() => p.onPreview("baseline")}
              >
                {tx("Continue unchanged")}
              </button>
              <button
                disabled={p.busy || p.stale}
                aria-pressed={p.previewing && p.forecastSide === "intervention"}
                onClick={() => p.onPreview("intervention")}
              >
                {tx("With intervention")}
              </button>
            </div>
            <div className="dock-actions">
              <button disabled={p.busy || p.stale} onClick={p.onAnimate}>
                {tx(
                  p.animating
                    ? "Pause prediction"
                    : "▶ Play physical consequences",
                )}
              </button>
              <button
                className="primary"
                disabled={p.busy || p.stale}
                onClick={p.onApply}
              >
                {tx("Apply first 30 min to simulation")}
              </button>
            </div>
            {tx(
              p.stale && (
                <p className="warning">
                  {tx(
                    "State changed. Run a fresh mission before applying this plan.",
                  )}
                </p>
              ),
            )}
          </>
        ),
      )}
      {tx(
        outcome && m?.after && m.baseline && (
          <div
            className="mission-outcome"
            aria-label={tx("Measured simulation outcome")}
          >
            <div className="eyebrow">
              {tx("CONTROL APPLIED · +30 SIMULATED MINUTES")}
            </div>
            <h3>{tx("The network has changed.")}</h3>
            <p>
              {tx(
                "Computed response against continuing unchanged over the same period.",
              )}
            </p>
            <div className="mission-actuators">
              <div>
                <span>{tx("Network flow")}</span>
                <b>
                  {tx(delta(m.after.flowM3h - m.baseline.flowM3h))}
                  {tx(" m³/h")}
                </b>
              </div>
              <div>
                <span>{tx("Pump demand")}</span>
                <b>
                  {tx(delta(m.after.pumpKw - m.baseline.pumpKw))}
                  {tx(" kW")}
                </b>
              </div>
              <div>
                <span>{tx("Delivered heat")}</span>
                <b>
                  {tx(delta(m.after.heatKw - m.baseline.heatKw))}
                  {tx(" kW")}
                </b>
              </div>
            </div>
            <h3>{tx("Building response / Δ°C vs unchanged")}</h3>
            <div className="mission-building-deltas">
              {tx(
                m.after.buildings.map((b) => (
                  <div key={b.id}>
                    <span>{tx(b.id)}</span>
                    <b>
                      {tx(
                        delta(
                          b.modelC -
                            (m.baseline!.buildings.find((v) => v.id === b.id)
                              ?.modelC ?? b.modelC),
                          2,
                        ),
                      )}
                    </b>
                  </div>
                )),
              )}
            </div>
            {tx(
              m.predicted && (
                <p className="muted">
                  {tx("Largest indoor model prediction residual:")}
                  {tx(" ")}
                  {tx(
                    fmt(
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
                    ),
                  )}
                  {tx(" ")}
                  {tx("°C. This checks model execution, not field accuracy.")}
                </p>
              ),
            )}
            {tx(
              p.current.revision !== m.after.revision && (
                <p className="muted">
                  {tx("Recorded outcome at revision ")}
                  {tx(m.after.revision)}
                  {tx("; the current simulation has since advanced.")}
                </p>
              ),
            )}
          </div>
        ),
      )}
      <div className="mission-destinations">
        <span className="connected">
          {tx("● Simulator · controls enabled")}
        </span>
        <span>{tx("○ Real equipment · not connected")}</span>
      </div>
    </section>
  );
}
