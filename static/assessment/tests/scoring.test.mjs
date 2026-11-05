// Run: node static/assessment/tests/scoring.test.mjs
import { createRequire } from "node:module";
import { readFileSync, readdirSync, existsSync } from "node:fs";
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

/* ---------- v3: personalised report by rules ---------- */
const P = q.personalisation;
const cq = Object.fromEntries(q.context_questions.map((c) => [c.id, c]));
const opt = (id, label) => {
  const i = cq[id].options.indexOf(label);
  assert.ok(i >= 0, `${id} has option ${label}`);
  return i;
};
const SAMPLE = { role: opt("role", "COO or operations leader"), size: 2, industry: opt("industry", "Software and SaaS"),
  use_case: opt("use_case", "Customer service and support"), stage: opt("stage", "Pilot with real users"),
  platform: opt("platform", "Mostly on AWS"), timeline: opt("timeline", "This quarter") };
const ctx = (over) => {
  const c = { ...SAMPLE };
  for (const [k, label] of Object.entries(over || {})) c[k] = opt(k, label);
  return c;
};
const zero = S.compute(q, all(0));
const mixed = S.compute(q, q.scoring.fixtures[2].answers);

ok("every context label is covered by the personalisation block", () => {
  const roles = [...P.role.leadership, ...P.role.technical];
  assert.deepEqual([...roles].sort(), [...cq.role.options].sort());
  const stages = Object.values(P.stage).flatMap((g) => g.options);
  assert.deepEqual([...stages].sort(), [...cq.stage.options].sort());
  assert.deepEqual(Object.keys(P.timeline).sort(), [...cq.timeline.options].sort());
  assert.deepEqual(Object.keys(P.lens).sort(), [...cq.use_case.options].sort());
  assert.deepEqual(Object.keys(P.offerings).sort(), [...cq.use_case.options].sort());
  for (const k of Object.keys(P.industry_notes)) assert.ok(cq.industry.options.includes(k), k);
  for (const k of Object.keys(P.platform_notes)) assert.ok(cq.platform.options.includes(k), k);
  for (const id of Object.keys(q.red_flag_text)) assert.ok(P.red_flag_fix[id], id);
});

ok("48 lens sentences, one per use case and dimension, all different", () => {
  const seen = new Set();
  for (const uc of cq.use_case.options) {
    for (const d of q.dimensions) {
      const sentence = P.lens[uc][d.id];
      assert.ok(typeof sentence === "string" && sentence.length > 40 && sentence.length < 220, `${uc} ${d.id}`);
      assert.ok(!/[\u2014{}]/.test(sentence), `${uc} ${d.id} has an em dash or placeholder`);
      seen.add(sentence);
    }
  }
  assert.equal(seen.size, 48);
});

ok("each top risk shows its business risk plus the use-case lens", () => {
  for (const uc of cq.use_case.options) {
    const rep = S.buildReport(q, mixed, ctx({ use_case: uc }));
    for (const t of rep.top_risks) {
      const d = S.dimension(q, t.dimension);
      assert.equal(t.business_impact, d.if_weak.business_risk);
      assert.equal(t.lens, P.lens[uc][t.dimension]);
    }
  }
});

ok("CTO and CFO get different framing", () => {
  const cto = S.buildReport(q, mixed, ctx({ role: "CTO or engineering leader" }));
  const cfo = S.buildReport(q, mixed, ctx({ role: "CFO or finance leader" }));
  const it = S.buildReport(q, mixed, ctx({ role: "IT or security leader" }));
  assert.equal(cto.frame, "technical");
  assert.equal(it.frame, "technical");
  assert.equal(cfo.frame, "leadership");
  assert.notEqual(cto.executive_summary, cfo.executive_summary);
  assert.match(cto.executive_summary, /controls/);
  assert.match(cfo.executive_summary, /decision/);
  for (const r of ["CEO, founder or general manager", "COO or operations leader", "Product leader", "Other"]) {
    assert.equal(S.buildReport(q, mixed, ctx({ role: r })).frame, "leadership", r);
  }
});

