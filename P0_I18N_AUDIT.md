# P0 Internationalisation Audit

Status: PASS for the P0.1 localization scope. `src/i18n.ts` contains a parity-checked EN/ZH dictionary and `translate()` falls back only for an unknown key during development.

## Behaviour

- English is the default when `ai-heating-language` is absent.
- The header language switch updates React state immediately without a page reload.
- The switch works in both directions.
- The preference is stored under `ai-heating-language` and is read on the next load.
- `scripts/p0-invariants.ts` compares sorted EN/ZH key sets and fails on dictionary drift.
- The runtime capture covers English Overview/Simulation/Forecast/Results, Chinese Overview/Simulation, and all three control modes.

## Coverage matrix

| Surface | Result | Implementation |
|---|---|---|
| Navigation, page titles, page descriptions | PASS | `t()` keys in sidebar and page components |
| Global header, scenario, control modes, timestamp, environment | PASS | shared topbar dictionary keys |
| KPI labels and notes | PASS | Overview/Forecast/Results labels use `t()`; units remain units |
| Network labels, zones, status, transport-delay labels | PASS | `NetworkMap`, `SystemStatus`, detail, Settings use keys |
| Chart titles, legends, axes/units, accessibility labels | PASS | `Panel`, `Legend`, chart aria labels use localized keys; units are intentionally invariant |
| Table headers, risk/confidence/status values | PASS | Forecast table uses localized keys and domain risk/confidence values |
| Recommendations, warnings, alerts, forecast insights | PASS | recommendation, alert, insight, and boundary text use dictionary keys |
| Event-log display names and details | PASS | semantic event type → localized display key mapping; detail interpolation is localized |
| Settings labels, limits, objective weights, tooltips/accessibility labels | PASS | Settings and native/SVG controls use dictionary keys |

## Remaining hard-coded user-visible strings

The remaining literal strings are intentional exceptions or data tokens permitted by the P0 prompt:

- Product/technology names: `HeatPilot AI`, `AI`, `MPC`, `RC / 2R2C`.
- Model taxonomy names: `Linear Regression Baseline`, `LightGBM`, `GRU (Optional)`.
- Building IDs, scenario IDs, engineering units (`°C`, `MW`, `kW`, `kWh`, `m³/h`, `Hz`, `min`, `%`, `m²`), and numeric values.
- Language control tokens `中文` and `EN`.
- `Fixture`, `Pro`, and `P0` boundary/product labels used to make the static prototype boundary explicit.

No remaining hard-coded English sentence, page label, chart title, legend label, table status, warning, recommendation, event display name, setting label, or accessibility label is rendered by the app component tree.
