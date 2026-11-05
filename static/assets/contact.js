/* Monovus contact form. Reads /assets/config.js:
   - MONOVUS_FORM_ENDPOINT set: POST the fields as JSON (Accept: application/json), then thank the visitor.
   - empty: open the visitor's own email app with the fields filled in. Nothing is sent by the site. */
(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;
  var endpoint = String(window.MONOVUS_FORM_ENDPOINT || "").trim();
  var email = window.MONOVUS_EMAIL || "hello@monovus.solutions";
  var status = document.getElementById("form-status");
  var thanks = document.getElementById("form-thanks");
  var mode = document.getElementById("form-mode");
  var button = form.querySelector('button[type="submit"]');
  var LABELS = { name: "Name", email: "Work email", company: "Company", role: "Role",
                 agent: "What the agent does", timeline: "Timeline", message: "Message" };

  if (mode) {
    mode.textContent = endpoint
      ? "Your message is sent to us through our form provider. We reply within one business day."
      : "Sending opens your own email app with these details filled in. Nothing is sent until you press send there.";
  }

  function fields() {
    var d = {};
    Object.keys(LABELS).forEach(function (k) {
      var el = form.elements[k];
      d[k] = el ? String(el.value || "").trim() : "";
    });
    d.consent_privacy = form.elements.consent_privacy.checked;
    d.consent_marketing = form.elements.consent_marketing.checked;
    return d;
  }

  function say(text, ok) {
    status.textContent = text;
    status.className = "form-status " + (ok ? "ok" : "err");
    status.focus();
  }

  function done() {
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus();
  }

  function mailto(d) {
    var lines = Object.keys(LABELS).map(function (k) { return LABELS[k] + ": " + (d[k] || "-"); });
    lines.push("Privacy policy accepted: yes");
    lines.push("Occasional insights by email: " + (d.consent_marketing ? "yes" : "no"));
    return "mailto:" + email + "?subject=" + encodeURIComponent("Enquiry from " + (d.company || d.name)) +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.elements._gotcha && form.elements._gotcha.value) { done(); return; }
    var d = fields();
    if (!endpoint) {
      window.location.href = mailto(d);
      say("Your email app should open with your message ready to send. If it doesn't, email " + email + " directly.", true);
      return;
    }
    button.disabled = true;
    button.textContent = "Sending…";
    var payload = { _subject: "Website enquiry: " + (d.company || d.name), source: "contact" };
    Object.keys(d).forEach(function (k) { payload[k] = d[k]; });
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      done();
    }).catch(function () {
      button.disabled = false;
      button.textContent = "Send";
      say("That didn't go through. Please try again, or email " + email + " directly.", false);
    });
  });
})();
