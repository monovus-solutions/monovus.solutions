#!/usr/bin/env python3
"""Words gate for Monovus v8 (brief sections 1 and 7).

Scans the TEXT of index.html, blueprint/index.html and assessment/index.html (text nodes plus visible attributes:
alt, aria-label, title, placeholder, meta content) and the string literals of app.js and components/*.js
(comments and code identifiers are not page text). Bans: the slop list, proof claims, human-touch words,
competitor and other company names, prices on site pages, and "partner" except "design partner".
Asserts: "Illustrative simulation" labels in Economics, Behaviour and Systems; the trademark line on every page;
"In development" next to Control; "aligned with" (never "mapped to") for the Agentic AI Lens.
Pages that do not exist yet are reported, not failed.
Repo version (tools/site-checks/): paths resolve to the repo's static/ from this script's own location, and the scan
also covers pages/privacy.html, pages/terms.html, 404.html and the redirect stubs. The legal pages may name Google
and AWS and may keep the words they already contained on 7 Nov 2026 (LEGAL_ALLOW); any other banned word fails.
The trademark line is required on every full page (not on the redirect stubs).
Run: python3 tools/site-checks/gate-words.py   (exit 1 on any failure)
"""
import glob
import html as htmlmod
import os
import re
import sys
from html.parser import HTMLParser

HERE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
SLOP = [r"boutique", r"world[- ]class", r"premier", r"best[- ]in[- ]class", r"cutting[- ]edge", r"leverag\w*", r"robust\w*",
        r"seamless\w*", r"unlock\w*", r"empower\w*", r"revolutioni[sz]\w*", r"game[- ]changer\w*", r"supercharg\w*",
        r"next[- ]gen\w*", r"mind of its own"]
CLAIMS = [r"aws partner\w*", r"partner network", r"certified", r"certification", r"badges?", r"trusted by",
          r"testimonials?", r"case stud(?:y|ies)", r"clients? logos?"]
# "call" is banned as a human touch ("book a call", "call us"), not as a verb ("economists call it agency costs")
HUMAN = [r"book(?:s|ed|ing)?", r"(?:a|an|our|the|your|discovery|sales|intro|demo|quick|short|free|video|kick-?off|"
         r"scoping|strategy)\s+calls?", r"calls? (?:us|me|with)", r"phone", r"meetings?", r"schedul\w*",
         r"talk to (?:sales|us|an expert)", r"contact sales", r"get in touch"]
COMPANIES = [r"microsoft", r"agent ?365", r"wiz", r"datadog", r"caylent", r"opsguru", r"doit", r"cloudcheckr", r"flexera",
             r"montycloud", r"sierra", r"palantir", r"anthropic", r"slack", r"salesforce", r"openai", r"google"]
PRICES = [r"cad", r"usd", r"per month", r"(?:\$|€|£)\s?\d[\d,.]*\s?k?\s*(?:/\s*mo(?:nth)?|a month|monthly)"]
OTHER = [r"mapped to", r"aws-cloud-logo"]
RULES = [("slop", SLOP), ("claim", CLAIMS), ("human touch", HUMAN), ("company name", COMPANIES), ("price", PRICES),
         ("other", OTHER)]
RES = [(k, re.compile(r"(?<![\w-])(?:" + "|".join(v) + r")(?![\w])", re.I)) for k, v in RULES]
PARTNER = re.compile(r"partner\w*", re.I)
TRADEMARK = ("Amazon Web Services, AWS, Amazon Bedrock and related marks are trademarks of Amazon.com, Inc. or its "
             "affiliates. Monovus is independent and not affiliated with or endorsed by AWS.")


