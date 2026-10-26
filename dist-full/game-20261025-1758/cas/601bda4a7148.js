/* uberfx.js — ONE effect shader for every piece, the way engine VFX is built (2026-10-20, a test on one skill: เสาเพลิง,
   js/uberfx_pillar.js). Each piece is a quad (or a band mesh) drawn with a MATERIAL:
     main      a grayscale texture: tiling / offset / scroll / rotation (+ spin), or POLAR uv (angle, radius: rings, vortexes)
     mask      a second texture with its own tiling / scroll, multiplied in (a column, a flame tongue, a ring band)
     distort   a noise texture that pushes the main and mask uv about (heat wobble; o.root: stronger toward the top)
     dissolve  a noise threshold driven over the piece's life, a coloured burning edge leading it
     ramp      a colour ramp looked up by the brightness (main x mask x k), or a plain tint
     blend     additive (light) or alpha (smoke); additive pieces may add a soft GLOW pass (the same piece wider, its
               textures read from blurred mip levels: a cheap bloom)
   Over-life curves (alpha, size, dissolve ...) are small baked arrays sampled by life 0..1 (UF.curve / UF.at).
   The textures are Codex pictures (assets/gen/make_uberfx_prompts.py -> tools/uberfx_cut.py -> assets/uberfx/): nothing is
   drawn by code, the shader only scrolls, masks, bends, tints and dissolves them.
   Pieces are pushed from FX drawers of the 'low' or 'glow' layer (world coordinates) with UF.quad / UF.band; at the end of
   that layer the queue is drawn into a WebGL canvas and copied onto the game canvas (additive runs 'lighter'), like
   js/glfx.js. Load before glfx.js (its camera punch then takes these pieces too). No WebGL2: UF.ok() false. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX) return;
  const UF = (NC.UberFX = { on: true });
  const MAN = NC.ASSET_MANIFEST_UBERFX || {};
  const IMG = {};
  for (const n in MAN) { const im = new Image(); im.src = MAN[n].src; IMG[n] = im; }
  const okImg = (im) => im && im.complete && im.naturalWidth > 0;
  UF.ready = (...names) => names.every((n) => okImg(IMG[n]));
  UF.MAN = MAN;

  const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; in vec4 a_col; in vec4 a_p;
uniform vec2 u_res;
out vec2 v_uv; out vec4 v_col; out vec4 v_p;
void main() { vec2 c = a_pos / u_res * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); v_uv = a_uv; v_col = a_col; v_p = a_p; }`;

  // v_col: tint (rgb, x the piece's intensity: may go over 1) + alpha; v_p: dissolve 0..1, seed, mip bias (the glow pass), -
  const FS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec4 v_col; in vec4 v_p;
uniform sampler2D u_main, u_mask, u_dist, u_dis, u_ramp;
uniform float u_time;
uniform vec4 u_on;       // mask, distort, dissolve, ramp (0 / 1)
uniform vec4 u_mT;       // main tile xy, offset zw
uniform vec4 u_mS;       // main scroll xy (uv / s), rotation z, spin w (rad / s)
uniform vec4 u_mP;       // polar main (0 / 1), polar mask (0 / 1), twist (angle turns per radius), contrast power
uniform vec4 u_kT;       // mask tile xy, offset zw
uniform vec4 u_kS;       // mask scroll xy, how much distortion it takes z, -
uniform vec4 u_dT;       // distort tile xy, scroll zw
uniform vec4 u_dK;       // distort amount (uv) x, rooted y (0: even, 1: none at the bottom, full at the top), polar z, -
uniform vec4 u_xT;       // dissolve tile xy, edge width z, softness w
uniform vec3 u_edge;     // the burning edge's colour (may go over 1)
uniform vec4 u_rK;       // ramp: brightness factor x, offset y; coverage z (alpha pieces: opaque from v = z on); exposure w (0: off)
uniform float u_add;
out vec4 o;
const float TAU = 6.2831853;
// polar uv (angle 0..1 + twist x radius, radius 0..1 at the quad's edge) and a twin with its seam on the other side:
// the gradients come from whichever has none (the angle jumps 1 -> 0 at its seam, which would pick the smallest mip)
void polar(vec2 uv, float twist, out vec2 p, out vec2 p2) {
  vec2 c = uv * 2.0 - 1.0;
  float r = length(c), a = atan(c.y, c.x) / TAU + 0.5;
  p = vec2(a + r * twist, r);
  p2 = vec2(fract(a + 0.5) - 0.5 + r * twist, r);
}
vec2 pick(vec2 g, vec2 g2) { return vec2(abs(g.x) < abs(g2.x) ? g.x : g2.x, g.y); }
float samp(sampler2D s, vec2 p, vec2 p2, float b) {
  vec2 gx = pick(dFdx(p), dFdx(p2)) * b, gy = pick(dFdy(p), dFdy(p2)) * b;
  return textureGrad(s, p, gx, gy).r;
}
vec2 rot2(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
void main() {
  float t = u_time, seed = v_p.y, b = exp2(v_p.z);
  vec2 uv = v_uv;
  // distortion: two reads of the noise (x, y), centred on 0
  vec2 d = vec2(0.0);
  if (u_on.y > 0.5) {
    vec2 q, q2;
    if (u_dK.z > 0.5) polar(uv, 0.0, q, q2); else { q = uv; q2 = uv; }
    vec2 o1 = u_dT.zw * t + seed * 0.37;
    float n1 = samp(u_dist, q * u_dT.xy + o1, q2 * u_dT.xy + o1, b);
    float n2 = samp(u_dist, q * u_dT.xy + o1 + vec2(0.43, 0.71), q2 * u_dT.xy + o1 + vec2(0.43, 0.71), b);
    d = (vec2(n1, n2) - 0.5) * 2.0 * u_dK.x * mix(1.0, 1.0 - uv.y, u_dK.y);
  }
  // main
  vec2 m1, m2;
  if (u_mP.x > 0.5) polar(uv, u_mP.z, m1, m2);
  else { m1 = rot2(uv - 0.5, u_mS.z + u_mS.w * t) + 0.5; m2 = m1; }
  vec2 mo = u_mT.zw + u_mS.xy * t + seed + d;
  float m = samp(u_main, m1 * u_mT.xy + mo, m2 * u_mT.xy + mo, b);
  m = pow(max(m, 0.0), u_mP.w);
  // mask
  float k = 1.0;
  if (u_on.x > 0.5) {
    vec2 k1, k2;
    if (u_mP.y > 0.5) polar(uv, 0.0, k1, k2); else { k1 = uv; k2 = uv; }
    vec2 ko = u_kT.zw + u_kS.xy * t + d * u_kS.z;
    k = samp(u_mask, k1 * u_kT.xy + ko, k2 * u_kT.xy + ko, b);
  }
  float v = m * k;
  // (a soft frame inside the quad's border: a clamped mask read from a blurred mip level, the glow pass, showed the quad's box)
  vec2 bd = min(uv, 1.0 - uv);
  v *= smoothstep(0.0, 0.05, min(bd.x, bd.y));
  float v0 = v;
  // dissolve: noise (a little of the piece's own brightness: its thin parts go first) against a threshold
  float edge = 0.0;
  if (u_on.z > 0.5) {
    vec2 x1 = uv * u_xT.xy + seed * 1.37 + d * 0.5;
    float n = samp(u_dis, x1, x1, b) * 0.78 + clamp(v, 0.0, 1.0) * 0.22;
    float am = v_p.x, w = u_xT.z, s = max(u_xT.w, 0.002);
    float th = am * (1.0 + w + s) - s;
    float keep = smoothstep(th, th + s, n);
    edge = (keep - smoothstep(th + w, th + w + s, n)) * smoothstep(0.0, 0.06, am) * smoothstep(0.02, 0.12, v0);
    v *= keep;
  }
  vec3 c;
  float A;
  if (u_on.w > 0.5) {
    float L = clamp(v * u_rK.x + u_rK.y, 0.0, 1.0);
    c = texture(u_ramp, vec2(0.004 + L * 0.992, 0.5)).rgb * v_col.rgb;
    A = clamp(v / max(u_rK.z, 0.001), 0.0, 1.0);
  } else { c = v_col.rgb * (u_add > 0.5 ? v : 1.0); A = clamp(v / max(u_rK.z, 0.001), 0.0, 1.0); }   // (an alpha piece: its tint, coverage by v)
  c += u_edge * edge;
  if (u_rK.w > 0.0) c = vec3(1.0) - exp(-c * u_rK.w);   // (a soft shoulder: piled-up light goes warm-white slowly, never a flat white)
  float a = v_col.a;
  if (u_add > 0.5) { c = max(c, 0.0) * a; o = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0)); }
  else { float al = clamp(A, 0.0, 1.0) * a; o = vec4(clamp(c, 0.0, 1.0) * al, al); }
}`;

  let glc = null, gl = null, prog = null, vbo = null, U = {}, failed = false, glLost = 0;
  let TEX = new Map();
  const STRIDE = 12;
  let buf = new Float32Array(STRIDE * 6 * 512);
  function init() {
    if (gl && gl.isContextLost()) { gl = null; TEX = new Map(); failed = ++glLost > 3; }
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
      att('a_pos', 2, 0); att('a_uv', 2, 2); att('a_col', 4, 4); att('a_p', 4, 8);
      for (const n of ['res', 'time', 'on', 'mT', 'mS', 'mP', 'kT', 'kS', 'dT', 'dK', 'xT', 'edge', 'rK', 'add']) U[n] = gl.getUniformLocation(prog, 'u_' + n);
      ['u_main', 'u_mask', 'u_dist', 'u_dis', 'u_ramp'].forEach((n, i) => gl.uniform1i(gl.getUniformLocation(prog, n), i));
      gl.enable(gl.BLEND);
      gl.enable(gl.SCISSOR_TEST);
      return true;
    } catch (e) {
      failed = true; gl = null;
      console.warn('uberfx: off', e && e.message);
      return false;
    }
  }
  UF.ok = () => UF.on && init();
  UF.error = () => failed;
  // a texture per picture: noise tiles (MAN wrap 'repeat'), shapes and ramps clamp; mipmaps for the glow pass
  function tex(n) {
    let t = TEX.get(n);
    if (t) return t;
    const im = IMG[n];
    if (!okImg(im)) return null;
    t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    gl.generateMipmap(gl.TEXTURE_2D);
    const wrap = MAN[n].wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    TEX.set(n, t);
    return t;
  }

  // ---------------- materials ----------------
  // UF.mat({ main, tile, off, scroll, rot, spin, polar, twist, pow,
  //          mask, maskTile, maskOff, maskScroll, maskPolar, maskDistort,
  //          distort, distTile, distScroll, distAmt, distRoot, distPolar,
  //          dissolve, disTile, edge, soft, edgeCol,
  //          ramp, rampK, rampOff, cover, expo, add })
  let matId = 0;
  UF.mat = function (d) {
    const M = Object.assign({ tile: [1, 1], off: [0, 0], scroll: [0, 0], rot: 0, spin: 0, polar: false, twist: 0, pow: 1,
      maskTile: [1, 1], maskOff: [0, 0], maskScroll: [0, 0], maskPolar: false, maskDistort: 1,
      distTile: [1, 1], distScroll: [0, 0], distAmt: 0.05, distRoot: 0, distPolar: false,
      disTile: [1, 1], edge: 0.07, soft: 0.03, edgeCol: [1.6, 0.8, 0.3],
      rampK: 1, rampOff: 0, cover: 0.08, expo: 0, add: true }, d);
    M.id = ++matId;
    M.need = [M.main, M.mask, M.distort, M.dissolve, M.ramp].filter(Boolean);
    return M;
  };
  function setMat(M) {
    const on = [M.mask ? 1 : 0, M.distort ? 1 : 0, M.dissolve ? 1 : 0, M.ramp ? 1 : 0];
    const units = [M.main, M.mask || M.main, M.distort || M.main, M.dissolve || M.main, M.ramp || M.main];
    for (let i = 0; i < 5; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex(units[i])); }
    gl.uniform4f(U.on, on[0], on[1], on[2], on[3]);
    gl.uniform4f(U.mT, M.tile[0], M.tile[1], M.off[0], M.off[1]);
    gl.uniform4f(U.mS, M.scroll[0], M.scroll[1], M.rot, M.spin);
    gl.uniform4f(U.mP, M.polar ? 1 : 0, M.maskPolar ? 1 : 0, M.twist, M.pow);
    gl.uniform4f(U.kT, M.maskTile[0], M.maskTile[1], M.maskOff[0], M.maskOff[1]);
    gl.uniform4f(U.kS, M.maskScroll[0], M.maskScroll[1], M.maskDistort, 0);
    gl.uniform4f(U.dT, M.distTile[0], M.distTile[1], M.distScroll[0], M.distScroll[1]);
    gl.uniform4f(U.dK, M.distAmt, M.distRoot, M.distPolar ? 1 : 0, 0);
    gl.uniform4f(U.xT, M.disTile[0], M.disTile[1], M.edge, M.soft);
    gl.uniform3f(U.edge, M.edgeCol[0], M.edgeCol[1], M.edgeCol[2]);
    gl.uniform4f(U.rK, M.rampK, M.rampOff, M.cover, M.expo);
    gl.uniform1f(U.add, M.add ? 1 : 0);
  }

  // ---------------- the queue (world coordinates) ----------------
  const Q = { low: [], glow: [] };
  // o: a (alpha), k (intensity), tint [r, g, b], dis (dissolve 0..1), seed, ax / ay (the anchor: 0.5, 0.5 the middle;
  // ay 1 standing on y), squash (flattened onto the ground: SQ), flip, glow (the glow pass's strength), gs (its size, 1.3)
  const vert = (x, y, u, v, col, p) => [x, y, u, v, col[0], col[1], col[2], col[3], p[0], p[1], p[2], p[3]];
  function quadTris(x, y, w, h, rot, o, s) {
    const ca = Math.cos(rot || 0), sa = Math.sin(rot || 0), sq = o.squash || 1, ax = o.ax === undefined ? 0.5 : o.ax, ay = o.ay === undefined ? 0.5 : o.ay;
    // (the glow pass grows round the piece's middle, not its anchor)
    const P = (u, v) => { const lx = ((u - 0.5) * s + 0.5 - ax) * w, ly = ((v - 0.5) * s + 0.5 - ay) * h; return [x + ca * lx - sa * ly, y + (sa * lx + ca * ly) * sq]; };
    const c = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)], f = o.flip;
    const uv = f ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    return [[c[0], uv[0]], [c[1], uv[1]], [c[2], uv[2]], [c[0], uv[0]], [c[2], uv[2]], [c[3], uv[3]]];
  }
  function push(layer, M, tris, o, glowPass) {
    const k = o.k === undefined ? 1 : o.k, t = o.tint || [1, 1, 1];
    const a = Math.max(0, Math.min(1, (o.a === undefined ? 1 : o.a) * (glowPass ? (o.glow || 0) : 1)));
    if (a < 0.003) return;
    const col = [t[0] * k, t[1] * k, t[2] * k, a], p = [o.dis || 0, o.seed || 0, glowPass ? (o.gb === undefined ? 2.6 : o.gb) : 0, 0];
    Q[layer === 'low' ? 'low' : 'glow'].push({ M, verts: tris.map(([[x, y], [u, v]]) => vert(x, y, u, v, col, p)) });
  }
  UF.quad = function (layer, M, x, y, w, h, rot, o) {
    o = o || {};
    if (w < 0.5 || h < 0.5) return;
    if (o.glow > 0 && M.add) push(layer, M, quadTris(x, y, w, h, rot, o, o.gs || 1.3), o, true);
    push(layer, M, quadTris(x, y, w, h, rot, o, 1), o, false);
  };
  // a band along points [{x, y, w}] (w = half width): uv.x 0 -> 1 along it, uv.y 0 -> 1 across
  UF.band = function (layer, M, pts, o) {
    o = o || {};
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
    const tris = [];
    for (let i = 0; i < n - 1; i++) {
      const p = pts[i], q = pts[i + 1], sp = side[i], sq = side[i + 1];
      const A = [[p.x - sp[0], p.y - sp[1]], [sp[2], 0]], B = [[p.x + sp[0], p.y + sp[1]], [sp[2], 1]];
      const C = [[q.x - sq[0], q.y - sq[1]], [sq[2], 0]], D = [[q.x + sq[0], q.y + sq[1]], [sq[2], 1]];
      tris.push(A, C, D, A, D, B);
    }
    push(layer, M, tris, o, false);
  };

  // ---------------- drawing the queue onto the game canvas ----------------
  function flush(ctx, layer) {
    const items = Q[layer];
    if (!items.length) return;
    Q[layer] = [];
    if (!init()) return;
    const cv = ctx.canvas, W = cv.width, H = cv.height;
    if (glc.width !== W || glc.height !== H) { glc.width = W; glc.height = H; }
    gl.useProgram(prog);
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.res, W, H);
    gl.uniform1f(U.time, (NC.game && NC.game.time) || 0);
    const m = ctx.getTransform();
    let i = 0;
    while (i < items.length) {
      // a run: the same blend; inside it, one draw per material in a row
      const add = !!items[i].M.add;
      let j = i;
      while (j < items.length && !!items[j].M.add === add) j++;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const draws = [];
      for (let q = i; q < j; q++) {
        const it = items[q];
        if (!it.M.need.every((n) => okImg(IMG[n]))) continue;
        const last = draws[draws.length - 1];
        const d = last && last.M === it.M ? last : (draws.push({ M: it.M, vs: [] }), draws[draws.length - 1]);
        for (const v of it.verts) {
          const X = m.a * v[0] + m.c * v[1] + m.e, Y = m.b * v[0] + m.d * v[1] + m.f;
          if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
          d.vs.push(X, Y, v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11]);
        }
      }
      const bx = Math.max(0, Math.floor(x0) - 2), by = Math.max(0, Math.floor(y0) - 2);
      const bw = Math.min(W, Math.ceil(x1) + 2) - bx, bh = Math.min(H, Math.ceil(y1) + 2) - by;
      if (draws.length && bw > 0 && bh > 0) {
        gl.scissor(bx, H - by - bh, bw, bh);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendFunc(gl.ONE, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        for (const d of draws) {
          setMat(d.M);
          if (buf.length < d.vs.length) buf = new Float32Array(d.vs.length * 2);
          buf.set(d.vs);
          gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, d.vs.length), gl.STREAM_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, d.vs.length / STRIDE);
        }
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
  const baseDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    baseDraw.apply(this, arguments);
    if (layer === 'low' || layer === 'glow') flush(ctx, layer);
  };

  // ---------------- over-life curves: baked arrays ----------------
  // UF.curve([[u, v], ...], n) -> n samples of the piecewise curve (ease: 'smooth' rounds every segment); UF.at(arr, u)
  UF.curve = function (pts, n, ease) {
    n = n || 32;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      let v = pts[pts.length - 1][1];
      if (u <= pts[0][0]) v = pts[0][1];
      else for (let k = 1; k < pts.length; k++) if (u <= pts[k][0]) {
        const a = pts[k - 1], b = pts[k];
        let f = (u - a[0]) / (b[0] - a[0] || 1);
        if (ease === 'smooth') f = f * f * (3 - 2 * f);
        v = a[1] + (b[1] - a[1]) * f; break;
      }
      out[i] = v;
    }
    return out;
  };
  UF.at = function (arr, u) {
    const f = Math.max(0, Math.min(1, u)) * (arr.length - 1), i = Math.floor(f), r = f - i;
    return i >= arr.length - 1 ? arr[arr.length - 1] : arr[i] + (arr[i + 1] - arr[i]) * r;
  };

  // ---------------- effect items ----------------
  // UF.fx({ x, y, life, layer, t (< 0: later), draw(q, u) }): an FX item whose drawer pushes pieces
  FX.def('uf', (ctx, q, u) => { if (q.t >= 0 && q.ufDraw) q.ufDraw(q, Math.min(1, u)); }, 'glow');
  UF.fx = function (o) {
    const d = o.draw;
    delete o.draw;
    return FX.add(Object.assign({ type: 'uf', x: 0, y: 0, life: 1, ufDraw: d }, o));
  };
  // particles in one FX item: each { x, y, vx, vy, life, drag, grav, ... } moved here and drawn by draw(p, u)
  UF.parts = function (o) {
    return FX.add({ type: 'uf', layer: o.layer || 'glow', x: 0, y: 0, parts: o.parts || [], life: o.life || 3,
      ufDraw(q) { for (const p of q.parts) if (p.t >= 0) o.draw(p, Math.min(1, p.t / p.life)); },
      update(q, dt) {
        for (let i = q.parts.length - 1; i >= 0; i--) {
          const p = q.parts[i];
          p.t += dt;
          if (p.t >= p.life) { q.parts.splice(i, 1); continue; }
          if (p.t < 0) continue;
          const k = Math.exp(-(p.drag || 0) * dt);
          p.vx *= k; p.vy *= k; p.vy += (p.grav || 0) * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
        if (!q.parts.length && q.t > 0.05) q.dead = true;
      } });
  };
})();