ok("stage sets the phase; full production marks red flags urgent", () => {
  const phase = (label) => S.buildReport(q, zero, ctx({ stage: label }));
  for (const l of ["Idea or early exploration", "Prototype or demo"]) assert.match(phase(l).executive_summary, /^.*Before your pilot,/s);
  for (const l of ["Pilot with real users", "Limited production"]) assert.match(phase(l).executive_summary, /Before launch,/);
  const live = phase("Full production");
  assert.match(live.executive_summary, /While it's live,/);
  assert.equal(live.fix_first.urgent, true);
  assert.equal(phase("Pilot with real users").fix_first.urgent, false);
  assert.equal(S.buildReport(q, mixed, ctx()).fix_first, null);
});

ok("executive summary stays under 90 words for every role and stage", () => {
  const worst = { ...mixed, weakest: ["V", "C4", "C5"], stage: q.scoring.stages[1] };
  for (const r of cq.role.options) for (const st of cq.stage.options) {
    for (const res of [worst, zero, mixed]) {
      const words = S.buildReport(q, res, ctx({ role: r, stage: st })).executive_summary.split(/\s+/).length;
      assert.ok(words <= 90, `${r} / ${st}: ${words} words`);
    }
  }
});

ok("'Within 30 days' compresses the plan into weeks 1-2, red flags first in week 1", () => {
  const rep = S.buildReport(q, zero, ctx({ timeline: "Within 30 days" }));
  const plan = rep.plan_30_days;
  const flagRows = plan.slice(0, zero.red_flags.length);
  assert.deepEqual(flagRows.map((p) => p.red_flag), zero.red_flags);
  for (const p of flagRows) assert.equal(p.week, 1);
  for (const p of plan) assert.ok(p.week === 1 || p.week === 2, `week ${p.week}`);
  assert.ok(rep.plan_intro.length > 0);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].week >= plan[i - 1].week);
});

ok("other timelines keep four weeks and never go backwards", () => {
  for (const t of cq.timeline.options) for (const res of [zero, mixed, S.compute(q, all(3))]) {
    const plan = S.buildReport(q, res, ctx({ timeline: t })).plan_30_days;
    for (let i = 1; i < plan.length; i++) assert.ok(plan[i].week >= plan[i - 1].week, t);
    const max = Math.max(...plan.map((p) => p.week));
    assert.equal(max, t === "Within 30 days" ? 2 : 4, t);
    for (const p of plan) assert.ok(p.action && !/[{}]/.test(p.action) && p.owner_role, t);
  }
});

ok("'No date yet' starts week 1 with the value case and launch criteria", () => {
  for (const res of [zero, mixed]) {
    const plan = S.buildReport(q, res, ctx({ timeline: "No date yet" })).plan_30_days;
    assert.equal(plan[0].week, 1);
    assert.match(plan[0].action, /^Agree the value case/);
    assert.match(plan[0].action, /launch criteria/);
    assert.ok(!plan.some((p) => p.dimension === "V"), "no duplicate V row");
  }
});

ok("regulated industries get the formal-review note, others don't", () => {
  for (const ind of ["Financial services", "Healthcare", "Public sector and education"]) {
    const notes = S.buildReport(q, mixed, ctx({ industry: ind })).notes;
    assert.ok(notes.some((n) => n.kind === "industry" && /formal security and privacy review/.test(n.text) && /evidence pack/.test(n.text)), ind);
  }
  for (const ind of ["Software and SaaS", "Retail and e-commerce", "Professional services", "Manufacturing and logistics", "Other"]) {
    assert.ok(!S.buildReport(q, mixed, ctx({ industry: ind })).notes.some((n) => n.kind === "industry"), ind);
  }
});

ok("not-on-AWS and not-sure get the any-platform note, AWS answers don't", () => {
  for (const pl of ["Not on AWS yet", "Not sure"]) {
    const notes = S.buildReport(q, mixed, ctx({ platform: pl })).notes;
    assert.ok(notes.some((n) => n.kind === "platform" && /any platform/.test(n.text) && /on AWS/.test(n.text)), pl);
  }
  for (const pl of ["Mostly on AWS", "Partly on AWS"]) {
    assert.ok(!S.buildReport(q, mixed, ctx({ platform: pl })).notes.some((n) => n.kind === "platform"), pl);
  }
});

ok("engagement mapping at 0/34/35/59/60/84/85/100", () => {
  const ids = (o) => S.engagementFor(q, o).id;
  const keys = (o) => S.engagementFor(q, o).offers.map((x) => x.key);
  assert.equal(ids(0), "sprint_then_build"); assert.equal(ids(34), "sprint_then_build");
  assert.deepEqual(keys(34), ["sprint", "build"]);
  assert.equal(ids(35), "sprint"); assert.equal(ids(59), "sprint");
  assert.deepEqual(keys(59), ["sprint"]);
  assert.equal(ids(60), "focused_sprint"); assert.equal(ids(84), "focused_sprint");
  assert.equal(ids(85), "operate"); assert.equal(ids(100), "operate");
  assert.deepEqual(keys(85), ["operate"]);
  for (const o of [0, 34, 35, 59, 60, 84, 85, 100]) {
    for (const x of S.engagementFor(q, o).offers) assert.equal(x.price, q.offers[x.key].price);
  }
  const focused = S.buildReport(q, { ...mixed, overall: 70 }, ctx()).engagement.text;
  assert.ok(!/[{}]/.test(focused) && focused.includes(S.dimension(q, mixed.weakest[0]).business_name));
});

