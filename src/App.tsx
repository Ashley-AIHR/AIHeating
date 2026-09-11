import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  advancePrototypeTimeline,
  applyPrototypeControl,
  buildingProfiles,
  buildings,
  equipmentLimits,
  getFixtureOptimisedState,
  modelMetrics,
  network as fixtureNetwork,
  overviewFixture,
  recommendationFixture,
  resultComparison,
  scenario,
  selectAvoidableOversupply,
  selectBuildingForecasts,
  selectComfortRate,
  selectComplianceRate,
  selectDistributionBins,
  selectForecastForHorizon,
  selectForecastInsights,
  selectForecastKpis,
  selectOverheatingRate,
  selectResultsComparison,
  selectTemperaturePercentiles,
  selectUnderheatingRate,
  timeline,
  type Building,
  type ControlMode,
  type ForecastHorizon,
  type HeatingNetworkState,
  type Language,
  type SemanticActionRecord,
  type ZoneKey,
} from './domain';
import { translate } from './i18n';
import { finiteChartSegments } from './chart';
import {
  applicationStatus,
  deriveCustomerStatus,
  getGuidedRuntime,
  type ApplicationStatus,
} from './p7-provider';
import { TutorPanel } from './TutorPanel';
import type { TutorPage } from './p8-tutor';

type T = (key: string) => string;
const modeKeys: ControlMode[] = ['traditional', 'advisory', 'optimised'];
const zoneKeys: ZoneKey[] = ['near', 'mid', 'far'];
const horizonKeys: ForecastHorizon[] = [6, 24, 48];
const eventLabels: Record<string, string> = {
  simulation_started: 'eventSimulationStarted',
  simulation_reset: 'eventSimulationReset',
  control_mode_changed: 'eventControlModeChanged',
  mpc_recommendation_generated: 'eventMpcRecommendationGenerated',
  mpc_control_auto_applied: 'eventMpcControlAutoApplied',
  recommendation_applied: 'eventRecommendationApplied',
  simulation_step: 'eventSimulationStep',
};
const guidedRuntime = getGuidedRuntime();
const guidedStatus = deriveCustomerStatus(guidedRuntime.optimisation.status);
const guidedRecommendation = {
  supplyTemperatureC: guidedRuntime.recommendation.supplyC,
  pumpFrequencyHz: guidedRuntime.recommendation.pumpHz,
  valves: {
    near: guidedRuntime.recommendation.valvesPct[0],
    mid: guidedRuntime.recommendation.valvesPct[1],
    far: guidedRuntime.recommendation.valvesPct[2],
  },
  selectedBuildingPredictedC: guidedRuntime.comparison.mpc.P50C,
};
if (
  typeof document !== 'undefined' &&
  !document.getElementById('p0-sr-style')
) {
  const style = document.createElement('style');
  style.id = 'p0-sr-style';
  style.textContent =
    '.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.delay-summary{display:flex;align-items:center;gap:8px;margin-left:auto;color:#536b8f;font-size:10px}.delay-summary strong{color:#173b94}.delay-summary span{white-space:nowrap}.thermal-state-legend{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.thermal-state-legend strong{color:#173b94;margin-right:2px}.thermal-chip{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.thermal-chip i{width:8px;height:8px;border-radius:50%;display:inline-block}';
  document.head.appendChild(style);
}

function useT(language: Language): T {
  return (key) => translate(language, key);
}
function interpolate(
  value: string,
  replacements: Record<string, string | number>,
): string {
  return Object.entries(replacements).reduce(
    (text, [key, replacement]) =>
      text.split(`{${key}}`).join(String(replacement)),
    value,
  );
}
function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
function cx(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ');
}
function Icon({ symbol, tone = '' }: { symbol: string; tone?: string }) {
  return (
    <span className={cx('icon', tone)} aria-hidden="true">
      {symbol}
    </span>
  );
}

