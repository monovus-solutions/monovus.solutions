#!/usr/bin/env python3
"""Verbatim guard for the legal text the published Google OAuth app (NAS Offsite Backup) relies on.

Sections guarded:
  static/pages/privacy.html  "The Monovus backup application" (all four subsections)
  static/pages/privacy.html  "Google API Services Limited Use"
  static/pages/terms.html    "The backup application" (all three subsections)

A section runs from its <h2> to the next <h2>, or to the end of the <section> or <main> that holds it, whichever
comes first. Its text is normalized (tags stripped, entities decoded, whitespace collapsed; block-level tags count
as a space, inline tags as nothing) and must be identical to the same section in `git show <base>:static/pages/...`
(base defaults to HEAD). The links inside the section must be identical too.

Each section's normalized text is also pinned below as a SHA-256. Where the working tree equals the base (CI tests
the commit it checked out), the pin is what catches a changed word. To change the wording on purpose, edit the
page and update PINNED in the same commit, and tell whoever owns the Google OAuth app.

Run: python3 tools/site-checks/check-legal-verbatim.py [--base REF]   (prints PASS per section; exit 1 on any failure)
Standard library only.
"""
import difflib
import hashlib
import os
import re
import subprocess
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# (page, h2 text, expected h3 subsections in order, last sentence the section must end with)
SECTIONS = [
    ("static/pages/privacy.html", "The Monovus backup application",
     ["What it accesses, and why", "What it can actually see", "Where the data goes", "Retention and deletion"],
     "Revoking access invalidates it."),
    ("static/pages/privacy.html", "Google API Services Limited Use", [],
     "or where required by law."),
    ("static/pages/terms.html", "The backup application",
     ["It is a tool, not a managed service", "What stays your responsibility", "Acceptable use"],
     "Do not attempt to use it against a Google account you are not authorised to use."),
]

# sha256 of each section's normalized text, taken from HEAD on 7 Nov 2026 (commit a9732f8)
PINNED = {
    ("static/pages/privacy.html", "The Monovus backup application"):
        "e8608bb70b5695acf17d8f41ed3333338117409307e42a280b079af9485c1f71",
    ("static/pages/privacy.html", "Google API Services Limited Use"):
        "ee50a9b2e3f4c454fd6865bf02ae655b907400f772b461ab2c508405abaed195",
    ("static/pages/terms.html", "The backup application"):
        "2f79d57643aa2b67aeb8d94608c00de73fb1f5dd8d7478a06858dddef94ba230",
}

BLOCK = {"address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt", "figcaption", "figure",
         "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "section",
         "table", "tbody", "td", "th", "thead", "tr", "ul"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


class Section(HTMLParser):
    """Collects the text, links and h3 titles of the section headed by one <h2>."""

    def __init__(self, heading):
        super().__init__(convert_charrefs=True)
        self.heading = heading
        self.stack = []          # open tags
        self.h2_buf = None       # text of the <h2> being read
        self.cand = None         # (stack depth of the enclosing section/main, buffer) of an <h2> being tested
        self.active = False      # inside the wanted section
        self.done = False
        self.found = 0
        self.limit = 0           # stack length at which the enclosing section/main closes
        self.buf, self.links, self.h3s = [], [], []
        self.h3_buf = None

    def _enclosing(self):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i] in ("section", "main", "body"):
                return i
        return 0

    def handle_starttag(self, tag, attrs):
        if tag == "h2":
            if self.active:
                self.active, self.done = False, True
            self.h2_buf = []
            self.cand = (self._enclosing(), len(self.buf), len(self.links))
        if self.active or self.h2_buf is not None:
            if tag in BLOCK:
                self.buf.append(" ")
            if tag == "a":
                self.links.append(dict(attrs).get("href", ""))
            if tag == "h3":
                self.h3_buf = []
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag in self.stack:
            while self.stack:
                if self.stack.pop() == tag:
                    break
        if self.active or self.h2_buf is not None:
            if tag in BLOCK:
                self.buf.append(" ")
            if tag == "h3" and self.h3_buf is not None:
                self.h3s.append(norm("".join(self.h3_buf)))
                self.h3_buf = None
        if tag == "h2" and self.h2_buf is not None:
            text = norm("".join(self.h2_buf))
            if text == self.heading and not self.done:
                self.found += 1
                if self.found == 1:
                    self.active = True
                    self.limit = self.cand[0]
            if not self.active:
                # not the wanted heading: forget what it added
                del self.buf[self.cand[1]:]
                del self.links[self.cand[2]:]
            self.h2_buf = None
        elif self.active and len(self.stack) <= self.limit:
            self.active, self.done = False, True

    def handle_data(self, data):
        if self.h2_buf is not None:
            self.h2_buf.append(data)
        if self.h3_buf is not None:
            self.h3_buf.append(data)
        if self.active or self.h2_buf is not None:
            self.buf.append(data)

    def result(self):
        return norm("".join(self.buf)), list(self.links), list(self.h3s)


