/* meshfx.js — slashes as MESHES (the user, 2026-10-15: "เราทำ vfx สกิลเป็น mesh ได้ไหม มีคำแนะนำไหม" -> "ลองทำรอยฟันเป็น mesh ให้
   ดูหน่อย"). The way stylized engine VFX makes a slash: the shape is a mesh, the look is a painting laid along it.
     the mesh      a band of triangles: along a 3D arc swept in the game's 3/4 camera (a scythe sweep: the far side rises, the
                   near side comes down to the ground), or along the blade's real path in the hero's swing (a weapon trail)
     the painting  a texture strip painted by Codex (assets/meshfx/strip_*.png, make_meshfx_prompts.py): the cutting edge
                   white-hot along the top, brush streaks of the slash's colours below, on black (drawn ADDED)
     the shader    u along the band (tail 0 -> head 1), v across (inner 0 -> edge 1): the painting scrolls along it (speed
                   lines running back), the tail thins, the band is eaten away by noise from the tail at the end with a
                   bright edge leading (a dissolve, not a fade); a dark copy laid under it keeps it readable on light ground
   MX.arc(layer, o)       an arc slash for this frame (o: x, y on the ground, h height, r radius, w width, a0 -> a1 angles in
                          its plane, tilt (0 flat on the ground .. PI/2 upright), yaw, head / tail 0..1, erode, strip, tint)
   MX.slash(o)            an FX item that sweeps an arc once (dur, life) and draws it on 'glow'
   MX.ribbon(ctx, pts, o) a band through [{a: [x, y], b: [x, y], u}] (a weapon trail) drawn at once on ctx
   MX.band(ctx, x0, y0, x1, y1, w, o)  a straight one (js/maplefx.js: the starlight beam, the heavy arrow's streak)
   ?meshslash=0: the old code-drawn hero trail and the old painted boss crescent. No WebGL2: the same. Load before glfx.js
   (its camera punch then includes these). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX) return;
  if (NC.ASSET_MANIFEST_MESHFX) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_MESHFX);
  const MX = (NC.MeshFX = { on: true });

  const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv;
uniform vec2 u_res;
out vec2 v_uv;
void main() { vec2 c = a_pos / u_res * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); v_uv = a_uv; }`;
  const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time, u_seed, u_erode, u_pan, u_rep, u_dark, u_alpha, u_tailK, u_lift, u_edgeK, u_edgeTex;
uniform vec3 u_tint;
out vec4 o;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.17; a *= 0.5; } return s / 0.9375; }
void main() {
  float u = v_uv.x, v = clamp(v_uv.y, 0.0, 1.0);
  // the painting along the band: x scrolls back toward the tail (speed lines), y: the strip's top (its cutting edge) on
  // the band's outer edge; a little warp so the streaks are never ruler-straight
  float w = (fbm(vec2(u * 6.0 - u_time * u_pan * 0.6, v * 3.0) + u_seed) - 0.5) * 0.06;
  vec4 tx = texture(u_tex, vec2(fract(u * u_rep - u_time * u_pan + u_seed), clamp(1.0 - v + w, 0.01, 0.99)));
  vec3 c = tx.rgb * tx.a;           // (a strip is opaque; a frame with alpha (js/maplefx.js) counts its alpha)
  c = mix(c, pow(c, vec3(0.72)) * 1.2, u_lift); // (the strip's streaky body is dim next to its edge: lifted so the whole band reads)
  // the tail thins out, the head is bright to its tip
  float m = smoothstep(0.0, u_tailK, u) * smoothstep(1.0, 0.965, u);
  // the dissolve: noise eats the band from the tail first, a hot edge leading it
  float n = fbm(vec2(u * 10.0 - u_time * u_pan * 1.4, v * 2.2) + u_seed * 3.1);
  float keep = n + u * 0.45 - u_erode * 1.45;
  float alive = smoothstep(0.0, 0.06, keep);
  float edge = (alive - smoothstep(0.06, 0.16, keep)) * step(0.001, u_erode) * tx.a; // (only where something is painted)
  float lum = max(c.r, max(c.g, c.b));
  if (u_dark > 0.5) {               // the dark band under the slash (normal blending): the painting's shape, darkened
    float a = clamp(lum * 1.6, 0.0, 1.0) * m * alive * u_alpha * 0.55;
    o = vec4(u_tint * a, a);
    return;
  }
  // the hot rim: white-hot (a strip) or the painting's own colour brightened (u_edgeTex: a painted frame)
  vec3 rim = mix(u_tint * 0.6 + 0.6, c * 1.5 + 0.08, u_edgeTex);
  vec3 col = c * u_tint * m * alive + edge * rim * m * 1.4 * u_edgeK;
  o = vec4(col * u_alpha, 0.0);     // (premultiplied, drawn added)
}`;

  let glc = null, gl = null, prog = null, vbo = null, U = {}, failed = false;
  const texs = new Map();
  let glLost = 0;
  function init() {
    // (the browser took the context away - a GPU reset, out of memory; js/crashguard.js counts it): a new one, as herospine does
    if (gl && gl.isContextLost()) { gl = null; texs.clear(); failed = ++glLost > 3; }
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
      const att = (name, size, off) => { const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 16, off * 4); };
      att('a_pos', 2, 0); att('a_uv', 2, 2);
      for (const k of ['res', 'tex', 'time', 'seed', 'erode', 'pan', 'rep', 'dark', 'alpha', 'tailK', 'tint', 'lift', 'edgeK', 'edgeTex']) U[k] = gl.getUniformLocation(prog, 'u_' + k);
      gl.uniform1i(U.tex, 0);
      gl.enable(gl.BLEND);
      return true;
    } catch (e) {
      failed = true; gl = null;
      console.warn('meshfx: off', e && e.message);
      return false;
    }
  }
  MX.ok = () => MX.on && init() && !!S('strip_steel');
  const S = (n) => { const s = NC.SPR[n]; return s && s.img && (s.img.naturalWidth || s.img.width) ? s : null; };
  // a strip by its sprite name, or any loaded picture (o.img: a painted frame, js/maplefx.js)
  function tex(name, img) {
    const key = img || name;
    if (texs.has(key)) return texs.get(key);
    const s = img ? { img } : S(name);
    if (!s || !(s.img.naturalWidth || s.img.width)) return null;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s.img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    texs.set(key, t);
    return t;
  }

  // ---------------- drawing a band: tris of [x, y, u, v] in world units, through ctx's transform ----------------
  // o: strip (or img), tint [r, g, b], dark (a dark band under it too), alpha, erode, pan, rep, seed, tailK, lift (0: the
  // picture as painted), edgeK (the dissolve's rim strength), edgeTex (1: the rim in the picture's own colours)
  function draw(ctx, tris, o) {
    if (!init() || !tris.length) return;
    const t = tex(o.strip || 'strip_steel', o.img);
    if (!t) return;
    const cv = ctx.canvas, W = cv.width, H = cv.height;
    if (glc.width !== W || glc.height !== H) { glc.width = W; glc.height = H; }
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.res, W, H);
    const m = ctx.getTransform(), buf = new Float32Array(tris.length * 4);
    for (let i = 0; i < tris.length; i++) {
      const [x, y, u, v] = tris[i];
      buf[i * 4] = m.a * x + m.c * y + m.e; buf[i * 4 + 1] = m.b * x + m.d * y + m.f; buf[i * 4 + 2] = u; buf[i * 4 + 3] = v;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STREAM_DRAW);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1f(U.time, (NC.game && NC.game.time) || 0);
    gl.uniform1f(U.seed, o.seed || 0); gl.uniform1f(U.erode, o.erode || 0); gl.uniform1f(U.pan, o.pan == null ? 1.6 : o.pan);
    gl.uniform1f(U.rep, o.rep || 1); gl.uniform1f(U.alpha, o.alpha == null ? 1 : o.alpha); gl.uniform1f(U.tailK, o.tailK || 0.35);
    gl.uniform1f(U.lift, o.lift == null ? 1 : o.lift);
    gl.uniform1f(U.edgeK, o.edgeK == null ? 1 : o.edgeK); gl.uniform1f(U.edgeTex, o.edgeTex || 0);
    const pass = (dark) => {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.dark, dark ? 1 : 0);
      const tint = dark ? (o.darkTint || [0.08, 0.03, 0.12]) : (o.tint || [1, 1, 1]);
      gl.uniform3f(U.tint, tint[0], tint[1], tint[2]);
      gl.blendFunc(gl.ONE, dark ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, tris.length);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = dark ? 'source-over' : 'lighter';
      ctx.drawImage(glc, 0, 0);
      ctx.restore();
    };
    if (o.dark) pass(true);
    pass(false);
  }

  // ---------------- the arc: a band swept along a circle in a tilted plane, seen by the game's camera ----------------
  // the game's camera: x across, ground depth y squashed to 0.6, height straight up
  const DEPTH = 0.6;
  function arcTris(o) {
    const N = 48, tilt = o.tilt || 0, yaw = o.yaw || 0;
    const e1 = [Math.cos(yaw), Math.sin(yaw), 0], e2 = [-Math.sin(yaw) * Math.cos(tilt), Math.cos(yaw) * Math.cos(tilt), Math.sin(tilt)];
    const P = (th, r) => {
      const px = (Math.cos(th) * e1[0] + Math.sin(th) * e2[0]) * r, py = (Math.cos(th) * e1[1] + Math.sin(th) * e2[1]) * r,
        pz = (Math.cos(th) * e1[2] + Math.sin(th) * e2[2]) * r;
      return [o.x + px, o.y + py * DEPTH - (o.h || 0) - pz];
    };
    const head = o.head == null ? 1 : o.head, tail = o.tail || 0;
    if (head - tail < 0.01) return [];
    const out = [];
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const f = i / N, s = tail + (head - tail) * f, th = o.a0 + (o.a1 - o.a0) * s;
      // thick toward the head, a point at the tip, nothing at the tail
      const k = Math.pow(f, 0.9) * Math.pow(1 - f * 0.92, 0.45) * 1.55, w = (o.w || 100) * k;
      const inner = P(th, o.r - w * 0.42), outer = P(th, o.r + w * 0.58);
      const cur = [inner, outer, f];
      if (prev) {
        const [i0, o0, f0] = prev, [i1, o1] = cur;
        out.push([...i0, f0, 0], [...o0, f0, 1], [...o1, f, 1], [...i0, f0, 0], [...o1, f, 1], [...i1, f, 0]);
      }
      prev = cur;
    }
    return out;
  }
  // queue per FX layer (an effect pushes from its drawer; drawn at the end of that layer, like glfx / paintgl)
  const Q = { low: [], glow: [] };
  MX.arc = (layer, o) => { if (MX.ok()) Q[layer].push([arcTris(o), o]); };
  MX.arcTris = arcTris; // (tests: the band's triangles)
  const baseDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    baseDraw.apply(this, arguments);
    const q = Q[layer];
    if (!q || !q.length) return;
    Q[layer] = [];
    for (const [tris, o] of q) draw(ctx, tris, o);
  };
  // a whole slash: the head sweeps fast (dur), the tail chases it (lag), then the band dissolves from the tail
  MX.slash = function (o) {
    const dur = o.dur || 0.2, lag = o.lag || dur * 0.6, life = o.life || dur + lag + 0.25, seed = Math.random() * 10;
    const out = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
    return FX.add({ type: 'custom', layer: 'glow', life, owner: o.owner, x: o.x, y: o.y, draw(ctx, p) {
      const t = p.t, head = out(t / dur), tail = out((t - lag) / dur) * 0.92;
      const erode = Math.max(0, (t - dur * 0.85) / (life - dur * 0.85));
      MX.arc('glow', Object.assign({}, o, { head, tail, erode, seed, alpha: o.alpha == null ? 1 : o.alpha }));
    } });
  };

  // ---------------- a ribbon through given edge pairs (a weapon trail), drawn at once ----------------
  // pts: [{a: [x, y] (the inner end), b: [x, y] (the edge end), u (0 oldest .. 1 newest)}]
  MX.ribbon = function (ctx, pts, o) {
    if (!MX.ok() || pts.length < 2) return false;
    const tris = [];
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      tris.push([...p0.a, p0.u, 0], [...p0.b, p0.u, 1], [...p1.b, p1.u, 1], [...p0.a, p0.u, 0], [...p1.b, p1.u, 1], [...p1.a, p1.u, 0]);
    }
    draw(ctx, tris, o);
    return true;
  };
  // a straight band from (x0, y0) (u 0, the tail) to (x1, y1) (u 1, the head), w wide (v 0 .. 1 across it), drawn at once
  MX.band = function (ctx, x0, y0, x1, y1, w, o) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 1) return false;
    const nx = (-(y1 - y0) / L) * w * 0.5, ny = ((x1 - x0) / L) * w * 0.5;
    return MX.ribbon(ctx, [{ a: [x0 + nx, y0 + ny], b: [x0 - nx, y0 - ny], u: 0 }, { a: [x1 + nx, y1 + ny], b: [x1 - nx, y1 - ny], u: 1 }], o);
  };

  // ---------------- the hero's swing trail as a mesh (entities.js NC.drawTrail's samples) ----------------
  // the strip by the weapon's trail colour: warm -> ember, violet / pink -> violet, else steel
  function stripFor(rgb) {
    const [r, g, b] = String(rgb || '215,235,255').split(',').map(Number);
    if (r > 200 && b < 170 && g < 230) return ['strip_ember', [1.05, 0.95, 0.85]];
    if (r > 150 && b > 150 && g < 150) return ['strip_violet', [1, 0.95, 1]];
    return ['strip_steel', [0.95, 1, 1.05]];
  }
  const baseTrail = NC.drawTrail;
  NC.drawTrail = function (ctx, game) {
    const p = game.player, T = p && p.trail;
    if (!MX.ok() || !T || T.length < 2) return baseTrail.apply(this, arguments);
    const W = NC.weaponDef(p), now = game.time, pts = [];
    const polar = (s) => ({ h: s.hand, a: Math.atan2(s.tip[1] - s.hand[1], s.tip[0] - s.hand[0]),
      r0: Math.hypot(s.base[0] - s.hand[0], s.base[1] - s.hand[1]), r1: Math.hypot(s.tip[0] - s.hand[0], s.tip[1] - s.hand[1]) });
    // the same smooth arc entities.js draws (big jumps between frames subdivided round the hand), as mesh rows
    for (let i = 1; i < T.length; i++) {
      const A0 = polar(T[i - 1]), A1 = polar(T[i]);
      let da = A1.a - A0.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      const n = Math.max(1, Math.ceil(Math.abs(da) / 0.12));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const f = k / n, h = [NC.lerp(A0.h[0], A1.h[0], f), NC.lerp(A0.h[1], A1.h[1], f)], a = A0.a + da * f;
        const r0 = NC.lerp(A0.r0, A1.r0, f), r1 = NC.lerp(A0.r1, A1.r1, f) * 1.12, tt = NC.lerp(T[i - 1].t, T[i].t, f);
        pts.push({ a: [h[0] + Math.cos(a) * NC.lerp(r0, r1, 0.25), h[1] + Math.sin(a) * NC.lerp(r0, r1, 0.25)], b: [h[0] + Math.cos(a) * r1, h[1] + Math.sin(a) * r1], t: tt });
      }
    }
    if (pts.length < 2) return;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = Math.max(0.001, t1 - t0);
    for (const q of pts) q.u = (q.t - t0) / span;
    const age = (now - t1) / 0.13; // (the newest sample's age: the whole band dissolves once the swing stops)
    const [strip, tint] = stripFor(W.trailRgb);
    MX.ribbon(ctx, pts, { strip, tint, alpha: 1, erode: Math.max(0, Math.min(1, age * 1.4)), pan: 2.2, rep: 1, seed: (T[0].t * 7) % 10, tailK: 0.5 });
  };
})();
