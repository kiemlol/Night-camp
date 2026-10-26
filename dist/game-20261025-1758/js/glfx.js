/* glfx.js — a small WebGL2 effects layer, built the way stylized VFX is made in engines (2026-10-05, the user: "มันแข็งทื่อ
   ปกติเขาทำยังไงกัน" → "ทำเลย"). Instead of pre-baked sheets, every piece is drawn LIVE by one shader each frame:
     - shapes made in the shader (glow, puff, blade ribbon, star rays, thorn, vortex, ring, spark, crystal, shell, orb, twinkle,
       dome, runes, glass shard)
     - noise that PANS over them (flowing energy), EROSION by noise with a bright edge leading it, TOON colour bands from a
       4-tone palette (dark / mid / bright / core) with anti-aliased steps, palettes blendable (red → violet)
     - every value driven over its life by curves in the effect code (overshoot, hold, decay), particles with drag, gravity
       and stretch along their velocity, ribbons following moving heads
   An effect pushes pieces with GL.quad / GL.strip from an FX drawer of the 'low' or 'glow' layer (world coordinates); at the
   end of that layer the queue is drawn into a WebGL canvas and copied onto the game canvas (alpha runs normally, additive
   runs with 'lighter'), so captures of the game canvas see it. GL.zoom(x, y, k, dur): a quick camera punch (the frame
   redrawn scaled round a point). NC.GLFX.ok() false (no WebGL2): effects fall back or skip. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX) return;
  const GL = (NC.GLFX = { on: true });
  const SH = { glow: 0, puff: 1, blade: 2, star: 3, thorn: 4, vortex: 5, ring: 6, spark: 7, crystal: 8, shell: 9, orb: 11, twinkle: 13, dome: 14, runes: 15, shard: 16, beam: 17 };
  GL.SH = SH;
  // palettes: dark, mid, bright, core (linear 0..1)
  const PAL = [
    [[0.10, 0.02, 0.06], [0.52, 0.04, 0.15], [0.93, 0.16, 0.36], [1.0, 0.84, 0.92]],   // 0 blood
    [[0.07, 0.03, 0.17], [0.30, 0.15, 0.68], [0.62, 0.46, 1.0], [0.94, 0.91, 1.0]],    // 1 violet
    [[0.38, 0.06, 0.04], [0.92, 0.30, 0.12], [1.0, 0.64, 0.32], [1.0, 0.95, 0.86]],    // 2 ember
    [[0.04, 0.01, 0.03], [0.12, 0.03, 0.08], [0.22, 0.05, 0.13], [0.36, 0.08, 0.18]],  // 3 dark smoke
    [[0.72, 0.24, 0.56], [0.96, 0.50, 0.80], [1.0, 0.82, 0.95], [1.0, 1.0, 1.0]],      // 4 pink light
    [[0.07, 0.01, 0.04], [1.0, 0.44, 0.27], [1.0, 0.76, 0.86], [1.0, 0.98, 0.99]],     // 5 shell
    [[0.05, 0.02, 0.10], [0.20, 0.08, 0.30], [0.42, 0.18, 0.55], [0.75, 0.6, 0.95]],   // 6 dusk
    [[0.06, 0.01, 0.12], [0.36, 0.05, 0.62], [0.80, 0.26, 1.0], [1.0, 0.84, 1.0]],     // 7 void (the dome's magenta-violet)
    // 8..12 the colour grades' lights (js/droplight.js; ราตรี uses 0 blood)
    [[0.25, 0.24, 0.22], [0.70, 0.68, 0.62], [0.95, 0.93, 0.88], [1.0, 1.0, 1.0]],     // 8 common: white
    [[0.02, 0.15, 0.04], [0.12, 0.60, 0.16], [0.45, 0.95, 0.40], [0.90, 1.0, 0.88]],   // 9 fine: green
    [[0.02, 0.08, 0.20], [0.10, 0.38, 0.85], [0.45, 0.72, 1.0], [0.90, 0.96, 1.0]],    // 10 rare: sky blue
    [[0.08, 0.02, 0.18], [0.40, 0.16, 0.85], [0.75, 0.50, 1.0], [0.96, 0.90, 1.0]],    // 11 epic: violet
    [[0.20, 0.10, 0.0], [0.85, 0.50, 0.06], [1.0, 0.82, 0.30], [1.0, 0.98, 0.86]],     // 12 legendary: gold
  ];
  GL.PAL = { blood: 0, violet: 1, ember: 2, smoke: 3, pink: 4, shell: 5, dusk: 6, void: 7, g0: 8, g1: 9, g2: 10, g3: 11, g4: 12, g5: 0 };

  const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; in vec4 a_col; in vec4 a_p0; in vec4 a_p1; in vec4 a_p2;
uniform vec2 u_res;
out vec2 v_uv; out vec4 v_col; out vec4 v_p0; out vec4 v_p1; out vec4 v_p2;
void main() { vec2 c = a_pos / u_res * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); v_uv = a_uv; v_col = a_col; v_p0 = a_p0; v_p1 = a_p1; v_p2 = a_p2; }`;

  const FS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec4 v_col; in vec4 v_p0; in vec4 v_p1; in vec4 v_p2;   // p2: o.p2, a point on a dome + a radius (cracks, the break)
uniform float u_time;
uniform vec3 u_pal[64];
uniform vec2 u_res;
uniform sampler2D u_bg;      // the game canvas round a refracting piece (u_bgRect: where, in canvas px)
uniform vec4 u_bgRect;
uniform float u_bgOn;
out vec4 o;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.17; a *= 0.5; } return s / 0.9375; }
vec3 vor(vec2 x) {           // cell edges (iq): x = distance to the nearest edge, yz = the cell's id
  vec2 n = floor(x), f = fract(x), mg = vec2(0.0), mr = vec2(0.0); float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)); vec2 o = vec2(hash(n + g), hash(n + g + 19.7)); vec2 r = g + o - f; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; } }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { vec2 g = mg + vec2(float(i), float(j)); vec2 o = vec2(hash(n + g), hash(n + g + 19.7)); vec2 r = g + o - f; if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr))); }
  return vec3(md, n + mg);
}
float aastep(float e, float x) { float w = fwidth(x) * 0.85 + 1e-4; return smoothstep(e - w, e + w, x); }
vec3 ramp4(int id, float v) {
  vec3 c0 = u_pal[id * 4], c1 = u_pal[id * 4 + 1], c2 = u_pal[id * 4 + 2], c3 = u_pal[id * 4 + 3];
  float w = fwidth(v) * 0.75 + 1e-4;
  vec3 c = mix(c0, c1, smoothstep(0.28 - w, 0.28 + w, v));
  c = mix(c, c2, smoothstep(0.55 - w, 0.55 + w, v));
  return mix(c, c3, smoothstep(0.82 - w, 0.82 + w, v));
}
vec3 pal(float id, float v) { int a = int(floor(id)); float t = fract(id); vec3 c = ramp4(a, v); if (t > 0.002) c = mix(c, ramp4(min(a + 1, 15), v), t); return c; }
// the dome's noise as a function of its longitude; domeN() fades into the -2pi copy just before the seam at the back
// meridian, so nothing jumps where lon wraps from pi to -pi (it showed as a vertical cut at the top of the dome)
// (lon is scaled by the circle's width cr so the pattern doesn't pinch into a star at the top pole)
vec4 domeN0(float lon, float Py, float seed, float t, float pan) {
  float cr = sqrt(max(0.0, 1.0 - Py * Py));
  return vec4(fbm(vec2(lon * cr * 2.0, Py * 3.0) + seed + t * 0.3),
              fbm(vec2((lon * 0.9 + t * pan) * cr + Py * 0.8, Py * 13.0 + seed)),
              fbm(vec2((lon * 1.4 - t * pan * 0.6) * cr + Py * 1.2, Py * 19.0 + seed + 9.0)),
              fbm(vec2(lon * cr * 3.0, Py * 3.0) + seed));
}
vec4 domeN(float lon, float Py, float seed, float t, float pan) {
  vec4 a = domeN0(lon, Py, seed, t, pan);
  float w = smoothstep(2.3, 3.1416, lon);
  return w > 0.0 ? mix(a, domeN0(lon - 6.2832, Py, seed, t, pan), w) : a;
}
// cracks on the front glass: cells laid on the surface seen head-on (asin = arc length), smaller toward the rim
float domeCrack(vec2 s, float seed, float crack) {
  vec2 q = vec2(asin(clamp(s.x, -1.0, 1.0)), asin(clamp(s.y, -1.0, 1.0))) * 3.6 + seed * 0.37;
  q += (vec2(vn(q * 2.7), vn(q * 2.7 + 7.3)) - 0.5) * 0.42;           // jagged, not a honeycomb
  vec3 vv = vor(q);
  float spread = vn(vv.yz * 0.73 + 3.1) * 0.85 + 0.1;
  float w = (0.008 + crack * 0.014) * (0.55 + vn(q * 4.1 + 2.0) * 0.9);   // thin, uneven lines
  return (1.0 - smoothstep(w * 0.4, w, vv.x)) * step(spread, crack * 1.05);
}
void main() {
  int shape = int(v_p0.x + 0.5);
  float erode = v_p0.y, edge = v_p0.z, seed = v_p0.w;
  float pan = v_p1.x, ns = v_p1.y, extra = v_p1.z, pid = v_p1.w;
  vec2 uv = v_uv;
  float t = u_time;
  float a = 0.0; vec3 c = vec3(0.0);
  if (shape == 0) {            // soft glow, tinted by v_col
    float r = length(uv);
    a = exp(-r * r * 3.2) * smoothstep(1.0, 0.75, r); c = v_col.rgb;
  } else if (shape == 1) {     // toon puff: a disc eaten by noise, lit from the top left
    float r = length(uv);
    float n = fbm(uv * ns + vec2(seed, seed * 1.7) + vec2(0.0, t * pan));
    float body = (1.0 - r) * 1.5 + (n - 0.5) * 1.1;
    a = aastep(erode + 0.05, body);
    float v = clamp(0.3 + body * 0.35 + (-uv.x - uv.y) * 0.14 + extra, 0.0, 1.0);
    c = pal(pid, v);
    float e = a - aastep(erode + 0.05 + edge, body);
    c = mix(c, pal(pid, 0.9), e * step(0.001, edge));
  } else if (shape == 2) {     // blade ribbon: x 0 tail → 1 head, y across
    float x = uv.x, y = abs(uv.y), body = 1.0 - y;
    float n = fbm(vec2(x * ns - t * pan, uv.y * 1.3 + seed));
    float keep = body - erode * (1.15 - n) - (1.0 - x) * erode * 0.5;
    a = aastep(0.0, keep);
    float v = x * 0.62 + body * 0.32 + (n - 0.5) * 0.4 + extra;
    c = pal(pid, v);
    c = mix(c, pal(pid, 0.0), (1.0 - aastep(0.2, body)) * 0.9 * step(extra, 0.6));
    float e = a - aastep(edge, keep);
    c = mix(c, pal(pid, 0.95), e * step(0.001, edge));
  } else if (shape == 3) {     // star rays (additive): 12 rays of uneven length round a hot core
    float r = length(uv), ang = atan(uv.y, uv.x) + seed * 3.0;
    float nRay = 12.0, f = (ang + 3.14159) / 6.28318 * nRay;
    float id = floor(f), len = 0.42 + 0.58 * hash(vec2(id, seed));
    float dist = abs(fract(f) - 0.5) * (6.28318 / nRay) * r;
    float hw = 0.05 * max(1.0 - r / len, 0.0);
    float ray = (1.0 - smoothstep(hw * 0.55, hw + 0.002, dist)) * step(r, len);
    float core = exp(-r * r * 30.0), halo = exp(-r * r * 5.0) * 0.5;
    a = clamp(ray + core + halo, 0.0, 1.0);
    c = pal(pid, 0.55 + a * 0.45 + extra);
  } else if (shape == 4) {     // thorn: x base → tip, two-tone, dark rim, eaten from the tip
    float x = uv.x * 0.5 + 0.5, hw = pow(max(1.0 - x, 0.0), 1.05);
    float inside = hw - abs(uv.y);
    float n = fbm(uv * ns + seed);
    float keep = inside * 4.0 + (1.0 - x) * 0.6 + n * 0.4 - erode * 1.4;
    a = aastep(0.0, inside) * aastep(0.0, keep);
    float v = (uv.y < 0.0 ? 0.6 : 0.36) + (1.0 - x) * 0.12 + extra;
    c = pal(pid, v);
    c = mix(c, pal(pid, 0.0), 1.0 - aastep(0.06 * hw + 0.012, inside));
    float e = aastep(0.0, keep) - aastep(edge, keep);
    c = mix(c, pal(pid, 0.95), e * step(0.001, edge) * aastep(0.0, inside));
  } else if (shape == 5) {     // vortex: extra < 0.5 the dark body (alpha), else the tendrils (additive)
    float r = length(uv), ang = atan(uv.y, uv.x);
    float sw = ang + 3.4 * pow(max(1.0 - r, 0.0), 1.5) + t * pan;
    vec2 q = vec2(cos(sw), sin(sw)) * (0.4 + r * 1.9);
    float n = fbm(q * ns + seed);
    float rim = fbm(vec2(cos(ang), sin(ang)) * 2.2 + seed + t * 0.6);
    float body = 1.0 - r / (0.72 + 0.32 * rim) - erode;
    if (extra < 0.5) {
      a = aastep(0.0, body + (n - 0.5) * 0.45);
      c = pal(pid, 0.04 + n * 0.3 + (1.0 - r) * 0.06);
    } else {
      float band = sin(sw * 5.0 + n * 9.0 + r * 7.0);
      a = smoothstep(0.7, 0.9, band) * smoothstep(0.0, 0.12, body) * smoothstep(0.06, 0.2, r);
      float hot = smoothstep(0.96, 0.995, band) * step(0.6, n);
      c = pal(pid, 0.42 + a * 0.2 + hot * 0.4);
    }
  } else if (shape == 6) {     // ring
    float r = length(uv), ang = atan(uv.y, uv.x);
    float n = fbm(vec2(cos(ang), sin(ang)) * ns + seed);
    float w = 0.13 * (1.0 - erode) + 0.01;
    float d = w - abs(r - 0.82 - (n - 0.5) * 0.08);
    a = aastep(0.0, d) * aastep(erode * 0.9, n);
    c = pal(pid, 0.6 + extra + d * 2.0);
  } else if (shape == 7) {     // spark (stretched along x, additive)
    float k = exp(-uv.y * uv.y * 7.0) * (1.0 - uv.x * uv.x);
    a = clamp(k * 1.4, 0.0, 1.0);
    c = pal(pid, 0.55 + a * 0.45 + extra);
  } else if (shape == 8) {     // crystal strip: x 0 sharp end (hero) → 1 wide end, y across
    float y = uv.y, ay = abs(y), x = uv.x;
    float n = fbm(vec2(x * ns - t * pan, y * 2.0 + seed));
    float flow = fbm(vec2(x * ns * 0.45 - t * pan * 1.7, y * 0.9 + 7.0));
    float v = 0.3 + (y < 0.0 ? 0.2 : 0.0) - ay * 0.2;
    v -= (1.0 - smoothstep(0.0, 0.035, abs(ay - 0.47))) * 0.22;
    v -= (1.0 - smoothstep(0.0, 0.03, abs(ay - 0.78))) * 0.18;
    v += smoothstep(0.6, 0.78, flow) * 0.42 * (1.0 - ay);
    v += extra;
    float core = exp(-pow(y / 0.075, 2.0));
    v = max(v, core * (0.92 + extra * 0.2));
    c = pal(pid, v);
    c = mix(c, pal(pid, 0.0), 1.0 - aastep(0.1, 1.0 - ay));
    float e = n * 0.35 + x * 0.65;
    a = aastep(erode, e);
    c = mix(c, pal(pid, 0.98), (a - aastep(erode + edge, e)) * step(0.001, edge));
  } else if (shape == 9) {     // shell: ink rim, orange band, bright inside
    float r = length(uv), d = 1.0 - r;
    float n = fbm(uv * ns + vec2(t * pan, seed));
    float v = d < 0.07 ? 0.05 : (d < 0.19 ? 0.4 : 0.66 + n * 0.3 + extra);
    a = aastep(0.0, d) * aastep(erode, n * 0.6 + d * 0.8);
    c = pal(pid, v);
  } else if (shape == 11) {    // orb: black ball, red rim; extra 0..1 heats it pink-white
    float r = length(uv);
    a = aastep(0.0, 1.0 - r);
    float v = mix(0.06, 0.6, smoothstep(0.55, 0.98, r));
    v = mix(v, 0.97 - r * 0.32, extra);
    c = pal(pid, v);
  } else if (shape == 13) {    // twinkle: four-point star (additive)
    vec2 p = abs(uv);
    float s = exp(-p.x * 14.0) * exp(-p.y * 2.2) + exp(-p.y * 14.0) * exp(-p.x * 2.2);
    s += exp(-dot(uv, uv) * 22.0);
    a = clamp(s, 0.0, 1.0);
    c = pal(pid, 0.6 + a * 0.4);
  } else if (shape == 17) {    // a beam of light standing on the ground (additive; js/droplight.js): uv.x across, uv.y -1 top ..
                               // +1 the ground; erode = how far down it has struck (0 .. 1), edge = the core's width, ns = the
                               // flow's scale, pan = its speed (+ pours down), extra = brightness, p2.xy / p2.z = a soft hole (the
                               // item in it, uv) and its radius, p2.w = how wide the body is (0: 0.42)
    float x = uv.x, hy = (uv.y + 1.0) * 0.5;
    float lit = 1.0 - smoothstep(erode - 0.07, erode, hy);
    float n = fbm(vec2(x * 2.2 + seed, hy * ns - t * pan));
    float n2 = fbm(vec2(x * 5.5 - seed, hy * ns * 2.4 - t * pan * 1.8));
    float xx = x + (n - 0.5) * 0.16 * (1.0 - hy);
    float bw = v_p2.w > 0.0 ? v_p2.w : 0.42;
    float core = exp(-pow(xx / max(edge, 0.02), 2.0));
    float body = exp(-pow(xx / bw, 2.0)) * (0.5 + 0.5 * n);
    float streak = smoothstep(0.56, 0.86, n2) * exp(-pow(xx / (bw * 1.4), 2.0)) * 0.65;
    float up = pow(hy, 0.75);
    float foot = exp(-pow((1.0 - hy) / 0.07, 2.0)) * exp(-xx * xx * 2.5);
    float haze = exp(-pow(xx / (bw * 2.2), 2.0)) * 0.35 * (0.6 + 0.4 * n2);   // the volume round it
    float side = 1.0 - smoothstep(0.62, 1.0, abs(x));                          // (nothing reaches the quad's sides)
    haze *= side; body *= side; streak *= side;
    float L = ((core * 1.25 + body * 1.05 + streak + haze) * up + foot * 0.9) * lit;
    if (v_p2.z > 0.0) { vec2 d = uv - v_p2.xy; L *= 1.0 - 0.72 * exp(-dot(d, d) / (v_p2.z * v_p2.z)); }
    a = clamp(L * extra, 0.0, 1.0);
    c = pal(pid, 0.56 + a * 0.44);
  } else if (shape == 16) {    // a glass shard: a ragged polygon from the seed, see-through violet body, solid bright edges,
                               // a light band across it; extra = glint (the face turned to the light), erode eats it away
    float inside = 1.0;
    for (int k = 0; k < 5; k++) {
      float an = (float(k) + (hash(vec2(float(k), seed)) - 0.5) * 0.7) * 1.25664;
      inside = min(inside, 0.45 + 0.55 * hash(vec2(float(k), seed + 7.0)) - dot(uv, vec2(cos(an), sin(an))));
    }
    float n = fbm(uv * 2.5 + seed);
    a = aastep(0.0, inside) * aastep(0.0, inside * 3.0 + n * 0.35 - erode * 1.3);
    float rimL = 1.0 - aastep(0.06, inside);
    float band = exp(-pow((uv.x * 0.7 + uv.y - 0.1 + (hash(vec2(seed, 2.0)) - 0.5) * 0.6) / 0.14, 2.0));
    c = pal(pid, 0.4 + band * 0.35 + extra * 0.45);
    c = mix(c, pal(pid, 0.93), rimL);
    a *= mix(0.6, 1.0, clamp(max(rimL, extra + band * 0.5), 0.0, 1.0));
  } else if (shape == 15) {    // a circle of runes on the ground (the quad is its ellipse, additive): two rings, a band of
                               // glyph marks turning (pan), ticks inside; extra = brightness
    float r = length(uv), ang = atan(uv.y, uv.x) + t * pan;
    float ring = exp(-pow((r - 0.95) / 0.012, 2.0)) + exp(-pow((r - 0.8) / 0.009, 2.0)) * 0.8 + exp(-pow((r - 0.62) / 0.008, 2.0)) * 0.45;
    float f = (ang + 3.14159) / 6.28318 * 40.0, cell = floor(f), fr = fract(f);
    float on = step(0.35, hash(vec2(cell, seed)));
    float band = step(0.83, r) * step(r, 0.92);
    float sub = floor((r - 0.83) / 0.09 * 3.0);
    float glyph = band * on * step(0.18, fr) * step(fr, 0.82) * step(0.3, hash(vec2(cell * 3.0 + sub, seed + 1.0)));
    float tick = step(0.66, r) * step(r, 0.76) * (1.0 - smoothstep(0.03, 0.06, abs(fract(f * 0.5) - 0.5)));
    a = clamp(ring + glyph * 0.8 + tick * 0.5, 0.0, 1.0) * (0.4 + extra);
    c = pal(pid, 0.55 + a * 0.35);
  } else if (shape == 14) {    // dome: a hemisphere standing on the ground seen by the game's camera (30° down); the quad is
                               // its silhouette circle round the ground centre (mode 4: 1.35x it). extra = mode + boost * 0.4:
                               // 0 front body (alpha, dark see-through, indigo at the middle, magenta at the rim)
                               // 1 front light (add: two-tone Fresnel rim, a hot highlight up-left, streaks, ground line, the
                               //   dissolve front); 2 back half (add, dim); 3 a ripple from a hit (add: pan = its progress 0..1,
                               //   ns = the hit's longitude, edge = its height); 4 the halo round the rim (add, bloom-like)
                               // 5 / 6 a web of cracks round a hit on the front / back (add: p2.xyz = the hit point on the
                               //   unit dome (x across, y up, z toward the camera), p2.w = how far its spokes reach, radians;
                               //   edge = a hole's radius round that point)
                               // erode = how high it stands (0 → 1.35), rising from the ground and sinking back from the top
                               // p2 on modes 0-3: the break, a hole opening round p2.xyz (p2.w its radius, radians)
    vec2 s = vec2(uv.x, -uv.y);
    float mode = floor(extra + 0.001), boost = fract(extra + 0.001) / 0.4;
    if (mode > 3.5 && mode < 4.5) {
      vec2 S = s * 1.35;
      float r = length(S);
      float base = -0.5 * sqrt(max(0.0, 1.0 - S.x * S.x));
      float mask = smoothstep(base - 0.02, base + 0.1, S.y) * (1.0 - smoothstep(erode - 0.25, erode - 0.05, S.y * 0.866));
      float out1 = exp(-pow(max(r - 0.98, 0.0) / 0.075, 1.3)), in1 = smoothstep(0.82, 0.98, r);
      float hl = pow(max(dot(normalize(vec3(S, 0.2)), normalize(vec3(-0.6, 0.75, 0.2))), 0.0), 3.0);
      a = clamp(mask * min(out1, in1 + out1 * step(0.98, r)) * (0.55 + hl * 0.6 + boost * 0.5), 0.0, 1.0) * smoothstep(0.0, 0.5, erode);
      c = pal(pid, 0.5 + a * 0.3);
    } else {
    float rr = dot(s, s);
    if (rr < 1.0) {
      float z = sqrt(1.0 - rr) * ((mode > 1.5 && mode < 2.5) || mode > 5.5 ? -1.0 : 1.0);
      float Py = s.y * 0.866 + z * 0.5, Pz = -s.y * 0.5 + z * 0.866;
      vec3 N = vec3(s.x, Py, Pz);
      // the break: a hole round the hit with a ragged, glowing edge (modes 0-3: p2; the crack web: its own point + edge)
      float hole = 1.0, hrim = 0.0;
      float hR = mode > 4.5 ? edge : v_p2.w;
      if (hR > 0.0) {
        float hd = acos(clamp(dot(N, normalize(v_p2.xyz)), -1.0, 1.0)) + (vn(N.xz * 6.0 + N.y * 4.0 + seed) - 0.5) * 0.32;
        hole = aastep(hR, hd);
        hrim = hole - aastep(hR + 0.045, hd);
      }
      float facing = abs(z);
      float lon = atan(s.x, Pz);
      vec4 NZ = domeN(lon, Py, seed, t, pan);
      float n = NZ.x;
      float h = Py + (n - 0.5) * 0.35;
      float reveal = 1.0 - aastep(erode, h);
      float front = reveal - (1.0 - aastep(erode - (mode > 2.5 ? 0.07 : edge), h));
      float m = aastep(0.0, Py + 0.012) * reveal;
      float rim = pow(1.0 - facing, 2.4);
      float sw1 = NZ.y, sw2 = NZ.z;
      float streak = (smoothstep(0.6, 0.64, sw1) - smoothstep(0.65, 0.7, sw1)) + 0.7 * (smoothstep(0.62, 0.65, sw2) - smoothstep(0.66, 0.7, sw2));
      streak *= smoothstep(0.05, 0.4, 1.0 - facing * 0.6);
      float ground = exp(-pow(Py / 0.03, 2.0));
      float hot = pow(max(dot(N, normalize(vec3(-0.55, 0.78, 0.3))), 0.0), 70.0) * 0.7;
      float tone = smoothstep(0.15, 0.75, rim);            // indigo in the middle → magenta at the rim
      if (mode > 4.5) {
        // a spider web of cracks round the hit: jagged spokes of uneven length + broken rings sagging between them
        vec3 I = normalize(v_p2.xyz);
        float d = acos(clamp(dot(N, I), -1.0, 1.0));
        vec3 T = normalize(cross(abs(I.y) < 0.97 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), I)), B = cross(I, T);
        float th = atan(dot(N, B), dot(N, T)), Rw = v_p2.w;
        float nR = 11.0, f = (th / 6.28318 + 0.5) * nR, lines = 0.0;
        for (int k = -1; k <= 1; k++) {
          float id = floor(f) + float(k), idw = mod(id, nR);
          float ang = (id + 0.5 + (hash(vec2(idw, seed)) - 0.5) * 0.75) / nR * 6.28318 - 3.14159;
          ang += (vn(vec2(d * 8.0, idw * 3.1 + seed)) - 0.5) * 0.55 * smoothstep(0.0, 0.25, d);
          float len = Rw * (0.5 + 0.5 * hash(vec2(idw, seed + 3.0)));
          float da = abs(mod(th - ang + 3.14159, 6.28318) - 3.14159) * sin(max(d, 0.002));
          float w = 0.014 * (1.0 - 0.65 * clamp(d / max(len, 0.01), 0.0, 1.0));
          lines = max(lines, (1.0 - smoothstep(w * 0.35, w, da)) * (1.0 - smoothstep(len * 0.9, len, d)));
          // a short branch off some spokes
          float bAt = len * (0.3 + 0.4 * hash(vec2(idw, seed + 9.0)));
          float bAng = ang + (hash(vec2(idw, seed + 11.0)) - 0.5) * 1.2 * smoothstep(bAt, bAt + 0.25, d);
          float db = abs(mod(th - bAng + 3.14159, 6.28318) - 3.14159) * sin(max(d, 0.002));
          lines = max(lines, (1.0 - smoothstep(w * 0.25, w * 0.75, db)) * step(bAt, d) * (1.0 - smoothstep(bAt + 0.18, bAt + 0.28, d)) * step(0.45, hash(vec2(idw, seed + 13.0))));
        }
        float sp = 0.13 + d * 0.12, j = floor(d / sp), u = fract(f);    // rings closer together near the middle
        float rj = (j + 0.45) * sp - 0.025 * sin(3.14159 * u);
        float on = step(0.45, hash(vec2(floor(f) + j * 13.0, seed + 5.0))) * step(rj, min(Rw * 0.6, 0.75));
        float ringL = (1.0 - smoothstep(0.003, 0.008, abs(d - rj))) * on;
        float core = exp(-d * d / 0.005) * step(0.05, Rw);
        float L = clamp(lines + ringL * 0.8 + core, 0.0, 1.0) * hole;
        a = clamp(m * L * (mode > 5.5 ? 0.45 : 1.0), 0.0, 1.0);
        c = mix(pal(pid, 0.9), vec3(1.0, 0.96, 1.0), 0.5);
      } else if (mode < 0.5) {
        // clear in the middle (the hero inside stays readable), dark toward the rim; darker at the top than the foot
        float tint = 0.2 + rim * 0.62 + clamp(Py, 0.0, 1.0) * 0.12;
        vec3 bc = mix(pal(1.0, 0.02 + rim * 0.1 + (1.0 - Py) * 0.06), pal(pid, 0.02 + rim * 0.14), tone);
        if (u_bgOn > 0.5 && v_col.r < 0.5) {
          // glass: the world behind bends toward the rim
          vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
          vec2 off = -vec2(s.x, -s.y) * pow(rim, 1.3) * 22.0 * (u_res.x / 2000.0);
          vec3 bg = texture(u_bg, clamp((px + off - u_bgRect.xy) / u_bgRect.zw, 0.001, 0.999)).rgb;
          a = m; c = mix(bg, bc, tint);
        } else { a = m * tint; c = bc; }
      } else if (mode < 1.5) {
        float lit = 0.55 + 0.45 * dot(normalize(s + vec2(0.0001)), normalize(vec2(-0.6, 0.8)));   // the rim is thicker and brighter on the lit side
        float crack = ns > 9.5 ? clamp(ns - 10.0, 0.0, 1.0) : 0.0, cl = 0.0;
        if (crack > 0.001) {
          cl = domeCrack(s, seed, crack);
        }
        float L = rim * (0.9 + lit * 0.9) + streak * (0.32 + rim * 0.7) + ground * 1.1 + front * 0.62 + boost * (0.25 + rim * 0.7) + hot * 0.9 + cl * 1.3 + hrim * 0.85;
        a = clamp(m * L, 0.0, 1.0);
        float v = 0.4 + clamp(L, 0.0, 1.0) * 0.4 + pow(rim, 6.0) * 0.2 + boost * 0.15;
        c = mix(pal(1.0, v), pal(pid, v), 0.35 + 0.65 * tone);
        c = mix(c, vec3(1.0, 0.95, 1.0), clamp(hot * 1.2 + cl * 0.55, 0.0, 0.85));
      } else if (mode < 2.5) {
        float L = streak * 0.7 + rim * 0.5 + ground * 0.9 + front + hrim * 0.7;
        a = clamp(m * L, 0.0, 1.0) * 0.7;
        c = mix(pal(1.0, 0.45 + clamp(L, 0.0, 1.0) * 0.4), pal(pid, 0.45 + clamp(L, 0.0, 1.0) * 0.4), tone);
      } else {
        float hh = clamp(edge, -0.2, 0.95), cr = sqrt(1.0 - hh * hh);
        vec3 I = vec3(sin(ns) * cr, hh, cos(ns) * cr);
        float d = acos(clamp(dot(normalize(N), I), -1.0, 1.0));
        float u = clamp(pan, 0.0, 1.0);
        float wob = (NZ.w - 0.5) * 0.12;
        float ring = exp(-pow((d + wob - u * 1.8) / (0.05 + 0.07 * u), 2.0)) * pow(1.0 - u, 1.2);
        float ring2 = exp(-pow((d + wob - u * 1.1) / (0.035 + 0.04 * u), 2.0)) * pow(1.0 - u, 1.6) * 0.6;
        float flash = exp(-d * d / 0.03) * max(0.0, 1.0 - u * 2.5);
        a = clamp(m * (ring + ring2 + flash), 0.0, 1.0);
        c = mix(pal(pid, 0.62 + a * 0.38), vec3(1.0), flash * 0.6);
      }
      if (mode < 4.5) a *= hole;
    }
    }
  }
  a *= v_col.a;
  o = vec4(c * a, a);
}`;

  let glc = null, gl = null, prog = null, vbo = null, U = {}, failed = false, bgc = null, bgx = null, bgTex = null;
  GL.refract = true;   // the glass pieces (o.refract) bend the world behind them; false: off (lighter on weak machines)
  const STRIDE = 20;
  let buf = new Float32Array(STRIDE * 6 * 2048);
  let glLost = 0;
  function init() {
    // (the browser took the context away - a GPU reset, out of memory; js/crashguard.js counts it): a new one, as herospine does
    if (gl && gl.isContextLost()) { gl = null; bgc = null; failed = ++glLost > 3; }
    if (gl || failed) return !!gl;
    try {
      glc = document.createElement('canvas');
      gl = glc.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
      if (!gl) throw new Error('no webgl2');
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      const att = (name, size, off) => { const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, STRIDE * 4, off * 4); };
      att('a_pos', 2, 0); att('a_uv', 2, 2); att('a_col', 4, 4); att('a_p0', 4, 8); att('a_p1', 4, 12); att('a_p2', 4, 16);
      U.res = gl.getUniformLocation(prog, 'u_res'); U.time = gl.getUniformLocation(prog, 'u_time');
      U.bgRect = gl.getUniformLocation(prog, 'u_bgRect'); U.bgOn = gl.getUniformLocation(prog, 'u_bgOn');
      gl.uniform1i(gl.getUniformLocation(prog, 'u_bg'), 0); gl.uniform1f(U.bgOn, 0);
      gl.uniform3fv(gl.getUniformLocation(prog, 'u_pal'), new Float32Array(PAL.flat(2)));
      gl.enable(gl.BLEND);
      gl.enable(gl.SCISSOR_TEST);
      return true;
    } catch (e) {
      failed = true; gl = null;
      console.warn('glfx: off', e && e.message);
      return false;
    }
  }
  GL.ok = () => GL.on && init();
  GL.error = () => failed;

  // ---------------- the queue (world coordinates) ----------------
  const Q = { low: [], glow: [] };
  // a rotated quad: centre (x, y), half sizes rx / ry, uv -1..1. o: shape, erode, edge, seed, pan, ns, extra, pal, a, tint, add
  GL.quad = function (layer, x, y, rx, ry, rot, o) {
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    const P = (u, v) => [x + c * u * rx - s * v * ry, y + s * u * rx + c * v * ry, u, v];
    Q[layer].push({ add: !!o.add, tri: [P(-1, -1), P(1, -1), P(1, 1), P(-1, -1), P(1, 1), P(-1, 1)], o });
  };
  // a strip along points [{x, y, w}] (w = half width): uv.x 0 → 1 along it, uv.y -1 → 1 across
  GL.strip = function (layer, pts, o) {
    const n = pts.length;
    if (n < 2) return;
    let L = 0;
    const acc = [0];
    for (let i = 1; i < n; i++) { L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); acc.push(L); }
    if (L <= 0.01) return;
    const side = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      return [-dy * p.w, dx * p.w, o.even ? i / (n - 1) : acc[i] / L];
    });
    const tri = [];
    for (let i = 0; i < n - 1; i++) {
      const p = pts[i], q = pts[i + 1], sp = side[i], sq = side[i + 1];
      const A = [p.x - sp[0], p.y - sp[1], sp[2], -1], B = [p.x + sp[0], p.y + sp[1], sp[2], 1];
      const C = [q.x - sq[0], q.y - sq[1], sq[2], -1], D = [q.x + sq[0], q.y + sq[1], sq[2], 1];
      tri.push(A, C, D, A, D, B);
    }
    Q[layer].push({ add: !!o.add, tri, o });
  };

  // ---------------- drawing the queue onto the game canvas ----------------
  const NOP2 = [0, 0, 0, 0];
  function flush(ctx, layer) {
    const items = Q[layer];
    if (!items.length) return;
    Q[layer] = [];
    if (!init()) return;
    const cv = ctx.canvas, W = cv.width, H = cv.height;
    if (glc.width !== W || glc.height !== H) { glc.width = W; glc.height = H; }
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.res, W, H);
    gl.uniform1f(U.time, (NC.game && NC.game.time) || 0);
    const m = ctx.getTransform();
    // consecutive items with the same blend form a run
    let i = 0;
    while (i < items.length) {
      const add = items[i].add;
      let j = i, nv = 0;
      while (j < items.length && items[j].add === add) { nv += items[j].tri.length; j++; }
      if (buf.length < nv * STRIDE) buf = new Float32Array(nv * STRIDE * 2);
      let k = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let q = i; q < j; q++) {
        const it = items[q], o = it.o, tint = o.tint || [1, 1, 1];
        const p0 = [o.shape || 0, o.erode || 0, o.edge || 0, o.seed || 0], p1 = [o.pan || 0, o.ns || 3, o.extra || 0, o.pal || 0], p2 = o.p2 || NOP2;
        const al = o.a === undefined ? 1 : Math.max(0, Math.min(1, o.a));
        for (const v of it.tri) {
          const X = m.a * v[0] + m.c * v[1] + m.e, Y = m.b * v[0] + m.d * v[1] + m.f;
          if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
          buf[k++] = X; buf[k++] = Y; buf[k++] = v[2]; buf[k++] = v[3];
          buf[k++] = tint[0]; buf[k++] = tint[1]; buf[k++] = tint[2]; buf[k++] = al;
          buf[k++] = p0[0]; buf[k++] = p0[1]; buf[k++] = p0[2]; buf[k++] = p0[3];
          buf[k++] = p1[0]; buf[k++] = p1[1]; buf[k++] = p1[2]; buf[k++] = p1[3];
          buf[k++] = p2[0]; buf[k++] = p2[1]; buf[k++] = p2[2]; buf[k++] = p2[3];
        }
      }
      const bx = Math.max(0, Math.floor(x0) - 2), by = Math.max(0, Math.floor(y0) - 2);
      const bw = Math.min(W, Math.ceil(x1) + 2) - bx, bh = Math.min(H, Math.ceil(y1) + 2) - by;
      let refr = false;
      for (let q = i; q < j && !refr; q++) refr = !!items[q].o.refract;
      if (refr && GL.refract && bw > 0 && bh > 0) {
        // the game canvas under this run, for the glass pieces to bend
        if (!bgc) { bgc = document.createElement('canvas'); bgx = bgc.getContext('2d'); bgTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, bgTex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
        if (bgc.width !== bw || bgc.height !== bh) { bgc.width = bw; bgc.height = bh; }
        bgx.clearRect(0, 0, bw, bh);
        bgx.drawImage(cv, bx, by, bw, bh, 0, 0, bw, bh);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bgTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgc);
        gl.uniform4f(U.bgRect, bx, by, bw, bh); gl.uniform1f(U.bgOn, 1);
      } else gl.uniform1f(U.bgOn, 0);
      if (bw > 0 && bh > 0) {
        gl.scissor(bx, H - by - bh, bw, bh);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendFunc(gl.ONE, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, k), gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, nv);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';
        ctx.drawImage(glc, bx, by, bw, bh, bx, by, bw, bh);
        ctx.restore();
      }
      i = j;
    }
  }

  // ---------------- baking: pieces drawn into a canvas of their own ----------------
  // for an effect that cuts a live look into pieces (the dome breaking into plates): the world rect x0, y0, w, h at k
  // canvas pixels per world unit; draw() pushes the pieces with GL.quad('bake', ...). Returns the canvas (null: no WebGL).
  GL.bake = function (x0, y0, w, h, k, draw) {
    if (!init()) return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
    const cx = c.getContext('2d');
    cx.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    Q.bake = [];
    draw();
    flush(cx, 'bake');
    return c;
  };

  // ---------------- a camera punch: the frame redrawn scaled round a point for a moment ----------------
  let punch = null;
  const shakeEnabled = () => !NC.ScreenShake || NC.ScreenShake.enabled();
  GL.clearZoom = () => { punch = null; };
  GL.zoom = (x, y, k, dur) => {
    if (!shakeEnabled()) { punch = null; return; }
    punch = { x, y, k, dur, t0: (NC.game && NC.game.time) || 0 };
  };
  function applyPunch(ctx) {
    if (!shakeEnabled()) { punch = null; return; }
    if (!punch || !NC.game) return;
    const u = (NC.game.time - punch.t0) / punch.dur;
    if (u >= 1 || u < 0) { if (u >= 1) punch = null; return; }
    const z = 1 + punch.k * (u < 0.12 ? u / 0.12 : Math.pow(1 - (u - 0.12) / 0.88, 2));
    const m = ctx.getTransform(), cv = ctx.canvas;
    const px = m.a * punch.x + m.c * punch.y + m.e, py = m.b * punch.x + m.d * punch.y + m.f;
    const W = cv.width / z, H = cv.height / z;
    const sx = Math.max(0, Math.min(cv.width - W, px - (px / cv.width) * W)), sy = Math.max(0, Math.min(cv.height - H, py - (py / cv.height) * H));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(cv, sx, sy, W, H, 0, 0, cv.width, cv.height);
    ctx.restore();
  }

  const baseDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    baseDraw.apply(this, arguments);
    if (layer === 'low' || layer === 'glow') flush(ctx, layer);
    if (layer === 'glow') applyPunch(ctx);
  };

  // ---------------- helpers for effects ----------------
  // a piecewise-linear curve: pts [[u, v], ...] (u ascending)
  GL.curve = (u, pts) => {
    if (u <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * ((u - a[0]) / (b[0] - a[0] || 1)); }
    return pts[pts.length - 1][1];
  };
  GL.backOut = (u, s) => { s = s === undefined ? 1.7 : s; u = Math.min(1, Math.max(0, u)) - 1; return u * u * ((s + 1) * u + s) + 1; };
  GL.ease = (u) => { u = Math.min(1, Math.max(0, u)); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  GL.out = (u, p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), p || 2);

  // a particle burst living in one FX item: each particle { x, y, vx, vy, life, ... } updated with drag / gravity and
  // drawn by draw(p, u) (u = its age 0..1); spawn(n) can add more while it lives
  FX.def('gl_parts', (ctx, q) => { for (const p of q.parts) q.draw(p, Math.min(1, p.t / p.life)); }, 'glow');
  FX.def('gl_parts_low', (ctx, q) => { for (const p of q.parts) q.draw(p, Math.min(1, p.t / p.life)); }, 'low');
  GL.parts = function (o) {
    return FX.add({ type: o.low ? 'gl_parts_low' : 'gl_parts', x: 0, y: 0, parts: [], life: o.life || 3, draw: o.draw,
      update(q, dt) {
        if (o.tick) o.tick(q, dt);
        for (let i = q.parts.length - 1; i >= 0; i--) {
          const p = q.parts[i];
          p.t += dt;
          if (p.t >= p.life) { q.parts.splice(i, 1); continue; }
          const k = Math.exp(-(p.drag || 0) * dt);
          p.vx *= k; p.vy *= k; p.vy += (p.grav || 0) * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
        }
        if (q.t > (o.spawnFor || 0) && !q.parts.length && q.t > 0.05) q.dead = true;
      },
      add(p) { p.t = p.t || 0; this.parts.push(p); return p; } });
  };
})();
