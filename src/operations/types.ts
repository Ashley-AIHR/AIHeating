export type Building = {
  auxiliaryKw?: number;
  localValvePct?: number | null;
  id: string;
  zone: string;
  areaM2: number;
  year: number;
  insulation: string;
  floors: number;
  indoorC: number;
  modelC: number;
  quality: string;
  heatKw: number;
  flowM3h: number;
  returnC: number;
  envelopeKw: number;
  windowKw: number;
  solarKw: number;
  storageKw: number;
  position: [number, number];
};
export type Zone = {
  id: string;
  flowM3h: number;
  valvePct: number;
  delayMinutes: number;
  supplyC: number;
  returnC: number;
};
export type History = {
  time: string;
  elapsedMinutes: number;
  supplyC: number;
  returnC: number;
  loadKw: number;
  heatKw: number;
  minimumC: number;
  meanC: number;
};
export type Twin = {
  engineering?: {
    label: string;
    goal: {
      assetId: string;
      target: number;
      deadlineMinutes: number;
      metric: "temperature";
      scope: "asset";
      minC: number;
      maxC: number;
      allowShared: boolean;
    };
    remainingMinutes: number;
    auxiliaryKwh: number;
    design: { localValves?: boolean; manualValves?: Record<string, number> };
  } | null;
  contextId?: string;
  cityId?: string;
  city?: {
    id: string;
    name: string;
    localName: string;
    district: string;
    climate: string;
    system: string;
    scope: string;
    source: string;
    technologySource?: string;
    geometryRevision: string;
  };
  scenario: string;
  scenarioName: string;
  scenarioDescription: string;
  revision: number;
  time: string;
  elapsedMinutes: number;
  source: string;
  outdoorC: number;
  solarWm2: number;
  windMs: number;
  supplyC: number;
  returnC: number;
  pumpHz: number;
  pressureKpa: number;
  flowM3h: number;
  pumpKw: number;
  loadKw: number;
  heatKw: number;
  sourceHeatKw: number;
  pipeStorageKw: number;
  heatKwh: number;
  pumpKwh: number;
  solverResidual: number;
  energyResidual: number;
  buildings: Building[];
  zones: Zone[];
  history: History[];
  events: { time: string; title: string; detail: string }[];
  assumptions: string[];
  thresholdC: number;
  targetC: number;
};
export type Finding = {
  id: string;
  severity: string;
  asset: string;
  title: string;
  evidence: string;
  action: string;
  certainty: string;
};
export type Diagnosis = {
  revision: number;
  findings: Finding[];
  summary: string;
  source: string;
};
export type Candidate = {
  id: string;
  label: string;
  candidateId?: string;
  heatKwh: number;
  pumpKwh: number;
  minimumC: number;
  endMinimumC: number;
  overheatingPct: number;
  comfortPenalty: number;
  verified: boolean;
  verification: string;
  controls: { supplyC: number; pumpHz: number; valvesPct: number[] };
  trace: { minutes: number; minimumC: number; meanC: number; heatKw: number }[];
};
export type Comparison = {
  revision: number;
  candidates: Candidate[];
  recommendation: Candidate | null;
  baseline: Candidate;
  objective: string;
};
export type Source = {
  id: string;
  title: string;
  publisher: string;
  date: string;
  url: string;
  finding: string;
  design: string;
};
export type Config = {
  aiConfigured: boolean;
  model: string;
  sources: Source[];
};
export type Answer = {
  answer: string;
  narrativeWithheld: boolean;
  evidence: {
    kind: string;
    revision: number;
    recommendation: string;
    note: string;
    rows: {
      label: string;
      heatKwh?: number;
      pumpKwh?: number;
      minimumC?: number;
      endMinimumC?: number;
      verified?: boolean;
      supplyC?: number;
      returnC?: number;
      minimumReadingC?: number;
    }[];
  } | null;
  trace: { tool: string; result: unknown }[];
  model: string;
  revision: number;
  totalTokens: number;
};
export async function api<T>(
  name: string,
  args: unknown = {},
  accessCode = "",
): Promise<T> {
  const res = await fetch("/api/" + name, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessCode ? { "X-AI-Access-Code": accessCode } : {}),
    },
    body: JSON.stringify(args),
  });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error || "Request failed.");
  return value;
}
export const fmt = (n: number, digits = 1) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-GB", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })
    : "—";
export const tone = (b: Building) =>
  b.quality === "suspect"
    ? "violet"
    : b.indoorC < 20
      ? "blue"
      : b.indoorC > 23
        ? "amber"
        : "mint";
