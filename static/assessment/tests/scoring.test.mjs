// Run: node static/assessment/tests/scoring.test.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const S = require("../scoring.js");
const q = JSON.parse(readFileSync(new URL("../questions.json", import.meta.url), "utf8"));
const ids = S.questionIds(q);
const all = (v) => Object.fromEntries(ids.map((id) => [id, v]));
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok -", name); };

ok("16 scored questions, 8 dimensions", () => {
  assert.equal(ids.length, 16);
  assert.equal(q.dimensions.length, 8);
});

ok("integer formulas match round-half-up for every total", () => {
  for (let p = 0; p <= 6; p++) assert.equal(S.dimScore(p), Math.floor((100 * p) / 6 + 0.5 + 1e-9));
  for (let t = 0; t <= 48; t++) assert.equal(S.overallScore(t), Math.floor((100 * t) / 48 + 0.5 + 1e-9));
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(S.dimScore), [0, 17, 33, 50, 67, 83, 100]);
});

for (const fx of q.scoring.fixtures) {
  ok(`fixture ${fx.name}`, () => {
    const answers = typeof fx.answers === "string"
      ? all(Number(fx.answers.match(/= (\d)/)[1])) : fx.answers;
    const r = S.compute(q, answers);
    if (typeof fx.dimensions === "string") {
      const v = Number(fx.dimensions.match(/(\d+)/)[1]);
      for (const d of q.dimensions) assert.equal(r.dimensions[d.id], v, d.id);
    } else {
      assert.deepEqual(r.dimensions, fx.dimensions);
    }
    assert.equal(r.overall, fx.overall);
    assert.equal(r.stage.id, fx.stage);
    if (fx.red_flags) assert.deepEqual(r.red_flags, fx.red_flags);
  });
}

ok("all-zero raises every red flag, no unknowns", () => {
  const r = S.compute(q, all(0));
  assert.deepEqual(r.red_flags, ["C3b", "C4a", "C5a", "C5b", "C6b"]);
  assert.deepEqual(r.unknowns, []);
});

ok("'Not sure' scores 0 and marks the dimension unknown", () => {
  const a = all(3); a.C2a = 4;
  const r = S.compute(q, a);
  assert.equal(r.dimensions.C2, 50);
  assert.deepEqual(r.unknowns, ["C2"]);
});

ok("weakest three, ties broken by dimension order", () => {
  const r = S.compute(q, all(2));
  assert.deepEqual(r.weakest, ["V", "C1", "C2"]);
  const m = S.compute(q, q.scoring.fixtures[2].answers);
  assert.deepEqual(m.weakest, ["C1", "C7", "C3"]);
});

ok("fallback report has the API shape", () => {
  const r = S.compute(q, q.scoring.fixtures[2].answers);
  const rep = S.fallbackReport(q, r);
  assert.equal(rep.top_risks.length, 3);
  assert.ok(rep.plan_30_days.length >= 3 && rep.plan_30_days.length <= 5);
  for (const p of rep.plan_30_days) assert.ok(p.week >= 1 && p.week <= 4);
  for (const t of rep.top_risks) for (const s of t.aws_services) assert.ok(q.aws_services_allowed.includes(s), s);
  assert.ok(rep.executive_summary.split(/\s+/).length <= 90);
});

ok("missing answer throws", () => {
  const a = all(1); delete a.C7b;
  assert.throws(() => S.compute(q, a));
});

console.log(`\n${n} passed`);
