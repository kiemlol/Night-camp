/* meshrig.js — "auto rig": one painted sprite moved by bones, without cutting it into parts (2026-10-16, the user:
   "ผมอยากให้บาโฟเม็ดใช้ auto rig" -> picked "Mesh บนภาพเดิม (auto weight)"). Like a 2D skeletal tool's mesh + automatic
   weights, done at load from the picture itself:
     the mesh     a grid of triangles laid over the sprite where it is painted (its alpha, one cell grown)
     the weights  each vertex's pull from each bone by the GEODESIC distance inside the painting (a path that stays on the
                  painted pixels: a horn under a scythe blade doesn't follow the blade), the nearest 3 bones, normalised
     the bones    a few segments per sprite placed by eye (head -> tail, in the picture's pixels), each with a parent
   Every frame the caller gives each bone a turn about its head (r), a shift (x, y) and a scale (s); the vertices follow
   their bones (linear blend skinning) and the bent picture is drawn by WebGL into a canvas, then placed like
   NC.drawSpr (anchor, flip, size, alpha, tint). Code only bends the painting: nothing is drawn by hand.
   NC.MeshRig.def(sprite, bones) · NC.MeshRig.warm([sprites]) builds them in idle moments · NC.MeshRig.draw(ctx, sprite, x,
   y, o, pose) -> false when it can't (no WebGL2, picture
   not loaded, ?meshrig=0): the caller then draws the plain sprite. NC.MeshRig.debug = true draws the bones and mesh. */
