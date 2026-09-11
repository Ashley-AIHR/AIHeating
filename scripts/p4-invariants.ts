import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getGuidedPreview } from '../src/p4-provider';

const root = process.cwd();
const data = getGuidedPreview();
const modelReport = JSON.parse(
  fs.readFileSync(path.join(root, 'p4_model_comparison.json'), 'utf8'),
);
const previewReport = JSON.parse(
  fs.readFileSync(path.join(root, 'p4_preview_benchmarks.json'), 'utf8'),
);
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const copySource = fs.readFileSync(path.join(root, 'src/i18n.ts'), 'utf8');
const tests: Array<[string, boolean]> = [];
const check = (name: string, condition: boolean) =>
  tests.push([name, condition]);

check(
  'provider version is explicit',
  data.version === 'p4-guided-preview-provider-v1',
);
check(
  'scenario is canonical Rapid Daytime Warming',
  data.scenario === 'Rapid Daytime Warming',
);
check(
  'simulation and forecast times agree',
  data.simulationTime === data.forecastAsOf,
);
check(
  'all required horizons are exposed',
  data.predictions.map((item) => item.horizonHours).join(',') === '1,2,3,6',
);
check(
  'every interval brackets its point',
  data.predictions.every(
    (item) => item.lowerMw <= item.pointMw && item.pointMw <= item.upperMw,
  ),
);
check(
  'provider identifies selected frozen model',
  data.model.type === modelReport.selection.selectedModel,
);
const rapid = previewReport.canonicalBenchmarks.find(
  (item: { scenarioFamily: string }) => item.scenarioFamily === 'rapid_warming',
);
check(
  'provider test MAE matches evidence',
  data.modelComparison[0].maeMw ===
    modelReport.evaluations.test.LightGBM.weightedMaeMw,
);
check(
  'provider comparison matches canonical preview',
  data.comparison.preview.heatEnergyMWh === rapid.preview.heatEnergyMWh,
);
check(
  'provider comparison matches canonical traditional',
  data.comparison.traditional.heatEnergyMWh === rapid.traditional.heatEnergyMWh,
);
check('canonical initial state is shared', rapid.sameInitialState === true);
check(
  'preview controls stayed legal',
  data.comparison.preview.allControlsLegal === true,
);
check(
  'preview preserved compliance',
  data.comparison.preview.complianceRate >=
    data.comparison.traditional.complianceRate,
);
check(
  'preview reduced heat in primary benchmark',
  data.comparison.preview.heatEnergyMWh <
    data.comparison.traditional.heatEnergyMWh,
);
check(
  'preview reduced overheating in primary benchmark',
  data.comparison.preview.overheatingRate <
    data.comparison.traditional.overheatingRate,
);
check(
  'UI imports the final provider boundary while retaining P4 evidence',
  appSource.includes("from './p7-provider'") &&
    !appSource.includes("from './p4-provider'") &&
    fs.existsSync(path.join(root, 'src/p4-provider.ts')),
);
check(
  'UI renders the five-step journey',
  ['Now', 'Forecast', 'Predict', 'Optimise', 'Verify'].every(
    (label) =>
      appSource.includes(`t('journey${label}')`) &&
      copySource.includes(`journey${label}:`),
  ),
);
check(
  'UI exposes model intervals',
  appSource.includes('prediction.lowerMw') &&
    appSource.includes('prediction.upperMw'),
);
check(
  'UI avoids production claims',
  !`${appSource}\n${copySource}`.includes('Production MPC') &&
    !`${appSource}\n${copySource}`.includes('Real-world Savings'),
);
check(
  'visible optimised label says final Formal MPC',
  copySource.includes("optimised: 'AI Optimised'") &&
    copySource.includes("formalMpc: 'Formal MPC v1'"),
);
check(
  'Preview is retained only as historical comparison',
  copySource.includes("previewShort: 'Preview v0'") &&
    appSource.includes('comparison.preview'),
);

const failed = tests.filter(([, condition]) => !condition);
for (const [name, condition] of tests)
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
assert.equal(
  failed.length,
  0,
  `${failed.length} P4 invariant(s) failed: ${failed.map(([name]) => name).join(', ')}`,
);
console.log(
  `P4 UI/provider invariant tests: ${tests.length} passed, 0 failed, 0 skipped`,
);
