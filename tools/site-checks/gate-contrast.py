#!/usr/bin/env python3
"""Contrast gate for Monovus v8 (extends v7 and v6-a).

Mirrors the stage shader's field and glass maths (stage.js) and asserts every text pair against its WORST pixel
(>= 4.5:1), plus the intended failure: the raked lines themselves must stay quiet (< 1.2:1 against the ground).
Uses ratio() from design-systems/monovus/check-contrast.py, as the brief requires.
v7 adds: frost panels (assumed darkest frost pixel #E9E5DD, brief section 6: blur + 18-28 % white), captions,
and shu red for "off", solved here as the lightest shu (same hue as #9E3B22) that passes 4.5:1 on every surface it
sits on. The gate also asserts that styles.css carries exactly the solved value.
v8 adds (brief section 7): the economics sliders (labels, values, track, thumb ring), the design-partner form
(labels, input text, field borders, error text and border), focus rings, the detail panel's "Without it" row,
the tile links and the kickers. Component colours are read from components/econ.css and apply.css, so a change
there re-runs through this gate.
Run: python3 tools/site-checks/gate-contrast.py   (exit 1 on any failure)
Paths resolve to the repo's static/ from this script's own location. Standard library only.
"""
import colorsys
import os
import re
import math
import sys

STATIC = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")


# ratio(): WCAG 2.1 contrast, inlined from design-systems/monovus/check-contrast.py (unchanged maths)
def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def ratio(fg, bg):
    a, b = lum(fg), lum(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)

GROUND = (0.9529, 0.9373, 0.9059)
MOSS = (0.247, 0.353, 0.188)
INK, MUTED, MOSS_HEX, WHITE = "#1C1F1C", "#57554E", "#3F5A30", "#FFFFFF"


def hexof(c):
    return "#" + "".join("%02X" % max(0, min(255, round(v * 255))) for v in c)


def line_extremes(amp=1.0, soft=1.0, dark=0.047, emb=0.0030):
    """Darkest and lightest multipliers/offsets of the line profile (lineShade), sampled across one pitch."""
    s = 0.1 * soft
    lo, hi = None, None
    for i in range(-500, 501):
        u = i / 1000.0
        g = math.exp(-0.5 * u * u / (s * s))
        gp = -u / (s * s) * g
        for facing in (-0.8321, 0.8321):
            k = (1 - g * dark * amp, gp * facing * emb * amp)
            lo = k if lo is None or (k[0] - abs(k[1]) * 0) * 1 + k[1] < lo[0] + lo[1] else lo
            hi = k if hi is None or k[0] + k[1] > hi[0] + hi[1] else hi
    return lo, hi


def field(light, grain, prof, extra_dark=0.0):
    m, add = prof
    return tuple((g * light + grain) * m * (1 - extra_dark) + add for g in GROUND)


lo, hi = line_extremes()
light_min = 1 + 0.024 * (0.42 - 1.0)
light_max = 1 + 0.024 * 0.42
field_dark = field(light_min, -0.006, lo)
field_light = field(light_max, 0.006, hi)
ground_plain = field(light_min, -0.006, (1.0, 0.0))
# agent names sit 16 px under a lens: contact shadow (<= 0.06) and ambient occlusion (<= 0.022)
field_shadow = field(light_min, -0.006, lo, 0.06 + 0.022)
# clear glass pills (dock, toggles): lines softened (amp .72, soft 1.35) + >= 5.5 % white, then the indicator's dish shadow
glo, _ = line_extremes(0.72, 1.35)
g = field(light_min, -0.006, glo)
glass_dark = tuple((v * (1 - 0.055) + 0.055) * (1 - 0.07) for v in g)
# moss button: 0.07 of the lightest glass + 0.93 of moss at its lightest row under the text (|y| <= 0.45 R)
moss_light = tuple(0.07 * 1.0 + 0.93 * m * (1.04 + 0.10 * 0.45) for m in MOSS)
indicator = tuple(v * (1 - 0.43) + 0.43 for v in glass_dark)

FROST = "#E9E5DD"
# a frost panel sits on the field: its darkest pixel is never darker than the assumed value, and the CSS fallback
# tint (>= 42 % white over the darkest field) is lighter still
frost_css = hexof(tuple(v * 0.58 + 0.42 for v in field_dark))
frost_worst = min([FROST, frost_css], key=lambda h: ratio("#000000", h))


