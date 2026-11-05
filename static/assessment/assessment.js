/* Monovus AI Agent Readiness Assessment: UI.
   Steps: 0 intro · 1 context · 2-9 one dimension each · 10 blocker · 11 results (+ report).
   Debug for screenshots: ?step=N jumps to a step with the 'mixed' fixture pre-filled.
   ?sample=1 renders the sample results and report. All untrusted text (API output, the
   visitor's own input) is inserted with textContent, never innerHTML. */
(function () {
  "use strict";
  var S = window.MonovusScoring;
  var API = (window.MONOVUS_API || "").replace(/\/+$/, "");
  var KEY = "monovus-assessment-2026-11";
  var MAIL = "hello@monovus.solutions";
  var app = document.getElementById("app");
  var params = new URLSearchParams(location.search);
  var Q, state;

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
          h("h2", { class: "as-h3", text: "If you want it, by request" }),
          h("ul", { class: "as-ticks" }, [
            h("li", { text: "A personalised report written for your leadership team" }),
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
      h("p", { class: "as-fine" }, ["Answers stay in your browser until you ask for the full report. ",
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
      kids.push(h("div", { class: "as-flags", role: "note" }, [
        h("h2", { class: "as-h3", text: "Red flags to fix before launch" }),
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
      h("p", { class: "eyebrow", text: "Free · written for your leadership team" }),
      h("h2", { class: "as-h2", text: "Get your personalised report and 30-day plan" }),
      h("p", { text: "We'll turn these results into a short report: an executive summary, your top risks in business terms, a week-by-week plan, and the AWS services that close each gap." }),
      h("div", { class: "as-fields" }, [
        field("name", "Name", "text", "name", lead.name),
        field("email", "Work email", "email", "email", lead.email),
        field("company", "Company", "text", "organization", lead.company)
      ]),
      h("div", { class: "as-hp", "aria-hidden": "true" }, [h("label", { for: "website", text: "Website" }),
        h("input", { id: "website", name: "website", type: "text", tabindex: "-1", autocomplete: "off" })]),
      h("label", { class: "as-check" }, [h("input", { type: "checkbox", id: "consent_privacy", required: true }),
        h("span", {}, ["I agree to the ", h("a", { class: "quiet", href: "/pages/privacy.html", target: "_blank", rel: "noopener", text: "privacy policy" }),
          ". Monovus will use my details to prepare this report and to reply to me."])]),
      h("label", { class: "as-check" }, [h("input", { type: "checkbox", id: "consent_marketing" }),
        h("span", { text: "Optional: send me occasional insights on running AI agents in production. Unsubscribe any time." })]),
      h("button", { type: "submit", class: "btn btn-primary", text: "Get my report" }),
      status
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) { return (form.querySelector("#" + id).value || "").trim(); };
      var leadNow = { name: v("name"), email: v("email"), company: v("company"),
                      consent_privacy: form.querySelector("#consent_privacy").checked,
                      consent_marketing: form.querySelector("#consent_marketing").checked };
      if (!leadNow.name || !leadNow.company) { status.textContent = "Please add your name and company."; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(leadNow.email)) { status.textContent = "Please enter a valid work email."; return; }
      if (!leadNow.consent_privacy) { status.textContent = "Please agree to the privacy policy so we can prepare your report."; return; }
      state.lead = leadNow; save();
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true; status.textContent = "Writing your report. This takes about 15 seconds.";
      requestReport(r, leadNow, v("website")).then(function (rep) {
        state.report = rep; save(); render();
        var top = document.getElementById("report"); if (top) top.scrollIntoView({ behavior: "smooth" });
      });
    });
    return form;
  }

  function requestReport(r, lead, honeypot) {
    var local = function () {
      return { report_id: "local-" + Math.random().toString(36).slice(2, 10), generated_by: "fallback",
               overall: r.overall, report: S.fallbackReport(Q, r) };
    };
    if (!API) return Promise.resolve(local());
    var body = { version: Q.version, lead: lead, context: state.context, answers: state.answers,
                 blocker: (state.blocker || "").slice(0, Q.free_text.max_chars),
                 elapsed_ms: Date.now() - (state.startedAt || Date.now()), website: honeypot || "" };
    var ctl = new AbortController(); var t = setTimeout(function () { ctl.abort(); }, 30000);
    return fetch(API + "/v1/report", { method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(body), signal: ctl.signal })
      .then(function (res) { clearTimeout(t); if (!res.ok) throw new Error("http " + res.status); return res.json(); })
      .then(function (j) { if (!j || !j.report || !Array.isArray(j.report.top_risks)) throw new Error("shape"); return j; })
      .catch(function () { var l = local(); l.offline = true; return l; });
  }

  function reportView(r) {
    var rep = state.report, body = rep.report;
    var sample = params.get("sample") === "1";
    var lead = state.lead || {};
    var mailBody = "Report: " + rep.report_id + "\nScore: " + r.overall + "/100 (" + r.stage.name + ")\nCompany: " +
      (lead.company || "") + "\n\nI'd like to book the free Readiness Review.";
    var mailto = "mailto:" + MAIL + "?subject=" + encodeURIComponent("Readiness review") + "&body=" + encodeURIComponent(mailBody);
    return h("article", { id: "report", class: "as-report" }, [
      h("header", { class: "as-report-head" }, [
        h("p", { class: "eyebrow", text: sample ? "Sample report" : "Readiness report" + (lead.company ? " · " + lead.company : "") }),
        h("h2", { class: "as-h2", text: "AI Agent Readiness Report" }),
        h("p", { class: "as-meta", text: "Score " + r.overall + "/100 · " + r.stage.name + " · Report " + rep.report_id + " · " +
          new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) })
      ]),
      rep.offline ? h("p", { class: "as-fine", text: "We couldn't reach the report service just now, so this report was assembled from the framework rather than written for you. It covers the same ground." }) : null,
      h("h3", { class: "as-h3", text: "Executive summary" }),
      h("p", { class: "lead", text: body.executive_summary }),
      h("h3", { class: "as-h3", text: "Top risks" }),
      h("ol", { class: "as-risks" }, body.top_risks.map(function (t) {
        return h("li", {}, [h("strong", { text: t.title }), h("p", { text: t.business_impact }),
          h("p", {}, [h("span", { class: "as-k", text: "First step. " }), t.first_step]),
          t.aws_services && t.aws_services.length ? h("p", { class: "as-svc", text: "On AWS: " + t.aws_services.join(" · ") }) : null]);
      })),
      h("h3", { class: "as-h3", text: "Your 30-day plan" }),
      h("table", { class: "as-plan" }, [
        h("thead", {}, [h("tr", {}, [h("th", { text: "Week" }), h("th", { text: "Action" }), h("th", { text: "Owner" })])]),
        h("tbody", {}, body.plan_30_days.map(function (p) {
          return h("tr", {}, [h("td", { class: "as-wk", text: String(p.week) }), h("td", { text: p.action }), h("td", { class: "as-own", text: p.owner_role })]);
        }))
      ]),
      h("p", { class: "as-closing", text: body.closing }),
      h("div", { class: "as-actions as-noprint" }, [
        h("a", { class: "btn btn-primary", href: mailto, text: "Book your free Readiness Review" }),
        h("button", { type: "button", class: "as-btn-quiet", text: "Download as PDF", on: { click: function () { window.print(); } } })
      ]),
      h("p", { class: "as-fine", text: Q.disclaimer })
    ]);
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    state = fresh();
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
      state.report = { report_id: "sample", generated_by: "fallback", report: S.fallbackReport(Q, S.compute(Q, state.answers)) };
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
