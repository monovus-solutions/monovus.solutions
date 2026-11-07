#!/usr/bin/env python3
"""Contrast gate for assets/type.css (the Monovus type and colour system, 6 Nov 2026).

Reads the tokens straight from assets/type.css, so a change there is re-checked, and asserts them against the
worst backgrounds the pages use (the same worst cases as gate-contrast.py): paper, the darkest frost pixel, the
darkest raked-field pixel, and the contact shadow under clear glass. Body and caption text must reach 4.5:1 on all
of them; headline ink and the headline gradient's moss end are held to 7:1. Exit code 1 on any failure.
"""
import os
import re
import sys

HERE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")


def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def ratio(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


css = open(os.path.join(HERE, "assets", "type.css"), encoding="utf-8").read()
block = re.search(r"html\[data-type\]\s*\{(.*?)\}", css, re.S).group(1)
tok = dict(re.findall(r"--([\w-]+):\s*(#[0-9A-Fa-f]{6})", block))

GROUNDS = {"paper": "#F3EFE7", "frost (darkest)": "#E9E5DD", "field (darkest)": "#E1DED6",
           "glass contact shadow": "#D7D3CD"}
RULES = [("ink", "headline ink", 7.0), ("ink-deep", "headline gradient end", 7.0), ("ink-2", "body text", 4.5),
         ("muted", "captions and sources", 4.5), ("moss", "kickers and figures", 4.5), ("shu", "off state", 4.5)]

bad = 0
for key, role, need in RULES:
    if key not in tok:
        print(f"  FAIL  --{key} missing from type.css")
        bad += 1
        continue
    for gname, g in GROUNDS.items():
        r = ratio(tok[key], g)
        ok = r >= need
        bad += not ok
        print(f"  {'PASS' if ok else 'FAIL'}  {role:22s} {tok[key]} on {gname:21s} {g}  {r:5.2f}  (>= {need})")
print("type gate:", "PASS" if not bad else f"{bad} FAIL")
sys.exit(1 if bad else 0)
