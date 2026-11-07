/* Site-wide settings, read by the contact form and the assessment.
   MONOVUS_FORM_ENDPOINT: a hosted form endpoint that accepts a JSON POST and emails the
   submission to hello@monovus.solutions (e.g. a Formspree form URL such as
   "https://formspree.io/f/xxxxxxx"). Empty = no data leaves the visitor's browser; forms
   fall back to opening the visitor's own email app with the details filled in. */
window.MONOVUS_FORM_ENDPOINT = "";
window.MONOVUS_EMAIL = "hello@monovus.solutions";
