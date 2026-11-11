/* <mv-econ>: the Economics chapter's oversight-cost calculator (brief section 4).
   Light DOM only, rendered synchronously in connectedCallback so stage.js finds the frost root ([data-glass]
   data-glass-variant="frost") with querySelectorAll at init. No currency anywhere: the output is hours and people.
   Attribute: values="actions,saves,minutes,share" (default "4000,3,2,5"), each clamped and snapped to its slider's
   range and step; a three-number v8 value is read as actions,minutes,share with the default saving. Without the
   attribute, ?econ= is honoured (capture param). User input is reflected back to it.
   Properties: .values (get [a, s, m, r]; set an array or "a,b,c,d"), .result (the last computed numbers),
   .stage = <MonovusStage instance> (optional; the component then calls stage.sync() itself after a change).
   Event (bubbling): 'mv-econ-change' {actions, saves, minutes, share, gainHours, personHours, systemHours, netPerson,
   netSystem, savedHours, people, source} with source 'input' or 'attribute'.
   Maths (v9): gain = actions x saves / 60; checking = actions x minutes / 60; exceptions = checking x share. Each
   rounds to whole hours. Net = gain minus oversight, per way of working; below zero, oversight costs more than the
   agent saves (shown in shu). Saved = checking minus exceptions; people = saved / 160, one decimal.
   Defaults give gain 200, checking 133 (net 67), exceptions 7 (net 193), saved 126, 0.8 people. */
