import { useRef, useState } from "react";
import districtImage from "./assets/district-reference.png";
import mechanicalImage from "./assets/mechanical-reference.png";
import { fmt, tone, type Twin } from "./types";

export type View = "district" | "mechanical";
export type Layer = "temperature" | "flow" | "assets";
export const mechanicalAssets = [
  {
    id: "HX-01",
    name: "Plate heat exchanger 01",
    x: 21,
    y: 45,
    scope: "geometry",
  },
  {
    id: "HX-02",
    name: "Plate heat exchanger 02",
    x: 43,
    y: 39,
    scope: "geometry",
  },
  {
    id: "PUMP-SET",
    name: "Secondary circulation",
    x: 48,
    y: 69,
    scope: "station",
  },
  { id: "HEADER", name: "Secondary headers", x: 86, y: 46, scope: "station" },
  { id: "MCC", name: "Motor control cabinet", x: 68, y: 38, scope: "geometry" },
] as const;
// Illustrative screen-space anchors, not surveyed coordinates or BIM identities.
const buildingAnchors = [
  [20, 19],
  [28, 24],
  [8, 25],
  [15, 34],
  [49, 25],
  [59, 29],
  [39, 36],
  [50, 44],
  [79, 33],
  [92, 38],
  [76, 50],
  [91, 60],
];
export default function ReferenceScene({
  view,
  twin,
  selectedBuilding,
  selectedMechanical,
  layer,
  onBuilding,
  onMechanical,
  onView,
}: {
  view: View;
  twin: Twin;
  selectedBuilding: string;
  selectedMechanical: string;
  layer: Layer;
  onBuilding: (id: string) => void;
  onMechanical: (id: string) => void;
  onView: (view: View) => void;
}) {
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  function clamp(zoom: number, x: number, y: number) {
    const width = host.current?.clientWidth ?? 0;
    const height = host.current?.clientHeight ?? 0;
    const dx = (width * (zoom - 1)) / 2,
      dy = (height * (zoom - 1)) / 2;
    return {
      zoom,
      x: Math.max(-dx, Math.min(dx, x)),
      y: Math.max(-dy, Math.min(dy, y)),
    };
  }
  function zoomBy(step: number) {
    setCamera((c) => clamp(Math.max(1, Math.min(3, c.zoom + step)), c.x, c.y));
  }
  return (
    <div className="tw-scene-wrap">
      <div
        className="tw-scene"
        ref={host}
        tabIndex={0}
        role="region"
        aria-label={`${view} reference scene. Use plus and minus to zoom, arrow keys to pan, Home to reset.`}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (
            [
              "+",
              "=",
              "-",
              "Home",
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
            ].includes(e.key)
          )
            e.preventDefault();
          if (e.key === "+" || e.key === "=") zoomBy(0.25);
          if (e.key === "-") zoomBy(-0.25);
          if (e.key === "Home") setCamera({ zoom: 1, x: 0, y: 0 });
          const delta: Record<string, [number, number]> = {
            ArrowLeft: [40, 0],
            ArrowRight: [-40, 0],
            ArrowUp: [0, 40],
            ArrowDown: [0, -40],
          };
          if (delta[e.key])
            setCamera((c) =>
              clamp(c.zoom, c.x + delta[e.key][0], c.y + delta[e.key][1]),
            );
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button") || camera.zoom === 1)
            return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            px: camera.x,
            py: camera.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d)
            setCamera((c) =>
              clamp(c.zoom, d.px + e.clientX - d.x, d.py + e.clientY - d.y),
            );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {failed ? (
          <div className="tw-scene-failure">
            <h3>Reference image unavailable</h3>
            <p>The simulator and asset selector below remain available.</p>
          </div>
        ) : (
          <div
            className="tw-scene-plane"
            style={{
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
            }}
          >
            <img
              src={view === "district" ? districtImage : mechanicalImage}
              alt={
                view === "district"
                  ? "AI-generated winter district reference with residential blocks and a cutaway heating station"
                  : "AI-generated mechanical station reference with blue plate heat exchangers, pumps and insulated headers"
              }
              draggable={false}
              onError={() => setFailed(true)}
            />
            {view === "district" ? (
              <>
                {twin.buildings.map((b, i) => (
                  <button
                    key={b.id}
                    className={`tw-pin ${tone(b)} ${selectedBuilding === b.id ? "selected" : ""}`}
                    style={{
                      left: `${buildingAnchors[i]?.[0] ?? 50}%`,
                      top: `${buildingAnchors[i]?.[1] ?? 50}%`,
                    }}
                    onClick={() => onBuilding(b.id)}
                    aria-label={`Inspect ${b.id}`}
                    aria-pressed={selectedBuilding === b.id}
                  >
                    <strong>{b.id}</strong>
                    {layer !== "assets" && (
                      <span>
                        {layer === "flow"
                          ? `${fmt(b.flowM3h)} m³/h`
                          : `${fmt(b.indoorC)} °C`}
                        {b.quality === "suspect" ? " !" : ""}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  className="tw-station-pin"
                  style={{ left: "19%", top: "77%" }}
                  onClick={() => onView("mechanical")}
                >
                  HS-01 <span>Inspect station ↗</span>
                </button>
              </>
            ) : (
              mechanicalAssets.map((a) => (
                <button
                  key={a.id}
                  className={`tw-pin mechanical ${selectedMechanical === a.id ? "selected" : ""}`}
                  style={{ left: `${a.x}%`, top: `${a.y}%` }}
                  onClick={() => onMechanical(a.id)}
                  aria-label={`Inspect ${a.name}`}
                  aria-pressed={selectedMechanical === a.id}
                >
                  <strong>{a.id}</strong>
                  <span>
                    {a.scope === "geometry"
                      ? "Reference only"
                      : a.id === "PUMP-SET"
                        ? `${fmt(twin.pumpHz)} Hz · aggregate`
                        : `${fmt(twin.supplyC)} / ${fmt(twin.returnC)} °C`}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
        <div className="tw-scene-caption">
          INTERACTIVE REFERENCE RENDER{" "}
          <span>Not CAD · illustrative asset mapping</span>
        </div>
      </div>
      <div className="tw-scene-footer">
        <span>
          <i className="tw-pipe hot" />
          Supply <i className="tw-pipe cold" />
          Return <em>Image colours are illustrative</em>
        </span>
        <div className="tw-camera">
          <button
            onClick={() => zoomBy(-0.25)}
            disabled={camera.zoom === 1}
            aria-label="Zoom out"
          >
            −
          </button>
          <output aria-label="Zoom level">
            {Math.round(camera.zoom * 100)}%
          </output>
          <button
            onClick={() => zoomBy(0.25)}
            disabled={camera.zoom === 3}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setCamera({ zoom: 1, x: 0, y: 0 })}
            aria-label="Reset image view"
          >
            ↺
          </button>
        </div>
      </div>
    </div>
  );
}
