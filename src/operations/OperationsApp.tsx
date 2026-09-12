import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api, fmt, tone } from "./types";
import type {
  Answer,
  Building,
  Comparison,
  Config,
  Diagnosis,
  Twin,
} from "./types";
import "./operations.css";
const DistrictScene = lazy(() => import("./DistrictScene"));

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    twin: (
      <>
        <path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10" />
        <path d="m7.5 4.5 9 5v5" />
      </>
    ),
    investigate: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6M7 10h6M10 7v6" />
      </>
    ),
    lab: (
      <>
        <path d="M9 3h6M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M8 15h8" />
      </>
    ),
    evidence: (
      <>
        <path d="M5 3h11l3 3v15H5zM15 3v5h4M8 12h8M8 16h6" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    weather: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M19 5l-1 1M6 18l-1 1" />
      </>
    ),
    heat: (
      <>
        <path d="M8 3c-5 6 5 7 0 13m5-13c-5 6 5 7 0 13m5-13c-5 6 5 7 0 13M4 21h16" />
      </>
    ),
    flow: (
      <>
        <path d="M3 7h17l-4-4M21 17H4l4 4M3 12h18" />
      </>
    ),
    temp: (
      <>
        <path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z" />
        <path d="M12 9v9" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6l4 2" />
      </>
    ),
    reset: (
      <>
        <path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.twin}
    </svg>
  );
}
const scenarios = [
  ["imbalance", "01", "Hydraulic imbalance", "Warm near-zone. Cold far-zone."],
  [
    "warming",
    "02",
    "Sunrise demand drop",
    "Less demand. Heat still in transit.",
  ],
  ["cold", "03", "Cold-front resilience", "Capacity under severe weather."],
  [
    "sensor",
    "04",
    "Sensor disagreement",
    "A cold reading is not always a cold room.",
  ],
  [
    "window",
    "05",
    "Local heat loss",
    "A building problem, or a network problem?",
  ],
];
function Trend({ twin }: { twin: Twin }) {
  const data = twin.history,
    lo = Math.floor(Math.min(17, ...data.map((d) => d.minimumC))),
    hi = Math.ceil(Math.max(24, ...data.map((d) => d.meanC)));
  const x = (i: number) => 42 + (i / Math.max(data.length - 1, 1)) * 660;
  const y = (v: number) => 116 - ((v - lo) / (hi - lo)) * 94;
  return (
    <div className="trend-wrap">
      <svg
        viewBox="0 0 730 151"
        role="img"
        aria-label="Simulated minimum and mean building temperatures over this session"
      >
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line
              x1="42"
              y1={y(v)}
              x2="708"
              y2={y(v)}
              stroke="#2b3a41"
              strokeDasharray="3 5"
            />
            <text x="0" y={y(v) + 4}>
              {fmt(v, 0)}°
            </text>
          </g>
        ))}
        <line
          x1="42"
          x2="708"
          y1={y(18)}
          y2={y(18)}
          stroke="#99764c"
          strokeDasharray="4 4"
        />
        <polyline
          points={data.map((d, i) => `${x(i)},${y(d.meanC)}`).join(" ")}
          fill="none"
          stroke="#70d4bd"
          strokeWidth="2"
        />
        <polyline
          points={data.map((d, i) => `${x(i)},${y(d.minimumC)}`).join(" ")}
          fill="none"
          stroke="#76bfff"
          strokeWidth="2"
        />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.minimumC)} r="3" fill="#76bfff">
              <title>
                {d.time}: minimum {fmt(d.minimumC)}°C; mean {fmt(d.meanC)}°C
              </title>
            </circle>
            {(i === 0 || i === data.length - 1) && (
              <text x={x(i)} y="144" textAnchor={i ? "end" : "start"}>
                {d.time}
              </text>
            )}
          </g>
        ))}
        {data.length === 1 && (
          <text x="375" y="58" textAnchor="middle">
            Advance the simulation to build a simulated trajectory.
          </text>
        )}
      </svg>
    </div>
  );
}
function Inspector({
  building: b,
  twin,
  investigate,
}: {
  building: Building;
  twin: Twin;
  investigate: () => void;
}) {
  const z = twin.zones.find((z) => z.id === b.zone)!;
  return (
    <>
      <div className="inspector-title">
        <span className="eyebrow">SELECTED ASSET</span>
        <span className={"dot " + tone(b)} />
      </div>
      <div className="building-title">
        <div>
          <h2>Building {b.id.slice(1)}</h2>
          <span>{b.zone} branch · residential</span>
        </div>
        <span className="asset-code">{b.id}</span>
      </div>
      <div className={"temperature-readout " + tone(b)}>
        <strong>
          {fmt(b.indoorC)}
          <small>°C</small>
        </strong>
        <span>
          {b.quality === "suspect"
            ? "Suspect synthetic reading"
            : "Simulated indoor temperature"}
        </span>
      </div>
      <div className="comfort-scale">
        <span />
        <i
          style={{
            left:
              Math.min(98, Math.max(2, ((b.indoorC - 16) / 10) * 100)) + "%",
          }}
        />
      </div>
      <div className="scale-labels">
        <span>16°</span>
        <span>20–23° demo comfort band</span>
        <span>26°</span>
      </div>
      {b.quality === "suspect" && (
        <div className="inline-note violet">
          Model state: {fmt(b.modelC)}°C. The −3.2°C sensor bias is an injected
          fault, not a learned detection.
        </div>
      )}
      <dl className="asset-metrics">
        <div>
          <dt>Heat delivery</dt>
          <dd>
            {fmt(b.heatKw)} <small>kW</small>
          </dd>
        </div>
        <div>
          <dt>Building flow</dt>
          <dd>
            {fmt(b.flowM3h)} <small>m³/h</small>
          </dd>
        </div>
        <div>
          <dt>Return water</dt>
          <dd>
            {fmt(b.returnC)} <small>°C</small>
          </dd>
        </div>
        <div>
          <dt>Branch delay</dt>
          <dd>
            {fmt(z.delayMinutes)} <small>min</small>
          </dd>
        </div>
      </dl>
      <div className="small-heading">
        Building energy balance <span>kW</span>
      </div>
      {[
        ["Delivered heat", b.heatKw, "mint"],
        ["Envelope loss", b.envelopeKw, "amber"],
        ["Extra ventilation", b.windowKw, "blue"],
      ].map(([label, value, colour]) => (
        <div className="energy-row" key={String(label)}>
          <div>
            <span>{label}</span>
            <b>{fmt(Number(value))}</b>
          </div>
          <div className="bar-track">
            <i
              className={String(colour)}
              style={{
                width:
                  Math.min(
                    100,
                    (Number(value) / Math.max(b.heatKw, b.envelopeKw, 1)) * 100,
                  ) + "%",
              }}
            />
          </div>
        </div>
      ))}
      <p className="asset-foot">
        {fmt(b.areaM2, 0)} m² · {b.floors} floors · {b.year} archetype
        <br />
        Aggregate model; not a representative sample of flats.
      </p>
      <button className="button primary wide" onClick={investigate}>
        <Icon name="investigate" size={17} /> Investigate this building{" "}
        <Icon name="arrow" size={16} />
      </button>
    </>
  );
}
function NumericalEvidence({
  answer,
  revision,
}: {
  answer: Answer;
  revision: number;
}) {
  const evidence = answer.evidence;
  if (!evidence) return null;
  return (
    <section className="authoritative-evidence">
      <span className="eyebrow">SOLVER OUTPUT · NOT GENERATED BY AI</span>
      <h3>{evidence.recommendation}</h3>
      {revision !== evidence.revision && (
        <p className="amber">
          Historical evidence · revision {evidence.revision}
        </p>
      )}
      {evidence.rows.map((row) => (
        <div key={row.label}>
          <h4>{row.label}</h4>
          {evidence.kind === "comparison" ? (
            <dl>
              <dt>Heat over 3 h</dt>
              <dd>{fmt(row.heatKwh!, 2)} kWh</dd>
              <dt>Pump over 3 h</dt>
              <dd>{fmt(row.pumpKwh!, 2)} kWh</dd>
              <dt>Lowest over entire trajectory</dt>
              <dd>{fmt(row.minimumC!, 2)}°C</dd>
              <dt>Minimum at end of 3 h</dt>
              <dd>{fmt(row.endMinimumC!, 2)}°C</dd>
              <dt>Demo floor</dt>
              <dd>{row.verified ? "Passed" : "Rejected"}</dd>
            </dl>
          ) : (
            <dl>
              <dt>Supply / return</dt>
              <dd>
                {fmt(row.supplyC!)} / {fmt(row.returnC!)}°C
              </dd>
              <dt>Minimum reading</dt>
              <dd>{fmt(row.minimumReadingC!, 2)}°C</dd>
            </dl>
          )}
        </div>
      ))}
      <p>{evidence.note}</p>
    </section>
  );
}
export default function OperationsApp() {
  const [twin, setTwin] = useState<Twin | null>(null),
    [config, setConfig] = useState<Config | null>(null);
  const [section, setSection] = useState("twin"),
    [selected, setSelected] = useState("B10"),
    [layer, setLayer] = useState("thermal"),
    [camera, setCamera] = useState(0);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [playing, setPlaying] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null),
    [comparison, setComparison] = useState<Comparison | null>(null);
  const [question, setQuestion] = useState(
    "Why are far-zone buildings cold, and is balancing better than raising supply temperature?",
  );
  const [accessCode, setAccessCode] = useState(""),
    [answer, setAnswer] = useState<Answer | null>(null),
    [rightTab, setRightTab] = useState("asset");
  const [confirm, setConfirm] = useState(false),
    [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  async function run(label: string, fn: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setPlaying(false);
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }
  async function refreshDiagnosis() {
    setDiagnosis(await api<Diagnosis>("diagnose", { buildingId: selected }));
  }
  useEffect(() => {
    void run("Connecting to physical twin", async () => {
      const c = await fetch("/api/config");
      if (!c.ok) throw new Error("Server configuration is unavailable.");
      setConfig(await c.json());
      setTwin(await api<Twin>("state"));
      await refreshDiagnosis();
    });
  }, []);
  useEffect(() => {
    if (!playing || busy) return;
    const timer = window.setTimeout(() => {
      void advance();
    }, 4500);
    return () => clearTimeout(timer);
  }, [playing, busy, twin?.revision]);
  const advance = () =>
    run("Advancing 30 simulated minutes", async () => {
      setTwin(await api<Twin>("advance"));
      setComparison(null);
      setConfirm(false);
      await refreshDiagnosis();
    });
  const reset = (scenario: string) => {
    setPlaying(false);
    setConfirm(false);
    void run("Initialising scenario", async () => {
      setTwin(await api<Twin>("reset", { scenario }));
      setComparison(null);
      setAnswer(null);
      setNotice("");
      await refreshDiagnosis();
    });
  };
  const compare = () => {
    setPlaying(false);
    setConfirm(false);
    void run("Running five nonlinear 3-hour comparisons", async () => {
      setComparison(await api<Comparison>("compare"));
    });
  };
  const investigate = () => {
    setPlaying(false);
    setSection("investigate");
    setRightTab("agent");
    setQuestion(
      `Investigate ${selected}: distinguish hydraulic imbalance, local heat loss and measurement error. Use current evidence and compare interventions before recommending an action.`,
    );
  };
  const ask = () => {
    setPlaying(false);
    void run("AI is inspecting evidence and running tools", async () => {
      setAnswer(
        await api<Answer>(
          "agent",
          { question, buildingId: selected },
          accessCode,
        ),
      );
    });
  };
  const apply = () => {
    void run("Re-verifying and applying to this simulation", async () => {
      const value = await api<Twin>("apply", {
        candidateId: comparison?.recommendation?.candidateId,
      });
      setTwin(value);
      setComparison(null);
      setConfirm(false);
      await refreshDiagnosis();
      setNotice(
        "Verified controls applied to this simulation only. The twin has advanced 30 minutes.",
      );
    });
  };
  const exportEvidence = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            scope: "Synthetic research twin; no real plant measurements",
            twin,
            diagnosis,
            comparison,
            answer,
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
    a.download = "heatpilot-evidence.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!twin)
    return (
      <div className="boot">
        <div className="brand-mark">
          <Icon name="heat" size={30} />
        </div>
        <h1>
          heatpilot<span> / thermal intelligence</span>
        </h1>
        <p>{error || busy || "Starting the district twin…"}</p>
        {error && (
          <button className="button" onClick={() => location.reload()}>
            Retry connection
          </button>
        )}
      </div>
    );
  const b = twin.buildings.find((b) => b.id === selected)!;
  const cold = twin.buildings.filter((b) => b.indoorC < 20).length;
  const comfort = twin.buildings.filter(
    (b) => b.indoorC >= 20 && b.indoorC <= 23 && b.quality !== "suspect",
  ).length;
  const nav = [
    ["twin", "Digital twin", "twin"],
    ["investigate", "Investigations", "investigate"],
    ["lab", "Scenario lab", "lab"],
    ["evidence", "Research & evidence", "evidence"],
  ];
  const agentPanel = (
    <div className="agent-panel">
      <div className="agent-heading">
        <span className="agent-symbol">
          <Icon name="spark" />
        </span>
        <div>
          <h3>Operations copilot</h3>
          <span>
            {config?.aiConfigured
              ? "OpenRouter · tool-enabled"
              : "Configure server to enable AI"}
          </span>
        </div>
      </div>
      <p>
        Ask a question. Inspect the numerical tools it used. Nothing is applied
        automatically.
      </p>
      <label className="field-label" htmlFor="access-code">
        Operator AI access code
      </label>
      <input
        id="access-code"
        type="password"
        autoComplete="off"
        placeholder="Separate from your API key"
        value={accessCode}
        onChange={(e) => setAccessCode(e.target.value)}
      />
      <label className="field-label" htmlFor="agent-question">
        Investigation question
      </label>
      <textarea
        id="agent-question"
        maxLength={1800}
        rows={5}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <div className="suggestions">
        <button
          onClick={() =>
            setQuestion(
              `Check ${selected} for sensor disagreement. What evidence is missing?`,
            )
          }
        >
          Check sensor
        </button>
        <button
          onClick={() =>
            setQuestion(
              "Compare flow redistribution and a supply-temperature increase over the next three hours. Explain comfort and energy trade-offs.",
            )
          }
        >
          Test alternatives
        </button>
      </div>
      <button
        className="button primary wide"
        disabled={
          !!busy ||
          !config?.aiConfigured ||
          question.trim().length < 3 ||
          !accessCode
        }
        onClick={ask}
      >
        <Icon name="spark" size={17} />
        {busy.includes("AI") ? "Investigating…" : "Run AI investigation"}
        <Icon name="arrow" size={16} />
      </button>
      <small className="privacy-note">
        Your question and synthetic telemetry go to OpenRouter and its selected
        provider. Do not enter resident or confidential plant data.
      </small>
      {!config?.aiConfigured && (
        <div className="inline-note">
          Set OPENROUTER_API_KEY and AI_ACCESS_TOKEN on the server. Numerical
          diagnostics and scenario comparisons do not require AI.
        </div>
      )}
      {answer && <NumericalEvidence answer={answer} revision={twin.revision} />}
      {answer && (
        <div className="agent-answer">
          <div className="small-heading">
            Investigation result <span>rev {answer.revision}</span>
          </div>
          {answer.revision !== twin.revision && (
            <div className="inline-note amber">
              Historical answer: the simulation has changed. Investigate again
              for current advice.
            </div>
          )}
          <div className="answer-text">{answer.answer}</div>
          <div className="tool-trace">
            <span className="eyebrow">EXECUTED TOOL EVIDENCE</span>
            {answer.trace.map((t, i) => (
              <details key={i}>
                <summary>
                  <Icon name="check" size={14} />
                  {t.tool.split("_").join(" ")}
                </summary>
                <pre>{JSON.stringify(t.result, null, 2)}</pre>
              </details>
            ))}
          </div>
          <small>
            {answer.model} · {fmt(answer.totalTokens, 0)} tokens · advisory only
          </small>
        </div>
      )}
    </div>
  );
  return (
    <div className="heatpilot-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Icon name="heat" size={25} />
          </span>
          <span>
            heatpilot<i>THERMAL INTELLIGENCE</i>
          </span>
        </a>
        <div className="workspace-label">OPERATIONS WORKSPACE</div>
        <nav>
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              aria-label={label}
              className={section === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setSection(id);
                setConfirm(false);
              }}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {id === "investigate" && (
                <em>{diagnosis?.findings.length || 0}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-site">
          <span className="eyebrow">ACTIVE NETWORK</span>
          <strong>North China residential</strong>
          <span>Secondary heating network</span>
          <div>
            <i className="status-dot" /> Synthetic research twin
          </div>
        </div>
        <div className="sidebar-bottom">
          <a href="/legacy">
            <Icon name="evidence" size={17} /> Original research dashboard ↗
          </a>
          <span className="version">P1A physical core · Operations v0.2</span>
          <div className="operator">
            <span>OP</span>
            <div>
              Research operator<small>Simulation-only permissions</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> North China <span>/</span>{" "}
            <strong>Secondary network</strong>
          </div>
          <div className="topbar-right">
            <span className="simulation-tag">
              <i /> SIMULATION
            </span>
            <span className="top-weather">
              <Icon name="weather" size={16} />
              {fmt(twin.outdoorC)}°C outdoors
            </span>
            <span className="avatar">OP</span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                DISTRICT HEATING · 中国居民供热二次网
              </div>
              <h1>
                {section === "twin"
                  ? "Every building. One connected network."
                  : section === "investigate"
                    ? "From a cold reading to a tested decision."
                    : section === "lab"
                      ? "Test the next move. Before you make it."
                      : "Evidence behind the intelligence."}
              </h1>
              <p>
                {section === "twin"
                  ? "A physics-backed view of comfort, flow and the heat still on its way."
                  : section === "investigate"
                    ? "Separate symptoms, plausible causes and the measurements still needed."
                    : section === "lab"
                      ? "Five operating scenarios. Real numerical rollouts. Explicit model limits."
                      : "Primary sources and an honest boundary between this prototype and field-ready operation."}
              </p>
            </div>
            <button className="button export-button" onClick={exportEvidence}>
              <Icon name="evidence" size={16} /> Export evidence
            </button>
          </div>
          {error && (
            <div className="banner error" role="alert">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="banner success" role="status">
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          <div className="metrics-grid">
            <div className="metric">
              <div className="metric-label">
                Delivered heat <Icon name="heat" />
              </div>
              <strong>
                {fmt(twin.heatKw, 0)} <small>kW</small>
              </strong>
              <div>
                <span className="mint">{fmt(twin.loadKw, 0)} kW</span>{" "}
                calculated demand
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">
                Supply / return <Icon name="temp" />
              </div>
              <strong>
                {fmt(twin.supplyC)} <span className="metric-divider">/</span>{" "}
                {fmt(twin.returnC)}
                <small> °C</small>
              </strong>
              <div>
                <span className="amber">
                  ΔT {fmt(twin.supplyC - twin.returnC)}°C
                </span>{" "}
                at the substation
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">
                Network circulation <Icon name="flow" />
              </div>
              <strong>
                {fmt(twin.flowM3h)} <small>m³/h</small>
              </strong>
              <div>
                {fmt(twin.pumpHz, 0)} Hz pump{" "}
                <span className="dot-separator">·</span> {fmt(twin.pumpKw, 2)}{" "}
                kW electric
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">
                Buildings in comfort band <Icon name="twin" />
              </div>
              <strong>
                {comfort}
                <small> / 12</small>
              </strong>
              <div>
                <span className={cold ? "blue" : "mint"}>
                  {cold} below 20°C
                </span>{" "}
                · simulated aggregate temperatures
              </div>
            </div>
          </div>
          <div className="session-bar">
            <div>
              <Icon name="clock" size={16} />
              <strong>{twin.time.slice(11, 16)}</strong>
              <span>15 Jan 2025 · synthetic winter day</span>
              <i /> rev {twin.revision}
            </div>
            <div>
              <label className="sr-only" htmlFor="scenario">
                Operating scenario
              </label>
              <select
                id="scenario"
                value={twin.scenario}
                disabled={!!busy}
                onChange={(e) => reset(e.target.value)}
              >
                {scenarios.map(([id, , name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                className="button icon-button"
                disabled={!!busy}
                aria-label="Reset current scenario"
                onClick={() => reset(twin.scenario)}
              >
                <Icon name="reset" size={15} />
              </button>
              <button
                className="button"
                disabled={!!busy}
                onClick={() => {
                  if (playing) setPlaying(false);
                  else {
                    setComparison(null);
                    setConfirm(false);
                    setPlaying(true);
                  }
                }}
              >
                {playing ? "Ⅱ Pause" : "▷ Play"}
              </button>
              <button
                className="button"
                disabled={!!busy || playing}
                onClick={() => void advance()}
              >
                +30 min
              </button>
            </div>
          </div>
          <div className="busy-line" role="status">
            {busy ? (
              <>
                <span className="spinner" />
                {busy}
              </>
            ) : playing ? (
              "Accelerated simulation: 30 minutes every 4.5 seconds. Not wall-clock telemetry."
            ) : (
              "Paused · each step solves six 5-minute physical substeps"
            )}
          </div>
          {section === "evidence" ? (
            <div className="evidence-layout">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Industrial research register</h2>
                  <span className="subtle">Cut-off: 12 Sep 2026</span>
                </div>
                <div className="source-list">
                  {config?.sources.map((s, i) => (
                    <article key={s.id}>
                      <span className="source-number">0{i + 1}</span>
                      <div>
                        <div className="eyebrow">
                          {s.publisher} · {s.date}
                        </div>
                        <h3>
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.title} ↗
                          </a>
                        </h3>
                        <p>{s.finding}</p>
                        <p className="design-implication">
                          Product implication: {s.design}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <aside className="panel evidence-boundary">
                <span className="eyebrow">MODEL CONTRACT</span>
                <h2>Know what this twin knows.</h2>
                {twin.assumptions.map((a) => (
                  <p key={a}>
                    <Icon name="check" size={16} />
                    {a}
                  </p>
                ))}
                <div className="divider" />
                <h3>Numerical health</h3>
                <dl className="asset-metrics">
                  <div>
                    <dt>Hydraulic residual</dt>
                    <dd>{twin.solverResidual.toExponential(2)}</dd>
                  </div>
                  <div>
                    <dt>Energy residual</dt>
                    <dd>{twin.energyResidual.toExponential(2)}</dd>
                  </div>
                </dl>
                <p className="small-copy">
                  Small numerical residuals verify equation consistency, not
                  accuracy against a real estate. Calibration, sensor coverage
                  and independent field validation remain necessary.
                </p>
                <button className="button wide" onClick={exportEvidence}>
                  Download this session’s evidence
                </button>
              </aside>
            </div>
          ) : (
            <div className="operations-grid">
              <div className="primary-column">
                {section === "twin" && (
                  <section className="panel twin-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          Residential district twin{" "}
                          <span className="mini-tag">3D</span>
                        </h2>
                        <span className="subtle">
                          12 buildings · 3 parallel branches · 1 substation
                        </span>
                      </div>
                      <div className="segmented" aria-label="3D data layer">
                        {[
                          ["thermal", "Thermal"],
                          ["flow", "Flow"],
                          ["quality", "Sensors"],
                        ].map(([id, label]) => (
                          <button
                            aria-pressed={layer === id}
                            className={layer === id ? "active" : ""}
                            key={id}
                            onClick={() => setLayer(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="scene-container">
                      <Suspense
                        fallback={
                          <div className="scene-loading">
                            Preparing the district model…
                          </div>
                        }
                      >
                        <DistrictScene
                          twin={twin}
                          selected={selected}
                          onSelect={setSelected}
                          layer={layer}
                          view={camera}
                        />
                      </Suspense>
                      <div className="scene-caption">
                        <i className="status-dot" /> SCHEMATIC ESTATE{" "}
                        <span>Geometry is illustrative · not GIS/BIM</span>
                      </div>
                      <div className="scene-controls">
                        <button
                          className="button"
                          onClick={() => setCamera((v) => v + 1)}
                        >
                          {camera % 2 ? "↗ Isometric" : "⊞ Top view"}
                        </button>
                        <button
                          className="button"
                          onClick={() =>
                            setCamera((v) => (v % 2 ? v + 1 : v + 2))
                          }
                        >
                          Reset view
                        </button>
                      </div>
                      <div className="scene-legend">
                        <span>
                          <i className="legend-line supply" /> Supply
                        </span>
                        <span>
                          <i className="legend-line return" /> Return
                        </span>
                        <span className="scene-hint">
                          Drag to orbit · scroll to zoom · click to inspect
                        </span>
                      </div>
                    </div>
                    <div className="asset-strip" aria-label="Select a building">
                      {twin.buildings.map((b) => (
                        <button
                          key={b.id}
                          className={`${tone(b)} ${selected === b.id ? "selected" : ""}`}
                          onClick={() => setSelected(b.id)}
                          aria-pressed={selected === b.id}
                        >
                          <span>{b.id}</span>
                          <strong>{fmt(b.indoorC)}°</strong>
                        </button>
                      ))}
                    </div>
                    <div className="branch-row">
                      {twin.zones.map((z) => (
                        <div key={z.id}>
                          <span className="branch-dot" />
                          <strong>{z.id} branch</strong>
                          <span>{fmt(z.valvePct, 0)}% valve</span>
                          <span>{fmt(z.delayMinutes)} min delay</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {section === "investigate" && (
                  <section className="panel findings-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          Diagnostic queue{" "}
                          <span className="mini-tag">
                            {diagnosis?.findings.length || 0}
                          </span>
                        </h2>
                        <span className="subtle">
                          Numerical rules · not AI-generated alarms
                        </span>
                      </div>
                      <button
                        className="button"
                        disabled={!!busy}
                        onClick={() =>
                          void run("Refreshing diagnostics", refreshDiagnosis)
                        }
                      >
                        Refresh
                      </button>
                    </div>
                    <p className="section-intro">{twin.scenarioDescription}</p>
                    {diagnosis?.findings.length ? (
                      diagnosis.findings.map((f) => (
                        <article
                          className={`finding ${f.severity} ${selected === f.asset ? "focused" : ""}`}
                          key={f.id}
                        >
                          <button
                            className="finding-asset"
                            onClick={() => setSelected(f.asset)}
                          >
                            {f.asset}
                          </button>
                          <div>
                            <div className="finding-top">
                              <h3>{f.title}</h3>
                              <span>{f.severity}</span>
                            </div>
                            <p>{f.evidence}</p>
                            <div className="next-check">
                              <Icon name="arrow" size={15} />
                              {f.action}
                            </div>
                            <small>{f.certainty}</small>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-state">
                        <Icon name="check" size={30} />
                        <h3>No current rule-based findings</h3>
                        <p>
                          This is not a certificate of safe or optimal
                          operation.
                        </p>
                      </div>
                    )}
                    <div className="panel-footer">
                      <button
                        className="button primary"
                        disabled={!!busy}
                        onClick={() => {
                          setSection("lab");
                          compare();
                        }}
                      >
                        Compare interventions <Icon name="arrow" size={16} />
                      </button>
                      <span>Evidence at revision {diagnosis?.revision}</span>
                    </div>
                  </section>
                )}
                {section === "lab" && (
                  <>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Choose an operating challenge</h2>
                        <span className="subtle">Synthetic scenarios</span>
                      </div>
                      <div className="scenario-cards">
                        {scenarios.map(([id, n, title, desc]) => (
                          <button
                            key={id}
                            disabled={!!busy}
                            className={
                              twin.scenario === id
                                ? "scenario-card active"
                                : "scenario-card"
                            }
                            onClick={() => reset(id)}
                          >
                            <span>{n}</span>
                            <h3>{title}</h3>
                            <p>{desc}</p>
                            <i>
                              {twin.scenario === id
                                ? "Active scenario"
                                : "Load scenario →"}
                            </i>
                          </button>
                        ))}
                      </div>
                    </section>
                    <section className="panel comparison-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Counterfactual workbench</h2>
                          <span className="subtle">
                            Five fixed candidates · 3-hour nonlinear physical
                            rollout
                          </span>
                        </div>
                        <button
                          className="button primary"
                          disabled={!!busy}
                          onClick={compare}
                        >
                          <Icon name="lab" size={16} />
                          {comparison ? "Compare again" : "Run comparison"}
                        </button>
                      </div>
                      {comparison ? (
                        <>
                          <div className="comparison-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Control strategy</th>
                                  <th>
                                    Heat
                                    <br />
                                    kWh
                                  </th>
                                  <th>
                                    Pump
                                    <br />
                                    kWh
                                  </th>
                                  <th>
                                    Lowest
                                    <br />
                                    °C
                                  </th>
                                  <th>
                                    End min.
                                    <br />
                                    °C
                                  </th>
                                  <th>Floor check</th>
                                </tr>
                              </thead>
                              <tbody>
                                {comparison.candidates.map((c) => (
                                  <tr
                                    key={c.id}
                                    className={
                                      c.id === comparison.recommendation?.id
                                        ? "recommended"
                                        : ""
                                    }
                                  >
                                    <td>
                                      <strong>{c.label}</strong>
                                      {c.id ===
                                        comparison.recommendation?.id && (
                                        <span className="best-label">
                                          MODEL PREFERENCE
                                        </span>
                                      )}
                                      <small>
                                        {fmt(c.controls.supplyC, 0)}°C ·{" "}
                                        {fmt(c.controls.pumpHz, 0)} Hz · valves{" "}
                                        {c.controls.valvesPct
                                          .map((v) => fmt(v, 0))
                                          .join("/")}
                                        %
                                      </small>
                                    </td>
                                    <td>{fmt(c.heatKwh, 0)}</td>
                                    <td>{fmt(c.pumpKwh, 2)}</td>
                                    <td>{fmt(c.minimumC, 2)}</td>
                                    <td>{fmt(c.endMinimumC, 2)}</td>
                                    <td>
                                      <span
                                        className={
                                          c.verified ? "mint" : "coral"
                                        }
                                      >
                                        {c.verified ? "✓ Passed" : "× Rejected"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="comparison-note">
                            <p>{comparison.objective}</p>
                            <p>
                              “Passed” means no modelled building fell below
                              18°C in this trajectory. It does not mean all
                              buildings reached comfort or that field operation
                              is safe. Initial temperatures are included. This
                              search is not the original P6 MPC.
                            </p>
                          </div>
                          {comparison.recommendation?.candidateId && (
                            <div className="approval-box">
                              <div>
                                <span className="eyebrow">
                                  OPERATOR APPROVAL REQUIRED
                                </span>
                                <h3>{comparison.recommendation.label}</h3>
                                <p>
                                  {fmt(
                                    comparison.recommendation.heatKwh -
                                      comparison.baseline.heatKwh,
                                    1,
                                  )}{" "}
                                  kWh heat change vs hold ·{" "}
                                  {fmt(
                                    comparison.recommendation.endMinimumC -
                                      comparison.baseline.endMinimumC,
                                    2,
                                  )}
                                  °C end-minimum change
                                </p>
                              </div>
                              {confirm ? (
                                <div className="confirm-controls">
                                  <p>
                                    Apply these controls to this simulation and
                                    advance 30 minutes?
                                  </p>
                                  <button
                                    className="button primary"
                                    disabled={
                                      !!busy ||
                                      comparison.revision !== twin.revision
                                    }
                                    onClick={apply}
                                  >
                                    Confirm simulated change
                                  </button>
                                  <button
                                    className="button"
                                    onClick={() => setConfirm(false)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="button primary"
                                  disabled={
                                    !!busy ||
                                    comparison.revision !== twin.revision
                                  }
                                  onClick={() => setConfirm(true)}
                                >
                                  Review & apply <Icon name="arrow" size={16} />
                                </button>
                              )}
                            </div>
                          )}
                          {!comparison.recommendation && (
                            <div className="inline-note amber">
                              No candidate passed the model floor. Do not apply
                              an unverified recommendation; investigate capacity
                              and request a qualified operator review.
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="empty-state">
                          <Icon name="lab" size={32} />
                          <h3>Give every recommendation a counterfactual.</h3>
                          <p>
                            Compare holding steady, branch balancing, lower
                            supply, higher supply and higher pump speed against
                            the same current state and weather path.
                          </p>
                        </div>
                      )}
                    </section>
                  </>
                )}
                <section className="panel trajectory-panel">
                  <div className="panel-heading">
                    <h2>Comfort trajectory</h2>
                    <div className="chart-legend">
                      <span className="mint">● Mean</span>
                      <span className="blue">● Minimum reading</span>
                      <span className="amber">┄ 18°C demo floor</span>
                    </div>
                  </div>
                  <Trend twin={twin} />
                  <div className="chart-foot">
                    Building aggregates · synthetic readings ·{" "}
                    {twin.history.length} snapshots · sensor bias affects the
                    displayed minimum
                  </div>
                </section>
              </div>
              <aside className="right-column">
                <div className="panel inspector-panel">
                  <div className="inspector-tabs">
                    <button
                      className={rightTab === "asset" ? "active" : ""}
                      onClick={() => setRightTab("asset")}
                    >
                      <Icon name="twin" size={16} /> Asset details
                    </button>
                    <button
                      className={rightTab === "agent" ? "active" : ""}
                      onClick={() => setRightTab("agent")}
                    >
                      <Icon name="spark" size={16} /> AI copilot
                    </button>
                  </div>
                  <div className="inspector-content">
                    {rightTab === "asset" ? (
                      <Inspector
                        building={b}
                        twin={twin}
                        investigate={investigate}
                      />
                    ) : (
                      agentPanel
                    )}
                  </div>
                </div>
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <h2>Operator log</h2>
                    <span className="mini-tag">{twin.events.length}</span>
                  </div>
                  {twin.events
                    .slice()
                    .reverse()
                    .map((e, i) => (
                      <div className="activity" key={i}>
                        <span className="activity-point" />
                        <div>
                          <strong>{e.title}</strong>
                          <p>{e.detail}</p>
                          <small>
                            {e.time.slice(11, 16)} · this session only
                          </small>
                        </div>
                      </div>
                    ))}
                </section>
              </aside>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <i className="status-dot" /> P1A snapshot · revision{" "}
              {twin.revision}
            </span>
            <span>
              Research prototype · no SCADA connection · no physical actuation
            </span>
            <button onClick={() => setSection("evidence")}>
              Model scope & sources ↗
            </button>
          </footer>
        </div>
      </main>
    </div>
  );
}
