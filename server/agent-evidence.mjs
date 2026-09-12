// Authoritative numerical presentation is application code, not generated prose.
export function numericalEvidence(trace) {
  const comparison = trace
    .filter((t) => t.tool === "compare_interventions" && t.result?.candidates)
    .at(-1)?.result;
  if (comparison) {
    const best = comparison.recommendation;
    const rows =
      best && best.id !== comparison.baseline.id
        ? [best, comparison.baseline]
        : [comparison.baseline];
    return {
      kind: "comparison",
      revision: comparison.revision,
      recommendation: best?.label || "No candidate passed the model floor",
      note: "Lowest includes the initial state and every physical substep. End minimum is a different metric. Both are synthetic model values.",
      rows: rows.map((c) => ({
        label: c.label,
        heatKwh: c.heatKwh,
        pumpKwh: c.pumpKwh,
        minimumC: c.minimumC,
        endMinimumC: c.endMinimumC,
        verified: c.verified,
      })),
    };
  }
  const snapshot = trace
    .filter((t) => t.tool === "inspect_network" && t.result?.buildings)
    .at(-1)?.result;
  return snapshot
    ? {
        kind: "snapshot",
        revision: snapshot.revision,
        recommendation: "Current simulated network",
        note: "Snapshot values are authoritative simulator output, not real measurements.",
        rows: [
          {
            label: "Current state",
            supplyC: snapshot.supplyC,
            returnC: snapshot.returnC,
            minimumReadingC: Math.min(
              ...snapshot.buildings.map((b) => b.indoorC),
            ),
          },
        ],
      }
    : null;
}
export function guardNarrative(answer, allowedAssetIds = []) {
  // Prevent a known failure mode: a numerically plausible but mislabelled model claim.
  // This lexical guard is not a general semantic fact checker or a safety guarantee.
  let withoutAssetIds = answer.replace(/\bB(?:0[1-9]|1[0-2])\b/g, "asset");
  for (const id of allowedAssetIds) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    withoutAssetIds = withoutAssetIds.replace(
      new RegExp(`\\b${escaped}\\b`, "g"),
      "asset",
    );
  }
  if (/\d/.test(withoutAssetIds))
    return {
      answer:
        "The AI explanation was withheld because it included unchecked numerical claims. Inspect the authoritative tool evidence below, or ask a qualitative follow-up.",
      narrativeWithheld: true,
    };
  return { answer, narrativeWithheld: false };
}