def shu_solve(start="#9E3B22", backs=()):
    """Lightest colour on the start's hue/saturation that keeps >= 4.5:1 on every background.
    HLS lightness is searched in 1/2000 steps over [0, 1]; on these light grounds contrast falls as lightness rises,
    so the answer is the last passing step. It may sit above or below the start."""
    r, g, b = (int(start[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, _, sat = colorsys.rgb_to_hls(r, g, b)
    best = None
    for i in range(0, 2001):
        c = hexof(colorsys.hls_to_rgb(h, i / 2000, sat))
        if all(ratio(c, bk) >= 4.5 for bk in backs):
            best = c
    return best


SHU_BACKS = [hexof(field_dark), frost_worst, hexof(glass_dark), hexof(field_shadow)]
SHU = shu_solve(backs=SHU_BACKS)
css = open(os.path.join(STATIC, "styles.css")).read()
m = re.search(r"--shu:\s*(#[0-9A-Fa-f]{6})", css)
SHU_CSS = m.group(1).upper() if m else "missing"
print("shu solved (lightest passing on %s, hue of #9E3B22): %s   styles.css --shu: %s" % (", ".join(SHU_BACKS), SHU, SHU_CSS))

HERE = STATIC


def css_var(fname, name, default):
    """A custom property from a component stylesheet; the documented default when the file is missing."""
    path = os.path.join(HERE, "components", fname)
    if not os.path.exists(path):
        return default, False
    mm = re.search(r"--" + name + r":\s*([^;]+);", open(path).read())
    return (mm.group(1).strip() if mm else default), bool(mm)


def over(color, back):
    """Composite a CSS colour (#hex or rgba()) over an opaque #hex background."""
    color = color.strip()
    if color.startswith("#"):
        return color.upper()
    mm = re.match(r"rgba?\(([^)]+)\)", color)
    parts = [float(x) for x in mm.group(1).replace("/", ",").split(",") if x.strip()]
    a = parts[3] if len(parts) > 3 else 1.0
    bk = [int(back[i:i + 2], 16) for i in (1, 3, 5)]
    return hexof(tuple((parts[k] * a + bk[k] * (1 - a)) / 255 for k in range(3)))


TRACK, t_ok = css_var("econ.css", "mve-track", "#7D796F")
THUMB, _ = css_var("econ.css", "mve-thumb", "#FBFAF7")
LINE, l_ok = css_var("apply.css", "mvp-line", "#7D796F")
FILL, _ = css_var("apply.css", "mvp-fill", "rgba(255, 255, 255, .5)")
FIELD_FILL = over(FILL, frost_worst)
print("components: slider track %s, thumb %s, field border %s, field fill %s -> %s on frost" % (TRACK, THUMB, LINE, FILL, FIELD_FILL))

checks = [
    ("H1 ink on darkest field", INK, hexof(field_dark), 4.5, ">="),
    ("Muted copy on darkest field", MUTED, hexof(field_dark), 4.5, ">="),
    ("Moss 'in order' line on darkest field", MOSS_HEX, hexof(field_dark), 4.5, ">="),
    ("Agent name (ink) in a contact shadow", INK, hexof(field_shadow), 4.5, ">="),
    ("Muted label on clear glass + dish shadow", MUTED, hexof(glass_dark), 4.5, ">="),
    ("Ink label on dock indicator", INK, hexof(indicator), 4.5, ">="),
    ("White on moss button, lightest row", WHITE, hexof(moss_light), 4.5, ">="),
    # v7: frost panels (glance strip, Control detail, Scale fleet, Pricing tiles)
    ("Ink on frost (labels, prices, rows)", INK, frost_worst, 4.5, ">="),
    ("Muted on frost (small lines, mono AWS names)", MUTED, frost_worst, 4.5, ">="),
    ("Moss 'On' state on frost", MOSS_HEX, frost_worst, 4.5, ">="),
    ("Shu 'Off' / 'Rollback off' on frost", SHU_CSS, frost_worst, 4.5, ">="),
    # v7: captions and shu on the field and on clear glass
    ("Mono caption (muted) on darkest field", MUTED, hexof(field_dark), 4.5, ">="),
    ("Instrument label (ink) on darkest field", INK, hexof(field_dark), 4.5, ">="),
    ("Score '62' and caption on the lens (field)", MUTED, hexof(field_dark), 4.5, ">="),
    ("Shu consequence line on darkest field", SHU_CSS, hexof(field_dark), 4.5, ">="),
    ("Shu agent flag in a contact shadow", SHU_CSS, hexof(field_shadow), 4.5, ">="),
    ("Shu switch label on clear glass + dish shadow", SHU_CSS, hexof(glass_dark), 4.5, ">="),
    ("Ink on clear test-request button", INK, hexof(glass_dark), 4.5, ">="),
    ("styles.css --shu is the solved lightest value", SHU_CSS, SHU, 1.0001, "<"),
    ("Non-text: shu hairline vs ground (>= 3:1)", SHU_CSS, hexof(ground_plain), 3.0, ">="),
    ("Non-text: moss rim arc / sector fill vs ground", MOSS_HEX, hexof(field_light), 3.0, ">="),
    # v8: kickers, figures, economics sliders, design-partner form, focus rings, detail and tile links
    ("Kicker (muted mono) on darkest field", MUTED, hexof(field_dark), 4.5, ">="),
    ("Figure '15%' (ink) and line on darkest field", INK, hexof(field_dark), 4.5, ">="),
    ("Slider label (ink) on frost", INK, frost_worst, 4.5, ">="),
    ("Slider value (moss) on frost", MOSS_HEX, frost_worst, 4.5, ">="),
    ("Bar label and 'hours a month' (muted) on frost", MUTED, frost_worst, 4.5, ">="),
    ("Form label (ink) on frost", INK, frost_worst, 4.5, ">="),
    ("Form line and note (muted) on frost", MUTED, frost_worst, 4.5, ">="),
    ("Input text (ink) on field fill", INK, FIELD_FILL, 4.5, ">="),
    ("Error text (shu) on frost", SHU_CSS, frost_worst, 4.5, ">="),
    ("Error text (shu) on field fill", SHU_CSS, FIELD_FILL, 4.5, ">="),
    ("'Without it' row when off (shu) on frost", SHU_CSS, frost_worst, 4.5, ">="),
    ("Tile link (moss) on frost", MOSS_HEX, frost_worst, 4.5, ">="),
    ("White on moss 'Apply' button, lightest row", WHITE, hexof(moss_light), 4.5, ">="),
    ("Non-text: slider track vs frost (>= 3:1)", TRACK, frost_worst, 3.0, ">="),
    ("Non-text: slider fill and thumb ring (moss) vs frost", MOSS_HEX, frost_worst, 3.0, ">="),
    ("Non-text: thumb ring (moss) vs thumb fill", MOSS_HEX, THUMB, 3.0, ">="),
    ("Non-text: field border vs frost (>= 3:1)", LINE, frost_worst, 3.0, ">="),
    ("Non-text: field border vs field fill", LINE, FIELD_FILL, 3.0, ">="),
    ("Non-text: error border (shu) vs frost", SHU_CSS, frost_worst, 3.0, ">="),
    ("Non-text: focus ring (moss) vs lightest field", MOSS_HEX, hexof(field_light), 3.0, ">="),
    ("Non-text: focus ring (moss) vs frost", MOSS_HEX, frost_worst, 3.0, ">="),
    ("Non-text: focus ring (moss) vs field fill", MOSS_HEX, FIELD_FILL, 3.0, ">="),
    ("Non-text: ink bar vs frost", INK, frost_worst, 3.0, ">="),
    ("Non-text: switch track on (moss) vs clear glass", MOSS_HEX, hexof(glass_dark), 3.0, ">="),
    ("INTENDED: raked line vs ground stays quiet", hexof(field_dark), hexof(ground_plain), 1.2, "<"),
    ("INTENDED: emboss highlight vs ground stays quiet", hexof(field_light), hexof(ground_plain), 1.2, "<"),
]
bad = 0
for name, fg, bg, lim, op in checks:
    r = ratio(fg, bg)
    ok = r >= lim if op == ">=" else r < lim
    bad += not ok
    print("%-48s %s on %s  %5.2f  (%s %.1f)  %s" % (name, fg, bg, r, op, lim, "PASS" if ok else "FAIL"))
sys.exit(1 if bad else 0)
