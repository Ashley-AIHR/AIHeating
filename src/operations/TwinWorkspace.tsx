import { useEffect, useRef, useState, type ReactNode } from "react";
import ReferenceScene, {
  mechanicalAssets,
  type Layer,
  type View,
} from "./ReferenceScene";
import {
  api,
  fmt,
  tone,
  type Answer,
  type Candidate,
  type Comparison,
  type Config,
  type Diagnosis,
  type Twin,
} from "./types";
import "./workspace.css";

type Panel = "compare" | "investigate" | "evidence" | null;
const scenarios = [
  ["imbalance", "Hydraulic imbalance"],
  ["warming", "Rapid daytime warming"],
  ["cold", "Cold front"],
  ["sensor", "Sensor disagreement"],
  ["window", "Open-window heat loss"],
];
function Mark({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    district: (
      <>
        <path d="M3 20V9l6-3v14M9 20V3l7 3v14M16 20V11l5-2v11M1 20h22" />
        <path d="M5 11v2m7-6v2m0 3v2m7-1v2" />
      </>
    ),
    mechanical: (
      <>
        <path d="M3 7h18M3 17h18M6 3v8m12 2v8" />
        <circle cx="6" cy="7" r="2" />
        <circle cx="18" cy="17" r="2" />
        <path d="m10 10 4 4m0-4-4 4" />
      </>
    ),
    investigate: (
      <>
        <path d="m14 3 1.7 5.3L21 10l-5.3 1.7L14 17l-1.7-5.3L7 10l5.3-1.7Z" />
        <path d="m5 14 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
      </>
    ),
    compare: (
      <>
        <path d="M5 3v18m14-18v18M2 8h6m8 8h6M5 8l7 8 7-8" />
        <circle cx="12" cy="16" r="2" />
      </>
    ),
    evidence: (
      <>
        <path d="M6 2h9l4 4v16H6Z M14 2v5h5M9 11h7m-7 4h7m-7 4h4" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.district}
    </svg>
  );
}
function Metric({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
}) {
  return (
    <div className="tw-metric">
      <span>{label}</span>
      <strong>
        {value} <small>{unit}</small>
      </strong>
      <p>{note}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="tw-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Chart({
  lines,
  labels,
  startLabel = "First sample",
  endLabel = "Latest sample",
}: {
  lines: number[][];
  labels: string[];
  startLabel?: string;
  endLabel?: string;
}) {
  const finite = lines.flat().filter(Number.isFinite);
  if (!finite.length) return <p>No recorded samples yet.</p>;
  const lo = Math.floor(Math.min(...finite) - 0.5),
    hi = Math.ceil(Math.max(...finite) + 0.5);
  const point = (n: number, i: number, count: number) => [
    40 + (count === 1 ? 0 : (i / (count - 1)) * 590),
    108 - ((n - lo) / (hi - lo)) * 85,
  ];
  return (
    <div className="tw-chart">
      <svg
        viewBox="0 0 650 135"
        role="img"
        aria-label={
          labels.join(" and ") + " in °C; evenly spaced simulator samples"
        }
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="40"
              x2="630"
              y1={23 + t * 85}
              y2={23 + t * 85}
              stroke="#e6edf4"
            />
            <text x="0" y={27 + t * 85}>
              {fmt(hi - t * (hi - lo))}°
            </text>
          </g>
        ))}
        {lines.map((line, j) => (
          <g
            key={j}
            stroke={j ? "#1cafa6" : "#1874ee"}
            fill="none"
            strokeWidth="2.5"
          >
            <polyline
              points={line
                .map((n, i) => point(n, i, line.length).join(","))
                .join(" ")}
            />
            {line.map((n, i) => (
              <circle
                key={i}
                cx={point(n, i, line.length)[0]}
                cy={point(n, i, line.length)[1]}
                r="3"
                fill={j ? "#1cafa6" : "#1874ee"}
              />
            ))}
          </g>
        ))}
        <text x="40" y="131">
          {startLabel}
        </text>
        <text x="630" y="131" textAnchor="end">
          {endLabel}
        </text>
      </svg>
      <div className="tw-chart-key">
        {labels.map((label, i) => (
          <span key={label}>
            <i style={{ background: i ? "#1cafa6" : "#1874ee" }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const d = dialog.current;
    return () => d?.close();
  }, []);
  return (
    <dialog
      className="tw-dialog"
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="tw-dialog-title"
    >
      <header>
        <div>
          <span className="tw-eyebrow">HEATPILOT / OPERATIONS</span>
          <h2 id="tw-dialog-title">{title}</h2>
        </div>
        <button onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </header>
      <div className="tw-dialog-body">{children}</div>
    </dialog>
  );
}

export default function TwinWorkspace() {
  const [twin, setTwin] = useState<Twin | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [view, setView] = useState<View>("district");
  const [layer, setLayer] = useState<Layer>("temperature");
  const [buildingId, setBuildingId] = useState("B10");
  const [mechanicalId, setMechanicalId] = useState("PUMP-SET");
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState("Connecting to simulator");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [candidateId, setCandidateId] = useState("hold");
  const [confirm, setConfirm] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [answerBuildingId, setAnswerBuildingId] = useState("");
  const [question, setQuestion] = useState(
    "Diagnose the selected building and compare safe interventions. Distinguish simulated evidence from checks required on site.",
  );
  const [accessCode, setAccessCode] = useState("");
  const inFlight = useRef(false);
  async function run(label: string, action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }
  async function initialise() {
    await run("Connecting to simulator", async () => {
      const next = await api<Twin>("state");
      setTwin(next);
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Unable to load application configuration.");
      setConfig(await res.json());
      setDiagnosis(await api<Diagnosis>("diagnose"));
    });
  }
  useEffect(() => {
    void initialise();
  }, []);
  async function mutate(command: string, args: unknown = {}) {
    await run(
      command === "advance"
        ? "Advancing 30 simulated minutes"
        : "Loading scenario",
      async () => {
        const next = await api<Twin>(command, args);
        setTwin(next);
        setComparison(null);
        setAnswer(null);
        setConfirm(false);
        setNotice("");
        setDiagnosis(null);
        setDiagnosis(await api<Diagnosis>("diagnose"));
      },
    );
  }
  const building =
    twin?.buildings.find((b) => b.id === buildingId) ?? twin?.buildings[0];
  const zone = twin?.zones.find((z) => z.id === building?.zone);
  const asset =
    mechanicalAssets.find((a) => a.id === mechanicalId) ?? mechanicalAssets[2];
  const findings =
    diagnosis?.findings.filter(
      (f) => f.asset === building?.id || f.asset === building?.zone,
    ) ?? [];
  const selectedCandidate =
    comparison?.candidates.find((c) => c.id === candidateId) ??
    comparison?.baseline;
  const staleAnswer =
    answer &&
    (answer.revision !== twin?.revision || answerBuildingId !== building?.id);
  function exportEvidence() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            scope:
              "Synthetic research simulator; AI-generated reference imagery, not as-built CAD or field telemetry.",
            selectedBuilding: building?.id,
            selectedMechanical: mechanicalId,
            twin,
            diagnosis,
            comparison,
            answer,
            answerContext: answer
              ? { buildingId: answerBuildingId, stale: !!staleAnswer }
              : null,
            sources: config?.sources,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "heatpilot-simulation-evidence.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function compare() {
    await run("Comparing five control strategies", async () => {
      const result = await api<Comparison>("compare");
      setComparison(result);
      setCandidateId(result.recommendation?.id ?? result.baseline.id);
      setConfirm(false);
    });
  }
  async function apply(candidate: Candidate) {
    await run("Verifying and applying simulated controls", async () => {
      const next = await api<Twin>("apply", {
        candidateId: candidate.candidateId,
      });
      setTwin(next);
      setComparison(null);
      setAnswer(null);
      setConfirm(false);
      setDiagnosis(null);
      setNotice(
        "Verified controls applied to the simulator. No field equipment was commanded.",
      );
      setDiagnosis(await api<Diagnosis>("diagnose"));
    });
  }
  return (
    <div className="tw-app">
      <aside className="tw-sidebar">
        <a className="tw-brand" href="/" aria-label="HeatPilot home">
          <span className="tw-brand-symbol">h</span>
          <div>
            HeatPilot<span>INDUSTRIAL INTELLIGENCE</span>
          </div>
        </a>
        <span className="tw-nav-label">WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {(["district", "mechanical"] as View[]).map((v) => (
            <button
              key={v}
              aria-label={
                v === "district" ? "District network" : "Mechanical plant"
              }
              className={view === v ? "active" : ""}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              <Mark name={v} />
              <span>
                {v === "district" ? "District network" : "Mechanical plant"}
              </span>
            </button>
          ))}
          <div className="tw-nav-divider" />
          {(["investigate", "compare", "evidence"] as const).map((p) => (
            <button
              key={p}
              aria-label={
                p === "investigate"
                  ? "AI investigation"
                  : p === "compare"
                    ? "Interventions"
                    : "Evidence library"
              }
              onClick={() => {
                setPanel(p);
                setConfirm(false);
              }}
            >
              <Mark name={p} />
              <span>
                {p === "investigate"
                  ? "AI investigation"
                  : p === "compare"
                    ? "Interventions"
                    : "Evidence library"}
              </span>
            </button>
          ))}
        </nav>
        <div className="tw-sidebar-bottom">
          <span className="tw-status-dot" /> Simulation workspace
          <p>
            Secondary heating network
            <br />
            12 buildings · 3 branches
          </p>
          <a href="/operations-classic">Classic workspace ↗</a>
          <a href="/legacy">Original simulator ↗</a>
        </div>
      </aside>
      <main className="tw-main">
        <header className="tw-topbar">
          <div>
            <div className="tw-eyebrow">
              DIGITAL TWIN /{" "}
              {view === "district" ? "DISTRICT SCALE" : "EQUIPMENT SCALE"}
            </div>
            <h1>
              {view === "district" ? "District network" : "Mechanical plant"}
              <span className="tw-beta">REFERENCE TWIN</span>
            </h1>
          </div>
          <div className="tw-top-controls">
            <label>
              Scenario
              <select
                aria-label="Scenario"
                value={twin?.scenario ?? "imbalance"}
                disabled={!!busy || !twin}
                onChange={(e) =>
                  void mutate("reset", { scenario: e.target.value })
                }
              >
                {scenarios.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="tw-time">
              <span>SIMULATION TIME</span>
              <strong>
                {twin?.time.replace("T", " ").slice(0, 16) ?? "Connecting…"}
              </strong>
              <small>UTC+08:00 · revision {twin?.revision ?? "—"}</small>
            </div>
          </div>
        </header>
        <div className="tw-content">
          <div className="tw-session">
            <span>
              <i className="tw-status-dot" />
              {busy || "Paused · all readings simulated"}
            </span>
            <button
              className="tw-button"
              disabled={!!busy || !twin}
              onClick={() => void mutate("advance")}
            >
              Advance +30 min <span>→</span>
            </button>
          </div>
          {error && (
            <div className="tw-alert error" role="alert">
              {error}{" "}
              {!twin && (
                <button onClick={() => void initialise()}>
                  Retry connection
                </button>
              )}
            </div>
          )}
          {notice && (
            <div className="tw-alert" role="status">
              {notice}
            </div>
          )}
          {!twin || !building ? (
            <div className="tw-loading">
              <div className="tw-orbit" />
              <h2>Connecting the network</h2>
              <p>
                Loading the thermal–hydraulic simulation and reference scenes.
              </p>
            </div>
          ) : (
            <>
              <div className="tw-metrics">
                <Metric
                  label="Outdoor conditions"
                  value={fmt(twin.outdoorC)}
                  unit="°C"
                  note={`${fmt(twin.solarWm2, 0)} W/m² solar · ${fmt(twin.windMs)} m/s wind`}
                />
                <Metric
                  label="Secondary supply / return"
                  value={`${fmt(twin.supplyC)} / ${fmt(twin.returnC)}`}
                  unit="°C"
                  note={`ΔT ${fmt(twin.supplyC - twin.returnC)} °C · station boundary`}
                />
                <Metric
                  label="Network circulation"
                  value={fmt(twin.flowM3h)}
                  unit="m³/h"
                  note={`${fmt(twin.pressureKpa)} kPa differential pressure`}
                />
                <Metric
                  label="Delivered building heat"
                  value={fmt(twin.heatKw)}
                  unit="kW"
                  note={`${fmt(twin.pumpKw)} kW aggregate pump power`}
                />
              </div>
              <div className="tw-workbench">
                <section className="tw-visual">
                  <div className="tw-visual-heading">
                    <div>
                      <span className="tw-eyebrow">
                        {view === "district"
                          ? "REFERENCE ESTATE / HS-01"
                          : `HS-01 / LINKED TO ${building.id}`}
                      </span>
                      <h2>
                        {view === "district"
                          ? "One network. Every building in focus."
                          : "Inside the secondary heating station."}
                      </h2>
                    </div>
                    <div className="tw-segment" aria-label="Scene view">
                      {(["district", "mechanical"] as View[]).map((v) => (
                        <button
                          key={v}
                          aria-pressed={view === v}
                          onClick={() => setView(v)}
                        >
                          <Mark name={v} />
                          {v === "district" ? "District" : "Mechanical"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="tw-scene-toolbar">
                    {view === "district" ? (
                      <div className="tw-layers" aria-label="Data overlay">
                        {(["temperature", "flow", "assets"] as Layer[]).map(
                          (l) => (
                            <button
                              key={l}
                              aria-pressed={layer === l}
                              onClick={() => setLayer(l)}
                            >
                              {l === "temperature"
                                ? "Indoor temperature"
                                : l === "flow"
                                  ? "Flow"
                                  : "Asset IDs"}
                            </button>
                          ),
                        )}
                      </div>
                    ) : (
                      <span>
                        STATION ASSEMBLY{" "}
                        <span className="tw-muted">
                          / equipment reference geometry
                        </span>
                      </span>
                    )}
                    <span className="tw-scene-hint">
                      Select an asset to inspect
                    </span>
                  </div>
                  <ReferenceScene
                    key={view}
                    view={view}
                    twin={twin}
                    selectedBuilding={building.id}
                    selectedMechanical={mechanicalId}
                    layer={layer}
                    onBuilding={setBuildingId}
                    onMechanical={setMechanicalId}
                    onView={setView}
                  />
                  <div className="tw-asset-strip" aria-label="Asset selector">
                    {view === "district"
                      ? twin.buildings.map((b) => (
                          <button
                            key={b.id}
                            className={`${tone(b)} ${building.id === b.id ? "selected" : ""}`}
                            aria-label={`Select ${b.id}`}
                            aria-pressed={building.id === b.id}
                            onClick={() => setBuildingId(b.id)}
                          >
                            <i />
                            {b.id}
                          </button>
                        ))
                      : mechanicalAssets.map((a) => (
                          <button
                            key={a.id}
                            className={a.id === mechanicalId ? "selected" : ""}
                            aria-pressed={a.id === mechanicalId}
                            onClick={() => setMechanicalId(a.id)}
                          >
                            {a.id}
                          </button>
                        ))}
                  </div>
                  <div className="tw-bottom-grid">
                    <section className="tw-trend-card">
                      <div className="tw-card-heading">
                        <h3>Network thermal response</h3>
                        <span>{twin.elapsedMinutes} min elapsed</span>
                      </div>
                      <Chart
                        lines={[
                          twin.history.map((h) => h.minimumC),
                          twin.history.map((h) => h.meanC),
                        ]}
                        labels={[
                          "Minimum simulated reading",
                          "Mean simulated reading",
                        ]}
                        startLabel={twin.history[0]?.time ?? "First sample"}
                        endLabel={
                          twin.history.length > 1
                            ? twin.history[twin.history.length - 1].time
                            : ""
                        }
                      />
                      <p className="tw-footnote">
                        {twin.history.length < 2
                          ? "Advance time to build a trace; no interpolated history."
                          : `${twin.history.length} recorded simulator samples · scenario ${twin.scenarioName}`}
                      </p>
                    </section>
                    <section className="tw-action-card">
                      <span className="tw-eyebrow">DECISION SUPPORT</span>
                      <h3>
                        Test the change.
                        <br />
                        Understand the consequence.
                      </h3>
                      <p>
                        Compare five control strategies over three simulated
                        hours, with comfort and energy checks.
                      </p>
                      <button
                        className="tw-primary"
                        onClick={() => {
                          setPanel("compare");
                          setConfirm(false);
                        }}
                      >
                        Compare interventions <span>↗</span>
                      </button>
                    </section>
                  </div>
                </section>
                <aside className="tw-inspector">
                  <div className="tw-inspector-head">
                    <span className="tw-eyebrow">ASSET INSPECTOR</span>
                    <span className="tw-synthetic">SIMULATED</span>
                  </div>
                  {view === "district" ? (
                    <>
                      <div className="tw-asset-title">
                        <div className={`tw-asset-icon ${tone(building)}`}>
                          <Mark name="district" />
                        </div>
                        <div>
                          <h2>{building.id}</h2>
                          <p>{building.zone} branch · residential</p>
                        </div>
                      </div>
                      <div className={`tw-temperature ${tone(building)}`}>
                        <strong>
                          {fmt(building.indoorC)}
                          <small> °C</small>
                        </strong>
                        <span>
                          {building.quality === "suspect"
                            ? "Suspect synthetic reading"
                            : building.indoorC < 20
                              ? "Below display comfort band"
                              : building.indoorC > 23
                                ? "Above display comfort band"
                                : "Within display comfort band"}
                        </span>
                      </div>
                      <p className="tw-footnote">
                        Display band 20–23 °C; not a regulatory compliance
                        assessment.
                      </p>
                      <Row
                        label="Model temperature"
                        value={`${fmt(building.modelC)} °C`}
                      />
                      <Row
                        label="Building heat input"
                        value={`${fmt(building.heatKw)} kW`}
                      />
                      <Row
                        label="Building flow"
                        value={`${fmt(building.flowM3h)} m³/h`}
                      />
                      <Row
                        label="Return temperature"
                        value={`${fmt(building.returnC)} °C`}
                      />
                      <Row
                        label="Heated area"
                        value={`${fmt(building.areaM2, 0)} m²`}
                      />
                      <Row
                        label="Reference archetype"
                        value={`${building.year} · ${building.floors} floors`}
                      />
                      <h3 className="tw-subheading">Branch operating point</h3>
                      {zone && (
                        <>
                          <Row
                            label="Valve position"
                            value={`${fmt(zone.valvePct, 0)} %`}
                          />
                          <Row
                            label="Supply transport delay"
                            value={`${fmt(zone.delayMinutes)} min`}
                          />
                          <Row
                            label="Branch flow"
                            value={`${fmt(zone.flowM3h)} m³/h`}
                          />
                        </>
                      )}
                      <button
                        className="tw-button tw-wide"
                        onClick={() => {
                          setMechanicalId("HEADER");
                          setView("mechanical");
                        }}
                      >
                        Trace to mechanical plant →
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="tw-asset-title">
                        <div className="tw-asset-icon">
                          <Mark name="mechanical" />
                        </div>
                        <div>
                          <h2>{asset.id}</h2>
                          <p>{asset.name}</p>
                        </div>
                      </div>
                      <div className="tw-scope-note">
                        <strong>
                          {asset.scope === "geometry"
                            ? "Reference geometry only"
                            : "Station-level simulation"}
                        </strong>
                        <p>
                          {asset.scope === "geometry"
                            ? "This item is not individually resolved by the model. No equipment-specific readings or condition claims are available."
                            : "These readings describe the aggregate station boundary, not individual pump or header sensors."}
                        </p>
                      </div>
                      <h3 className="tw-subheading">
                        Station boundary · simulated
                      </h3>
                      <Row
                        label="Supply / return"
                        value={`${fmt(twin.supplyC)} / ${fmt(twin.returnC)} °C`}
                      />
                      <Row
                        label="Total circulation"
                        value={`${fmt(twin.flowM3h)} m³/h`}
                      />
                      <Row
                        label="Pump set frequency"
                        value={`${fmt(twin.pumpHz)} Hz`}
                      />
                      <Row
                        label="Aggregate pump power"
                        value={`${fmt(twin.pumpKw)} kW`}
                      />
                      <Row
                        label="Differential pressure"
                        value={`${fmt(twin.pressureKpa)} kPa`}
                      />
                      <h3 className="tw-subheading">Distribution branches</h3>
                      <div className="tw-branches">
                        {twin.zones.map((z) => (
                          <button
                            key={z.id}
                            onClick={() => {
                              if (building.zone !== z.id)
                                setBuildingId(
                                  twin.buildings.find((b) => b.zone === z.id)
                                    ?.id ?? building.id,
                                );
                              setView("district");
                            }}
                          >
                            <span>
                              <strong>{z.id}</strong>
                              <small>
                                {fmt(z.flowM3h)} m³/h · valve{" "}
                                {fmt(z.valvePct, 0)}%
                              </small>
                            </span>
                            <span>↗</span>
                          </button>
                        ))}
                      </div>
                      <p className="tw-footnote">
                        Linked building: {building.id}. Switching views does not
                        advance or reset the simulation.
                      </p>
                    </>
                  )}
                  <div className="tw-diagnostic">
                    <div className="tw-card-heading">
                      <h3>
                        <Mark name="investigate" /> Diagnostic evidence
                      </h3>
                      <span>r{diagnosis?.revision ?? "—"}</span>
                    </div>
                    <strong>
                      {findings[0]?.title ??
                        (diagnosis
                          ? "Network checks available"
                          : "Loading diagnostics")}
                    </strong>
                    <p>
                      {findings[0]?.evidence ??
                        diagnosis?.summary ??
                        "Waiting for the simulator response."}
                    </p>
                    <button
                      className="tw-button tw-wide"
                      onClick={() => setPanel("investigate")}
                    >
                      Investigate {building.id} ↗
                    </button>
                  </div>
                </aside>
              </div>
              <footer className="tw-page-footer">
                <span>
                  AI-generated scenes · illustrative asset locations · no live
                  SCADA connection
                </span>
                <button onClick={() => setPanel("evidence")}>
                  Model scope & provenance ↗
                </button>
              </footer>
            </>
          )}
        </div>
      </main>
      {panel && (
        <Modal
          title={
            panel === "compare"
              ? "Intervention comparison"
              : panel === "investigate"
                ? "AI investigation"
                : "Model scope & evidence"
          }
          onClose={() => {
            setPanel(null);
            setConfirm(false);
          }}
        >
          {error && (
            <div className="tw-alert error" role="alert">
              {error}
            </div>
          )}
          {busy && <p role="status">{busy}…</p>}
          {notice && (
            <div className="tw-alert" role="status">
              {notice}
            </div>
          )}
          {panel === "compare" && (
            <>
              <p>
                Five bounded strategies, evaluated over three simulated hours.
                Verification is a model check—not commissioning approval or a
                field safety guarantee.
              </p>
              <button
                className="tw-primary"
                disabled={!!busy || !twin}
                onClick={() => void compare()}
              >
                Run comparison
              </button>
              {comparison && (
                <>
                  <div className="tw-card-heading">
                    <h3>Candidate outcomes</h3>
                    <span>Snapshot revision {comparison.revision}</span>
                  </div>
                  <div className="tw-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Strategy</th>
                          <th>Heat / kWh</th>
                          <th>Pump / kWh</th>
                          <th>Minimum / °C</th>
                          <th>Model check</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.candidates.map((c) => (
                          <tr
                            key={c.id}
                            className={
                              selectedCandidate?.id === c.id ? "selected" : ""
                            }
                          >
                            <td>
                              <button
                                aria-pressed={selectedCandidate?.id === c.id}
                                onClick={() => {
                                  setCandidateId(c.id);
                                  setConfirm(false);
                                }}
                              >
                                {c.label}
                                {comparison.recommendation?.id === c.id
                                  ? " · recommended"
                                  : ""}
                              </button>
                            </td>
                            <td>{fmt(c.heatKwh)}</td>
                            <td>{fmt(c.pumpKwh)}</td>
                            <td>{fmt(c.minimumC, 2)}</td>
                            <td>{c.verified ? "Pass" : "Reject"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedCandidate && (
                    <>
                      <h3>
                        {selectedCandidate.label} · predicted minimum
                        temperature
                      </h3>
                      <Chart
                        lines={[
                          comparison.baseline.trace.map((t) => t.minimumC),
                          selectedCandidate.trace.map((t) => t.minimumC),
                        ]}
                        labels={["Hold baseline", selectedCandidate.label]}
                        startLabel={`+${selectedCandidate.trace[0]?.minutes ?? 30} min`}
                        endLabel={`+${selectedCandidate.trace[selectedCandidate.trace.length - 1]?.minutes ?? 180} min`}
                      />
                      <p className="tw-footnote">
                        Prediction horizon: three hours, sampled every 30
                        minutes. Not an observed trend.
                      </p>
                      <p>{selectedCandidate.verification}</p>
                      <Row
                        label="Proposed supply / pump"
                        value={`${fmt(selectedCandidate.controls.supplyC)} °C / ${fmt(selectedCandidate.controls.pumpHz)} Hz`}
                      />
                      <Row
                        label="Proposed branch valves"
                        value={selectedCandidate.controls.valvesPct
                          .map((v) => `${fmt(v, 0)}%`)
                          .join(" / ")}
                      />
                    </>
                  )}
                  <p className="tw-footnote">
                    Objective: {comparison.objective}
                  </p>
                  {comparison.recommendation?.candidateId &&
                    comparison.revision === twin?.revision &&
                    (!confirm ? (
                      <button
                        className="tw-primary"
                        disabled={!!busy}
                        onClick={() => setConfirm(true)}
                      >
                        Review recommended change
                      </button>
                    ) : (
                      <div className="tw-confirm">
                        <h3>
                          Apply {comparison.recommendation.label} to the
                          simulator?
                        </h3>
                        <p>
                          Supply{" "}
                          {fmt(comparison.recommendation.controls.supplyC)} °C;
                          pump {fmt(comparison.recommendation.controls.pumpHz)}{" "}
                          Hz; branch valves{" "}
                          {comparison.recommendation.controls.valvesPct
                            .map((v) => `${fmt(v, 0)}%`)
                            .join(" / ")}
                          . This advances the simulation by 30 minutes and
                          invalidates this comparison. No physical plant will be
                          controlled.
                        </p>
                        <button
                          className="tw-primary"
                          disabled={!!busy}
                          onClick={() => void apply(comparison.recommendation!)}
                        >
                          Confirm simulated change
                        </button>
                        <button
                          className="tw-button"
                          disabled={!!busy}
                          onClick={() => setConfirm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                </>
              )}
            </>
          )}
          {panel === "investigate" && (
            <>
              <div className="tw-scope-note">
                <strong>
                  Investigation context: {building?.id} · {building?.zone}{" "}
                  branch
                </strong>
                <p>
                  Deterministic checks below are available without AI. The
                  optional AI agent uses server-side tools and requires the
                  deployment access code. It cannot directly control field
                  equipment.
                </p>
              </div>
              <h3>Deterministic findings</h3>
              {(findings.length ? findings : (diagnosis?.findings ?? [])).map(
                (f) => (
                  <article className="tw-finding" key={f.id}>
                    <span className="tw-eyebrow">
                      {f.asset} / {f.severity}
                    </span>
                    <h3>{f.title}</h3>
                    <p>{f.evidence}</p>
                    <p>
                      <strong>Check:</strong> {f.action}
                    </p>
                    <small>{f.certainty}</small>
                  </article>
                ),
              )}
              <label className="tw-field">
                Investigation question
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                />
              </label>
              <label className="tw-field">
                Deployment AI access code
                <input
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  autoComplete="off"
                  placeholder="Not your OpenRouter API key"
                />
              </label>
              <button
                className="tw-primary"
                disabled={
                  !!busy ||
                  !config?.aiConfigured ||
                  !question.trim() ||
                  !twin ||
                  !accessCode.trim()
                }
                onClick={() =>
                  void run(
                    "Running tool-grounded AI investigation",
                    async () => {
                      const contextId = building?.id ?? "";
                      const result = await api<Answer>(
                        "agent",
                        { question, buildingId: contextId },
                        accessCode,
                      );
                      setAnswerBuildingId(contextId);
                      setAnswer(result);
                    },
                  )
                }
              >
                Run AI investigation
              </button>
              <p className="tw-footnote">
                {config?.aiConfigured
                  ? `Provider model: ${config.model}. This action may incur provider usage charges.`
                  : "AI provider is not configured on the server. Deterministic simulation remains available."}
              </p>
              {answer && (
                <article className="tw-answer">
                  <h3>
                    Investigation response · {answerBuildingId}{" "}
                    {staleAnswer ? "· different asset or stale snapshot" : ""}
                  </h3>
                  <p className="tw-preserve">{answer.answer}</p>
                  {answer.narrativeWithheld && (
                    <p>
                      Narrative withheld; inspect the structured tool evidence
                      below.
                    </p>
                  )}
                  {answer.evidence && (
                    <>
                      <h3>
                        Authoritative tool evidence · r
                        {answer.evidence.revision}
                      </h3>
                      <p>{answer.evidence.note}</p>
                      <pre>{JSON.stringify(answer.evidence.rows, null, 2)}</pre>
                    </>
                  )}
                  {answer.trace.map((t, i) => (
                    <details key={i}>
                      <summary>{t.tool}</summary>
                      <pre>{JSON.stringify(t.result, null, 2)}</pre>
                    </details>
                  ))}
                </article>
              )}
            </>
          )}
          {panel === "evidence" && (
            <>
              <div className="tw-scope-note">
                <strong>
                  Reference imagery first. Genuine spatial twin later.
                </strong>
                <p>
                  The district and mechanical scenes are AI-generated raster
                  images with illustrative screen-space hotspots. They are not
                  orbitable geometry, surveyed coordinates, as-built CAD/BIM,
                  manufacturer-certified assemblies or evidence of pipe
                  connectivity. Zoom enlarges the image; it does not reveal new
                  geometry.
                </p>
              </div>
              <h3>What is actually calculated</h3>
              <p>
                Readings and interventions come from the existing
                thermal–hydraulic simulator: twelve building archetypes and
                three distribution branches. Equipment drawings do not add
                equipment-level physics. The reference estate is not a real
                connected heating network.
              </p>
              <h3>Model assumptions</h3>
              <ul>
                {twin?.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
              <Row
                label="Hydraulic solver residual"
                value={twin?.solverResidual.toExponential(3) ?? "—"}
              />
              <Row
                label="Energy residual"
                value={twin?.energyResidual.toExponential(3) ?? "—"}
              />
              <h3>To become an as-built digital twin</h3>
              <p>
                Import surveyed GIS and BIM/CAD geometry, reconcile persistent
                asset IDs and pipe topology, connect validated field telemetry,
                and calibrate the physical model against measured operation.
                This requires site data; photorealism alone is not precision.
              </p>
              <button
                className="tw-primary"
                disabled={!twin || !!busy}
                onClick={exportEvidence}
              >
                Export simulation evidence
              </button>
              <h3>Research sources</h3>
              <div className="tw-source-list">
                {config?.sources.map((s) => (
                  <article key={s.id}>
                    <span className="tw-eyebrow">
                      {s.publisher} · {s.date}
                    </span>
                    <h3>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title} ↗
                      </a>
                    </h3>
                    <p>{s.finding}</p>
                    <small>Design implication: {s.design}</small>
                  </article>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