class Text(HTMLParser):
    VISIBLE_ATTRS = {"alt", "aria-label", "title", "placeholder", "content"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.chunks, self.stack, self.skip = [], [], 0
        self.sections = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style"):
            self.skip += 1
        if tag == "section" and "data-chapter" in a:
            self.stack.append(a["data-chapter"])
            self.sections.setdefault(a["data-chapter"], [])
        elif tag == "section":
            self.stack.append(None)
        if tag == "meta" and a.get("name") not in ("description",) and a.get("property") is None:
            return
        for k, v in attrs:
            if k in self.VISIBLE_ATTRS and v:
                self.add(v, "@" + k)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip -= 1
        if tag == "section" and self.stack:
            self.stack.pop()

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.add(data, "text")

    def add(self, s, where):
        self.chunks.append((self.getpos()[0], where, s))
        for ch in self.stack:
            if ch:
                self.sections[ch].append(s)


def js_strings(src):
    """String literals of a JS file, skipping comments. Template literals are read without their ${...} parts."""
    out, i, n, line = [], 0, len(src), 1
    prev = ""
    while i < n:
        c = src[i]
        if c == "\n":
            line += 1
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            line += src.count("\n", i, j)
            i = j
            continue
        if c == "/" and prev in "(,=:[!&|?{};+-*%<>~^" :
            # a regex literal: skip to its closing slash
            j, cls = i + 1, False
            while j < n and src[j] != "\n":
                if src[j] == "\\":
                    j += 2
                    continue
                if src[j] == "[":
                    cls = True
                elif src[j] == "]":
                    cls = False
                elif src[j] == "/" and not cls:
                    break
                j += 1
            i = j + 1
            prev = "x"
            continue
        if c in "'\"`":
            j, buf = i + 1, []
            while j < n and src[j] != c:
                if src[j] == "\\" and j + 1 < n:
                    buf.append(src[j:j + 2])
                    j += 2
                    continue
                if c == "`" and src.startswith("${", j):
                    depth, j = 1, j + 2
                    while j < n and depth:
                        depth += {"{": 1, "}": -1}.get(src[j], 0)
                        j += 1
                    buf.append(" ")
                    continue
                buf.append(src[j])
                j += 1
            text = "".join(buf)
            try:
                text = text.encode("utf-8").decode("unicode_escape").encode("latin-1", "ignore").decode("utf-8", "ignore") \
                    if "\\u" in text else text.replace("\\'", "'").replace('\\"', '"')
            except Exception:
                pass
            out.append((line, text))
            line += src.count("\n", i, j)
            i = j + 1
            prev = "x"
            continue
        if not c.isspace():
            prev = c
        i += 1
    return out


bad = 0


def check(name, ok, note=""):
    global bad
    bad += not ok
    print("  %s  %s%s" % ("PASS" if ok else "FAIL", name, ("  (" + note + ")") if note else ""))


def scan(label, s):
    hits = []
    for kind, rx in RES:
        for m in rx.finditer(s):
            hits.append((label, kind, m.group(0), s.strip()[:90]))
    for m in PARTNER.finditer(s):
        if not re.search(r"design[- ]$", s[:m.start()], re.I):
            hits.append((label, "partner", m.group(0), s.strip()[:90]))
    return hits


STUBS = [os.path.join("pages", f) for f in ("about.html", "how-it-works.html", "use-cases.html", "pricing.html",
                                             "notes.html")] + \
        [os.path.join(d, "index.html") for d in ("about", "contact", "privacy", "terms")]
LEGAL = (os.path.join("pages", "privacy.html"), os.path.join("pages", "terms.html"))
# banned-list words the legal pages already contained when they were restyled (7 Nov 2026): Google and the backup
# application's Google Drive, "CAD" in the liability cap, "schedule" in the paid-engagements clause
LEGAL_ALLOW = {"google", "cad", "schedule"}
# (page, must exist, needs the trademark line)
PAGES = [("index.html", True, True), (os.path.join("blueprint", "index.html"), False, True),
         (os.path.join("assessment", "index.html"), False, True)] + \
        [(rel, True, True) for rel in LEGAL] + [("404.html", True, True)] + [(rel, True, False) for rel in STUBS]
parsed, raw = {}, {}
TM_PAGES = []
for rel, required, trademark in PAGES:
    path = os.path.join(HERE, rel)
    if not os.path.exists(path):
        if required:
            print("FAIL  %s is missing" % rel)
            bad += 1
        else:
            print("note  %s does not exist yet: skipped" % rel)
        continue
    src = open(path, encoding="utf-8").read()
    p = Text()
    p.feed(src)
    parsed[rel], raw[rel] = p, src
    if trademark:
        TM_PAGES.append(rel)

JS_FILES = ["app.js"] + sorted(os.path.relpath(f, HERE) for f in glob.glob(os.path.join(HERE, "components", "*.js")))
strings = []
for rel in JS_FILES:
    for line, s in js_strings(open(os.path.join(HERE, rel), encoding="utf-8").read()):
        strings.append((rel, line, s))

hits = []
for rel, p in parsed.items():
    for line, where, s in p.chunks:
        for h in scan("%s:%d %s" % (rel, line, where), s):
            if rel in LEGAL and h[2].lower() in LEGAL_ALLOW:
                continue
            hits.append(h)
for rel, line, s in strings:
    hits += scan("%s:%d" % (rel, line), s)
print("Banned-word scan: %d text chunks in %s; %d strings in %s" % (
    sum(len(p.chunks) for p in parsed.values()), " + ".join(parsed), len(strings), " + ".join(JS_FILES)))
for h in hits:
    print("  FAIL  %-34s %-12s %-16r in %r" % h)
bad += len(hits)
print("  %s  no banned words" % ("PASS" if not hits else "FAIL"))

print("Page rules:")
p = parsed.get("index.html")
sec = {k: " ".join(v) for k, v in p.sections.items()} if p else {}
JS_TEXT = {rel: " ".join(s for r, _, s in strings if r == rel) for rel in JS_FILES}
# v9 (brief section 2): a cover and four chapters, eight screens; Society, Companies and People became Oversight
check("Eight screens present", all(c in sec for c in ("overview", "oversight", "agents", "economics", "behaviour", "systems",
                                                       "monovus", "begin")))
check("No v8 Society, Companies or People screens", not any(c in sec for c in ("society", "companies", "people")))
check("No Pricing screen", "pricing" not in sec)
for ch, comp in (("economics", "components/econ.js"), ("behaviour", None), ("systems", "components/arch.js")):
    in_page = "Illustrative simulation" in sec.get(ch, "")
    in_comp = bool(comp) and "Illustrative simulation" in JS_TEXT.get(comp, "")
    check("'Illustrative simulation' labels %s" % ch, in_page or in_comp,
          "page" + (" + component" if in_comp else "") if in_page else ("component" if in_comp else "missing"))
check("Simulated request captions labelled in app.js", "Illustrative simulation" in JS_TEXT.get("app.js", ""))
check("Behaviour 'Without it' row tagged 'Simulated'", "Simulated" in sec.get("behaviour", ""))


def norm(t):
    return re.sub(r"\s+", " ", htmlmod.unescape(t))


for rel in TM_PAGES:
    check("Trademark line on %s" % rel, TRADEMARK in norm(" ".join(s for _, _, s in parsed[rel].chunks)))
# Control's honest status next to its name (v9: "early access", which replaced "In development"): the Control column's
# tag on the Begin screen, and the early-access panel when it names Control
ch_m = [s.strip() for _, _, s in p.chunks] if p else []
near = any(t == "Control" and any("early access" in s.lower() for s in ch_m[i + 1:i + 3]) for i, t in enumerate(ch_m))
check("'early access' next to Control (Begin screen)", near)
for rel, txt in JS_TEXT.items():
    if "to Control" in txt or "for Control" in txt:
        check("'Early access' next to Control in %s" % rel, "Early access" in txt)
all_text = [(rel, norm(" ".join(s for _, _, s in q.chunks))) for rel, q in parsed.items()] + list(JS_TEXT.items())
# a page that names the Lens says how it relates to it with "aligned with"; a citation in a sources list may name it
# plainly, but no mention may claim a stronger tie (mapped to, maps to, compliant with, certified against)
lens_ok = True
for rel, t in all_text:
    if "Agentic AI Lens" not in t:
        continue
    if not re.search(r"aligned with the AWS Well-Architected Agentic AI Lens", t, re.I):
        lens_ok = False
        print("        %s names the Lens but never says 'aligned with' it" % rel)
    for m in re.finditer(r"Agentic AI Lens", t):
        ctx = t[max(0, m.start() - 80):m.start()]
        if re.search(r"mapped|maps to|compliant|certified|validated|approved by", ctx, re.I):
            lens_ok = False
            print("        %s: a stronger tie than 'aligned with': %r" % (rel, ctx))
check("'aligned with' the Agentic AI Lens on every page that names it", lens_ok)
check("Never 'mapped to'", not any(re.search(r"mapped to", t, re.I) for _, t in all_text))
check("No AWS logo file referenced in index.html", not re.search(r"AWS-Cloud-logo|aws[-_]logo|smile", raw.get("index.html", ""), re.I))
check("No exclamation marks in page text", not any("!" in s for q in parsed.values() for _, w, s in q.chunks if w == "text"))
sys.exit(1 if bad else 0)
