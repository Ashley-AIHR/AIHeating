import { useState } from "react";
import { api, type Twin } from "../operations/types";
import { useLocale } from "../localisation";
import type { OperatingGoal, GoalResult } from "./GoalWorkbench";
import type { Optimisation } from "./Workspace";
export type EngineeringStudy = {
  studyId: string;
  revision: number;
  contextId: string;
  assetId: string;
  goal: OperatingGoal;
  preferredId: string | null;
  storedHeatIncreaseKwh: number;
  rows: {
    id: string;
    label: string;
    passed: boolean;
    goalResult: GoalResult;
    heatKwh: number;
    pumpKwh: number;
    auxiliaryKwh: number;
    auxiliaryCapacityKw: number;
    optimisation: Optimisation;
  }[];
};
const names: Record<string, string> = {
  operations: "现有设备协同运行",
  "local-valves": "加装并调试楼栋阀门",
  emitters: "楼栋阀门与散热器UA加倍",
  "emitters-3": "楼栋阀门与散热器UA增至三倍",
  envelope: "楼栋阀门与围护结构改造",
  resistance: "楼栋阀门与支路降阻",
};
export default function EngineeringWorkbench(p: {
  state: Twin;
  goal: OperatingGoal | null;
  selected: string;
  study: EngineeringStudy | null;
  busy: boolean;
  onBusy: (s: string) => void;
  onStudy: (s: EngineeringStudy) => void;
  onState: (s: Twin) => void;
  onPreview: (o: Optimisation) => void;
}) {
  const zh = useLocale() === "zh-CN",
    t = (en: string, cn: string) => (zh ? cn : en);
  const [error, setError] = useState(""),
    [choice, setChoice] = useState<string | null>(null),
    [valve, setValve] = useState(50);
  const sandbox = p.state.engineering;
  const current =
    p.study?.contextId === p.state.contextId &&
    p.study?.revision === p.state.revision &&
    JSON.stringify(p.study?.goal) === JSON.stringify(p.goal)
      ? p.study
      : null;
  const eligible =
    p.goal?.metric === "temperature" &&
    p.goal.scope === "asset" &&
    p.goal.allowShared;
  async function act(fn: () => Promise<void>) {
    p.onBusy(t("Testing engineering alternatives", "正在计算工程方案"));
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      p.onBusy("");
    }
  }
  const building = p.state.buildings.find((b) => b.id === p.selected);
  return (
    <section
      className="engineering-workbench"
      aria-label={t("Engineering alternatives", "工程干预方案")}
    >
      <h3>{t("Engineering alternatives", "工程干预方案")}</h3>
      <p>
        {t(
          "Compare operating changes with physical upgrades. Proposed equipment exists only in an isolated simulation.",
          "比较运行调节与物理改造。新增设备仅存在于独立工程仿真中。",
        )}
      </p>
      {sandbox ? (
        <>
          <strong className="engineering-tag">
            {t(
              "MODIFIED MODEL · NOT FIELD OPERATION",
              "工程修改模型 · 非现场运行",
            )}
          </strong>
          <p>
            {sandbox.goal.assetId} · {sandbox.goal.target}°C ·{" "}
            {t("Original deadline remaining", "原定期限剩余")}{" "}
            {sandbox.remainingMinutes} min
          </p>
          <p>
            {t("Auxiliary electricity used", "累计辅助电耗")}{" "}
            {sandbox.auxiliaryKwh.toFixed(2)} kWh
          </p>
          <button
            disabled={p.busy || sandbox.remainingMinutes <= 0}
            onClick={() =>
              void act(async () => {
                const r = await api<{
                  state: Twin;
                  applied: boolean;
                  optimisation: Optimisation;
                }>("engineering/step", { revision: p.state.revision });
                if (!r.applied) {
                  p.onPreview(r.optimisation);
                  throw Error(
                    t(
                      "Replan missed the original goal; simulation not advanced.",
                      "重规划未满足原目标，仿真未推进。",
                    ),
                  );
                }
                p.onState(r.state);
              })
            }
          >
            {t("Replan and apply next 30 min", "重规划并执行下一段30分钟")}
          </button>
          {sandbox.remainingMinutes <= 0 && (
            <p role="status">
              {t(
                "Deadline reached · inspect actual simulated temperatures",
                "已到原定期限 · 请核对实际仿真室温",
              )}{" "}
              ·{" "}
              {p.state.buildings
                .find((b) => b.id === sandbox.goal.assetId)
                ?.modelC.toFixed(2)}
              °C
            </p>
          )}
          {building && (
            <div className="engineering-local-control">
              <strong>
                {building.id} ·{" "}
                {t("Commissioned local valve", "已调试楼栋阀门")}{" "}
                {building.localValvePct?.toFixed(1)}%
              </strong>
              <p>
                {t("Auxiliary output", "辅助供热功率")}{" "}
                {(building.auxiliaryKw || 0).toFixed(1)} kW
              </p>
              <label>
                {t("Manual local opening", "手动楼栋阀位")}
                <input
                  aria-label={t("Manual local opening", "手动楼栋阀位")}
                  type="range"
                  min="1"
                  max="100"
                  value={valve}
                  onChange={(e) => setValve(Number(e.target.value))}
                />
                {valve}%
              </label>
              <button
                disabled={p.busy || sandbox.remainingMinutes <= 0}
                onClick={() =>
                  void act(async () =>
                    p.onState(
                      await api<Twin>("engineering/valve", {
                        revision: p.state.revision,
                        assetId: building.id,
                        value: valve,
                      }),
                    ),
                  )
                }
              >
                {t(
                  "Verify manual valve and advance 30 min",
                  "校验手动阀位并推进30分钟",
                )}
              </button>
              <button
                disabled={p.busy || sandbox.remainingMinutes <= 0}
                onClick={() =>
                  void act(async () =>
                    p.onState(
                      await api<Twin>("engineering/valve", {
                        revision: p.state.revision,
                        assetId: building.id,
                        value: null,
                      }),
                    ),
                  )
                }
              >
                {t(
                  "Restore local thermostat and advance 30 min",
                  "恢复本地温控并推进30分钟",
                )}
              </button>
              <small>
                {t(
                  "Manual overrides can disrupt the goal. All changes stay in this engineering scenario.",
                  "手动覆盖可能影响目标达成，所有操作仅影响当前工程仿真。",
                )}
              </small>
            </div>
          )}
          <button
            disabled={p.busy}
            onClick={() =>
              void act(async () =>
                p.onState(
                  await api<Twin>("engineering/restore", {
                    revision: p.state.revision,
                  }),
                ),
              )
            }
          >
            {t("Return to preserved original", "返回保留的原场景")}
          </button>
        </>
      ) : (
        <>
          <button
            disabled={p.busy || !eligible}
            onClick={() =>
              void act(async () => {
                setChoice(null);
                p.onStudy(
                  await api<EngineeringStudy>("engineering/study", {
                    goal: p.goal,
                    revision: p.state.revision,
                    contextId: p.state.contextId,
                  }),
                );
              })
            }
          >
            {t("Compare engineering solutions", "比较工程解决方案")}
          </button>
          {!eligible && (
            <small>
              {t(
                "Select a building temperature goal and permit shared station and branch controls.",
                "请设定楼栋温度目标，并允许站内与其他支路协同控制。",
              )}
            </small>
          )}
          {current && (
            <>
              <p>
                {current.assetId} ·{" "}
                {t("Thermal storage increase required", "目标对应的蓄热增量")}{" "}
                {current.storedHeatIncreaseKwh.toFixed(1)} kWh
              </p>
              <small>
                {t(
                  "This is stored heat alone, before losses and existing heat delivery; not heater sizing.",
                  "仅为蓄热增量，尚未扣除现有供热、计入热损失，不是设备选型容量。",
                )}
              </small>
              {current.rows.map((row) => (
                <article
                  className={`engineering-option ${row.passed ? "passed" : "missed"}`}
                  key={row.id}
                >
                  <strong>
                    {zh
                      ? names[row.id] ||
                        `楼栋阀门与 ${row.auxiliaryCapacityKw} kW 辅助电热`
                      : row.label +
                        (row.auxiliaryCapacityKw
                          ? ` · ${row.auxiliaryCapacityKw} kW`
                          : "")}
                  </strong>
                  <b>
                    {row.goalResult.achieved.toFixed(2)}°C ·{" "}
                    {row.passed
                      ? t("Goal and guardrails met", "目标与约束均满足")
                      : t("Not all constraints met", "未满足全部目标与约束")}
                  </b>
                  <small>
                    {t("At original deadline", "原定期限内累计")} ·{" "}
                    {t("Heat", "管网供热")} {row.heatKwh.toFixed(1)} kWh ·{" "}
                    {t("Pump", "泵电耗")} {row.pumpKwh.toFixed(2)} kWh ·{" "}
                    {t("Auxiliary electricity", "辅助电耗")}{" "}
                    {row.auxiliaryKwh.toFixed(1)} kWh
                  </small>
                  <button
                    disabled={p.busy}
                    onClick={() => p.onPreview(row.optimisation)}
                  >
                    {t(
                      "Preview this physical trajectory in 3D",
                      "在三维中预览此物理轨迹",
                    )}
                  </button>
                  {row.passed && row.id !== "operations" && (
                    <button disabled={p.busy} onClick={() => setChoice(row.id)}>
                      {t("Review modified scenario", "审查工程修改场景")}
                    </button>
                  )}
                </article>
              ))}
              <p>
                {t(
                  "Capacity search reports the first passing tested size, not a certified minimum. COP 1 electric heat; no installed site equipment or electrical capacity is assumed.",
                  "容量搜索仅报告首个通过的测试档位，并非认证最小容量。辅助电热按COP 1计量，不代表现场已具备设备或供电容量。",
                )}
              </p>
              {choice && (
                <div
                  className="engineering-confirm"
                  role="group"
                  aria-label={t("Confirm engineering scenario", "确认工程场景")}
                >
                  <p>
                    {t(
                      "Create a modified model and simulate its first 30 minutes? Commissioning is assumed complete at the scenario start. The original model is preserved.",
                      "是否创建修改模型并推进首段30分钟？此备选场景假设设备已安装调试，原模型将保留。",
                    )}
                  </p>
                  <button
                    disabled={p.busy}
                    onClick={() =>
                      void act(async () => {
                        p.onState(
                          await api<Twin>("engineering/open", {
                            studyId: current.studyId,
                            optionId: choice,
                          }),
                        );
                        setChoice(null);
                      })
                    }
                  >
                    {t(
                      "Open isolated engineering scenario",
                      "打开独立工程仿真",
                    )}
                  </button>
                  <button onClick={() => setChoice(null)}>
                    {t("Cancel", "取消")}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
