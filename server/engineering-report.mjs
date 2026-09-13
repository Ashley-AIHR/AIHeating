// Feasibility statements come from solver flags, not a second LLM interpretation.
// The agent still selects and operates tools; exact values remain in result cards.
export function engineeringOutcomeReport(study, locale) {
  const zh = locale === "zh-CN";
  const names = {
    "local-valves": [
      "commissioned building valves",
      "新增并完成调试的楼栋阀门",
    ],
    emitters: [
      "building valves with doubled emitter UA",
      "楼栋阀门与散热器总传热能力增至两倍",
    ],
    "emitters-3": [
      "building valves with tripled emitter UA",
      "楼栋阀门与散热器总传热能力增至三倍",
    ],
    envelope: [
      "building valves with reduced envelope heat loss",
      "楼栋阀门与围护结构热损失降低",
    ],
    resistance: [
      "building valves with reduced branch resistance",
      "楼栋阀门与支路阻力降低",
    ],
  };
  const passing = study.rows.filter(
    (r) => r.kind === "engineering" && r.passed,
  );
  const labels = passing.map(
    (r) =>
      (r.id.startsWith("auxiliary-")
        ? [
            "building valves with supplementary electric heat",
            "楼栋阀门与局部辅助电热",
          ]
        : names[r.id] || [
            "the alternative identified in the evidence cards",
            "证据卡中标明的备选方案",
          ])[zh ? 1 : 0],
  );
  const operating = study.rows.find((r) => r.id === "operations");
  const paragraphs = zh
    ? [
        "以下工程结论由已完成的数值工具结果生成。",
        operating?.passed
          ? "现有设备控制方案通过了本次目标及约束检查。"
          : "本次有界搜索未找到通过全部目标及约束检查的现有设备控制方案；这不等于证明所有运行策略均不可行。",
        passing.length
          ? `通过检查的改造模型方案包括：${labels.join("；")}。准确参数、温度轨迹和能耗请查看对应证据卡。`
          : "已测试的改造模型方案均未通过全部检查；需要继续核查模型、设备能力或其他工程路径，不能宣称目标已经达成。",
        "这些方案均保留原目标，从同一起点独立比较，不是费用最优排序。改造方案假设设备已完成安装调试，施工时间不计入恢复时限。辅助电热需要额外电能及现场供电核查；散热器总传热能力增加不等于热输出同比增加。",
        "原场景未改变，也未执行现场控制。请先核查方案假设，再明确确认打开隔离的改造仿真，逐步执行并检查实际模拟结果。模型验证不等于现场验证。",
      ]
    : [
        "Engineering outcome summary generated from completed numerical tool results.",
        operating?.passed
          ? "The existing-equipment control plan passed this goal and its constraint checks."
          : "This bounded search found no existing-equipment control plan that passed every goal and constraint check. This does not prove that every operating strategy is infeasible.",
        passing.length
          ? `Passing modified-model alternatives include: ${labels.join("; ")}. Consult each evidence card for exact parameters, temperature trajectories and energy use.`
          : "None of the tested modified-model alternatives passed every check. Further model, equipment or engineering investigation is required; the target has not been achieved.",
        "Alternatives retain the original goal and start independently from the same state; they are not ranked by cost. Modified models assume installation and commissioning already complete, outside the recovery deadline. Supplementary electric heat requires additional electricity and a field electrical-capacity check. Increased emitter UA does not imply proportionally increased heat output.",
        "The original scenario remains unchanged and no field controls were applied. Review the assumptions, explicitly confirm an isolated modified simulation, then execute and check each physical step. Model verification is not field validation.",
      ];
  return paragraphs.join("\n\n");
}
