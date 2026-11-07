#!/usr/bin/env python3
"""Contrast gate for v8/assessment (Readiness Check restyle).
Text >= 4.5:1, bars / borders / focus / non-text controls >= 3:1.
Solves the lightest border colour that clears 3:1, then checks every pair the CSS uses.
Translucent fills are composited over their real ground before measuring."""
import sys

def lum(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def ratio(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)

def rgb(h): return [int(h[i:i+2], 16) for i in (1, 3, 5)]
def hexs(c): return "#%02X%02X%02X" % tuple(max(0, min(255, round(v))) for v in c)
def over(fg, alpha, bg):
    f, b = rgb(fg), rgb(bg)
    return hexs([f[i] * alpha + b[i] * (1 - alpha) for i in range(3)])
def mix(a, b, t):
    x, y = rgb(a), rgb(b)
    return hexs([x[i] + (y[i] - x[i]) * t for i in range(3)])

PAPER, FROST, INK, MUTED, MOSS, SHU, WHITE = "#F3EFE7", "#E9E5DD", "#1C1F1C", "#57554E", "#3F5A30", "#963820", "#FFFFFF"
FIELD_DARK = over("#3C301E", 0.045, PAPER)        # darkest raked-line pixel of the CSS .field
SHEET = "#FDFCF9"                                  # report sheet (solid)
OPTION = over(WHITE, 0.55, FROST)                  # answer card on frost
PICKED = over(MOSS, 0.07, OPTION)                  # chosen answer card
DISABLED = over(INK, 0.08, FROST)                  # disabled Continue button
SHU_TINT = over(SHU, 0.06, FROST)                  # "fix first" panel
TRACK = over(INK, 0.13, FROST)                     # unfilled bar / progress segment
BTN_STOPS = ["#4B6A3A", "#3F5A30", "#37502A"]      # moss button gradient

# Solve: lightest warm grey between muted and paper with >= 3:1 on every surface a border touches.
border_grounds = [FROST, PAPER, WHITE, OPTION, FIELD_DARK, SHEET]
lo, hi = 0.0, 1.0
for _ in range(40):
    t = (lo + hi) / 2
    c = mix(MUTED, PAPER, t)
    if min(ratio(c, g) for g in border_grounds) >= 3.0: lo = t
    else: hi = t
RULE = mix(MUTED, PAPER, lo)
while min(ratio(RULE, g) for g in border_grounds) < 3.0:   # rounding guard
    lo -= 0.002; RULE = mix(MUTED, PAPER, lo)
print("solved --rule  %s  (muted->paper t=%.3f)" % (RULE, lo))
print("derived grounds: field-dark %s  option %s  picked %s  disabled %s  shu-tint %s  track %s" %
      (FIELD_DARK, OPTION, PICKED, DISABLED, SHU_TINT, TRACK))

checks = []  # (label, fg, bg, minimum, must_pass)
for name, g in [("paper", PAPER), ("frost", FROST), ("field-dark", FIELD_DARK), ("sheet", SHEET),
                ("option", OPTION), ("picked", PICKED)]:
    checks.append(("ink text on " + name, INK, g, 4.5, True))
    checks.append(("muted text on " + name, MUTED, g, 4.5, True))
    checks.append(("moss text on " + name, MOSS, g, 4.5, True))
    checks.append(("shu text on " + name, SHU, g, 4.5, True))
checks += [
    ("muted text on disabled button", MUTED, DISABLED, 4.5, True),
    ("shu text on shu-tint panel", SHU, SHU_TINT, 4.5, True),
    ("ink text on shu-tint panel", INK, SHU_TINT, 4.5, True),
    ("white text on shu tag", WHITE, SHU, 4.5, True),
]
for s in BTN_STOPS:
    checks.append(("white text on moss button " + s, WHITE, s, 4.5, True))
for name, g in [("frost", FROST), ("paper", PAPER), ("white input", WHITE), ("option", OPTION), ("sheet", SHEET)]:
    checks.append(("border --rule vs " + name, RULE, g, 3.0, True))
for name, g in [("paper", PAPER), ("frost", FROST), ("field-dark", FIELD_DARK), ("sheet", SHEET), ("track", TRACK), ("option", OPTION)]:
    checks.append(("moss bar/focus/radio vs " + name, MOSS, g, 3.0, True))
for name, g in [("frost", FROST), ("track", TRACK), ("sheet", SHEET)]:
    checks.append(("shu gap bar vs " + name, SHU, g, 3.0, True))
checks.append(("ink value segment vs track", INK, TRACK, 3.0, True))
checks.append(("white radio dot vs moss", WHITE, MOSS, 3.0, True))
# Intended failures: the unfilled track is a decorative backdrop (the value is the fill + the printed number).
checks.append(("track vs frost (decorative, intended < 3)", TRACK, FROST, 3.0, False))
checks.append(("hairline rgba(28,31,28,.12) vs frost (decorative, intended < 3)", over(INK, 0.12, FROST), FROST, 3.0, False))

bad = 0
for label, fg, bg, mn, must in checks:
    r = ratio(fg, bg)
    ok = (r >= mn) == must
    bad += not ok
    print("%-4s %6.2f:1  need %s%.1f  %s on %s  %s" % ("PASS" if ok else "FAIL", r, ">=" if must else "<", mn, fg, bg, label))
print("\n%d checks, %d failing" % (len(checks), bad))
sys.exit(1 if bad else 0)