(function () {
  'use strict';
  const NC = window.NC;
  const MR = (NC.MeshRig = { on: true, rigs: {}, debug: false });
  const CELL = 8;      // px: the alpha mask's (and the distance field's) cell
  const GRID = 12;     // px: the mesh's spacing
  const MARGIN = 0.18; // the bent picture may reach this far past its frame (of its size, each side)

  // a rig: bones [{n: name, p: parent name or null, h: [x, y] head, t: [x, y] tail}] in the sprite picture's pixels,
  // parents listed before their children
  MR.def = (sprite, bones) => { MR.rigs[sprite] = { sprite, bones, built: null }; };

  // ---------------- the automatic part: mesh + geodesic weights ----------------
  // distance (in cells) from a bone to every cell, walking only over painted cells: Dijkstra on 8 neighbours with a
  // typed binary heap (no arrays made per step: a picture's whole rig builds in a few dozen ms)
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1], DC = [1, 1, 1, 1, 1.4142, 1.4142, 1.4142, 1.4142];
  function geodesic(cw, ch, pass, seeds) {
    const N = cw * ch, d = new Float32Array(N).fill(1e9);
    let hk = new Float32Array(N * 2 + 64), hv = new Int32Array(N * 2 + 64), n = 0;
    const push = (k, v) => {
      if (n >= hk.length) { const k2 = new Float32Array(hk.length * 2), v2 = new Int32Array(hk.length * 2); k2.set(hk); v2.set(hv); hk = k2; hv = v2; }
      let i = n++;
      while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; }
      hk[i] = k; hv[i] = v;
    };
    for (const i of seeds) { d[i] = 0; push(0, i); }
    while (n > 0) {
      const di = hk[0], i = hv[0];
      n--;
      if (n > 0) { // (sift the last one down from the top)
        const k = hk[n], v = hv[n];
        let j = 0;
        for (;;) {
          let c = 2 * j + 1;
          if (c >= n) break;
          if (c + 1 < n && hk[c + 1] < hk[c]) c++;
          if (hk[c] >= k) break;
          hk[j] = hk[c]; hv[j] = hv[c]; j = c;
        }
        hk[j] = k; hv[j] = v;
      }
      if (di > d[i]) continue;
      const x = i % cw, y = (i - x) / cw;
      for (let q = 0; q < 8; q++) {
        const nx = x + DX[q], ny = y + DY[q];
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        const j = ny * cw + nx;
        if (!pass[j]) continue;
        const nd = di + DC[q];
        if (nd < d[j]) { d[j] = nd; push(nd, j); }
      }
    }
    return d;
  }
  const segDist = (px, py, b) => {
    const [ax, ay] = b.h, [bx, by] = b.t, vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L));
    return Math.hypot(px - ax - vx * u, py - ay - vy * u);
  };
  function build(R, img) {
    const W = img.naturalWidth, H = img.naturalHeight, cw = Math.ceil(W / CELL), ch = Math.ceil(H / CELL);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    c2.drawImage(img, 0, 0, cw, ch);
    const px = c2.getImageData(0, 0, cw, ch).data;
    const solid = new Uint8Array(cw * ch);
    for (let i = 0; i < cw * ch; i++) solid[i] = px[i * 4 + 3] > 12 ? 1 : 0;
    const pass = new Uint8Array(cw * ch); // (one cell grown: the mesh covers the painted edge)
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < cw && Y < ch && solid[Y * cw + X]) { on = 1; break; } }
      pass[y * cw + x] = on;
    }
    const bones = R.bones, nb = bones.length;
    const field = bones.map((b) => {
      const seeds = new Set(), L = Math.hypot(b.t[0] - b.h[0], b.t[1] - b.h[1]), n = Math.max(2, Math.ceil(L / (CELL / 2)));
      for (let k = 0; k <= n; k++) {
        const x = Math.min(cw - 1, Math.max(0, Math.floor((b.h[0] + (b.t[0] - b.h[0]) * (k / n)) / CELL)));
        const y = Math.min(ch - 1, Math.max(0, Math.floor((b.h[1] + (b.t[1] - b.h[1]) * (k / n)) / CELL)));
        seeds.add(y * cw + x);
      }
      return geodesic(cw, ch, pass, seeds);
    });
    // the grid: vertices every GRID px, a quad kept where the grown mask touches it
    const gx = Math.ceil(W / GRID) + 1, gy = Math.ceil(H / GRID) + 1, vid = new Int32Array(gx * gy).fill(-1);
    const covered = (x0, y0) => {
      for (let y = Math.floor(y0 / CELL); y <= Math.floor(Math.min(H - 1, y0 + GRID) / CELL); y++)
        for (let x = Math.floor(x0 / CELL); x <= Math.floor(Math.min(W - 1, x0 + GRID) / CELL); x++) if (pass[y * cw + x]) return true;
      return false;
    };
    const verts = [], idx = [];
    const vert = (i, j) => {
      const k = j * gx + i;
      if (vid[k] < 0) { vid[k] = verts.length; verts.push([Math.min(W, i * GRID), Math.min(H, j * GRID)]); }
      return vid[k];
    };
    for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) {
      if (!covered(i * GRID, j * GRID)) continue;
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1);
      idx.push(a, b, c, a, c, d);
    }
    // each vertex: its 3 nearest bones by the geodesic distance (from its own cell, or the nearest painted one beside it)
    const nv = verts.length, wb = new Int16Array(nv * 3), ww = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      const [x, y] = verts[v], cx = Math.min(cw - 1, Math.floor(x / CELL)), cy = Math.min(ch - 1, Math.floor(y / CELL));
      let cell = pass[cy * cw + cx] ? cy * cw + cx : -1, extra = 0;
      if (cell < 0) {
        let best = 1e9;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const X = cx + dx, Y = cy + dy;
          if (X < 0 || Y < 0 || X >= cw || Y >= ch || !pass[Y * cw + X]) continue;
          const dd = Math.hypot(dx, dy);
          if (dd < best) { best = dd; cell = Y * cw + X; extra = dd * CELL; }
        }
      }
      const dist = bones.map((b, k) => {
        const g = cell >= 0 ? field[k][cell] : 1e9;
        return g < 1e8 ? g * CELL + extra : segDist(x, y, b) * 1.5 + 200;
      });
      const order = dist.map((d, k) => [d, k]).sort((p, q) => p[0] - q[0]).slice(0, 3);
      let sum = 0;
      const w = order.map(([d]) => { const q = 1 / Math.pow(d + 10, 4); sum += q; return q; });
      for (let k = 0; k < 3; k++) { wb[v * 3 + k] = k < order.length ? order[k][1] : 0; ww[v * 3 + k] = k < order.length ? w[k] / sum : 0; }
    }
    const mx = Math.round(W * MARGIN), my = Math.round(H * MARGIN);
    const uv = new Float32Array(nv * 2);
    for (let v = 0; v < nv; v++) { uv[v * 2] = verts[v][0] / W; uv[v * 2 + 1] = verts[v][1] / H; }
    return { W, H, mx, my, RW: W + 2 * mx, RH: H + 2 * my, verts, idx: new Uint16Array(idx), wb, ww, uv, pos: new Float32Array(nv * 2), tex: null, vbo: null, ubo: null, ibo: null, uploaded: false };
  }

  // ---------------- the bones: each a turn about its head, a shift, a scale; children ride on their parents ----------------
  function boneMats(R, pose) {
    const M = {}, out = [];
    for (const b of R.bones) {
      const q = (pose && pose[b.n]) || {}, r = q.r || 0, s = q.s || 1, c = Math.cos(r) * s, sn = Math.sin(r) * s;
      const hx = b.h[0], hy = b.h[1], ox = q.x || 0, oy = q.y || 0;
      const L = [c, sn, -sn, c, hx + ox - (c * hx - sn * hy), hy + oy - (sn * hx + c * hy)];
      const P = b.p && M[b.p];
      const m = P ? [P[0] * L[0] + P[2] * L[1], P[1] * L[0] + P[3] * L[1], P[0] * L[2] + P[2] * L[3], P[1] * L[2] + P[3] * L[3],
        P[0] * L[4] + P[2] * L[5] + P[4], P[1] * L[4] + P[3] * L[5] + P[5]] : L;
      M[b.n] = m; out.push(m);
    }
    return out;
  }

  // ---------------- WebGL: one context, one canvas big enough for every rig ----------------
  let glc = null, gl = null, prog = null, U = {}, failed = false;
  const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; uniform vec2 u_res; out vec2 v_uv;
