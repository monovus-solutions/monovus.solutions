/* Monovus v9: a cover and four chapters, eight screens (brief 2026-11-v9 section 2).
   Cover (overview) · 01 Oversight (oversight) · 02 Agents (agents, economics) · 03 Controls (behaviour, systems) ·
   04 Begin (monovus, begin). One statement + one interaction per screen. Moving between screens is a morph of the
   same glass. The bottom bar is one hairline (Option A, "Rule") with a moss glass bead at the current screen.
   Engine calls beyond the v6 API are guarded. <mv-econ>, <mv-apply> and <mv-arch> are optional: the page works without them. */
(function () {
  'use strict';
  var CH = ['overview', 'oversight', 'agents', 'economics', 'behaviour', 'systems', 'monovus', 'begin'];
  // the four chapters the bottom bar names; the cover is the start of the line
  var GROUPS = [
    { n: '01', name: 'Oversight', screens: ['oversight'] },
    { n: '02', name: 'Agents', screens: ['agents', 'economics'] },
    { n: '03', name: 'Controls', screens: ['behaviour', 'systems'] },
    { n: '04', name: 'Begin', screens: ['monovus', 'begin'] }
  ];
  // v8 links: Society, Companies and People are one screen now
  var ALIAS = { society: 'oversight', companies: 'oversight', people: 'oversight' };
  function groupOf(ch) { for (var g = 0; g < GROUPS.length; g++) { if (GROUPS[g].screens.indexOf(ch) >= 0) return g; } return -1; }
  // where a screen sits on the rule, 0..1: the cover takes a short segment, each chapter an equal one, and a
  // chapter's second screen sits at the middle of its segment, so the names never collide
  var COVER = 0.1, SEG = (1 - COVER) / GROUPS.length;
  function posOf(ch) {
    var g = groupOf(ch);
    return g < 0 ? 0 : COVER + g * SEG + GROUPS[g].screens.indexOf(ch) * SEG / 2;
  }
  var Q = new URLSearchParams(location.search);
  var body = document.body;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stage = window.MonovusStage ? window.MonovusStage.init(document.getElementById('stage'), { reduce: reduce }) : null;
  if (!stage) document.getElementById('stage').style.display = 'none';
  var eng7 = !!(stage && stage.setTruth);
  body.classList.toggle('eng7', eng7);
  body.classList.toggle('rimdom', !eng7);   // the v7 engine draws rim arcs and measure rings itself
  if (reduce) body.classList.add('reduce');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.apply((r || document).querySelectorAll(s)); };
  var lensEl = $('#lens');
  var sections = $$('.ch');
  var tgs = $$('.tg');
  var faults = $$('.fault');
  var nets = $$('.nl');
  var sheet = $('.form--sheet'), formBead = $('.form--bead');
  var rule = $('.rule'), ruleLine = $('.rule__line'), ruleNames = $$('.rule__name'), ruleCur = $('.rule__cur'), bead = $('.rule__bead');
  var conseq = $('#conseq'), conseqP = conseq.parentElement;
  var detail = $('.detail'), dName = $('#d-name'), dState = $('#d-state');
  var dPpl = $('#d-ppl'), dNeed = $('#d-need'), dSys = $('#d-sys'), dOff = $('#d-off');
  var marksBox = $('.marks');
  var arch = document.getElementById('arch');
  var econ = document.getElementById('econ');
  var playBtn = $('#play');
  var NS = 'http://www.w3.org/2000/svg';

  // ---- the seven controls (brief section 3.7). Order = rim arc order, clockwise from the top ----
  var CONTROLS = [
    { k: 'identity', name: 'Identity', ppl: 'An employee ID and a signature', need: 'Its own identity', sys: 'A named role with its own credentials. No shared keys.', off: 'Acted with a shared admin key.' },
    { k: 'mandate', name: 'Mandate', ppl: 'A job description and a signing limit', need: 'A mandate', sys: 'Every action, and every source it reads, is checked against written rules first. Above a limit, it waits for a person.', off: 'Refund of $1,240 issued without approval.' },
    { k: 'record', name: 'Record', ppl: 'Minutes and ledgers', need: 'A record', sys: 'Every step is traced, down to the source it relied on.', off: 'A complaint arrives. There is no record of what the agent did.' },
    { k: 'review', name: 'Review', ppl: 'Probation and performance reviews', need: 'Review before trust', sys: 'Each new version is tested on fixed cases and blocked if it scores below the bar.', off: 'Version 1.6 shipped at 88.9%, below the 92% bar.' },
    { k: 'budget', name: 'Budget', ppl: 'An expense limit', need: 'A budget', sys: 'Spend is metered per agent, with alarms and hard limits.', off: 'Spend passes the monthly budget on day 19.' },
    { k: 'rollback', name: 'Rollback', ppl: 'A way to correct or recall work', need: 'A way back', sys: 'Any release can be rolled back in minutes.', off: 'A bad release stays live for 3 h 20 min.' },
    { k: 'evidence', name: 'Evidence', ppl: 'An audit file', need: 'Evidence', sys: 'The record is packaged for auditors and security reviews.', off: 'The security review asks for evidence. There is none on file.' }
  ];
  var KIDX = {}; CONTROLS.forEach(function (c, i) { KIDX[c.k] = i; });
  var ALL_ON = 'All seven on. Every action within its rules.';
  var SPAN = Math.PI * 2 / 7;
  function arcAngle(i) { return -Math.PI / 2 + i * SPAN; }
  var lastKey = 'identity';

  // Agents: the four faults, by the control that answers them (identity, record, review and budget missing)
  var WHY_OFF = '0100011';

  // Systems fallback captions (the arch component writes its own)
  var REQ = ['A customer asks to refund order 4471.', 'Signed in. The agent acts for this customer only.', 'Checked: safe and on topic.',
    'A small model handles it. Cost $0.003.', 'Refund tool runs. Mandate: over $500 needs a person. This one is $86: allowed.',
    'Remembers the order for the rest of the chat.', 'Refund of $86 confirmed in 1.8 s.', 'Every step traced and logged. Budget 41% used.'];

  // ---- the network (Oversight; v8's Society layout). Area coordinates 0..1; r = share of the area's short side.
  // A lens given {to, ang} sits beside another at a fixed gap, so the liquid bridge holds at every size. ----
  var NET = {
    oversight: { main: [0.465, 0.50, 0.105], n: [
      [0.150, 0.284, 0.042], { to: 0, ang: 34, r: 0.036, gap: 9 }, [0.648, 0.100, 0.049], [0.874, 0.255, 0.039],
      [0.890, 0.614, 0.052], { to: 4, ang: 120, r: 0.036, gap: 9 }, [0.599, 0.892, 0.042], [0.292, 0.843, 0.049],
      [0.082, 0.614, 0.033], { to: 'main', ang: 188, r: 0.039, gap: 10 }] }
  };

  // ---- rim arcs (DOM copy for engines that do not draw them) ----
  function arcPath(r, a0, a1) {
    var x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
    return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
  }
  $$('.rim').forEach(function (svg) {
    for (var i = 0; i < 7; i++) {
      var p = document.createElementNS(NS, 'path'), c = arcAngle(i), g = 0.055;
      p.setAttribute('d', arcPath(90, c - SPAN / 2 + g, c + SPAN / 2 - g));
      svg.appendChild(p);
    }
  });
  function paintRim(el) {
    var on = el.getAttribute('data-rim-on') || '1111111', svg = el.querySelector('.rim');
    if (!svg) return;
    $$('path', svg).forEach(function (p, i) { p.classList.toggle('off', on.charAt(i) === '0'); });
  }
  $$('[data-rim]').forEach(paintRim);

  // shu hairlines: seven for the lens (Behaviour)
  var marks = [];
  for (var mi = 0; mi < 7; mi++) { var mk = document.createElement('i'); mk.className = 'mark'; marksBox.appendChild(mk); marks.push(mk); }
  function setMark(mk, x, y, a, len, on) {
    mk.style.width = len + 'px';
    mk.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (a * 180 / Math.PI).toFixed(2) + 'deg)';
    mk.classList.toggle('on', !!on);
  }

  function isMobile(W) { return W < 761; }
  function px(v) { return Math.round(v * 10) / 10 + 'px'; }
  function rectOf(el) { return el ? el.getBoundingClientRect() : null; }
  function box(el, x, y, r) {
    el.style.left = px(x - r); el.style.top = px(y - r); el.style.width = px(r * 2); el.style.height = px(r * 2);
  }

  // ---- Agents: fault points and the scan ----
  var scanIdx = 0, scanTimer = 0, seenTimer = 0;
  function faultPts(W, H) {
    if (!isMobile(W)) {
      var r = 0.11 * Math.min(H, W * 0.62);
      return { r: r, side: 'below', pts: [[0.83 * W, 0.30 * H], [0.62 * W, 0.53 * H], [0.87 * W, 0.60 * H], [0.71 * W, 0.71 * H]] };
    }
    var a = rectOf($('.ch[data-chapter="agents"] .figs'));
    var y0 = Math.max(a ? a.bottom + 50 : 0.5 * H, 0.42 * H), y1 = H - 150;
    var gap = Math.min(84, (y1 - y0) / 3);
    var rr = Math.min(30, gap * 0.4);
    return { r: rr, side: 'right', pts: [0, 1, 2, 3].map(function (i) { return [22 + rr + 4, y0 + i * gap]; }) };
  }
  function placeFaults(W, H) {
    var F = faultPts(W, H);
    faults.forEach(function (el, i) {
      var p = F.pts[i];
      el.style.left = px(p[0]); el.style.top = px(p[1]);
      if (F.side === 'below') { el.style.setProperty('--lx', '0px'); el.style.setProperty('--ly', px(F.r + 14)); el.style.setProperty('--ax', '-50%'); }
      else { el.style.setProperty('--lx', px(F.r + 16)); el.style.setProperty('--ly', '-19px'); el.style.setProperty('--ax', '0%'); }
    });
    return F;
  }
  function markSeen(i) {
    faults.forEach(function (el, j) { el.classList.toggle('now', j === i); if (j === i) el.classList.add('seen'); });
  }
  function stopScan() { clearTimeout(scanTimer); clearTimeout(seenTimer); scanTimer = seenTimer = 0; }
  function scanTo(i, instant) {
    scanIdx = i;
    place(cur, !instant);
    if (stage) stage.sync({ instant: !!instant });
    clearTimeout(seenTimer);
    if (instant) markSeen(i);
    else seenTimer = setTimeout(function () { markSeen(i); }, 1100);
  }
  function startScan() {
    stopScan();
    if (reduce || Q.has('scan')) return;
    scanTimer = setTimeout(function tick() {
      if (cur !== 'agents') return;
      scanTo((scanIdx + 1) % 4, false);
      scanTimer = setTimeout(tick, 2900);
    }, 3600);
  }

  function archAgentRect() {
    if (arch && typeof arch.agentRect === 'function') {
      try { var r = arch.agentRect(); if (r && r.width > 0) return r; } catch (e) { /* component not ready */ }
    }
    var s = $('.arch-fb [data-node="agent"] .sock');
    var rs = rectOf(s);
    return rs && rs.width > 0 ? rs : null;
  }

  // the free area for the network: the right third on a laptop (the three columns hold the left), the space under
  // the text on a phone
  function netArea(ch, W, H) {
    if (!isMobile(W)) return { x: 0.635 * W, y: 0.15 * H, w: 0.33 * W, h: 0.70 * H };
    var s = $('.ch[data-chapter="' + ch + '"]'), last = s ? s.lastElementChild : null, lr = rectOf(last);
    var y0 = Math.min(lr ? lr.bottom + 30 : 0.5 * H, H - 300), y1 = H - 128;
    return { x: 22, y: y0, w: W - 44, h: Math.max(160, y1 - y0) };
  }
  function netLayout(ch, W, H) {
    var spec = NET[ch], A = netArea(ch, W, H), s = Math.min(A.w, A.h);
    var main = { x: A.x + spec.main[0] * A.w, y: A.y + spec.main[1] * A.h, r: spec.main[2] * s };
    var pts = [];
    function at(i) {
      if (pts[i] !== undefined) return pts[i];
      var n = spec.n[i];
      if (!n) { pts[i] = null; return null; }
      if (Array.isArray(n)) { pts[i] = { x: A.x + n[0] * A.w, y: A.y + n[1] * A.h, r: n[2] * s }; return pts[i]; }
      var p = n.to === 'main' ? main : at(n.to), r = n.r * s, d = p.r + r + n.gap, a = n.ang * Math.PI / 180;
      pts[i] = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: r };
      return pts[i];
    }
    for (var i = 0; i < nets.length; i++) at(i);
    return { main: main, pts: pts };
  }

  function layout(ch, W, H) {
    var m = isMobile(W), L, out = { tg: null, F: null, net: null, forms: null };
    var u = Math.min(H, W * 0.62);
    if (ch === 'agents') {
      out.F = placeFaults(W, H);
      var p = out.F.pts[scanIdx];
      L = { x: p[0], y: p[1], rx: out.F.r, ry: out.F.r };
    } else if (NET[ch] && !m) {
      out.net = netLayout(ch, W, H);
      var mn = out.net.main;
      L = { x: mn.x, y: mn.y, rx: mn.r, ry: mn.r };
    } else if (ch === 'systems') {
      var ar = archAgentRect();
      if (ar) {
        var rr = Math.min(ar.width, ar.height) / 2, bx = m ? rectOf($('.ch[data-chapter="systems"]')) : null;
        if (bx && (ar.top < bx.top - 2 || ar.bottom > bx.bottom + 2)) rr = 0;
        L = { x: ar.left + ar.width / 2, y: ar.top + ar.height / 2, rx: rr, ry: rr };
      }
      else L = m ? { x: 0.8 * W, y: 0.62 * H, rx: 34, ry: 34 } : { x: 0.72 * W, y: 0.45 * H, rx: 0.07 * u, ry: 0.07 * u };
    } else if (ch === 'begin') {
      var b = rectOf($('#cta-final'));
      L = { x: b.left + b.width / 2, y: b.top + b.height / 2, rx: 0, ry: 0 };
    } else if (ch === 'economics') {
      var eb = rectOf($('.econbox'));
      if (!m && eb && eb.width > 0) {
        var re = 0.05 * u;
        L = { x: eb.left - re - 0.045 * W, y: eb.top + Math.min(eb.height, 0.5 * H) * 0.62, rx: re, ry: re };
      } else {
        // phones: no free space beside the headline, so the lens settles into the calculator's corner
        L = eb && eb.width > 0 ? { x: eb.right - 26, y: eb.top + 26, rx: 0, ry: 0 } : { x: W - 36, y: 104, rx: 0, ry: 0 };
      }
    } else if (ch === 'monovus') {
      var tl = rectOf($('.ch[data-chapter="monovus"] .slab')), hd = rectOf($('#h-monovus'));
      if (!m) {
        var rm = Math.min(0.085 * u, Math.max(30, ((tl ? tl.top : 0.45 * H) - 128) / 2 - 18));
        L = { x: 0.80 * W, y: (tl ? tl.top : 0.45 * H) - rm - 34, rx: rm, ry: rm };
      } else {
        L = { x: W - 52, y: hd ? hd.top - 2 : 120, rx: 22, ry: 22 };
      }
      out.forms = {
        sheet: { x: L.x, y: L.y + L.rx * 0.5, w: L.rx * 2.9, h: Math.max(8, L.rx * 0.16) },
        bead: { x: L.x + Math.cos(-0.6) * (L.rx + L.rx * 0.13 + 3), y: L.y + Math.sin(-0.6) * (L.rx + L.rx * 0.13 + 3), r: Math.max(5, L.rx * 0.15) },
        apart: { sheetX: L.x - L.rx * 3.2, sheetY: L.y + L.rx * 1.1, beadX: L.x + L.rx * 0.3, beadY: L.y + L.rx * 2.3 }
      };
    } else if (!m) {
      if (ch === 'overview') L = { x: 0.735 * W, y: 0.47 * H, rx: 0.17 * u, ry: 0.17 * u };
      else if (ch === 'behaviour') L = { x: 0.735 * W, y: 0.53 * H, rx: 0.125 * u, ry: 0.125 * u };
    } else {
      if (ch === 'overview') {
        var gb = rectOf($('.ch[data-chapter="overview"] .hint')), y0 = gb ? gb.bottom + 10 : 0.62 * H, y1 = H - 84;
        var r0 = Math.max(0, Math.min(0.15 * W, (y1 - y0) / 2 - 26));
        L = { x: 0.5 * W, y: (y0 + y1) / 2, rx: r0, ry: r0 };
      } else if (ch === 'oversight') {
        // phones: the three columns fill the screen, so the delegates stay inside one small lens by the kicker
        var ko = rectOf($('.ch[data-chapter="oversight"] .kick'));
        L = { x: W - 40, y: ko ? ko.top + ko.height / 2 : 100, rx: 14, ry: 14 };
      } else if (ch === 'behaviour') {
        var sp = rectOf($('.tg-space'));
        L = { x: W - 64, y: sp ? sp.top + sp.height / 2 : 0.6 * H, rx: 38, ry: 38 };
      }
    }
    if (ch === 'behaviour') {
      if (m) {
        var s = rectOf($('.tg-space'));
        out.tg = tgs.map(function (_, i) { return { x: (s ? s.left : 22), y: (s ? s.top : 0.45 * H) + 17 + i * 40, a: arcAngle(i) }; });
      } else {
        var R = L.rx + Math.max(100, 0.118 * H);
        out.tg = tgs.map(function (_, i) { var a = arcAngle(i); return { x: L.x + Math.cos(a) * R, y: L.y + Math.sin(a) * R, a: a }; });
      }
    }
    out.L = L;
    return out;
  }

  var cur = null, lay = null, formsApart = false;

  function place(ch, moving) {
    var W = window.innerWidth, H = window.innerHeight, m = isMobile(W);
    lay = layout(ch, W, H);
    var L = lay.L;
    box(lensEl, L.x, L.y, L.rx);
    tgs.forEach(function (el, i) {
      var p = lay.tg ? lay.tg[i] : L;
      el.style.left = px(p.x); el.style.top = px(p.y);
      el.style.setProperty('--k', i);
    });
    // the ten delegates: present ones sit on their spot, the rest return into the main lens
    nets.forEach(function (el, i) {
      var p = lay.net ? lay.net.pts[i] : null;
      if (p) { box(el, p.x, p.y, p.r); el.setAttribute('data-present', '1'); el.style.setProperty('--k', i); }
      else { box(el, L.x, L.y, Math.max(1, L.rx * 0.3)); el.setAttribute('data-present', '0'); }
    });
    // Monovus: the sheet and the bead merge into the lens
    if (lay.forms) {
      var f = lay.forms, ap = formsApart;
      sheet.style.left = px((ap ? f.apart.sheetX : f.sheet.x) - f.sheet.w / 2); sheet.style.top = px((ap ? f.apart.sheetY : f.sheet.y) - f.sheet.h / 2);
      sheet.style.width = px(f.sheet.w); sheet.style.height = px(f.sheet.h); sheet.style.borderRadius = px(f.sheet.h / 2);
      box(formBead, ap ? f.apart.beadX : f.bead.x, ap ? f.apart.beadY : f.bead.y, f.bead.r);
      sheet.setAttribute('data-present', '1'); formBead.setAttribute('data-present', '1');
    } else { sheet.setAttribute('data-present', '0'); formBead.setAttribute('data-present', '0'); }
    // rim state on the main lens tells which controls are on
    var on = '1111111';
    if (ch === 'agents') on = WHY_OFF;
    else if (ch === 'behaviour') on = tgs.map(function (t) { return t.getAttribute('aria-checked') === 'false' ? '0' : '1'; }).join('');
    lensEl.setAttribute('data-rim-on', on); paintRim(lensEl);
    tgs.forEach(function (t, i) {
      var a = arcAngle(i), off = ch === 'behaviour' && t.getAttribute('aria-checked') === 'false';
      setMark(marks[i], L.x + Math.cos(a) * (L.rx + 7), L.y + Math.sin(a) * (L.rx + 7), a, m ? 18 : 30, off);
    });
    return lay;
  }

  function clipGlass() {
    var s = $('.ch.is-active');
    if (!s) return;
    var bx = s.getBoundingClientRect(), scroll = isMobile(window.innerWidth) && s.scrollHeight > s.clientHeight + 2;
    $$('[data-glass],[data-lens],[data-slab]', s).forEach(function (el) {
      if (el.closest('.toggles')) return;
      var r = el.getBoundingClientRect(), out = scroll && (r.bottom > bx.bottom + 4 || r.top < bx.top - 4);
      if (out) el.setAttribute('data-present', '0'); else if (el.getAttribute('data-present') === '0') el.removeAttribute('data-present');
    });
  }

  // ---- the bottom bar (Option A, "Rule"): ticks, the four names, the bead at the current screen ----
  CH.forEach(function (ch) {
    var g = groupOf(ch);
    if (g < 0) return;
    var t = document.createElement('i');
    t.className = 'rule__tick' + (GROUPS[g].screens.indexOf(ch) === 0 ? ' rule__tick--start' : '');
    t.style.left = (posOf(ch) * 100).toFixed(3) + '%';
    ruleLine.appendChild(t);
  });
  ruleNames.forEach(function (b) { b.style.left = (posOf(b.getAttribute('data-go')) * 100).toFixed(3) + '%'; });
  // ---- Options B (?nav=index: a vertical index at the right edge; phones fall back to A) and C (?nav=capsule) ----
  var NAV = Q.get('nav');
  if (NAV !== 'index' && NAV !== 'capsule') NAV = '';
  if (NAV) body.classList.add('nav-' + NAV);
  function el(tag, cls, kids, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    (kids || []).forEach(function (k) { e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    Object.keys(attrs || {}).forEach(function (a) { e.setAttribute(a, attrs[a]); });
    return e;
  }
  function numName(g) { return [el('span', 'rule__n mono', [GROUPS[g].n]), ' ' + GROUPS[g].name]; }
  var idxItems = [], capName = null, capList = null, capSteps = [], capBtns = [];
  if (NAV === 'index') {
    var idx = el('nav', 'idx', null, { 'aria-label': 'Chapters' });
    GROUPS.forEach(function (G, g) {
      var b = el('button', 'idx__i', [el('span', 'idx__t', [G.name]), el('i', 'idx__h', null, { 'aria-hidden': 'true' }), el('span', 'idx__n mono', [G.n])],
        { type: 'button', 'data-go': G.screens[0], 'aria-label': G.n + ' ' + G.name });
      idx.appendChild(b); idxItems.push(b);
    });
    document.body.appendChild(idx);
  } else if (NAV === 'capsule') {
    capName = el('button', 'capsule__name', null, { type: 'button', 'aria-expanded': 'false', 'aria-haspopup': 'true' });
    capList = el('ul', 'capsule__list frost', null, { 'data-glass': '', 'data-glass-variant': 'frost' });
    capList.hidden = true;
    GROUPS.forEach(function (G, g) {
      var b = el('button', '', numName(g), { type: 'button', 'data-go': G.screens[0] });
      capBtns.push(b); capList.appendChild(el('li', '', [b]));
    });
    capSteps = [el('button', 'capsule__step', ['\u2039'], { type: 'button', 'data-step': '-1', 'aria-label': 'Previous screen' }),
                el('button', 'capsule__step', ['\u203A'], { type: 'button', 'data-step': '1', 'aria-label': 'Next screen' })];
    var cap = el('nav', 'capsule', [capSteps[0], capName, capSteps[1], capList], { 'aria-label': 'Chapters', 'data-glass': '' });
    document.body.appendChild(cap);
    function capOpen(on) {
      capList.hidden = !on; capName.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (stage) { if (stage.rescan) stage.rescan(); stage.sync({ instant: true }); }
    }
    capName.addEventListener('click', function () { capOpen(capList.hidden); });
    capBtns.forEach(function (b) { b.addEventListener('click', function () { setTimeout(function () { capOpen(false); }, 0); }); });
    capSteps.forEach(function (b) { b.addEventListener('click', function () { step(+b.getAttribute('data-step')); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !capList.hidden) capOpen(false); });
  }
  function placeAlt() {
    var g = groupOf(cur);
    idxItems.forEach(function (b, i) { b.classList.toggle('on', i === g); if (i === g) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    if (capName) {
      capName.textContent = '';
      (g < 0 ? ['Overview'] : numName(g)).forEach(function (k) { capName.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
      capSteps[0].disabled = CH.indexOf(cur) === 0; capSteps[1].disabled = CH.indexOf(cur) === CH.length - 1;
      capBtns.forEach(function (b, i) { b.classList.toggle('on', i === g); });
    }
    // the bead is glass: when the rule is not shown (B on a laptop, C), the stage must not draw it
    bead.setAttribute('data-present', getComputedStyle(rule).display === 'none' ? '0' : '1');
  }
  var curN = document.createElement('span'), curT = document.createTextNode('');
  curN.className = 'rule__n mono';
  ruleCur.appendChild(curN); ruleCur.appendChild(curT);
  function placeRule() {
    var g = groupOf(cur), p = posOf(cur), w = rule.offsetWidth;
    bead.style.left = (p * 100).toFixed(3) + '%';
    ruleNames.forEach(function (b, i) {
      b.classList.toggle('on', i === g);
      if (i === g) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    $$('.rule__tick', ruleLine).forEach(function (t, i) { t.classList.toggle('past', posOf(CH[i + 1]) <= p); });
    // phones: the current chapter's name sits above the bead, kept inside the line
    curN.textContent = g < 0 ? '' : GROUPS[g].n;
    curT.nodeValue = g < 0 ? '' : ' ' + GROUPS[g].name;
    ruleCur.classList.toggle('on', g >= 0);
    var cw = ruleCur.offsetWidth;
    ruleCur.style.left = px(Math.max(cw / 2, Math.min(w - cw / 2, p * w)));
  }

  // ---- engine hooks (stage.js v9: ripple, setCalm). Always guarded, so the page works with either engine ----
  function eng() { return stage || (window.MonovusStage && window.MonovusStage.current) || null; }
  function ripple(x, y, o) {
    var st = eng();
    if (st && st.ripple) { try { st.ripple(x, y, o || {}); } catch (e) { /* engine not ready */ } }
  }
  function lensRipple(o) { if (lay && lay.L) ripple(lay.L.x, lay.L.y, o); }
  // the cover: every 7 s one action ripples out of the lens and the seven arcs check it; paused when the tab is hidden
  var coverT = 0;
  function coverTick() {
    clearInterval(coverT); coverT = 0;
    if (cur !== 'overview' || document.hidden) return;
    coverT = setInterval(function () { if (cur === 'overview' && !document.hidden) lensRipple(); }, 7000);
  }
  document.addEventListener('visibilitychange', coverTick);
  // calmer sand behind the reading zones: the text block (its ink, not its block boxes) and the columns
  var CALM_TEXT = '.kick, .h, .sub, .actions, .hint, .conseq, .next, .figs, .src';
  function inkRect(els) {
    var r = null, rg = document.createRange();
    function add(b) {
      if (!b || b.width < 1 || b.height < 1) return;
      if (!r) r = { l: b.left, t: b.top, r: b.right, b: b.bottom };
      else { r.l = Math.min(r.l, b.left); r.t = Math.min(r.t, b.top); r.r = Math.max(r.r, b.right); r.b = Math.max(r.b, b.bottom); }
    }
    els.forEach(function (el) {
      $$('.btn, .tg', el).forEach(function (b) { add(b.getBoundingClientRect()); });
      var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
      while ((n = tw.nextNode())) { if (n.nodeValue.trim()) { rg.selectNodeContents(n); add(rg.getBoundingClientRect()); } }
    });
    return r;
  }
  function calm() {
    var st = eng();
    if (!st || !st.setCalm) return;
    var s = $('.ch.is-active'), out = [];
    if (s) {
      var bx = s.getBoundingClientRect(), H = window.innerHeight;
      var text = inkRect($$(CALM_TEXT, s).filter(function (el) { return el.parentNode === s; }));
      var cols = $$('.slab, .spec--ideas', s).map(function (el) { var b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
      [text].concat(cols).forEach(function (r) {
        if (!r) return;
        var top = Math.max(r.t, isMobile(window.innerWidth) ? bx.top : 0), bot = Math.min(r.b, isMobile(window.innerWidth) ? bx.bottom : H);
        if (bot - top < 8 || r.r - r.l < 8) return;
        out.push({ x: Math.round(r.l), y: Math.round(top), w: Math.round(r.r - r.l), h: Math.round(bot - top) });
      });
    }
    try { st.setCalm(out.slice(0, 3)); } catch (e) { /* engine not ready */ }
  }

  function updateEngine() {
    if (!stage) return;
    stage.setSectors(tgs.map(function (el, i) {
      return { a: arcAngle(i), dis: cur === 'behaviour' && el.getAttribute('aria-checked') === 'false' ? 1 : 0 };
    }));
    if (stage.setTruth) stage.setTruth(cur === 'agents' ? 'frayed' : cur === 'economics' ? 'measure' : 'calm');
    if (stage.setFaults) {
      var F = cur === 'agents' && lay && lay.F;
      stage.setFaults(F ? F.pts.map(function (p) { return { x: p[0], y: p[1], r: F.r * 0.9 }; }) : []);
    }
  }

  var formsT = 0, chRip = 0;
  function go(ch, o) {
    o = o || {};
    var aliased = !!ALIAS[ch];
    if (aliased) ch = ALIAS[ch];
    if (CH.indexOf(ch) < 0) ch = 'overview';
    var same = ch === cur, prev = cur;
    cur = ch;
    body.setAttribute('data-ch', ch);
    sections.forEach(function (s) {
      var on = s.getAttribute('data-chapter') === ch;
      s.classList.toggle('is-active', on);
      s.setAttribute('data-present', on ? '1' : '0');
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      if ('inert' in s) s.inert = !on;
      if (on && !same) s.scrollTop = 0;
    });
    if (ch === 'agents' && (!same || o.instant)) {
      if (!same) { faults.forEach(function (f) { f.classList.remove('seen', 'now'); }); scanIdx = Q.has('scan') ? Math.min(3, +Q.get('scan') || 0) : 0; }
      if (reduce) faults.forEach(function (f) { f.classList.add('seen'); });
    }
    if (ch !== 'agents') stopScan();
    if (ch !== 'systems' && prev === 'systems' && arch && arch.stop) { try { arch.stop(); } catch (e) { /* ignore */ } }
    // Monovus opens with the three forms apart, then they merge (the first frame is always the merged state)
    clearTimeout(formsT);
    formsApart = ch === 'monovus' && !same && !o.instant && !reduce;
    place(ch, !o.instant && !same);
    clipGlass();
    placeRule();
    placeAlt();
    if (stage) stage.sync({ instant: !!o.instant });
    updateEngine();
    calm();
    coverTick();
    // every chapter change is one action: a drop at the lens, checked by the seven arcs
    clearTimeout(chRip);
    if (!same && prev && !o.instant) chRip = setTimeout(function () { if (cur === ch) lensRipple(); }, 420);
    if (formsApart) formsT = setTimeout(function () { formsApart = false; if (cur === 'monovus') { place(cur); if (stage) stage.sync(); } }, 520);
    if (ch === 'agents' && !same) {
      if (o.instant || reduce) { markSeen(scanIdx); if (Q.has('scan')) for (var i = 0; i <= scanIdx; i++) faults[i].classList.add('seen'); }
      else { clearTimeout(seenTimer); seenTimer = setTimeout(function () { markSeen(scanIdx); }, 1000); }
      startScan();
    }
    if ((!o.noHash || aliased) && location.hash !== '#' + ch) history.replaceState(null, '', '#' + ch);
    if (!same && !o.instant && o.focus) {
      var h = $('.ch.is-active .h');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }

  function step(dir) {
    var i = CH.indexOf(cur) + dir;
    if (i >= 0 && i < CH.length) go(CH[i]);
  }

  // ---- Begin: "Apply for early access" focuses the form ----
  function focusApply() {
    var box2 = $('.applybox');
    var f = box2 && box2.querySelector('input, textarea, button');
    if (f) { try { f.focus({ preventScroll: false }); } catch (e) { f.focus(); } }
    else if (box2) box2.scrollIntoView({ block: 'nearest' });
  }

  // ---- input: the rule, nav, links, keys, wheel, swipe, hash ----
  $$('[data-go]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault(); go(el.getAttribute('data-go'));
      if (el.hasAttribute('data-apply')) setTimeout(focusApply, 450);
    });
  });
  $$('button[data-apply]:not([data-go])').forEach(function (el) { el.addEventListener('click', focusApply); });
  function typing(t) { return t && (t.closest('input, textarea, select, [contenteditable="true"]')); }
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') { e.preventDefault(); step(1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); step(-1); }
    else if (k === 'Home') { e.preventDefault(); go(CH[0]); }
    else if (k === 'End') { e.preventDefault(); go(CH[CH.length - 1]); }
  });
  var wheelAcc = 0, wheelLock = 0;
  window.addEventListener('wheel', function (e) {
    e.preventDefault();
    var now = performance.now();
    if (now < wheelLock) return;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 70) { step(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; wheelLock = now + 1100; }
  }, { passive: false });
  // swipe: on a phone a long chapter scrolls first, then the next swipe changes chapter
  var ty = null, tScroll = 0;
  window.addEventListener('touchstart', function (e) {
    ty = typing(e.target) || (e.target.closest && e.target.closest('input[type="range"]')) ? null : e.touches[0].clientY;
    var s = $('.ch.is-active'); tScroll = s ? s.scrollTop : 0;
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (ty === null) return;
    var dy = ty - e.changedTouches[0].clientY; ty = null;
    var s = $('.ch.is-active');
    if (s && s.scrollHeight > s.clientHeight + 2) {
      if (Math.abs(s.scrollTop - tScroll) > 2) return;
      if (dy > 0 && s.scrollTop + s.clientHeight < s.scrollHeight - 2) return;
      if (dy < 0 && s.scrollTop > 2) return;
    }
    if (Math.abs(dy) > 56) step(dy > 0 ? 1 : -1);
  }, { passive: true });
  window.addEventListener('hashchange', function () { go(location.hash.slice(1), { noHash: true }); });
  // a scrolled phone chapter moves its anchors: keep the glass on them
  var scrollRaf = 0;
  sections.forEach(function (s) {
    s.addEventListener('scroll', function () {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(function () { scrollRaf = 0; place(cur); clipGlass(); if (stage) stage.sync({ instant: true }); updateEngine(); calm(); });
    }, { passive: true });
  });

  // ---- Behaviour: switching a control off frays its sector, darkens its arc, marks it in shu ----
  function showDetail(i) {
    var c = CONTROLS[i], off = tgs[i].getAttribute('aria-checked') === 'false';
    dName.textContent = c.name; dPpl.textContent = c.ppl; dNeed.textContent = c.need; dSys.textContent = c.sys; dOff.textContent = c.off;
    dState.textContent = off ? 'Off' : 'On';
    detail.classList.toggle('is-off', off);
  }
  function setControl(el, on) {
    el.setAttribute('aria-checked', on ? 'true' : 'false');
    var k = el.getAttribute('data-key');
    lastKey = k;
    var offs = tgs.filter(function (t) { return t.getAttribute('aria-checked') === 'false'; });
    if (!offs.length) { conseq.textContent = ALL_ON; conseqP.classList.remove('is-off'); }
    else {
      var show = on ? offs[offs.length - 1].getAttribute('data-key') : k;
      conseq.textContent = CONTROLS[KIDX[show]].off; conseqP.classList.add('is-off');
    }
    showDetail(KIDX[k]);
    place(cur);
    if (stage) stage.sync();
    updateEngine();
    if (!on && cur === 'behaviour') lensRipple({ off: tgs.map(function (t) { return t.getAttribute('aria-checked') === 'false' ? '0' : '1'; }).join('') });
  }
  tgs.forEach(function (el, i) {
    el.addEventListener('click', function () { setControl(el, el.getAttribute('aria-checked') !== 'true'); });
    el.addEventListener('focus', function () { showDetail(i); });
    el.addEventListener('pointerenter', function () { showDetail(i); });
    el.addEventListener('pointerleave', function () { showDetail(KIDX[lastKey]); });
  });

  // ---- Systems: one test request ----
  var req = null, reqTimer = 0, AT_AGENT = 2;   // 0-based: 'Checked: safe and on topic.' is where it reaches the agent
  function fallbackPlay(n) {
    if (!req) { req = document.createElement('p'); req.className = 'req'; req.setAttribute('aria-live', 'polite'); playBtn.parentNode.parentNode.insertBefore(req, playBtn.parentNode.nextSibling); }
    clearTimeout(reqTimer);
    var i = typeof n === 'number' ? n : 0;
    (function show() {
      req.innerHTML = '<span class="mono">Illustrative simulation · ' + (i + 1) + ' of ' + REQ.length + '</span>' + REQ[i];
      if (i === AT_AGENT && typeof n !== 'number' && cur === 'systems') lensRipple({ strength: 0.6 });
      if (typeof n !== 'number' && i < REQ.length - 1) { i++; reqTimer = setTimeout(show, 1000); }
    })();
  }
  function playRequest(n) {
    var hasArch = arch && typeof arch.play === 'function';
    if (hasArch) {
      try {
        if (typeof n === 'number' && typeof arch.showStep === 'function') arch.showStep(n + 1);
        else arch.play();
        return;
      } catch (e) { /* fall through to the static captions */ }
    }
    fallbackPlay(n);
  }
  playBtn.addEventListener('click', function () { playRequest(); });
  // the component brings its own 'Send a test request' button and reads ?play=N itself
  var archOn = !!(window.customElements && customElements.get('mv-arch') && arch && typeof arch.play === 'function');
  if (archOn) { playBtn.parentNode.hidden = true; if (stage) { try { arch.stage = stage; } catch (e) { /* optional */ } } }
  var archRip = 0;
  if (arch) arch.addEventListener('mv-arch-change', function (e) {
    var d = e.detail || {};
    clearTimeout(archRip);
    if (!d.playing || d.step !== AT_AGENT + 1 || cur !== 'systems') return;
    archRip = setTimeout(function () {
      var r = archAgentRect();
      if (r && cur === 'systems') ripple(r.left + r.width / 2, r.top + r.height / 2, { strength: 0.6 });
    }, 320);
  });

  // ---- Economics: ?econ=a,b,c is passed to <mv-econ>; its panel may resize, so re-read the glass ----
  if (econ && Q.has('econ') && /^[0-9.]+,[0-9.]+,[0-9.]+$/.test(Q.get('econ')) && econ.getAttribute('values') !== Q.get('econ')) econ.setAttribute('values', Q.get('econ'));
  if (econ) econ.addEventListener('mv-econ-change', function () { if (stage) stage.sync({ instant: true }); });

  var rz = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (stage) { stage.resize(); if (stage.rescan) stage.rescan(); }
      go(cur, { instant: true, noHash: true });
    }, 60);
  });

  // ---- first frame: synchronous, final state (headless captures freeze rAF) ----
  var start = location.hash.slice(1);
  if (ALIAS[start]) { start = ALIAS[start]; history.replaceState(null, '', '#' + start); }
  if (stage && stage.rescan) stage.rescan();   // the optional components rendered before the stage read the DOM
  go(CH.indexOf(start) >= 0 ? start : 'overview', { instant: true, noHash: true });
  showDetail(0);
  function captureHelpers() { // ?off=mandate  ?drop=x,y  ?play=N  ?scan=N  (review captures only)
    if (Q.has('off')) {
      var t0 = tgs.filter(function (t) { return t.getAttribute('data-key') === Q.get('off'); })[0];
      if (t0 && t0.getAttribute('aria-checked') !== 'false') { setControl(t0, false); if (stage && stage.settleSectors) stage.settleSectors(); }
    }
    if (Q.has('hover')) { var h = +Q.get('hover'); if (tgs[h]) showDetail(h); }
    if (Q.has('drop') && stage) { var xy = Q.get('drop').split(','); stage.pointer(+xy[0], +xy[1], true); }
    if (Q.has('play') && cur === 'systems' && !archOn) fallbackPlay(Math.max(0, Math.min(REQ.length - 1, (+Q.get('play') || 1) - 1)));
  }
  captureHelpers();
  // transitions start only after the first painted frame, so the first frame is always the final state
  requestAnimationFrame(function () { requestAnimationFrame(function () { body.classList.remove('boot'); }); });
  var helped = false;
  function relayout() {
    if (stage && stage.rescan) stage.rescan();
    go(cur, { instant: true, noHash: true });
    if (!helped || !Q.has('play')) captureHelpers();
    helped = true;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  window.addEventListener('load', relayout);
})();
