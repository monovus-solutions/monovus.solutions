/* Monovus v8 stage (v7 engine): one WebGL fragment shader behind the DOM.
   Raked lines flow around glass read from the DOM ([data-glass] rounded rects, [data-lens] pebble lenses,
   [data-slab] thin account glass). Variants: clear, frost (blurred, tinted content panel), slab (calm, no lensing).
   Lenses with data-rim draw seven control arcs. Truth modes inside #lens: calm, frayed (near faults), measure.
   Disabled control sectors fray the lines around the lens. No libraries, render on demand. */
(function () {
  'use strict';
  var N = 32;
  var Q = new URLSearchParams(location.search);
  var DEBUG = Q.get('debug') === '1';

  var VERT = 'attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }';

  var FRAG = [
    '#extension GL_OES_standard_derivatives : enable',
    'precision highp float;',
    '#define N ' + N,
    'uniform vec2 u_res; uniform float u_dpr; uniform float u_time; uniform float u_order; uniform float u_focus;',
    'uniform vec4 u_a[N]; uniform vec4 u_b[N]; uniform vec4 u_c[N]; uniform float u_n;',
    'uniform vec4 u_lens; uniform vec2 u_sd[7]; uniform vec3 u_f[4]; uniform vec3 u_tr;',
    'const float PITCH = 10.0;',
    'const float PI = 3.14159265;',
    'const vec2 LDIR = vec2(-0.5547, -0.8321);',          // toward the light: top-left (y down)
    'const vec3 GROUND = vec3(0.9529, 0.9373, 0.9059);',  // #F3EFE7
    'const vec3 MOSS = vec3(0.247, 0.353, 0.188);',       // #3F5A30
    'const vec3 INK = vec3(0.1098, 0.1216, 0.1098);',     // rgb(28,31,28)
    'const vec3 FROSTMIN = vec3(0.9137, 0.8980, 0.8667);',// #E9E5DD: text contrast floor on frost
    '',
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }',
    'float fbm(vec2 p){ return 0.62 * vnoise(p) + 0.38 * vnoise(p * 2.13 + 3.1); }',
    '',
    'float sdRBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }',
    // superellipse pebble. x: normalised radius k (1 at the edge), y: edge radius in px along this direction
    'vec2 lensK(vec2 p, vec2 b){',
    '  vec2 q = p / b;',
    '  q.y *= mix(1.0, 1.07, smoothstep(-0.35, 0.35, q.y));',
    '  vec2 a = abs(q) + 1e-5;',
    '  float k = pow(pow(a.x, 2.08) + pow(a.y, 2.08), 1.0 / 2.08);',
    '  float rb = k < 0.05 ? min(b.x, b.y) : length(p) / k;',
    '  return vec2(k, rb);',
    '}',
    'float sdLens(vec2 p, vec2 b){ vec2 kr = lensK(p, b); return (kr.x - 1.0) * kr.y; }',
    'float sdShape(vec2 p, vec4 a, vec4 b){',
    '  vec2 d = p - a.xy;',
    '  if (b.y > 0.5) return sdLens(d, a.zw);',
    '  return sdRBox(d, a.zw, min(b.x, min(a.z, a.w)));',
    '}',
    'float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }',
    // union of base glass (slabs excluded); lenses merge like liquid (k 34), pills stay apart (k 14)
    'float sceneBase(vec2 p){',
    '  float d = 1e4; float dl = 0.0;',
    '  for (int i = 0; i < N; i++){ if (float(i) >= u_n) break;',
    '    vec4 a = u_a[i]; vec4 b = u_b[i];',
    '    if (b.w > 0.5 || a.z < 0.5 || u_c[i].x > 1.5) continue;',
    '    float di = sdShape(p, a, b);',
    '    float k = mix(14.0, 34.0, max(b.y, dl));',
    '    if (di < d) dl = b.y;',
    '    d = smin(d, di, k);',
    '  }',
    '  return d;',
    '}',
    // disabled control sectors: 0..1 inside a sector, within about 2.2x the lens radius
    'float sectorFray(vec2 p){',
    '  if (u_lens.z < 0.5) return 0.0;',
    '  vec2 v = p - u_lens.xy; float r = length(v); float ang = atan(v.y, v.x);',
    '  float R = max(min(u_lens.z, u_lens.w), 1.0);',
    '  float radial = 1.0 - smoothstep(R * 1.95, R * 2.25, r);',
    '  float s = 0.0;',
    '  for (int k = 0; k < 7; k++){ float da = abs(mod(ang - u_sd[k].x + PI, 2.0 * PI) - PI); s = max(s, u_sd[k].y * (1.0 - smoothstep(0.30, 0.47, da))); }',
    '  return s * radial;',
    '}',
    'float faultAmt(vec2 p){',
    '  float f = 0.0;',
    '  for (int k = 0; k < 4; k++){ vec3 q = u_f[k]; if (q.z > 0.5) f = max(f, 1.0 - smoothstep(q.z * 0.55, q.z, length(p - q.xy))); }',
    '  return f;',
    '}',
    'float wobble(vec2 p, float amt){',
    '  if (amt < 0.002) return 0.0;',
    '  float n1 = fbm(p * 0.014 + vec2(u_time * 0.05, -u_time * 0.03)) - 0.5;',
    '  float n2 = vnoise(p * 0.052 + vec2(-u_time * 0.11, u_time * 0.07)) - 0.5;',
    '  return amt * (n1 * 46.0 + n2 * 13.0);',
    '}',
    // broken dashes plus jitter. x: psi offset, y: line amplitude
    'vec2 fray(vec2 p, float psi, float amt){',
    '  if (amt < 0.004) return vec2(0.0, 1.0);',
    '  float li = floor(psi / PITCH);',
    '  float seg = p.x / mix(46.0, 22.0, amt) + hash(vec2(li, 3.7)) * 7.0;',
    '  float si = floor(seg); float sf = fract(seg);',
    '  float h1 = hash(vec2(li + 0.5, si)); float h2 = hash(vec2(si + 11.0, li * 1.7));',
    '  float gap = amt * (0.26 + 0.46 * h1);',
    '  float on = smoothstep(0.0, 0.05, sf - gap * 0.5) * smoothstep(0.0, 0.05, 1.0 - gap * 0.5 - sf);',
    '  float jit = amt * ((h2 - 0.5) * 10.0 + (sf - 0.5) * (h1 - 0.5) * 14.0 + (vnoise(p * 0.08 + vec2(u_time * 0.5, li)) - 0.5) * 4.0);',
    '  return vec2(jit, mix(1.0, on * (0.9 + 0.7 * h2), min(1.0, amt * 1.3)));',
    '}',
    // line gradient from a smooth psi: x filter width, yz direction. Uniform control flow only (derivatives).
    'vec3 lineGrad(float psiD){ vec2 g2 = vec2(dFdx(psiD), -dFdy(psiD)); float l = length(g2); return vec3(l / PITCH, g2 / max(l, 1e-6)); }',
    // x: darkening, y: emboss (additive)
    'vec2 lineAt(float psi, vec3 G, float amp, float soft){',
    '  float u = fract(psi / PITCH) - 0.5;',
    '  float s = 0.1 * soft;',
    '  float sa = sqrt(s * s + G.x * G.x * 0.35);',
    '  float g = exp(-0.5 * u * u / (sa * sa)) * (s / sa);',
    '  float gp = -u / (sa * sa) * g;',
    '  float fade = 1.0 - smoothstep(0.24, 0.5, G.x);',
    '  float facing = dot(G.yz, LDIR);',
    '  return vec2(g * 0.047 * amp * fade, gp * facing * 0.0030 * amp * fade);',
    '}',
    'vec3 ground(vec2 p, float gr){',
    '  vec2 uv = p / (u_res / u_dpr);',
    '  float light = 1.0 + 0.024 * (0.42 - (uv.x * 0.35 + uv.y * 0.65));',
    '  float grain = (hash(floor(p * u_dpr) + 17.0) - 0.5) * 0.012 * gr;',
    '  return GROUND * light + grain;',
    '}',
    '',
    'void main(){',
    '  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr;',
    '  float aa = 0.6 / u_dpr;',
    // pass 1: union SDF, normalised flow pull, soft attributes (online softmax over distance), slab, nearest rim lens
    '  float d = 1e4; float dl = 0.0; float acc = 0.0; float fs = 0.0; float m = 1e4;',
    '  float ws = 0.0; float wL = 0.0; vec2 wC = vec2(0.0); float wR = 0.0; float wM = 0.0; float wF = 0.0;',
    '  float dS = 1e4; vec4 sA = vec4(0.0); float sR = 0.0;',
    '  float dR = 1e4; vec4 rA = vec4(0.0); vec4 rC = vec4(0.0);',
    '  for (int i = 0; i < N; i++){ if (float(i) >= u_n) break;',
    '    vec4 a = u_a[i]; vec4 b = u_b[i]; vec4 c = u_c[i];',
    '    if (a.z < 0.5) continue;',
    '    if (c.x > 1.5){ float sr = min(b.x, min(a.z, a.w)); float ds = sdRBox(p - a.xy, a.zw, sr); if (ds < dS){ dS = ds; sA = a; sR = sr; } continue; }',
    '    if (b.w > 0.5) continue;',
    '    float di = sdShape(p, a, b);',
    '    if (c.z > 0.5 && c.w > 0.01 && di < dR){ dR = di; rA = a; rC = c; }',
    '    float k = mix(14.0, 34.0, max(b.y, dl));',
    '    if (di < d) dl = b.y;',
    '    d = smin(d, di, k);',
    '    float R = min(a.z, a.w);',
    '    float f = R / (R + max(di, 0.0)); f *= f;',
    '    acc += (p.y - a.y) * f; fs += f;',
    '    if (di < m){ float sc = exp((di - m) / 10.0); ws *= sc; wL *= sc; wC *= sc; wR *= sc; wM *= sc; wF *= sc; m = di; }',
    '    float w = exp((m - di) / 10.0);',
    '    ws += w; wL += w * b.y; wC += w * a.xy; wR += w * R; wM += w * max(b.z, 0.0); wF += w * step(0.5, c.x);',
    '  }',
    '  acc /= max(1.0, fs);',
    '  ws = max(ws, 1e-6);',
    '  float kindL = wL / ws; vec2 C = wC / ws; float Rw = max(wR / ws, 1.0); float moss = clamp(wM / ws, 0.0, 1.0);',
    '  float frost = clamp(wF / ws, 0.0, 1.0);',
    '  vec2 nrm = vec2(sceneBase(p + vec2(0.5, 0.0)) - d, sceneBase(p + vec2(0.0, 0.5)) - d);',
    '  vec2 n = nrm / max(length(nrm), 1e-6);',
    '  float slabIn = 1.0 - smoothstep(-aa, aa, dS);',
    '  float calm = 1.0 - slabIn;',
    '  float sec = sectorFray(p);',
    '  float inMain = u_lens.z > 0.5 ? 1.0 - smoothstep(-aa, aa, sdLens(p - u_lens.xy, u_lens.zw)) : 0.0;',
    // outside: raked field with flow, disorder, sector fray, contact shadow, caustic
    '  float dis = clamp(1.0 - u_order, 0.0, 1.6) * calm;',
    '  float frO = sec * calm;',
    '  float psiS = p.y - acc + wobble(p, dis + 0.22 * frO);',
    '  vec2 fo = fray(p, psiS, frO);',
    '  vec2 so = lineAt(psiS + fo.x, lineGrad(psiS), fo.y * (1.0 + 0.8 * frO), 1.0 + 0.8 * frO);',
    '  vec3 colOut = ground(p, 1.0) * (1.0 - so.x) + so.y;',
    '  float dsh = sceneBase(p - vec2(5.0, 12.0));',
    '  float shadow = (1.0 - smoothstep(-10.0, 38.0, dsh)) * mix(0.035, 0.06, kindL);',
    '  float ao = (1.0 - smoothstep(0.0, 6.0, d)) * 0.022;',
    '  float caust = exp(-pow((d - 13.0) / 10.0, 2.0)) * max(dot(n, -LDIR), 0.0) * kindL * 0.06;',
    '  colOut = colOut * (1.0 - shadow - ao) + caust;',
    // slab: thin account glass. calm lines, +4% white, 1 px specular edge, faint inner shade, faint outer hairline
    '  if (dS < 2.0){',
    '    vec2 sn = vec2(sdRBox(p + vec2(0.5, 0.0) - sA.xy, sA.zw, sR) - dS, sdRBox(p + vec2(0.0, 0.5) - sA.xy, sA.zw, sR) - dS);',
    '    sn /= max(length(sn), 1e-6);',
    '    float sdep = max(-dS, 0.0); float sf = dot(sn, LDIR);',
    '    vec3 cs = mix(colOut, vec3(1.0), 0.04);',
    '    cs *= 1.0 - exp(-sdep / 16.0) * 0.03 * max(-sf, 0.0);',
    '    cs += (1.0 - smoothstep(0.4, 1.2, sdep)) * (0.10 + 0.30 * max(sf, 0.0));',
    '    colOut = mix(colOut * (1.0 - 0.05 * (1.0 - smoothstep(0.0, 1.2, dS))), cs, slabIn);',
    '  }',
    // inside: meniscus refraction, magnification for lenses, chromatic rim, frost blur
    '  float depth = max(-d, 0.0);',
    '  float bevel = mix(16.0, 0.55 * Rw, kindL);',
    '  float t = clamp(depth / bevel, 0.0, 1.0);',
    '  float e1 = 1.0 - t;',
    // lenses: squircle height profile, flat centre and steep edge, so lensing is strong at the rim and near zero inside
    '  float e4 = e1 * e1 * e1 * e1;',
    '  float slope = mix(0.55 * e1 * e1, 0.10 * e1 * e1 * e1 / pow(1.0 - e4 + 0.06, 0.75), kindL);',
    '  vec2 off = -n * (bevel * slope) * mix(1.0, 0.25, frost);',
    '  float Z = 1.0 + kindL * (0.12 + 0.30 * u_focus);',
    '  vec2 ps = C + (p + off - C) / Z;',
    '  vec2 pR = C + (p + off * mix(0.86, 0.90, kindL) - C) / Z; vec2 pB = C + (p + off * mix(1.14, 1.10, kindL) - C) / Z;',
    '  float wob = wobble(ps, clamp(1.0 - u_order, 0.0, 1.6));',
    '  float mW = u_tr.z * inMain;',
    '  float frI = max(sec, u_tr.y * faultAmt(p) * inMain) * (1.0 - frost);',
    '  float psiI = ps.y + wob;',
    '  vec2 fi = fray(p, psiI, frI);',
    '  float amp = mix(0.72, 1.05, kindL) * fi.y * (1.0 + 0.8 * frI) * (1.0 - 0.72 * mW); float soft = mix(1.35, 0.95, kindL);',
    '  vec3 G = lineGrad(psiI);',
    '  vec2 sR2 = lineAt(pR.y + wob + fi.x, G, amp, soft);',
    '  vec2 sG = lineAt(psiI + fi.x, G, amp, soft);',
    '  vec2 sB = lineAt(pB.y + wob + fi.x, G, amp, soft);',
    '  if (frost > 0.01){',
    '    vec2 sF = vec2(0.0);',
    '    for (int j = 0; j < 10; j++){ float fj = float(j); float rj = 7.5 * sqrt((fj + 0.5) / 10.0); sF += lineAt(psiI + sin(fj * 2.39996) * rj, G, 0.85, 1.9); }',
    '    sF /= 10.0;',
    '    sR2 = mix(sR2, sF, frost); sG = mix(sG, sF, frost); sB = mix(sB, sF, frost);',
    '  }',
    '  vec3 gi = ground(ps, 1.0 - frost);',
    '  vec3 colIn = vec3(gi.r * (1.0 - sR2.x) + sR2.y, gi.g * (1.0 - sG.x) + sG.y, gi.b * (1.0 - sB.x) + sB.y);',
    '  float fres = e1 * e1 * e1;',
    '  colIn = mix(colIn, vec3(1.0), mix(mix(0.055, 0.012, kindL) + mix(0.09, 0.035, kindL) * fres, 0.22, frost));',
    '  vec2 rel = (p - C) / Rw;',
    '  colIn *= 1.0 + kindL * 0.025 * dot(normalize(rel + 1e-4), -LDIR) * smoothstep(0.2, 1.0, length(rel));',
    '  vec3 mossCol = MOSS * (1.04 - 0.10 * clamp((p.y - C.y) / Rw, -1.0, 1.0));',
    '  colIn = mix(colIn, mossCol, 0.93 * moss);',
    '  float facing = dot(n, LDIR);',
    '  float rimBand = exp(-depth / mix(1.3, 2.4, frost));',
    '  float arcW = mix(3.0, 2.5 + 0.03 * Rw, kindL);',
    '  float spec = rimBand * (0.62 * pow(max(facing, 0.0), 1.2) + 0.24 * pow(max(-facing, 0.0), 1.6) + mix(0.07, 0.03, kindL))',
    '             + exp(-depth / arcW) * mix(0.34, 0.5, kindL) * pow(max(facing, 0.0), mix(6.0, 3.0, kindL));',
    '  float innerHi = exp(-pow((depth - 3.4) / 1.0, 2.0)) * (mix(0.08, 0.025, kindL) + mix(0.06, 0.08, kindL) * facing);',
    '  float bevHi = exp(-pow((depth - 1.8) / 0.7, 2.0)) * 0.12 * max(facing, 0.0);',
    '  colIn += (spec + innerHi + bevHi) * (1.0 - 0.45 * moss) * mix(1.0, 0.5, frost);',
    // inner shade on the side away from the light
    '  colIn *= 1.0 - 0.045 * max(-facing, 0.0) * exp(-depth / mix(6.0, 0.12 * Rw, kindL)) * (1.0 - frost);',
    // Schlick Fresnel (IOR 1.5, F0 0.04) against a soft warm studio environment: rims brighten at grazing angles
    '  float cosT = inversesqrt(1.0 + slope * slope * 30.0);',
    '  float Fr = 0.04 + 0.96 * pow(1.0 - cosT, 5.0);',
    '  vec3 env = mix(vec3(0.90, 0.885, 0.86), vec3(1.0, 0.995, 0.975), 0.5 + 0.5 * facing);',
    '  colIn = mix(colIn, env, Fr * (1.0 - frost) * (1.0 - 0.6 * moss));',
    '  colIn = max(colIn, FROSTMIN * step(0.5, frost));',
    '  float alpha = 1.0 - smoothstep(-aa, aa, d);',
    '  vec3 col = mix(colOut, colIn, alpha);',
    // nested glass (dock indicator, Start pill, bead): a second layer on top of its base glass
    '  float di2 = 1e4; vec4 ia = vec4(0.0); vec4 ib = vec4(0.0);',
    '  for (int i = 0; i < N; i++){ if (float(i) >= u_n) break;',
    '    vec4 a = u_a[i]; vec4 b = u_b[i];',
    '    if (b.w < 0.5 || a.z < 0.5 || u_c[i].x > 1.5) continue;',
    '    float x = sdShape(p, a, b); if (x < di2){ di2 = x; ia = a; ib = b; }',
    '  }',
    '  vec2 n2r = vec2(sdShape(p + vec2(0.5, 0.0), ia, ib) - di2, sdShape(p + vec2(0.0, 0.5), ia, ib) - di2);',
    '  vec2 n2 = n2r / max(length(n2r), 1e-6);',
    '  float dep2 = max(-di2, 0.0); float e2 = 1.0 - clamp(dep2 / 12.0, 0.0, 1.0);',
    '  vec2 pI = p - n2 * (6.0 * e2 * e2);',
    '  vec2 sI = lineAt(pI.y, lineGrad(pI.y), 0.66, 1.4);',
    '  vec3 cI = ground(pI, 1.0) * (1.0 - sI.x) + sI.y;',
    '  float iM = clamp(ib.z, 0.0, 1.0); float iW = clamp(-ib.z, 0.0, 1.0);',
    '  cI = mix(cI, vec3(1.0), 0.07 + 0.36 * iW);',
    '  vec3 mI = MOSS * (1.04 - 0.10 * clamp((p.y - ia.y) / max(ia.w, 1.0), -1.0, 1.0));',
    '  cI = mix(cI, mI, 0.93 * iM);',
    '  float f2 = dot(n2, LDIR);',
    '  cI += exp(-dep2 / 1.3) * (0.5 * pow(max(f2, 0.0), 1.5) + 0.2 * pow(max(-f2, 0.0), 2.0) + 0.06) * (1.0 - 0.4 * iM);',
    '  float ai = 1.0 - smoothstep(-aa, aa, di2);',
    '  float dish = sdShape(p - vec2(1.5, 3.5), ia, ib);',
    '  col *= 1.0 - (1.0 - smoothstep(-3.0, 10.0, dish)) * 0.07 * (1.0 - ai) * step(0.5, ia.z);',
    '  col = mix(col, cI, ai);',
    // measure: fine concentric rings every 6 px and 60 edge ticks, inside #lens only
    '  if (mW > 0.002){',
    '    vec2 q = p - u_lens.xy; vec2 kr = lensK(q, u_lens.zw);',
    '    float s = kr.x * min(u_lens.z, u_lens.w);',
    '    float dr = abs(fract(s / 6.0 + 0.5) - 0.5) * 6.0;',
    '    float ring = (1.0 - smoothstep(0.42, 0.42 + 0.9 / u_dpr, dr)) * (1.0 - smoothstep(0.85, 0.87, kr.x)) * smoothstep(0.02, 0.05, kr.x);',
    '    vec2 qn = q / u_lens.zw; float ang = atan(qn.y, qn.x);',
    '    float TS = 2.0 * PI / 60.0;',
    '    float tt = (ang + PI * 0.5) / TS; float ti = floor(tt + 0.5);',
    '    float tdA = abs(tt - ti) * TS * kr.x * kr.y;',
    '    float major = 1.0 - step(0.5, mod(ti + 60.0, 10.0));',
    '    float k0 = mix(0.935, 0.912, major);',
    '    float tick = (1.0 - smoothstep(0.5, 0.5 + 0.9 / u_dpr, tdA)) * smoothstep(k0 - 0.004, k0, kr.x) * (1.0 - smoothstep(0.981, 0.986, kr.x));',
    '    col = mix(col, INK, mW * (0.14 * ring + (0.30 + 0.12 * major) * tick));',
    '  }',
    // rim arcs: seven controls, clockwise from the top, at 0.90 of the radius, moss on, dark off
    '  if (dR < 0.0){',
    '    vec2 q = p - rA.xy; vec2 kr = lensK(q, rA.zw);',
    '    vec2 qn = q / rA.zw; float ang = atan(qn.y, qn.x);',
    '    float SP = 2.0 * PI / 7.0;',
    '    float tt = (ang + PI * 0.5) / SP; float ti = floor(tt + 0.5); float da = abs(tt - ti) * SP; ti = mod(ti + 7.0, 7.0);',
    '    float hw = SP * 0.5 - 0.055;',
    '    float dist = length(vec2((kr.x - 0.9) * kr.y, max(da - hw, 0.0) * 0.9 * kr.y));',
    '    float vis = step(ti + 0.5, rC.z) * rC.w;',
    '    float bit = mod(floor(rC.y / exp2(ti) + 0.001), 2.0);',
    '    col = mix(col, MOSS, 0.10 * bit * vis * exp(-dist * dist / 14.0));',
    '    float cov = (1.0 - smoothstep(1.3 - 0.5 / u_dpr, 1.3 + 0.5 / u_dpr, dist)) * vis;',
    '    col = mix(col, bit > 0.5 ? MOSS : mix(col, INK, 0.34), cov);',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function showDebug(msg) {
    if (!DEBUG) return;
    var box = document.getElementById('dbg');
    if (box) { box.hidden = false; box.textContent += msg + '\n'; }
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error((type === gl.VERTEX_SHADER ? 'vertex' : 'fragment') + ' shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }
  function z6() { return [0, 0, 0, 0, 0, 0]; }

  function init(canvas, opts) {
    opts = opts || {};
    var reduce = !!opts.reduce;
    if (Q.get('nogl') === '1') return null;
    if (window.matchMedia && matchMedia('(prefers-reduced-transparency: reduce)').matches) return null;
    var gl;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false,
        preserveDrawingBuffer: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
    } catch (e) { gl = null; }
    if (!gl) { showDebug('WebGL unavailable: CSS fallback'); return null; }
    if (!gl.getExtension('OES_standard_derivatives')) { showDebug('OES_standard_derivatives missing: CSS fallback'); return null; }

    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.bindAttribLocation(prog, 0, 'a_pos');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    } catch (e) {
      showDebug(String(e.message || e)); console.error(e); return null;
    }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    var L = {};
    ['u_res', 'u_dpr', 'u_time', 'u_order', 'u_focus', 'u_a', 'u_b', 'u_c', 'u_n', 'u_lens', 'u_sd', 'u_f', 'u_tr'].forEach(function (k) {
      L[k] = gl.getUniformLocation(prog, k);
    });

    // ---- shapes from the DOM. state vector: [cx, cy, halfW, halfH, radius, tint(moss +1, white -1)] ----
    function tintOf(el) { var t = el.getAttribute('data-tint'); return t === 'moss' ? 1 : t === 'white' ? -1 : 0; }
    var all = [], main = null, groups = {}, known = new WeakMap();
    var drop = { el: null, kind: 1, inner: 0, variant: 0, mask: 0, rims: 0, rimA: 0, rimT: 0, s: z6(), v: z6(), t: z6(), k: 330, c: 31, pend: null, drop: true };
    var W = 1, H = 1, dpr = 1, dprCap = 1.75, slow = 0;
    var snap = false, opaTries = 0, opaTimer = 0;

    function shapeFor(el) {
      var sh = known.get(el);
      if (!sh) {
        sh = { el: el, present: false, wasPresent: false, fresh: true, s: z6(), v: z6(), t: z6(), pend: null, at: 0, rimA: 0, rimT: 0 };
        known.set(el, sh);
      }
      var home = el.getAttribute('data-home');
      sh.kind = el.hasAttribute('data-lens') ? 1 : 0;
      sh.inner = el.hasAttribute('data-inner') ? 1 : 0;
      sh.variant = el.hasAttribute('data-slab') ? 2 : el.getAttribute('data-glass-variant') === 'frost' ? 1 : 0;
      sh.homeKey = home; sh.home = null;
      sh.k = el.id === 'lens' ? 92 : (home ? 150 : 205);
      sh.c = el.id === 'lens' ? 16.5 : (home ? 16.5 : 25);
      return sh;
    }
    function build() {
      main = null; groups = {};
      all = Array.prototype.map.call(document.querySelectorAll('[data-glass],[data-lens],[data-slab]'), shapeFor);
      all.forEach(function (sh) {
        if (sh.el.id === 'lens') main = sh;
        var g = sh.el.getAttribute('data-morph');
        if (g) (groups[g] = groups[g] || []).push(sh);
      });
      all.forEach(function (sh, i) {
        if (sh.homeKey === 'lens') sh.home = main;
        else if (sh.homeKey === 'prev') sh.home = all[i - 1] || null;
      });
    }
    function readRims() {
      var ch = document.body.getAttribute('data-ch');
      all.forEach(function (sh) {
        var el = sh.el, n = sh.kind ? Math.min(7, parseInt(el.getAttribute('data-rim'), 10) || 0) : 0;
        var on = el.getAttribute('data-rim-on') || '1111111', mk = 0;
        for (var i = 0; i < 7; i++) if (on.charAt(i) !== '0') mk += 1 << i;
        sh.rims = n; sh.mask = mk;
        sh.rimT = n && !(sh === main && ch === 'begin') ? 1 : 0;
      });
    }
    // 0 hidden, 1 visible, 2 hidden only by opacity (may be fading in: re-check shortly)
    function visible(el) {
      if (el.closest('[data-present="0"],[hidden]')) return 0;
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) return 0;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return 0;
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true })) return 2;
      if (+getComputedStyle(el).opacity < 0.01) return 2;
      return 1;
    }

    var A = new Float32Array(N * 4), B = new Float32Array(N * 4), C4 = new Float32Array(N * 4), SD = new Float32Array(14), F = new Float32Array(12);
    var time = 0, order = 1, focus = 0, focusT = 0, drawn = 0;
    var tr = [1, 0, 0], trT = [1, 0, 0];
    var sectors = [0, 0, 0, 0, 0, 0, 0].map(function () { return { a: 0, d: 0, t: 0 }; });
    var pointer = { x: -999, y: -999, on: false };
    var raf = 0, last = 0, lost = false;

    function resize() {
      dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function targetOf(sh) {
      var el = sh.el, r = el.getBoundingClientRect(), tint = tintOf(el);
      if (!sh.present || r.width <= 0) {
        if (sh.home) return [sh.home.s[0], sh.home.s[1], 0, 0, 0, tint];
        return [r.left + r.width / 2, r.top + r.height / 2, 0, 0, 0, tint];
      }
      var rad = sh.kind ? 0 : Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, r.height / 2, r.width / 2);
      var lift = el.classList.contains('is-hover') ? 1.08 : 1;
      return [r.left + r.width / 2, r.top + r.height / 2, r.width / 2 * lift, r.height / 2 * lift, rad * lift, tint];
    }

    function differs(a, b) {
      for (var q = 0; q < 5; q++) if (Math.abs(a[q] - b[q]) > 0.3) return true;
      return Math.abs(a[5] - b[5]) > 0.01;
    }

    function sync(o) {
      o = o || {};
      var now = performance.now();
      var instant = o.instant || reduce;
      if (instant) snap = true;
      var fading = false;
      all.forEach(function (sh) {
        var v = visible(sh.el);
        if (v === 2) fading = true;
        sh.wasPresent = sh.fresh ? v === 1 : sh.present;
        sh.present = v === 1;
      });
      // an element fading in reads as opacity 0 at the moment of the sync: look again shortly
      clearTimeout(opaTimer);
      if (o.retry) opaTries++; else opaTries = 0;
      if (fading && opaTries < 10) opaTimer = setTimeout(function () { sync({ retry: true }); }, 120);
      // morph: when a group's visible member changes, the new member takes over the old one's glass
      if (!instant) Object.keys(groups).forEach(function (g) {
        var from = null, to = null;
        groups[g].forEach(function (sh) {
          if (sh.wasPresent && !sh.present) from = sh;
          if (!sh.wasPresent && sh.present) to = sh;
        });
        if (from && to) {
          to.s = from.s.slice(); to.v = from.v.slice();
          from.s = [from.s[0], from.s[1], 0, 0, 0, from.s[5]]; from.v = z6(); from.t = from.s.slice();
        }
      });
      readRims();
      var stagger = 0;
      all.forEach(function (sh) {
        var tg = targetOf(sh);
        if (instant || sh.fresh) {
          sh.fresh = false; sh.t = tg; sh.s = tg.slice(); sh.v = z6(); sh.pend = null; sh.rimA = sh.rimT; return;
        }
        if (sh.home && sh.present && !sh.wasPresent) {
          sh.pend = tg; sh.at = now + (0.06 + 0.07 * stagger) * 1000; stagger++;
          return;
        }
        if (!differs(tg, sh.t) && !sh.pend) return;
        if (sh.pend && sh.present) { sh.pend = tg; return; }
        sh.t = tg; sh.pend = null;
      });
      focusT = document.body.getAttribute('data-ch') === 'economics' ? 1 : 0;
      if (instant) focus = focusT;
      request(instant);
    }

    function step(dt, now) {
      var active = false;
      if (pointer.on && !reduce) drop.t = [pointer.x, pointer.y, 13, 13, 0, 0];
      else drop.t = [drop.s[0], drop.s[1], 0, 0, 0, 0];
      var list = all.concat([drop]);
      list.forEach(function (sh) {
        if (sh.pend && now >= sh.at) { sh.t = sh.pend; sh.pend = null; }
        if (sh.pend) active = true;
        if (sh.home && (!sh.present || sh.pend)) { sh.t[0] = sh.home.s[0]; sh.t[1] = sh.home.s[1]; sh.t[2] = 0; sh.t[3] = 0; sh.t[4] = 0; }
        if (sh.rimA !== sh.rimT) {
          sh.rimA += (sh.rimT - sh.rimA) * (1 - Math.exp(-dt * 7));
          if (Math.abs(sh.rimT - sh.rimA) < 0.01 || reduce) sh.rimA = sh.rimT; else active = true;
        }
        if (reduce && !sh.drop) { sh.s = sh.t.slice(); sh.v = z6(); return; }
        if (dt > 0) {
          var sub = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / sub;
          for (var j = 0; j < sub; j++) for (var c = 0; c < 6; c++) {
            sh.v[c] += (sh.k * (sh.t[c] - sh.s[c]) - sh.c * sh.v[c]) * h;
            sh.s[c] += sh.v[c] * h;
          }
        }
        var still = true;
        for (var q = 0; q < 6; q++) if (Math.abs(sh.t[q] - sh.s[q]) > 0.03 || Math.abs(sh.v[q]) > 0.03) still = false;
        if (still) { sh.s = sh.t.slice(); sh.v = z6(); } else active = true;
      });
      // sector disorder: quick to break, slower to restore calm
      var anyDis = false;
      sectors.forEach(function (s) {
        var rate = s.t > s.d ? 4.2 : 2.0;
        s.d += (s.t - s.d) * (1 - Math.exp(-dt * rate));
        if (Math.abs(s.t - s.d) < 0.002) s.d = s.t;
        if (s.d > 0.002 || s.t !== s.d) anyDis = true;
      });
      // truth modes: 300 ms crossfade
      for (var m = 0; m < 3; m++) {
        if (tr[m] === trT[m]) continue;
        var dm = trT[m] - tr[m], st = dt / 0.3;
        tr[m] = Math.abs(dm) <= st ? trT[m] : tr[m] + (dm > 0 ? st : -st);
        active = true;
      }
      focus += (focusT - focus) * (1 - Math.exp(-dt * 3.2));
      if (Math.abs(focusT - focus) < 0.002) focus = focusT; else active = true;
      if ((anyDis || tr[1] > 0.01) && !reduce) { time += dt; active = true; }
      return active;
    }

    function put(n, sh) {
      var i = n * 4;
      var hw = Math.max(0, sh.s[2]), hh = Math.max(0, sh.s[3]);
      // squash and stretch along the velocity (lenses only; panels keep their text box)
      if (sh.kind && !reduce) {
        var vx = sh.v[0], vy = sh.v[1], sp = Math.sqrt(vx * vx + vy * vy);
        if (sp > 1) { var st = Math.min(0.1, sp / 3000), ux = Math.abs(vx) / sp, uy = Math.abs(vy) / sp; hw *= 1 + st * (ux - uy); hh *= 1 + st * (uy - ux); }
      }
      A[i] = sh.s[0]; A[i + 1] = sh.s[1]; A[i + 2] = hw; A[i + 3] = hh;
      B[i] = Math.max(0, sh.s[4]); B[i + 1] = sh.kind; B[i + 2] = sh.s[5]; B[i + 3] = sh.inner;
      C4[i] = sh.variant || 0; C4[i + 1] = sh.mask || 0; C4[i + 2] = sh.rims || 0; C4[i + 3] = sh.rimA || 0;
    }
    function draw() {
      if (lost) return;
      var n = 0;
      for (var i = 0; i < all.length && n < N - 1; i++) if (all[i].s[2] > 0.5 && all[i].s[3] > 0.5) put(n++, all[i]);
      if (drop.s[2] > 0.5) put(n++, drop);
      for (var j = n; j < N; j++) { A[j * 4 + 2] = 0; A[j * 4 + 3] = 0; }
      drawn = n;
      for (var k = 0; k < 7; k++) { SD[k * 2] = sectors[k].a; SD[k * 2 + 1] = sectors[k].d; }
      gl.uniform2f(L.u_res, canvas.width, canvas.height);
      gl.uniform1f(L.u_dpr, dpr);
      gl.uniform1f(L.u_time, time);
      gl.uniform1f(L.u_order, order);
      gl.uniform1f(L.u_focus, focus);
      gl.uniform4fv(L.u_a, A); gl.uniform4fv(L.u_b, B); gl.uniform4fv(L.u_c, C4); gl.uniform1f(L.u_n, n);
      var ms = main && main.present ? main.s : [0, 0, 0, 0];
      gl.uniform4f(L.u_lens, ms[0], ms[1], Math.max(0, ms[2]), Math.max(0, ms[3]));
      gl.uniform2fv(L.u_sd, SD);
      gl.uniform3fv(L.u_f, F);
      gl.uniform3f(L.u_tr, tr[0], tr[1], tr[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      raf = 0; snap = false;
      var ms = last ? now - last : 0;
      // adaptive resolution: frames over 20 ms drop the cap from 1.75 to 1.25
      if (ms > 0 && ms < 200) { slow = ms > 20 ? slow + 1 : Math.max(0, slow - 1); if (slow > 24 && dprCap > 1.25) { dprCap = 1.25; resize(); } }
      var dt = last ? Math.min(0.034, ms / 1000) : 1 / 60;
      last = now;
      var active = step(dt, now);
      draw();
      if (active) raf = requestAnimationFrame(frame); else last = 0;
    }
    function request(now) {
      if (now) { step(0, performance.now()); draw(); }
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function setPointer(x, y, instant) {
      pointer.x = x; pointer.y = y;
      if (!pointer.on || instant) { drop.s = [x, y, instant ? 13 : 0, instant ? 13 : 0, 0, 0]; drop.v = z6(); }
      pointer.on = true; request(instant);
    }

    // pointer droplet (hidden on touch and with reduced motion)
    if (!reduce) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') { pointer.on = false; return; }
        setPointer(e.clientX, e.clientY, false);
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', function () { pointer.on = false; request(); });
      window.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') { pointer.on = false; request(); } }, { passive: true });
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); lost = true; document.body.classList.remove('gl'); canvas.style.display = 'none';
    });

    resize();
    build();
    document.body.classList.add('gl');
    showDebug('WebGL ok: ' + (gl.getParameter(gl.RENDERER) || '') + ' · v7 frag ' + FRAG.length + ' · shapes ' + all.length + ' (cap ' + N + ')');

    return {
      sync: sync,
      resize: function () { resize(); sync({ instant: true }); },
      rescan: function () {
        build(); sync({ instant: snap });
        showDebug('rescan: shapes ' + all.length + ', drawn ' + drawn + ' of ' + N);
      },
      setSectors: function (list) {
        list.forEach(function (s, i) { if (sectors[i]) { sectors[i].a = s.a; sectors[i].t = s.dis ? 1 : 0; if (reduce) sectors[i].d = sectors[i].t; } });
        request(reduce);
      },
      settleSectors: function () { sectors.forEach(function (s) { s.d = s.t; }); time = 7.3; request(true); },
      setTruth: function (mode) {
        var k = mode === 'frayed' ? 1 : mode === 'measure' ? 2 : 0;
        trT = [k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0];
        if (snap || reduce) tr = trT.slice();
        request(snap || reduce);
      },
      setFaults: function (list) {
        F.fill(0);
        (list || []).slice(0, 4).forEach(function (f, i) { F[i * 3] = +f.x || 0; F[i * 3 + 1] = +f.y || 0; F[i * 3 + 2] = Math.max(0, +f.r || 0); });
        request(snap || reduce);
      },
      setOrder: function (v) { order = v; request(); },
      pointer: setPointer,
      render: function () { request(true); }
    };
  }

  window.MonovusStage = { init: init };
})();
