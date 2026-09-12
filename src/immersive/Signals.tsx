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
      <span>{fmt(shown, digits)}</span>
      {Math.abs(delta) >= 10 ** -digits / 2 && (
        <small
          key={value}
          className={`reading-delta ${delta > 0 ? "up" : "down"}`}
          title="Change since the previous displayed sample"
        >
          {delta > 0 ? "↑ +" : "↓ "}
          {fmt(delta, digits)}
        </small>
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
    <section className="event-signals" aria-label="Operational signals">
      <button
        className={`alarm-summary ${findings.length ? "has-alarms" : "clear"}`}
        onClick={onAlarms}
      >
        <b>{findings.length ? "△" : "✓"}</b>
        <span>
          {findings.length} active findings
          <small>
            {findings.length
              ? "Inspect affected assets"
              : "No active model findings"}
          </small>
        </span>
      </button>
      <div className="event-log" role="log" aria-live="polite">
        {events
          .slice(-2)
          .reverse()
          .map((e) => (
            <button
              key={e.id}
              className={`event-item ${e.kind}`}
              onClick={() => onSelect(e.asset)}
            >
              <span>
                {e.kind === "failure" ? "!" : e.kind === "command" ? "✓" : "•"}
              </span>
              <div>
                <strong>{e.title}</strong>
                <small>
                  {e.time} · {e.detail}
                </small>
              </div>
            </button>
          ))}
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
      aria-label="Connected equipment workbench"
    >
      <div className="eyebrow">{equipment} · CONNECTED MODEL CONTEXT</div>
      <h3>
        {equipment.startsWith("HX")
          ? "Heat transfer to the district"
          : "Circulation and distribution"}
      </h3>
      <p>
        {equipment.startsWith("HX")
          ? "Adjust the secondary supply setpoint and test heat delivery to every connected branch."
          : "Adjust the equivalent drive frequency and test flow redistribution, pressure and electrical demand."}
      </p>
      <div className="process-network">
        <button onClick={onOperate}>
          ST01 · {fmt(state.supplyC)}°C
          <small>
            {fmt(state.pumpHz)} Hz / {fmt(state.pressureKpa)} kPa
          </small>
        </button>
        <div>
          {state.zones.map((z) => (
            <button key={z.id} onClick={() => onSelect(z.id)}>
              <b>
                {z.id.toUpperCase()} · {fmt(z.valvePct, 0)}%
              </b>
              <small>
                {fmt(z.flowM3h)} m³/h · {fmt(z.delayMinutes, 0)} min
              </small>
            </button>
          ))}
        </div>
      </div>
      <div className="dock-actions">
        <button className="primary" onClick={onOperate}>
          Operate in 3D
        </button>
        <button onClick={onAgent}>Investigate with agent</button>
      </div>
      <h3>Useful checks</h3>
      <ul>
        <li>Compare branch response before raising station supply.</li>
        <li>Inspect transport delay before judging a temperature change.</li>
        <li>
          Check suspect sensor readings against the model before intervention.
        </li>
      </ul>
      <small>
        Shared model readings; this geometry has no separately instrumented pump
        or heat exchanger model.
      </small>
    </section>
  );
}
