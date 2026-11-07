/* Monovus AI Agent Readiness Assessment: UI.
   Steps: 0 intro · 1 context · 2-9 one dimension each · 10 blocker · 11 results (+ report).
   Debug for screenshots: ?step=N jumps to a step with the 'mixed' fixture pre-filled.
   ?sample=1 renders the sample results and report. No backend: the report is built in the
   browser by scoring.js. The only network call is the optional lead POST to
   window.MONOVUS_FORM_ENDPOINT (from /assets/config.js). All untrusted text (the visitor's
   own input) and generated text is inserted with textContent, never innerHTML. */
(function () {
  "use strict";
  var S = window.MonovusScoring;
  var ENDPOINT = String(window.MONOVUS_FORM_ENDPOINT || "").trim();
  var KEY = "monovus-assessment-2026-11";
  var MAIL = String(window.MONOVUS_EMAIL || "hello@monovus.solutions").trim();
  var app = document.getElementById("app");
  var params = new URLSearchParams(location.search);
  var Q, state, leadNote = null;

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") el.textContent = v;
      else if (k === "on") Object.keys(v).forEach(function (e) { el.addEventListener(e, v[e]); });
      else if (k === "class") el.className = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, kids) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { el.appendChild(c); });
    return el;
  }

  /* ---------- state ---------- */
  function fresh() {
    return { step: 0, context: {}, answers: {}, blocker: "", startedAt: null, lead: null, report: null };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v.step === "number") return v; } catch (e) {}
    return fresh();
  }
  function fixtureState() {
    var st = fresh();
    st.answers = Object.assign({}, Q.scoring.fixtures[2].answers);
    st.context = { role: 1, size: 2, industry: 0, use_case: 0, stage: 2, platform: 0, timeline: 1 };
    st.startedAt = Date.now() - 240000;
    return st;
  }

  var LAST_Q = 10, RESULTS = 11;
  function go(step) {
    state.step = step;
    save();
    render();
    var focusTarget = app.querySelector("h1, h2");
    if (focusTarget) { focusTarget.setAttribute("tabindex", "-1"); focusTarget.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- screens ---------- */
  function progress(step) {
    var pct = Math.round((step / LAST_Q) * 100);
    return h("div", { class: "as-progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100",
                      "aria-valuenow": String(pct), "aria-label": "Assessment progress" }, [
      h("div", { class: "as-progress-bar", style: "width:" + pct + "%" }),
      h("span", { class: "as-progress-label", text: "Step " + step + " of " + LAST_Q })
    ]);
  }

  function radioGroup(name, label, options, current, onPick, hint) {
    var fs = h("fieldset", { class: "as-q" }, [h("legend", { text: label }), hint ? h("p", { class: "as-hint", text: hint }) : null]);
    var list = h("div", { class: "as-options" });
    options.forEach(function (opt, i) {
      var text = Array.isArray(opt) ? opt[0] : opt;
      var id = name + "-" + i;
      var input = h("input", { type: "radio", name: name, id: id, value: String(i), checked: current === i,
                               on: { change: function () { onPick(i); } } });
      list.appendChild(h("label", { class: "as-option" + (Array.isArray(opt) && opt[2] === "unknown" ? " as-option-unsure" : ""), for: id },
        [input, h("span", { text: text })]));
    });
    fs.appendChild(list);
    return fs;
  }

  function nav(step, canNext, nextLabel) {
    var back = step > 1 ? h("button", { type: "button", class: "as-btn-quiet", text: "Back",
                                         on: { click: function () { go(step - 1); } } }) : h("span");
    var next = h("button", { type: "button", class: "btn btn-primary as-next", text: nextLabel || "Continue",
                             disabled: !canNext, on: { click: function () { go(step + 1); } } });
    return h("div", { class: "as-nav" }, [back, next]);
  }

  function screenIntro() {
    var resume = state.startedAt && state.step > 0;
    return h("section", { class: "as-intro" }, [
      h("p", { class: "eyebrow", text: "Free · about 5 minutes · no email needed for your score" }),
      h("h1", {}, ["How ready is your AI agent for ", h("em", { text: "production" }), "?"]),
      h("p", { class: "lead", text: "Gartner expects over 40% of agentic AI projects to be cancelled by the end of 2027, for three reasons: escalating costs, unclear business value and weak risk controls. This assessment scores your agent on all three, across the eight dimensions of the Monovus Production Readiness Framework." }),
      h("div", { class: "as-intro-grid" }, [
        h("div", { class: "as-card" }, [
          h("h2", { class: "as-h3", text: "On screen, straight away" }),
          h("ul", { class: "as-ticks" }, [
            h("li", { text: "A readiness score out of 100 and your stage" }),
            h("li", { text: "Scores for all eight dimensions" }),
            h("li", { text: "Red flags that need attention before launch" }),
            h("li", { text: "Your three biggest gaps, in business terms" })
          ])
        ]),
        h("div", { class: "as-card" }, [
          h("h2", { class: "as-h3", text: "In the full report" }),
          h("ul", { class: "as-ticks" }, [
            h("li", { text: "A summary written for your role and your agent's stage" }),
            h("li", { text: "A week-by-week 30-day plan" }),
            h("li", { text: "The AWS services that close each gap" }),
            h("li", { text: "A PDF you can share internally" })
          ])
        ])
      ]),
      h("div", { class: "as-actions" }, [
        h("button", { type: "button", class: "btn btn-primary", text: resume ? "Continue where you left off" : "Start the assessment",
                      on: { click: function () { if (!state.startedAt) state.startedAt = Date.now(); go(resume ? state.step : 1); } } }),
        resume ? h("button", { type: "button", class: "as-btn-quiet", text: "Start over", on: { click: reset } }) : null,
        h("a", { class: "quiet", href: "?sample=1", text: "See a sample report" })
      ]),
      h("p", { class: "as-fine" }, [ENDPOINT
        ? "Your answers stay in your browser until you ask for the full report. Then they're sent to Monovus with your details. "
        : "Your answers stay in your browser. Nothing is sent to Monovus unless you choose to email it. ",
        h("a", { class: "quiet", href: "/pages/privacy.html", text: "Privacy" }), ". " + Q.disclaimer])
    ]);
  }

  function screenContext() {
    var fs = Q.context_questions.map(function (cq) {
      return radioGroup("ctx-" + cq.id, cq.label, cq.options, state.context[cq.id], function (i) {
        state.context[cq.id] = i; save(); refreshNext();
      });
    });
    var done = Q.context_questions.every(function (cq) { return Number.isInteger(state.context[cq.id]); });
    return h("section", { class: "as-step" }, [progress(1),
      h("p", { class: "eyebrow", text: "Context" }),
      h("h1", { class: "as-h1", text: "About you and the agent" }),
      h("p", { class: "lead", text: "Seven quick questions so the results speak to your situation. These aren't scored." }),
      h("div", { class: "as-qs as-qs-two" }, fs), nav(1, done)]);
  }

  function screenDimension(step) {
    var d = Q.dimensions[step - 2];
    var fs = d.questions.map(function (qq) {
      return radioGroup("q-" + qq.id, qq.label, qq.options, state.answers[qq.id], function (i) {
        state.answers[qq.id] = i; save(); refreshNext();
      });
    });
    var done = d.questions.every(function (qq) { return Number.isInteger(state.answers[qq.id]); });
    var reason = { "unclear business value": "Cancellation risk: unclear value", "escalating costs": "Cancellation risk: rising cost",
                   "inadequate risk controls": "Cancellation risk: weak controls" }[d.gartner_reason];
    return h("section", { class: "as-step" }, [progress(step),
      h("p", { class: "eyebrow", text: "Dimension " + (step - 1) + " of 8 · " + reason }),
      h("h1", { class: "as-h1", text: d.business_name }),
      h("p", { class: "as-tech", text: d.name }),
      h("div", { class: "as-qs" }, fs),
      h("p", { class: "as-fine", text: "Choose \u201cNot sure\u201d if you don't know. Not knowing is a finding too." }),
      nav(step, done, step === 9 ? "Last step" : "Continue")]);
  }

  function screenBlocker() {
    var ta = h("textarea", { id: "blocker", maxlength: String(Q.free_text.max_chars), rows: "4",
                             on: { input: function (e) { state.blocker = e.target.value.slice(0, Q.free_text.max_chars); save(); count.textContent = state.blocker.length + " / " + Q.free_text.max_chars; } } });
    ta.value = state.blocker || "";
    var count = h("span", { class: "as-count", text: (state.blocker || "").length + " / " + Q.free_text.max_chars });
    return h("section", { class: "as-step" }, [progress(10),
      h("p", { class: "eyebrow", text: "Optional" }),
      h("h1", { class: "as-h1", text: "Anything else we should know?" }),
      h("div", { class: "as-q" }, [h("label", { for: "blocker", class: "as-label", text: Q.free_text.label }), ta, count]),
      h("div", { class: "as-nav" }, [
        h("button", { type: "button", class: "as-btn-quiet", text: "Back", on: { click: function () { go(9); } } }),
        h("button", { type: "button", class: "btn btn-primary", text: "See my results", on: { click: function () { go(RESULTS); } } })
      ])]);
  }

  function dial(score) {
    var r = 54, c = 2 * Math.PI * r, off = c * (1 - score / 100);
    return s("svg", { viewBox: "0 0 140 140", class: "as-dial", role: "img", "aria-label": "Readiness score " + score + " out of 100" }, [
      s("circle", { cx: "70", cy: "70", r: String(r), fill: "none", stroke: "var(--line)", "stroke-width": "10" }),
      s("circle", { cx: "70", cy: "70", r: String(r), fill: "none", stroke: "var(--matcha)", "stroke-width": "10",
                    "stroke-dasharray": c.toFixed(2), "stroke-dashoffset": off.toFixed(2), "stroke-linecap": "butt",
                    transform: "rotate(-90 70 70)" }),
      s("text", { x: "70", y: "76", "text-anchor": "middle", class: "as-dial-n", text: String(score) }),
      s("text", { x: "70", y: "96", "text-anchor": "middle", class: "as-dial-of", text: "of 100" })
    ]);
  }

  function bars(result) {
    var list = h("ol", { class: "as-bars" });
    Q.dimensions.forEach(function (d) {
      var v = result.dimensions[d.id], weak = result.weakest.indexOf(d.id) !== -1;
      list.appendChild(h("li", { class: "as-bar" + (weak ? " as-bar-weak" : "") }, [
        h("span", { class: "as-bar-name" }, [d.business_name, weak ? h("span", { class: "as-tag", text: "Priority" }) : null]),
        h("span", { class: "as-bar-track", "aria-hidden": "true" }, [h("span", { class: "as-bar-fill", style: "width:" + v + "%" })]),
        h("span", { class: "as-bar-v", text: String(v) })
      ]));
    });
    return list;
  }

  function screenResults() {
    if (!S.isComplete(Q, state.answers)) { go(1); return h("div"); }
    var r = S.compute(Q, state.answers);
    var sample = params.get("sample") === "1";
    var kids = [
      sample ? h("p", { class: "as-sample", text: "Sample report · example answers, not a real company" }) : null,
      h("p", { class: "eyebrow", text: "Your results" }),
      h("div", { class: "as-hero" }, [
        dial(r.overall),
        h("div", {}, [
          h("p", { class: "as-stage-k", text: "Stage " + r.stage.id + " of 4" }),
          h("h1", { class: "as-h1", text: r.stage.name }),
          h("p", { class: "lead", text: r.stage.summary })
        ])
      ]),
      h("h2", { class: "as-h2", text: "The eight dimensions" }),
      bars(r)
    ];
    if (r.red_flags.length) {
      var sg = S.stageGroup(Q, state.context);
      kids.push(h("div", { class: "as-flags", role: "note" }, [
        h("h2", { class: "as-h3" }, [sg.flags_title, sg.urgent ? h("span", { class: "as-tag as-tag-inv", text: "Urgent" }) : null]),
        h("ul", {}, r.red_flags.map(function (id) { return h("li", { text: Q.red_flag_text[id] }); }))
      ]));
    }
    if (r.unknowns.length) {
      var names = r.unknowns.map(function (id) { return S.dimension(Q, id).business_name.toLowerCase(); });
      kids.push(h("p", { class: "as-unknown", text: "You chose \u201cNot sure\u201d in " + names.join(", ") + ". Not knowing is itself a finding: if nobody can answer, nobody is checking." }));
    }
    kids.push(h("h2", { class: "as-h2", text: "Your three biggest gaps" }));
    kids.push(h("div", { class: "as-gaps" }, r.weakest.map(function (id, i) {
      var d = S.dimension(Q, id);
      return h("article", { class: "as-card as-gap" }, [
        h("p", { class: "as-gap-n", text: String(i + 1) }),
        h("h3", { class: "as-h3", text: d.business_name }),
        h("p", { class: "as-gap-score", text: "Score " + r.dimensions[id] + " of 100" }),
        h("p", { text: d.if_weak.business_risk }),
        h("p", { class: "as-first" }, [h("strong", { text: "First step: " }), d.if_weak.first_step])
      ]);
    })));
    kids.push(state.report ? reportView(r) : gate(r));
    kids.push(h("p", { class: "as-actions as-restart" }, [h("button", { type: "button", class: "as-btn-quiet", text: "Start over", on: { click: reset } })]));
    return h("section", { class: "as-results", "aria-live": "polite" }, kids);
  }

  function field(id, label, type, auto, value) {
    return h("div", { class: "as-field" }, [h("label", { for: id, text: label }),
      h("input", { id: id, name: id, type: type, autocomplete: auto, required: true, maxlength: "120", value: value || "" })]);
  }

  function gate(r) {
    var lead = state.lead || {};
    var status = h("p", { class: "as-status", role: "status" });
    var form = h("form", { class: "as-gate", novalidate: true }, [
      h("p", { class: "eyebrow", text: "Free · shown straight away on this page" }),
      h("h2", { class: "as-h2", text: "Get your full report and 30-day plan" }),
      h("p", { text: "A summary written for your role, your top risks for this kind of agent, a week-by-week plan, the AWS services that close each gap, and the engagement we'd recommend. Ready to save as a PDF." }),
      h("div", { class: "as-fields" }, [
        field("name", "Name", "text", "name", lead.name),
        field("email", "Work email", "email", "email", lead.email),
        field("company", "Company", "text", "organization", lead.company)
      ]),
      h("div", { class: "as-hp", "aria-hidden": "true" }, [h("label", { for: "_gotcha", text: "Leave this empty" }),
        h("input", { id: "_gotcha", name: "_gotcha", type: "text", tabindex: "-1", autocomplete: "off" })]),
      h("label", { class: "as-check" }, [h("input", { type: "checkbox", id: "consent_privacy", required: true }),
        h("span", {}, ["I agree to the ", h("a", { class: "quiet", href: "/pages/privacy.html", target: "_blank", rel: "noopener", text: "privacy policy" }),
          ". Monovus will use my details and these results to reply to me about this assessment."])]),
      h("label", { class: "as-check" }, [h("input", { type: "checkbox", id: "consent_marketing" }),
        h("span", { text: "Optional: send me occasional insights on running AI agents in production. Unsubscribe any time." })]),
      h("button", { type: "submit", class: "btn btn-primary", text: "Show my report" }),
      status,
      h("p", { class: "as-fine", text: ENDPOINT
        ? "When you press the button, your details, answers and scores are sent to Monovus so we can reply. Your report appears straight away."
        : "Nothing is sent when you press the button: the report is built here, in your browser." })
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) { return (form.querySelector("#" + id).value || "").trim(); };
      var leadNow = { name: v("name"), email: v("email"), company: v("company"),
                      consent_privacy: form.querySelector("#consent_privacy").checked,
                      consent_marketing: form.querySelector("#consent_marketing").checked };
      if (!leadNow.name || !leadNow.company) { status.textContent = "Please add your name and company."; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(leadNow.email)) { status.textContent = "Please enter a valid work email."; return; }
      if (!leadNow.consent_privacy) { status.textContent = "Please agree to the privacy policy to see your report."; return; }
      var honeypot = v("_gotcha");
      state.lead = leadNow; state.report = true; save();
      leadNote = ENDPOINT ? "sending" : "local";
      render();
      var top = document.getElementById("report");
      if (top) { top.setAttribute("tabindex", "-1"); top.focus({ preventScroll: true }); top.scrollIntoView({ behavior: "smooth" }); }
      if (ENDPOINT) sendLead(r, honeypot);
    });
    return form;
  }

  /* Fire-and-forget: the report is already on screen, so this never blocks it. */
  function sendLead(r, honeypot) {
    var started = state.startedAt || Date.now();
    var body = S.leadPayload(Q, r, state.context, state.lead, {
      blocker: state.blocker || "", gotcha: honeypot || "",
      elapsed_minutes: Math.round((Date.now() - started) / 6000) / 10,
      page_url: location.href.split("#")[0]
    });
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
                      body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (res) { clearTimeout(timer); if (!res.ok) throw new Error("http " + res.status); setLeadNote("sent"); })
      .catch(function () { clearTimeout(timer); setLeadNote("failed"); });
  }

  function mailtoHref(r) {
    var lead = state.lead || {};
    var subject = "Readiness assessment: " + (lead.company || "my results") + " (" + r.overall + "/100)";
    var body = S.summaryText(Q, r, state.context, lead, state.blocker).replace(/\n/g, "\r\n");
    return "mailto:" + MAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function leadNoteKids(kind, r) {
    if (kind === "sending") return ["Sending your details to Monovus\u2026"];
    if (kind === "sent") return ["Sent. We have your results and will reply to " + ((state.lead || {}).email || "you") + "."];
    if (kind === "failed") return ["We couldn't send your details just now. Your report is below, and you can ",
      h("a", { class: "quiet", href: mailtoHref(r), text: "email us a summary" }), " instead."];
    if (kind === "local") return ["Nothing has been sent: this report was built in your browser."];
    return [];
  }

  function setLeadNote(kind) {
    leadNote = kind;
    var el = document.getElementById("as-lead-status");
    if (el && state.report && S.isComplete(Q, state.answers)) el.replaceChildren.apply(el, leadNoteKids(kind, S.compute(Q, state.answers)));
  }

  function reportView(r) {
    var body = S.buildReport(Q, r, state.context);
    var sample = params.get("sample") === "1";
    var lead = state.lead || {};
    var kids = [
      h("header", { class: "as-report-head" }, [
        h("p", { class: "eyebrow", text: sample ? "Sample report" : "Readiness report" + (lead.company ? " · " + lead.company : "") }),
        h("h2", { class: "as-h2", text: "AI Agent Readiness Report" }),
        h("p", { class: "as-meta", text: "Score " + r.overall + "/100 · Stage " + r.stage.id + " of 4, " + r.stage.name + " · " +
          new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) })
      ]),
      sample ? null : h("p", { id: "as-lead-status", class: "as-lead-status as-noprint", role: "status" }, leadNoteKids(leadNote, r)),
      h("h3", { class: "as-h3", text: "Executive summary" }),
      h("p", { class: "lead", text: body.executive_summary }),
      body.notes.length ? h("ul", { class: "as-notes" }, body.notes.map(function (n) { return h("li", { text: n.text }); })) : null
    ];
    if (body.fix_first) {
      kids.push(h("section", { class: "as-fix" + (body.fix_first.urgent ? " as-fix-urgent" : "") }, [
        h("h3", { class: "as-h3" }, [body.fix_first.title, body.fix_first.urgent ? h("span", { class: "as-tag", text: "Urgent" }) : null]),
        h("p", { class: "as-fix-intro", text: body.fix_first.intro }),
        h("ul", { class: "as-fix-list" }, body.fix_first.items.map(function (f) {
          return h("li", {}, [h("strong", { text: f.text }), h("p", {}, [h("span", { class: "as-k", text: "Fix. " }), f.fix])]);
        }))
      ]));
    }
    kids.push(
      h("h3", { class: "as-h3", text: "Top risks" }),
      h("ol", { class: "as-risks" }, body.top_risks.map(function (t) {
        return h("li", {}, [h("strong", { text: t.title }), h("p", { text: t.business_impact }),
          t.lens ? h("p", { class: "as-lens" }, [h("span", { class: "as-k", text: "For your agent. " }), t.lens]) : null,
          h("p", {}, [h("span", { class: "as-k", text: "First step. " }), t.first_step]),
          t.aws_services && t.aws_services.length ? h("p", { class: "as-svc", text: "On AWS: " + t.aws_services.join(" · ") }) : null]);
      })),
      h("h3", { class: "as-h3", text: "Your 30-day plan" }),
      body.plan_intro ? h("p", { class: "as-plan-intro", text: body.plan_intro }) : null,
      h("table", { class: "as-plan" }, [
        h("thead", {}, [h("tr", {}, [h("th", { scope: "col", text: "Week" }), h("th", { scope: "col", text: "Action" }), h("th", { scope: "col", text: "Owner" })])]),
        h("tbody", {}, body.plan_30_days.map(function (p) {
          return h("tr", { class: p.red_flag ? "as-plan-flag" : null }, [h("td", { class: "as-wk", text: String(p.week) }),
            h("td", { class: "as-act" }, [p.red_flag ? h("span", { class: "as-tag", text: "Red flag" }) : null, p.action]),
            h("td", { class: "as-own", text: p.owner_role })]);
        }))
      ]),
      h("div", { class: "as-reco" }, [
        h("section", { class: "as-card" }, [
          h("p", { class: "eyebrow", text: "Recommended engagement" }),
          h("h3", { class: "as-h3", text: body.engagement.offers.map(function (o) { return o.name; }).join(", then ") }),
          body.engagement.offers.length > 1
            ? h("ul", { class: "as-prices" }, body.engagement.offers.map(function (o) {
                return h("li", {}, [h("span", { text: o.name }), h("span", { class: "as-price", text: o.price })]);
              }))
            : h("p", { class: "as-price", text: body.engagement.offers[0].price }),
          h("p", { text: body.engagement.text }),
          h("p", {}, [h("a", { class: "quiet", href: "/#monovus", text: "How Launch and Control work" })])
        ]),
        h("section", { class: "as-card" }, [
          h("p", { class: "eyebrow", text: "Recommended offering" }),
          h("h3", { class: "as-h3", text: body.offering.name }),
          h("p", { text: body.offering.text }),
          h("p", {}, [h("a", { class: "quiet", href: body.offering.href, text: "See " + body.offering.name })])
        ])
      ]),
      h("p", { class: "as-closing", text: body.closing }),
      h("div", { class: "as-actions as-noprint" }, [
        h("a", { class: "btn btn-primary", href: body.cta.href, text: body.cta.label }),
        h("button", { type: "button", class: "as-btn-quiet", text: "Download as PDF", on: { click: function () { window.print(); } } }),
        !ENDPOINT && !sample ? h("a", { class: "as-btn-quiet as-mail", href: mailtoHref(r), text: "Email me a copy" }) : null
      ]),
      !ENDPOINT && !sample ? h("p", { class: "as-fine as-noprint", text: "\u201cEmail me a copy\u201d opens your own email app with a summary of these results addressed to Monovus. Nothing is sent until you press send." }) : null,
      h("p", { class: "as-fine", text: Q.disclaimer })
    );
    return h("article", { id: "report", class: "as-report" }, kids);
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    state = fresh(); leadNote = null;
    if (params.has("sample") || params.has("step")) { history.replaceState(null, "", location.pathname); params = new URLSearchParams(); }
    go(0);
  }

  function refreshNext() {
    var btn = app.querySelector(".as-next");
    if (!btn) return;
    var step = state.step, done;
    if (step === 1) done = Q.context_questions.every(function (cq) { return Number.isInteger(state.context[cq.id]); });
    else done = Q.dimensions[step - 2].questions.every(function (qq) { return Number.isInteger(state.answers[qq.id]); });
    btn.disabled = !done;
  }

  function render() {
    var step = state.step, view;
    if (step <= 0) view = screenIntro();
    else if (step === 1) view = screenContext();
    else if (step <= 9) view = screenDimension(step);
    else if (step === 10) view = screenBlocker();
    else view = screenResults();
    app.replaceChildren(view);
  }

  fetch("/assessment/questions.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (q) {
    Q = q;
    if (params.get("sample") === "1") {
      state = fixtureState(); state.step = RESULTS;
      state.lead = { company: "Example Co." };
      state.report = true;
    } else if (params.has("step")) {
      state = fixtureState(); state.step = Math.max(0, Math.min(RESULTS, parseInt(params.get("step"), 10) || 0));
    } else {
      state = load();
    }
    render();
  }).catch(function () {
    app.replaceChildren(h("p", { class: "lead", text: "The assessment couldn't load. Please refresh, or email " + MAIL + "." }));
  });
})();