(function () {
  'use strict';
  if (!window.customElements || customElements.get('mv-econ')) return;

  var HOURS_PER_PERSON = 160;
  var NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  function fmt(v) { return NF.format(v); }
  var FIELDS = [
    { k: 'actions', label: 'Actions a month', min: 500, max: 20000, step: 500, def: 4000,
      show: fmt, say: function (v) { return fmt(v) + ' actions a month'; } },
    { k: 'saves', label: 'Minutes it saves per action', min: 0.5, max: 15, step: 0.5, def: 3,
      show: fmt, say: function (v) { return fmt(v) + (v === 1 ? ' minute' : ' minutes') + ' saved per action'; } },
    { k: 'minutes', label: 'Minutes to check one', min: 0.5, max: 10, step: 0.5, def: 2,
      show: fmt, say: function (v) { return fmt(v) + (v === 1 ? ' minute' : ' minutes') + ' to check one'; } },
    { k: 'share', label: 'Share a person reviews', min: 1, max: 25, step: 1, def: 5,
      show: function (v) { return v + '%'; }, say: function (v) { return v + ' percent reviewed by a person'; } }
  ];
  var Q = new URLSearchParams(location.search);
  var uid = 0;

  function snap(v, f) {
    v = parseFloat(v);
    if (!isFinite(v)) return f.def;
    v = Math.min(f.max, Math.max(f.min, v));
    return +(Math.round((v - f.min) / f.step) * f.step + f.min).toFixed(2);
  }
  function parse(list) {
    var parts = Array.isArray(list) ? list.slice() : String(list == null ? '' : list).split(',');
    // a v8 value has three numbers (actions, minutes, share): keep its meaning, with the default saving
    if (parts.length === 3) parts.splice(1, 0, '');
    return FIELDS.map(function (f, i) { return snap(parts[i] === '' || parts[i] == null ? NaN : parts[i], f); });
  }
  function compute(v) {
    var gain = Math.round(v[0] * v[1] / 60), exact = v[0] * v[2] / 60;
    var ph = Math.round(exact), sh = Math.round(exact * v[3] / 100), saved = ph - sh;
    return { actions: v[0], saves: v[1], minutes: v[2], share: v[3], gainHours: gain, personHours: ph, systemHours: sh,
      netPerson: gain - ph, netSystem: gain - sh, savedHours: saved, people: Math.round(saved / HOURS_PER_PERSON * 10) / 10 };
  }
  function h(tag, cls, attrs, kids) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function MvEcon() { return Reflect.construct(HTMLElement, [], MvEcon); }
  MvEcon.prototype = Object.create(HTMLElement.prototype);
  MvEcon.prototype.constructor = MvEcon;
  Object.setPrototypeOf(MvEcon, HTMLElement);
  MvEcon.observedAttributes = ['values'];

  MvEcon.prototype.connectedCallback = function () {
    if (this._built) return;
    this._built = true;
    this._id = 'mve' + (++uid);
    var start = this.getAttribute('values') || Q.get('econ') || '';
    this._v = parse(start);
    this._render();
    this._update('init');
  };

  MvEcon.prototype.attributeChangedCallback = function (name, old, val) {
    if (!this._built || this._reflecting || name !== 'values') return;
    this._v = parse(val || '');
    this._update('attribute');
  };

  Object.defineProperty(MvEcon.prototype, 'values', {
    get: function () { return (this._v || parse('')).slice(); },
    set: function (list) { this.setAttribute('values', parse(list).join(',')); }
  });
  Object.defineProperty(MvEcon.prototype, 'result', {
    get: function () { return compute(this._v || parse('')); }
  });

  MvEcon.prototype._render = function () {
    var self = this, id = this._id;
    this.textContent = '';
    this._inputs = []; this._outs = [];
    var rows = FIELDS.map(function (f, i) {
      var iid = id + '-' + f.k;
      var input = h('input', 'mve__range', { id: iid, type: 'range', min: f.min, max: f.max, step: f.step, value: self._v[i] });
      var out = h('output', 'mve__val', { 'for': iid, 'aria-hidden': 'true' });
      input.addEventListener('input', function () {
        self._v[i] = snap(input.value, f);
        self._update('input');
      });
      self._inputs.push(input); self._outs.push(out);
      return h('div', 'mve__in', null, [
        h('div', 'mve__row', null, [h('label', 'mve__lab', { 'for': iid }, [f.label]), out]),
        input
      ]);
    });
    function bar(kind, label) {
      var num = h('b'), fill = h('i'), det = h('span', 'mve__det');
      var row = h('div', 'mve__bar mve__bar--' + kind, null, [
        h('div', 'mve__row', null, [
          h('span', 'mve__bl', null, [label]),
          h('span', 'mve__bv', null, [num, ' hours a month'])
        ]),
        h('div', 'mve__track', { 'aria-hidden': 'true' }, [fill]),
        det
      ]);
      return { row: row, num: num, fill: fill, det: det };
    }
    this._person = bar('person', 'Every action checked by a person');
    this._system = bar('system', 'Rules enforced by the system; people review exceptions');
    this._saved = h('b'); this._people = h('b');
    this._live = h('p', 'mve__sr', { 'aria-live': 'polite' });
    this._root = h('div', 'mve frost', { 'data-glass': '', 'data-glass-variant': 'frost', role: 'group', 'aria-labelledby': id + '-tag' }, [
      h('p', 'mve__tag', { id: id + '-tag' }, ['Illustrative simulation']),
      h('div', 'mve__inputs', null, rows),
      h('div', 'mve__bars', null, [h('p', 'mve__head', null, ['Time the agent gives back, after oversight']),
        this._person.row, this._system.row]),
      h('p', 'mve__saved', null, ['Review time saved: ', this._saved, ' hours a month, about ', this._people, ' full-time people']),
      this._live
    ]);
    this.appendChild(this._root);
  };

  MvEcon.prototype._update = function (source) {
    var self = this, v = this._v, r = compute(v);
    FIELDS.forEach(function (f, i) {
      var input = self._inputs[i];
      if (+input.value !== v[i]) input.value = v[i];
      input.setAttribute('aria-valuetext', f.say(v[i]));
      input.style.setProperty('--p', ((v[i] - f.min) / (f.max - f.min)).toFixed(4));
      self._outs[i].textContent = f.show(v[i]);
    });
    // bars share one scale: what the agent saves, and at least one full-time person (160 h)
    var scale = Math.max(r.gainHours, HOURS_PER_PERSON);
    function show(b, net, spent, verb) {
      b.num.textContent = (net < 0 ? '\u2212' : '') + fmt(Math.abs(net));
      b.row.classList.toggle('is-neg', net < 0);
      b.fill.style.width = (Math.max(net, 0) / scale * 100).toFixed(2) + '%';
      // a bar at or below zero is empty, not a stub
      b.fill.style.minWidth = net > 0 ? '' : '0';
      b.det.textContent = net < 0 ? 'Checking costs more time than the agent saves'
        : fmt(r.gainHours) + ' saved, minus ' + fmt(spent) + ' ' + verb;
    }
    show(this._person, r.netPerson, r.personHours, 'checking');
    show(this._system, r.netSystem, r.systemHours, 'on exceptions');
    this._saved.textContent = fmt(r.savedHours);
    this._people.textContent = r.people.toFixed(1);
    if (source === 'init') return;
    if (source === 'input') {
      this._reflecting = true;
      this.setAttribute('values', v.join(','));
      this._reflecting = false;
    }
    clearTimeout(this._liveT);
    this._liveT = setTimeout(function () {
      self._live.textContent = 'Every action checked by a person: ' + fmt(r.netPerson) + ' hours a month back. ' +
        'Rules enforced by the system: ' + fmt(r.netSystem) + ' hours a month back. Review time saved: ' +
        fmt(r.savedHours) + ' hours a month, about ' + r.people.toFixed(1) + ' full-time people.';
    }, 700);
    if (this.stage && this.stage.sync) this.stage.sync();
    var detail = { source: source };
    Object.keys(r).forEach(function (k) { detail[k] = r[k]; });
    this.dispatchEvent(new CustomEvent('mv-econ-change', { bubbles: true, detail: detail }));
  };

  customElements.define('mv-econ', MvEcon);
})();
