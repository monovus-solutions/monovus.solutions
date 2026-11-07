/* Monovus AI Agent Readiness Assessment: scoring and the rules-based report.
   Exact integer arithmetic, per questions.json "scoring"; report wording from
   questions.json "personalisation". Runs entirely in the browser, no backend.
   tests/scoring.test.mjs checks it against the fixtures. Works as a classic browser
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

  /* ---------- personalised report, built by rules ----------
     All wording lives in questions.json "personalisation"; this file only picks and fills it.
     ctx: {contextQuestionId: zero-based option index}. Missing answers fall back to neutral
     defaults (leadership framing, "before launch", standard four-week plan, no notes). */

  function fill(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function contextLabel(q, ctx, id) {
    var cq = null;
    for (var i = 0; i < q.context_questions.length; i++) if (q.context_questions[i].id === id) cq = q.context_questions[i];
    var v = ctx ? ctx[id] : undefined;
    return cq && Number.isInteger(v) && cq.options[v] !== undefined ? cq.options[v] : "";
  }

  function contextLabels(q, ctx) {
    var out = {};
    q.context_questions.forEach(function (cq) { out[cq.id] = contextLabel(q, ctx, cq.id); });
    return out;
  }

  function roleFrame(q, ctx) {
    return q.personalisation.role.technical.indexOf(contextLabel(q, ctx, "role")) !== -1 ? "technical" : "leadership";
  }

  function stageGroup(q, ctx) {
    var groups = q.personalisation.stage, label = contextLabel(q, ctx, "stage");
    var ids = Object.keys(groups);
    for (var i = 0; i < ids.length; i++) {
      if (groups[ids[i]].options.indexOf(label) !== -1) return Object.assign({ id: ids[i] }, groups[ids[i]]);
    }
    return Object.assign({ id: "before_launch" }, groups.before_launch);
  }

  function timelineFor(q, ctx) {
    return q.personalisation.timeline[contextLabel(q, ctx, "timeline")] || { mode: "standard", intro: "" };
  }

  function gapList(q, ids) {
    var names = ids.map(function (id) { return "\u201c" + dimension(q, id).business_name + "\u201d"; });
    if (names.length < 2) return names.join("");
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  }

  function questionDimension(q, qid) {
    for (var i = 0; i < q.dimensions.length; i++) {
      for (var j = 0; j < q.dimensions[i].questions.length; j++) {
        if (q.dimensions[i].questions[j].id === qid) return q.dimensions[i];
      }
    }
    return null;
  }

  function engagementFor(q, overall) {
    var bands = q.personalisation.engagement, band = bands[0];
    for (var i = 0; i < bands.length; i++) if (overall >= bands[i].min && overall <= bands[i].max) band = bands[i];
    return { id: band.id, text: band.text,
             offers: band.offers.map(function (k) {
               var o = q.offers[k];
               return { key: k, name: o.name, price: o.price, what: o.what };
             }) };
  }

  function offeringFor(q, ctx) {
    var all = q.personalisation.offerings;
    var o = all[contextLabel(q, ctx, "use_case")] || all.Other;
    return { name: o.name, href: o.href, text: o.text };
  }

  function executiveSummary(q, result, ctx) {
    var P = q.personalisation, sg = stageGroup(q, ctx);
    var vars = { overall: result.overall, stage_id: result.stage.id, stage_name: result.stage.name,
                 stage_summary: result.stage.summary, phase: sg.phase, Phase: cap(sg.phase),
                 gaps: gapList(q, result.weakest) };
    return fill(P.summary.score, vars) + " " + fill(P.summary[roleFrame(q, ctx)], vars);
  }

  function buildPlan(q, result, ctx) {
    var P = q.personalisation, sg = stageGroup(q, ctx), mode = timelineFor(q, ctx).mode;
    var vars = { criteria: sg.criteria, decision: sg.decision };
    var owner = function (id) { return P.owners[id] || "Engineering lead"; };
    var flags = result.red_flags.map(function (qid) {
      return { week: 1, action: P.red_flag_fix[qid], owner_role: owner(questionDimension(q, qid).id), red_flag: qid };
    });
    var startDef = mode === "no_date" ? P.plan.start_no_date : P.plan.start;
    var start = [{ week: 1, action: fill(startDef.action, vars), owner_role: startDef.owner_role }];
    var gaps = result.weakest.slice();
    if (gaps.indexOf("V") !== -1) {
      /* V's own first step names an owner and a target. With no date, the value-case row
         already covers it, so drop the duplicate gap row; otherwise drop the start row. */
      if (mode === "no_date") gaps = gaps.filter(function (id) { return id !== "V"; });
      else start = [];
    }
    var gapRows = gaps.map(function (id, i) {
      var week = mode === "compressed" ? (i === 0 ? 1 : 2) : mode === "no_date" ? Math.min(i + 2, 3) : Math.min(i + 1, 3);
      return { week: week, action: dimension(q, id).if_weak.first_step, owner_role: owner(id), dimension: id };
    });
    var review = [{ week: mode === "compressed" ? 2 : 4, action: fill(P.plan.review.action, vars),
                    owner_role: P.plan.review.owner_role }];
    if (mode === "compressed") return flags.concat(start, gapRows, review);
    return start.concat(flags, gapRows, review);
  }

  function buildReport(q, result, ctx) {
    ctx = ctx || {};
    var P = q.personalisation, sg = stageGroup(q, ctx), tl = timelineFor(q, ctx);
    var lens = P.lens[contextLabel(q, ctx, "use_case")] || P.lens.Other;
    var notes = [];
    var ind = P.industry_notes[contextLabel(q, ctx, "industry")];
    if (ind) notes.push({ kind: "industry", text: ind });
    var plat = P.platform_notes[contextLabel(q, ctx, "platform")];
    if (plat) notes.push({ kind: "platform", text: plat });
    var eng = engagementFor(q, result.overall);
    eng.text = fill(eng.text, { gaps: gapList(q, result.weakest) });
    return {
      frame: roleFrame(q, ctx),
      stage_group: sg.id,
      executive_summary: executiveSummary(q, result, ctx),
      notes: notes,
      fix_first: result.red_flags.length ? {
        title: sg.flags_title, intro: sg.flags_intro, urgent: !!sg.urgent,
        items: result.red_flags.map(function (id) { return { id: id, text: q.red_flag_text[id], fix: P.red_flag_fix[id] }; })
      } : null,
      top_risks: result.weakest.map(function (id) {
        var d = dimension(q, id);
        return { dimension: d.id, title: d.business_name, business_impact: d.if_weak.business_risk,
                 lens: lens[d.id], first_step: d.if_weak.first_step, aws_services: d.if_weak.aws_services.slice() };
      }),
      plan_intro: tl.intro || "",
      plan_30_days: buildPlan(q, result, ctx),
      engagement: eng,
      offering: offeringFor(q, ctx),
      closing: P.closing,
      cta: { label: P.cta.label, href: fill(P.cta.href, { overall: result.overall }) }
    };
  }

  /* Kept for callers and tests written against v2: same report, no context. */
  function fallbackReport(q, result) { return buildReport(q, result, {}); }

  /* JSON body for the optional form endpoint (Formspree-style: _subject, _gotcha). */
  function leadPayload(q, result, ctx, lead, extra) {
    lead = lead || {}; extra = extra || {};
    var scores = {};
    q.dimensions.forEach(function (d) { scores[d.business_name] = result.dimensions[d.id]; });
    var name = function (id) { return dimension(q, id).business_name; };
    return {
      _subject: "Assessment lead: " + (lead.company || "") + " (" + result.overall + "/100, " + result.stage.name + ")",
      name: lead.name || "", email: lead.email || "", company: lead.company || "",
      consent_privacy: !!lead.consent_privacy, consent_marketing: !!lead.consent_marketing,
      context: contextLabels(q, ctx || {}),
      overall: result.overall, stage: result.stage.name,
      dimension_scores: scores,
      red_flags: result.red_flags.map(function (id) { return q.red_flag_text[id]; }),
      top_gaps: result.weakest.map(name),
      unknown_dimensions: result.unknowns.map(name),
      blocker: String(extra.blocker || "").slice(0, q.free_text.max_chars),
      elapsed_minutes: typeof extra.elapsed_minutes === "number" ? extra.elapsed_minutes : null,
      page_url: extra.page_url || "",
      _gotcha: extra.gotcha || ""
    };
  }

  /* Plain-text summary for the mailto fallback. */
  function summaryText(q, result, ctx, lead, blocker) {
    lead = lead || {};
    var L = ["AI Agent Readiness Assessment"];
    if (lead.company) L.push("Company: " + lead.company);
    if (lead.name) L.push("Name: " + lead.name);
    L.push("Score: " + result.overall + "/100, stage " + result.stage.id + " of 4 (" + result.stage.name + ")", "", "Dimension scores:");
    q.dimensions.forEach(function (d) { L.push("- " + d.business_name + ": " + result.dimensions[d.id]); });
    if (result.red_flags.length) {
      L.push("", "Red flags:");
      result.red_flags.forEach(function (id) { L.push("- " + q.red_flag_text[id]); });
    }
    L.push("", "Biggest gaps: " + result.weakest.map(function (id) { return dimension(q, id).business_name; }).join("; "));
    if (result.unknowns.length) L.push("Not sure: " + result.unknowns.map(function (id) { return dimension(q, id).business_name; }).join("; "));
    var c = contextLabels(q, ctx || {});
    var about = q.context_questions.map(function (cq) { return c[cq.id]; }).filter(Boolean);
    if (about.length) L.push("About the agent: " + about.join("; "));
    if (blocker) L.push("", "What's stopping it: " + String(blocker).slice(0, q.free_text.max_chars));
    return L.join("\n");
  }

  var api = { dimScore: dimScore, overallScore: overallScore, stageFor: stageFor, compute: compute,
              isComplete: isComplete, questionIds: questionIds, dimension: dimension,
              fill: fill, contextLabel: contextLabel, contextLabels: contextLabels, roleFrame: roleFrame,
              stageGroup: stageGroup, timelineFor: timelineFor, engagementFor: engagementFor,
              offeringFor: offeringFor, executiveSummary: executiveSummary, buildPlan: buildPlan,
              buildReport: buildReport, fallbackReport: fallbackReport, leadPayload: leadPayload,
              summaryText: summaryText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MonovusScoring = api;
})(typeof window !== "undefined" ? window : this);