function KpiCard({
  icon,
  label,
  value,
  note,
  tone = 'blue',
}: {
  icon: string;
  label: string;
  value: string;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="kpi-card">
      <Icon symbol={icon} tone={tone} />
      <div className="kpi-copy">
        <div className="eyebrow">{label}</div>
        <div className="kpi-value">{value}</div>
        {note && (
          <div
            className={cx('kpi-note', tone === 'red' ? 'negative' : 'positive')}
          >
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = '',
  action,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cx('panel', className)}>
      {(title || action) && (
        <div className="panel-heading">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function LineChart({
  values,
  values2,
  labels,
  color = '#1378f6',
  color2 = '#ee3d45',
  min,
  max,
  unit,
  ariaLabel,
}: {
  values: Array<number | null | undefined>;
  values2?: Array<number | null | undefined>;
  labels: string[];
  color?: string;
  color2?: string;
  min?: number;
  max?: number;
  unit?: string;
  ariaLabel?: string;
}) {
  const all = [...values, ...(values2 ?? [])].filter((value): value is number =>
    Number.isFinite(value),
  );
  const lo = min ?? Math.min(...all, 0) - 1;
  const hi = max ?? Math.max(...all, 0) + 1;
  const x = (index: number) => (index / Math.max(1, labels.length - 1)) * 600;
  const y = (value: number) => 96 - ((value - lo) / Math.max(1, hi - lo)) * 78;
  const pathFor = (series: Array<number | null | undefined>) =>
    finiteChartSegments(series).map((segment) => (
      <path
        key={segment.map((point) => point.index).join('-')}
        d={segment
          .map(
            (point, i) =>
              `${i ? 'L' : 'M'} ${x(point.index)} ${y(point.value)}`,
          )
          .join(' ')}
        fill="none"
        stroke={series === values ? color : color2}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ));
  return (
    <div className="chart-wrap">
      <svg
        viewBox="0 0 600 150"
        role="img"
        aria-label={ariaLabel ?? `${unit ?? 'Value'} chart`}
        preserveAspectRatio="none"
      >
        {[18, 44, 70, 96].map((gridY) => (
          <line
            key={gridY}
            x1="0"
            x2="600"
            y1={gridY}
            y2={gridY}
            className="grid-line"
          />
        ))}
        {pathFor(values)}
        {values2 && pathFor(values2)}
        {values.map((value, i) =>
          Number.isFinite(value) ? (
            <circle
              key={`${value}-${i}`}
              cx={x(i)}
              cy={y(value as number)}
              r="3.5"
              fill={color}
            >
              <title>{`${labels[i] ?? ''}: ${(value as number).toFixed(1)}${unit ? ` ${unit}` : ''}`}</title>
            </circle>
          ) : null,
        )}
      </svg>
      <div className="chart-labels">
        {labels.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function BarChart({
  labels,
  values,
  values2,
  color = '#9aa9ba',
  color2 = '#1378f6',
  unit,
  ariaLabel,
}: {
  labels: string[];
  values: number[];
  values2?: number[];
  color?: string;
  color2?: string;
  unit?: string;
  ariaLabel?: string;
}) {
  const max = Math.max(...values, ...(values2 ?? []), 1);
  return (
    <div className="bar-chart" role="img" aria-label={ariaLabel ?? unit}>
      <div className="bar-grid">
        <span>{max.toFixed(0)}</span>
        <span>{(max / 2).toFixed(0)}</span>
        <span>0</span>
      </div>
      <div className="bar-groups">
        {labels.map((label, i) => (
          <div className="bar-group" key={`${label}-${i}`}>
            <div className="bars">
              <div
                className="bar"
                style={{
                  height: `${(values[i] / max) * 100}%`,
                  background: color,
                }}
              >
                <b>{values[i].toFixed(values[i] < 10 ? 1 : 0)}</b>
              </div>
              {values2 && (
                <div
                  className="bar"
                  style={{
                    height: `${(values2[i] / max) * 100}%`,
                    background: color2,
                  }}
                >
                  <b>{values2[i].toFixed(values2[i] < 10 ? 1 : 0)}</b>
                </div>
              )}
            </div>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {unit && <div className="chart-unit">{unit}</div>}
    </div>
  );
}

function Legend({
  items,
}: {
  items: Array<{ label: string; color: string; dashed?: boolean }>;
}) {
  return (
    <div className="legend">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          <i
            style={{
              background: item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
function ModeSelector({
  mode,
  setMode,
  t,
}: {
  mode: ControlMode;
  setMode: (mode: ControlMode) => void;
  t: T;
}) {
  return (
    <div className="mode-selector">
      {modeKeys.map((key) => (
        <button
          key={key}
          className={cx('mode-btn', mode === key && 'active')}
          onClick={() => setMode(key)}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}

function NetworkMap({
  t,
  networkState,
  buildingItems,
  onBuildingClick,
}: {
  t: T;
  networkState: HeatingNetworkState;
  buildingItems: Building[];
  onBuildingClick?: (building: Building) => void;
}) {
  const positions = [
    { x: 425, y: 74 },
    { x: 505, y: 74 },
    { x: 425, y: 174 },
    { x: 505, y: 174 },
    { x: 675, y: 74 },
    { x: 755, y: 74 },
    { x: 675, y: 174 },
    { x: 755, y: 174 },
    { x: 925, y: 74 },
    { x: 1005, y: 74 },
    { x: 925, y: 174 },
    { x: 1005, y: 174 },
  ];
  const zoneMeta = {
    near: { x: 380, width: 180, color: '#ed6a72' },
    mid: { x: 600, width: 180, color: '#20b887' },
    far: { x: 820, width: 220, color: '#2e83f5' },
  };
  return (
    <div className="network-map">
      <svg viewBox="0 0 1150 300" role="img" aria-label={t('secondaryNetwork')}>
        {zoneKeys.map((zone) => (
          <g key={zone}>
            <rect
              x={zoneMeta[zone].x}
              y="26"
              width={zoneMeta[zone].width}
              height="238"
              rx="10"
              fill={`${zoneMeta[zone].color}0c`}
              stroke={zoneMeta[zone].color}
              strokeDasharray="6 5"
            />
            <text
              x={zoneMeta[zone].x + zoneMeta[zone].width / 2}
              y="51"
              textAnchor="middle"
              className="zone-label"
              fill={zoneMeta[zone].color}
            >
              {t(zone)}
            </text>
          </g>
        ))}
        <g className="station">
          <rect x="90" y="113" width="112" height="75" rx="8" />
          <path d="M103 133h86v42h-86zM125 143h14v24h-14zm25 0h14v24h-14z" />
          <text x="146" y="213" textAnchor="middle">
            {t('substation')}
          </text>
          <text x="146" y="250" textAnchor="middle" className="station-value">
            {networkState.currentHeatSupplyMw.toFixed(2)} MW
          </text>
        </g>
        <path
          d="M204 138H1070"
          stroke="#ef3946"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M204 174H1070"
          stroke="#1479f5"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <text x="26" y="85" className="network-note">
          {t('primaryNetwork')}
        </text>
        {buildingItems.map((building, i) => {
          const p = positions[i];
          const zone = networkState.zones[building.zone];
          const temp = building.indoorTemperatureC;
          const tone =
            temp < 18
              ? '#4b93ed'
              : temp < 20
                ? '#63a9ef'
                : temp <= 22
                  ? '#22b786'
                  : temp <= 23
                    ? '#ee9b22'
                    : '#ec424b';
          return (
            <g
              key={building.id}
              className="building-node"
              onClick={() => onBuildingClick?.(building)}
              tabIndex={0}
              role="button"
              aria-label={`${building.id}, ${temp.toFixed(1)}°C`}
            >
              <line
                x1={p.x + 26}
                x2={p.x + 26}
                y1={p.y + 36}
                y2="138"
                stroke="#ef3946"
                strokeWidth="5"
              />
              <line
                x1={p.x + 38}
                x2={p.x + 38}
                y1={p.y + 36}
                y2="174"
                stroke="#1479f5"
                strokeWidth="5"
              />
              <path
                d={`M${p.x} ${p.y + 18}l26-19 26 19v28H${p.x}z`}
                fill={tone}
                opacity=".92"
              />
              <path
                d={`M${p.x - 5} ${p.y + 18}L${p.x + 26} ${p.y - 5}l31 23`}
                fill="none"
                stroke={tone}
                strokeWidth="8"
              />
              <rect
                x={p.x - 12}
                y={p.y + 48}
                width="76"
                height="31"
                rx="7"
                fill="white"
                stroke="#d6e2f0"
              />
              <text
                x={p.x + 26}
                y={p.y + 62}
                textAnchor="middle"
                className="building-id"
              >
                {building.id}
              </text>
              <text
                x={p.x + 26}
                y={p.y + 75}
                textAnchor="middle"
                className="building-temp"
                fill={tone}
              >
                {temp.toFixed(1)}°C
              </text>
              <title>{`${building.id} · ${temp.toFixed(1)}°C · ${zone.flowM3h.toFixed(1)} m³/h`}</title>
            </g>
          );
        })}
      </svg>
      <div className="network-legend">
        <span>
          <i className="line-hot" />
          {t('supplyHot')}
        </span>
        <span>
          <i className="line-cold" />
          {t('returnCold')}
        </span>
        <span className="thermal-state-legend" aria-label={t('thermalState')}>
          <strong>{t('thermalState')}</strong>
          {[
            ['thermalCold', '#4b93ed', '<18°C'],
            ['thermalCool', '#63a9ef', '18–20°C'],
            ['thermalComfort', '#22b786', '20–22°C'],
            ['thermalWarm', '#ee9b22', '22–23°C'],
            ['thermalOverheated', '#ec424b', '>23°C'],
          ].map(([key, color, range]) => (
            <span className="thermal-chip" key={key}>
              <i style={{ background: color }} />
              {t(key)} {range}
            </span>
          ))}
        </span>
        <span className="delay-summary" aria-label={t('estimatedDelay')}>
          <strong>{t('estimatedDelay')}</strong>
          <span>{t('near')} 10 min</span>
          <span>{t('mid')} 20 min</span>
          <span>{t('far')} 35 min</span>
        </span>
      </div>
    </div>
  );
}

function Recommendation({
  t,
  mode,
  recommendation,
  networkState,
  onApply,
  applied,
}: {
  t: T;
  mode: ControlMode;
  recommendation: typeof recommendationFixture;
  networkState: HeatingNetworkState;
  onApply: () => void;
  applied: boolean;
}) {
  return (
    <div className={cx('recommendation', mode === 'optimised' && 'optimised')}>
      <div className="recommendation-head">
        <span className="bulb">✦</span>
        <div>
          <h3>{t('recommendation')}</h3>
          <p>{t('fixture')}</p>
        </div>
        <span className="status-pill">
          {mode === 'optimised'
            ? `● ${t('mpcActive')}`
            : mode === 'advisory'
              ? 'AI'
              : t('traditionalShort')}
        </span>
      </div>
      <p className="recommendation-text">{t('recommendationText')}</p>
      <div className="recommendation-values">
        <span>
          {recommendation.supplyTemperatureC}°C <small>{t('supply')}</small>
        </span>
        <span>
          {recommendation.pumpFrequencyHz} Hz{' '}
          <small>
            {t('pumpFrequency')} · {networkState.differentialPressureKpa} kPa
          </small>
        </span>
        <span>
          {t('near')} {recommendation.valves.near.toFixed(0)}% · {t('mid')}{' '}
          {recommendation.valves.mid.toFixed(0)}% · {t('far')}{' '}
          {recommendation.valves.far.toFixed(0)}%
        </span>
      </div>
      {mode === 'advisory' && (
        <button className="primary-btn full" onClick={onApply}>
          {applied ? `✓ ${t('applyDone')}` : t('apply')}
        </button>
      )}
      {mode === 'optimised' && (
        <div className="auto-note">✓ {t('autoApplied')}</div>
      )}
      {mode === 'traditional' && (
        <div className="muted-note">{t('noAutoChanges')}</div>
      )}
    </div>
  );
}

function SystemStatus({
  t,
  networkState,
}: {
  t: T;
  networkState: HeatingNetworkState;
}) {
  return (
    <Panel
      title={t('systemStatus')}
      action={
        <span className="operating">
          <i />
          {t('operating')}
        </span>
      }
    >
      <div className="status-rows">
        {[
          [t('supply'), `${networkState.supplyTemperatureC.toFixed(1)} °C`],
          [t('return'), `${networkState.returnTemperatureC.toFixed(1)} °C`],
          [t('totalFlow'), `${networkState.totalFlowM3h.toFixed(1)} m³/h`],
          [t('pressure'), `${networkState.differentialPressureKpa} kPa`],
          [t('pumpFrequency'), `${networkState.pumpFrequencyHz} Hz`],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="zone-status">
        {zoneKeys.map((zone) => (
          <div key={zone}>
            <span>{t(zone)}</span>
            <b>
              {networkState.zones[zone].flowM3h.toFixed(1)} <small>m³/h</small>
            </b>
            <em>{networkState.zones[zone].valveOpeningPct.toFixed(0)}%</em>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PredictiveJourney({ t, onStart }: { t: T; onStart: () => void }) {
  const prediction = guidedRuntime.predictions.find(
    (item) => item.horizonHours === 2,
  )!;
  const forecast = guidedRuntime.forecast.find(
    (item) => item.horizonMinutes === 120,
  )!;
  const thermal = guidedRuntime.thermalPrediction.points.find(
    (item) => item.horizonMinutes === 120,
  )!;
  const current = guidedRuntime.now.traditionalControls;
  const steps = [
    [
      t('journeyNow'),
      `${guidedRuntime.now.outdoorC.toFixed(1)}°C · ${t('requiredHeat')} ${guidedRuntime.now.requiredLoadMw.toFixed(3)} / ${t('currentSupply')} ${guidedRuntime.now.heatSupplyMw.toFixed(3)} MW · P10/50/90 ${guidedRuntime.now.indoorP10C.toFixed(1)}/${guidedRuntime.now.indoorP50C.toFixed(1)}/${guidedRuntime.now.indoorP90C.toFixed(1)}°C`,
    ],
    [
      t('journeyForecast'),
      `+2h · ${forecast.targetTime.slice(11, 16)} · ${forecast.outdoorC.toFixed(1)}°C · ${t('solarRadiation')} ${forecast.solarWm2.toFixed(0)} W/m²`,
    ],
    [
      t('journeyPredict'),
      `+2h · P4 ${t('requiredHeat')} ${prediction.pointMw.toFixed(3)} MW · P5 ${t('minimumBuilding')} ${thermal.minimumPointC.toFixed(2)}±${thermal.halfWidthC.toFixed(3)}°C`,
    ],
    [
      t('journeyOptimise'),
      `${current.supplyC.toFixed(1)}°C/${current.pumpHz.toFixed(1)} Hz → ${guidedRuntime.recommendation.supplyC.toFixed(1)}°C/${guidedRuntime.recommendation.pumpHz.toFixed(1)} Hz · ${t('valve')} ${guidedRuntime.recommendation.valvesPct.map((value) => value.toFixed(0)).join('/')}`,
    ],
    [
      t('journeyVerify'),
      `${t('fullDaySimulationResult')} · ${pct(guidedRuntime.comparison.mpc.complianceRate)} ≥18°C · ${t('heatConsumption')} ${guidedRuntime.comparison.traditional.heatEnergyMWh.toFixed(2)}→${guidedRuntime.comparison.mpc.heatEnergyMWh.toFixed(2)} MWh · >23°C ${pct(guidedRuntime.comparison.traditional.overheatingRate)}→${pct(guidedRuntime.comparison.mpc.overheatingRate)}`,
    ],
  ];
  return (
    <Panel
      className="preview-journey"
      title={t('previewJourneyTitle')}
      subtitle={`${t('rapid')} · ${interpolate(t('asOf'), { time: guidedRuntime.forecastAsOf.slice(11, 16) })}`}
      action={
        <span className="model-badge">
          {guidedRuntime.providers.loadPrediction.version} · {guidedRuntime.providers.thermalPrediction.version}
          {' · '}{guidedRuntime.providers.optimisation.version}
        </span>
      }
    >
      <div className="journey-steps">
        {steps.map(([label, value], index) => (
          <div className="journey-step" key={label}>
            <span>{index + 1}</span>
            <b>{label}</b>
            <small>{value}</small>
          </div>
        ))}
      </div>
      <div className="preview-action">
        <p>{t('previewJourneyText')}</p>
        <button className="primary-btn" onClick={onStart}>
          {t('startPreview')} →
        </button>
      </div>
    </Panel>
  );
}

const statusKeys = {
  MPC_OPTIMAL: 'mpcOptimal', SOLVER_LIMIT_REACHED: 'solverLimitReached',
  CONSTRAINT_INFEASIBLE: 'constraintInfeasible', OPTIMISATION_FAILED: 'optimisationFailed',
  VERIFIED_IN_DIGITAL_TWIN: 'verifiedInDigitalTwin', VERIFIED_FALLBACK: 'verifiedFallback',
  NOT_VERIFIED: 'notVerified', NOT_ACTIVE: 'fallbackNotActive',
  VERIFIED_FALLBACK_ACTIVE: 'verifiedFallbackActive', FALLBACK_ACTIVE: 'fallbackActive',
  NORMAL_VERIFIED: 'normalVerified', SAFETY_NOT_GUARANTEED: 'safetyNotGuaranteed',
  NONLINEAR_VERIFICATION_FAILED: 'nonlinearVerificationFailed', NOT_APPLIED: 'notApplied',
  APPLIED: 'applicationApplied', SUPERSEDED: 'superseded', FAILED_TO_APPLY: 'failedToApply',
} as const;

function MpcStatus({ t, application }: { t: T; application: ApplicationStatus }) {
  const rows = [
    [t('optimisationStatus'), t(statusKeys[guidedStatus.optimisation])],
    [t('verificationStatus'), t(statusKeys[guidedStatus.verification])],
    [t('fallbackStatus'), t(statusKeys[guidedStatus.fallback])],
    [t('safetyStatus'), t(statusKeys[guidedStatus.safety])],
    [t('applicationStatus'), t(statusKeys[application])],
  ];
  const engineeringCases = [
    ['rapid', guidedRuntime.statusScenarios.rapidOptimal],
    ['sunnyWinter', guidedRuntime.statusScenarios.sunnyOptimal],
    ['coldWave', guidedRuntime.statusScenarios.coldVerifiedFallback],
    ['near18Stress', guidedRuntime.statusScenarios.near18Infeasible],
  ] as const;
  return (
    <Panel title={t('formalMpcStatus')} subtitle={guidedRuntime.providers.optimisation.version}>
      <div className="mpc-status-grid">
        {rows.map(([label, value], index) => (
          <div key={label} className={cx(index === 3 && guidedStatus.safety === 'SAFETY_NOT_GUARANTEED' && 'danger')}>
            <span>{label}</span><b>{value}</b>
          </div>
        ))}
      </div>
      <div className="state-semantics" aria-label={t('stateSemantics')}>
        <span><b>{t('predictedState')}</b> P4/P5</span>
        <span><b>{t('optimisedState')}</b> P6</span>
        <span><b>{t('verifiedState')}</b> P1A</span>
        <span><b>{t('appliedState')}</b> {t(statusKeys[application])}</span>
        <span><b>{t('realisedState')}</b> {t('simulationResult')}</span>
      </div>
      <details className="technical-status">
        <summary>{t('technicalDetails')}</summary>
        <p>{t('solver')}: OSQP · {guidedRuntime.optimisation.status.optimisationStatus} · {guidedRuntime.optimisation.solveTimeS.toFixed(3)}s</p>
        <p>{t('nonlinearVerification')}: {guidedRuntime.optimisation.status.verificationStatus} · {t('relinearisation')}: {guidedRuntime.optimisation.relinearisationCount}</p>
        <p>{t('recommendationCreatedAt')}: {guidedRuntime.recommendationCreatedAt} · {t('recommendationEffectiveAt')}: {guidedRuntime.recommendationEffectiveAt}</p>
      </details>
      <details className="technical-status engineering-status">
        <summary>{t('engineeringValidationStatus')}</summary>
        {engineeringCases.map(([label, record]) => {
          const status = deriveCustomerStatus(record);
          const engineeringApplication = applicationStatus('optimised', status);
          return <p key={label}><b>{t(label)}</b>: {t(statusKeys[status.optimisation])} · {t(statusKeys[status.verification])} · {t(statusKeys[status.fallback])} · {t(statusKeys[status.safety])} · {t(statusKeys[engineeringApplication])}</p>;
        })}
        <p>{t('safetyCannotBeGuaranteed')}</p>
      </details>
    </Panel>
  );
}

function Overview({
  t,
  mode,
  recommendation,
  networkState,
  buildingItems,
  setSelectedBuilding,
  onApply,
  applied,
  onStartPreview,
}: {
  t: T;
  mode: ControlMode;
  recommendation: typeof recommendationFixture;
  networkState: HeatingNetworkState;
  buildingItems: Building[];
  setSelectedBuilding: (b: Building) => void;
  onApply: () => void;
  applied: boolean;
  onStartPreview: () => void;
}) {
  const percentiles = selectTemperaturePercentiles(buildingItems);
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <p className="kicker">{t('previewLabel')}</p>
          <h1>{t('overview')}</h1>
          <p>{t('previewOverviewText')}</p>
        </div>
        <span className="live-badge">
          <i />
          {t('simulationOnlyBadge')}
        </span>
      </div>
      <PredictiveJourney t={t} onStart={onStartPreview} />
      <details className="legacy-overview">
        <summary>{t('engineeringTelemetry')}</summary>
        <div className="kpi-grid overview-kpis">
          <KpiCard
            icon="♨"
            label={t('outdoor')}
            value={`${scenario.weather.outdoorTemperatureC.toFixed(1)} °C`}
            note="+0.3°C"
            tone="blue"
          />
          <KpiCard
            icon="♨"
            label={t('requiredHeat')}
            value={`${networkState.requiredHeatLoadMw.toFixed(2)} MW`}
            note="↑ 1.8%"
            tone="orange"
          />
          <KpiCard
            icon="♨"
            label={t('currentSupply')}
            value={`${networkState.currentHeatSupplyMw.toFixed(2)} MW`}
            note="↑ 13%"
            tone="orange"
          />
          <KpiCard
            icon="✓"
            label={t('compliance')}
            value={pct(selectComplianceRate(buildingItems))}
            note="↑ 5.6%"
            tone="green"
          />
          <KpiCard
            icon="⌂"
            label={t('comfort')}
            value={pct(selectComfortRate(buildingItems))}
            note={`${t('distribution')}: ${percentiles.p50.toFixed(1)}°C`}
            tone="green"
          />
          <KpiCard
            icon="!"
            label={t('overheating')}
            value={pct(selectOverheatingRate(buildingItems))}
            note="↑ 4.2%"
            tone="red"
          />
          <KpiCard
            icon="⚡"
            label={t('pumpPower')}
            value={`${networkState.pumpPowerKw} kW`}
            note="↓ 12%"
            tone="blue"
          />
        </div>
        <div className="content-grid overview-main">
          <Panel
            className="network-panel"
            title={t('secondaryNetwork')}
            subtitle={t('fixture')}
          >
            <NetworkMap
              t={t}
              networkState={networkState}
              buildingItems={buildingItems}
              onBuildingClick={setSelectedBuilding}
            />
          </Panel>
          <div className="overview-rail">
            <SystemStatus t={t} networkState={networkState} />
            <Panel title={t('nextForecast')}>
              <div className="forecast-risk">
                <span>⚠ {t('riskOver')}</span>
                <b className="text-red">
                  {overviewFixture.next2hOverheatingCount} / 12
                </b>
                <span>❄ {t('riskUnder')}</span>
                <b>{overviewFixture.next2hUnderheatingCount} / 12</b>
              </div>
            </Panel>
            <Panel title={t('alerts')}>
              <div className="alert-card danger">
                <b>⚠ {t('windowRisk')}</b>
                <p>{t('overheatingInsightText')}</p>
              </div>
              <div className="alert-card">
                <b>ⓘ {t('farRisk')}</b>
                <p>{t('farRiskText')}</p>
              </div>
              <div className="alert-card success">
                <b>✓ {t(overviewFixture.complianceAlertKey)}</b>
              </div>
            </Panel>
            <Recommendation
              t={t}
              mode={mode}
              recommendation={recommendation}
              networkState={networkState}
              onApply={onApply}
              applied={applied}
            />
          </div>
        </div>
      </details>
    </div>
  );
}

function GuidedSimulation({
  t,
  mode,
  setMode,
  onResults,
  recommendationApplicationStatus,
}: {
  t: T;
  mode: ControlMode;
  setMode: (mode: ControlMode) => void;
  onResults: () => void;
  recommendationApplicationStatus: ApplicationStatus;
}) {
  const traditional = guidedRuntime.now.traditionalControls;
  const recommended = guidedRuntime.recommendation;
  const applied = recommendationApplicationStatus === 'APPLIED';
  const controls = applied ? recommended : traditional;
  const controlState = applied
    ? t('appliedAction')
    : mode === 'advisory'
      ? t('recommendedNotApplied')
      : t('comparisonRecommendation');

  return (
    <div className="page guided-simulation">
      <div className="page-intro">
        <div>
          <p className="kicker">{t('simulationEngine')}</p>
          <h1>{t('simulation')}</h1>
          <p>{t('simulationDescription')}</p>
        </div>
        <span className="live-badge">
          {guidedRuntime.configuration.physicalFixtureVersion} ·{' '}
          {t('noRealEquipment')}
        </span>
      </div>
      <Panel
        title={t('decisionSnapshot')}
        subtitle={`${t('rapid')} · ${guidedRuntime.simulationTime.slice(11, 16)} · ${t('decisionSnapshotBeforeAction')}`}
        action={<ModeSelector mode={mode} setMode={setMode} t={t} />}
      >
        <div className="kpi-grid simulation-kpis">
          {[
            [t('outdoor'), `${guidedRuntime.now.outdoorC.toFixed(1)} °C`],
            [t('solarRadiation'), `${guidedRuntime.now.solarWm2.toFixed(0)} W/m²`],
            [t('windSpeed'), `${guidedRuntime.now.windMs.toFixed(1)} m/s`],
            [t('requiredHeat'), `${guidedRuntime.now.requiredLoadMw.toFixed(3)} MW`],
            [t('currentSupply'), `${guidedRuntime.now.heatSupplyMw.toFixed(3)} MW`],
            [t('return'), `${guidedRuntime.now.returnC.toFixed(1)} °C`],
            [t('totalFlow'), `${guidedRuntime.now.totalFlowM3h.toFixed(1)} m³/h`],
            [t('pressure'), `${guidedRuntime.now.pressureKpa.toFixed(1)} kPa`],
          ].map(([label, value], index) => (
            <KpiCard
              key={label}
              icon={['☀', '◉', '≈', '♨', '♨', '↩', '⇄', '◫'][index]}
              label={label}
              value={value}
            />
          ))}
        </div>
      </Panel>
      <MpcStatus t={t} application={recommendationApplicationStatus} />
      <div className="content-grid guided-simulation-grid">
        <Panel
          title={applied ? t('currentAppliedControls') : t('currentControls')}
          subtitle={controlState}
          action={<span className={cx('status-pill', applied && 'applied')}>{controlState}</span>}
        >
          <div className="control-comparison">
            <div>
              <span>{t('supply')}</span>
              <b>{controls.supplyC.toFixed(1)} °C</b>
              <small>{t('recommended')}: {recommended.supplyC.toFixed(1)} °C</small>
            </div>
            <div>
              <span>{t('pumpFrequency')}</span>
              <b>{controls.pumpHz.toFixed(1)} Hz</b>
              <small>{t('recommended')}: {recommended.pumpHz.toFixed(1)} Hz</small>
            </div>
            {guidedRuntime.zones.map((zone, index) => (
              <div key={zone.key}>
                <span>{t(zone.key)} {t('valve')}</span>
                <b>{controls.valvesPct[index].toFixed(0)}%</b>
                <small>{t('recommended')}: {recommended.valvesPct[index].toFixed(0)}%</small>
              </div>
            ))}
          </div>
          <p className="panel-note">{t('controlModeSemantics')}</p>
        </Panel>
        <Panel title={t('networkSnapshot')} subtitle={t('flowDependentSnapshot')}>
          <div className="zone-snapshot">
            {guidedRuntime.zones.map((zone) => (
              <div key={zone.key}>
                <b>{t(zone.key)}</b>
                <span>{t('zoneFlow')} <strong>{zone.flowM3h.toFixed(1)} m³/h</strong></span>
                <span>{t('transportDelay')} <strong>{zone.transportDelayMin.toFixed(1)} min</strong></span>
                <span>{t('supply')} <strong>{zone.deliveredSupplyC.toFixed(1)} °C</strong></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title={t('nextMpcRecommendation')} subtitle={`${t('mpcHorizon')} 3h · ${t('controlStep')} 30 min`}>
        <div className="mpc-trajectory">
          {guidedRuntime.optimisation.trajectories.supplyC.map((supply, index) => (
            <div key={index}>
              <span>+{(index + 1) * 30} min</span>
              <b>{supply.toFixed(1)}°C · {guidedRuntime.optimisation.trajectories.pumpHz[index].toFixed(1)} Hz</b>
              <small>{t('valve')} {(['near', 'mid', 'far'] as const).map((zone) => (guidedRuntime.optimisation.trajectories.valves[zone][index] * 100).toFixed(0)).join('/')}% · P5 min {guidedRuntime.thermalPrediction.points[index].minimumPointC.toFixed(2)}°C</small>
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        title={t('buildingSnapshot')}
        subtitle={`${guidedRuntime.buildings.length} · ${t('simulationEngineState')}`}
      >
        <div className="building-snapshot-grid">
          {guidedRuntime.buildings.map((building) => (
            <div key={building.id}>
              <span>{building.id} · {t(building.zone)}</span>
              <b>{building.indoorC.toFixed(1)} °C</b>
              <small>{t('requiredHeat')} {building.requiredHeatKw.toFixed(1)} kW</small>
            </div>
          ))}
        </div>
        <div className="preview-action">
          <p>{t('simulationResultBoundary')}</p>
          <button className="primary-btn" onClick={onResults}>{t('viewFullDayResults')} →</button>
        </div>
      </Panel>
    </div>
  );
}

function Simulation({
  t,
  mode,
  recommendation,
  setMode,
  networkState,
  setNetworkState,
  buildingItems,
  selectedBuilding,
  setSelectedBuilding,
  onApply,
  applied,
  frameIndex,
  simulationTime,
  isPlaying,
  setIsPlaying: setPlaying,
  onStep,
  onReset = () => window.location.reload(),
  events,
  clearEvents,
}: {
  t: T;
  mode: ControlMode;
  recommendation: typeof recommendationFixture;
  setMode: (mode: ControlMode) => void;
  networkState: HeatingNetworkState;
  setNetworkState: (state: HeatingNetworkState) => void;
  buildingItems: Building[];
  selectedBuilding: Building | null;
  setSelectedBuilding: (b: Building | null) => void;
  onApply: () => void;
  applied: boolean;
  frameIndex: number;
  simulationTime: string;
  isPlaying: boolean;
  setIsPlaying: (value: boolean) => void;
  onStep: () => void;
  onReset?: () => void;
  events: SemanticActionRecord[];
  clearEvents: () => void;
}) {
  const selected = selectedBuilding ?? buildingItems[2];
  const frame = timeline[frameIndex];
  const setIsPlaying = (value: boolean) => {
    if (!value && !isPlaying) onReset();
    else setPlaying(value);
  };
  const setValue = (
    key: 'supplyTemperatureC' | 'pumpFrequencyHz',
    value: number,
  ) => setNetworkState(applyPrototypeControl(networkState, { [key]: value }));
  const eventDetail = (event: SemanticActionRecord) =>
    interpolate(t(event.detailKey), {
      time: event.detailValue ?? '',
      mode: event.detailValue ?? '',
    });
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <p className="kicker">{t('playback')}</p>
          <h1>{t('simulation')}</h1>
          <p>{t('simulationDescription')}</p>
        </div>
        <div className="playback">
          <button
            className="primary-btn"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? `Ⅱ ${t('pause')}` : `▶ ${t('play')}`}
          </button>
          <button className="ghost-btn" onClick={onStep}>
            ▷ {t('step')}
          </button>
          <button className="ghost-btn" onClick={onReset}>
            ↻ {t('reset')}
          </button>
        </div>
      </div>
      <div className="sim-top-cards">
        <KpiCard
          icon="♨"
          label={t('outdoor')}
          value={`${frame.outdoorTemperatureC.toFixed(1)} °C`}
          note={simulationTime}
        />
        <KpiCard
          icon="☼"
          label={t('solarRadiation')}
          value={`${scenario.weather.solarRadiationWm2} W/m²`}
          note="↑ 28%"
          tone="orange"
        />
        <KpiCard
          icon="≋"
          label={t('windSpeed')}
          value={`${scenario.weather.windSpeedMs} m/s`}
          note="↓ 12%"
          tone="blue"
        />
        <KpiCard
          icon="⌘"
          label={t('controlMode')}
          value={t(mode)}
          note={mode === 'optimised' ? t('autoApplied') : t('fixtureData')}
          tone="green"
        />
      </div>
      <div className="content-grid simulation-main">
        <Panel
          className="network-panel"
          title={t('secondaryNetwork')}
          subtitle={t('fixture')}
        >
          <NetworkMap
            t={t}
            networkState={networkState}
            buildingItems={buildingItems}
            onBuildingClick={setSelectedBuilding}
          />
        </Panel>
        <div className="sim-rail">
          <Panel title={t('controlMode')}>
            <ModeSelector mode={mode} setMode={setMode} t={t} />
            <div className="control-fields">
              <label>
                {t('supply')}
                <input
                  type="number"
                  min={equipmentLimits.supplyTemperatureC.min}
                  max={equipmentLimits.supplyTemperatureC.max}
                  value={networkState.supplyTemperatureC}
                  onChange={(e) =>
                    setValue('supplyTemperatureC', Number(e.target.value))
                  }
                />
                <small>40–60°C · ±2°C / {t('step')}</small>
              </label>
              <label>
                {t('pumpFrequency')}
                <input
                  type="number"
                  min={equipmentLimits.pumpFrequencyHz.min}
                  max={equipmentLimits.pumpFrequencyHz.max}
                  value={networkState.pumpFrequencyHz}
                  onChange={(e) =>
                    setValue('pumpFrequencyHz', Number(e.target.value))
                  }
                />
                <small>30–50 Hz · ±2 Hz / {t('step')}</small>
              </label>
              {zoneKeys.map((zone) => (
                <label key={zone}>
                  {t(zone)} {t('valve')}
                  <input
                    type="number"
                    min={equipmentLimits.valveOpeningPct.min}
                    max={equipmentLimits.valveOpeningPct.max}
                    value={networkState.zones[zone].valveOpeningPct}
                    onChange={(e) =>
                      setNetworkState(
                        applyPrototypeControl(networkState, {
                          valves: { [zone]: Number(e.target.value) },
                        }),
                      )
                    }
                  />
                  <small>20–100% · ±10 pp / {t('step')}</small>
                </label>
              ))}
            </div>
          </Panel>
          <Recommendation
            t={t}
            mode={mode}
            recommendation={recommendation}
            networkState={networkState}
            onApply={onApply}
            applied={applied}
          />
        </div>
      </div>
      <div className="content-grid chart-grid sim-charts">
        <Panel title={t('indoorByZone')}>
          <Legend
            items={zoneKeys.map((zone, i) => ({
              label: t(zone),
              color: ['#ef3946', '#22b786', '#277fec'][i],
            }))}
          />
          <LineChart
            labels={timeline.map((item) => item.time)}
            values={timeline.map(
              () =>
                buildingItems
                  .filter((b) => b.zone === 'near')
                  .reduce((sum, b) => sum + b.indoorTemperatureC, 0) / 4,
            )}
            values2={timeline.map(
              () =>
                buildingItems
                  .filter((b) => b.zone === 'mid')
                  .reduce((sum, b) => sum + b.indoorTemperatureC, 0) / 4,
            )}
            color="#ef3946"
            color2="#22b786"
            min={16}
            max={26}
            unit="°C"
            ariaLabel={t('indoorByZone')}
          />
        </Panel>
        <Panel title={t('heatLoadVsSupply')}>
          <Legend
            items={[
              { label: t('requiredHeat'), color: '#ef3946' },
              { label: t('currentSupply'), color: '#1479f5' },
            ]}
          />
          <LineChart
            labels={timeline.map((item) => item.time)}
            values={timeline.map(() => networkState.requiredHeatLoadMw)}
            values2={timeline.map(() => networkState.currentHeatSupplyMw)}
            color="#ef3946"
            color2="#1479f5"
            min={0}
            max={3.2}
            unit="MW"
            ariaLabel={t('heatLoadVsSupply')}
          />
        </Panel>
        <Panel title={t('pumpTrend')}>
          <LineChart
            labels={timeline.map((item) => item.time)}
            values={timeline.map(() => networkState.pumpPowerKw)}
            values2={timeline.map(
              (_, i) => i * networkState.pumpPowerKw * 0.45,
            )}
            color="#1479f5"
            color2="#8ba5c8"
            min={0}
            max={160}
            unit="kW / kWh"
            ariaLabel={t('pumpTrend')}
          />
        </Panel>
        <Panel title={t('valveTrend')}>
          <Legend
            items={zoneKeys.map((zone, i) => ({
              label: t(zone),
              color: ['#ef3946', '#22b786', '#277fec'][i],
            }))}
          />
          <LineChart
            labels={timeline.map((item) => item.time)}
            values={timeline.map((item) => item.nearValvePct)}
            values2={timeline.map((item) => item.farValvePct)}
            color="#ef3946"
            color2="#277fec"
            min={20}
            max={100}
            unit="%"
            ariaLabel={t('valveTrend')}
          />
        </Panel>
      </div>
      <Panel
        title={`${t('selectedBuilding')} — ${selected.id}`}
        className="detail-panel"
      >
        <div className="detail-grid">
          <div>
            <span>{t('area')}</span>
            <b>{selected.areaM2} m²</b>
          </div>
          <div>
            <span>{t('year')}</span>
            <b>{selected.year}</b>
          </div>
          <div>
            <span>{t('insulation')}</span>
            <b>{t(selected.insulation.toLowerCase())}</b>
          </div>
          <div>
            <span>{t('zone')}</span>
            <b>{t(selected.zone)}</b>
          </div>
          <div>
            <span>{t('currentIndoor')}</span>
            <b className={selected.indoorTemperatureC > 23 ? 'text-red' : ''}>
              {selected.indoorTemperatureC.toFixed(1)} °C
            </b>
          </div>
          <div>
            <span>{t('predictedIndoor')}</span>
            <b>
              {recommendationFixture.selectedBuildingPredictedC.toFixed(1)} °C
            </b>
          </div>
          <div>
            <span>{t('zoneFlow')}</span>
            <b>{networkState.zones[selected.zone].flowM3h.toFixed(1)} m³/h</b>
          </div>
          <div>
            <span>{t('transportDelay')}</span>
            <b>{networkState.zones[selected.zone].transportDelayMin} min</b>
          </div>
        </div>
        <button
          className="close-detail"
          aria-label={t('close')}
          onClick={() => setSelectedBuilding(null)}
        >
          ×
        </button>
      </Panel>
      <Panel
        title={t('events')}
        action={
          <button className="text-btn" onClick={clearEvents}>
            {t('clear')}
          </button>
        }
        className="event-panel"
      >
        <div className="event-log">
          {events.map((event, i) => (
            <div key={`${event.type}-${i}`}>
              <i
                className={
                  event.type.includes('mpc') ? 'blue-dot' : 'green-dot'
                }
              />
              <span>{event.at}</span>
              <b>{t(eventLabels[event.type] ?? event.type)}</b>
              <em>{eventDetail(event)}</em>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Insight({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="insight">
      <span>{number}</span>
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  );
}

function PreviewForecast({ t }: { t: T }) {
  const forecastPoints = guidedRuntime.forecast.filter((item) =>
    [60, 120, 180, 360].includes(item.horizonMinutes),
  );
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <p className="kicker">{t('previewLabel')}</p>
          <h1>{t('forecastTitle')}</h1>
          <p>{t('forecastDescription')}</p>
          <span className="forecast-asof">
            {interpolate(t('asOf'), {
              time: guidedRuntime.forecastAsOf.slice(11, 16),
            })}
          </span>
        </div>
        <span className="model-badge">
          {guidedRuntime.model.displayName} · {guidedRuntime.model.type}
        </span>
      </div>
      <Panel
        className="prediction-panel"
        title={t('loadPredictionTitle')}
        subtitle={`${guidedRuntime.providers.loadPrediction.version} · ${guidedRuntime.providers.loadPrediction.type} · ${t('simulationCalibratedInterval')}`}
      >
        <div className="prediction-strip">
          {guidedRuntime.predictions.map((prediction) => (
            <div key={prediction.horizonHours}>
              <span>
                +{prediction.horizonHours}h ·{' '}
                {prediction.targetTime.slice(11, 16)}
              </span>
              <b>{prediction.pointMw.toFixed(3)} MW</b>
              <small>
                {t('interval')}: {prediction.lowerMw.toFixed(3)}–
                {prediction.upperMw.toFixed(3)} MW
              </small>
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        className="prediction-panel"
        title={t('thermalPredictionTitle')}
        subtitle={`${guidedRuntime.providers.thermalPrediction.version} · ${t('simulationCalibratedInterval')}`}
      >
        <div className="prediction-strip thermal-prediction-strip">
          {guidedRuntime.thermalPrediction.points
            .filter((point) => [30, 60, 120, 180].includes(point.horizonMinutes))
            .map((point) => (
              <div key={point.horizonMinutes}>
                <span>+{point.horizonMinutes < 60 ? '0.5' : point.horizonMinutes / 60}h · {point.targetTime.slice(11, 16)}</span>
                <b>{point.minimumPointC.toFixed(2)}°C</b>
                <small>±{point.halfWidthC.toFixed(3)}°C · {t('minimumBuilding')}</small>
              </div>
            ))}
          <div>
            <span>+6h</span><b>{t('p5ValidatedHorizon')}</b>
            <small>±{guidedRuntime.thermalPrediction.sixHourHalfWidthC.toFixed(3)}°C</small>
          </div>
        </div>
      </Panel>
      <div className="content-grid preview-results-grid">
        <Panel
          title={t('issuedWeatherForecast')}
          subtitle={t('forecastInputOnly')}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('targetTime')}</th>
                  <th>{t('outdoor')}</th>
                  <th>{t('solarRadiation')}</th>
                  <th>{t('requiredHeat')}</th>
                </tr>
              </thead>
              <tbody>
                {forecastPoints.map((weather, index) => (
                  <tr key={weather.horizonMinutes}>
                    <td>{weather.targetTime.slice(11, 16)}</td>
                    <td>{weather.outdoorC.toFixed(1)}°C</td>
                    <td>{weather.solarWm2.toFixed(0)} W/m²</td>
                    <td>
                      <b>
                        {guidedRuntime.predictions[index].pointMw.toFixed(3)} MW
                      </b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title={t('recommendedControls')} subtitle={guidedRuntime.providers.optimisation.version}>
          <div className="metric-list">
            <div>
              <span>{t('supply')}</span>
              <b>
                {guidedRuntime.now.traditionalControls.supplyC.toFixed(1)} →{' '}
                {guidedRuntime.recommendation.supplyC.toFixed(1)}°C
              </b>
            </div>
            <div>
              <span>{t('pumpFrequency')}</span>
              <b>
                {guidedRuntime.now.traditionalControls.pumpHz.toFixed(1)} →{' '}
                {guidedRuntime.recommendation.pumpHz.toFixed(1)} Hz
              </b>
            </div>
            <div>
              <span>{t('valve')}</span>
              <b>
                {guidedRuntime.recommendation.valvesPct
                  .map((value) => value.toFixed(0))
                  .join(' / ')}
                %
              </b>
            </div>
            <div>
              <span>{t('projectedMinimumIndoor')}</span>
              <b>{guidedRuntime.projection.minimumIndoorC.toFixed(2)}°C</b>
            </div>
            <div>
              <span>{t('projectedOversupply')}</span>
              <b>{guidedRuntime.projection.oversupplyMWh.toFixed(3)} MWh</b>
            </div>
          </div>
          <p className="panel-note">{guidedRuntime.recommendation.reason}</p>
        </Panel>
      </div>
      <div className="callout-note">
        <b>{t('forecastBoundary')}</b>
        <p>{t('previewForecastBoundaryText')}</p>
      </div>
    </div>
  );
}

function Forecast({
  t,
  horizon,
  forecastAsOf,
  setHorizon,
}: {
  t: T;
  horizon: ForecastHorizon;
  forecastAsOf: string;
  setHorizon: (horizon: ForecastHorizon) => void;
}) {
  const data = selectForecastForHorizon(horizon, forecastAsOf);
  const kpis = selectForecastKpis(horizon, forecastAsOf);
  const rows = selectBuildingForecasts(horizon, forecastAsOf);
  const bins = selectDistributionBins(horizon, forecastAsOf);
  const insights = selectForecastInsights(horizon, forecastAsOf);
  const outdoor = data.outdoorTemperatureC;
  const startOutdoor = outdoor[0];
  const endOutdoor = outdoor[outdoor.length - 1];
  const insightTitles = [
    'rapidWarmingInsightTitle',
    'solarInsightTitle',
    'overheatingInsightTitle',
    'farInsightTitle',
  ];
  const insightTexts = [
    'rapidWarmingInsightText',
    'solarInsightText',
    'overheatingInsightText',
    'farInsightText',
  ];
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <p className="kicker">{t('previewLabel')}</p>
          <h1>{t('forecastTitle')}</h1>
          <p>{t('forecastDescription')}</p>
          <span className="forecast-asof">
            {interpolate(t('asOf'), { time: data.forecastAsOf })}
          </span>
        </div>
        <div className="horizon-tabs">
          {horizonKeys.map((key) => (
            <button
              className={horizon === key ? 'active' : ''}
              key={key}
              onClick={() => setHorizon(key)}
            >
              {t(`next${key}`)}
            </button>
          ))}
        </div>
      </div>
      <Panel
        className="prediction-panel"
        title={t('loadPredictionTitle')}
        subtitle={`${t('rapid')} · ${interpolate(t('asOf'), { time: guidedRuntime.forecastAsOf.slice(11, 16) })}`}
        action={
          <span className="model-badge">
            {guidedRuntime.model.displayName} · {guidedRuntime.model.version}
          </span>
        }
      >
        <div className="prediction-strip">
          {guidedRuntime.predictions.map((prediction) => (
            <div key={prediction.horizonHours}>
              <span>
                +{prediction.horizonHours}h ·{' '}
                {prediction.targetTime.slice(11, 16)}
              </span>
              <b>{prediction.pointMw.toFixed(3)} MW</b>
              <small>
                {t('interval')}: {prediction.lowerMw.toFixed(3)}–
                {prediction.upperMw.toFixed(3)} MW
              </small>
            </div>
          ))}
        </div>
        <div className="prediction-recommendation">
          <b>{t('recommendedControls')}</b>
          <span>
            {guidedRuntime.recommendation.supplyC.toFixed(1)}°C ·{' '}
            {guidedRuntime.recommendation.pumpHz.toFixed(1)} Hz ·{' '}
            {guidedRuntime.recommendation.valvesPct.join(' / ')}%
          </span>
          <small>{t('previewNotMpc')}</small>
        </div>
      </Panel>
      <div className="kpi-grid forecast-kpis">
        <KpiCard
          icon="♨"
          label={t('outdoor')}
          value={`${startOutdoor.toFixed(1)} → ${endOutdoor.toFixed(1)}°C`}
          note={`${horizon} ${t('hours')}`}
        />
        <KpiCard
          icon="♨"
          label={t('requiredHeat')}
          value={`${kpis.requiredHeatLoadMw.toFixed(2)} MW`}
          note={t('fixtureData')}
          tone="orange"
        />
        <KpiCard
          icon="♨"
          label={t('plannedSupply')}
          value={`${kpis.plannedHeatSupplyMw.toFixed(2)} MW`}
          note={t('optimisedShort')}
          tone="orange"
        />
        <KpiCard
          icon="↓"
          label={t('oversupply')}
          value={`${kpis.avoidableOversupplyMw.toFixed(2)} MW`}
          note={`${t('plannedSupply')} − ${t('requiredHeat')}`}
          tone="green"
        />
        <KpiCard
          icon="⌂"
          label={t('predictedIndoor')}
          value={`${data.predictedIndoorTemperatureC.toFixed(1)} °C`}
          note={`${t('interval')}: ${data.predictionIntervalC[0]}–${data.predictionIntervalC[1]}°C`}
          tone="green"
        />
        <KpiCard
          icon="!"
          label={t('overheating')}
          value={`${data.overheatingRiskPct}%`}
          note={`${t('confidence')}: ${t(data.confidence.toLowerCase())}`}
          tone="red"
        />
      </div>
      <div className="content-grid forecast-grid">
        <div className="forecast-charts">
          <Panel
            title={interpolate(t('outdoorForecastTitle'), { hours: horizon })}
          >
            <Legend
              items={[
                { label: t('historicalPast'), color: '#1479f5' },
                {
                  label: interpolate(t('forecastNext'), { hours: horizon }),
                  color: '#1479f5',
                  dashed: true,
                },
              ]}
            />
            <LineChart
              labels={data.series.labels}
              values={data.series.requiredHeatLoadMw.map((value) => value - 6)}
              values2={data.outdoorTemperatureC}
              color="#1479f5"
              color2="#1479f5"
              min={-8}
              max={8}
              unit="°C"
              ariaLabel={t('outdoorForecastTitle')}
            />
          </Panel>
          <Panel title={t('plannedVsRequired')}>
            <Legend
              items={[
                { label: t('requiredHeat'), color: '#ee3d45' },
                { label: t('plannedSupply'), color: '#1479f5' },
                {
                  label: t('traditionalShort'),
                  color: '#8195af',
                  dashed: true,
                },
              ]}
            />
            <LineChart
              labels={data.series.labels}
              values={data.series.requiredHeatLoadMw}
              values2={data.series.plannedSupplyMw}
              color="#ee3d45"
              color2="#1479f5"
              min={1.5}
              max={3.3}
              unit="MW"
              ariaLabel={t('plannedVsRequired')}
            />
          </Panel>
          <Panel title={t('indoorForecast')}>
            <Legend
              items={[
                { label: t('traditionalShort'), color: '#ee3d45' },
                { label: t('optimisedShort'), color: '#1479f5' },
                { label: t('comfortRange'), color: '#22b786', dashed: true },
              ]}
            />
            <LineChart
              labels={data.series.labels}
              values={data.series.traditionalIndoorC}
              values2={data.series.optimisedIndoorC}
              color="#ee3d45"
              color2="#1479f5"
              min={16}
              max={26}
              unit="°C"
              ariaLabel={t('indoorForecast')}
            />
          </Panel>
          <Panel
            title={interpolate(t('distributionAtTarget'), {
              time: data.forecastTargetTime,
            })}
          >
            <BarChart
              labels={bins.map((bin) => bin.label)}
              values={bins.map((bin) => bin.traditional)}
              values2={bins.map((bin) => bin.optimised)}
              unit={t('numberOfBuildings')}
              ariaLabel={interpolate(t('distributionAtTarget'), {
                time: data.forecastTargetTime,
              })}
            />
          </Panel>
        </div>
        <div className="forecast-side">
          <Panel title={t('insights')}>
            {insights.map((insight, i) => (
              <Insight
                key={insight.titleKey}
                number={String(i + 1)}
                title={t(insight.titleKey || insightTitles[i])}
                text={t(insight.textKey || insightTexts[i])}
              />
            ))}
          </Panel>
          <Panel title={t('keyForecastMetrics')}>
            <div className="metric-list">
              <div>
                <span>✓ {t('predictedCompliance')}</span>
                <b>{pct(data.predictedComplianceRate)}</b>
              </div>
              <div>
                <span>! {t('predictedOverheating')}</span>
                <b className="text-red">
                  {data.predictedOverheatingCount} / 12
                </b>
              </div>
              <div>
                <span>❄ {t('predictedUnderheating')}</span>
                <b>{data.predictedUnderheatingCount} / 12</b>
              </div>
              <div>
                <span>⌂ {t('predictedComfort')}</span>
                <b>{data.predictedComfortCount} / 12</b>
              </div>
              <div>
                <span>↓ {t('oversupply')}</span>
                <b>{kpis.avoidableOversupplyMw.toFixed(2)} MW</b>
              </div>
            </div>
          </Panel>
          <div className="callout-note">
            <b>{t('forecastBoundary')}</b>
            <p>{t('forecastBoundaryText')}</p>
          </div>
        </div>
      </div>
      <Panel title={interpolate(t('buildingForecast'), { hours: horizon })}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  t('building'),
                  t('area'),
                  t('year'),
                  t('insulation'),
                  t('zone'),
                  t('currentTemp'),
                  t('predictedTraditional'),
                  t('predictedAi'),
                  t('risk'),
                  t('confidence'),
                ].map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const building = buildings.find(
                  (item) => item.id === row.buildingId,
                )!;
                return (
                  <tr key={row.buildingId}>
                    <td>
                      <b>{building.id}</b>
                    </td>
                    <td>{building.areaM2}</td>
                    <td>{building.year}</td>
                    <td>{t(building.insulation.toLowerCase())}</td>
                    <td>{t(building.zone)}</td>
                    <td>{building.indoorTemperatureC.toFixed(1)}°C</td>
                    <td>{row.predictedTraditionalC.toFixed(1)}°C</td>
                    <td>{row.predictedAiC.toFixed(1)}°C</td>
                    <td>
                      <span
                        className={cx(
                          'risk-tag',
                          row.risk === 'overheating'
                            ? 'danger'
                            : row.risk === 'underheating'
                              ? 'cold'
                              : 'safe',
                        )}
                      >
                        {t(
                          row.risk === 'overheating'
                            ? 'riskOverheating'
                            : row.risk === 'underheating'
                              ? 'riskUnderheating'
                              : row.risk,
                        )}
                      </span>
                    </td>
                    <td>{t(row.confidence.toLowerCase())}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function PreviewResults({ t }: { t: T }) {
  const traditional = guidedRuntime.comparison.traditional;
  const preview = guidedRuntime.comparison.preview;
  const mpc = guidedRuntime.comparison.mpc;
  const distributionColors: Record<string, string> = {
    under18: '#4b93ed',
    cool18To20: '#63a9ef',
    comfort20To22: '#22b786',
    warm22To23: '#ee9b22',
    over23: '#ec424b',
  };
  const rows = [
    [
      t('heatConsumption'),
      traditional.heatEnergyMWh,
      preview.heatEnergyMWh,
      mpc.heatEnergyMWh,
      'MWh',
    ],
    [
      t('pumpElectricity'),
      traditional.pumpElectricityKWh,
      preview.pumpElectricityKWh,
      mpc.pumpElectricityKWh,
      'kWh',
    ],
    [
      t('compliance'),
      traditional.complianceRate * 100,
      preview.complianceRate * 100,
      mpc.complianceRate * 100,
      '%',
    ],
    [
      t('comfort'),
      traditional.comfortRate * 100,
      preview.comfortRate * 100,
      mpc.comfortRate * 100,
      '%',
    ],
    [
      t('overheating'),
      traditional.overheatingRate * 100,
      preview.overheatingRate * 100,
      mpc.overheatingRate * 100,
      '%',
    ],
    [t('severeOverheating'), traditional.severeOverheatingRate * 100, preview.severeOverheatingRate * 100, mpc.severeOverheatingRate * 100, '%'],
    [
      t('underheating'),
      traditional.underheatingRate * 100,
      preview.underheatingRate * 100,
      mpc.underheatingRate * 100,
      '%',
    ],
    [
      t('oversupply'),
      traditional.excessDeliveredHeatMWh,
      preview.excessDeliveredHeatMWh,
      mpc.excessDeliveredHeatMWh,
      'MWh',
    ],
    [t('requiredHeatLoad'), traditional.requiredHeatEnergyMWh, preview.requiredHeatEnergyMWh, mpc.requiredHeatEnergyMWh, 'MWh'],
    [t('actualHeatSupply'), traditional.actualHeatSupplyMeanMW, preview.actualHeatSupplyMeanMW, mpc.actualHeatSupplyMeanMW, 'MW'],
    ['P10', traditional.P10C, preview.P10C, mpc.P10C, '°C'],
    ['P50', traditional.P50C, preview.P50C, mpc.P50C, '°C'],
    ['P90', traditional.P90C, preview.P90C, mpc.P90C, '°C'],
    [t('temperatureSpread'), traditional.temperatureSpreadC, preview.temperatureSpreadC, mpc.temperatureSpreadC, '°C'],
  ] as const;
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <p className="kicker">{t('previewLabel')}</p>
          <h1>{t('resultsTitle')}</h1>
          <p>{t('resultsDescription')}</p>
        </div>
        <span className="live-badge">{t('simulationOnlyBadge')}</span>
      </div>
      <div className="kpi-grid preview-result-kpis">
        {[
          [t('heatConsumption'), `${mpc.heatEnergyMWh.toFixed(3)} MWh`],
          [
            t('pumpElectricity'),
            `${mpc.pumpElectricityKWh.toFixed(2)} kWh`,
          ],
          [t('compliance'), pct(mpc.complianceRate)],
          [t('comfort'), pct(mpc.comfortRate)],
          [t('overheating'), pct(mpc.overheatingRate)],
          [t('oversupply'), `${mpc.excessDeliveredHeatMWh.toFixed(3)} MWh`],
        ].map(([label, value], index) => (
          <KpiCard
            key={label}
            icon={['♨', '⚡', '✓', '⌂', '!', '↓'][index]}
            label={label}
            value={value}
            tone="green"
          />
        ))}
      </div>
      <Panel
        className="snapshot-distribution"
        title={t('decisionSnapshotDistribution')}
        subtitle={`${guidedRuntime.simulationTime.slice(11, 16)} · ${guidedRuntime.buildings.length} ${t('buildings')}`}
      >
        <div
          className="distribution-bar"
          role="img"
          aria-label={t('decisionSnapshotDistribution')}
        >
          {guidedRuntime.temperatureDistribution.map((bin) => (
            <span
              key={bin.key}
              style={{
                background: distributionColors[bin.key],
                width: `${bin.fraction * 100}%`,
              }}
              title={`${t(bin.key)}: ${bin.count}`}
            />
          ))}
        </div>
        <div className="distribution-legend">
          {guidedRuntime.temperatureDistribution.map((bin) => (
            <span key={bin.key}>
              <i style={{ background: distributionColors[bin.key] }} />
              {t(bin.key)} <b>{bin.count}</b> ({pct(bin.fraction)})
            </span>
          ))}
        </div>
        <p className="panel-note">{t('snapshotDistributionNote')}</p>
      </Panel>
      <div className="content-grid preview-results-grid">
        <Panel
          title={t('canonicalComparison')}
          subtitle={`${t('rapid')} · ${t('sameInitialState')}`}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('metric')}</th>
                  <th>{t('traditionalShort')}</th>
                  <th>{t('previewShort')}</th>
                  <th>{t('formalMpc')}</th>
                  <th>{t('difference')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, before, previewValue, after, unit]) => (
                  <tr key={label}>
                    <td>
                      <b>{label}</b>
                    </td>
                    <td>
                      {before.toFixed(3)} {unit}
                    </td>
                    <td>
                      {previewValue.toFixed(3)} {unit}
                    </td>
                    <td>
                      {after.toFixed(3)} {unit}
                    </td>
                    <td>
                      {(after - before).toFixed(3)} {unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            {t('fallbackCount')}: {mpc.fallbackCount} · {t('solverStatusSummary')}: {Object.entries(mpc.solverStatusSummary).map(([status, count]) => `${status} ${count}`).join(' · ')} · {t('verificationFailures')}: {mpc.verificationFailureCount}
          </p>
        </Panel>
        <Panel title={t('modelComparison')} subtitle={t('heldOut')}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('model')}</th>
                  <th>{t('mae')}</th>
                  <th>{t('rmse')}</th>
                  <th>{t('r2')}</th>
                </tr>
              </thead>
              <tbody>
                {guidedRuntime.modelComparison.map((metric) => (
                  <tr key={metric.name}>
                    <td>{metric.name}</td>
                    <td>
                      <b>{metric.maeMw.toFixed(4)}</b>
                    </td>
                    <td>{metric.rmseMw.toFixed(4)}</td>
                    <td>{metric.r2.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">ⓘ {t('modelNote')}</p>
        </Panel>
      </div>
      <Panel title={t('actuatorAblation')} subtitle={t('acceptedP6Evidence')}>
        <div className="actuator-story">
          {guidedRuntime.ablation.map((item, index) => (
            <div key={item.actuatorMode}>
              <span>{index + 1}</span>
              <b>{t(item.actuatorMode)}</b>
              <small>{t('heatConsumption')} {item.metrics.heatEnergyMWh.toFixed(3)} MWh · {t('pumpElectricity')} {item.metrics.pumpElectricityKWh.toFixed(2)} kWh · &gt;23°C {pct(item.metrics.overheatingRate)}</small>
            </div>
          ))}
        </div>
        <p className="panel-note">{t('actuatorStory')}</p>
      </Panel>
      <div className="quote-card">
        <span>“</span>
        <p>{t('explanation')}</p>
      </div>
    </div>
  );
}

function Results({ t }: { t: T }) {
  const comparison = selectResultsComparison();
  const traditional = comparison.kpis.traditional;
  const optimised = comparison.kpis.optimised;
  const percentiles = selectTemperaturePercentiles();
  const kpiLabels = [
    t('heatConsumption'),
    t('pumpElectricity'),
    t('compliance'),
    t('comfort'),
    t('overheating'),
    t('underheating'),
  ];
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <p className="kicker">{t('staticPrototype')}</p>
          <h1>{t('resultsTitle')}</h1>
          <p>{t('resultsDescription')}</p>
        </div>
        <span className="live-badge">{t('fixture')}</span>
      </div>
      <div className="kpi-grid results-kpis">
        {[
          [t('heatConsumption'), `${optimised[0].toFixed(1)} MWh`],
          [t('pumpElectricity'), `${optimised[1]} kWh`],
          [t('compliance'), `${optimised[2]}%`],
          [t('comfort'), `${optimised[3]}%`],
          [t('overheating'), `${optimised[4]}%`],
          [t('underheating'), `${optimised[5]}%`],
          [
            t('oversupply'),
            `${comparison.avoidableHeatLossMwh.toFixed(1)} MWh`,
          ],
          [t('hydraulic'), comparison.hydraulicBalance.optimised.toFixed(2)],
        ].map(([label, value], i) => (
          <KpiCard
            key={label}
            icon={['♨', '⚡', '✓', '⌂', '!', '❄', '↓', '⇄'][i]}
            label={label}
            value={value}
            note={
              i === 0
                ? '−8.7%'
                : i === 1
                  ? '−17.1%'
                  : i === 2
                    ? '+8.3 pp'
                    : i === 3
                      ? '+33.4 pp'
                      : i === 4
                        ? '−16.7 pp'
                        : i === 5
                          ? '−8.3 pp'
                          : i === 6
                            ? '~8.7%'
                            : '+0.24'
            }
            tone={i === 4 || i === 5 ? 'green' : i === 6 ? 'blue' : 'green'}
          />
        ))}
      </div>
      <div className="content-grid results-grid">
        <Panel title={t('resultsTitle')} className="wide-panel">
          <Legend
            items={[
              { label: t('traditionalShort'), color: '#9aa9ba' },
              { label: t('optimisedShort'), color: '#1479f5' },
            ]}
          />
          <BarChart
            labels={kpiLabels}
            values={traditional}
            values2={optimised}
            unit={t('valuePerMetric')}
            ariaLabel={t('resultsTitle')}
          />
        </Panel>
        <Panel title={t('distribution')}>
          <div className="percentile-row">
            <div>
              <span>P10</span>
              <b>{percentiles.p10.toFixed(1)}°C</b>
            </div>
            <div>
              <span>P50 / Median</span>
              <b>{percentiles.p50.toFixed(1)}°C</b>
            </div>
            <div>
              <span>P90</span>
              <b>{percentiles.p90.toFixed(1)}°C</b>
            </div>
            <div>
              <span>Spread</span>
              <b>{percentiles.spread.toFixed(1)}°C</b>
            </div>
          </div>
          <LineChart
            labels={['P10', 'P50', 'P90']}
            values={[percentiles.p10, percentiles.p50, percentiles.p90]}
            values2={comparison.aiPercentileC}
            color="#9aa9ba"
            color2="#1479f5"
            min={16}
            max={26}
            unit="°C"
            ariaLabel={t('distribution')}
          />
        </Panel>
      </div>
      <div className="content-grid results-lower">
        <Panel title={t('flowDistribution')}>
          <Legend
            items={[
              { label: t('traditionalShort'), color: '#9aa9ba' },
              { label: t('optimisedShort'), color: '#1479f5' },
            ]}
          />
          <BarChart
            labels={zoneKeys.map((zone) => t(zone))}
            values={comparison.zoneFlow.traditional}
            values2={comparison.zoneFlow.optimised}
            unit={t('flowRate')}
            ariaLabel={t('flowDistribution')}
          />
        </Panel>
        <Panel title={t('simulatedWindows')}>
          <BarChart
            labels={zoneKeys.map((zone) => t(zone))}
            values={comparison.windowEvents.traditional}
            values2={comparison.windowEvents.optimised}
            unit={t('eventsCount')}
            ariaLabel={t('simulatedWindows')}
          />
          <p className="panel-note">{t('simulationOnly')}</p>
        </Panel>
        <Panel
          title={t('modelComparison')}
          subtitle={t('heldOut')}
          className="model-panel"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('model')}</th>
                  <th>{t('mae')}</th>
                  <th>{t('rmse')}</th>
                  <th>{t('r2')}</th>
                </tr>
              </thead>
              <tbody>
                {modelMetrics.map((metric) => (
                  <tr key={metric.name}>
                    <td>{metric.name}</td>
                    <td>
                      <b>{metric.mae.toFixed(2)}</b>
                    </td>
                    <td>{metric.rmse.toFixed(2)}</td>
                    <td>{metric.r2?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">ⓘ {t('modelNote')}</p>
        </Panel>
      </div>
      <div className="quote-card">
        <span>“</span>
        <p>{t('explanation')}</p>
      </div>
    </div>
  );
}

function Settings({ t }: { t: T }) {
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <p className="kicker">{t('configuration')}</p>
          <h1>{t('settingsTitle')}</h1>
          <p>{t('settingsDescription')}</p>
        </div>
        <span className="live-badge">{t('fixtureProfile')}</span>
      </div>
      <div className="settings-grid">
        <Panel title={t('targets')}>
          <div className="settings-fields">
            {[
              [t('comfortTarget'), '20–22 °C'],
              [t('complianceThreshold'), '18 °C'],
              [t('overheatThreshold'), '>23 °C'],
              [t('horizon'), '6 / 24 / 48'],
              [t('controlStep'), '30 minutes'],
            ].map(([label, value]) => (
              <label key={label}>
                {label}
                <input value={value} readOnly />
              </label>
            ))}
          </div>
        </Panel>
        <Panel title={t('limits')} subtitle={t('limitsNote')}>
          <div className="limits-list">
            <div>
              <span>{t('supply')}</span>
              <b>
                {equipmentLimits.supplyTemperatureC.min}–
                {equipmentLimits.supplyTemperatureC.max}°C
              </b>
              <em>
                {t('maxStep')} ±{equipmentLimits.supplyTemperatureC.step}°C
              </em>
            </div>
            <div>
              <span>{t('pumpFrequency')}</span>
              <b>
                {equipmentLimits.pumpFrequencyHz.min}–
                {equipmentLimits.pumpFrequencyHz.max} Hz
              </b>
              <em>
                {t('maxStep')} ±{equipmentLimits.pumpFrequencyHz.step} Hz
              </em>
            </div>
            {zoneKeys.map((zone) => (
              <div key={zone}>
                <span>
                  {t(zone)} {t('valve')}
                </span>
                <b>
                  {equipmentLimits.valveOpeningPct.min}–
                  {equipmentLimits.valveOpeningPct.max}%
                </b>
                <em>
                  {t('maxStep')} ±{equipmentLimits.valveOpeningPct.step} pp
                </em>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={t('nominalDelays')}>
          <div className="delay-cards">
            {zoneKeys.map((zone) => (
              <div key={zone} className={`delay-${zone}`}>
                <b>{t(zone)}</b>
                <strong>
                  {fixtureNetwork.zones[zone].transportDelayMin} min
                </strong>
                <span>{t('displayOnly')}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={t('weights')}>
          <div className="weights">
            <span>
              {t('objectiveCompliance')} <b>{t('high')}</b>
            </span>
            <span>
              {t('objectiveComfort')} <b>{t('high')}</b>
            </span>
            <span>
              {t('objectiveOversupply')} <b>{t('medium')}</b>
            </span>
            <span>
              {t('objectivePump')} <b>{t('medium')}</b>
            </span>
            <span>
              {t('objectiveMovement')} <b>{t('low')}</b>
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function GuidedSettings({ t }: { t: T }) {
  const configuration = guidedRuntime.configuration;
  const weights = configuration.objective.weights;
  const objectiveRows = [
    [t('objectiveUnderheating'), t('strongProtection'), weights.belowComfortDegreeHoursBelow20],
    [t('objectiveOverheating'), t('highPenalty'), weights.mildOverheatingDegreeHoursAbove23],
    [t('objectiveSevereOverheating'), t('veryHighPenalty'), weights.severeOverheatingDegreeHoursAbove25],
    [t('objectiveOversupply'), t('optimisedPriority'), weights.normalizedAvoidableOversupply],
    [t('objectivePump'), t('optimisedPriority'), weights.normalizedPumpElectricity],
    [t('objectiveMovement'), t('regularisedPriority'), weights.normalizedControlMovement],
  ] as const;
  return (
    <div className="page guided-settings">
      <div className="page-intro">
        <div>
          <p className="kicker">{t('configuration')}</p>
          <h1>{t('settingsTitle')}</h1>
          <p>{t('settingsDescription')}</p>
        </div>
        <span className="live-badge">{t('fixtureProfile')}</span>
      </div>
      <div className="settings-grid">
        <Panel title={t('acceptedConfiguration')} subtitle={t('noRealEquipment')}>
          <div className="configuration-list">
            {[
              [t('physicalFixture'), configuration.physicalFixtureVersion],
              [t('controller'), configuration.controllerVersion],
              [t('requiredHeatPredictor'), `${guidedRuntime.providers.loadPrediction.version} · ${guidedRuntime.providers.loadPrediction.type}`],
              [t('thermalPredictor'), guidedRuntime.providers.thermalPrediction.version],
              [t('optimiser'), guidedRuntime.providers.optimisation.version],
              [t('decisionInterval'), `${configuration.controlIntervalMinutes} ${t('minutes')}`],
              [t('mpcHorizon'), `${configuration.mpcHorizonHours} ${t('hours')}`],
            ].map(([label, value]) => (
              <div key={label}><span>{label}</span><b>{value}</b></div>
            ))}
          </div>
        </Panel>
        <Panel title={t('horizonConfiguration')}>
          <div className="horizon-configuration">
            <div>
              <span>{t('predictionHorizons')}</span>
              <b>{configuration.predictionHorizonsHours.map((value) => `+${value}h`).join(' · ')}</b>
            </div>
            <div>
              <span>{t('thermalPredictionHorizons')}</span>
              <b>{configuration.thermalPredictionHorizonsHours.map((value) => `+${value}h`).join(' · ')}</b>
            </div>
            <div>
              <span>{t('forecastDisplayWindow')}</span>
              <b>{configuration.forecastDisplayWindowsHours.map((value) => `${value}h`).join(' · ')}</b>
            </div>
          </div>
        </Panel>
        <Panel title={t('limits')} subtitle={t('readOnlyFrozenConfiguration')}>
          <div className="configuration-list">
            <div><span>{t('supply')}</span><b>{configuration.equipmentBounds.supplyC.join('–')}°C · ±{configuration.rateLimitsPerStep.supplyC}°C / 30 min</b></div>
            <div><span>{t('pumpFrequency')}</span><b>{configuration.equipmentBounds.pumpHz.join('–')} Hz · ±{configuration.rateLimitsPerStep.pumpHz} Hz / 30 min</b></div>
            <div><span>{t('valve')}</span><b>{configuration.equipmentBounds.valveFraction.map((value) => value * 100).join('–')}% · ±{configuration.rateLimitsPerStep.valveFraction * 100} pp / 30 min</b></div>
            <div><span>{t('robustSafety')}</span><b>{configuration.robustSafety}</b></div>
            <div><span>{t('fallbackPolicy')}</span><b>{configuration.fallbackPolicy}</b></div>
          </div>
        </Panel>
        <Panel title={t('objectivePriorities')} subtitle={configuration.objectiveVersion}>
          <div className="objective-boundary">
            <b>{t('safetyHardConstraint')}</b>
            <p>{t('safetyHardConstraintText')}</p>
          </div>
          <div className="weights objective-weights">
            {objectiveRows.map(([label, priority, value]) => (
              <span key={label}>{label} <b>{priority}</b><small>{t('sourceWeight')}: {value.toFixed(2)}</small></span>
            ))}
          </div>
        </Panel>
        <Panel title={t('transportSnapshot')} subtitle={t('flowDependentDelayNote')}>
          <div className="delay-cards">
            {guidedRuntime.zones.map((zone) => (
              <div key={zone.key} className={`delay-${zone.key}`}>
                <b>{t(zone.key)}</b>
                <strong>{zone.transportDelayMin.toFixed(1)} min</strong>
                <span>{zone.flowM3h.toFixed(1)} m³/h</span>
              </div>
            ))}
          </div>
          <p className="panel-note">{t('transportSnapshotBoundary')}</p>
        </Panel>
      </div>
    </div>
  );
}

function App() {
  const [path, setPath] = useState(
    () => window.location.pathname || '/overview',
  );
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem('ai-heating-language') as Language) || 'en',
  );
  const [mode, setMode] = useState<ControlMode>('optimised');
  const [networkState, setNetworkState] = useState(() =>
    applyPrototypeControl(getFixtureOptimisedState(), guidedRecommendation),
  );
  const [buildingStates, setBuildingStates] = useState(
    buildings.map((building) => ({
      indoorTemperatureC: building.indoorTemperatureC,
    })),
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState('B03');
  const [frameIndex, setFrameIndex] = useState(0);
  const [simulationTime, setSimulationTime] = useState(scenario.resetTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recommendationApplicationStatus, setRecommendationApplicationStatus] =
    useState<ApplicationStatus>(() => applicationStatus('optimised', guidedStatus));
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>(6);
  const [events, setEvents] = useState<SemanticActionRecord[]>([
    {
      type: 'simulation_started',
      at: scenario.resetTime,
      detailKey: 'detailScenario',
    },
  ]);
  const t = useT(language);
  const buildingItems = useMemo(
    () =>
      buildingProfiles.map((profile, i) => ({
        ...profile,
        ...buildingStates[i],
      })),
    [buildingStates],
  );
  const selectedBuilding =
    buildingItems.find((building) => building.id === selectedBuildingId) ??
    buildingItems[2];
  const [latestRecommendation, setLatestRecommendation] =
    useState(guidedRecommendation);
  useEffect(() => {
    localStorage.setItem('ai-heating-language', language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const addEvent = (type: string, detailKey: string, detailValue?: string) =>
    setEvents((current) => [
      { type, at: simulationTime, detailKey, detailValue },
      ...current,
    ]);
  const changeMode = (next: ControlMode) => {
    setMode(next);
    const nextApplicationStatus = applicationStatus(next, guidedStatus);
    setRecommendationApplicationStatus(nextApplicationStatus);
    addEvent('control_mode_changed', 'detailMode', t(next));
    if (next === 'optimised' && nextApplicationStatus === 'APPLIED') {
      setNetworkState((state) =>
        applyPrototypeControl(state, latestRecommendation),
      );
      addEvent('mpc_recommendation_generated', 'detailFixturePlanReady');
      addEvent('mpc_control_auto_applied', 'detailOptimisedActive');
    }
  };
  const apply = () => {
    if (mode !== 'advisory') return;
    setNetworkState((state) =>
      applyPrototypeControl(state, latestRecommendation),
    );
    setRecommendationApplicationStatus('APPLIED');
    addEvent('recommendation_applied', 'detailOperatorConfirmed');
  };
  const step = () => {
    const next = Math.min(frameIndex + 1, timeline.length - 1);
    setFrameIndex(next);
    setSimulationTime(timeline[next].time);
    if (mode === 'optimised' && recommendationApplicationStatus === 'APPLIED') {
      setNetworkState((state) =>
        advancePrototypeTimeline(state, timeline[next]),
      );
      addEvent(
        'mpc_control_auto_applied',
        'detailTimelineFrame',
        timeline[next].time,
      );
    } else
      addEvent('simulation_step', 'detailTimelineFrame', timeline[next].time);
    if (next === timeline.length - 1) setIsPlaying(false);
  };
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(step, 1200);
    return () => window.clearInterval(interval);
  }, [isPlaying, frameIndex, mode, simulationTime, recommendationApplicationStatus]);
  const reset = () => {
    setIsPlaying(false);
    setFrameIndex(0);
    setSimulationTime(scenario.resetTime);
    setNetworkState(
      applyPrototypeControl(getFixtureOptimisedState(), guidedRecommendation),
    );
    setBuildingStates(
      buildings.map((building) => ({
        indoorTemperatureC: building.indoorTemperatureC,
      })),
    );
    setSelectedBuildingId('B03');
    setForecastHorizon(6);
    setLatestRecommendation(guidedRecommendation);
    setRecommendationApplicationStatus(applicationStatus('optimised', guidedStatus));
    setEvents([
      {
        type: 'simulation_reset',
        at: scenario.resetTime,
        detailKey: 'detailSimulationReset',
      },
    ]);
  };
  const navigate = (next: string) => {
    window.history.pushState({}, '', next);
    setPath(next);
  };
  const startPreview = () => {
    setSimulationTime(guidedRuntime.forecastAsOf.slice(11, 16));
    navigate('/simulation');
  };
  const content = path.startsWith('/simulation') ? (
    <GuidedSimulation
      t={t}
      mode={mode}
      setMode={changeMode}
      onResults={() => navigate('/results')}
      recommendationApplicationStatus={recommendationApplicationStatus}
    />
  ) : path.startsWith('/forecast') ? (
    <PreviewForecast t={t} />
  ) : path.startsWith('/results') ? (
    <PreviewResults t={t} />
  ) : path.startsWith('/settings') ? (
    <GuidedSettings t={t} />
  ) : (
    <Overview
      t={t}
      recommendation={latestRecommendation}
      mode={mode}
      networkState={networkState}
      buildingItems={buildingItems}
      setSelectedBuilding={(building) => setSelectedBuildingId(building.id)}
      onApply={apply}
      applied={mode === 'advisory' && recommendationApplicationStatus === 'APPLIED'}
      onStartPreview={startPreview}
    />
  );
  const tutorPage: TutorPage = path.startsWith('/simulation') ? 'simulation'
    : path.startsWith('/forecast') ? 'forecast'
      : path.startsWith('/results') ? 'results'
        : path.startsWith('/settings') ? 'settings' : 'overview';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◒</span>
          <div>
            <b>HeatPilot AI</b>
            <small>{t('productSubtitle')}</small>
          </div>
        </div>
        <nav>
          {[
            ['/overview', '⌂', 'overview'],
            ['/simulation', '◇', 'simulation'],
            ['/forecast', '↗', 'forecast'],
            ['/results', '▥', 'results'],
            ['/settings', '⚙', 'settings'],
          ].map(([href, icon, key]) => (
            <button
              key={href}
              className={path.startsWith(href) ? 'active' : ''}
              onClick={() => navigate(href)}
            >
              <Icon symbol={icon} />
              <span>{t(key)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="env-dot" />
          {t('environment')}
          <small>
            Pro · {t('districtHeating')}
            <br />
            {t('version')} 0.1.0
          </small>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="title-block">
            <h1>{t('productTitle')}</h1>
            <p>{t('productSubtitle')}</p>
          </div>
          <div className="header-controls">
            <label>
              <span>{t('scenario')}</span>
              <select defaultValue="rapid">
                <option value="rapid">☀ {t('rapid')}</option>
              </select>
            </label>
            <div className="header-mode">
              <span>{t('controlMode')}</span>
              <ModeSelector mode={mode} setMode={changeMode} t={t} />
            </div>
            <div className="header-time">
              <span>▣ {t('simulationTime')}</span>
              <b>
                {guidedRuntime.simulationTime.slice(0, 10)}{' '}
                {guidedRuntime.simulationTime.slice(11, 16)}
              </b>
            </div>
            <button
              className="language-btn"
              aria-label={language === 'en' ? '中文' : 'English'}
              onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
            >
              {language === 'en' ? '中文' : 'EN'}
            </button>
            <span className="env-badge">⚗ {t('environment')}</span>
          </div>
        </header>
        {content}
      </main>
      {tutorPage !== 'settings' && (
        <TutorPanel
          page={tutorPage}
          language={language}
          mode={mode}
          selectedBuildingId={selectedBuildingId}
          applicationState={recommendationApplicationStatus}
          semanticEvents={events.map(({ type, at }) => ({ type, at }))}
        />
      )}
      <button className="sr-only" onClick={reset}>
        {t('reset')}
      </button>
    </div>
  );
}

export default App;
