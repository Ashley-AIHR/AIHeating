import { useEffect, useMemo, useRef, useState } from "react";
import EngineeringScene from "./EngineeringScene";
import {
  outageImpact,
  substationId,
  shortestRoute,
  validateGlb,
  type Asset,
  type BimModel,
  type Measurement,
  type Network,
  type Pose,
} from "./model";
import "./engineering.css";

const format = (n: number, d = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-GB", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : "—";
function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="eng-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function EngineeringWorkspace() {
  const [bim, setBim] = useState<BimModel | null>(null),
    [network, setNetwork] = useState<Network | null>(null),
    [error, setError] = useState("");
  const [mode, setMode] = useState<"bim" | "network">("bim"),
    [selected, setSelected] = useState(""),
    [kind, setKind] = useState("all"),
    [search, setSearch] = useState("");
  const [hidden, setHidden] = useState<string[]>([]),
    [isolated, setIsolated] = useState<string | null>(null),
    [clipAxis, setClipAxis] = useState<"none" | "x" | "y" | "z">("none"),
    [clipPercent, setClipPercent] = useState(50);
  const [measure, setMeasure] = useState(false),
    [measurements, setMeasurements] = useState<Measurement[]>([]),
    [removed, setRemoved] = useState<string[]>([]),
    [route, setRoute] = useState<{ pipes: string[]; length: number }>({
      pipes: [],
      length: 0,
    });
  const [command, setCommand] = useState<{
    id: number;
    type: "fit" | "top" | "focus" | "restore";
    pose?: Pose;
  }>({ id: 0, type: "fit" });
  const [pose, setPose] = useState<Pose | null>(null),
    [views, setViews] = useState<
      {
        name: string;
        mode: string;
        source: string;
        pose: Pose;
        selected: string;
      }[]
    >([]);
  const [showEvidence, setShowEvidence] = useState(false),
    [localGlb, setLocalGlb] = useState<ArrayBuffer | null>(null),
    [localName, setLocalName] = useState(""),
    [localHash, setLocalHash] = useState(""),
    [localAssets, setLocalAssets] = useState<Asset[]>([]),
    [importing, setImporting] = useState(false);
  const [note, setNote] = useState(""),
    [issues, setIssues] = useState<
      { asset: string; note: string; source: string }[]
    >([]),
    [tab, setTab] = useState<"inspect" | "review">("inspect");
  const fileInput = useRef<HTMLInputElement>(null),
    evidenceDialog = useRef<HTMLDialogElement>(null);
  async function loadData() {
    setError("");
    try {
      const [a, b] = await Promise.all([
        fetch("/engineering-assets/duplex-mep.json"),
        fetch("/engineering-assets/opendhn.json"),
      ]);
      if (!a.ok || !b.ok)
        throw new Error("Engineering datasets could not be loaded.");
      const m: BimModel = await a.json(),
        n: Network = await b.json();
      setBim(m);
      setNetwork(n);
      setSelected(
        m.assets.find((x) => x.kind === "IfcFlowMovingDevice")?.id ??
          m.assets[0]?.id ??
          "",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    void loadData();
  }, []);
  useEffect(() => {
    if (showEvidence) evidenceDialog.current?.showModal();
    else evidenceDialog.current?.close();
  }, [showEvidence]);
  const assets = localGlb ? localAssets : (bim?.assets ?? []);
  const sourceHash =
    mode === "network"
      ? (network?.sourceSha256 ?? "")
      : localGlb
        ? localHash
        : (bim?.sourceSha256 ?? "");
  const asset = assets.find((a) => a.id === selected),
    pipe = network?.pipes.find((p) => p.id === selected);
  const station = network?.substations.find(
    (s) => substationId(s) === selected,
  );
  const plant = network?.plants.find((p) => p.hs_id === selected);
  const kinds =
    mode === "bim"
      ? [...new Set(assets.map((a) => a.kind))].sort()
      : ["Supply pipe", "Return pipe", "Heat source", "Substation"];
  const register = useMemo(
    () =>
      mode === "bim"
        ? [...assets]
            .sort((a, b) => {
              const priority = (kind: string) =>
                kind === "IfcFlowMovingDevice"
                  ? 0
                  : kind === "IfcEnergyConversionDevice"
                    ? 1
                    : kind === "IfcFlowController"
                      ? 2
                      : 3;
              return priority(a.kind) - priority(b.kind);
            })
            .map((a) => ({ id: a.id, name: a.name, kind: a.kind }))
        : [
            ...(network?.pipes.map((p) => ({
              id: p.id,
              name: `${p.supply ? "Supply" : "Return"} · ${format(p.length)} m · Ø ${format(p.diameter * 1000, 0)} mm`,
              kind: p.supply ? "Supply pipe" : "Return pipe",
            })) ?? []),
            ...(network?.plants.map((p) => ({
              id: p.hs_id,
              name: "Published heat-source node",
              kind: "Heat source",
            })) ?? []),
            ...(network?.substations.map((s) => ({
              id: substationId(s),
              name: "Published substation connection",
              kind: "Substation",
            })) ?? []),
          ],
    [assets, network, mode],
  );
  const results = register.filter(
    (a) =>
      (kind === "all" || a.kind === kind) &&
      `${a.id} ${a.name} ${a.kind}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const affected = useMemo(
    () => (network ? outageImpact(network, new Set(removed)) : []),
    [network, removed],
  );
  const visualRemoved = useMemo(
    () => (mode === "network" ? [...removed, ...affected] : []),
    [mode, removed, affected],
  );
  const connections =
    asset && !localGlb
      ? (bim?.connections.filter(
          (c) => c.fromAsset === asset.id || c.toAsset === asset.id,
        ) ?? [])
      : [];
  function camera(type: "fit" | "top" | "focus" | "restore", saved?: Pose) {
    setCommand((c) => ({ id: c.id + 1, type, pose: saved }));
  }
  function changeMode(next: "bim" | "network", force = false) {
    if (next === mode && !force) return;
    setMode(next);
    setKind("all");
    setSearch("");
    setHidden([]);
    setIsolated(null);
    setClipAxis("none");
    setMeasure(false);
    setMeasurements([]);
    setRoute({ pipes: [], length: 0 });
    setSelected(
      next === "bim"
        ? (assets.find((a) => a.kind === "IfcFlowMovingDevice")?.id ??
            assets[0]?.id ??
            "")
        : (network?.pipes[0]?.id ?? ""),
    );
    setTab("inspect");
  }
  async function importFile(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      setError(
        "The local GLB limit is 50 MiB. Split or optimise a larger assembly first.",
      );
      return;
    }
    setImporting(true);
    setError("");
    try {
      const bytes = await file.arrayBuffer();
      validateGlb(bytes);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      setLocalHash(
        [...new Uint8Array(digest)]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join(""),
      );
      setLocalName(file.name);
      setLocalAssets([]);
      setLocalGlb(bytes);
      changeMode("bim", true);
      setSelected("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function report() {
    download(
      {
        schema: "heatpilot-engineering-review-v1",
        createdAt: new Date().toISOString(),
        scope:
          "Engineering demonstrator. No live telemetry, field actuation or safe-isolation authorisation.",
        mode,
        source: {
          name:
            mode === "network"
              ? network?.title
              : localGlb
                ? localName
                : bim?.title,
          sha256: sourceHash,
          url:
            mode === "network"
              ? network?.sourceUrl
              : localGlb
                ? null
                : bim?.sourceUrl,
        },
        selected,
        selection: mode === "bim" ? asset : (pipe ?? station ?? plant),
        measurements: mode === "bim" ? measurements : [],
        measurementBasis:
          "Mesh surface coordinates in metres; not certified survey/tolerance measurements.",
        view: pose,
        savedViews: views.filter((v) => v.source === sourceHash),
        hidden,
        isolated,
        section: { axis: clipAxis, percent: clipPercent },
        networkScreen:
          mode === "network"
            ? {
                removedPipes: removed,
                affectedSubstations: affected,
                route,
                interpretation:
                  "Undirected graph reachability to either heat source, using published topology. No valve state, direction, pressure, thermal or field-safety validation.",
              }
            : null,
        issues: issues.filter((i) => i.source === sourceHash),
      },
      "heatpilot-engineering-review.json",
    );
  }
  const title = mode === "network" ? "District topology" : "Mechanical BIM";
  return (
    <div className="eng-app">
      <header className="eng-header">
        <a className="eng-brand" href="/">
          h
          <span>
            HeatPilot<small>ENGINEERING WORKSPACE</small>
          </span>
        </a>
        <nav aria-label="Engineering datasets">
          <button
            aria-pressed={mode === "bim"}
            onClick={() => changeMode("bim")}
          >
            Mechanical BIM
          </button>
          <button
            aria-pressed={mode === "network"}
            onClick={() => changeMode("network")}
          >
            District topology
          </button>
          <a href="/reference">Simulation & AI ↗</a>
        </nav>
        <button className="eng-outline" onClick={() => setShowEvidence(true)}>
          Sources & scope
        </button>
      </header>
      <div className="eng-titlebar">
        <div>
          <span className="eng-eyebrow">
            PUBLIC ENGINEERING DEMONSTRATOR /{" "}
            {mode === "bim" ? "IFC → GLB" : "PUBLISHED NETWORK GRAPH"}
          </span>
          <h1>
            {title}
            <span>FULL 3D</span>
          </h1>
          <p>
            {mode === "bim"
              ? localGlb
                ? `${localName} · local import · source units must be verified`
                : "Imported MEP coordination model · source geometry and IFC identities retained"
              : "OpenDHN / Verbier · 2 heat sources · 150 substations · independent network benchmark"}
          </p>
        </div>
        <div className="eng-title-actions">
          <input
            ref={fileInput}
            type="file"
            accept=".glb"
            aria-label="Import local GLB file"
            className="eng-file"
            onChange={(e) => {
              if (e.target.files?.[0]) void importFile(e.target.files[0]);
            }}
          />
          <button
            className="eng-outline"
            disabled={importing}
            onClick={() => fileInput.current?.click()}
          >
            {importing ? "Checking file…" : "Import GLB"}
          </button>
          <button
            className="eng-primary"
            disabled={!bim || !network}
            onClick={report}
          >
            Export review ↗
          </button>
        </div>
      </div>
      {error && (
        <div className="eng-error" role="alert">
          {error}
          <button onClick={() => void loadData()}>Retry dataset load</button>
        </div>
      )}
      <div className="eng-scope-bar">
        <i />
        <strong>
          {mode === "bim"
            ? "Engineering geometry, not live equipment"
            : "Topology analysis, not a safe-isolation procedure"}
        </strong>
        <span>
          {mode === "bim"
            ? "No readings are assigned to imported components without a validated mapping."
            : "Node coordinates are anonymised; elevations are absent and pipe glyph widths are exaggerated."}
        </span>
      </div>
      <div className="eng-layout">
        <aside className="eng-register">
          <div className="eng-panel-heading">
            <h2>Asset register</h2>
            <span>{register.length}</span>
          </div>
          <label className="eng-search">
            <span>⌕</span>
            <input
              aria-label="Search assets"
              placeholder="Find asset, name or IFC class"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="eng-filter">
            Discipline / class
            <select
              aria-label="Filter asset class"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="all">All classes</option>
              {kinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <div className="eng-register-caption">
            {results.length} matches · {Math.min(200, results.length)} shown
          </div>
          <div className="eng-asset-list" aria-label="Engineering asset list">
            {results.slice(0, 200).map((a) => (
              <button
                  key={a.id}
                  aria-label={`Inspect ${a.id}: ${a.name}`}
                  aria-pressed={selected === a.id}
                onClick={() => {
                  setSelected(a.id);
                  setTab("inspect");
                }}
              >
                <span className="eng-class-icon">
                  {a.kind === "Supply pipe"
                    ? "S"
                    : a.kind === "Return pipe"
                      ? "R"
                      : a.kind.includes("Moving")
                        ? "P"
                        : "◇"}
                </span>
                <span>
                  <strong>{mode === "network" ? a.id : a.name}</strong>
                  <small>
                    {mode === "network"
                      ? a.name
                      : a.kind.replace("Ifc", "") + " · " + a.id.slice(0, 8)}
                  </small>
                </span>
                {hidden.includes(a.id) && <em>hidden</em>}
              </button>
            ))}
            {!results.length && <p>No assets match this filter.</p>}
          </div>
          <div className="eng-register-bottom">
            <strong>
              {mode === "bim"
                ? "Persistent source identity"
                : "Published graph parameters"}
            </strong>
            <p>
              {mode === "bim"
                ? "IFC GlobalIds are retained through conversion. Local meshes without IDs use mesh names."
                : "Lengths, diameters and insulation are imported from the dataset—not derived from the display."}
            </p>
            {localGlb && (
              <button
                onClick={() => {
                  setLocalGlb(null);
                  setKind("all");
                  setSearch("");
                  setMeasure(false);
                  setLocalName("");
                  setLocalAssets([]);
                  setSelected(bim?.assets[0]?.id ?? "");
                  setMeasurements([]);
                  setHidden([]);
                  setIsolated(null);
                  setClipAxis("none");
                }}
              >
                Return to public BIM
              </button>
            )}
          </div>
        </aside>
        <main className="eng-centre">
          <div className="eng-tools">
            <div>
              <button onClick={() => camera("fit")}>⊞ Fit all</button>
              <button onClick={() => camera("top")}>⌑ Plan</button>
              <button disabled={!selected} onClick={() => camera("focus")}>
                ⌖ Focus
              </button>
              <span className="eng-tool-divider" />
              <button
                aria-pressed={measure}
                disabled={mode !== "bim"}
                onClick={() => setMeasure(!measure)}
              >
                ↔ Measure
              </button>
              <button
                disabled={!selected}
                aria-pressed={!!isolated}
                onClick={() => setIsolated(isolated ? null : selected)}
              >
                ◈ Isolate
              </button>
              <button
                disabled={!selected}
                onClick={() =>
                  setHidden((h) =>
                    h.includes(selected)
                      ? h.filter((id) => id !== selected)
                      : [...h, selected],
                  )
                }
              >
                {hidden.includes(selected) ? "Show asset" : "Hide asset"}
              </button>
            </div>
            <button
              onClick={() =>
                void document
                  .querySelector(".eng-viewport")
                  ?.requestFullscreen()
                  .catch(() =>
                    setError("Fullscreen is unavailable in this browser."),
                  )
              }
            >
              ⛶ Fullscreen
            </button>
          </div>
          <EngineeringScene
            mode={mode}
            bim={bim}
            network={network}
            localGlb={localGlb}
            selected={selected}
            kind={kind}
            hidden={hidden}
            isolated={isolated}
            highlight={route.pipes}
            removed={visualRemoved}
            clipAxis={clipAxis}
            clipPercent={clipPercent}
            measure={measure}
            command={command}
            onSelect={(id) => {
              setSelected(id);
              setTab("inspect");
            }}
            onMeasure={(m) => setMeasurements((ms) => [...ms, m])}
            onPose={setPose}
            onLocalAssets={setLocalAssets}
          />
          <div className="eng-section">
            <label>
              Section plane
              <select
                aria-label="Section axis"
                value={clipAxis}
                onChange={(e) => setClipAxis(e.target.value as typeof clipAxis)}
              >
                <option value="none">Off</option>
                <option value="x">X / longitudinal</option>
                <option value="y">Y / horizontal</option>
                <option value="z">Z / transverse</option>
              </select>
            </label>
            <input
              aria-label="Section position"
              type="range"
              min="0"
              max="100"
              value={clipPercent}
              disabled={clipAxis === "none"}
              onChange={(e) => setClipPercent(Number(e.target.value))}
            />
            <output>
              {clipAxis === "none" ? "No section" : `${clipPercent}%`}
            </output>
            <button
              onClick={() => {
                setHidden([]);
                setIsolated(null);
                setKind("all");
                setClipAxis("none");
                setMeasure(false);
                camera("fit");
              }}
            >
              Reset visibility
            </button>
          </div>
          {measure && (
            <div className="eng-measure-prompt">
              Measurement mode: select two visible mesh surfaces. Orbit first if
              necessary. Values describe tessellated geometry, not certified
              clearances.
            </div>
          )}
          <div className="eng-analysis">
            <div className="eng-panel-heading">
              <h2>
                {mode === "bim" ? "Geometry review" : "Pipe outage screen"}
              </h2>
              <span>
                {mode === "bim"
                  ? "MODEL SPACE / METRES"
                  : "GRAPH CONNECTIVITY ONLY"}
              </span>
            </div>
            {mode === "bim" ? (
              <div className="eng-review-grid">
                <div>
                  <h3>Measurements</h3>
                  {!measurements.length ? (
                    <p>
                      Select Measure, then pick two surfaces. The viewer records
                      a 3D chord—not a pipe route length.
                    </p>
                  ) : (
                    <ol>
                      {measurements.slice(-5).map((m, i) => (
                        <li key={i}>
                          <strong>{format(m.distance, 3)} m</strong>
                          <span>Surface-to-surface chord</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <button
                    className="eng-text-button"
                    disabled={!measurements.length}
                    onClick={() => {
                      setMeasurements([]);
                      setMeasure(false);
                    }}
                  >
                    Clear measurements
                  </button>
                </div>
                <div>
                  <h3>Saved review views</h3>
                  <button
                    className="eng-outline"
                    disabled={!pose}
                    onClick={() =>
                      pose &&
                      setViews((v) => [
                        ...v,
                        {
                          name: `View ${v.length + 1}`,
                          mode,
                          source: sourceHash,
                          pose,
                          selected,
                        },
                      ])
                    }
                  >
                    + Save current viewpoint
                  </button>
                  <div className="eng-view-list">
                    {views
                      .filter((v) => v.source === sourceHash && v.mode === mode)
                      .map((v, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelected(v.selected);
                            camera("restore", v.pose);
                          }}
                        >
                          {v.name} ↗
                        </button>
                      ))}
                  </div>
                  <p>
                    Viewpoints and notes are included in the JSON review export;
                    they remain in memory until exported.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="eng-network-stats">
                  <Value
                    label="Removed pipe edges"
                    value={String(removed.length)}
                  />
                  <Value
                    label="Disconnected substations"
                    value={String(affected.length)}
                  />
                  <Value
                    label="Highlighted path length"
                    value={
                      route.pipes.length ? `${format(route.length)} m` : "—"
                    }
                  />
                </div>
                <p>
                  The graph is treated as undirected. A substation is counted
                  only if it had both source/return connectivity before the
                  outage and loses either afterwards. No hydraulic
                  redistribution, temperature or operational safety is inferred.
                </p>
                {removed.length > 0 && (
                  <div className="eng-outages">
                    {removed.map((id) => (
                      <button
                        key={id}
                        onClick={() =>
                          setRemoved((r) => r.filter((x) => x !== id))
                        }
                      >
                        {id} ×
                      </button>
                    ))}
                    <button onClick={() => setRemoved([])}>
                      Clear all outages
                    </button>
                  </div>
                )}
                {affected.length > 0 && (
                  <p className="eng-impact">
                    Disconnected: {affected.join(", ")}
                  </p>
                )}
              </>
            )}
          </div>
          <footer className="eng-camera-readout">
            Camera:{" "}
            {pose?.position.map((x) => format(x, 1)).join(" / ") ?? "loading"}{" "}
            <span>
              {mode === "bim"
                ? "Y-up · model-space metres"
                : "Plan layout only · no surveyed elevation"}
            </span>
          </footer>
        </main>
        <aside className="eng-inspector">
          <div className="eng-inspector-tabs">
            <button
              aria-pressed={tab === "inspect"}
              onClick={() => setTab("inspect")}
            >
              Inspect
            </button>
            <button
              aria-pressed={tab === "review"}
              onClick={() => setTab("review")}
            >
              Review notes{" "}
              <span>
                {issues.filter((i) => i.source === sourceHash).length}
              </span>
            </button>
          </div>
          {tab === "review" ? (
            <div className="eng-inspector-content">
              <h2>Asset review notes</h2>
              <p>
                Record a question, missing parameter or coordination issue
                against the selected source asset.
              </p>
              <label className="eng-note">
                Note for {selected || "no selection"}
                <textarea
                  rows={5}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Verify service clearance against the manufacturer manual."
                />
              </label>
              <button
                className="eng-primary"
                disabled={!selected || !note.trim()}
                onClick={() => {
                  setIssues((i) => [
                    ...i,
                    { asset: selected, note: note.trim(), source: sourceHash },
                  ]);
                  setNote("");
                }}
              >
                Add review note
              </button>
              {issues
                .filter((i) => i.source === sourceHash)
                .map((issue, i) => (
                  <article className="eng-issue" key={i}>
                    <strong>{issue.asset}</strong>
                    <p>{issue.note}</p>
                  </article>
                ))}
            </div>
          ) : (
            <div className="eng-inspector-content">
              <span className="eng-eyebrow">
                {mode === "bim" ? "SOURCE COMPONENT" : "NETWORK ASSET"}
              </span>
              <h2>
                {mode === "bim"
                  ? (asset?.name ?? "Select a component")
                  : selected || "Select a pipe"}
              </h2>
              <code className="eng-id">{selected || "—"}</code>
              {hidden.includes(selected) && (
                <p className="eng-warning">
                  This asset is hidden from the viewport.
                </p>
              )}
              {mode === "bim" && asset ? (
                <>
                  <div className="eng-quality">
                    <i />
                    <span>
                      {localGlb
                        ? "Local GLB · scale not independently verified"
                        : "Imported IFC geometry · source identity retained"}
                    </span>
                  </div>
                  <Value label="IFC class / mesh class" value={asset.kind} />
                  <Value
                    label="Source EXPRESS ID"
                    value={
                      asset.expressId ? `#${asset.expressId}` : "Not supplied"
                    }
                  />
                  <Value
                    label="Storey"
                    value={asset.storey || "Not assigned"}
                  />
                  <Value
                    label="Systems"
                    value={
                      asset.systems.join(", ") || "No explicit group assignment"
                    }
                  />
                  <h3>Axis-aligned model bounds</h3>
                  {(["X", "Y", "Z"] as const).map((axis, i) => (
                    <Value
                      key={axis}
                      label={`${axis} extent`}
                      value={`${format(asset.bounds[1][i] - asset.bounds[0][i], 3)} m`}
                    />
                  ))}
                  <p className="eng-fine">
                    Bounding-box extents are not nominal product dimensions.
                    Surface measurements depend on tessellation and source-model
                    quality.
                  </p>
                  <h3>Connection evidence</h3>
                  <p>
                    {connections.length
                      ? `${connections.length} explicit IFC port relations reference this component.`
                      : "No explicit IFC port relation is available for this component. Visual contact does not establish a hydraulic connection."}
                  </p>
                  {connections.map((c, i) => (
                    <p key={i}>
                      <code>{c.fromAsset}</code> → <code>{c.toAsset}</code>
                    </p>
                  ))}
                  <div className="eng-no-telemetry">
                    <strong>Telemetry: not mapped</strong>
                    <p>
                      No temperature, pressure, pump duty or condition is
                      inferred from this mesh. Use the separate Chinese-network
                      simulator for its synthetic scenario.
                    </p>
                  </div>
                  <h3>IFC property sets</h3>
                  {Object.entries(asset.properties).map(([name, value]) => (
                    <details key={name}>
                      <summary>{name}</summary>
                      <pre>{JSON.stringify(value, null, 2)}</pre>
                    </details>
                  ))}
                  {!Object.keys(asset.properties).length && (
                    <p>No property sets supplied by this mesh.</p>
                  )}
                </>
              ) : mode === "network" && pipe ? (
                <>
                  <div className="eng-quality">
                    <i />
                    <span>
                      Published parameter record ·{" "}
                      {pipe.supply ? "supply" : "return"} circuit
                    </span>
                  </div>
                  <Value label="Inlet node" value={pipe.from} />
                  <Value label="Outlet node" value={pipe.to} />
                  <Value
                    label="Source pipe length"
                    value={`${format(pipe.length)} m`}
                  />
                  <Value
                    label="Internal diameter"
                    value={`${format(pipe.diameter * 1000, 1)} mm`}
                  />
                  <Value
                    label="Insulation thickness"
                    value={`${format(pipe.insulation * 1000, 1)} mm`}
                  />
                  <Value
                    label="Internal roughness"
                    value={`${format(pipe.roughnessMm, 3)} mm`}
                  />
                  <p className="eng-fine">
                    Pipe length is taken from the source record, not from the
                    screen-space chord. Glyph widths are exaggerated for
                    selection.
                  </p>
                  <h3>Topology tools</h3>
                  <button
                    className="eng-outline eng-wide"
                    onClick={() => {
                      if (network) setRoute(shortestRoute(network, selected));
                    }}
                  >
                    Trace shortest source path
                  </button>
                  <button
                    className="eng-danger eng-wide"
                    onClick={() =>
                      setRemoved((r) =>
                        r.includes(selected)
                          ? r.filter((id) => id !== selected)
                          : [...r, selected],
                      )
                    }
                  >
                    {removed.includes(selected)
                      ? "Restore this edge"
                      : "Test outage of this pipe"}
                  </button>
                  <p className="eng-fine">
                    Outage testing removes a graph edge only. It does not close
                    a valve or command equipment. The route tool uses the intact
                    published graph and source lengths.
                  </p>
                  <div className="eng-no-telemetry">
                    <strong>No live hydraulic state</strong>
                    <p>
                      This view audits the published graph. Flow and
                      temperatures from the separate 12-building simulator are
                      not overlaid onto this unrelated benchmark.
                    </p>
                  </div>
                </>
              ) : mode === "network" && (station || plant) ? (
                <>
                  <div className="eng-quality">
                    <i />
                    <span>
                      {station
                        ? "Published substation endpoints"
                        : "Published heat-source endpoints"}
                    </span>
                  </div>
                  <Value
                    label="Inlet node"
                    value={(station || plant)!.inlet_node}
                  />
                  <Value
                    label="Outlet node"
                    value={(station || plant)!.outlet_node}
                  />
                  {station && (
                    <Value
                      label="Current outage screen"
                      value={
                        affected.includes(selected)
                          ? "Graph connection lost"
                          : "No added disconnection"
                      }
                    />
                  )}
                  <p className="eng-fine">
                    This is a network-node glyph, not a geometric model of the
                    installation. It has no inferred capacity, equipment
                    arrangement or live readings.
                  </p>
                  <h3>Connected pipe records</h3>
                  {network?.pipes
                    .filter((p) =>
                      [p.from, p.to].some(
                        (id) =>
                          id === (station || plant)!.inlet_node ||
                          id === (station || plant)!.outlet_node,
                      ),
                    )
                    .map((p) => (
                      <button
                        className="eng-outline eng-wide"
                        key={p.id}
                        onClick={() => {
                          setSelected(p.id);
                          setKind("all");
                          setSearch(p.id);
                        }}
                      >
                        {p.id} · {format(p.length)} m ↗
                      </button>
                    ))}
                  <p className="eng-fine">
                    Select a connected pipe to inspect its parameters and test a
                    graph outage.
                  </p>
                </>
              ) : (
                <p>
                  Select a mesh or a pipe from the viewport or asset register to
                  inspect its source data.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
      <dialog
        className="eng-dialog"
        ref={evidenceDialog}
        onCancel={() => setShowEvidence(false)}
        aria-labelledby="engineering-scope-title"
      >
        <header>
          <h2 id="engineering-scope-title">Provenance & engineering limits</h2>
          <button
            aria-label="Close provenance"
            onClick={() => setShowEvidence(false)}
          >
            ×
          </button>
        </header>
        <h3>Mechanical BIM</h3>
        <p>
          {bim?.source}.{" "}
          <a href={bim?.sourceUrl} target="_blank" rel="noreferrer">
            Source model ↗
          </a>{" "}
          ·{" "}
          <a href={bim?.licenceUrl} target="_blank" rel="noreferrer">
            {bim?.licence}
          </a>
        </p>
        <p>{bim?.scope}</p>
        <p>{bim?.conversion}</p>
        <div className="eng-network-stats">
          <Value
            label="Source representations"
            value={String(bim?.quality.sourceRepresentations ?? "—")}
          />
          <Value
            label="Converted"
            value={String(bim?.quality.converted ?? "—")}
          />
          <Value
            label="Failed / omitted"
            value={String(bim?.quality.failed ?? "—")}
          />
        </div>
        <p>
          Explicit IFC port connections in source:{" "}
          {bim?.quality.explicitPortConnections ?? "—"}. Unavailable links are
          never inferred from nearby geometry.
        </p>
        {!!bim?.failed.length && (
          <details>
            <summary>Conversion omissions</summary>
            <pre>{JSON.stringify(bim.failed, null, 2)}</pre>
          </details>
        )}
        <h3>District network benchmark</h3>
        <p>
          {network?.source}.{" "}
          <a href={network?.sourceUrl} target="_blank" rel="noreferrer">
            Published dataset ↗
          </a>{" "}
          ·{" "}
          <a href={network?.licenceUrl} target="_blank" rel="noreferrer">
            {network?.licence}
          </a>
        </p>
        <p>{network?.scope}</p>
        <h3>Data boundaries</h3>
        <p>
          These two public datasets are independent. They are not represented as
          a connected installation, a manufacturer-certified heating station or
          a calibrated Chinese secondary-network twin. The existing
          Chinese-network simulation remains available separately.
        </p>
        <h3>Local imports</h3>
        <p>
          Self-contained uncompressed GLB, up to 50 MiB, is parsed in this
          browser. The file is not uploaded. GLB uses metres by convention, but
          its authoring scale and asset identities require verification.
          External resources and unsupported compression are rejected. Convert
          other IFC files offline with IfcOpenShell/IfcConvert, retaining metre
          units and GlobalIds. The supplied reproducibility script is pinned to
          the credited public benchmark; it must not misattribute another site.
        </p>
        <h3>Industrial deployment gate</h3>
        <p>
          Site geometry, reconciled asset IDs, validated connectivity, equipment
          curves, sensor quality, model calibration, access control and
          engineering sign-off are required before operational reliance. These
          tools support review; they do not issue a permit, certify clearances
          or control a plant.
        </p>
      </dialog>
    </div>
  );
}