void main() { gl_Position = vec4(a_pos.x / u_res.x * 2.0 - 1.0, 1.0 - a_pos.y / u_res.y * 2.0, 0.0, 1.0); v_uv = a_uv; }`;
  const FS = `#version 300 es
precision mediump float;
in vec2 v_uv; uniform sampler2D u_tex; uniform vec3 u_tint; uniform float u_tintK; out vec4 o;
void main() { vec4 c = texture(u_tex, v_uv); c.rgb = mix(c.rgb, u_tint * c.a, u_tintK); o = c; }`;
  let glLost = 0, glGen = 0;
  function init() {
    // (the browser took the context away - a GPU reset, out of memory; js/crashguard.js counts it): a new one, as herospine
    // does; every rig uploads again into it (glGen)
    if (gl && gl.isContextLost()) { gl = null; glGen++; failed = ++glLost > 3; }
    if (gl || failed) return !!gl;
    try {
      glc = document.createElement('canvas'); glc.width = 1400; glc.height = 960;
      gl = glc.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
      if (!gl) throw new Error('no webgl2');
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      for (const k of ['res', 'tex', 'tint', 'tintK']) U[k] = gl.getUniformLocation(prog, 'u_' + k);
      U.pos = gl.getAttribLocation(prog, 'a_pos'); U.uv = gl.getAttribLocation(prog, 'a_uv');
      gl.uniform1i(U.tex, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      return true;
    } catch (e) {
      failed = true; gl = null;
      console.warn('meshrig: off', e && e.message);
      return false;
    }
  }
  function upload(B, img) {
    B.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, B.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    B.vbo = gl.createBuffer(); B.ubo = gl.createBuffer(); B.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, B.ubo); gl.bufferData(gl.ARRAY_BUFFER, B.uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, B.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, B.idx, gl.STATIC_DRAW);
    B.uploaded = true; B.glGen = glGen;
  }
  const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  // the rig drawn like NC.drawSpr(ctx, sprite, x, y, o) (o: flip, sx, sy, scale, rot, alpha, tint [colour, k]), bent by pose
  // {bone: {r, x, y, s}}; false when it can't (the caller draws the plain sprite)
  MR.draw = function (ctx, sprite, x, y, o, pose) {
    if (!MR.on) return false;
    const R = MR.rigs[sprite], s = NC.SPR[sprite];
    if (!R || !s || !s.img || !s.img.naturalWidth || !init()) return false;
    if (!R.built) R.built = build(R, s.img);
    const B = R.built;
    if (B.RW > glc.width || B.RH > glc.height) { glc.width = Math.max(glc.width, B.RW); glc.height = Math.max(glc.height, B.RH); }
    if (!B.uploaded || B.glGen !== glGen) upload(B, s.img);
    // skinning: every vertex = its bones' movements, blended by its weights (+ the margin round the frame)
    const mats = boneMats(R, pose), P = B.pos, V = B.verts, wb = B.wb, ww = B.ww;
    for (let v = 0; v < V.length; v++) {
      const vx = V[v][0], vy = V[v][1];
      let X = 0, Y = 0;
      for (let k = 0; k < 3; k++) {
        const w = ww[v * 3 + k];
        if (!w) continue;
        const m = mats[wb[v * 3 + k]];
        X += w * (m[0] * vx + m[2] * vy + m[4]); Y += w * (m[1] * vx + m[3] * vy + m[5]);
      }
      P[v * 2] = X + B.mx; P[v * 2 + 1] = Y + B.my;
    }
    // into the GL canvas's top-left corner (its own size), then placed like the sprite
    const GH = glc.height;
    gl.viewport(0, GH - B.RH, B.RW, B.RH);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); // (all of it: a bigger rig drawn before would bleed in at the edge)
    gl.uniform2f(U.res, B.RW, B.RH);
    const tint = o && o.tint && o.tint[1] > 0 ? o.tint : null, tc = tint ? hexRgb(tint[0]) : [0, 0, 0];
    gl.uniform3f(U.tint, tc[0], tc[1], tc[2]); gl.uniform1f(U.tintK, tint ? Math.min(1, tint[1]) : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, B.tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, B.vbo); gl.bufferData(gl.ARRAY_BUFFER, P, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(U.pos); gl.vertexAttribPointer(U.pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, B.ubo);
    gl.enableVertexAttribArray(U.uv); gl.vertexAttribPointer(U.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, B.ibo);
    gl.drawElements(gl.TRIANGLES, B.idx.length, gl.UNSIGNED_SHORT, 0);
    o = o || {};
    const sc = o.scale || 1, w = s.w * sc * (o.sx || 1), h = s.h * sc * (o.sy || 1), kx = w / B.W, ky = h / B.H;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(glc, 0, 0, B.RW, B.RH, -s.ax * w - B.mx * kx, -s.ay * h - B.my * ky, B.RW * kx, B.RH * ky);
    if (MR.debug) debugDraw(ctx, R, B, mats, s, w, h, kx, ky);
    ctx.restore();
    return true;
  };
  // (tests) the bones in yellow, the mesh's edges faint, over the bent sprite
  function debugDraw(ctx, R, B, mats, s, w, h, kx, ky) {
    ctx.save();
    ctx.translate(-s.ax * w, -s.ay * h); ctx.scale(kx, ky);
    ctx.globalAlpha = 0.35; ctx.strokeStyle = '#7fd0ff'; ctx.lineWidth = 1 / kx; ctx.beginPath();
    const P = B.pos;
    for (let i = 0; i < B.idx.length; i += 3) {
      const a = B.idx[i], b = B.idx[i + 1], c = B.idx[i + 2];
      ctx.moveTo(P[a * 2] - B.mx, P[a * 2 + 1] - B.my); ctx.lineTo(P[b * 2] - B.mx, P[b * 2 + 1] - B.my); ctx.lineTo(P[c * 2] - B.mx, P[c * 2 + 1] - B.my);
    }
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 4 / kx; ctx.strokeStyle = '#ffd400'; ctx.fillStyle = '#ff4060';
    R.bones.forEach((b, k) => {
      const m = mats[k], hx = m[0] * b.h[0] + m[2] * b.h[1] + m[4], hy = m[1] * b.h[0] + m[3] * b.h[1] + m[5];
      const tx = m[0] * b.t[0] + m[2] * b.t[1] + m[4], ty = m[1] * b.t[0] + m[3] * b.t[1] + m[5];
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, 6 / kx, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
  // build rigs ahead (one per idle moment once its picture is loaded), so the first frame a boss shows doesn't stall
  MR.warm = function (names) {
    const later = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 2000 }) : (f) => setTimeout(f, 300);
    const next = () => {
      if (!MR.on) return;
      const n = names.find((k) => MR.rigs[k] && !MR.rigs[k].built);
      if (!n) return;
      const s = NC.SPR[n];
      if (s && s.img && s.img.naturalWidth && init()) {
        const R = MR.rigs[n];
        R.built = build(R, s.img);
        upload(R.built, s.img);
      }
      setTimeout(() => later(next), 400);
    };
    setTimeout(() => later(next), 2500);
  };
  // (tests) how a rig came out: vertices, triangles, bones
  MR.stats = (sprite) => { const R = MR.rigs[sprite], B = R && R.built; return B ? { verts: B.verts.length, tris: B.idx.length / 3, bones: R.bones.length, size: [B.W, B.H] } : null; };
})();
