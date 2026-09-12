import type { Measurement } from "./model";

// Geometry review evidence is separate from the authoritative simulator asset.
export type EngineeringReview = {
  source: "public-bim" | "local-glb" | "network-benchmark";
  sourceHash: string;
  componentId: string;
  measurements: Measurement[];
  notes: string[];
};
