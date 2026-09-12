import assert from "node:assert/strict";
import { translate, tx } from "../src/localisation/index";
import { zh, templates } from "../src/localisation/catalogue";
for (const [source, translated] of Object.entries(zh)) {
  assert(translated.trim(), `Empty translation: ${source}`);
  assert.equal(translate(source, "en"), source);
  assert.equal(translate(source, "zh-CN"), translated, source);
}
for (const [en, cn] of templates)
  assert.deepEqual(
    [...en.matchAll(/\{\d+\}/g)].map((x) => x[0]).sort(),
    [...cn.matchAll(/\{\d+\}/g)].map((x) => x[0]).sort(),
  );
assert.equal(
  translate(
    "18.23°C; branch flow 9.12 m³/h; valve 45%; delay 24.5 min.",
    "zh-CN",
  ),
  "18.23°C；支路流量 9.12 m³/h；阀门 45%；延迟 24.5 分钟。",
);
assert.equal(
  translate(
    "B10 · B10, B11 exceed the demo 23°C overheating threshold.",
    "zh-CN",
  ),
  "B10 · B10, B11 超出演示过热阈值 23°C。",
);
assert.equal(
  translate('{"assetId":"B10","supplyC":42}', "zh-CN"),
  '{"assetId":"B10","supplyC":42}',
);
assert.equal(
  translate("unknown source label", "zh-CN"),
  "unknown source label",
);
assert.equal(
  translate("https://example.com/Assets", "zh-CN"),
  "https://example.com/Assets",
);
assert.equal(translate("B10", "zh-CN"), "B10");
assert.equal(translate("constructor", "zh-CN"), "constructor");
assert.equal(translate("__proto__", "zh-CN"), "__proto__");
assert.equal(tx(12.34), 12.34);
const state = { revision: 3, supplyC: 42 };
assert.equal(tx(state), state);
console.log(
  `PASS: ${Object.keys(zh).length} translations, ${templates.length} parameterised messages, numeric/ID/raw-evidence preservation.`,
);
