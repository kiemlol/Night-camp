/* gl2d.js — the game screen drawn by WebGL2 behind the 2D canvas API (2026-10-19, the user: "ทำตัววาด WebGL2 ระยะ 1 เลย
   แบบเสียบแทน canvas เดิม มี ?gl=0 สลับกลับ"). README "จอเกมด้วย WebGL2".
   Every drawing file of the game draws through the `ctx` of the game canvas (#view). Measured 2026-10-19 (woods, night): the
   browser's GPU process spent ~9.5 ms (alone) to ~22 ms (30 heroes) a frame turning those ~1,500 2D calls into GPU work. Here
   the same calls fill one vertex batch that is drawn in a few WebGL2 draws:
   - gl2d.js (this file): the WebGL2 context on #view, the one shader, the vertex batch (up to NU pictures per draw), the
     textures made from pictures / canvases (a canvas is uploaded again only after something drew on it: every 2D and WebGL
     draw call bumps its canvas's __glv), blend modes, the stencil (clip levels in the high 4 bits, a path's winding in the
     low 4), offscreen GL canvases (GLCanvas: the night light map), the copy of the screen for effects that read it back.
   - gl2d_path.js: paths in screen pixels (arcs, ellipses, curves flattened), fills (convex = plain triangles, the rest by
     stencil-then-cover), strokes (joins, caps, dashes), colours and colour filters.
   - gl2d_ctx.js: the 2D context itself (state, save/restore, every call the game makes), gradients, text (each string drawn
     once into an atlas), the tee check (the same frame drawn by the real 2D canvas, for pixel comparisons), the switch on #view.
   ESC -> ตั้งค่า "โหมดวาดจอ" เดิม = the old 2D canvas (the ?gl= switches went in 0.5.8). No WebGL2 (or a shader that does not compile) = the old canvas too (NC.GL2D.why says why). */
