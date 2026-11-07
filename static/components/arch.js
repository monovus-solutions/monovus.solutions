/* <mv-arch>: the Launch chapter's AWS architecture (brief section 4).
   Light DOM only, rendered synchronously in connectedCallback so stage.js finds the [data-glass] pills and the
   [data-lens] bead with querySelectorAll at init.
   API: play(), stop(), agentRect(), layout(), showStep(n), .stage = <MonovusStage instance> (optional; the
   component then calls stage.sync() itself). Events (bubbling): 'mv-arch-change' {step, node, playing}.
   Attributes: mode="auto|diagram|list" (?m=1 forces list), play="N" (?play=N freezes step N, 1-based). */
(function () {
  'use strict';
  if (!window.customElements || customElements.get('mv-arch')) return;

  var SRC = (document.currentScript && document.currentScript.src) || '';
  var ICON_BASE = SRC ? new URL('../assets/aws/', SRC).href : 'assets/aws/';
  var Q = new URLSearchParams(location.search);
  var SVGNS = 'http://www.w3.org/2000/svg';

  var ICONS = {
    cognito: 'Arch_Amazon-Cognito_48.svg',
    agentcore: 'Arch_Amazon-Bedrock-AgentCore_48.svg',
    bedrock: 'Arch_Amazon-Bedrock_48.svg',
    lambda: 'Arch_AWS-Lambda_48.svg',
    secrets: 'Arch_AWS-Secrets-Manager_48.svg',
    cloudwatch: 'Arch_Amazon-CloudWatch_48.svg',
    cloudtrail: 'Arch_AWS-CloudTrail_48.svg',
    budgets: 'Arch_AWS-Budgets_48.svg',
    account: 'AWS-Account_32.svg'
  };

  var GROUPS = [
    { g: 'path', title: 'The agent\u2019s path', ordered: true },
    { g: 'tools', title: 'What it may do' },
    { g: 'watch', title: 'Watched and recorded' }
  ];

  var NODES = [
    { k: 'app', g: 'out', label: 'Your app', sub: 'Website, chat or help desk', icons: [],
      why: 'Requests start where your customers already are.' },
    { k: 'signin', g: 'path', label: 'Sign-in', aws: ['Amazon Cognito'], icons: ['cognito'],
      why: 'The agent knows who is asking.' },
    { k: 'agent', g: 'path', label: 'The agent', aws: ['AgentCore Runtime'], icons: ['agentcore'],
      why: 'Runs in its own isolated session.' },
    { k: 'guard', g: 'path', label: 'Guardrails', aws: ['Amazon Bedrock Guardrails'], icons: ['bedrock'],
      why: 'Blocks unsafe or off-topic answers.' },
    { k: 'models', g: 'path', label: 'Models', aws: ['Amazon Bedrock'], icons: ['bedrock'],
      why: 'Small model first, large model only when needed.' },
    { k: 'tools', g: 'tools', label: 'Tools', aws: ['AgentCore Gateway', 'AWS Lambda'], icons: ['agentcore', 'lambda'],
      why: 'Your systems, exposed as approved tools.' },
    { k: 'policy', g: 'tools', label: 'Mandate', aws: ['AgentCore Policy'], icons: ['agentcore'],
      why: 'Checks every action against your rules.' },
    { k: 'identity', g: 'tools', label: 'Identity', aws: ['AgentCore Identity', 'AWS Secrets Manager'],
      icons: ['agentcore', 'secrets'], why: 'Acts as a named role. Keys never sit in code.' },
    { k: 'memory', g: 'tools', label: 'Memory', aws: ['AgentCore Memory'], icons: ['agentcore'],
      why: 'Remembers context for each user.' },
    { k: 'traces', g: 'watch', label: 'Record', aws: ['AgentCore Observability', 'Amazon CloudWatch'],
      icons: ['agentcore', 'cloudwatch'], why: 'Every step, traced.' },
    { k: 'audit', g: 'watch', label: 'Evidence', aws: ['AWS CloudTrail'], icons: ['cloudtrail'],
      why: 'Who did what, and when.' },
    { k: 'budgets', g: 'watch', label: 'Budget', aws: ['AWS Budgets'], icons: ['budgets'],
      why: 'Alarms at 50%, 80% and 100% of budget.' },
    { k: 'evals', g: 'watch', label: 'Review', aws: ['AgentCore Evaluations'], icons: ['agentcore'], wrap: true,
      why: 'No release ships below the bar.' }
  ];

  // The test request (Illustrative simulation). go: bead waypoints; lift: nodes raised; seg: wires lit (cumulative).
  var STEPS = [
    { t: 'A customer asks to refund order 4471.', go: ['app'], lift: ['app'], seg: [], ms: 950 },
    { t: 'Signed in. The agent acts for this customer only.', go: ['signin'], lift: ['signin'],
      seg: ['app-signin'], ms: 950 },
    { t: 'Checked: safe and on topic.', go: ['agent', 'guard'], lift: ['guard'],
      seg: ['signin-agent', 'agent-guard'], ms: 1000 },
    { t: 'A small model handles it. Cost $0.003.', go: ['models'], lift: ['models'], seg: ['guard-models'], ms: 950 },
    { t: 'Refund tool runs. Mandate: over $500 needs a person. This one is $86: allowed.',
      go: ['agent', 'spine', 'bus:tools', 'tools'], lift: ['tools', 'policy'],
      seg: ['spine', 'bus-l', 'drop-tools', 'drop-policy'], ms: 1450 },
    { t: 'Remembers the order for the rest of the chat.', go: ['bus:tools', 'bus:memory', 'memory'],
      lift: ['memory'], seg: ['bus-r', 'drop-memory'], ms: 1000 },
    { t: 'Refund of $86 confirmed in 1.8 s.', go: ['bus:memory', 'spine', 'agent', 'app'], lift: ['app'],
      seg: [], ms: 1150 },
    { t: 'Every step traced and logged. Budget 41% used.', go: [], hide: true, lift: ['traces', 'audit', 'budgets'],
      seg: ['band'], ms: 1700 }
  ];

  var IDLE_CAPTION = 'Point at a part to see what it does.';
  var uid = 0;

  function h(tag, cls, attrs, kids) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (Array.isArray(attrs)) { kids = attrs; attrs = null; }
    if (attrs) Object.keys(attrs).forEach(function (a) { el.setAttribute(a, attrs[a]); });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function icon(name, size) {
    var img = h('img', 'mva__icon', { src: ICON_BASE + ICONS[name], width: String(size), height: String(size), alt: '', decoding: 'sync' });
    img.draggable = false;
    return img;
  }
  function mql(q) { return window.matchMedia ? matchMedia(q) : { matches: false, addEventListener: function () {} }; }

  function MvArch() { return Reflect.construct(HTMLElement, [], MvArch); }
  MvArch.prototype = Object.create(HTMLElement.prototype);
  MvArch.prototype.constructor = MvArch;
  Object.setPrototypeOf(MvArch, HTMLElement);

  MvArch.prototype.connectedCallback = function () {
    if (this._built) { this.layout(); return; }
    this._built = true;
    this._id = 'mva' + (++uid);
    this._timers = [];
    this._playing = false;
    this._step = 0;
    this._render();
    this._bind();
    this._applyMode();
    this.layout();
    var freeze = parseInt(this.getAttribute('play') || Q.get('play') || '', 10);
    if (freeze >= 1 && freeze <= STEPS.length) this.showStep(freeze);
  };

  MvArch.prototype.disconnectedCallback = function () {
    this._clearTimers();
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
  };

  MvArch.prototype._render = function () {
    var self = this, id = this._id;
    this.nodes = {};
    this.textContent = '';

    function nodeEl(n) {
      var isAgent = n.k === 'agent';
      var text = h('span', 'mva__text', null, [
        h('span', 'mva__label', null, [n.label]),
        n.aws ? h('span', 'mva__aws' + (n.wrap ? ' mva__aws--wrap' : ''), null, n.aws.map(function (a) { return h('span', 'mva__svc', null, [a]); }))
              : h('span', 'mva__sub', null, [n.sub]),
        h('span', 'mva__why', null, [n.why])
      ]);
      var icons = n.icons.length ? h('span', 'mva__icons', { 'aria-hidden': 'true' },
        n.icons.map(function (i) { return icon(i, 26); })) : null;
      var el;
      if (isAgent) {
        // the node IS the empty round socket; the page places its lens on agentRect()
        el = h('div', 'mva__node mva__node--agent mva__socket', { tabindex: '0', 'data-node': 'agent' }, [
          h('span', 'mva__agentlab', null, [icons, text])
        ]);
      } else {
        el = h('div', 'mva__node mva__node--' + n.k, {
          tabindex: '0', 'data-node': n.k, 'data-glass': '', 'data-glass-variant': 'frost'
        }, [icons, text]);
      }
      self.nodes[n.k] = el;
      return h('li', 'mva__item mva__item--' + n.k, null, [el]);
    }

    var app = h('div', 'mva__out', null, [
      h('ul', 'mva__list mva__list--out', { 'aria-label': 'Outside your account' },
        NODES.filter(function (n) { return n.g === 'out'; }).map(nodeEl))
    ]);

    var groups = GROUPS.map(function (G) {
      var hid = id + '-' + G.g;
      var list = h(G.ordered ? 'ol' : 'ul', 'mva__list mva__row mva__row--' + G.g, { 'aria-labelledby': hid },
        NODES.filter(function (n) { return n.g === G.g; }).map(nodeEl));
      return h('section', 'mva__group mva__group--' + G.g, { 'data-group': G.g }, [
        h('h4', 'mva__gh', { id: hid }, [G.title]), list
      ]);
    });

    var slab = h('section', 'mva__slab', { 'data-slab': '', 'aria-labelledby': id + '-acct' },
      [h('h3', 'mva__acct', { id: id + '-acct' }, [icon('account', 20), h('span', null, ['Your AWS account'])])].concat(groups));

    this._wires = document.createElementNS(SVGNS, 'svg');
    this._wires.setAttribute('class', 'mva__wires');
    this._wires.setAttribute('aria-hidden', 'true');
    this._wires.setAttribute('focusable', 'false');

    // data-inner + moss tint: the stage draws the bead as nested glass, so it stays visible on top of a pill
    this._bead = h('span', 'mva__bead', { 'data-lens': '', 'data-inner': '', 'data-tint': 'moss', 'data-present': '0', 'aria-hidden': 'true' });

    var fig = h('div', 'mva__fig', null, [this._wires, app, slab, this._bead]);

    this._btn = h('button', 'mva__play', { type: 'button' }, [
      h('span', 'mva__tri', { 'aria-hidden': 'true' }), h('span', 'mva__playt', null, ['Send a test request'])
    ]);
    this._eyebrow = h('span', 'mva__eyebrow', null, ['Illustrative simulation']);
    this._cap = h('span', 'mva__cap', null, [IDLE_CAPTION]);
    this._live = h('p', 'mva__sr', { 'aria-live': 'polite' });
    var bar = h('div', 'mva__bar', null, [
      this._btn,
      h('p', 'mva__capbox', { 'aria-hidden': 'true' }, [this._eyebrow, this._cap]),
      this._live
    ]);

    var steps = h('section', 'mva__steps', { 'aria-labelledby': id + '-req' }, [
      h('h4', 'mva__gh', { id: id + '-req' }, [
        h('span', null, ['A test request']), h('span', 'mva__simtag', null, ['Illustrative simulation'])
      ]),
      h('ol', 'mva__list mva__steplist', null, STEPS.map(function (s, i) {
        return h('li', 'mva__stepi', null, [h('span', 'mva__stepn', { 'aria-hidden': 'true' }, [String(i + 1)]), h('span', null, [s.t])]);
      }))
    ]);

    this._root = h('div', 'mva', { role: 'group', 'aria-label': 'How one request runs inside your AWS account' },
      [fig, bar, steps]);
    this._fig = fig;
    this._slab = slab;
    this.appendChild(this._root);
  };

  MvArch.prototype._bind = function () {
    var self = this;
    Object.keys(this.nodes).forEach(function (k) {
      var el = self.nodes[k];
      var n = NODES.filter(function (x) { return x.k === k; })[0];
      function on() { if (!self._playing) self._hover(n, true); }
      function off() { if (!self._playing) self._hover(n, false); }
      el.addEventListener('pointerenter', on);
      el.addEventListener('pointerleave', off);
      el.addEventListener('focus', on);
      el.addEventListener('blur', off);
    });
    this._btn.addEventListener('click', function () { if (self._playing) self.stop(); else self.play(); });
    this.addEventListener('keydown', function (e) { if (e.key === 'Escape' && self._playing) self.stop(); });
    var re = function () { self._applyMode(); self.layout(); };
    this._mqPhone = mql('(max-width: 760px)');
    this._mqReduce = mql('(prefers-reduced-motion: reduce)');
    [this._mqPhone, this._mqReduce].forEach(function (m) {
      if (m.addEventListener) m.addEventListener('change', re); else if (m.addListener) m.addListener(re);
    });
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self.layout(); });
      this._ro.observe(this._fig);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { self.layout(); self._sync(); });
  };

  MvArch.prototype._applyMode = function () {
    var attr = this.getAttribute('mode') || 'auto';
    var list = attr === 'list' || (attr === 'auto' && (Q.get('m') === '1' || this._mqPhone.matches || this._mqReduce.matches));
    if (attr === 'diagram') list = false;
    var mode = list ? 'list' : 'diagram';
    if (this._mode === mode) return;
    if (list && this._playing) this.stop();
    this._mode = mode;
    this._root.setAttribute('data-mode', mode);
    this._btn.hidden = list;
  };

  // geometry relative to the figure box
  MvArch.prototype._box = function (el) {
    var f = this._fig.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { l: r.left - f.left, t: r.top - f.top, r: r.right - f.left, b: r.bottom - f.top,
      w: r.width, h: r.height, cx: r.left - f.left + r.width / 2, cy: r.top - f.top + r.height / 2 };
  };

  MvArch.prototype.layout = function () {
    if (!this._fig) return;
    var svg = this._wires;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    this._pts = {};
    if (this._mode === 'list') { this._fig.style.removeProperty('--mva-app-top'); return; }
    var N = this.nodes, B = {}, self = this;
    // align "Your app" with the path row's centre line
    var s0 = this._box(N.agent), a0 = this._box(N.app);
    var pad = parseFloat(this._fig.style.getPropertyValue('--mva-app-top')) || 0;
    var appTop = Math.max(0, Math.round(s0.cy - a0.h / 2 - (a0.t - pad)));
    this._fig.style.setProperty('--mva-app-top', appTop + 'px');
    Object.keys(N).forEach(function (k) { B[k] = self._box(N[k]); });
    var fb = this._fig.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + Math.round(fb.width) + ' ' + Math.round(fb.height));
    svg.setAttribute('width', Math.round(fb.width));
    svg.setAttribute('height', Math.round(fb.height));

    var y = B.agent.cy, lab = this._box(N.agent.querySelector('.mva__agentlab'));
    var tools = ['tools', 'policy', 'identity', 'memory'];
    var busY = Math.round(B.tools.t - 12);
    if (lab.b + 10 > busY) busY = Math.round(lab.b + 10);
    var spineTop = lab.b + 6;
    function seg(id, d) {
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('data-seg', id);
      p.setAttribute('class', 'mva__wire');
      svg.appendChild(p);
    }
    function hl(a, b) { return 'M' + (a.r + 3) + ' ' + y + 'H' + (b.l - 3); }
    seg('app-signin', hl(B.app, B.signin));
    seg('signin-agent', hl(B.signin, B.agent));
    seg('agent-guard', hl(B.agent, B.guard));
    seg('guard-models', hl(B.guard, B.models));
    seg('spine', 'M' + B.agent.cx + ' ' + spineTop + 'V' + busY);
    seg('bus-l', 'M' + B.agent.cx + ' ' + busY + 'H' + B.tools.cx);
    seg('bus-r', 'M' + B.agent.cx + ' ' + busY + 'H' + B.memory.cx);
    tools.forEach(function (k) { seg('drop-' + k, 'M' + B[k].cx + ' ' + busY + 'V' + (B[k].t - 3)); });
    var dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('cx', B.agent.cx); dot.setAttribute('cy', busY); dot.setAttribute('r', '2.25');
    dot.setAttribute('class', 'mva__joint'); dot.setAttribute('data-seg', 'spine');
    svg.appendChild(dot);

    var P = this._pts;
    Object.keys(B).forEach(function (k) { P[k] = [B[k].cx, B[k].cy]; });
    P.spine = [B.agent.cx, busY];
    P['bus:tools'] = [B.tools.cx, busY];
    P['bus:memory'] = [B.memory.cx, busY];
    this._lit();
    if (this._beadAt) this._placeBead(this._beadAt, true);
  };

  // a lift is a CSS rise; the stage re-reads rects every frame while it runs, so glass and text move together
  MvArch.prototype._follow = function (ms) {
    var st = this.stage, self = this, end = performance.now() + ms;
    if (!st || typeof st.sync !== 'function' || this._following) return;
    this._following = true;
    (function tick() {
      st.sync();
      if (performance.now() < end) requestAnimationFrame(tick); else self._following = false;
    })();
  };

  MvArch.prototype._sync = function () {
    var st = this.stage;
    if (st && typeof st.sync === 'function') st.sync();
    this.dispatchEvent(new CustomEvent('mv-arch-change', { bubbles: true,
      detail: { step: this._step, playing: this._playing, node: this._hoverKey || null } }));
  };

  MvArch.prototype._hover = function (n, on) {
    var el = this.nodes[n.k];
    el.classList.toggle('is-lift', on);
    this._hoverKey = on ? n.k : null;
    if (on) {
      this._eyebrow.textContent = n.aws ? n.aws.join(' \u00b7 ') : n.label;
      this._cap.textContent = n.why;
      this._root.setAttribute('data-cap', 'node');
    } else {
      this._eyebrow.textContent = 'Illustrative simulation';
      this._cap.textContent = IDLE_CAPTION;
      this._root.removeAttribute('data-cap');
    }
    this._follow(520);
    this._sync();
  };

  MvArch.prototype._clearTimers = function () { this._timers.forEach(clearTimeout); this._timers = []; };
  MvArch.prototype._later = function (fn, ms) { this._timers.push(setTimeout(fn, ms)); };

  MvArch.prototype._lit = function () {
    var on = this._segs || {};
    Array.prototype.forEach.call(this._wires.querySelectorAll('[data-seg]'), function (p) {
      p.classList.toggle('is-on', !!on[p.getAttribute('data-seg')]);
    });
    this._root.classList.toggle('is-band', !!on.band);
  };

  MvArch.prototype._placeBead = function (key, instant) {
    var p = this._pts && this._pts[key];
    if (!p) return;
    this._beadAt = key;
    if (instant) this._bead.classList.add('is-instant');
    this._bead.style.transform = 'translate(' + (p[0] - 7) + 'px,' + (p[1] - 7) + 'px)';
    if (instant) { void this._bead.offsetWidth; this._bead.classList.remove('is-instant'); }
  };

  MvArch.prototype._setLift = function (keys) {
    var self = this;
    Object.keys(this.nodes).forEach(function (k) { self.nodes[k].classList.toggle('is-lift', keys.indexOf(k) >= 0); });
    this._follow(520);
  };

  MvArch.prototype._caption = function (i) {
    var s = STEPS[i - 1];
    this._eyebrow.textContent = 'Illustrative simulation \u00b7 ' + i + ' of ' + STEPS.length;
    this._cap.textContent = s.t;
    this._live.textContent = s.t;
    this._root.setAttribute('data-cap', 'sim');
  };

  // Show step n (1-based) as a still: wires lit up to n, bead at its last waypoint, step n's nodes lifted.
  MvArch.prototype.showStep = function (n) {
    if (this._mode === 'list') return;
    this._clearTimers();
    this._playing = false;
    this._step = n;
    this._segs = {};
    for (var i = 0; i < n; i++) STEPS[i].seg.forEach(function (s) { this._segs[s] = 1; }, this);
    this._root.classList.add('is-playing');
    this._lit();
    var s = STEPS[n - 1];
    var at = s.go.length ? s.go[s.go.length - 1] : (this._beadAt || 'app');
    this._placeBead(at, true);
    this._bead.setAttribute('data-present', s.hide ? '0' : '1');
    this._setLift(s.lift);
    this._caption(n);
    this._sync();
  };

  MvArch.prototype.play = function () {
    if (this._mode === 'list' || !this._pts) return;
    var self = this;
    this.stop(true);
    this._playing = true;
    this._segs = {};
    this._root.classList.add('is-playing');
    this._btn.querySelector('.mva__playt').textContent = 'Stop';
    this._placeBead('app', true);
    var t = 0;
    STEPS.forEach(function (s, i) {
      self._later(function () {
        self._step = i + 1;
        s.seg.forEach(function (k) { self._segs[k] = 1; });
        self._lit();
        self._setLift(s.lift);
        self._caption(i + 1);
        if (s.hide) self._bead.setAttribute('data-present', '0');
        else self._bead.setAttribute('data-present', '1');
        var hop = Math.min(320, (s.ms * 0.7) / Math.max(1, s.go.length));
        s.go.forEach(function (k, j) {
          self._later(function () { self._placeBead(k, false); self._sync(); }, j * hop);
        });
        self._sync();
      }, t);
      t += s.ms;
    });
    this._later(function () { self.stop(); }, t + 300);
    return t + 300;
  };

  MvArch.prototype.stop = function (quiet) {
    this._clearTimers();
    var was = this._playing || this._step;
    this._playing = false;
    this._step = 0;
    this._segs = {};
    if (!this._root) return;
    this._root.classList.remove('is-playing', 'is-band');
    this._lit();
    this._setLift([]);
    this._bead.setAttribute('data-present', '0');
    this._btn.querySelector('.mva__playt').textContent = 'Send a test request';
    this._eyebrow.textContent = 'Illustrative simulation';
    this._cap.textContent = IDLE_CAPTION;
    this._root.removeAttribute('data-cap');
    if (!quiet) this._live.textContent = was ? 'Test request finished.' : '';
    this._sync();
  };

  MvArch.prototype.agentRect = function () {
    var s = this.nodes && this.nodes.agent;
    return s ? s.getBoundingClientRect() : null;
  };

  Object.defineProperty(MvArch.prototype, 'playing', { get: function () { return !!this._playing; } });
  MvArch.STEPS = STEPS;
  MvArch.NODES = NODES;

  customElements.define('mv-arch', MvArch);
})();