def extract(src, heading):
    p = Section(heading)
    p.feed(src)
    p.close()
    text, links, h3s = p.result()
    return (text if p.found else None), links, h3s, p.found


def git_show(base, rel):
    r = subprocess.run(["git", "-C", ROOT, "show", "%s:%s" % (base, rel)], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def word_diff(a, b, limit=6):
    aw, bw = a.split(" "), b.split(" ")
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, aw, bw, autojunk=False).get_opcodes():
        if op != "equal":
            out.append("        %s: base %r -> now %r" % (op, " ".join(aw[max(0, i1 - 3):i2 + 3]),
                                                       " ".join(bw[max(0, j1 - 3):j2 + 3])))
        if len(out) >= limit:
            break
    return out


def main_text(src):
    """Normalized text of a page's <main> (block tags count as a space)."""
    class Main(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.depth, self.buf = 0, []

        def handle_starttag(self, tag, attrs):
            if tag == "main":
                self.depth += 1
            if self.depth and tag in BLOCK:
                self.buf.append(" ")

        def handle_endtag(self, tag):
            if self.depth and tag in BLOCK:
                self.buf.append(" ")
            if tag == "main":
                self.depth -= 1

        def handle_data(self, data):
            if self.depth:
                self.buf.append(data)
    p = Main()
    p.feed(src)
    return norm("".join(p.buf))


def main(argv):
    base = "HEAD"
    if "--base" in argv:
        base = argv[argv.index("--base") + 1]
    if "--page-diff" in argv:
        # every word-level change to the <main> text of each legal page since git <base> (informational, exit 0)
        for rel in sorted({s[0] for s in SECTIONS}):
            old = main_text(git_show(base, rel) or "")
            new = main_text(open(os.path.join(ROOT, rel), encoding="utf-8").read())
            changes = word_diff(old, new, limit=100)
            print("== %s: %d changed spans in <main> since git %s" % (rel, len(changes), base))
            for c in changes:
                print(c)
        return 0
    if "--show" in argv:
        # print the normalized text and sha256 of each section in git <base> (to review or re-pin deliberately)
        for rel, heading, _, _ in SECTIONS:
            text, links, h3s, n = extract(git_show(base, rel) or "", heading)
            print("== %s %r (found %d) h3=%r links=%r" % (rel, heading, n, h3s, links))
            print(text)
            print("sha256 %s\n" % (hashlib.sha256(text.encode("utf-8")).hexdigest() if text else "-"))
        return 0
    bad = 0
    print("Legal verbatim check: current files vs git %s, plus pinned SHA-256" % base)
    for rel, heading, h3_want, last in SECTIONS:
        label = "%-8s %r" % (os.path.basename(rel).split(".")[0], heading)
        problems = []
        old_src = git_show(base, rel)
        path = os.path.join(ROOT, rel)
        new_src = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if old_src is None:
            problems.append("%s is not in git %s" % (rel, base))
        if new_src is None:
            problems.append("%s is missing" % rel)
        if not problems:
            old, old_links, old_h3, _ = extract(old_src, heading)
            new, new_links, new_h3, n_found = extract(new_src, heading)
            if old is None:
                problems.append("heading not found in git %s" % base)
            if new is None:
                problems.append("heading not found in the current file")
            if n_found > 1:
                problems.append("heading appears %d times in the current file" % n_found)
            if old is not None and new is not None:
                for name, text, h3s in (("base", old, old_h3), ("current", new, new_h3)):
                    if h3s != h3_want:
                        problems.append("%s subsections %r, expected %r" % (name, h3s, h3_want))
                    if not text.endswith(last):
                        problems.append("%s section does not end with %r (truncated?)" % (name, last))
                if old != new:
                    problems.append("text differs from git %s:" % base)
                    problems += word_diff(old, new)
                if old_links != new_links:
                    problems.append("links differ: base %r, now %r" % (old_links, new_links))
                sha = hashlib.sha256(new.encode("utf-8")).hexdigest()
                if sha != PINNED[(rel, heading)]:
                    problems.append("sha256 %s does not match the pinned %s" % (sha[:16], PINNED[(rel, heading)][:16]))
        if problems:
            bad += 1
            print("  FAIL  %s" % label)
            for p in problems:
                print("        " + p if not p.startswith("        ") else p)
        else:
            print("  PASS  %s  (%d subsections, %d words, %d links, sha256 %s)" % (
                label, len(new_h3), len(new.split(" ")), len(new_links), sha[:16]))
    print("legal verbatim: %s" % ("PASS" if not bad else "%d of %d sections FAIL" % (bad, len(SECTIONS))))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
