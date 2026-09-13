import { tx } from "../localisation";
export type OperatingGoal = {
  metric:
    | "temperature"
    | "heatReduction"
    | "pumpReduction"
    | "temperatureSpread";
  scope: "asset" | "branch" | "district";
  assetId: string;
  target: number;
  deadlineMinutes: number;
  minC: number;
  maxC: number;
  allowShared: boolean;
};
export type GoalResult = {
  target: number;
  achieved: number;
  unit: string;
  deadlineMinutes: number;
  targetMet: boolean;
  guardrailsMet: boolean;
  passed: boolean;
  violatingAssets: string[];
  targetBuildings: Record<string, number>;
  message: string;
  assetId: string;
  scope: string;
  metric: string;
};
export const missionKinds = [
  ["comfort", "Comfort recovery"],
  ["energy", "Heat budget"],
  ["balance", "Hydraulic balancing"],
  ["pump", "Pump efficiency"],
  ["sensor", "Sensor investigation"],
  ["engineering", "Engineering review"],
] as const;
export default function GoalWorkbench(p: {
  task: string;
  goal: OperatingGoal | null;
  busy: boolean;
  onPreset: (task: string) => void;
  onChange: (goal: OperatingGoal | null) => void;
  selected: string;
  engineered?: boolean;
}) {
  const g = p.goal;
  return (
    <section
      className="goal-workbench"
      aria-label={tx("Specialist mission and precise goal")}
    >
      <div className="eyebrow">{tx("SPECIALIST MISSIONS")}</div>
      <div className="specialist-grid">
        {missionKinds.map(([id, label]) => (
          <button
            key={id}
            disabled={p.busy}
            aria-pressed={p.task === id}
            onClick={() => p.onPreset(id)}
          >
            {tx(label)}
          </button>
        ))}
      </div>
      {!g ? (
        <p className="muted">
          {tx(
            ["sensor", "engineering"].includes(p.task)
              ? "Inspection missions gather evidence without preparing an automatic control plan. Select a control mission to set a measurable goal."
              : "Select a specialist mission to define a precise target, or run the existing weighted optimiser below.",
          )}
        </p>
      ) : (
        <>
          <strong>
            {tx("Binding operating goal")} · {g.assetId}
          </strong>
          <div className="goal-fields">
            <label>
              {tx("Goal scope")}
              <select
                aria-label={tx("Goal scope")}
                value={g.scope}
                disabled={p.busy || g.metric === "pumpReduction"}
                onChange={(e) =>
                  p.onChange({
                    ...g,
                    scope: e.target.value as OperatingGoal["scope"],
                  })
                }
              >
                <option
                  value="asset"
                  disabled={
                    !p.selected.startsWith("B") ||
                    g.metric === "temperatureSpread"
                  }
                >
                  {tx("Selected building")}
                </option>
                <option
                  value="branch"
                  disabled={
                    !p.selected.startsWith("B") &&
                    !["near", "mid", "far"].includes(p.selected)
                  }
                >
                  {tx("Supplying branch")}
                </option>
                <option value="district">{tx("Whole district")}</option>
              </select>
            </label>
            <label>
              {tx(
                g.metric === "temperature"
                  ? "Target indoor temperature"
                  : g.metric === "temperatureSpread"
                    ? "Maximum temperature spread"
                    : "Required energy reduction",
              )}{" "}
              {g.metric.includes("Reduction") ? "%" : "°C"}
              <input
                aria-label={tx("Goal target")}
                type="number"
                step="0.1"
                value={g.target}
                disabled={p.busy}
                onChange={(e) =>
                  p.onChange({ ...g, target: Number(e.target.value) })
                }
              />
            </label>
            <label>
              {tx("Deadline from current state")}
              <select
                aria-label={tx("Goal deadline")}
                value={g.deadlineMinutes}
                disabled={p.busy}
                onChange={(e) =>
                  p.onChange({ ...g, deadlineMinutes: Number(e.target.value) })
                }
              >
                {[30, 60, 90, 120, 150, 180].map((m) => (
                  <option key={m} value={m}>
                    {m} {tx("min")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tx("All-building minimum at deadline")} °C
              <input
                aria-label={tx("Comfort minimum")}
                type="number"
                min="18"
                max="23"
                step="0.1"
                value={g.minC}
                disabled={p.busy}
                onChange={(e) =>
                  p.onChange({ ...g, minC: Number(e.target.value) })
                }
              />
            </label>
            <label>
              {tx("All-building maximum at deadline")} °C
              <input
                aria-label={tx("Comfort maximum")}
                type="number"
                min="20"
                max="26"
                step="0.1"
                value={g.maxC}
                disabled={p.busy}
                onChange={(e) =>
                  p.onChange({ ...g, maxC: Number(e.target.value) })
                }
              />
            </label>
          </div>
          {g.scope !== "district" && (
            <label className="goal-checkbox">
              <input
                type="checkbox"
                checked={g.allowShared}
                disabled={p.busy}
                onChange={(e) =>
                  p.onChange({ ...g, allowShared: e.target.checked })
                }
              />
              {tx("Allow coordinated station and all branch controls")}
            </label>
          )}
          <p className="muted">
            {tx(
              p.engineered
                ? "This engineering scenario preserves its original target and deadline. Commissioned local valves and explicit physical amendments operate only in the modified model."
                : "The structured goal is binding. Temperature tolerance is ±0.3°C. Existing comfort violations must not worsen before the deadline; the full comfort band is enforced from the deadline onwards. Building goals operate the supplying branch, not an invented individual valve.",
            )}
          </p>
          <button disabled={p.busy} onClick={() => p.onChange(null)}>
            {tx("Use legacy weighted objective")}
          </button>
        </>
      )}
    </section>
  );
}
export function GoalOutcome({ result }: { result: GoalResult }) {
  return (
    <section
      className={`goal-outcome ${result.passed ? "passed" : "missed"}`}
      aria-label={tx("Numerical goal outcome")}
    >
      <strong>{tx(result.message)}</strong>
      <p>
        {tx("Goal scope")}: {tx(result.scope)} · {result.assetId} ·{" "}
        {result.deadlineMinutes} {tx("min")}
      </p>
      <div className="goal-values">
        <span>
          {tx("Requested")}
          <b>
            {result.target.toFixed(1)} {result.unit}
          </b>
        </span>
        <span>
          {tx("Best tested result")}
          <b>
            {result.achieved.toFixed(2)} {result.unit}
          </b>
        </span>
      </div>
      <p>
        {tx("Target")}: {tx(result.targetMet ? "Met" : "Not met")} ·{" "}
        {tx("Comfort guardrails")}:{" "}
        {tx(result.guardrailsMet ? "Met" : "Not met")}
      </p>
      {result.violatingAssets.length > 0 && (
        <p>
          {tx("Affected guardrails")}: {result.violatingAssets.join(" · ")}
        </p>
      )}
      <details>
        <summary>{tx("Target buildings at deadline")}</summary>
        {Object.entries(result.targetBuildings).map(([id, t]) => (
          <p key={id}>
            {id} · {t.toFixed(2)} °C
          </p>
        ))}
      </details>
      {!result.passed && (
        <small>
          {tx(
            "No application token issued. A missed goal is not evidence of physical impossibility; the bounded search may not find every feasible schedule.",
          )}
        </small>
      )}
    </section>
  );
}
