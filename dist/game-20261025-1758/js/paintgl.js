/* paintgl.js — PAINTED pictures drawn live by a shader (2026-10-15, the user picked "ภาพวาด + shader" for the old dungeon
   bosses' skills: Codex paints every piece, nothing is drawn by code, and the shader makes the paint MOVE instead of sliding
   a still sticker about). One quad per piece, its texture = the painted PNG (a sprite in NC.SPR), and in the shader:
     warp   the picture's uv pushed about by panning noise: flames lick upward, smoke churns, ooze wobbles
     flow   panning noise brightening and darkening the bright parts: energy running through a ring or a lane
     erode  the picture eaten away by noise from its thin parts, a bright edge leading (a dissolve instead of a fade)
     clip   only part of the picture (a lane filling from the boss outward, a column of fire reaching down)
     haze   no picture of its own: the game behind is bent by noise inside the piece's alpha (heat, a scream's ripple)
   An effect pushes pieces with PG.quad(layer, sprite, x, y, w, h, rot, o) from an FX drawer of the 'low' or 'glow' layer
   (world coordinates); at the end of that layer the queue is drawn into a WebGL canvas and copied onto the game canvas
   (normal and additive runs apart, like js/glfx.js). PG.now(ctx, ...) draws one piece at once (pieces standing among the
   characters, the 'sorted' layer). No WebGL2: PG.ok() is false and the callers draw the plain picture. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX) return;
  const PG = (NC.PaintGL = { on: true });

  const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; in vec2 a_q;
uniform vec2 u_res;
out vec2 v_uv; out vec2 v_q; out vec2 v_px;
void main() { vec2 c = a_pos / u_res * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); v_uv = a_uv; v_q = a_q; v_px = a_pos; }`;

  const FS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec2 v_q; in vec2 v_px;
uniform sampler2D u_tex;
uniform sampler2D u_bg; uniform vec4 u_bgRect;
uniform float u_time, u_seed, u_mode;
uniform vec4 u_warp;    // amount (uv), noise scale, pan x, pan y (per second)
uniform vec4 u_flow;    // amount, scale, pan x, pan y
uniform vec4 u_erode;   // progress 0..1, edge width, noise scale, edge strength
uniform vec3 u_edge;    // the erosion edge's colour
uniform vec4 u_tint;    // rgb multiplier, alpha
uniform vec4 u_clip;    // the visible uv rect (u0, v0, u1, v1)
uniform float u_haze;   // haze: how far the game behind is pushed, px
out vec4 o;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.17; a *= 0.5; } return s / 0.9375; }
void main() {
  vec2 uv = v_uv;
  float t = u_time;
  if (u_warp.x > 0.0) {   // (stronger away from the picture's middle bottom, where a flame or a puff is rooted)
    vec2 p = v_uv * u_warp.y - u_warp.zw * t + u_seed;
    vec2 d = vec2(fbm(p), fbm(p + 5.21)) - 0.5;
    uv += d * u_warp.x;
  }
  if (uv.x < u_clip.x || uv.y < u_clip.y || uv.x > u_clip.z || uv.y > u_clip.w) discard;
  vec4 c = texture(u_tex, clamp(uv, 0.001, 0.999));
  if (u_mode > 0.5) {     // haze: bend the game behind inside the picture's alpha
    float n1 = fbm(v_uv * 5.0 + vec2(0.0, -t * 1.6) + u_seed), n2 = fbm(v_uv * 5.0 + vec2(3.1, -t * 1.3) + u_seed);
    vec2 off = (vec2(n1, n2) - 0.5) * 2.0 * u_haze * c.a;
    vec3 bg = texture(u_bg, clamp((v_px + off - u_bgRect.xy) / u_bgRect.zw, 0.001, 0.999)).rgb;
    float a = c.a * u_tint.a;
    o = vec4(bg * a, a);
    return;
  }
  if (u_flow.x > 0.0) {
    float n = fbm(v_uv * u_flow.y - u_flow.zw * t + u_seed * 1.7);
    float lum = max(c.r, max(c.g, c.b)) / max(c.a, 1e-3);
    c.rgb *= 1.0 + u_flow.x * (n - 0.45) * 2.2 * smoothstep(0.25, 0.85, lum);
  }
  if (u_erode.x > 0.0) {
    float n = fbm(v_uv * u_erode.z + u_seed * 3.1) * 0.75 + (1.0 - c.a) * 0.25;   // (thin, see-through parts go first)
    float k = n - (u_erode.x * 1.12 - 0.06);
    float edge = 1.0 - smoothstep(0.0, u_erode.y, k);
    c.rgb += u_edge * edge * c.a * u_erode.w;
    c *= smoothstep(0.0, 0.015, k);
  }
  c.rgb *= u_tint.rgb;
  c *= u_tint.a;
  o = c;
}`;

  let glc = null, gl = null, prog = null, vbo = null, U = {}, failed = false, bgc = null, bgx = null, bgTex = null;
  let TEX = new WeakMap(); // (let: a lost context starts it over, init)
  let glLost = 0;
  function init() {
    // (the browser took the context away - a GPU reset, out of memory; js/crashguard.js counts it): a new one, as herospine does
    if (gl && gl.isContextLost()) { gl = null; bgc = null; TEX = new WeakMap(); failed = ++glLost > 3; }
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
      const att = (name, size, off) => { const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 6 * 4, off * 4); };
      att('a_pos', 2, 0); att('a_uv', 2, 2); att('a_q', 2, 4);
      for (const n of ['res', 'time', 'seed', 'mode', 'warp', 'flow', 'erode', 'edge', 'tint', 'clip', 'haze', 'bgRect']) U[n] = gl.getUniformLocation(prog, 'u_' + n);
      gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
      gl.uniform1i(gl.getUniformLocation(prog, 'u_bg'), 1);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.enable(gl.BLEND);
      gl.enable(gl.SCISSOR_TEST);
      return true;
    } catch (e) {
      failed = true; gl = null;
      console.warn('paintgl: off', e && e.message);
      return false;
    }
  }
  PG.ok = () => PG.on && init();
  PG.error = () => failed;
  function tex(img) {
    let t = TEX.get(img);
    if (t) return t;
    t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    TEX.set(img, t);
    return t;
  }

  // ---------------- the queue (world coordinates) ----------------
  const Q = { low: [], glow: [] };
  // corners c = [[x, y] top-left, top-right, bottom-right, bottom-left] of the picture n (a sprite name or an image)
  function item(n, c, o) {
    const img = typeof n === 'string' ? (NC.SPR[n] && NC.SPR[n].img) : n;
    if (!img || !(img.naturalWidth || img.width)) return null;
    return { img, c, o: o || {} };
  }
  // a picture centred on (x, y) (o.ay 1: standing on y), w x h world units, turned by rot; o.flip mirrors it, o.squash
  // flattens the turned quad onto the ground (a lane lying along the floor)
  function corners(x, y, w, h, rot, o) {
    const ca = Math.cos(rot || 0), sa = Math.sin(rot || 0), sq = o.squash || 1, ax = o.ax === undefined ? 0.5 : o.ax, ay = o.ay === undefined ? 0.5 : o.ay;
    const P = (u, v) => { const lx = (u - ax) * w, ly = (v - ay) * h; return [x + ca * lx - sa * ly, y + (sa * lx + ca * ly) * sq]; };
    const c = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
    return o.flip ? [c[1], c[0], c[3], c[2]] : c;
  }
  PG.quad = function (layer, n, x, y, w, h, rot, o) {
    o = o || {};
    const it = item(n, corners(x, y, w, h, rot, o), o);
    if (it) Q[layer === 'low' ? 'low' : 'glow'].push(it);
  };
  // one piece drawn at once (standing among the characters)
  PG.now = function (ctx, n, x, y, w, h, rot, o) {
    o = o || {};
    const it = item(n, corners(x, y, w, h, rot, o), o);
    if (it) draw(ctx, [it]);
  };

  // several pieces drawn at once in one pass, where the caller stands in its layer (js/obt_vfx.js: an impact's dust and
  // debris in the 'high' layer, under the night light and the damage numbers). list: [n, x, y, w, h, rot, o] each
  PG.many = function (ctx, list) {
    const its = [];
    for (const [n, x, y, w, h, rot, o] of list) { const it = item(n, corners(x, y, w, h, rot, o || {}), o || {}); if (it) its.push(it); }
    return its.length ? draw(ctx, its) : false;
  };

  // ---------------- drawing ----------------
  const buf = new Float32Array(6 * 6);
  function draw(ctx, items) {
    if (!items.length || !init()) return false;
    const cv = ctx.canvas, W = cv.width, H = cv.height;
    if (glc.width !== W || glc.height !== H) { glc.width = W; glc.height = H; }
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.res, W, H);
    gl.uniform1f(U.time, (NC.game && NC.game.time) || 0);
    const m = ctx.getTransform();
    let i = 0;
    while (i < items.length) {
      const add = !!items[i].o.add, haze = !!items[i].o.haze;
      let j = i;
      while (j < items.length && !!items[j].o.add === add && !!items[j].o.haze === haze) j++;
      // the run's box on the canvas
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const px = [];
      for (let q = i; q < j; q++) {
        const P = items[q].c.map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
        for (const [X, Y] of P) { if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
        px.push(P);
      }
      const bx = Math.max(0, Math.floor(x0) - 2), by = Math.max(0, Math.floor(y0) - 2);
      const bw = Math.min(W, Math.ceil(x1) + 2) - bx, bh = Math.min(H, Math.ceil(y1) + 2) - by;
      if (bw > 0 && bh > 0) {
        if (haze) { // the game canvas under this run, for the haze to bend
          if (!bgc) { bgc = document.createElement('canvas'); bgx = bgc.getContext('2d'); bgTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bgTex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
          if (bgc.width !== bw || bgc.height !== bh) { bgc.width = bw; bgc.height = bh; }
          bgx.clearRect(0, 0, bw, bh);
          bgx.drawImage(cv, bx, by, bw, bh, 0, 0, bw, bh);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bgTex);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgc);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          gl.uniform4f(U.bgRect, bx, by, bw, bh);
        }
        gl.scissor(bx, H - by - bh, bw, bh);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendFunc(gl.ONE, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.activeTexture(gl.TEXTURE0);
        for (let q = i; q < j; q++) {
          const it = items[q], o = it.o, P = px[q - i];
          const V = [[P[0], 0, 0, -1, -1], [P[1], 1, 0, 1, -1], [P[2], 1, 1, 1, 1], [P[0], 0, 0, -1, -1], [P[2], 1, 1, 1, 1], [P[3], 0, 1, -1, 1]];
          let k = 0;
          for (const [[X, Y], u, v, qx, qy] of V) { buf[k++] = X; buf[k++] = Y; buf[k++] = u; buf[k++] = v; buf[k++] = qx; buf[k++] = qy; }
          gl.bindTexture(gl.TEXTURE_2D, tex(it.img));
          const w = o.warp || [0, 0, 0, 0], f = o.flow || [0, 0, 0, 0], e = o.erode || [0, 0, 0, 0], t = o.tint || [1, 1, 1], cl = o.clip || [0, 0, 1, 1];
          gl.uniform4f(U.warp, w[0], w[1] || 3, w[2] || 0, w[3] || 0);
          gl.uniform4f(U.flow, f[0], f[1] || 3, f[2] || 0, f[3] || 0);
          gl.uniform4f(U.erode, e[0], e[1] || 0.08, e[2] || 4, e[3] === undefined ? 1.2 : e[3]);
          const ec = o.edge || [1, 0.85, 0.6];
          gl.uniform3f(U.edge, ec[0], ec[1], ec[2]);
          gl.uniform4f(U.tint, t[0], t[1], t[2], o.a === undefined ? 1 : Math.max(0, Math.min(1, o.a)));
          gl.uniform4f(U.clip, cl[0], cl[1], cl[2], cl[3]);
          gl.uniform1f(U.seed, o.seed || 0);
          gl.uniform1f(U.mode, haze ? 1 : 0);
          gl.uniform1f(U.haze, o.haze || 0);
          gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STREAM_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
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
    return true;
  }
  function flush(ctx, layer) {
    const items = Q[layer];
    if (!items.length) return;
    Q[layer] = [];
    draw(ctx, items);
  }
  const baseDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    baseDraw.apply(this, arguments);
    if (layer === 'low' || layer === 'glow') flush(ctx, layer);
  };
})();
