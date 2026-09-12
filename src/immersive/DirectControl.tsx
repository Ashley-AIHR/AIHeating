import { tx } from "../localisation";
import { useState } from "react";
import { api, fmt, type Twin } from "../operations/types";
export type CommandPreview = {
  revision: number;
  assetId: string;
  control: string;
  value: number;
  verified: boolean;
  candidateId: string | null;
  reason: string;
  firstStep: Twin;
  baselineStep: Twin;
};
export type OperationEvent = {
  id: number;
  title: string;
  detail: string;
  kind: "command" | "warning" | "failure" | "info";
  asset: string;
  time: string;
};
type Props = {
  state: Twin;
  selected: string;
  equipment: string;
  plant: boolean;
  enabled: boolean;
  busy: boolean;
  onPending: (label: string) => void;
  onApplied: (state: Twin, command: CommandPreview) => void;
  onNotice: (title: string, detail: string, failed: boolean) => void;
  onAgent: () => void;
  onClose: () => void;
};
export default function DirectControl(p: Props) {
  const branch =
    p.state.buildings.find((b) => b.id === p.selected)?.zone ||
    p.state.zones.find((z) => z.id === p.selected)?.id;
  const [stationControl, setStationControl] = useState(
    p.plant && /^(P-|MCC)/.test(p.equipment) ? "pumpHz" : "supplyC",
  );
  const control = branch ? "valvePct" : stationControl;
  const assetId = branch || "ST01";
  const actual = branch
    ? p.state.zones.find((z) => z.id === branch)!.valvePct
    : control === "pumpHz"
      ? p.state.pumpHz
      : p.state.supplyC;
  const ramp = branch ? 10 : 2,
    min = Math.max(branch ? 20 : control === "pumpHz" ? 30 : 40, actual - ramp),
    max = Math.min(
      branch ? 100 : control === "pumpHz" ? 50 : 60,
      actual + ramp,
    );
  const unit = branch ? "%" : control === "pumpHz" ? "Hz" : "°C";
  const [draft, setDraft] = useState<number | null>(null),
    [proposal, setProposal] = useState<CommandPreview | null>(null),
    [error, setError] = useState("");
  const value = draft ?? actual;
  const disabled = !p.enabled || p.busy;
  async function test() {
    p.onPending("Testing manual control against the physical model");
    setError("");
    setProposal(null);
    try {
      const result = await api<CommandPreview>("control/preview", {
        revision: p.state.revision,
        assetId,
        control,
        value,
      });
      setProposal(result);
      p.onNotice(
        result.verified ? "Manual command verified" : "Manual command blocked",
        result.reason,
        !result.verified,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      p.onNotice("Command test failed", message, true);
    } finally {
      p.onPending("");
    }
  }
  async function apply() {
    if (!proposal?.verified) return;
    p.onPending("Sending manual command to simulator");
    try {
      const state = await api<Twin>("apply", {
        candidateId: proposal.candidateId,
      });
      p.onApplied(state, proposal);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setProposal(null);
      p.onNotice("Command rejected", message, true);
    } finally {
      p.onPending("");
    }
  }
  return (
    <section className="direct-control" aria-label={tx("Direct 3D control")}>
      <header>
        <div>
          <small>{tx("MANUAL · SIMULATOR")}</small>
          <strong>
            {tx(
              branch
                ? `${branch.toUpperCase()} branch valve`
                : "Energy centre control",
            )}
          </strong>
        </div>
        <button aria-label={tx("Close 3D control")} onClick={p.onClose}>
          ×
        </button>
      </header>
      {tx(
        branch && p.selected !== branch && (
          <p>
            {tx(p.selected)}
            {tx(
              " is supplied by this branch. Adjusting it affects all four connected buildings.",
            )}
          </p>
        ),
      )}
      {tx(
        !branch && (
          <div className="segmented">
            <button
              aria-pressed={control === "supplyC"}
              onClick={() => {
                setStationControl("supplyC");
                setDraft(null);
                setProposal(null);
              }}
            >
              {tx("Heat supply")}
            </button>
            <button
              aria-pressed={control === "pumpHz"}
              onClick={() => {
                setStationControl("pumpHz");
                setDraft(null);
                setProposal(null);
              }}
            >
              {tx("Pump drive")}
            </button>
          </div>
        ),
      )}
      {tx(
        !branch && (
          <p>
            {tx(
              "Controls the shared station model. Individual duty/standby switching is not represented.",
            )}
          </p>
        ),
      )}
      <div className="control-setpoint">
        <span>
          {tx("Actual")}
          {tx(" ")}
          <b>
            {tx(fmt(actual))} {tx(unit)}
          </b>
        </span>
        <span>
          {tx("Requested")}
          {tx(" ")}
          <b>
            {tx(fmt(value))} {tx(unit)}
          </b>
        </span>
      </div>
      <label>
        {tx("Requested")}
        {tx(" ")}
        {tx(
          branch
            ? "valve opening"
            : control === "pumpHz"
              ? "pump frequency"
              : "supply temperature",
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={branch ? 1 : 0.5}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setDraft(Number(e.target.value));
            setProposal(null);
            setError("");
          }}
        />
      </label>
      <div className="control-range">
        <span>
          {tx(fmt(min, 0))} {tx(unit)}
        </span>
        <span>
          {tx("Step limit ±")}
          {tx(ramp)} {tx(unit)}
        </span>
        <span>
          {tx(fmt(max, 0))} {tx(unit)}
        </span>
      </div>
      {tx(
        !p.enabled && (
          <p className="warning">
            {tx("Return to current simulation to operate this asset.")}
          </p>
        ),
      )}
      <div className="dock-actions">
        <button
          disabled={disabled || value === actual}
          onClick={() => void test()}
        >
          {tx("Test manual change")}
        </button>
        <button
          className="primary"
          disabled={
            disabled ||
            !proposal?.verified ||
            proposal.revision !== p.state.revision
          }
          onClick={() => void apply()}
        >
          {tx("Apply command · +30 min")}
        </button>
      </div>
      {tx(
        proposal && (
          <div
            className={
              proposal.verified
                ? "command-verdict passed"
                : "command-verdict blocked"
            }
            role="status"
          >
            <strong>
              {tx(
                proposal.verified ? "✓ VERIFIED — READY TO APPLY" : "! BLOCKED",
              )}
            </strong>
            <p>{tx(proposal.reason)}</p>
            <span>
              {tx("Predicted flow ")}
              {tx(fmt(proposal.baselineStep.flowM3h))} →{tx(" ")}
              {tx(fmt(proposal.firstStep.flowM3h))}
              {tx(" m³/h")}
            </span>
            <span>
              {tx("Predicted pump ")}
              {tx(fmt(proposal.baselineStep.pumpKw, 2))} →{tx(" ")}
              {tx(fmt(proposal.firstStep.pumpKw, 2))}
              {tx(" kW")}
            </span>
          </div>
        ),
      )}
      {tx(
        error && (
          <p className="warning" role="alert">
            {tx(error)}
          </p>
        ),
      )}
      <button
        className="full control-agent"
        disabled={p.busy}
        onClick={p.onAgent}
      >
        {tx("✧ Let the agent optimise this circuit")}
      </button>
    </section>
  );
}
