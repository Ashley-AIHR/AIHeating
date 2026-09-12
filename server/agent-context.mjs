// Keep authoritative scalar evidence but exclude repeated full visual states.
// Full results remain in the application trace and verified candidate store.
export function compactEvidence(value) {
  if (Array.isArray(value)) return value.map(compactEvidence);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !["history", "events", "frames", "weather", "profiles"].includes(key),
      )
      .map(([key, v]) => [
        key,
        key === "trace" && Array.isArray(v)
          ? v.map(({ state, ...sample }) => compactEvidence(sample))
          : compactEvidence(v),
      ]),
  );
}
