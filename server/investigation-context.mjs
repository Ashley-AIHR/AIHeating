// Called while the HTTP session lock is held, before billing or streaming starts.
export function prepareInvestigation(snapshot, args) {
  const conflict = (message) => {
    const error = new Error(message);
    error.status = 409;
    error.code = "CONTEXT_CHANGED";
    error.snapshot = snapshot;
    throw error;
  };
  if (args.mode && args.mode !== "simulation")
    throw new Error(
      "Agents operate on the current simulation, not replay or field observations",
    );
  const changed =
    args.revision !== snapshot.revision ||
    (args.contextId !== undefined && args.contextId !== snapshot.contextId);
  if (args.syncCurrent === true) {
    if (args.cityId !== snapshot.cityId || args.scenario !== snapshot.scenario)
      conflict(
        "The server's city or scenario changed, possibly after a restart or in another tab. The scene has been synchronised. Review the selected district, then run the agent again.",
      );
    return {
      args: {
        ...args,
        revision: snapshot.revision,
        contextId: snapshot.contextId,
      },
      snapshot,
      rebased: changed,
    };
  }
  if (changed)
    conflict(
      "Simulation state changed. The scene has been synchronised; review it and start the investigation again.",
    );
  return { args, snapshot, rebased: false };
}
