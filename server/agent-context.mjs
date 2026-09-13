// Keep authoritative scalar evidence but exclude repeated full visual states.
// Full results remain in the application trace and verified candidate store.
export function compactEvidence(value) {
  if (value?.studyId && value.rows)
    return {
      studyId: value.studyId,
      assetId: value.assetId,
      goal: value.goal,
      authority: value.authority,
      preferredId: value.preferredId,
      sizing: value.sizing,
      storedHeatIncreaseKwh: value.storedHeatIncreaseKwh,
      rows: value.rows.map(({ optimisation, ...row }) => compactEvidence(row)),
    };
  if (Array.isArray(value)) return value.map(compactEvidence);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            "history",
            "events",
            "frames",
            "weather",
            "profiles",
            "goalSamples",
          ].includes(key),
      )
      .map(([key, v]) => [
        key,
        key === "trace" && Array.isArray(v)
          ? v.map(({ state, ...sample }) => compactEvidence(sample))
          : compactEvidence(v),
      ]),
  );
}
