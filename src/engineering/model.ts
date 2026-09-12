export type Vec3 = [number, number, number];
export type Asset = {
  id: string;
  name: string;
  kind: string;
  expressId?: number;
  tag?: string;
  systems: string[];
  storey?: string;
  properties: Record<string, unknown>;
  bounds: [Vec3, Vec3];
  triangles: number;
};
export type BimModel = {
  id: string;
  title: string;
  units: string;
  source: string;
  sourceUrl: string;
  licence: string;
  licenceUrl: string;
  sourceSha256: string;
  scope: string;
  conversion: string;
  assets: Asset[];
  connections: {
    fromPort: string;
    toPort: string;
    fromAsset: string | null;
    toAsset: string | null;
  }[];
  quality: {
    sourceRepresentations: number;
    converted: number;
    failed: number;
    explicitPortConnections: number;
  };
  failed: { id: string; reason: string }[];
};
export type Pipe = {
  id: string;
  from: string;
  to: string;
  supply: boolean;
  length: number;
  diameter: number;
  insulation: number;
  roughnessMm: number;
};
export type Network = {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  licence: string;
  licenceUrl: string;
  sourceSha256: string;
  scope: string;
  nodes: { id: string; supply: boolean; position: Vec3 }[];
  pipes: Pipe[];
  plants: { hs_id: string; inlet_node: string; outlet_node: string }[];
  substations: {
    sub_id?: string;
    subs_id?: string;
    substation_id?: string;
    id?: string;
    inlet_node: string;
    outlet_node: string;
  }[];
};
export type Pose = { position: Vec3; target: Vec3 };
export type Measurement = { a: Vec3; b: Vec3; distance: number };
export const substationId = (s: Network["substations"][number]) =>
  s.sub_id ?? s.subs_id ?? s.substation_id ?? s.id ?? s.inlet_node;

// Undirected connectivity only: no inferred pressure, flow direction, valve or safe-isolation claim.
export function reachable(
  network: Network,
  supply: boolean,
  removed: ReadonlySet<string> = new Set(),
) {
  const graph = new Map<string, string[]>();
  for (const p of network.pipes)
    if (p.supply === supply && !removed.has(p.id)) {
      graph.set(p.from, [...(graph.get(p.from) ?? []), p.to]);
      graph.set(p.to, [...(graph.get(p.to) ?? []), p.from]);
    }
  const seen = new Set(
    network.plants.map((p) => (supply ? p.outlet_node : p.inlet_node)),
  );
  const queue = [...seen];
  for (let i = 0; i < queue.length; i++)
    for (const next of graph.get(queue[i]) ?? [])
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  return seen;
}
export function outageImpact(network: Network, removed: ReadonlySet<string>) {
  const baseS = reachable(network, true),
    baseR = reachable(network, false),
    afterS = reachable(network, true, removed),
    afterR = reachable(network, false, removed);
  return network.substations
    .filter(
      (s) =>
        baseS.has(s.inlet_node) &&
        baseR.has(s.outlet_node) &&
        (!afterS.has(s.inlet_node) || !afterR.has(s.outlet_node)),
    )
    .map(substationId);
}
export function shortestRoute(network: Network, pipeId: string) {
  const target = network.pipes.find((p) => p.id === pipeId);
  if (!target) return { pipes: [] as string[], length: 0 };
  const graph = new Map<string, { node: string; pipe: Pipe }[]>();
  for (const p of network.pipes)
    if (p.supply === target.supply) {
      graph.set(p.from, [
        ...(graph.get(p.from) ?? []),
        { node: p.to, pipe: p },
      ]);
      graph.set(p.to, [...(graph.get(p.to) ?? []), { node: p.from, pipe: p }]);
    }
  const dist = new Map<string, number>(),
    previous = new Map<string, { node: string; pipe: Pipe }>(),
    unvisited = new Set(graph.keys());
  for (const plant of network.plants)
    dist.set(target.supply ? plant.outlet_node : plant.inlet_node, 0);
  while (unvisited.size) {
    let current: string | undefined,
      best = Infinity;
    for (const node of unvisited)
      if ((dist.get(node) ?? Infinity) < best) {
        current = node;
        best = dist.get(node)!;
      }
    if (!current) break;
    unvisited.delete(current);
    if (current === target.from || current === target.to) {
      const path: string[] = [];
      let cursor = current;
      while (previous.has(cursor)) {
        const hop = previous.get(cursor)!;
        path.unshift(hop.pipe.id);
        cursor = hop.node;
      }
      if (!path.includes(target.id)) path.push(target.id);
      return {
        pipes: path,
        length: path.reduce(
          (sum, id) =>
            sum + (network.pipes.find((p) => p.id === id)?.length ?? 0),
          0,
        ),
      };
    }
    for (const edge of graph.get(current) ?? [])
      if (
        unvisited.has(edge.node) &&
        best + edge.pipe.length < (dist.get(edge.node) ?? Infinity)
      ) {
        dist.set(edge.node, best + edge.pipe.length);
        previous.set(edge.node, { node: current, pipe: edge.pipe });
      }
  }
  return { pipes: [] as string[], length: 0 };
}

export function validateGlb(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  if (
    bytes.byteLength < 20 ||
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    throw new Error("Expected a valid binary glTF 2.0 (.glb) file.");
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || length + 20 > bytes.byteLength)
    throw new Error("GLB JSON chunk is invalid.");
  const data = JSON.parse(
    new TextDecoder().decode(new Uint8Array(bytes, 20, length)),
  );
  for (const entry of [...(data.buffers ?? []), ...(data.images ?? [])])
    if (entry.uri && !entry.uri.startsWith("data:"))
      throw new Error(
        "External resources are blocked. Export a self-contained GLB with embedded buffers and textures.",
      );
  if (
    data.extensionsRequired?.some((x: string) =>
      ["KHR_draco_mesh_compression", "EXT_meshopt_compression"].includes(x),
    )
  )
    throw new Error(
      "Export an uncompressed GLB for this importer. Draco and Meshopt are not configured.",
    );
  return data;
}
