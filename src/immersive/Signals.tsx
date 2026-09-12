import { tx } from "../localisation";
import { useEffect, useRef, useState } from "react";
import { fmt, type Diagnosis, type Twin } from "../operations/types";
import type { OperationEvent } from "./DirectControl";
export function AnimatedValue({
  value,
  digits = 1,
}: {
  value: number;
  digits?: number;
}) {
  const [shown, setShown] = useState(value),
    [delta, setDelta] = useState(0);
  const previous = useRef(value);
  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    setDelta(value - from);
    if (from === value) return;
    let frame = 0;
    const start = performance.now();
    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / 900);
      setShown(from + (value - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className="animated-reading">
      <span>{tx(fmt(shown, digits))}</span>
      {tx(
        Math.abs(delta) >= 10 ** -digits / 2 && (
          <small
            key={value}
            className={`reading-delta ${delta > 0 ? "up" : "down"}`}
            title={tx("Change since the previous displayed sample")}
          >
            {tx(delta > 0 ? "↑ +" : "↓ ")}
            {tx(fmt(delta, digits))}
          </small>
        ),
      )}
    </span>
  );
}
export function EventSignals({
  events,
  diagnosis,
  onSelect,
  onAlarms,
}: {
  events: OperationEvent[];
  diagnosis: Diagnosis | null;
  onSelect: (asset: string) => void;
  onAlarms: () => void;
}) {
  const findings = diagnosis?.findings || [];
  return (
    <section className="event-signals" aria-label={tx("Operational signals")}>
      <button
        className={`alarm-summary ${findings.length ? "has-alarms" : "clear"}`}
        onClick={onAlarms}
      >
        <b>{tx(findings.length ? "△" : "✓")}</b>
        <span>
          {tx(findings.length)}
          {tx(" active findings")}
          <small>
            {tx(
              findings.length
                ? "Inspect affected assets"
                : "No active model findings",
            )}
          </small>
        </span>
      </button>
      <div className="event-log" role="log" aria-live="polite">
        {tx(
          events
            .slice(-2)
            .reverse()
            .map((e) => (
              <button
                key={e.id}
                className={`event-item ${e.kind}`}
                onClick={() => onSelect(e.asset)}
              >
                <span>
                  {tx(
                    e.kind === "failure"
                      ? "!"
                      : e.kind === "command"
                        ? "✓"
                        : "•",
                  )}
                </span>
                <div>
                  <strong>{tx(e.title)}</strong>
                  <small>
                    {tx(e.time)} · {tx(e.detail)}
                  </small>
                </div>
              </button>
            )),
        )}
      </div>
    </section>
  );
}
export function EquipmentWorkbench({
  state,
  equipment,
  onSelect,
  onOperate,
  onAgent,
}: {
  state: Twin;
  equipment: string;
  onSelect: (id: string) => void;
  onOperate: () => void;
  onAgent: () => void;
}) {
  return (
    <section
      className="equipment-workbench"
      aria-label={tx("Connected equipment workbench")}
    >
      <div className="eyebrow">
        {tx(equipment)}
        {tx(" · CONNECTED MODEL CONTEXT")}
      </div>
      <h3>
        {tx(
          equipment.startsWith("HX")
            ? "Heat transfer to the district"
            : "Circulation and distribution",
        )}
      </h3>
      <p>
        {tx(
          equipment.startsWith("HX")
            ? "Adjust the secondary supply setpoint and test heat delivery to every connected branch."
            : "Adjust the equivalent drive frequency and test flow redistribution, pressure and electrical demand.",
        )}
      </p>
      <div className="process-network">
        <button onClick={onOperate}>
          {tx("ST01 · ")}
          {tx(fmt(state.supplyC))}
          {tx("°C")}
          <small>
            {tx(fmt(state.pumpHz))}
            {tx(" Hz / ")}
            {tx(fmt(state.pressureKpa))}
            {tx(" kPa")}
          </small>
        </button>
        <div>
          {tx(
            state.zones.map((z) => (
              <button key={z.id} onClick={() => onSelect(z.id)}>
                <b>
                  {tx(z.id.toUpperCase())} · {tx(fmt(z.valvePct, 0))}%
                </b>
                <small>
                  {tx(fmt(z.flowM3h))}
                  {tx(" m³/h · ")}
                  {tx(fmt(z.delayMinutes, 0))}
                  {tx(" min")}
                </small>
              </button>
            )),
          )}
        </div>
      </div>
      <div className="dock-actions">
        <button className="primary" onClick={onOperate}>
          {tx("Operate in 3D")}
        </button>
        <button onClick={onAgent}>{tx("Investigate with agent")}</button>
      </div>
      <h3>{tx("Useful checks")}</h3>
      <ul>
        <li>{tx("Compare branch response before raising station supply.")}</li>
        <li>
          {tx("Inspect transport delay before judging a temperature change.")}
        </li>
        <li>
          {tx(
            "Check suspect sensor readings against the model before intervention.",
          )}
        </li>
      </ul>
      <small>
        {tx(
          "Shared model readings; this geometry has no separately instrumented pump or heat exchanger model.",
        )}
      </small>
    </section>
  );
}
