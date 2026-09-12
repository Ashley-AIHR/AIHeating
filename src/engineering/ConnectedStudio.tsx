import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import EngineeringWorkspace from "./EngineeringWorkspace";
import type { EngineeringReview } from "./review";
import type { Twin } from "../operations/types";
import type { Mission } from "../immersive/mission";
import { toolNames } from "../immersive/mission";
import { tx, useLocale } from "../localisation";
import "./studio.css";

type Props = {
  open: boolean;
  twin: Twin;
  selected: string;
  busy: boolean;
  canRun: boolean;
  mission: Mission | null;
  error: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onInvestigate: (role: string, review: EngineeringReview) => void;
  onOperate: () => void;
  onPlan: () => void;
};
export default function ConnectedStudio(p: Props) {
  useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const [review, setReview] = useState<EngineeringReview | null>(null);
  useEffect(() => {
    if (p.open && !dialog.current?.open) dialog.current?.showModal();
    else if (!p.open) dialog.current?.close();
  }, [p.open]);
  const branch =
    p.twin.buildings.find((b) => b.id === p.selected)?.zone ||
    p.twin.zones.find((z) => z.id === p.selected)?.id;
  const buildings = p.twin.buildings.filter(
    (b) => !branch || b.zone === branch,
  );
  const zone = p.twin.zones.find((z) => z.id === branch);
  const node = (id: string, label: string) => (
    <button
      key={id}
      aria-pressed={p.selected === id}
      disabled={p.busy}
      onClick={() => p.onSelect(id)}
    >
      {tx(label)}
    </button>
  );
  return createPortal(
    <dialog
      ref={dialog}
      className="bim-studio-shell"
      aria-label={tx("BIM work studio")}
      onCancel={(e) => {
        e.preventDefault();
        p.onClose();
      }}
    >
      <EngineeringWorkspace
        active={p.open}
        onClose={p.onClose}
        onReview={setReview}
        operatingContext={{
          cityId: p.twin.cityId,
          contextId: p.twin.contextId,
          revision: p.twin.revision,
          assetId: p.selected,
        }}
        integration={
          <section
            className="studio-integration"
            aria-label={tx("Connected heat supply chain")}
          >
            <div className="studio-context">
              <small>{tx("SHARED OPERATING CONTEXT")}</small>
              <strong>
                {tx(p.twin.city?.name || "Yinchuan")} · {p.selected} ·{" "}
                {tx("Revision")} {p.twin.revision}
              </strong>
              <span>
                {tx(
                  "Synthetic readings · reference geometry is not instrumented",
                )}
              </span>
              <nav
                className="studio-chain"
                aria-label={tx("Heat supply chain")}
              >
                {node("ST01", "ST01 · Energy centre")}
                <span aria-hidden="true">→</span>
                {(branch
                  ? p.twin.zones.filter((z) => z.id === branch)
                  : p.twin.zones
                ).map((z) => node(z.id, z.id + " branch"))}
                <span aria-hidden="true">→</span>
                {buildings.map((b) => node(b.id, b.id))}
              </nav>
              <div className="studio-readings">
                <span>
                  {tx("Supply temperature")}{" "}
                  <b>{p.twin.supplyC.toFixed(1)} °C</b>
                </span>
                <span>
                  {tx("Return temperature")}{" "}
                  <b>{p.twin.returnC.toFixed(1)} °C</b>
                </span>
                <span>
                  {tx("Circuit flow")}{" "}
                  <b>{(zone?.flowM3h ?? p.twin.flowM3h).toFixed(1)} m³/h</b>
                </span>
                <span>
                  {tx("Connected buildings")} <b>{buildings.length}</b>
                </span>
              </div>
              <p>
                {tx(
                  "Selection follows the district supply chain. BIM picks remain separate reference identities; geometry alone cannot establish a hydraulic connection.",
                )}
              </p>
              <button
                className="eng-outline"
                disabled={p.busy}
                onClick={p.onOperate}
              >
                {tx("Operate selected circuit in 3D")}
              </button>
            </div>
            <div className="studio-agent">
              <small>
                {tx("GEOMETRY REVIEW → AGENT → VERIFIED SIMULATION")}
              </small>
              <p>
                {tx(
                  "The agent receives the selected circuit, source component, review notes and surface measurements alongside current physical evidence.",
                )}
              </p>
              <div className="studio-agent-actions">
                <button
                  className="eng-primary"
                  disabled={p.busy || !p.canRun || !review?.sourceHash}
                  onClick={() =>
                    review && p.onInvestigate("diagnostic", review)
                  }
                >
                  {tx("Investigate with BIM evidence")}
                </button>
                <button
                  className="eng-outline"
                  disabled={p.busy || !p.canRun || !review?.sourceHash}
                  onClick={() =>
                    review && p.onInvestigate("optimisation", review)
                  }
                >
                  {tx("Plan supply-chain intervention")}
                </button>
                <button className="eng-outline" onClick={p.onPlan}>
                  {tx("Review mission & simulation plan")}
                </button>
              </div>
              {!p.canRun && (
                <p>
                  {tx(
                    "Configure the AI provider in Connections to run an agent. Numerical controls remain available.",
                  )}
                </p>
              )}
              {p.error && <p role="alert">{tx(p.error)}</p>}
              {p.mission && (
                <details className="studio-mission" open>
                  <summary>
                    {tx("Shared agent mission")} · {p.mission.assetId} ·{" "}
                    {tx(
                      p.mission.phase === "blocked" &&
                        p.mission.message.startsWith(
                          "Diagnostic investigation complete",
                        )
                        ? "Diagnostic complete"
                        : p.mission.phase,
                    )}
                  </summary>
                  <div
                    className="studio-agent-events"
                    aria-label={tx("Agent tool activity")}
                  >
                    {[
                      ...p.mission.events.filter(
                        (e) => e.tool === "inspect_engineering_review",
                      ),
                      ...p.mission.events
                        .filter((e) => e.tool !== "inspect_engineering_review")
                        .slice(-6),
                    ].map((e, i) => (
                      <div key={i}>
                        {tx(toolNames[e.tool] || e.tool)} · {tx(e.status)}
                      </div>
                    ))}
                  </div>
                  <p
                    className="studio-agent-report"
                    lang={p.mission.locale === "zh-CN" ? "zh-CN" : "en-GB"}
                  >
                    {p.mission.draft || tx(p.mission.message || "")}
                  </p>
                </details>
              )}
            </div>
          </section>
        }
      />
    </dialog>,
    document.body,
  );
}
