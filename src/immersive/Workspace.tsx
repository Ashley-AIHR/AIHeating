import { useEffect, useRef, useState, useMemo, lazy, Suspense } from "react";
import {
  api,
  fmt,
  type Twin,
  type Diagnosis,
  type Candidate,
} from "../operations/types";
import { validateGlb, type BimModel } from "../engineering/model";
import CityScene, { type Geography } from "./CityScene";
import visionGeometry from "../../public/site-assets/vision-district.json";
import "./immersive.css";
const EngineeringScene = lazy(() => import("../engineering/EngineeringScene"));
type Forecast = Candidate["trace"][number] & {
  state?: Twin;
  buildings?: Record<
    string,
    { indoorC: number; heatKw: number; returnC: number }
  >;
};
type Plan = Omit<Candidate, "trace"> & {
  trace: Forecast[];
  schedule: {
    minute: number;
    supplyC: number;
    pumpHz: number;
    valvesPct: number[];
  }[];
  planHash: string;
};
type Optimisation = {
  revision: number;
  baseline: Candidate;
  recommendation: Plan | null;
  bestAttempt: Plan;
  status: string;
  evaluations: number;
  solver: string;
  objective: string;
  verification: {
    passed: boolean;
    maxResidual: number;
    maxPressureKpa: number;
    scope: string;
  };
  limitations: string[];
};
type Run = {
  runId: string;
  role: string;
  model: string;
  revision: number;
  assetId: string;
  equipmentId?: string | null;
  answer: string;
  totalTokens: number;
  diagnosis: Diagnosis;
  optimisation: Optimisation | null;
  trace: { tool: string; result: unknown }[];
  context: { time: string; relatedAssets: { id: string }[] };
};
type Observation = {
  assetId: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  source: string;
  quality: string;
  stale: boolean;
  ageSeconds: number;
};
type Feed = {
  status: string;
  revision: number;
  observations: Observation[];
  scope: string;
  retention: string;
};
type Config = {
  aiConfigured: boolean;
  model: string;
  telemetryConfigured: boolean;
  registry: { id: string; name: string; kind: string; parent: string | null }[];
  site: {
    id: string;
    name: string;
    scope: string;
    source: string;
    profiles: { id: string; name: string; system: string; enabled: boolean }[];
  };
};
const scenarioNames: Record<string, string> = {
  imbalance: "Hydraulic imbalance",
  warming: "Sunrise demand drop",
  cold: "Cold-front resilience",
  sensor: "Sensor disagreement",
  window: "Local heat loss",
};
const fixed = () => {};
function download(name: string, value: unknown) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="pair">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export default function Workspace() {
  const [config, setConfig] = useState<Config | null>(null),
    [twin, setTwin] = useState<Twin | null>(null),
    [geo, setGeo] = useState<Geography | null>(null),
    [frames, setFrames] = useState<Twin[]>([]);
  const [selected, setSelected] = useState("B10"),
    [focus, setFocus] = useState(0),
    [panel, setPanel] = useState("inspect"),
    [layer, setLayer] = useState("temperature"),
    [timeMode, setTimeMode] = useState("current"),
    [timeIndex, setTimeIndex] = useState(0);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null),
    [optimisation, setOptimisation] = useState<Optimisation | null>(null),
    [run, setRun] = useState<Run | null>(null),
    [feed, setFeed] = useState<Feed | null>(null);
  const [code, setCode] = useState(""),
    [question, setQuestion] = useState(
      "Investigate the selected asset using physical evidence. Test an alternative explanation where possible.",
    ),
    [objective, setObjective] = useState("balanced");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [playing, setPlaying] = useState(false),
    [confirm, setConfirm] = useState(false),
    [sceneView, setSceneView] = useState<"district" | "plant">("district"),
    [equipment, setEquipment] = useState("HX-A"),
    [bimOpen, setBimOpen] = useState(false),
    [bim, setBim] = useState<BimModel | null>(null),
    [bimSelected, setBimSelected] = useState(""),
    [clip, setClip] = useState<"none" | "x" | "y" | "z">("none"),
    [bimFocus, setBimFocus] = useState(0),
    [search, setSearch] = useState("");
  const [imported, setImported] = useState<ArrayBuffer | null>(null),
    [importName, setImportName] = useState("");
  const inFlight = useRef(false),
    alive = useRef(true);
  const bimCommand = useMemo(
    () => ({ id: bimFocus, type: "fit" as const }),
    [bimFocus],
  );
  async function work(label: string, fn: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setPlaying(false);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy("");
    }
  }
  async function refresh() {
    const state = await api<Twin>("state");
    setTwin(state);
    const replay = await api<{ frames: Twin[] }>("replay");
    setFrames(replay.frames);
    setDiagnosis(await api<Diagnosis>("diagnose"));
  }
  useEffect(() => {
    alive.current = true;
    void work("Loading physical state", async () => {
      const [c, g] = await Promise.all([
        fetch("/api/config").then((r) => r.json()),
        fetch("/site-assets/yinchuan.json").then((r) => {
          if (!r.ok) throw new Error("Geographic source unavailable");
          return r.json();
        }),
      ]);
      setConfig(c);
      setGeo(g);
      await refresh();
    });
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        void work("Advancing simulation", async () => {
          setTwin(await api<Twin>("advance"));
          await refresh();
        }),
      8000,
    );
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (!bimOpen || bim) return;
    void fetch("/engineering-assets/duplex-mep.json")
      .then((r) => {
        if (!r.ok) throw new Error("BIM source unavailable");
        return r.json();
      })
      .then(setBim)
      .catch((e) => setError(e.message));
  }, [bimOpen, bim]);
  useEffect(() => {
    if (panel !== "connection" || !code) return;
    let dead = false;
    const read = () =>
      api<Feed>("telemetry", {}, code)
        .then((f) => {
          if (!dead) setFeed(f);
        })
        .catch(() => {
          if (!dead) setFeed(null);
        });
    void read();
    const timer = setInterval(() => void read(), 10000);
    return () => {
      dead = true;
      clearInterval(timer);
    };
  }, [panel, code]);
  function select(id: string) {
    setSelected(id);
    setFocus((x) => x + 1);
    setPanel("inspect");
  }
  const plan = optimisation?.recommendation,
    forecast = plan?.trace || [];
  let frame = twin;
  if (timeMode === "replay" && frames[timeIndex]) frame = frames[timeIndex];
  if (timeMode === "forecast" && twin && forecast[timeIndex]) {
    const f = forecast[timeIndex],
      s = f.state || twin;
    frame = {
      ...s,
      buildings: s.buildings.map((b) => ({
        ...b,
        indoorC: b.modelC,
        quality: "forecast",
      })),
    };
  }
  const building = frame?.buildings.find((b) => b.id === selected),
    zone = frame?.zones.find((z) => z.id === (building?.zone || selected)),
    asset = config?.registry.find((a) => a.id === selected);
  const stalePlan = !!optimisation && optimisation.revision !== twin?.revision;
  useEffect(() => {
    if (stalePlan && timeMode === "forecast") setTimeMode("current");
  }, [stalePlan, timeMode]);
  function current() {
    setTimeMode("current");
    setTimeIndex(0);
  }
  async function optimise() {
    await work("Optimising + verifying nonlinear trajectories", async () => {
      setPlaying(false);
      const o = await api<Optimisation>("optimise", { objective });
      setOptimisation(o);
      setPanel("optimise");
      current();
    });
  }
  async function investigate(role: string) {
    await work(
      `${role === "diagnostic" ? "Diagnostic" : "Optimisation"} agent is using numerical tools`,
      async () => {
        setPlaying(false);
        const r = await api<Run>(
          "investigation",
          {
            role,
            assetId: selected,
            equipmentId:
              selected === "ST01" && sceneView === "plant"
                ? equipment
                : undefined,
            question,
            objective,
            revision: twin?.revision,
            mode: "simulation",
          },
          code,
        );
        setRun(r);
        if (r.optimisation) setOptimisation(r.optimisation);
        setPanel("agents");
      },
    );
  }
  const displaySeries =
    timeMode === "forecast"
      ? forecast.map((f) =>
          building && f.buildings?.[building.id]
            ? f.buildings[building.id].indoorC
            : f.meanC,
        )
      : frames.map(
          (f) =>
            f.buildings.find((b) => b.id === selected)?.indoorC ||
            f.buildings.reduce((n, b) => n + b.indoorC, 0) / 12,
        );
  const lo = Math.min(17, ...displaySeries) - 0.5,
    hi = Math.max(24, ...displaySeries) + 0.5;
  const points = displaySeries
    .map(
      (v, i) =>
        `${10 + (i * 780) / Math.max(1, displaySeries.length - 1)},${65 - ((v - lo) / (hi - lo)) * 55}`,
    )
    .join(" ");
  if (!twin || !config || !geo || !frame)
    return (
      <main className="immersive loading">
        <h1>
          HEATPILOT<span> / CONNECTED OPERATIONS</span>
        </h1>
        <p>
          {error || "Loading source geometry and nonlinear physical state…"}
        </p>
        {error && <button onClick={() => location.reload()}>Retry</button>}
      </main>
    );
  return (
    <main className="immersive">
      <header className="ops-header">
        <div className="brand">
          <span className="brand-symbol">◈</span>
          <div>
            HEATPILOT <small>SPATIAL ENERGY OPERATIONS</small>
          </div>
        </div>
        <div className="site-title">
          <strong>
            YINCHUAN <span>银川</span>
          </strong>
          <small>Winter-city energy intelligence · vision demonstrator</small>
        </div>
        <div className="header-state">
          <span className="mode-badge">
            {timeMode === "current" ? "SIMULATION" : timeMode.toUpperCase()}
          </span>
          <span className="offline">SIMULATED DATA</span>
          <button onClick={() => setPanel("connection")}>Connections ↗</button>
        </div>
      </header>
      <nav className="tool-rail" aria-label="Workspace tools">
        {[
          ["inspect", "◈", "Assets"],
          ["alarms", "△", "Alarms"],
          ["agents", "✧", "Agents"],
          ["optimise", "⌁", "Optimise"],
          ["connection", "⌘", "Data"],
          ["sources", "▤", "Evidence"],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            className={panel === id ? "active" : ""}
            aria-label={label}
            onClick={() => setPanel(id)}
          >
            <b aria-hidden="true">{icon}</b>
            {label}
          </button>
        ))}
        <div className="rail-bottom">
          3D
          <br />
          TWIN
        </div>
      </nav>
      <section className="world-stage" aria-label="Integrated 3D district">
        <CityScene
          geo={geo}
          frame={frame}
          selected={selected}
          onSelect={select}
          focus={focus}
          layer={layer}
          imported={imported}
          view={sceneView}
          onView={setSceneView}
          onEquipment={setEquipment}
          equipment={equipment}
          suspended={bimOpen}
        />
      </section>
      <section className="world-title">
        <div className="eyebrow">YINCHUAN / CONNECTED ENERGY DISTRICT</div>
        <h1>
          {sceneView === "plant"
            ? "Inside the energy centre."
            : "The city, in balance."}
        </h1>
        <p>
          {sceneView === "plant"
            ? "Mechanical systems. Network intelligence. One operating context."
            : "A living model of heat, buildings and the decisions that connect them."}
        </p>
      </section>
      <div className="view-switch" aria-label="Spatial view">
        <button
          aria-pressed={sceneView === "district"}
          onClick={() => setSceneView("district")}
        >
          ◈ District
        </button>
        <button
          aria-pressed={sceneView === "plant"}
          onClick={() => {
            setSelected("ST01");
            setPanel("inspect");
            setSceneView("plant");
          }}
        >
          ⚙ Energy centre
        </button>
      </div>
      <div className="scene-controls">
        <div className="segmented">
          {[
            ["temperature", "Thermal"],
            ["network", "Network"],
            ["buildings", "Buildings"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={layer === id}
              onClick={() => setLayer(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setSelected("ST01");
            setSceneView("plant");
            setFocus((x) => x + 1);
          }}
        >
          Focus station
        </button>
        <button onClick={() => setBimOpen(true)}>BIM reference ↗</button>
      </div>
      <section
        className="scene-metrics"
        aria-label="Current physical indicators"
      >
        <div>
          <span>Delivered heat</span>
          <strong>
            {fmt(frame.heatKw / 1000, 3)}
            <small> MW</small>
          </strong>
        </div>
        <div>
          <span>Outdoor temperature</span>
          <strong>
            {fmt(frame.outdoorC, 1)}
            <small> °C</small>
          </strong>
        </div>
        <div>
          <span>Pump electricity</span>
          <strong>
            {fmt(frame.pumpKw, 1)}
            <small> kW</small>
          </strong>
        </div>
        <div>
          <span>Selected / {selected}</span>
          <strong>
            {building
              ? fmt(building.indoorC, 1)
              : fmt(zone?.flowM3h || frame.flowM3h, 1)}
            <small>{building ? " °C" : " m³/h"}</small>
          </strong>
        </div>
      </section>
      <div className="scene-caption">
        <span className="legend-dot warm" /> Supply{" "}
        <span className="legend-dot cool" /> Return{" "}
        <span>
          {imported
            ? "Local visual model · no georeferencing or asset mapping"
            : "Authored Yinchuan-inspired district · physically simulated operation"}
        </span>
      </div>
      <aside className="ops-dock" aria-label="Contextual operations panel">
        <div className="dock-heading">
          <div className="eyebrow">
            {panel === "inspect" ? "ASSET CONTEXT" : "OPERATIONS TOOL"}
          </div>
          <h2>
            {
              (
                {
                  inspect: asset?.name || selected,
                  alarms: "Network findings",
                  agents: "Agent operations",
                  optimise: "Predictive optimisation",
                  connection: "Data connections",
                  sources: "Evidence & provenance",
                } as Record<string, string>
              )[panel]
            }
          </h2>
          <div className="context-line">
            {selected} <span>·</span>{" "}
            {timeMode === "current" ? `Revision ${frame.revision}` : timeMode}{" "}
            <span>·</span> {frame.time.slice(11, 16)}
          </div>
        </div>
        {panel === "inspect" && (
          <>
            <div className="asset-search">
              <input
                aria-label="Search assets"
                placeholder="Find a building or branch…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Selected asset"
                value={selected}
                onChange={(e) => select(e.target.value)}
              >
                {config.registry
                  .filter(
                    (a) =>
                      a.id === selected ||
                      `${a.id} ${a.name}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} · {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="hero-reading">
              <small>
                {building
                  ? "INDOOR TEMPERATURE"
                  : zone
                    ? "BRANCH FLOW"
                    : "SUPPLY TEMPERATURE"}
              </small>
              <strong>
                {fmt(building?.indoorC ?? zone?.flowM3h ?? frame.supplyC, 1)}
                <span>{building ? "°C" : zone ? "m³/h" : "°C"}</span>
              </strong>
              <span className="quality">
                {timeMode === "forecast"
                  ? "PREDICTED · UNCALIBRATED"
                  : building?.quality === "suspect"
                    ? "SUSPECT SIMULATED SENSOR"
                    : "SYNTHETIC MODEL VALUE"}
              </span>
            </div>
            {building && (
              <>
                <Pair
                  label="Physical-model temperature"
                  value={`${fmt(building.modelC, 1)} °C`}
                />
                <Pair
                  label="Delivered heat"
                  value={`${fmt(building.heatKw, 1)} kW`}
                />
                <Pair
                  label="Return temperature"
                  value={`${fmt(building.returnC, 1)} °C`}
                />
                <Pair
                  label="Heated floor area (archetype)"
                  value={`${fmt(building.areaM2, 0)} m²`}
                />
              </>
            )}
            {zone && (
              <>
                <h3>Connected heating branch</h3>
                <button
                  className="connection-path"
                  onClick={() => select(zone.id)}
                >
                  ST01 → {zone.id.toUpperCase()}{" "}
                  {building ? `→ ${building.id}` : ""}
                </button>
                <Pair
                  label="Transport delay (model)"
                  value={`${fmt(zone.delayMinutes, 1)} min`}
                />
                <Pair
                  label="Branch valve (displayed frame)"
                  value={`${fmt(zone.valvePct, 0)} %`}
                />
              </>
            )}
            {!building && !zone && (
              <>
                {sceneView === "plant" && (
                  <div className="equipment-card">
                    <div className="eyebrow">
                      MECHANICAL ASSEMBLY / {equipment}
                    </div>
                    <h3>
                      {equipment.startsWith("HX")
                        ? "Plate heat exchanger"
                        : equipment === "MCC"
                          ? "Motor control centre"
                          : equipment === "P-03"
                            ? "Standby circulation pump"
                            : "Duty circulation pump"}
                    </h3>
                    <div className="equipment-picker">
                      {["HX-A", "HX-B", "P-01", "P-02", "P-03", "MCC"].map(
                        (id) => (
                          <button
                            key={id}
                            aria-pressed={equipment === id}
                            onClick={() => setEquipment(id)}
                          >
                            {id}
                          </button>
                        ),
                      )}
                    </div>
                    <p>
                      {equipment.startsWith("HX")
                        ? "Primary-to-secondary heat transfer. Inspect the common supply and return headers, then preview the effect of a supply-temperature change across every connected building."
                        : equipment === "MCC"
                          ? "Variable-frequency drive coordination. Test a pump-speed proposal against branch pressure, transport delay and indoor comfort before simulator approval."
                          : equipment === "P-03"
                            ? "Standby unit in the visual design. The numerical model currently represents one equivalent pump characteristic, not individual duty/standby switching."
                            : "Secondary circulation. The model couples equivalent pump speed to branch resistance, water flow and delayed heat delivery."}
                    </p>
                    <small>
                      Readings below are shared station-model values, not
                      individual equipment instruments.
                    </small>
                  </div>
                )}
                <Pair
                  label="Return temperature"
                  value={`${fmt(frame.returnC, 1)} °C`}
                />
                <Pair
                  label="Total flow"
                  value={`${fmt(frame.flowM3h, 1)} m³/h`}
                />
                <Pair
                  label="Available pressure"
                  value={`${fmt(frame.pressureKpa, 1)} kPa`}
                />
                <Pair
                  label="Pump frequency"
                  value={`${fmt(frame.pumpHz, 1)} Hz`}
                />
              </>
            )}
            <div className="dock-actions">
              <button className="primary" onClick={() => setPanel("agents")}>
                ✧ Investigate this asset
              </button>
              <button
                onClick={() => {
                  setSelected("ST01");
                  setSceneView(sceneView === "plant" ? "district" : "plant");
                }}
              >
                {sceneView === "plant"
                  ? "Return to connected district"
                  : "Explore energy centre"}
              </button>
            </div>
            <p className="muted">
              One shared selection links the scene, network, timeline and agent
              investigation.
            </p>
          </>
        )}
        {panel === "alarms" && (
          <>
            <p className="muted">
              Current simulation findings · revision {diagnosis?.revision}.
              Selecting a finding focuses the same asset in the district.
            </p>
            {diagnosis?.findings.map((f) => (
              <button
                className={`finding ${f.severity}`}
                key={f.id}
                onClick={() => select(f.asset)}
              >
                <span>
                  {f.asset} / {f.severity}
                </span>
                <strong>{f.title}</strong>
                <p>{f.evidence}</p>
                <small>{f.certainty}</small>
              </button>
            ))}
            {!diagnosis?.findings.length && (
              <p>No active rule-based findings in this frame.</p>
            )}
          </>
        )}
        {panel === "agents" && (
          <>
            <div className="agent-card">
              <span className="agent-orb">✧</span>
              <div>
                <strong>DeepSeek V4 Flash</strong>
                <small>{config.model}</small>
              </div>
              <span>{config.aiConfigured ? "CONFIGURED" : "OFFLINE"}</span>
            </div>
            <p>
              Diagnosis and optimisation share asset <b>{selected}</b>, its
              branch, the current physical state and model limitations.
            </p>
            <label>
              Operator access code
              <input
                type="password"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Not your OpenRouter key"
              />
            </label>
            <label>
              Investigation brief
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={1800}
              />
            </label>
            <div className="dock-actions">
              <button
                className="primary"
                disabled={
                  !!busy ||
                  timeMode !== "current" ||
                  !config.aiConfigured ||
                  !code
                }
                onClick={() => void investigate("diagnostic")}
              >
                Run diagnostic agent
              </button>
              <button
                disabled={
                  !!busy ||
                  timeMode !== "current" ||
                  !config.aiConfigured ||
                  !code
                }
                onClick={() => void investigate("optimisation")}
              >
                Run optimisation agent
              </button>
            </div>
            <p className="muted">
              Operator-triggered paid calls. No background LLM polling.
              Numerical optimisation remains available without AI access.
            </p>
            {run && (
              <article className="agent-result">
                <div className="eyebrow">COMPLETED / {run.role}</div>
                <h3>
                  {run.assetId}
                  {run.equipmentId ? ` / ${run.equipmentId}` : ""} · revision{" "}
                  {run.revision}
                </h3>
                {run.revision !== twin.revision && (
                  <p className="warning">
                    Historical run—current state has changed.
                  </p>
                )}
                <p className="narrative">{run.answer}</p>
                <button
                  onClick={() => {
                    select(run.assetId);
                    if (run.equipmentId) {
                      setEquipment(run.equipmentId);
                      setSceneView("plant");
                    }
                  }}
                >
                  Focus investigated asset
                </button>
                <h3>Executed tools</h3>
                {run.trace.map((t, i) => (
                  <details key={i}>
                    <summary>
                      {i + 1}. {t.tool}
                    </summary>
                    <pre>{JSON.stringify(t.result, null, 2)}</pre>
                  </details>
                ))}
                <button
                  onClick={() =>
                    download(`heatpilot-agent-${run.runId}.json`, run)
                  }
                >
                  Export run evidence
                </button>
              </article>
            )}
          </>
        )}
        {panel === "optimise" && (
          <>
            <p>
              Search two 90-minute control blocks against the nonlinear physical
              model. A fresh rollout verifies the best plan found.
            </p>
            <label>
              Objective
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              >
                <option value="balanced">Balanced comfort + energy</option>
                <option value="comfort">Comfort priority</option>
                <option value="energy">Energy priority</option>
              </select>
            </label>
            <button
              className="primary full"
              disabled={!!busy || timeMode !== "current"}
              onClick={() => void optimise()}
            >
              Compute & verify schedule
            </button>
            {optimisation && (
              <>
                <div className="verification">
                  <span>
                    {optimisation.verification.passed
                      ? "✓ MODEL GATES PASSED"
                      : "! NO FEASIBLE PLAN"}
                  </span>
                  <strong>{optimisation.status}</strong>
                  <small>
                    {optimisation.evaluations} evaluations · revision{" "}
                    {optimisation.revision}
                  </small>
                </div>
                {stalePlan && (
                  <p className="warning">
                    Expired context. Recompute against the current state.
                  </p>
                )}
                <Pair
                  label="Baseline heat / 3 h"
                  value={`${fmt(optimisation.baseline.heatKwh, 1)} kWh`}
                />
                <Pair
                  label="Proposed heat / 3 h"
                  value={`${fmt(optimisation.bestAttempt.heatKwh, 1)} kWh`}
                />
                <Pair
                  label="Lowest trajectory temperature"
                  value={`${fmt(optimisation.bestAttempt.minimumC, 2)} °C`}
                />
                <Pair
                  label="End minimum temperature"
                  value={`${fmt(optimisation.bestAttempt.endMinimumC, 2)} °C`}
                />
                <Pair
                  label="Maximum numerical residual"
                  value={optimisation.verification.maxResidual.toExponential(2)}
                />
                <h3>Computed schedule</h3>
                {optimisation.bestAttempt.schedule.map((s) => (
                  <div className="schedule" key={s.minute}>
                    <b>+{s.minute} min</b>
                    <span>
                      {fmt(s.supplyC, 1)}°C · {fmt(s.pumpHz, 1)} Hz
                    </span>
                    <small>
                      Valves {s.valvesPct.map((v) => fmt(v, 0)).join(" / ")}%
                    </small>
                  </div>
                ))}
                <div className="dock-actions">
                  <button
                    disabled={!plan || stalePlan || !!busy}
                    onClick={() => {
                      setTimeMode("forecast");
                      setTimeIndex(0);
                      setPlaying(false);
                    }}
                  >
                    Preview in district
                  </button>
                  <button
                    className="primary"
                    disabled={
                      !plan || stalePlan || !!busy || timeMode !== "current"
                    }
                    onClick={() => setConfirm(true)}
                  >
                    Approve simulator step…
                  </button>
                </div>
                <p className="muted">
                  {optimisation.verification.scope}. No field command. No global
                  optimality or savings guarantee.
                </p>
              </>
            )}
          </>
        )}
        {panel === "connection" && (
          <>
            <div className="verification">
              <span>{feed?.status?.toUpperCase() || "NOT CONNECTED"}</span>
              <strong>Read-only observation gateway</strong>
              <small>
                {config.telemetryConfigured
                  ? "Gateway token configured"
                  : "Set TELEMETRY_INGEST_TOKEN on the server"}
              </small>
            </div>
            <p>
              Measurements remain separate from the uncalibrated simulator. A
              received value is not proof of a commissioned site connection.
            </p>
            <label>
              Operator access code
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              disabled={!!busy || !code}
              onClick={() =>
                void work("Reading observations", async () =>
                  setFeed(await api<Feed>("telemetry", {}, code)),
                )
              }
            >
              Read latest observations
            </button>
            {feed && (
              <>
                <p className="muted">{feed.scope}</p>
                {feed.observations.map((r) => (
                  <div className="observation" key={r.assetId + r.metric}>
                    <button onClick={() => select(r.assetId)}>
                      {r.assetId}
                    </button>
                    <strong>
                      {r.metric}: {fmt(r.value, 2)} {r.unit}
                    </strong>
                    <small>
                      {r.stale ? "STALE" : r.quality.toUpperCase()} ·{" "}
                      {Math.round(r.ageSeconds)} s old · {r.source}
                    </small>
                  </div>
                ))}
                {!feed.observations.length && <p>No measurements received.</p>}
                <p className="muted">{feed.retention}</p>
              </>
            )}
            <h3>Gateway contract</h3>
            <p className="muted">
              POST /api/telemetry/ingest with X-Telemetry-Token. Explicit site,
              asset, metric, unit, timestamp, quality and source are required.
              Latest observations refresh every 10 seconds while this panel is
              open and authenticated.
            </p>
            <h3>Detailed district geometry</h3>
            <label className="file-button">
              Import local self-contained GLB
              <input
                type="file"
                accept=".glb"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void work("Checking model", async () => {
                    if (file.size > 50 * 1024 * 1024)
                      throw new Error("Maximum model size is 50 MiB");
                    const bytes = await file.arrayBuffer();
                    validateGlb(bytes);
                    setImported(bytes);
                    setImportName(file.name);
                  });
                }}
              />
            </label>
            {importName && (
              <>
                <p>{importName}</p>
                <button
                  onClick={() => {
                    setImported(null);
                    setImportName("");
                  }}
                >
                  Restore vision district
                </button>
              </>
            )}
            <p className="muted">
              Local visual inspection only. Imported model is centred for
              viewing, not georeferenced or linked to instruments; asset labels
              are hidden until a surveyed mapping exists.
            </p>
          </>
        )}
        {panel === "sources" && (
          <>
            <h3>Vision, geometry and identity</h3>
            <p>
              {visionGeometry.name}. Original architectural and mechanical
              design, inspired by the supplied winter-city renders. Local design
              coordinates, not a surveyed reconstruction.
            </p>
            <p className="muted">
              The twelve connected buildings are aggregate thermal archetypes.
              Visual floor counts and equipment assemblies are design
              representations, not measured asset specifications.
            </p>
            <h3>Physically based materials</h3>
            <p>
              Asphalt, snow, concrete and paving textures by{" "}
              <a
                href="https://polyhaven.com/license"
                target="_blank"
                rel="noreferrer"
              >
                Poly Haven · CC0
              </a>
              . Files are served locally; no live asset service is required.
            </p>
            <a
              href="/vision-materials/manifest.json"
              target="_blank"
              rel="noreferrer"
            >
              Material sources and checksums ↗
            </a>
            <h3>Geographic research context</h3>
            <p className="muted">
              The retained OSM extract informed the earlier geographic study; it
              is not the current scene geometry.
            </p>
            <a href={geo.url} target="_blank" rel="noreferrer">
              © OpenStreetMap contributors · ODbL
            </a>
            <p className="muted">Research extract: {geo.extractTimestamp}.</p>
            <a href={config.site.source} target="_blank" rel="noreferrer">
              Yinchuan operational reference ↗
            </a>
            <h3>Model scope</h3>
            {twin.assumptions.map((a) => (
              <p className="scope-item" key={a}>
                {a}
              </p>
            ))}
            <h3>System profiles</h3>
            {config.site.profiles.map((p) => (
              <div className="schedule" key={p.id}>
                <b>{p.name}</b>
                <span>{p.system}</span>
                <small>
                  {p.enabled
                    ? "CURRENT DEMONSTRATOR"
                    : "REQUIRES DIFFERENT EQUIPMENT MODELS"}
                </small>
              </div>
            ))}
            <button
              className="full"
              onClick={() =>
                download("heatpilot-world-evidence.json", {
                  site: config.site,
                  registry: config.registry,
                  state: twin,
                  selected,
                  equipment: sceneView === "plant" ? equipment : null,
                  visionGeometry,
                  timeMode,
                  displayTime: frame.time,
                  geographicResearch: {
                    scope: geo.scope,
                    origin: geo.origin,
                    extractTimestamp: geo.extractTimestamp,
                  },
                  optimisation,
                  run,
                  limitations: twin.assumptions,
                })
              }
            >
              Export world evidence
            </button>
            <p className="muted">
              Exports omit access codes and provider keys. Field observations
              are not included in this public-demonstrator export.
            </p>
          </>
        )}
      </aside>
      <section className="ops-timeline" aria-label="Shared world timeline">
        <div className="timeline-top">
          <div>
            <span className="eyebrow">SHARED TIME CONTEXT</span>
            <strong>
              {frame.time.slice(0, 10)} <span>{frame.time.slice(11, 16)}</span>
            </strong>
          </div>
          <div className="segmented">
            <button aria-pressed={timeMode === "current"} onClick={current}>
              Current simulation
            </button>
            <button
              aria-pressed={timeMode === "replay"}
              disabled={!frames.length}
              onClick={() => {
                setTimeMode("replay");
                setTimeIndex(frames.length - 1);
                setPlaying(false);
              }}
            >
              Replay
            </button>
            <button
              aria-pressed={timeMode === "forecast"}
              disabled={!plan || stalePlan}
              onClick={() => {
                setTimeMode("forecast");
                setTimeIndex(0);
                setPlaying(false);
              }}
            >
              Forecast
            </button>
          </div>
          <select
            aria-label="Simulation scenario"
            value={twin.scenario}
            disabled={!!busy}
            onChange={(e) => {
              const scenario = e.target.value;
              setPlaying(false);
              void work("Resetting scenario", async () => {
                await api("reset", { scenario });
                await refresh();
                setOptimisation(null);
                setRun(null);
                current();
              });
            }}
          >
            {Object.entries(scenarioNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <button
            aria-pressed={playing}
            disabled={!!busy || timeMode !== "current"}
            onClick={() => setPlaying((x) => !x)}
          >
            {playing ? "Ⅱ Pause" : "▷ Auto-step"}
          </button>
          <button
            disabled={!!busy || timeMode !== "current"}
            onClick={() =>
              void work("Advancing simulation", async () => {
                await api("advance");
                await refresh();
              })
            }
          >
            +30 min
          </button>
        </div>
        <div className="timeline-plot">
          <div>
            <span>{building ? selected : "District mean"} / indoor °C</span>
            <small>
              {timeMode === "forecast"
                ? "Computed prediction · 30-minute samples"
                : "Recorded simulation · not field telemetry"}
            </small>
          </div>
          <svg
            viewBox="0 0 800 75"
            preserveAspectRatio="none"
            aria-label="Temperature history"
          >
            <path
              d="M0 65H800 M0 35H800 M0 5H800"
              stroke="#24364a"
              fill="none"
            />
            <polyline
              points={points}
              fill="none"
              stroke={timeMode === "forecast" ? "#e9b274" : "#6fddc7"}
              strokeWidth="2"
            />
            {displaySeries.length === 1 && (
              <circle
                cx="10"
                cy={65 - ((displaySeries[0] - lo) / (hi - lo)) * 55}
                r="3"
                fill="#6fddc7"
              />
            )}
          </svg>
        </div>
        {timeMode !== "current" && (
          <input
            aria-label="Timeline sample"
            type="range"
            min={0}
            max={Math.max(
              0,
              (timeMode === "forecast" ? forecast.length : frames.length) - 1,
            )}
            value={timeIndex}
            onChange={(e) => setTimeIndex(Number(e.target.value))}
          />
        )}
      </section>
      {(busy || error) && (
        <div
          className={`status-toast ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {busy && <span className="spinner" />}
          {error || busy}
          {error && (
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          )}
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="approval-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-title"
          >
            <h2 id="approval-title">Approve simulator change?</h2>
            <p>
              Apply the first control block for the next 30 simulated minutes.
              This does not command any real equipment. The server revalidates
              the full plan and rejects expired or changed-state approvals.
            </p>
            <p className="muted">
              Plan {plan?.planHash.slice(0, 16)} · revision{" "}
              {optimisation?.revision}
            </p>
            <div className="dock-actions">
              <button onClick={() => setConfirm(false)}>Cancel</button>
              <button
                className="primary"
                disabled={!!busy || stalePlan || !plan}
                onClick={() =>
                  void work(
                    "Revalidating and applying simulator step",
                    async () => {
                      await api("apply", { candidateId: plan?.candidateId });
                      await refresh();
                      setConfirm(false);
                      current();
                    },
                  )
                }
              >
                Apply to simulation only
              </button>
            </div>
          </section>
        </div>
      )}
      {bimOpen && (
        <section
          className="bim-overlay"
          role="dialog"
          aria-label="Contextual BIM inspection"
        >
          <header>
            <div>
              <div className="eyebrow">{selected} / CONTEXT RETAINED</div>
              <h2>Engineering reference inspection</h2>
            </div>
            <button onClick={() => setBimOpen(false)}>
              Return to district ×
            </button>
          </header>
          <p className="warning">
            Public buildingSMART Duplex MEP reference. NOT the selected building
            or a Yinchuan heating-station as-built model. No telemetry is mapped
            to these components.
          </p>
          <div className="bim-tools">
            <button onClick={() => setBimFocus((x) => x + 1)}>Fit model</button>
            <label>
              Section
              <select
                value={clip}
                onChange={(e) => setClip(e.target.value as typeof clip)}
              >
                <option value="none">Off</option>
                <option value="x">X</option>
                <option value="y">Y</option>
                <option value="z">Z</option>
              </select>
            </label>
            <span>
              {bimSelected ||
                "Select a component to inspect its source identity"}
            </span>
          </div>
          <div className="bim-canvas">
            <Suspense fallback={<p>Loading BIM viewer…</p>}>
              <EngineeringScene
                dark
                mode="bim"
                bim={bim}
                network={null}
                localGlb={null}
                selected={bimSelected}
                kind="all"
                hidden={[]}
                isolated={null}
                highlight={[]}
                removed={[]}
                clipAxis={clip}
                clipPercent={50}
                measure={false}
                command={bimCommand}
                onSelect={setBimSelected}
                onMeasure={fixed}
                onPose={fixed}
                onLocalAssets={fixed}
              />
            </Suspense>
          </div>
          {bimSelected && (
            <details className="bim-properties">
              <summary>
                {bim?.assets.find((a) => a.id === bimSelected)?.name ||
                  bimSelected}{" "}
                · source properties
              </summary>
              <pre>
                {JSON.stringify(
                  bim?.assets.find((a) => a.id === bimSelected),
                  null,
                  2,
                )}
              </pre>
            </details>
          )}
          <footer>
            BSI (2020) “Duplex Apartment Test Files”, buildingSMART
            International · CC BY 4.0 · Public reference geometry / 926
            components
          </footer>
        </section>
      )}
    </main>
  );
}
