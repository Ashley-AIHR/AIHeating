import test from "node:test";
import assert from "node:assert/strict";
import { engineeringOutcomeReport } from "./engineering-report.mjs";
import { guardNarrative } from "./agent-evidence.mjs";
for (const locale of ["en", "zh-CN"]) {
  test(`${locale}: engineering summary lists only passing alternatives and retains infeasibility uncertainty`, () => {
    const study = {
      rows: [
        { id: "operations", kind: "operations", passed: false },
        { id: "emitters", kind: "engineering", passed: false },
        { id: "emitters-3", kind: "engineering", passed: true },
        { id: "auxiliary-60", kind: "engineering", passed: true },
      ],
    };
    const text = engineeringOutcomeReport(study, locale);
    assert.equal(guardNarrative(text).narrativeWithheld, false);
    assert.match(
      text,
      locale === "en" ? /tripled emitter UA/ : /总传热能力增至三倍/,
    );
    assert.match(
      text,
      locale === "en"
        ? /with supplementary electric heat/
        : /楼栋阀门与局部辅助电热/,
    );
    assert.doesNotMatch(text, /doubled emitter UA|总传热能力增至两倍/);
    assert.match(text, locale === "en" ? /does not prove/ : /不等于证明/);
    for (const row of study.rows) row.passed = false;
    assert.match(
      engineeringOutcomeReport(study, locale),
      locale === "en" ? /None of the tested/ : /均未通过全部检查/,
    );
    study.rows[0].passed = true;
    assert.match(
      engineeringOutcomeReport(study, locale),
      locale === "en"
        ? /existing-equipment control plan passed/
        : /现有设备控制方案通过/,
    );
  });
}