ok("recommended offering link per use case", () => {
  const want = {
    "Customer service and support": "/launch/customer-service-agents.html",
    "Internal knowledge and employee help": "/launch/knowledge-assistants.html",
    "Document processing and back office": "/launch/document-processing.html",
    "AI features inside our product": "/launch/saas-ai-features.html",
    "Sales and marketing": "/launch/",
    "Other": "/launch/"
  };
  for (const [uc, href] of Object.entries(want)) assert.equal(S.buildReport(q, mixed, ctx({ use_case: uc })).offering.href, href, uc);
  assert.equal(S.buildReport(q, mixed, {}).offering.href, "/launch/");
});

ok("CTA goes to the contact page with the score", () => {
  const rep = S.buildReport(q, mixed, ctx());
  assert.equal(rep.cta.label, "Talk to us about these results");
  assert.equal(rep.cta.href, "/contact/?ref=assessment&score=42");
});

ok("lead payload carries labels, scores by name and an empty _gotcha", () => {
  const lead = { name: "Ana Example", email: "ana@example.com", company: "Example Co.", consent_privacy: true, consent_marketing: false };
  const body = S.leadPayload(q, zero, ctx({ timeline: "Within 30 days" }), lead, { blocker: "Security review.", elapsed_minutes: 4.5, page_url: "https://monovus.solutions/assessment/" });
  assert.equal(body._subject, "Assessment lead: Example Co. (0/100, Exposed)");
  assert.equal(body._gotcha, "");
  assert.equal(body.consent_marketing, false);
  assert.deepEqual(Object.keys(body.context), q.context_questions.map((c) => c.id));
  assert.equal(body.context.role, "COO or operations leader");
  assert.equal(body.context.timeline, "Within 30 days");
  assert.equal(Object.keys(body.dimension_scores).length, 8);
  assert.equal(body.dimension_scores["Predictable cost"], 0);
  assert.deepEqual(body.red_flags, zero.red_flags.map((id) => q.red_flag_text[id]));
  assert.equal(body.top_gaps.length, 3);
  assert.equal(body.blocker, "Security review.");
  assert.equal(body.elapsed_minutes, 4.5);
  assert.equal(body.page_url, "https://monovus.solutions/assessment/");
  const unsure = all(3); unsure.C2a = 4;
  assert.deepEqual(S.leadPayload(q, S.compute(q, unsure), {}, lead).unknown_dimensions, ["Every decision visible"]);
  const text = S.summaryText(q, zero, ctx(), lead, "Security review.");
  assert.match(text, /Score: 0\/100/);
  assert.match(text, /Red flags:/);
  assert.match(text, /What's stopping it: Security review\./);
});

ok("no personal name in questions.json or any assessment JS", () => {
  const who = new RegExp("Al" + "ex", "i");
  const dir = new URL("../", import.meta.url);
  const files = ["questions.json", ...readdirSync(dir).filter((f) => f.endsWith(".js"))];
  assert.ok(files.includes("assessment.js") && files.includes("scoring.js"));
  for (const f of files) assert.ok(!who.test(readFileSync(new URL(f, dir), "utf8")), f);
  assert.ok(!existsSync(new URL("config.js", dir)), "assessment/config.js removed");
});

ok("no personal name in any published file under static/", () => {
  // Names are split so this file can never match itself.
  const who = new RegExp("\\b(" + ["Al" + "ex", "Sh" + "aw", "Car" + "men", "tsu" + "icl"].join("|") + ")\\b", "i");
  const root = new URL("../../", import.meta.url);
  const text = /\.(html?|js|mjs|json|xml|txt|svg|css|md|webmanifest)$|^(CNAME|_headers|_redirects)$/;
  const hits = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
      if (e.isDirectory()) walk(p);
      else if (text.test(e.name) && who.test(readFileSync(p, "utf8"))) hits.push(p.pathname.split("/static/")[1]);
    }
  };
  walk(root);
  assert.deepEqual(hits, [], "personal name in: " + hits.join(", "));
});

console.log(`\n${n} passed`);