(function () {
  'use strict';
  const NC = (window.NC = window.NC || {});
  const G = (NC.GL2D = { on: false, why: '', frame: 0, lost: false,
    stats: { draws: 0, flushes: 0, uploads: 0, uploadMB: 0, special: 0, texMB: 0, textures: 0 } });
  const VIEW = document.getElementById('view');
  // the drawing mode, ESC -> ตั้งค่า "โหมดวาดจอ": อัตโนมัติ keeps the old canvas on iPhones and iPads and on software WebGL
  // renderers; ใหม่ / เดิม are explicit choices. Kept in localStorage; a change reloads once (online: the same hero,
  // js/online/update.js). The address cannot force one (?gl= went in 0.5.8).
  // (A Mac kept the old canvas too, measured smoother on an M4 before 2026-10-24; with that day's text and effect fixes the
  // WebGL screen is far ahead on a Mac: a crowd of 60 monsters, 30 players, 80 drops and 300 numbers a second ran WebGL2
  // 60 fps vs 57 in Chrome and 51 vs 3.6 in WebKit, Safari's engine; at 4K 45 vs 6 in Chrome. iPhones and iPads wait for a
  // try on the devices themselves. An iPad's Safari says Macintosh: its touch points tell it apart.)
  const MODE_KEY = 'nightcamp.draw.v1', MODES = ['auto', 'new', 'old'];
  let mode = 'auto';
  try { const v = localStorage.getItem(MODE_KEY); if (MODES.includes(v)) mode = v; } catch (e) { /* storage blocked */ }
  const apple = /Macintosh|Mac OS X|iPhone|iPad/.test(navigator.userAgent);
  const appleTouch = /iPhone|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  G.mode = mode; G.apple = apple; G.appleTouch = appleTouch;
  (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({
    name: 'โหมดวาดจอ', group: 'perf',
    get note() { return `ตอนนี้ใช้${G.on ? 'แบบใหม่ (WebGL2)' : 'แบบเดิม'}${mode === 'auto' && appleTouch ? ' · iPhone / iPad ใช้แบบเดิมไว้ก่อน' : mode === 'auto' && G.autoSoftware ? ' · การ์ดจอจำลองใช้แบบเดิม' : ''} · เปลี่ยนแล้วเกมรีโหลด 1 ครั้ง`; },
    opts: [['auto', 'อัตโนมัติ'], ['new', 'ใหม่'], ['old', 'เดิม']],
    get: () => mode,
    set: (v) => {
      if (v === mode || !MODES.includes(v)) return;
      mode = v; G.mode = v;
      try { if (v === 'auto') localStorage.removeItem(MODE_KEY); else localStorage.setItem(MODE_KEY, v); } catch (e) { /* storage blocked */ }
      const g = NC.game, online = !!(NC.Online && NC.Online.enabled);
      if (g && g.toast) g.toast('เปลี่ยนโหมดวาดจอแล้ว · กำลังรีโหลด…');
      setTimeout(() => {
        try { if (!online && NC.saveGame && g) NC.saveGame(g); } catch (e) { /* (the reload goes on) */ }
        if (online && NC.OnlineUpdate) {
          // An installed game cannot fetch a newer web build on reload. Reload its current files while keeping the hero.
          if (window.NCDesktop && window.NCDesktop.bundled) {
            if (NC.OnlineUpdate.reloadClient) NC.OnlineUpdate.reloadClient();
            else location.reload();
          } else if (NC.OnlineUpdate.update) NC.OnlineUpdate.update();
          else location.reload();
        } else location.reload();
      }, 700);
    },
  });
  if (mode === 'old') { G.why = 'setting: เดิม'; return; }
  if (mode === 'auto' && appleTouch) { G.why = 'auto: iPhone / iPad'; return; }
  if (!VIEW || !window.WebGL2RenderingContext) { G.why = 'no WebGL2'; return; }

  // Probe before claiming #view: after a canvas gets a WebGL context it cannot be switched back to 2D. A software WebGL
  // renderer makes this batched shader path slower than Canvas2D; let Auto keep the original canvas. The temporary
  // context requests the same GPU preference as the main one, then gives its slot back. The browser may hide its renderer
  // name, so failIfMajorPerformanceCaveat is checked independently. A player's explicit choice always wins.
  if (mode === 'auto') {
    const probe = document.createElement('canvas');
    let check = null;
    try { check = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: true, powerPreference: 'high-performance' }); }
    catch (e) { /* WebGL disabled or refused */ }
    if (!check) { G.autoSoftware = true; G.why = 'auto: WebGL performance caveat'; return; }
    try {
      const ext = check.getExtension('WEBGL_debug_renderer_info');
      const renderer = String((ext && check.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || check.getParameter(check.RENDERER) || '');
      G.autoRenderer = renderer;
      if (/swiftshader|\bwarp\b|microsoft basic|llvmpipe|softpipe|swrast|software (?:rasterizer|renderer)/i.test(renderer)) {
        G.autoSoftware = true; G.why = 'auto: software WebGL renderer';
      }
    } catch (e) { /* renderer details unavailable: the caveat check still passed */ }
    try { const lose = check.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch (e) { /* optional */ }
    if (G.autoSoftware) return;
  }

  // a canvas that became WebGL cannot draw 2D any more: a fresh one takes its place for the old game
  function fallback(why) {
    G.why = why; G.on = false;
    console.warn('gl2d: off -', why);
    const c = VIEW.cloneNode(false);
    if (VIEW.parentNode) VIEW.parentNode.replaceChild(c, VIEW);
  }

  // The drawing buffer between frames (2026-10-19, a Mac M4 ran smoother on the old canvas): kept, the browser copies the
  // whole screen every frame (a Retina screen: ~24 MB a frame) - the slow path on Apple GPUs and in Safari - so Apple machines
  // do not keep it. Every frame draws the whole scene and each task's draws are flushed in that task (endFlush; tested: no
  // draw on the screen outside a frame, offline or online, windows and mouse included), so nothing needs the old pixels; a
  // picture of the screen = G.shot(). Elsewhere it stays kept: on this PC (RTX laptop, Windows) not keeping it gave the same
  // median frame and no gain (4 interleaved pairs). __ncKeep: crashguard.js leaves it.
  VIEW.__ncKeep = true;
  const KEEP = !apple;
  G.keep = KEEP;
  let gl = null;
  try {
    gl = VIEW.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, stencil: true, depth: false,
      preserveDrawingBuffer: KEEP, powerPreference: 'high-performance' });
  } catch (e) { gl = null; }
  if (!gl) { G.why = 'webgl2 refused'; return; }

  const MAXU = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  const NU = Math.max(4, Math.min(16, MAXU - 4)); // picture units per draw; then the gradient rows, their geometry, the backdrop, uploads
  const U_GRAD = NU, U_GPAR = NU + 1, U_DST = NU + 2, U_UP = NU + 3;
  const MAXT = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const GR = 512; // gradient rows

  // ---------------- the shader ----------------
  const VS = `#version 300 es
layout(location=0) in vec2 a_p;
layout(location=1) in vec2 a_uv;
layout(location=2) in vec4 a_c;
layout(location=3) in uint a_m;
layout(location=4) in vec4 a_g;
uniform vec2 u_res;
uniform float u_flip;
out vec2 v_uv; out vec4 v_c; out vec4 v_g; flat out uint v_m;
void main() {
  vec2 n = a_p / u_res * 2.0 - 1.0;
  gl_Position = vec4(n.x, n.y * u_flip, 0.0, 1.0);
  v_uv = a_uv; v_c = a_c; v_g = a_g; v_m = a_m;
}`;
  let chain = '';
  for (let i = 0; i < NU; i++)
    chain += `  ${i ? 'else ' : ''}if (i == ${i}u) { if (cl) { vec2 h = 0.5 / vec2(textureSize(u_t[${i}], 0)); uv = clamp(uv, r.xy + h, r.zw - h); } return textureGrad(u_t[${i}], uv, dx, dy); }\n`;
  // paint types (bits 8-11 of a_m): 0 colour, 1 picture, 2 linear gradient (t in g.x), 3 radial with one centre (g.xy = the
  // point over the radius span, g.z = r0 over the span, g.w = its sign), 4 pattern (uv in tiles), 5 two-circle radial (g.xy =
  // the point, circles in u_gpar); +16 = times a text mask's alpha (the mask in uv); +32 = keep uv inside g (a part of a picture);
  // +64 = a picture tinted towards g.rgb (the rigs' hit flash, js/gl2d_mesh.js)
  const FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D u_t[${NU}];
uniform sampler2D u_grad;
uniform sampler2D u_gpar;
uniform sampler2D u_dst;
uniform mat4 u_cm[4]; uniform vec4 u_cmo[4]; uniform int u_cmN;
uniform int u_mode;
in vec2 v_uv; in vec4 v_c; in vec4 v_g; flat in uint v_m;
out vec4 o;
vec4 tx(uint i, vec2 uv, vec2 dx, vec2 dy, bool cl, vec4 r) {
${chain}  return vec4(0.0);
}
bool conical(vec2 p, int row, out float t) {
  vec4 A = texelFetch(u_gpar, ivec2(0, row), 0), B = texelFetch(u_gpar, ivec2(1, row), 0);
  vec2 cd = B.xy - A.xy, pd = p - A.xy; float r0 = A.z, dr = B.z - A.z;
  float a = dot(cd, cd) - dr * dr, b = dot(pd, cd) + r0 * dr, c = dot(pd, pd) - r0 * r0;
  t = 0.0;
  if (abs(a) < 1e-6) { if (abs(b) < 1e-9) return false; t = c / (2.0 * b); return r0 + t * dr >= 0.0; }
  float d = b * b - a * c;
  if (d < 0.0) return false;
  float s = sqrt(d), t1 = (b + s) / a, t2 = (b - s) / a;
  float hi = max(t1, t2), lo = min(t1, t2);
  if (r0 + hi * dr >= 0.0) { t = hi; return true; }
  if (r0 + lo * dr >= 0.0) { t = lo; return true; }
  return false;
}
vec3 mixB(vec3 cb, vec3 cs, int m) {
  if (m == 1) { vec3 d = mix(sqrt(cb), ((16.0 * cb - 12.0) * cb + 4.0) * cb, step(cb, vec3(0.25)));
    return mix(cb + (2.0 * cs - 1.0) * (d - cb), cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb), step(cs, vec3(0.5))); }
  if (m == 2) return mix(cs + (2.0 * cb - 1.0) - cs * (2.0 * cb - 1.0), cs * 2.0 * cb, step(cb, vec3(0.5)));
  if (m == 3) return mix(cb + (2.0 * cs - 1.0) - cb * (2.0 * cs - 1.0), cb * 2.0 * cs, step(cs, vec3(0.5)));
  if (m == 4) return abs(cb - cs);
  if (m == 5) return cb + cs - 2.0 * cb * cs;
  if (m == 6) return mix(mix(min(vec3(1.0), cb / max(vec3(1e-5), 1.0 - cs)), vec3(1.0), step(vec3(1.0), cs)), vec3(0.0), step(cb, vec3(0.0)));
  if (m == 7) return mix(mix(1.0 - min(vec3(1.0), (1.0 - cb) / max(vec3(1e-5), cs)), vec3(0.0), step(cs, vec3(0.0))), vec3(1.0), step(vec3(1.0), cb));
  if (m == 8) return min(cb, cs);
  if (m == 9) return max(cb, cs);
  return cs;
}
void main() {
  uint ti = v_m & 255u, ty = (v_m >> 8u) & 255u; int row = int(v_m >> 16u);
  uint pt = ty & 15u;
  vec2 dx = dFdx(v_uv), dy = dFdy(v_uv);
  vec4 c;
  if (pt == 0u) c = v_c;
  else if (pt == 1u) {
    vec4 t = tx(ti, v_uv, dx, dy, (ty & 32u) != 0u, v_g);
    if ((ty & 64u) != 0u) t = vec4(t.rgb * v_g.w + v_g.rgb * t.a, t.a); // (+64: a rig's hit tint: g.rgb = colour x amount, g.w = 1 - amount)
    c = t * v_c;
  }
  else if (pt == 4u) c = tx(ti, fract(v_uv), dx, dy, false, v_g) * v_c;
  else {
    float t = 0.0; bool ok = true;
    if (pt == 2u) t = v_g.x;
    else if (pt == 3u) t = (length(v_g.xy) - v_g.z) * v_g.w;
    else ok = conical(v_g.xy, row, t);
    c = ok ? texture(u_grad, vec2((clamp(t, 0.0, 1.0) * 255.0 + 0.5) / 256.0, (float(row) + 0.5) / ${GR}.0)) * v_c : vec4(0.0);
  }
  if ((ty & 16u) != 0u) c *= tx(ti, v_uv, dx, dy, false, v_g).a;
  if (u_cmN > 0) { // (the colour filter: each step clamped, as the browser does)
    vec4 u = c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0);
    for (int i = 0; i < 4; i++) { if (i >= u_cmN) break; u = clamp(u_cm[i] * u + u_cmo[i], 0.0, 1.0); }
    c = vec4(u.rgb * u.a, u.a);
  }
  if (u_mode != 0) {
    vec4 d = texelFetch(u_dst, ivec2(gl_FragCoord.xy), 0);
    vec3 cs = c.a > 0.0 ? c.rgb / c.a : vec3(0.0), cb = d.a > 0.0 ? d.rgb / d.a : vec3(0.0);
    c = vec4((1.0 - d.a) * c.rgb + (1.0 - c.a) * d.rgb + c.a * d.a * clamp(mixB(cb, cs, u_mode), 0.0, 1.0), c.a + d.a * (1.0 - c.a));
  }
  o = c;
}`;
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }
  let prog, UNI;
  function makeProgram() {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    gl.useProgram(p);
    const u = (n) => gl.getUniformLocation(p, n);
    UNI = { res: u('u_res'), flip: u('u_flip'), cm: u('u_cm'), cmo: u('u_cmo'), cmN: u('u_cmN'), mode: u('u_mode') };
    gl.uniform1iv(u('u_t'), Array.from({ length: NU }, (_, i) => i));
    gl.uniform1i(u('u_grad'), U_GRAD); gl.uniform1i(u('u_gpar'), U_GPAR); gl.uniform1i(u('u_dst'), U_DST);
    gl.uniform1i(UNI.cmN, 0); gl.uniform1i(UNI.mode, 0);
    return p;
  }

  // ---------------- the vertex batch ----------------
  // a vertex = 10 words: x y (screen px), u v, colour (RGBA8 premultiplied), misc (unit | paint << 8 | gradient row << 16), g0..g3
  const STRIDE = 10, MAXV = 65532;
  const VB = new ArrayBuffer(MAXV * STRIDE * 4), F = new Float32Array(VB), UI = new Uint32Array(VB);
  const IB = new Uint16Array(MAXV * 3), MAXI = IB.length;
  const Bt = { vn: 0, in: 0 };
  let RINGS = [], ring = 0;
  function makeBuffers() {
    RINGS = [];
    for (let i = 0; i < 3; i++) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, VB.byteLength, gl.DYNAMIC_DRAW);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, IB.byteLength, gl.DYNAMIC_DRAW);
      const S = STRIDE * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, S, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S, 8);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, S, 16);
      gl.enableVertexAttribArray(3); gl.vertexAttribIPointer(3, 1, gl.UNSIGNED_INT, S, 20);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, S, 24);
      RINGS.push({ vao, vb, ib });
    }
    gl.bindVertexArray(null);
  }
  function vtx(x, y, u, v, col, misc, g0, g1, g2, g3) {
    const o = Bt.vn * STRIDE;
    F[o] = x; F[o + 1] = y; F[o + 2] = u; F[o + 3] = v; UI[o + 4] = col; UI[o + 5] = misc;
    F[o + 6] = g0; F[o + 7] = g1; F[o + 8] = g2; F[o + 9] = g3;
    return Bt.vn++;
  }
  function tri(a, b, c) { IB[Bt.in++] = a; IB[Bt.in++] = b; IB[Bt.in++] = c; }

  // the batch's state: one target, one blend, one clip level, one colour filter; up to NU pictures
  const B = { target: null, blend: 'source-over', depth: 0, cm: null, spec: null };
  const UNIT = new Array(NU).fill(null), BOUND = new Array(NU + 4).fill(null);
  let NUs = 0, batchId = 1;
  function state(target, blend, depth, cm) {
    if (Bt.vn && (B.target !== target || B.blend !== blend || B.depth !== depth || B.cm !== cm)) flush();
    B.target = target; B.blend = blend; B.depth = depth; B.cm = cm;
  }
  // room for nv vertices / ni indices and units for up to two textures (flushes first when they do not fit)
  function begin(nv, ni, E, E2) {
    if (Bt.vn + nv > MAXV || Bt.in + ni > MAXI) flush();
    let need = 0;
    if (E && E.b !== batchId) need++;
    if (E2 && E2 !== E && E2.b !== batchId) need++;
    if (NUs + need > NU) flush();
    if (!G.pend) { G.pend = true; queueMicrotask(endFlush); }
    return nv <= MAXV && ni <= MAXI;
  }
  function unitOf(E) {
    if (E.b === batchId) return E.u;
    E.b = batchId; E.u = NUs; UNIT[NUs++] = E.tex;
    return E.u;
  }
  // G.shot(): a copy of the screen as soon as a frame has drawn it - the drawing buffer is not kept between frames (below), so
  // a picture of the screen is taken in the task that drew it -> Promise of a 2D canvas (bug reports, screenshots)
  const SHOTS = []; let drewScreen = false;
  G.shot = () => new Promise((res) => { SHOTS.push(res); });
  function endFlush() {
    G.pend = false; flush();
    if (drewScreen && SHOTS.length) {
      const c = document.createElement('canvas'); c.width = VIEW.width; c.height = VIEW.height;
      try { c.getContext('2d').drawImage(VIEW, 0, 0); } catch (e) { /* (a lost context: an empty picture) */ }
      for (const res of SHOTS.splice(0)) res(c);
    }
    drewScreen = false;
  }

  // ---------------- GL state ----------------
  const Z = gl.ZERO, ONE = gl.ONE, SA = gl.SRC_ALPHA, DA = gl.DST_ALPHA, OMSA = gl.ONE_MINUS_SRC_ALPHA, OMDA = gl.ONE_MINUS_DST_ALPHA;
  const BL = {
    'source-over': [ONE, OMSA, ONE, OMSA], lighter: [ONE, ONE, ONE, ONE], multiply: [gl.DST_COLOR, OMSA, ONE, OMSA],
    screen: [ONE, gl.ONE_MINUS_SRC_COLOR, ONE, OMSA], 'destination-out': [Z, OMSA, Z, OMSA], 'destination-in': [Z, SA, Z, SA],
    'source-atop': [DA, OMSA, Z, ONE], 'destination-over': [OMDA, ONE, OMDA, ONE], xor: [OMDA, OMSA, OMDA, OMSA],
    'source-in': [DA, Z, DA, Z], 'source-out': [OMDA, Z, OMDA, Z], 'destination-atop': [OMDA, SA, OMDA, SA],
    copy: [ONE, Z, ONE, Z], clear: [Z, Z, Z, Z],
  };
  // the modes that read what is under them (drawn one shape at a time over a copy of the target)
  const DSTMODE = { 'soft-light': 1, overlay: 2, 'hard-light': 3, difference: 4, exclusion: 5, 'color-dodge': 6, 'color-burn': 7, darken: 8, lighten: 9 };
  let curBlend = '', curFb = undefined, curRes = '', curCm = undefined, curMode = 0, onceK = 0;
  function applyBlend(k) {
    if (k === curBlend) return;
    curBlend = k;
    const b = BL[k] || BL['source-over'];
    gl.blendFuncSeparate(b[0], b[1], b[2], b[3]);
  }
  function applyCM(cm) {
    if (cm === curCm) return;
    curCm = cm;
    if (!cm) { gl.uniform1i(UNI.cmN, 0); return; }
    gl.uniform1i(UNI.cmN, cm.n); gl.uniformMatrix4fv(UNI.cm, false, cm.m); gl.uniform4fv(UNI.cmo, cm.o);
  }
  // stencil: high 4 bits = clip level, low 4 = a path's winding while it is filled
  function applyStencil(d, spec) {
    if (!spec) {
      gl.colorMask(true, true, true, true);
      gl.stencilFunc(gl.EQUAL, d << 4, 0xf0); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); gl.stencilMask(0);
      return;
    }
    const K = gl.KEEP;
    switch (spec) {
      case 'wind':     // nonzero winding into the low bits, inside the clip only
        gl.colorMask(false, false, false, false); gl.stencilFunc(gl.EQUAL, d << 4, 0xf0); gl.stencilMask(0x0f);
        gl.stencilOpSeparate(gl.FRONT, K, K, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, K, K, gl.DECR_WRAP); break;
      case 'windEO':   // even-odd
        gl.colorMask(false, false, false, false); gl.stencilFunc(gl.EQUAL, d << 4, 0xf0); gl.stencilMask(0x0f);
        gl.stencilOp(K, K, gl.INVERT); break;
      case 'mark':     // covered at least once (strokes)
        gl.colorMask(false, false, false, false); gl.stencilFunc(gl.EQUAL, (d << 4) | 1, 0xf0); gl.stencilMask(0x0f);
        gl.stencilOp(K, K, gl.REPLACE); break;
      case 'cover':    // paint where the winding is not 0, and set it back to 0
        gl.colorMask(true, true, true, true); gl.stencilFunc(gl.NOTEQUAL, d << 4, 0x0f); gl.stencilMask(0x0f);
        gl.stencilOp(K, K, gl.REPLACE); break;
      case 'clipIn':   // the winding becomes the next clip level
        gl.colorMask(false, false, false, false); gl.stencilFunc(gl.NOTEQUAL, (d + 1) << 4, 0x0f); gl.stencilMask(0xff);
        gl.stencilOp(K, K, gl.REPLACE); break;
      case 'once':     // (no clip) paint each pixel once: pass where the low bits are below this shape's number, then set it
        gl.colorMask(true, true, true, true); gl.stencilFunc(gl.GREATER, onceK, 0xff); gl.stencilMask(0x0f);
        gl.stencilOp(K, K, gl.REPLACE); break;
      case 'lowClear': // the low bits back to 0 (after up to 15 'once' shapes)
        gl.colorMask(false, false, false, false); gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilMask(0x0f);
        gl.stencilOp(K, K, gl.REPLACE); break;
      case 'clipOut':  // every level above d back to d
        gl.colorMask(false, false, false, false); gl.stencilFunc(gl.LESS, (d << 4) | 0x0f, 0xff); gl.stencilMask(0xf0);
        gl.stencilOp(K, K, gl.REPLACE); break;
    }
  }
  function bindTarget(T) {
    if (curFb !== T) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
      curFb = T;
      if (T.tex) for (let i = 0; i < NU; i++) if (BOUND[i] === T.tex) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); BOUND[i] = null; }
    }
    const w = T.fb ? T.w : VIEW.width, h = T.fb ? T.h : VIEW.height;
    const k = w + 'x' + h + (T.fb ? 'f' : 's');
    if (k !== curRes) {
      curRes = k;
      if (T.fb) gl.viewport(0, 0, w, h); else gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(UNI.res, w, h); gl.uniform1f(UNI.flip, T.fb ? 1 : -1);
    }
  }
  // ---------------- sharing the context with the WebGL layers (js/gl2d_layers.js) ----------------
  // a layer (the hero rig, glfx, ...) draws through a proxy of this same context into its own framebuffer; when it has
  // used the context last (`foreign`), our state is put back before we draw, upload or read anything
  let foreign = null;
  function ours() {
    if (!foreign) return;
    foreign = null;
    resume();
  }
  function resume() {
    gl.useProgram(prog); gl.bindVertexArray(null);
    gl.enable(gl.BLEND); gl.enable(gl.STENCIL_TEST); gl.enable(gl.DITHER);
    for (const c of [gl.DEPTH_TEST, gl.CULL_FACE, gl.SCISSOR_TEST, gl.RASTERIZER_DISCARD, gl.POLYGON_OFFSET_FILL, gl.SAMPLE_ALPHA_TO_COVERAGE, gl.SAMPLE_COVERAGE]) gl.disable(c);
    gl.blendEquation(gl.FUNC_ADD);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL); gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    curBlend = ''; curFb = undefined; curRes = ''; curCm = undefined; curMode = -1;
    BOUND.fill(null);
    gl.activeTexture(gl.TEXTURE0 + U_GRAD); gl.bindTexture(gl.TEXTURE_2D, GRAD); BOUND[U_GRAD] = GRAD;
    gl.activeTexture(gl.TEXTURE0 + U_GPAR); gl.bindTexture(gl.TEXTURE_2D, GPAR); BOUND[U_GPAR] = GPAR;
    if (BD.tex) { gl.activeTexture(gl.TEXTURE0 + U_DST); gl.bindTexture(gl.TEXTURE_2D, BD.tex); BOUND[U_DST] = BD.tex; }
  }
  function flush() {
    if (!Bt.vn || G.lost) { Bt.vn = Bt.in = 0; NUs = 0; batchId++; return; }
    ours();
    if (B.spec && B.target.fb && !B.target.rb) needStencil(B.target);
    bindTarget(B.target);
    if (B.target === SCREEN) drewScreen = true;
    applyBlend(B.spec && B.spec !== 'cover' && B.spec !== 'once' ? 'source-over' : DSTMODE[B.blend] ? 'copy' : B.blend);
    applyStencil(B.depth, B.spec);
    applyCM(B.cm);
    const mode = DSTMODE[B.blend] || 0;
    if (mode !== curMode) { curMode = mode; gl.uniform1i(UNI.mode, mode); }
    for (let i = 0; i < NUs; i++)
      if (BOUND[i] !== UNIT[i]) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, UNIT[i]); BOUND[i] = UNIT[i]; }
    const R = RINGS[(ring = (ring + 1) % RINGS.length)];
    gl.bindVertexArray(R.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.vb);
    // fresh storage for every batch (bufferData, not bufferSubData): a frame cuts its batch 100+ times (each blend switch
    // of a pile of drops, a crowd), and writing over one of the three buffers while a draw of the same frame still reads
    // it stalled the GPU (2026-10-21: 60 gear drops 24 fps, 120 drops 13; tests/browser/gl2d-buffer-reuse.spec.mjs)
    gl.bufferData(gl.ARRAY_BUFFER, F, gl.DYNAMIC_DRAW, 0, Bt.vn * STRIDE);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, IB, gl.DYNAMIC_DRAW, 0, Bt.in);
    gl.drawElements(gl.TRIANGLES, Bt.in, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
    G.stats.draws++;
    if (B.spec) { G.stats.special++; applyStencil(B.depth, null); }
    Bt.vn = Bt.in = 0; NUs = 0; batchId++;
  }
  // one special stencil pass: the geometry `fill` writes is drawn on its own with that stencil setup
  function pass(spec, fill) {
    flush();
    B.spec = spec;
    fill();
    flush();
    B.spec = null;
  }

  // ---------------- textures ----------------
  const TEX = new WeakMap(), LIVE = new Set();
  let texBytes = 0, gen = 1, upMs = 0;
  // pictures kept on the graphics card (unused ones go first when over); the 46-job skill sweep reached ~750 MB unbounded
  const BUDGET = (navigator.deviceMemory && navigator.deviceMemory < 4) || /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) ? 192e6
    : navigator.deviceMemory && navigator.deviceMemory < 8 ? 384e6 : 640e6;
  G.upBudget = 6; // ms of first uploads of pictures per frame (the rest wait a frame: a little pop-in, no hitch)
  function newEntry() { return { tex: null, tw: 0, th: 0, sw: 0, sh: 0, ver: -1, b: 0, u: 0, used: 0, bytes: 0, mip: false, flip: false, upF: -99, gen }; }
  function texParams(mip) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  }
  let shrinkCv = null;
  function upload(E, src, w, h, kind) {
    ours();
    const t0 = performance.now();
    if (!E.tex) {
      E.tex = gl.createTexture(); LIVE.add(E);
      gl.activeTexture(gl.TEXTURE0 + U_UP); gl.bindTexture(gl.TEXTURE_2D, E.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else { gl.activeTexture(gl.TEXTURE0 + U_UP); gl.bindTexture(gl.TEXTURE_2D, E.tex); }
    let s = src, tw = w, th = h;
    if (w > MAXT || h > MAXT) { // too big for this graphics card: a smaller copy (uv stay 0..1)
      const k = MAXT / Math.max(w, h);
      tw = Math.max(1, Math.floor(w * k)); th = Math.max(1, Math.floor(h * k));
      shrinkCv = shrinkCv || document.createElement('canvas');
      shrinkCv.width = tw; shrinkCv.height = th;
      shrinkCv.getContext('2d').drawImage(src, 0, 0, tw, th);
      s = shrinkCv;
    }
    try {
      if (E.tw === tw && E.th === th) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, s);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);
    } catch (e) { // (a picture from another site, a canvas the browser will not hand over)
      if (!G._warned[e.name]) { G._warned[e.name] = 1; console.warn('gl2d: upload', e.name, e.message); }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      tw = th = 1;
    }
    const mip = tw * th > 64 && (kind === 0 || kind === 3 || (kind === 1 && G.frame - E.upF > 30));
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    if (mip !== E.mip || E.tw !== tw || E.th !== th) texParams(mip);
    E.mip = mip;
    texBytes -= E.bytes;
    E.bytes = tw * th * 4 * (mip ? 1.34 : 1);
    texBytes += E.bytes;
    E.tw = tw; E.th = th; E.sw = w; E.sh = h; E.upF = G.frame;
    G.stats.uploads++; G.stats.uploadMB += (tw * th * 4) / 1048576;
    upMs += performance.now() - t0;
  }
  // the texture entry to draw `src` with, uploaded and current; null = nothing to draw (yet). keep = drawn into an offscreen
  // GL canvas: never left for a later frame (only the screen may pop in; a crowd picture is baked once and reused: right
  // after a warp a knight's hat was left out of one, 2026-10-19)
  function texFor(src, keep) {
    if (!src) return null;
    if (src.__gl2d) return src.__gl2d.entry();
    let E = src.__glE;
    if (E && E.gen === gen && E.tex) { // (seen before: the quick way)
      if (E.kind === 3 || (E.kind === 0 && E.ver === (src.__glv | 0))) { E.used = G.frame; return E; } // (a picture given a new src: uploaded again)
      if (E.kind === 1 && E.ver === (src.__glv | 0) && E.sw === src.width && E.sh === src.height) { E.used = G.frame; return E; }
    }
    let w, h, kind;
    if (src instanceof HTMLImageElement) { if (!src.complete || !src.naturalWidth) return null; w = src.naturalWidth; h = src.naturalHeight; kind = 0; }
    else if (src instanceof HTMLCanvasElement) { w = src.width; h = src.height; kind = 1; }
    else if (src instanceof HTMLVideoElement) { if (src.readyState < 2) return null; w = src.videoWidth; h = src.videoHeight; kind = 2; }
    else if (window.ImageBitmap && src instanceof ImageBitmap) { w = src.width; h = src.height; kind = 3; }
    else if (window.OffscreenCanvas && src instanceof OffscreenCanvas) { w = src.width; h = src.height; kind = 2; }
    else if (window.SVGImageElement && src instanceof SVGImageElement) { w = src.width.baseVal.value; h = src.height.baseVal.value; kind = 0; }
    else return null;
    if (!w || !h) return null;
    if (!E || E.gen !== gen) { E = newEntry(); try { src.__glE = E; } catch (e) { TEX.set(src, E); } }
    E.kind = kind;
    const ver = kind === 1 || kind === 0 ? src.__glv | 0 : kind === 2 ? G.frame : 0;
    E.used = G.frame;
    if (E.tex && E.ver === ver && E.sw === w && E.sh === h) return E;
    if (!E.tex && kind === 0 && upMs > G.upBudget && !keep) return null;
    if (E.b === batchId) flush(); // (the batch still draws the old picture)
    upload(E, src, w, h, kind);
    E.ver = ver;
    return E;
  }
  function evict() {
    const old = [];
    for (const E of LIVE) if (G.frame - E.used > 60) old.push(E);
    old.sort((a, b) => a.used - b.used);
    for (const E of old) {
      if (texBytes < BUDGET * 0.8) break;
      gl.deleteTexture(E.tex); E.tex = null; E.tw = E.th = 0; E.ver = -1; texBytes -= E.bytes; E.bytes = 0; LIVE.delete(E);
    }
  }

  // ---------------- targets: the screen, offscreen GL canvases ----------------
  const SCREEN = { fb: null, tex: null, w: 0, h: 0, flip: -1 };
  function makeTarget(T, w, h) {
    ours();
    // (the same size again = the canvas cleared, as a 2D canvas is when its width is set: no new texture or framebuffer -
    //  making them costs, most on Apple GPUs, and the crowd's pictures are given a size each time one is made, 2026-10-19)
    if (T.fb && T.w === w && T.h === h) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
      gl.clearColor(0, 0, 0, 0);
      if (T.rb) { gl.clearStencil(0); gl.stencilMask(0xff); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); gl.stencilMask(0); }
      else gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      curFb = undefined; curRes = '';
      return;
    }
    if (T.fb) { gl.deleteFramebuffer(T.fb); gl.deleteTexture(T.tex); if (T.rb) gl.deleteRenderbuffer(T.rb); }
    T.rb = null;
    T.w = w; T.h = h;
    T.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + U_UP); gl.bindTexture(gl.TEXTURE_2D, T.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    T.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.tex, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    curFb = undefined; curRes = '';
  }
  // a stencil for an offscreen target only once a clip / stencil pass needs one (crowd pictures are many and rarely clip)
  function needStencil(T) {
    T.rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, T.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, T.w, T.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, T.rb);
    gl.clearStencil(0); gl.stencilMask(0xff); gl.clear(gl.STENCIL_BUFFER_BIT); gl.stencilMask(0);
    curFb = undefined;
  }
  // an offscreen canvas drawn by the GPU (the night light map): width / height / getContext('2d') like a canvas
  class GLCanvas {
    constructor(w, h) {
      this._T = { fb: null, tex: null, rb: null, w: 0, h: 0, flip: 1 };
      this._E = newEntry(); this._E.flip = false;
      this._ctx = null; this._mc = null; this.__gl2d = this;
      this._size(Math.max(1, w | 0 || 300), Math.max(1, h | 0 || 150));
    }
    _size(w, h) {
      if (this._T.tex && this._E.b === batchId) flush();
      if (B.target === this._T) flush();
      if (!G.lost) makeTarget(this._T, w, h);
      this._E.tex = this._T.tex; this._E.tw = this._E.sw = w; this._E.th = this._E.sh = h;
      if (this._ctx) this._ctx._reset();
      if (this._mc) { this._mc.width = w; this._mc.height = h; }
    }
    get width() { return this._T.w; }
    set width(v) { this._size(Math.max(1, v | 0), this._T.h); }
    get height() { return this._T.h; }
    set height(v) { this._size(this._T.w, Math.max(1, v | 0)); }
    resize(w, h) { this._size(Math.max(1, w | 0), Math.max(1, h | 0)); } // (both sides in one go: setting width then height made the texture twice)
    getContext(type) { return type === '2d' ? this._ctx || (this._ctx = new G.Ctx(this, this._T)) : null; }
    entry() { this._E.used = G.frame; return this._E; }
  }
  // ---------------- the backdrop: a copy of a target, for effects that read the screen (zoom punch, soft-light) ----------------
  const BD = { fb: null, tex: null, w: 0, h: 0 };
  const BDE = newEntry();
  function backdrop(T, x0, y0, x1, y1) {
    flush();
    ours();
    const w = T.fb ? T.w : gl.drawingBufferWidth, h = T.fb ? T.h : gl.drawingBufferHeight;
    if (BD.w < w || BD.h < h || !BD.fb) {
      if (BD.fb) { gl.deleteFramebuffer(BD.fb); gl.deleteTexture(BD.tex); }
      BD.w = Math.max(w, BD.w); BD.h = Math.max(h, BD.h);
      BD.tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + U_DST); gl.bindTexture(gl.TEXTURE_2D, BD.tex); BOUND[U_DST] = BD.tex;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, BD.w, BD.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
      BD.fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, BD.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, BD.tex, 0);
      curFb = undefined;
    }
    if (x0 === undefined) { x0 = 0; y0 = 0; x1 = w; y1 = h; }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(w, Math.ceil(x1)); y1 = Math.min(h, Math.ceil(y1));
    if (x1 > x0 && y1 > y0) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, BD.fb);
      gl.blitFramebuffer(x0, y0, x1, y1, x0, y0, x1, y1, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); curFb = T;
    BDE.tex = BD.tex; BDE.tw = BD.w; BDE.th = BD.h; BDE.sw = w; BDE.sh = h; BDE.flip = !T.fb; BDE.used = G.frame;
    return BDE;
  }

  // ---------------- gradient rows ----------------
  // 256 colours per gradient (premultiplied), one row each; two-circle radials also keep their circles in GPAR
  let GRAD = null, GPAR = null;
  const ROWS = new Map(), ROWB = new Int32Array(GR), ROWT = new Int32Array(GR);
  let rowNext = 0;
  function makeGradTex() {
    GRAD = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + U_GRAD); gl.bindTexture(gl.TEXTURE_2D, GRAD); BOUND[U_GRAD] = GRAD;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, GR, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    GPAR = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + U_GPAR); gl.bindTexture(gl.TEXTURE_2D, GPAR); BOUND[U_GPAR] = GPAR;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 2, GR, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    ROWS.clear(); rowNext = 0;
  }
  const ROWPX = new Uint8Array(256 * 4), PARF = new Float32Array(8);
  // the row for a gradient: key = its stops (+ its circles for a two-circle radial), rows reused oldest first
  function rowOf(g, two) {
    const key = two ? g.key() + '@' + g.x0 + ',' + g.y0 + ',' + g.r0 + ',' + g.x1 + ',' + g.y1 + ',' + g.r1 : g.key();
    let r = ROWS.get(key);
    if (r !== undefined) { ROWT[r] = G.frame; return r; }
    // a free row, else the one used longest ago
    if (ROWS.size < GR) r = rowNext++;
    else {
      let best = -1, bt = Infinity;
      for (let i = 0; i < GR; i++) if (ROWT[i] < bt) { bt = ROWT[i]; best = i; }
      r = best;
      for (const [k, v] of ROWS) if (v === r) { ROWS.delete(k); break; }
      if (ROWB[r] === batchId) flush();
    }
    ROWS.set(key, r); ROWT[r] = G.frame;
    g.fillRow(ROWPX);
    ours();
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); // (the row is premultiplied already; the circles are numbers)
    gl.activeTexture(gl.TEXTURE0 + U_GRAD);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, ROWPX);
    if (two) {
      PARF[0] = g.x0; PARF[1] = g.y0; PARF[2] = g.r0; PARF[3] = 0; PARF[4] = g.x1; PARF[5] = g.y1; PARF[6] = g.r1; PARF[7] = 0;
      gl.activeTexture(gl.TEXTURE0 + U_GPAR);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r, 2, 1, gl.RGBA, gl.FLOAT, PARF);
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    return r;
  }
  function useRow(r) { ROWB[r] = batchId; }

  // ---------------- canvases that changed: every 2D / WebGL draw bumps its canvas's __glv ----------------
  const C2 = CanvasRenderingContext2D.prototype;
  for (const m of ['drawImage', 'fillRect', 'clearRect', 'strokeRect', 'fill', 'stroke', 'fillText', 'strokeText', 'putImageData', 'reset']) {
    const f = C2[m];
    if (!f) continue;
    C2[m] = m === 'drawImage'
      ? function (src) {
        const c = this.canvas; if (c) c.__glv = (c.__glv | 0) + 1;
        if (src === VIEW && G.pend) flush();
        if (src && src.__glLayer) { // (a WebGL layer drawn into a plain 2D canvas: js/gl2d_layers.js - only the part used is read back)
          const a = arguments;
          arguments[0] = a.length >= 9 ? src.__glLayer.toCanvas(a[1], a[2], a[3], a[4]) : src.__glLayer.toCanvas();
        }
        return f.apply(this, arguments);
      }
      : function () { const c = this.canvas; if (c) c.__glv = (c.__glv | 0) + 1; return f.apply(this, arguments); };
  }
  { // a picture given a new src counts as changed too (read per draw, the src string itself was 1% of a crowded frame)
    const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { this.__glv = (this.__glv | 0) + 1; d.set.call(this, v); } });
  }
  for (const k of ['width', 'height']) {
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, k);
    Object.defineProperty(HTMLCanvasElement.prototype, k, { configurable: true, enumerable: d.enumerable, get: d.get, set(v) {
      if (this === VIEW) { flush(); d.set.call(this, v); if (G.ctx) G.ctx._reset(); curRes = ''; return; }
      this.__glv = (this.__glv | 0) + 1; d.set.call(this, v);
    } });
  }
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const m of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer']) {
      const f = P[m];
      if (!f) continue;
      P[m] = function () { if (this !== gl) { const c = this.canvas; if (c) c.__glv = (c.__glv | 0) + 1; } return f.apply(this, arguments); };
    }
    for (const m of ['texImage2D', 'texSubImage2D']) { // (another context reading the game screen: our batch first)
      const f = P[m];
      P[m] = function () {
        if (this !== gl) for (let i = 0; i < arguments.length; i++) {
          if (arguments[i] === VIEW && G.pend) { flush(); break; }
          if (arguments[i] && arguments[i].__glLayer) { arguments[i] = arguments[i].__glLayer.toCanvas(); break; }
        }
        return f.apply(this, arguments);
      };
    }
  }
  for (const m of ['toDataURL', 'toBlob']) {
    const f = HTMLCanvasElement.prototype[m];
    HTMLCanvasElement.prototype[m] = function () { if (this === VIEW) flush(); if (this.__glLayer) return f.apply(this.__glLayer.toCanvas(), arguments); return f.apply(this, arguments); };
  }
  if (window.createImageBitmap) { const f = window.createImageBitmap; window.createImageBitmap = function (src) { if (src === VIEW) flush(); if (src && src.__glLayer) arguments[0] = src.__glLayer.toCanvas(); return f.apply(this, arguments); }; }

  // ---------------- start ----------------
  function init() {
    prog = makeProgram();
    makeBuffers();
    makeGradTex();
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.enable(gl.BLEND); gl.enable(gl.STENCIL_TEST); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.blendEquation(gl.FUNC_ADD);
    curBlend = ''; curFb = undefined; curRes = ''; curCm = undefined; curMode = 0;
    BOUND.fill(null); BOUND[U_GRAD] = GRAD; BOUND[U_GPAR] = GPAR;
    BD.fb = null; BD.w = BD.h = 0;
    applyStencil(0, null);
  }
  try { init(); } catch (e) { fallback('shader: ' + e.message); return; }

  VIEW.addEventListener('webglcontextlost', (e) => { e.preventDefault(); G.lost = true; console.warn('gl2d: context lost'); }, false);
  VIEW.addEventListener('webglcontextrestored', () => {
    gen++; LIVE.clear(); texBytes = 0; ROWS.clear();
    try { init(); } catch (e) { console.warn('gl2d: restore failed', e); return; }
    for (const r of G._canvases) { const c = r.deref(); if (c) c._size(c._T.w, c._T.h); }
    G.lost = false; if (G.ctx) G.ctx._reset();
    console.warn('gl2d: context restored');
  }, false);

  function tick() {
    G.frame++; upMs = 0;
    if (texBytes > BUDGET) evict();
    G.stats.texMB = +(texBytes / 1048576).toFixed(1); G.stats.textures = LIVE.size;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // the screen's pixels (straight alpha, top row first) - for tests and comparisons
  G.read = function (x = 0, y = 0, w = VIEW.width, h = VIEW.height) {
    flush();
    ours();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); curFb = SCREEN;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x, gl.drawingBufferHeight - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let r = 0; r < h; r++) {
      const s = (h - 1 - r) * w * 4, d = r * w * 4;
      for (let i = 0; i < w * 4; i += 4) {
        const a = px[s + i + 3];
        if (a === 0) continue;
        const k = 255 / a;
        out[d + i] = px[s + i] * k; out[d + i + 1] = px[s + i + 1] * k; out[d + i + 2] = px[s + i + 2] * k; out[d + i + 3] = a;
      }
    }
    return out;
  };
  // GLCanvases are made and dropped often (the crowd's hero pictures): weakly listed, their GPU memory freed when collected
  const FREE = new FinalizationRegistry(({ T, r }) => {
    G._canvases.delete(r);
    if (G.lost || !T.fb) return;
    ours();
    gl.deleteFramebuffer(T.fb); gl.deleteTexture(T.tex); if (T.rb) gl.deleteRenderbuffer(T.rb);
    T.fb = T.tex = T.rb = null;
  });
  G.canvas = (w, h) => { const c = new GLCanvas(w, h), r = new WeakRef(c); G._canvases.add(r); FREE.register(c, { T: c._T, r }); return c; };
  G.flush = flush;
  const forget = () => { curFb = undefined; curRes = ''; }; // (someone bound a framebuffer behind our back)
  G.on = true;
  G._warned = {};
  G._canvases = new Set();
  // the parts the other gl2d files use
  G._ = { gl, VIEW, NU, MAXV, F, UI, IB, Bt, B, BL, DSTMODE, SCREEN, vtx, tri, state, begin, unitOf, flush, pass, texFor,
    backdrop, rowOf, useRow, GLCanvas, forget, setOnce: (k) => { onceK = k; }, ours, resume, needStencil,
    setForeign: (L) => { foreign = L; }, get foreign() { return foreign; }, get prog() { return prog; }, get batchId() { return batchId; } };
})();
