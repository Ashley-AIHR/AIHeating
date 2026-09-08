import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyPrototypeControl,
  equipmentLimits,
  network,
  selectBuildingForecasts,
  selectForecastKpis,
  selectForecastForHorizon,
  getForecastTargetTime,
  selectAvoidableOversupply,
  selectComfortRate,
  selectComplianceRate,
  selectOverheatingRate,
  selectTemperaturePercentiles,
  selectUnderheatingRate,
} from '../src/domain';
import { copy } from '../src/i18n';
import { chartDataIntegrity } from '../src/chart';

assert.equal(Number(selectAvoidableOversupply().toFixed(2)), 0.30);
assert.equal(Number((selectForecastKpis(6).plannedHeatSupplyMw - selectForecastKpis(6).requiredHeatLoadMw).toFixed(2)), 0.30);
assert.equal(selectForecastForHorizon(24).horizon, 24);
assert.equal(selectForecastForHorizon(48).horizon, 48);
assert.equal(selectBuildingForecasts(6).length, 12);
assert.equal(selectBuildingForecasts(24).length, 12);
assert.equal(selectBuildingForecasts(48).length, 12);
assert.equal(selectComplianceRate(), 1);
assert.equal(selectComfortRate(), 4 / 12);
assert.equal(selectOverheatingRate(), 2 / 12);
assert.equal(selectUnderheatingRate(), 0);
const percentiles = selectTemperaturePercentiles();
assert.equal(percentiles.p10, 18.8);
assert.equal(percentiles.p50, 20.9);
assert.equal(percentiles.p90, 22.7);
assert.equal(Number(percentiles.spread.toFixed(1)), 3.9);

const limited = applyPrototypeControl(network, { supplyTemperatureC: 100, pumpFrequencyHz: 0, valves: { near: 100, far: 0 } });
assert.equal(limited.supplyTemperatureC, network.supplyTemperatureC + equipmentLimits.supplyTemperatureC.step);
assert.equal(limited.pumpFrequencyHz, network.pumpFrequencyHz - equipmentLimits.pumpFrequencyHz.step);
assert.equal(limited.zones.near.valveOpeningPct, network.zones.near.valveOpeningPct + equipmentLimits.valveOpeningPct.step);
assert.equal(limited.zones.far.valveOpeningPct, network.zones.far.valveOpeningPct - equipmentLimits.valveOpeningPct.step);
assert.deepEqual(Object.keys(copy.en).sort(), Object.keys(copy.zh).sort());

assert.equal(selectForecastForHorizon(6, '08:00').forecastAsOf, '08:00');
assert.equal(selectForecastForHorizon(6, '08:00').series.labels[0], '08:00');
assert.equal(selectForecastForHorizon(6, '08:00').series.labels[6], '14:00');
assert.equal(selectForecastForHorizon(24, '08:00').series.labels[7], '+1d 08:00');
assert.equal(selectForecastForHorizon(48, '08:00').series.labels[7], '+2d 08:00');
assert.equal(selectForecastForHorizon(6, '10:00').series.labels[0], '10:00');
assert.equal(selectForecastForHorizon(6).forecastAsOf, '08:00');
assert.equal(getForecastTargetTime('08:00', 6), '14:00');
assert.equal(getForecastTargetTime('10:00', 6), '16:00');
assert.equal(getForecastTargetTime('08:00', 24), '+1d 08:00');
assert.equal(getForecastTargetTime('08:00', 48), '+2d 08:00');
assert.equal(chartDataIntegrity([1, 2, null, 4]).droppedValidPoints, 0);
assert.ok(([6, 24, 48] as const).every((horizon) => {
  const data = selectForecastForHorizon(horizon);
  return [data.outdoorTemperatureC, data.series.requiredHeatLoadMw, data.series.traditionalSupplyMw, data.series.plannedSupplyMw, data.series.traditionalIndoorC, data.series.optimisedIndoorC].every((series) => {
    const integrity = chartDataIntegrity(series);
    return integrity.finiteInputPoints === integrity.plottedPoints && integrity.droppedValidPoints === 0;
  });
}));
for (const horizon of [6, 24, 48] as const) {
  const data = selectForecastForHorizon(horizon); const rows = selectBuildingForecasts(horizon);
  assert.equal(data.predictedOverheatingCount, rows.filter((row) => row.risk === 'overheating').length);
  assert.equal(data.predictedUnderheatingCount, rows.filter((row) => row.risk === 'underheating').length);
  assert.equal(data.predictedComfortCount, rows.filter((row) => row.risk === 'comfortable').length);
  assert.equal(data.predictedWatchCount, rows.filter((row) => row.risk === 'watch').length);
  assert.equal(data.predictedComplianceRate, (rows.length - data.predictedUnderheatingCount) / rows.length);
  assert.equal(data.overheatingRiskPct, Number((data.predictedOverheatingCount / rows.length * 100).toFixed(1)));
}
const seams = readFileSync(new URL('../P0_FUTURE_API_SEAMS.md', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
assert.ok(!appSource.includes('scenario.currentTime'));
assert.ok(!appSource.includes('10:00'));
assert.ok(appSource.includes('forecastTargetTime'));
assert.ok(!appSource.includes("t('distributionAt')} · ${data.forecastAsOf}"));
assert.ok(['thermalState', 'thermalCold', 'thermalCool', 'thermalComfort', 'thermalWarm', 'thermalOverheated'].every((key) => key in copy.en && key in copy.zh));
assert.ok(appSource.includes("<p>{t('simulationDescription')}</p>"));
assert.ok(!appSource.includes("<p>{t('forecastDescription')}</p></div><div className=\"playback\">"));
assert.ok(seams.includes("source: 'fixture' | 'simulation_engine'"));
assert.ok(!seams.includes("status: 'fixture'"));
assert.ok(!seams.includes('applied: boolean'));
assert.ok(seams.includes('stepMinutes: 5 | 10 | 15;'));
assert.ok(seams.includes('controlIntervalMinutes: 30;'));

console.log('P0 invariant tests: 62 passed, 0 failed, 0 skipped');
