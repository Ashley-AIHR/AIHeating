import {
  tx,
  useLocale,
  setLocale,
  translate,
  defaultBrief,
  type Locale,
} from "../localisation";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  api,
  fmt,
  type Twin,
  type Diagnosis,
  type Candidate,
} from "../operations/types";
import { validateGlb } from "../engineering/model";
import type { EngineeringReview } from "../engineering/review";
import CityScene, { type Geography } from "./CityScene";
import visionGeometry from "../../public/site-assets/vision-district.json";
import "./immersive.css";
import MissionControl from "./MissionControl";
import DirectControl, {
  type CommandPreview,
  type OperationEvent,
} from "./DirectControl";
import { AnimatedValue, EventSignals, EquipmentWorkbench } from "./Signals";
import {
  streamInvestigation,
  toolNames,
  type Mission,
  type MissionEvent,
} from "./mission";
const ConnectedStudio = lazy(() => import("../engineering/ConnectedStudio"));
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
export type Optimisation = {
  contextId?: string;
  revision: number;
  baseline: Omit<Candidate, "trace"> & { trace: Forecast[] };
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
  locale?: Locale;
  contextId?: string;
  completionStatus?: "complete" | "partial";
  warning?: string;
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
  sceneActions?: { type: string; assetIds: string[] }[];
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
  accessCodeRequired: boolean;
  release?: string;
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
      <span>{tx(label)}</span>
      <strong>{tx(value)}</strong>
    </div>
  );
}
export default function Workspace() {
  const locale = useLocale();
  const [config, setConfig] = useState<Config | null>(null),
    [twin, setTwin] = useState<Twin | null>(null),
    [geo, setGeo] = useState<Geography | null>(null),
    [frames, setFrames] = useState<Twin[]>([]);
  const [selected, setSelected] = useState("B10"),
    [focus, setFocus] = useState(0),
    [panel, setPanel] = useState("agents"),
    [layer, setLayer] = useState("temperature"),
    [timeMode, setTimeMode] = useState("current"),
    [timeIndex, setTimeIndex] = useState(0);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null),
    [optimisation, setOptimisation] = useState<Optimisation | null>(null),
    [run, setRun] = useState<Run | null>(null),
    [feed, setFeed] = useState<Feed | null>(null);
  const [code, setCode] = useState(""),
    [question, setQuestion] = useState(translate(defaultBrief)),
    [objective, setObjective] = useState("balanced");
  useEffect(() => {
    setQuestion((q) =>
      [defaultBrief, translate(defaultBrief, "zh-CN")].includes(q)
        ? translate(defaultBrief, locale)
        : q,
    );
  }, [locale]);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [playing, setPlaying] = useState(false),
    [confirm, setConfirm] = useState(false),
    [sceneView, setSceneView] = useState<"district" | "plant">("district"),
    [equipment, setEquipment] = useState("HX-A"),
    [bimOpen, setBimOpen] = useState(false),
    [bimVisited, setBimVisited] = useState(false),
    [search, setSearch] = useState("");
  const [imported, setImported] = useState<ArrayBuffer | null>(null),
    [importName, setImportName] = useState("");
  const [mission, setMission] = useState<Mission | null>(null),
    [forecastSide, setForecastSide] = useState<"intervention" | "baseline">(
      "intervention",
    ),
    [previewPlaying, setPreviewPlaying] = useState(false),
    [cyclesRemaining, setCyclesRemaining] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false),
    [operationEvents, setOperationEvents] = useState<OperationEvent[]>([]);
  const eventId = useRef(0),
    previousFindings = useRef(new Set<string>());
  const inFlight = useRef(false),
    alive = useRef(true);
  const agentAbort = useRef<AbortController | null>(null);
  function openStudio() {
    setBimVisited(true);
    setBimOpen(true);
  }
  async function work(label: string, fn: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setPlaying(false);
      setCyclesRemaining(0);
      notice(
        "Operation failed",
        e instanceof Error ? e.message : String(e),
        true,
      );
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
      agentAbort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!diagnosis || !twin) return;
    const fresh = diagnosis.findings.filter(
      (f) => !previousFindings.current.has(f.id),
    );
    previousFindings.current = new Set(diagnosis.findings.map((f) => f.id));
    if (fresh.length)
      setOperationEvents((events) =>
        [
          ...events,
          ...fresh.map((f) => ({
            id: ++eventId.current,
            title: f.title,
            detail: `${f.asset} · ${f.evidence}`,
            kind: "warning" as const,
            asset: f.asset,
            time: twin.time.slice(11, 16),
          })),
        ].slice(-30),
      );
  }, [diagnosis, twin]);
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
    setControlsOpen(false);
    setSelected(id);
    setFocus((x) => x + 1);
    setPanel("inspect");
  }
  const plan = optimisation?.recommendation,
    forecast =
      (forecastSide === "baseline"
        ? optimisation?.baseline.trace
        : plan?.trace) || [];
  useEffect(() => {
    if (!previewPlaying || timeMode !== "forecast") return;
    const timer = setInterval(
      () =>
        setTimeIndex((i) => {
          if (i >= forecast.length - 1) return i;
          return i + 1;
        }),
      1600,
    );
    return () => clearInterval(timer);
  }, [previewPlaying, timeMode, forecast.length]);
  useEffect(() => {
    if (timeMode !== "forecast" || timeIndex >= forecast.length - 1)
      setPreviewPlaying(false);
  }, [timeMode, timeIndex, forecast.length]);
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
  const stalePlan =
    !!optimisation &&
    (optimisation.revision !== twin?.revision ||
      (optimisation.contextId !== undefined &&
        optimisation.contextId !== twin?.contextId));
  useEffect(() => {
    if (stalePlan && timeMode === "forecast") setTimeMode("current");
  }, [stalePlan, timeMode]);
  function current() {
    setPreviewPlaying(false);
    setTimeMode("current");
    setTimeIndex(0);
  }
  async function resetWorld(cityId: string, scenario: string) {
    setPlaying(false);
    setCyclesRemaining(0);
    setPreviewPlaying(false);
    await work("Loading district simulation", async () => {
      await api("reset", { cityId, scenario });
      setOptimisation(null);
      setRun(null);
      setMission(null);
      setConfirm(false);
      setControlsOpen(false);
      setOperationEvents([]);
      previousFindings.current = new Set();
      setFeed(null);
      setImported(null);
      setImportName("");
      setBimOpen(false);
      setSceneView("district");
      setSelected("B10");
      setForecastSide("intervention");
      current();
      await refresh();
    });
  }
  async function optimise() {
    setCyclesRemaining(0);
    await work("Optimising + verifying nonlinear trajectories", async () => {
      setPlaying(false);
      const o = await api<Optimisation>("optimise", { objective });
      setOptimisation(o);
      setMission(null);
      setForecastSide("intervention");
      setPanel("optimise");
      current();
    });
  }
  async function investigate(role: string) {
    return startMission(true, false, question, role);
  }
  function preview(side: "intervention" | "baseline", play = false) {
    setPlaying(false);
    setForecastSide(side);
    setTimeMode("forecast");
    setTimeIndex(0);
    setPreviewPlaying(play);
    setLayer("temperature");
  }
  async function startMission(
    useAgent: boolean,
    continuing = false,
    brief = question,
    role = "optimisation",
    engineeringReview?: EngineeringReview,
  ) {
    if (!twin) return;
    if (!continuing) setCyclesRemaining(0);
    setControlsOpen(false);
    let origin = twin;
    const assetId = selected;
    await work(
      useAgent
        ? "Agent mission in progress"
        : "Computing physical alternatives",
      async () => {
        setPlaying(false);
        current();
        setPanel("agents");
        setOptimisation(null);
        setRun(null);
        const b = origin.buildings.find((b) => b.id === assetId);
        const zoneId =
          b?.zone || origin.zones.find((z) => z.id === assetId)?.id;
        const affected = [
          "ST01",
          ...(zoneId
            ? [
                zoneId,
                ...origin.buildings
                  .filter((b) => b.zone === zoneId)
                  .map((b) => b.id),
              ]
            : origin.buildings.map((b) => b.id)),
        ];
        setMission({
          locale,
          phase: "investigating",
          origin: useAgent ? "llm" : "numerical",
          before: origin,
          assetId,
          affected,
          events: [],
          message: "Inspecting the current operating state",
        });
        setLayer("network");
        const event = (e: MissionEvent) =>
          setMission(
            (m) =>
              m && {
                ...m,
                events: e.kind === "text" ? m.events : [...m.events, e],
                draft:
                  e.kind === "text"
                    ? ((m.draftRound === e.round ? m.draft : "") || "") + e.text
                    : m.draft,
                draftRound: e.kind === "text" ? e.round : m.draftRound,
                message: toolNames[e.tool] || e.tool,
              },
          );
        try {
          let o: Optimisation | null;
          let partialWarning: string | undefined;
          if (useAgent) {
            agentAbort.current = new AbortController();
            const r = await streamInvestigation<Run>(
              {
                role,
                assetId,
                equipmentId:
                  assetId === "ST01" && sceneView === "plant"
                    ? equipment
                    : undefined,
                question: brief,
                engineeringReview,
                objective,
                revision: origin.revision,
                contextId: origin.contextId,
                locale,
                cityId: origin.cityId || "yinchuan",
                scenario: origin.scenario,
                syncCurrent: true,
                mode: "simulation",
              },
              code,
              event,
              agentAbort.current.signal,
              (state, rebased) => {
                origin = state;
                setTwin(state);
                setFrames((f) =>
                  [
                    ...f.filter(
                      (x) =>
                        x.contextId === state.contextId &&
                        x.revision < state.revision,
                    ),
                    state,
                  ].slice(-48),
                );
                setMission(
                  (m) =>
                    m && {
                      ...m,
                      before: state,
                      events: rebased
                        ? [
                            ...m.events,
                            {
                              tool: "context_sync",
                              status: "completed",
                              at: new Date().toISOString(),
                              message: `Using current ${state.city?.name || state.cityId} simulation, revision ${state.revision}.`,
                            },
                          ]
                        : m.events,
                    },
                );
                if (rebased) {
                  setDiagnosis(null);
                  setFeed(null);
                  setImported(null);
                  setImportName("");
                  previousFindings.current = new Set();
                  setOperationEvents([]);
                  notice(
                    "Simulation synchronised",
                    `Using ${state.city?.name || state.cityId} · revision ${state.revision}. Previous scene state and plans have been replaced.`,
                  );
                }
              },
            );
            setRun(r);
            if (r.diagnosis) setDiagnosis(r.diagnosis);
            setMission((m) => m && { ...m, draft: r.answer });
            if (r.completionStatus === "partial") {
              partialWarning =
                r.warning ||
                "AI explanation incomplete; completed tools preserved";
              setCyclesRemaining(0);
            }
            o = r.optimisation;
            // Apply only validated, known highlight targets; never move the camera after a late response.
            const targets = r.sceneActions
              ?.filter((a) => a.type === "highlight")
              .flatMap((a) => a.assetIds)
              .filter((id) => config?.registry.some((a) => a.id === id));
            if (targets?.length)
              setMission((m) => m && { ...m, affected: targets });
          } else {
            event({
              tool: "diagnose_building",
              status: "running",
              at: new Date().toISOString(),
            });
            setDiagnosis(
              await api<Diagnosis>("diagnose", { buildingId: b?.id }),
            );
            event({
              tool: "diagnose_building",
              status: "completed",
              at: new Date().toISOString(),
            });
            event({
              tool: "optimise_network",
              status: "running",
              at: new Date().toISOString(),
            });
            o = await api<Optimisation>("optimise", { objective });
            event({
              tool: "optimise_network",
              status: "completed",
              at: new Date().toISOString(),
            });
          }
          setOptimisation(o);
          if (partialWarning) {
            setMission(
              (m) =>
                m && {
                  ...m,
                  phase: "blocked",
                  message: `${partialWarning}. Tool evidence retained; automatic application stopped.`,
                },
            );
          } else if (o?.recommendation && o.verification.passed) {
            setMission(
              (m) =>
                m && {
                  ...m,
                  phase: "ready",
                  message:
                    "Verified intervention · compare its physical consequences",
                  affected: [
                    "ST01",
                    ...origin.zones.map((z) => z.id),
                    ...origin.buildings.map((b) => b.id),
                  ],
                  baseline: o!.baseline.trace[0]?.state,
                  predicted: o!.recommendation!.trace[0]?.state,
                },
            );
            preview("intervention", true);
          } else
            setMission(
              (m) =>
                m && {
                  ...m,
                  phase: "blocked",
                  message: o
                    ? "No feasible intervention found. Review the model evidence."
                    : role === "diagnostic"
                      ? "Diagnostic investigation complete. Review its explanation and tool evidence."
                      : "No control plan proposed. Review the investigation findings.",
                },
            );
        } catch (e) {
          setMission(
            (m) =>
              m && {
                ...m,
                phase: "failed",
                message: e instanceof Error ? e.message : String(e),
              },
          );
          throw e;
        } finally {
          agentAbort.current = null;
        }
      },
    );
  }
  async function applyControls() {
    await work(
      "Applying verified controls and measuring the physical response",
      async () => {
        try {
          const after = await api<Twin>("apply", {
            candidateId: plan?.candidateId,
          });
          setTwin(after);
          notice(
            "AI plan applied",
            `Supply ${fmt(after.supplyC)}°C · drive ${fmt(after.pumpHz)} Hz · +30 simulated minutes`,
            false,
            "command",
          );
          setMission((m) =>
            m?.phase === "ready"
              ? {
                  ...m,
                  phase: "applied",
                  after,
                  message: "Controls applied · measuring the network response",
                }
              : m,
          );
          setCyclesRemaining((n) => Math.max(0, n - 1));
          setConfirm(false);
          current();
          await refresh();
        } catch (e) {
          setCyclesRemaining(0);
          throw e;
        }
      },
    );
  }
  useEffect(() => {
    if (!cyclesRemaining || busy || inFlight.current || !mission) return;
    if (
      ["failed", "blocked"].includes(mission.phase) ||
      (mission.phase === "ready" && stalePlan)
    ) {
      setCyclesRemaining(0);
      return;
    }
    // A visible pause lets the operator inspect or stop; each next call uses fresh state.
    const timer = setTimeout(() => {
      if (mission.phase === "ready") void applyControls();
      else if (mission.phase === "applied") void startMission(true, true);
    }, 2400);
    return () => clearTimeout(timer);
  }, [cyclesRemaining, busy, mission, stalePlan]);
  const baselineFrame =
    timeMode === "forecast"
      ? optimisation?.baseline.trace[timeIndex]?.state
      : mission?.phase === "applied" &&
          mission.after?.revision === twin?.revision
        ? mission.baseline
        : undefined;
  function notice(
    title: string,
    detail: string,
    failed = false,
    kind: OperationEvent["kind"] = "info",
  ) {
    setOperationEvents((events) =>
      [
        ...events,
        {
          id: ++eventId.current,
          title,
          detail,
          kind: failed ? "failure" : kind,
          asset: selected,
          time: twin?.time.slice(11, 16) || "",
        },
      ].slice(-30),
    );
  }
  function openControls() {
    setCyclesRemaining(0);
    setPlaying(false);
    setPreviewPlaying(false);
    if (inFlight.current) {
      notice(
        "Manual takeover requested",
        "Waiting for the active operation to finish. Further automatic cycles are stopped.",
      );
      return;
    }
    setControlsOpen(true);
    setFocus((x) => x + 1);
  }
  function manualApplied(after: Twin, command: CommandPreview) {
    setTwin(after);
    setOptimisation(null);
    setMission(null);
    current();
    setFrames((f) => [...f, after].slice(-48));
    notice(
      "Manual command applied",
      `${command.assetId} ${command.control} → ${fmt(command.value)} · model advanced 30 min`,
      false,
      "command",
    );
    void api<Diagnosis>("diagnose")
      .then(setDiagnosis)
      .catch(() => {});
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
          {tx("HEATPILOT")}
          <span>{tx(" / CONNECTED OPERATIONS")}</span>
        </h1>
        <p>
          {tx(error || "Loading source geometry and nonlinear physical state…")}
        </p>
        {tx(
          error && (
            <button onClick={() => location.reload()}>{tx("Retry")}</button>
          ),
        )}
      </main>
    );
  return (
    <main className="immersive">
      <header className="ops-header">
        <div className="brand">
          <span className="brand-symbol">◈</span>
          <div>
            {tx("HEATPILOT ")}
            <small>{tx("SPATIAL ENERGY OPERATIONS")}</small>
          </div>
        </div>
        <div className="site-title">
          <select
            aria-label={tx("City district")}
            value={twin.cityId || "yinchuan"}
            disabled={!!busy}
            onChange={(e) => void resetWorld(e.target.value, twin.scenario)}
          >
            <option value="yinchuan">
              {locale === "zh-CN" ? "银川" : "YINCHUAN · 银川"}
            </option>
            <option value="shanghai">
              {locale === "zh-CN" ? "上海" : "SHANGHAI · 上海"}
            </option>
            <option value="beijing">
              {locale === "zh-CN" ? "北京" : "BEIJING · 北京"}
            </option>
          </select>
          <small>
            {tx(twin.city?.district || "Winter-city energy district")}
            {tx(" · fictional")}
          </small>
        </div>
        <div className="header-state">
          <select
            className="language-switch"
            aria-label={tx("Interface language")}
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="en" lang="en">
              English
            </option>
            <option value="zh-CN" lang="zh-CN">
              简体中文
            </option>
          </select>
          <span className="mode-badge">
            {tx(timeMode === "current" ? "SIMULATION" : timeMode.toUpperCase())}
          </span>
          <span className="offline">{tx("SIMULATED DATA")}</span>
          <button onClick={() => setPanel("connection")}>
            {tx("Connections ↗")}
          </button>
        </div>
      </header>
      <nav className="tool-rail" aria-label={tx("Workspace tools")}>
        {tx(
          [
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
              aria-label={tx(label)}
              onClick={() => setPanel(id)}
            >
              <b aria-hidden="true">{tx(icon)}</b>
              {tx(label)}
            </button>
          )),
        )}
        <button aria-label={tx("BIM work studio")} onClick={openStudio}>
          <b aria-hidden="true">▧</b>
          {tx("BIM Studio")}
        </button>
        <div className="rail-bottom">
          {tx("3D")}
          <br />
          {tx("TWIN")}
        </div>
      </nav>
      <section
        className="world-stage"
        aria-label={tx("Integrated 3D district")}
      >
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
          onOpenBim={openStudio}
          affected={mission?.affected || []}
          comparison={baselineFrame}
          findings={diagnosis?.findings || []}
          controlContent={
            controlsOpen ? (
              <DirectControl
                key={`${selected}/${equipment}/${twin.revision}`}
                state={twin}
                selected={selected}
                equipment={equipment}
                plant={sceneView === "plant"}
                enabled={timeMode === "current"}
                busy={!!busy}
                onPending={(label) => {
                  inFlight.current = !!label;
                  setBusy(label);
                }}
                onApplied={manualApplied}
                onNotice={notice}
                onAgent={() => {
                  setControlsOpen(false);
                  setPanel("agents");
                  const brief = tx(
                    `Investigate ${selected} and test an improved control plan for its connected circuit.`,
                  );
                  setQuestion(brief);
                  if (
                    config.aiConfigured &&
                    (!config.accessCodeRequired || code)
                  )
                    void startMission(true, false, brief);
                }}
                onClose={() => setControlsOpen(false)}
              />
            ) : null
          }
          onOperate={openControls}
        />
      </section>
      <button
        className="mission-banner"
        onClick={() => setPanel("agents")}
        aria-label={tx("Open active agent mission")}
      >
        <span className="mission-pulse">✧</span>
        <span>
          <small>
            {tx(
              mission
                ? mission.origin === "llm"
                  ? "AGENT MISSION"
                  : "NUMERICAL EXPLORATION"
                : "CITY INTELLIGENCE",
            )}
          </small>
          <strong>
            {tx(
              mission?.message ||
                "Give the city an objective. Watch it respond.",
            )}
          </strong>
        </span>
        <b>↗</b>
      </button>
      <section className="world-title">
        <div className="eyebrow">
          {tx((twin.city?.name || "Yinchuan").toUpperCase())}
          {tx(" / CONNECTED ENERGY DISTRICT")}
        </div>
        <h1>
          {tx(
            sceneView === "plant"
              ? "Inside the energy centre."
              : "The city, in balance.",
          )}
        </h1>
        <p>
          {tx(
            sceneView === "plant"
              ? "Mechanical systems. Network intelligence. One operating context."
              : "A living model of heat, buildings and the decisions that connect them.",
          )}
        </p>
      </section>
      <div className="view-switch" aria-label={tx("Spatial view")}>
        <button
          aria-pressed={sceneView === "district"}
          onClick={() => setSceneView("district")}
        >
          {tx("◈ District")}
        </button>
        <button
          aria-pressed={sceneView === "plant"}
          onClick={() => {
            setSelected("ST01");
            setPanel("inspect");
            setSceneView("plant");
          }}
        >
          {tx("⚙ Energy centre")}
        </button>
      </div>
      <div className="scene-controls">
        <div className="segmented">
          {tx(
            [
              ["temperature", "Thermal"],
              ["network", "Network"],
              ["buildings", "Buildings"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={layer === id}
                onClick={() => setLayer(id)}
              >
                {tx(label)}
              </button>
            )),
          )}
        </div>
        <button
          onClick={() => {
            setSelected("ST01");
            setSceneView("plant");
            setFocus((x) => x + 1);
          }}
        >
          {tx("Focus station")}
        </button>
        <button
          onClick={() => {
            setSelected("ST01");
            setSceneView("plant");
            setPanel("inspect");
          }}
        >
          {tx("Equipment workbench ↗")}
        </button>
      </div>
      <section
        className="scene-metrics"
        aria-label={tx("Current physical indicators")}
      >
        <div>
          <span>{tx("Delivered heat")}</span>
          <strong>
            <AnimatedValue
              key={`${twin.cityId}/${timeMode}/${forecastSide}`}
              value={frame.heatKw / 1000}
              digits={3}
            />
            <small>{tx(" MW")}</small>
          </strong>
        </div>
        <div>
          <span>{tx("Outdoor temperature")}</span>
          <strong>
            <AnimatedValue
              key={`${twin.cityId}/${timeMode}/${forecastSide}`}
              value={frame.outdoorC}
            />
            <small>{tx(" °C")}</small>
          </strong>
        </div>
        <div>
          <span>{tx("Pump electricity")}</span>
          <strong>
            <AnimatedValue
              key={`${twin.cityId}/${timeMode}/${forecastSide}`}
              value={frame.pumpKw}
            />
            <small>{tx(" kW")}</small>
          </strong>
        </div>
        <div>
          <span>
            {tx("Selected / ")}
            {tx(selected)}
          </span>
          <strong>
            <AnimatedValue
              key={`${twin.cityId}/${selected}/${timeMode}/${forecastSide}`}
              value={
                building ? building.indoorC : (zone?.flowM3h ?? frame.flowM3h)
              }
            />
            <small>{tx(building ? " °C" : " m³/h")}</small>
          </strong>
        </div>
      </section>
      <EventSignals
        events={operationEvents}
        diagnosis={diagnosis}
        onSelect={select}
        onAlarms={() => setPanel("alarms")}
      />
      <div className="scene-caption">
        <span className="legend-dot warm" />
        {tx(" Supply")}
        {tx(" ")}
        <span className="legend-dot cool" />
        {tx(" Return")}
        {tx(" ")}
        <span>
          {tx(
            imported
              ? "Local visual model · no georeferencing or asset mapping"
              : `Fictional ${twin.city?.name || "Yinchuan"} district · physically simulated operation`,
          )}
        </span>
      </div>
      <aside
        className="ops-dock"
        aria-label={tx("Contextual operations panel")}
      >
        <div className="dock-heading">
          <div className="eyebrow">
            {tx(panel === "inspect" ? "ASSET CONTEXT" : "OPERATIONS TOOL")}
          </div>
          <h2>
            {tx(
              (
                {
                  inspect: asset?.name || selected,
                  alarms: "Network findings",
                  agents: "Agent operations",
                  optimise: "Predictive optimisation",
                  connection: "Data connections",
                  sources: "Evidence & provenance",
                } as Record<string, string>
              )[panel],
            )}
          </h2>
          <div className="context-line">
            {tx(selected)} <span>·</span>
            {tx(" ")}
            {tx(
              timeMode === "current" ? `Revision ${frame.revision}` : timeMode,
            )}
            {tx(" ")}
            <span>·</span> {tx(frame.time.slice(11, 16))}
          </div>
        </div>
        {tx(
          panel === "inspect" && (
            <>
              <button className="primary full" onClick={openControls}>
                {tx("Operate selected asset in 3D")}
              </button>
              <div className="asset-search">
                <input
                  aria-label={tx("Search assets")}
                  placeholder={tx("Find a building or branch…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label={tx("Selected asset")}
                  value={selected}
                  onChange={(e) => select(e.target.value)}
                >
                  {tx(
                    config.registry
                      .filter(
                        (a) =>
                          a.id === selected ||
                          `${a.id} ${a.name}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {tx(a.id)} · {tx(a.name)}
                        </option>
                      )),
                  )}
                </select>
              </div>
              <div className="hero-reading">
                <small>
                  {tx(
                    building
                      ? "INDOOR TEMPERATURE"
                      : zone
                        ? "BRANCH FLOW"
                        : "SUPPLY TEMPERATURE",
                  )}
                </small>
                <strong>
                  <AnimatedValue
                    key={`${twin.cityId}/${selected}/${timeMode}/${forecastSide}`}
                    value={building?.indoorC ?? zone?.flowM3h ?? frame.supplyC}
                  />
                  <span>{tx(building ? "°C" : zone ? "m³/h" : "°C")}</span>
                </strong>
                <span className="quality">
                  {tx(
                    timeMode === "forecast"
                      ? "PREDICTED · UNCALIBRATED"
                      : building?.quality === "suspect"
                        ? "SUSPECT SIMULATED SENSOR"
                        : "SYNTHETIC MODEL VALUE",
                  )}
                </span>
              </div>
              {tx(
                building && (
                  <>
                    <Pair
                      label={tx("Physical-model temperature")}
                      value={`${fmt(building.modelC, 1)} °C`}
                    />
                    <Pair
                      label={tx("Delivered heat")}
                      value={`${fmt(building.heatKw, 1)} kW`}
                    />
                    <Pair
                      label={tx("Return temperature")}
                      value={`${fmt(building.returnC, 1)} °C`}
                    />
                    <Pair
                      label={tx("Heated floor area (archetype)")}
                      value={`${fmt(building.areaM2, 0)} m²`}
                    />
                  </>
                ),
              )}
              {tx(
                zone && (
                  <>
                    <h3>{tx("Connected heating branch")}</h3>
                    <button
                      className="connection-path"
                      onClick={() => select(zone.id)}
                    >
                      {tx("ST01 → ")}
                      {tx(zone.id.toUpperCase())}
                      {tx(" ")}
                      {tx(building ? `→ ${building.id}` : "")}
                    </button>
                    <Pair
                      label={tx("Transport delay (model)")}
                      value={`${fmt(zone.delayMinutes, 1)} min`}
                    />
                    <Pair
                      label={tx("Branch valve (displayed frame)")}
                      value={`${fmt(zone.valvePct, 0)} %`}
                    />
                  </>
                ),
              )}
              {tx(
                !building && !zone && (
                  <>
                    {tx(
                      sceneView === "plant" && (
                        <div className="equipment-card">
                          <div className="eyebrow">
                            {tx("MECHANICAL ASSEMBLY / ")}
                            {tx(equipment)}
                          </div>
                          <h3>
                            {tx(
                              equipment.startsWith("HX")
                                ? "Plate heat exchanger"
                                : equipment === "MCC"
                                  ? "Motor control centre"
                                  : equipment === "P-03"
                                    ? "Standby circulation pump"
                                    : "Duty circulation pump",
                            )}
                          </h3>
                          <div className="equipment-picker">
                            {tx(
                              [
                                "HX-A",
                                "HX-B",
                                "P-01",
                                "P-02",
                                "P-03",
                                "MCC",
                              ].map((id) => (
                                <button
                                  key={id}
                                  aria-pressed={equipment === id}
                                  onClick={() => setEquipment(id)}
                                >
                                  {tx(id)}
                                </button>
                              )),
                            )}
                          </div>
                          <p>
                            {tx(
                              equipment.startsWith("HX")
                                ? "Primary-to-secondary heat transfer. Inspect the common supply and return headers, then preview the effect of a supply-temperature change across every connected building."
                                : equipment === "MCC"
                                  ? "Variable-frequency drive coordination. Test a pump-speed proposal against branch pressure, transport delay and indoor comfort before simulator approval."
                                  : equipment === "P-03"
                                    ? "Standby unit in the visual design. The numerical model currently represents one equivalent pump characteristic, not individual duty/standby switching."
                                    : "Secondary circulation. The model couples equivalent pump speed to branch resistance, water flow and delayed heat delivery.",
                            )}
                          </p>
                          <small>
                            {tx(
                              "Readings below are shared station-model values, not individual equipment instruments.",
                            )}
                          </small>
                        </div>
                      ),
                    )}
                    {tx(
                      sceneView === "plant" && (
                        <EquipmentWorkbench
                          state={frame}
                          equipment={equipment}
                          onSelect={(id) => {
                            select(id);
                            setSceneView("district");
                          }}
                          onOperate={openControls}
                          onAgent={() => setPanel("agents")}
                        />
                      ),
                    )}
                    <Pair
                      label={tx("Return temperature")}
                      value={`${fmt(frame.returnC, 1)} °C`}
                    />
                    <Pair
                      label={tx("Total flow")}
                      value={`${fmt(frame.flowM3h, 1)} m³/h`}
                    />
                    <Pair
                      label={tx("Available pressure")}
                      value={`${fmt(frame.pressureKpa, 1)} kPa`}
                    />
                    <Pair
                      label={tx("Pump frequency")}
                      value={`${fmt(frame.pumpHz, 1)} Hz`}
                    />
                  </>
                ),
              )}
              <div className="dock-actions">
                <button onClick={openStudio}>{tx("BIM work studio")}</button>
                <button className="primary" onClick={() => setPanel("agents")}>
                  {tx("✧ Investigate this asset")}
                </button>
                <button
                  onClick={() => {
                    setSelected("ST01");
                    setSceneView(sceneView === "plant" ? "district" : "plant");
                  }}
                >
                  {tx(
                    sceneView === "plant"
                      ? "Return to connected district"
                      : "Explore energy centre",
                  )}
                </button>
              </div>
              <p className="muted">
                {tx(
                  "One shared selection links the scene, network, timeline and agent investigation.",
                )}
              </p>
            </>
          ),
        )}
        {tx(
          panel === "alarms" && (
            <>
              <p className="muted">
                {tx("Current simulation findings · revision ")}
                {tx(diagnosis?.revision)}
                {tx(
                  ". Selecting a finding focuses the same asset in the district.",
                )}
              </p>
              {tx(
                diagnosis?.findings.map((f) => (
                  <button
                    className={`finding ${f.severity}`}
                    key={f.id}
                    onClick={() => select(f.asset)}
                  >
                    <span>
                      {tx(f.asset)} / {tx(f.severity)}
                    </span>
                    <strong>{tx(f.title)}</strong>
                    <p>{tx(f.evidence)}</p>
                    <small>{tx(f.certainty)}</small>
                  </button>
                )),
              )}
              {tx(
                !diagnosis?.findings.length && (
                  <p>{tx("No active rule-based findings in this frame.")}</p>
                ),
              )}
            </>
          ),
        )}
        {tx(
          panel === "agents" && (
            <>
              <MissionControl
                mission={mission}
                optimisation={optimisation}
                current={twin}
                busy={!!busy}
                stale={stalePlan}
                canRunAgent={
                  config.aiConfigured && (!config.accessCodeRequired || !!code)
                }
                forecastSide={forecastSide}
                previewing={timeMode === "forecast"}
                animating={previewPlaying}
                onRun={(agent) => void startMission(agent)}
                onPreview={(side) => preview(side)}
                onAnimate={() =>
                  previewPlaying
                    ? setPreviewPlaying(false)
                    : preview(forecastSide, true)
                }
                onApply={() => {
                  setCyclesRemaining(0);
                  current();
                  setConfirm(true);
                }}
                cyclesRemaining={cyclesRemaining}
                onAutonomous={() => {
                  setCyclesRemaining(3);
                  void startMission(true, true);
                }}
                onStop={() => {
                  setCyclesRemaining(0);
                  agentAbort.current?.abort(
                    new Error("Investigation stopped by operator"),
                  );
                }}
              />
              <label>
                {tx("Mission objective")}
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  disabled={!!busy}
                >
                  <option value="balanced">
                    {tx("Balance comfort and energy")}
                  </option>
                  <option value="comfort">
                    {tx("Recover building comfort")}
                  </option>
                  <option value="energy">
                    {tx("Reduce heat and pumping demand")}
                  </option>
                </select>
              </label>
              <div className="agent-card">
                <span className="agent-orb">✧</span>
                <div>
                  <strong>
                    {tx(
                      config.model.startsWith("deepseek/deepseek-v4-flash")
                        ? "DeepSeek V4 Flash"
                        : "Configured reasoning model",
                    )}
                  </strong>
                  <small>{tx(config.model)}</small>
                </div>
                <span>
                  {tx(config.aiConfigured ? "CONFIGURED" : "NOT CONFIGURED")}
                </span>
              </div>
              <p>
                {tx("Diagnosis and optimisation share asset ")}
                <b>{tx(selected)}</b>
                {tx(
                  ", its branch, the current physical state and model limitations.",
                )}
              </p>
              {tx(
                config.accessCodeRequired && (
                  <label>
                    {tx("Operator access code")}
                    <input
                      type="password"
                      autoComplete="off"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder={tx("Not your OpenRouter key")}
                    />
                  </label>
                ),
              )}
              <label>
                {tx("Investigation brief")}
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={1800}
                />
              </label>
              <p className="muted">
                {tx(
                  "New agent runs use the selected language. Existing reports keep their original language.",
                )}
              </p>
              <div className="dock-actions">
                <button
                  className="primary"
                  disabled={
                    !!busy ||
                    timeMode !== "current" ||
                    !config.aiConfigured ||
                    (config.accessCodeRequired && !code)
                  }
                  onClick={() => void investigate("diagnostic")}
                >
                  {tx("Run diagnostic agent")}
                </button>
                <button
                  disabled={
                    !!busy ||
                    timeMode !== "current" ||
                    !config.aiConfigured ||
                    (config.accessCodeRequired && !code)
                  }
                  onClick={() => void investigate("optimisation")}
                >
                  {tx("Run optimisation agent")}
                </button>
              </div>
              <p className="muted">
                {tx(
                  "Operator-triggered paid calls. No background LLM polling. Numerical optimisation remains available without AI access.",
                )}
              </p>
              {tx(
                run && (
                  <article className="agent-result">
                    <div className="eyebrow">
                      {tx(
                        run.completionStatus === "partial"
                          ? "PARTIAL · EVIDENCE RETAINED"
                          : "COMPLETED",
                      )}
                      {tx(" ")}/ {tx(run.role)}
                    </div>
                    {tx(
                      run.warning && (
                        <p className="warning">{tx(run.warning)}</p>
                      ),
                    )}
                    <h3>
                      {tx(run.assetId)}
                      {tx(run.equipmentId ? ` / ${run.equipmentId}` : "")}
                      {tx(" · revision")}
                      {tx(" ")}
                      {tx(run.revision)}
                    </h3>
                    {tx(
                      (run.revision !== twin.revision ||
                        (run.contextId !== undefined &&
                          run.contextId !== twin.contextId)) && (
                        <p className="warning">
                          {tx("Historical run—current state has changed.")}
                        </p>
                      ),
                    )}
                    <small>
                      {tx("Agent response language")} ·{" "}
                      {run.locale === "zh-CN" ? "简体中文" : "English"}
                    </small>
                    <p
                      className="narrative"
                      lang={run.locale === "zh-CN" ? "zh-CN" : "en-GB"}
                    >
                      {run.answer}
                    </p>
                    <button
                      onClick={() => {
                        select(run.assetId);
                        if (run.equipmentId) {
                          setEquipment(run.equipmentId);
                          setSceneView("plant");
                        }
                      }}
                    >
                      {tx("Focus investigated asset")}
                    </button>
                    <h3>{tx("Executed tools")}</h3>
                    {tx(
                      run.trace.map((t, i) => (
                        <details key={i}>
                          <summary>
                            {tx(i + 1)}. {tx(t.tool)}
                          </summary>
                          <pre>{tx(JSON.stringify(t.result, null, 2))}</pre>
                        </details>
                      )),
                    )}
                    <button
                      onClick={() =>
                        download(`heatpilot-agent-${run.runId}.json`, run)
                      }
                    >
                      {tx("Export run evidence")}
                    </button>
                  </article>
                ),
              )}
            </>
          ),
        )}
        {tx(
          panel === "optimise" && (
            <>
              <p>
                {tx(
                  "Search two 90-minute control blocks against the nonlinear physical model. A fresh rollout verifies the best plan found.",
                )}
              </p>
              <label>
                {tx("Objective")}
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                >
                  <option value="balanced">
                    {tx("Balanced comfort + energy")}
                  </option>
                  <option value="comfort">{tx("Comfort priority")}</option>
                  <option value="energy">{tx("Energy priority")}</option>
                </select>
              </label>
              <button
                className="primary full"
                disabled={!!busy || timeMode !== "current"}
                onClick={() => void optimise()}
              >
                {tx("Compute & verify schedule")}
              </button>
              {tx(
                optimisation && (
                  <>
                    <div className="verification">
                      <span>
                        {tx(
                          optimisation.verification.passed
                            ? "✓ MODEL GATES PASSED"
                            : "! NO FEASIBLE PLAN",
                        )}
                      </span>
                      <strong>{tx(optimisation.status)}</strong>
                      <small>
                        {tx(optimisation.evaluations)}
                        {tx(" evaluations · revision")}
                        {tx(" ")}
                        {tx(optimisation.revision)}
                      </small>
                    </div>
                    {tx(
                      stalePlan && (
                        <p className="warning">
                          {tx(
                            "Expired context. Recompute against the current state.",
                          )}
                        </p>
                      ),
                    )}
                    <Pair
                      label={tx("Baseline heat / 3 h")}
                      value={`${fmt(optimisation.baseline.heatKwh, 1)} kWh`}
                    />
                    <Pair
                      label={tx("Proposed heat / 3 h")}
                      value={`${fmt(optimisation.bestAttempt.heatKwh, 1)} kWh`}
                    />
                    <Pair
                      label={tx("Lowest trajectory temperature")}
                      value={`${fmt(optimisation.bestAttempt.minimumC, 2)} °C`}
                    />
                    <Pair
                      label={tx("End minimum temperature")}
                      value={`${fmt(optimisation.bestAttempt.endMinimumC, 2)} °C`}
                    />
                    <Pair
                      label={tx("Maximum numerical residual")}
                      value={optimisation.verification.maxResidual.toExponential(
                        2,
                      )}
                    />
                    <h3>{tx("Computed schedule")}</h3>
                    {tx(
                      optimisation.bestAttempt.schedule.map((s) => (
                        <div className="schedule" key={s.minute}>
                          <b>
                            +{tx(s.minute)}
                            {tx(" min")}
                          </b>
                          <span>
                            {tx(fmt(s.supplyC, 1))}
                            {tx("°C · ")}
                            {tx(fmt(s.pumpHz, 1))}
                            {tx(" Hz")}
                          </span>
                          <small>
                            {tx("Valves ")}
                            {tx(s.valvesPct.map((v) => fmt(v, 0)).join(" / "))}%
                          </small>
                        </div>
                      )),
                    )}
                    <div className="dock-actions">
                      <button
                        disabled={!plan || stalePlan || !!busy}
                        onClick={() => {
                          setForecastSide("intervention");
                          setTimeMode("forecast");
                          setTimeIndex(0);
                          setPlaying(false);
                        }}
                      >
                        {tx("Preview in district")}
                      </button>
                      <button
                        className="primary"
                        disabled={
                          !plan || stalePlan || !!busy || timeMode !== "current"
                        }
                        onClick={() => setConfirm(true)}
                      >
                        {tx("Approve simulator step…")}
                      </button>
                    </div>
                    <p className="muted">
                      {tx(optimisation.verification.scope)}
                      {tx(
                        ". No field command. No global optimality or savings guarantee.",
                      )}
                    </p>
                  </>
                ),
              )}
            </>
          ),
        )}
        {tx(
          panel === "connection" && (
            <>
              <p className="muted">
                {tx("Running release ")}
                {tx(config.release || "older build")}
                {tx(" · AI")}
                {tx(" ")}
                {tx(
                  config.aiConfigured
                    ? "provider key configured"
                    : "OPENROUTER_API_KEY missing",
                )}
                {tx(" ")}·{tx(" ")}
                {tx(
                  config.accessCodeRequired
                    ? "optional operator password enabled"
                    : "no operator password required",
                )}
              </p>
              <div className="verification">
                <span>
                  {tx(feed?.status?.toUpperCase() || "NOT CONNECTED")}
                </span>
                <strong>{tx("Read-only observation gateway")}</strong>
                <small>
                  {tx(
                    config.telemetryConfigured
                      ? "Gateway token configured"
                      : "Set TELEMETRY_INGEST_TOKEN on the server",
                  )}
                </small>
              </div>
              <p>
                {tx(
                  "Measurements remain separate from the uncalibrated simulator. A received value is not proof of a commissioned site connection.",
                )}
                {tx(
                  twin.cityId !== "yinchuan" &&
                    " The observation gateway is scoped to the Yinchuan reference; it is not mapped to this fictional district.",
                )}
              </p>
              <label>
                {tx("Operator access code")}
                <input
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                disabled={!!busy || !code || twin.cityId !== "yinchuan"}
                onClick={() =>
                  void work("Reading observations", async () =>
                    setFeed(await api<Feed>("telemetry", {}, code)),
                  )
                }
              >
                {tx("Read latest observations")}
              </button>
              {tx(
                feed && (
                  <>
                    <p className="muted">{tx(feed.scope)}</p>
                    {tx(
                      feed.observations.map((r) => (
                        <div className="observation" key={r.assetId + r.metric}>
                          <button onClick={() => select(r.assetId)}>
                            {tx(r.assetId)}
                          </button>
                          <strong>
                            {tx(r.metric)}: {tx(fmt(r.value, 2))} {tx(r.unit)}
                          </strong>
                          <small>
                            {tx(r.stale ? "STALE" : r.quality.toUpperCase())} ·
                            {tx(" ")}
                            {tx(Math.round(r.ageSeconds))}
                            {tx(" s old · ")}
                            {tx(r.source)}
                          </small>
                        </div>
                      )),
                    )}
                    {tx(
                      !feed.observations.length && (
                        <p>{tx("No measurements received.")}</p>
                      ),
                    )}
                    <p className="muted">{tx(feed.retention)}</p>
                  </>
                ),
              )}
              <h3>{tx("Gateway contract")}</h3>
              <p className="muted">
                {tx(
                  "POST /api/telemetry/ingest with X-Telemetry-Token. Explicit site, asset, metric, unit, timestamp, quality and source are required. Latest observations refresh every 10 seconds while this panel is open and authenticated.",
                )}
              </p>
              <h3>{tx("Detailed district geometry")}</h3>
              <label className="file-button">
                {tx("Import local self-contained GLB")}
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
              {tx(
                importName && (
                  <>
                    <p>{tx(importName)}</p>
                    <button
                      onClick={() => {
                        setImported(null);
                        setImportName("");
                      }}
                    >
                      {tx("Restore vision district")}
                    </button>
                  </>
                ),
              )}
              <p className="muted">
                {tx(
                  "Local visual inspection only. Imported model is centred for viewing, not georeferenced or linked to instruments; asset labels are hidden until a surveyed mapping exists.",
                )}
              </p>
            </>
          ),
        )}
        {tx(
          panel === "sources" && (
            <>
              <button className="full" onClick={openStudio}>
                {tx("Open source BIM library ↗")}
              </button>
              <p className="muted">
                {tx(
                  "Optional public geometry reference. Operate the mapped heating equipment through the equipment workbench.",
                )}
              </p>
              <h3>{tx("Vision, geometry and identity")}</h3>
              <p>
                {tx(twin.city?.district || visionGeometry.name)}
                {tx(
                  ". Art-directed architecture and mechanical design with adapted public facade and vegetation meshes. Local design coordinates, not a surveyed reconstruction.",
                )}
              </p>
              <p className="muted">
                {tx(
                  "The twelve connected buildings are aggregate thermal archetypes. Visual floor counts and equipment assemblies are design representations, not measured asset specifications.",
                )}
              </p>
              <h3>{tx("Physically based materials")}</h3>
              <p>
                {tx(
                  "The live scene uses a Poly Haven apartment facade kit, textured trees and shrubs, and outdoor HDR lighting. These are adapted visual assets, not measured buildings or a photoreal reconstruction of the reference image.",
                )}
              </p>
              <a
                href="/visual-models/manifest.json"
                target="_blank"
                rel="noreferrer"
              >
                {tx("3D asset sources and preparation ↗")}
              </a>
              <p>
                {tx("Asphalt, snow, concrete and paving textures by")}
                {tx(" ")}
                <a
                  href="https://polyhaven.com/license"
                  target="_blank"
                  rel="noreferrer"
                >
                  {tx("Poly Haven · CC0")}
                </a>
                {tx(
                  ". Files are served locally; no live asset service is required.",
                )}
              </p>
              <a
                href="/vision-materials/manifest.json"
                target="_blank"
                rel="noreferrer"
              >
                {tx("Material sources and checksums ↗")}
              </a>
              <h3>{tx("Geographic research context")}</h3>
              <p>
                {tx(twin.city?.climate)}. {tx(twin.city?.scope)}
              </p>
              {tx(
                twin.cityId === "yinchuan" && (
                  <>
                    <p className="muted">
                      {tx(
                        "The retained OSM extract informed the earlier geographic study; it is not the current scene geometry.",
                      )}
                    </p>
                    <a href={geo.url} target="_blank" rel="noreferrer">
                      {tx("© OpenStreetMap contributors · ODbL")}
                    </a>
                    <p className="muted">
                      {tx("Research extract: ")}
                      {tx(geo.extractTimestamp)}.
                    </p>
                  </>
                ),
              )}
              <a
                href={twin.city?.source || config.site.source}
                target="_blank"
                rel="noreferrer"
              >
                {tx(twin.city?.name || "Yinchuan")}
                {tx(" published context ↗")}
              </a>
              {tx(
                twin.city?.technologySource && (
                  <p>
                    <a
                      href={twin.city.technologySource}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tx("Shanghai heat-pump field study ↗")}
                    </a>
                  </p>
                ),
              )}
              <p className="muted">
                {tx(
                  "All scenario temperatures, solar inputs, building loads and equipment settings are simulation assumptions—not live city data.",
                )}
              </p>
              <h3>{tx("Model scope")}</h3>
              {tx(
                twin.assumptions.map((a) => (
                  <p className="scope-item" key={a}>
                    {tx(a)}
                  </p>
                )),
              )}
              <h3>{tx("System profiles")}</h3>
              {tx(
                config.site.profiles.map((p) => (
                  <div className="schedule" key={p.id}>
                    <b>{tx(p.name)}</b>
                    <span>{tx(p.system)}</span>
                    <small>
                      {tx(
                        p.enabled
                          ? p.id === (twin.cityId || "yinchuan")
                            ? "CURRENT DEMONSTRATOR"
                            : "AVAILABLE IN CITY SELECTOR"
                          : "REQUIRES DIFFERENT EQUIPMENT MODELS",
                      )}
                    </small>
                  </div>
                )),
              )}
              <button
                className="full"
                onClick={() =>
                  download("heatpilot-world-evidence.json", {
                    site: {
                      ...config.site,
                      ...twin.city,
                      id: `${twin.cityId || "yinchuan"}-reference`,
                    },
                    registry: config.registry,
                    state: twin,
                    selected,
                    equipment: sceneView === "plant" ? equipment : null,
                    visionGeometry: {
                      ...visionGeometry,
                      name: twin.city?.district,
                      scope: twin.city?.scope,
                      geometryRevision: twin.city?.geometryRevision,
                    },
                    timeMode,
                    displayTime: frame.time,
                    geographicResearch:
                      twin.cityId !== "yinchuan"
                        ? {
                            source: twin.city?.source,
                            technologySource: twin.city?.technologySource,
                            scope:
                              "Published context only; no geographic survey data for this city",
                          }
                        : {
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
                {tx("Export world evidence")}
              </button>
              <p className="muted">
                {tx(
                  "Exports omit access codes and provider keys. Field observations are not included in this public-demonstrator export.",
                )}
              </p>
            </>
          ),
        )}
      </aside>
      <section
        className="ops-timeline"
        aria-label={tx("Shared world timeline")}
      >
        <div className="timeline-top">
          <div>
            <span className="eyebrow">{tx("SHARED TIME CONTEXT")}</span>
            <strong>
              {tx(frame.time.slice(0, 10))}{" "}
              <span>{tx(frame.time.slice(11, 16))}</span>
            </strong>
          </div>
          <div className="segmented">
            <button aria-pressed={timeMode === "current"} onClick={current}>
              {tx("Current simulation")}
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
              {tx("Replay")}
            </button>
            <button
              aria-pressed={timeMode === "forecast"}
              disabled={!plan || stalePlan}
              onClick={() => {
                setForecastSide("intervention");
                setTimeMode("forecast");
                setTimeIndex(0);
                setPlaying(false);
              }}
            >
              {tx("Forecast")}
            </button>
          </div>
          <select
            aria-label={tx("Simulation scenario")}
            value={twin.scenario}
            disabled={!!busy}
            onChange={(e) => {
              void resetWorld(twin.cityId || "yinchuan", e.target.value);
            }}
          >
            {tx(
              Object.entries(scenarioNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {tx(name)}
                </option>
              )),
            )}
          </select>
          <button
            aria-pressed={playing}
            disabled={!!busy || timeMode !== "current"}
            onClick={() => setPlaying((x) => !x)}
          >
            {tx(playing ? "Ⅱ Pause" : "▷ Auto-step")}
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
            {tx("+30 min")}
          </button>
        </div>
        <div className="timeline-plot">
          <div>
            <span>
              {tx(building ? selected : "District mean")}
              {tx(" / indoor °C")}
            </span>
            <small>
              {tx(
                timeMode === "forecast"
                  ? `${forecastSide === "baseline" ? "CONTINUE UNCHANGED" : "WITH INTERVENTION"} · computed 30-minute samples`
                  : "Recorded simulation · not field telemetry",
              )}
            </small>
          </div>
          <svg
            viewBox="0 0 800 75"
            preserveAspectRatio="none"
            aria-label={tx("Temperature history")}
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
            {tx(
              displaySeries.length === 1 && (
                <circle
                  cx="10"
                  cy={65 - ((displaySeries[0] - lo) / (hi - lo)) * 55}
                  r="3"
                  fill="#6fddc7"
                />
              ),
            )}
          </svg>
        </div>
        {tx(
          timeMode !== "current" && (
            <input
              aria-label={tx("Timeline sample")}
              type="range"
              min={0}
              max={Math.max(
                0,
                (timeMode === "forecast" ? forecast.length : frames.length) - 1,
              )}
              value={timeIndex}
              onChange={(e) => setTimeIndex(Number(e.target.value))}
            />
          ),
        )}
      </section>
      {tx(
        (busy || error) && (
          <div
            className={`status-toast ${error ? "error" : ""}`}
            role={error ? "alert" : "status"}
          >
            {tx(busy && <span className="spinner" />)}
            {tx(error || busy)}
            {tx(
              error && (
                <button
                  aria-label={tx("Dismiss error")}
                  onClick={() => setError("")}
                >
                  ×
                </button>
              ),
            )}
          </div>
        ),
      )}
      {tx(
        confirm && (
          <div className="modal-backdrop">
            <section
              className="approval-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="approval-title"
            >
              <h2 id="approval-title">{tx("Approve simulator change?")}</h2>
              <p>
                {tx(
                  "Apply the first control block for the next 30 simulated minutes. This does not command any real equipment. The server revalidates the full plan and rejects expired or changed-state approvals.",
                )}
              </p>
              <p className="muted">
                {tx("Plan ")}
                {tx(plan?.planHash.slice(0, 16))}
                {tx(" · revision")}
                {tx(" ")}
                {tx(optimisation?.revision)}
              </p>
              <div className="dock-actions">
                <button onClick={() => setConfirm(false)}>
                  {tx("Cancel")}
                </button>
                <button
                  className="primary"
                  disabled={!!busy || stalePlan || !plan}
                  onClick={() => void applyControls()}
                >
                  {tx("Apply to simulation only")}
                </button>
              </div>
            </section>
          </div>
        ),
      )}
      {bimVisited && (
        <Suspense
          fallback={
            bimOpen ? (
              <div className="status-toast">
                {tx("Loading BIM viewer…")}
                <button onClick={() => setBimOpen(false)}>
                  {tx("Return to district ×")}
                </button>
              </div>
            ) : null
          }
        >
          <ConnectedStudio
            open={bimOpen}
            twin={twin}
            selected={selected}
            busy={!!busy}
            canRun={!!config?.aiConfigured}
            mission={mission}
            error={error}
            onClose={() => setBimOpen(false)}
            onSelect={(id) => {
              select(id);
              if (id === "ST01") setSceneView("plant");
              else setSceneView("district");
            }}
            onInvestigate={(role, evidence) =>
              void startMission(
                true,
                false,
                translate(
                  "Review the attached engineering evidence against the selected heat supply circuit. Distinguish reference geometry from simulated operation; test a relevant physical hypothesis and propose a verified intervention only if supported.",
                ),
                role,
                evidence,
              )
            }
            onOperate={() => {
              setBimOpen(false);
              openControls();
            }}
            onPlan={() => {
              setBimOpen(false);
              setPanel("agents");
            }}
          />
        </Suspense>
      )}
    </main>
  );
}
