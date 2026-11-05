/* Monovus AI Agent Readiness Assessment: scoring.
   Exact integer arithmetic, per questions.json "scoring". Mirrors the backend scorer;
   tests/scoring.test.mjs checks both against the fixtures. Works as a classic browser
   script (window.MonovusScoring) and as a CommonJS module for Node tests. */
(function (root) {
  "use strict";

  function dimScore(p) { return Math.floor((200 * p + 6) / 12); }
  function overallScore(t) { return Math.floor((200 * t + 48) / 96); }

  function stageFor(q, overall) {
    var s = q.scoring.stages;
    for (var i = 0; i < s.length; i++) {
      if (overall >= s[i].min && overall <= s[i].max) return s[i];
    }
    return s[0];
  }

  function questionIds(q) {
    var ids = [];
    q.dimensions.forEach(function (d) { d.questions.forEach(function (x) { ids.push(x.id); }); });
    return ids;
  }

  function isComplete(q, answers) {
    return questionIds(q).every(function (id) { return Number.isInteger(answers[id]); });
  }

  /* answers: {questionId: zero-based option index} */
  function compute(q, answers) {
    var dims = {}, redFlags = [], unknowns = [], total = 0;
    q.dimensions.forEach(function (d) {
      var p = 0, unknown = false;
      d.questions.forEach(function (x) {
        var opt = x.options[answers[x.id]];
        if (!opt) throw new Error("missing or invalid answer for " + x.id);
        p += opt[1];
        if (opt[2] === "unknown") unknown = true;
        if (opt[2] === "red_flag") redFlags.push(x.id);
      });
      total += p;
      dims[d.id] = dimScore(p);
      if (unknown) unknowns.push(d.id);
    });
    var overall = overallScore(total);
    var order = q.dimensions.map(function (d) { return d.id; });
    var weakest = order.slice().sort(function (a, b) {
      return (dims[a] - dims[b]) || (order.indexOf(a) - order.indexOf(b));
    }).slice(0, 3);
    return { dimensions: dims, overall: overall, stage: stageFor(q, overall),
             red_flags: redFlags, unknowns: unknowns, weakest: weakest, total: total };
  }

  function dimension(q, id) {
    for (var i = 0; i < q.dimensions.length; i++) if (q.dimensions[i].id === id) return q.dimensions[i];
    return null;
  }

  /* Deterministic report in the same shape the API returns. */
  function fallbackReport(q, result) {
    var w = result.weakest.map(function (id) { return dimension(q, id); });
    var names = w.map(function (d) { return "\u201c" + d.business_name + "\u201d"; });
    var summary = "Your agent scores " + result.overall + " out of 100, which puts it at the " +
      result.stage.name + " stage. " + result.stage.summary + " The three biggest gaps are " +
      names[0] + ", " + names[1] + " and " + names[2] +
      ". Closing those first is the fastest route to a launch the business can trust.";
    var owners = { V: "Business owner", C1: "Engineering lead", C2: "Engineering lead",
                   C3: "Finance and engineering", C4: "Security and engineering",
                   C5: "Security lead", C6: "Engineering lead", C7: "Operations lead" };
    var plan = [{ week: 1, action: "Name one accountable owner for the agent and agree the launch criteria: the quality, cost and risk levels it must meet.", owner_role: "Business owner" }];
    w.forEach(function (d, i) {
      plan.push({ week: Math.min(i + 1, 3), action: d.if_weak.first_step, owner_role: owners[d.id] || "Engineering lead" });
    });
    plan.push({ week: 4, action: "Re-run this assessment, compare the scores, and decide go or no-go against the launch criteria.", owner_role: "Business owner" });
    if (result.weakest.indexOf("V") !== -1) plan.shift();
    return {
      executive_summary: summary,
      top_risks: w.map(function (d) {
        return { dimension: d.id, title: d.business_name, business_impact: d.if_weak.business_risk,
                 first_step: d.if_weak.first_step, aws_services: d.if_weak.aws_services.slice() };
      }),
      plan_30_days: plan,
      closing: "If you want a second opinion on this plan, book a free 45-minute Readiness Review with Alex Shaw. We'll walk through your results and agree the first fixes with you."
    };
  }

  var api = { dimScore: dimScore, overallScore: overallScore, stageFor: stageFor, compute: compute,
              isComplete: isComplete, questionIds: questionIds, dimension: dimension,
              fallbackReport: fallbackReport };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MonovusScoring = api;
})(typeof window !== "undefined" ? window : this);
