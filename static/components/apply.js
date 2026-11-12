/* <mv-apply>: the Begin screen's early-access request for Control (v9: two fields, work email and the first agent).
   Light DOM only, rendered synchronously in connectedCallback so stage.js finds the frost root ([data-glass]
   data-glass-variant="frost") with querySelectorAll at init. Settings come from ../assets/config.js via window:
   MONOVUS_FORM_ENDPOINT set  -> POST JSON {email, agent, source: "early-access"};
   MONOVUS_FORM_ENDPOINT empty -> open mailto:MONOVUS_EMAIL, subject "Early access to Control", fields in the body.
   Attribute: state="form|sent|error" (sent shows the thank-you, error shows the validation errors; for captures).
   Methods: focusFirst() (the Begin screen's "Apply for early access" button), reset().
   Property: .stage = <MonovusStage instance> (optional; the component calls stage.sync() when its size changes).
   Events (bubbling): 'mv-apply-state' {state}, 'mv-apply-submit' {via: 'endpoint'|'mailto', ok}. */
(function () {
  'use strict';
  if (!window.customElements || customElements.get('mv-apply')) return;

  var FIELDS = [
    { k: 'email', label: 'Work email', type: 'email', auto: 'email', empty: 'Enter your work email.',
      bad: 'Enter an email address like name@example.com.' },
    { k: 'agent', label: 'What will your first agent do?', area: true, empty: 'Tell us what your first agent will do.' }
  ];
  var EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
  var uid = 0;

  function h(tag, cls, attrs, kids) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function mail() { return String(window.MONOVUS_EMAIL || '').trim(); }

  function MvApply() { return Reflect.construct(HTMLElement, [], MvApply); }
  MvApply.prototype = Object.create(HTMLElement.prototype);
  MvApply.prototype.constructor = MvApply;
  Object.setPrototypeOf(MvApply, HTMLElement);
  MvApply.observedAttributes = ['state'];

  MvApply.prototype.connectedCallback = function () {
    if (this._built) return;
    this._built = true;
    this._id = 'mvp' + (++uid);
    this._tried = false;
    this._render();
    this._applyState(this.getAttribute('state'), true);
  };

  MvApply.prototype.attributeChangedCallback = function (name, old, val) {
    if (this._built && !this._reflecting) this._applyState(val, false);
  };

  MvApply.prototype._render = function () {
    var self = this, id = this._id;
    this.textContent = '';
    this._f = {};
    var fields = FIELDS.map(function (f) {
      var fid = id + '-' + f.k, eid = fid + '-err';
      var attrs = { id: fid, name: f.k, required: '', 'aria-describedby': eid, autocomplete: f.auto || 'off' };
      if (f.area) attrs.rows = '3'; else attrs.type = f.type;
      if (f.k === 'email') { attrs.spellcheck = 'false'; attrs.autocapitalize = 'off'; attrs.inputmode = 'email'; }
      var input = h(f.area ? 'textarea' : 'input', 'mvp__input', attrs);
      var err = h('p', 'mvp__err', { id: eid });
      input.addEventListener('input', function () { if (self._tried || input.hasAttribute('aria-invalid')) self._check(f); });
      input.addEventListener('blur', function () { if (self._tried) self._check(f); });
      self._f[f.k] = { input: input, err: err, def: f };
      return h('div', 'mvp__field', null, [h('label', 'mvp__lab', { 'for': fid }, [f.label]), input, err]);
    });
    this._btn = h('button', 'mvp__btn', { type: 'submit' }, ['Apply']);
    this._formErr = h('p', 'mvp__formerr', { role: 'alert' });
    this._form = h('form', 'mvp__form', { novalidate: '', 'aria-labelledby': id + '-t' },
      fields.concat([h('div', 'mvp__actions', null, [this._btn]), this._formErr]));
    this._form.addEventListener('submit', function (e) { e.preventDefault(); self._submit(); });
    this._body = h('div', 'mvp__body', null, [
      h('p', 'mvp__line', null, ['We\u2019re building Control with a small group of companies, each on a real agent in its own AWS account.']),
      this._form
    ]);
    this._sent = h('div', 'mvp__sent', { tabindex: '-1', hidden: '' }, [
      h('span', 'mvp__mark', { 'aria-hidden': 'true' }),
      h('p', 'mvp__thanks', { role: 'status' }, ['Thanks. We\u2019ll reply by email.'])
    ]);
    this._root = h('div', 'mvp frost', { 'data-glass': '', 'data-glass-variant': 'frost' }, [
      h('div', 'mvp__head', null, [
        h('h3', 'mvp__title', { id: id + '-t' }, ['Early access to Control']),
        h('span', 'mvp__tag', null, ['Early access'])
      ]),
      this._body,
      this._sent,
      h('p', 'mvp__note', null, ['We use this only to reply, by email.'])
    ]);
    this.appendChild(this._root);
  };

  // returns true when the field is valid; writes or clears its inline error
  MvApply.prototype._check = function (f) {
    var x = this._f[f.k], v = x.input.value.trim(), msg = '';
    if (!v) msg = f.empty;
    else if (f.k === 'email' && !EMAIL.test(v)) msg = f.bad;
    x.err.textContent = msg;
    if (msg) x.input.setAttribute('aria-invalid', 'true'); else x.input.removeAttribute('aria-invalid');
    return !msg;
  };
  MvApply.prototype._validate = function (focus) {
    var self = this, first = null;
    FIELDS.forEach(function (f) { if (!self._check(f) && !first) first = self._f[f.k].input; });
    if (first && focus) first.focus();
    this._sync();
    return !first;
  };

  MvApply.prototype._data = function () {
    var f = this._f;
    return { email: f.email.input.value.trim(), agent: f.agent.input.value.trim(), source: 'early-access' };
  };

  MvApply.prototype._submit = function () {
    var self = this;
    if (this._busy) return;
    this._tried = true;
    this._formErr.textContent = '';
    if (!this._validate(true)) return;
    var d = this._data(), endpoint = String(window.MONOVUS_FORM_ENDPOINT || '').trim();
    if (!endpoint) {
      var body = 'Work email: ' + d.email + '\nWhat will your first agent do?\n' + d.agent + '\n';
      var url = 'mailto:' + encodeURIComponent(mail()).replace(/%40/g, '@') +
        '?subject=' + encodeURIComponent('Early access to Control') + '&body=' + encodeURIComponent(body);
      this._emit('mv-apply-submit', { via: 'mailto', ok: true });
      window.location.href = url;
      this._applyState('sent', false, true);
      return;
    }
    this._busy = true;
    this._btn.disabled = true;
    this._root.setAttribute('aria-busy', 'true');
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; })
      .then(function () { self._done(); self._emit('mv-apply-submit', { via: 'endpoint', ok: true }); self._applyState('sent', false, true); })
      .catch(function () {
        self._done();
        self._emit('mv-apply-submit', { via: 'endpoint', ok: false });
        self._formErr.textContent = 'That didn\u2019t send. Try again' + (mail() ? ', or email ' + mail() + '.' : '.');
        self._sync();
      });
  };
  MvApply.prototype._done = function () {
    this._busy = false; this._btn.disabled = false; this._root.removeAttribute('aria-busy');
  };

  MvApply.prototype._applyState = function (state, first, focus) {
    state = state === 'sent' || state === 'error' ? state : 'form';
    var sent = state === 'sent';
    this._body.hidden = sent;
    this._sent.hidden = !sent;
    this._root.classList.toggle('is-sent', sent);
    if (state === 'error') { this._tried = true; this._validate(false); }
    if (state === 'form' && !first) {
      var self = this;
      this._tried = false;
      FIELDS.forEach(function (f) { var x = self._f[f.k]; x.err.textContent = ''; x.input.removeAttribute('aria-invalid'); });
    }
    if (this.getAttribute('state') !== state && !first) {
      this._reflecting = true; this.setAttribute('state', state); this._reflecting = false;
    }
    if (sent && focus) this._sent.focus();
    this._sync();
    if (!first) this._emit('mv-apply-state', { state: state });
  };

  MvApply.prototype.focusFirst = function () {
    if (!this._built) return;
    if (!this._sent.hidden) { this._sent.focus(); return; }
    this._f.email.input.focus();
  };
  MvApply.prototype.reset = function () {
    if (!this._built) return;
    this._form.reset();
    this._formErr.textContent = '';
    this._applyState('form', false);
  };

  MvApply.prototype._sync = function () { if (this.stage && this.stage.sync) this.stage.sync(); };
  MvApply.prototype._emit = function (type, detail) { this.dispatchEvent(new CustomEvent(type, { bubbles: true, detail: detail })); };

  customElements.define('mv-apply', MvApply);
})();
