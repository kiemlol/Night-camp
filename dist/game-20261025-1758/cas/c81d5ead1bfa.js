/* baphspine.js — the world boss Baphomet (js/baphomet.js) played from his Spine rigs (the user, 2026-10-16: "ต่อริก Spine
   บาโฟเม็ดทั้ง 2 ร่างเข้าเกมแทน auto rig เดิม"). Both forms were rigged in Spine Rig Studio from the game's own sprites
   (the rig builder's build_ncbaph.py -> the studio's rigs NCBaphomet, NCBaphometRoot) and
   brought in by tools/baph_spine.py (assets/baphspine.rig.js + the atlas pages assets/baphspine/). This is our own small
   player for what those rigs use — bones, linear rotate / translate keys, 2-bone IK, weighted meshes, slot attachment and
   draw-order keys, rotate physics (a spring) — so the game needs no Spine runtime. The meshes are drawn by WebGL into a
   canvas, then placed like NC.drawSpr (the sprite's anchor, size, flip, alpha, tint): the setup pose sits exactly where
   the old sprite did.
   The fight drives the moves: idle (asleep, recovering), walk (chasing, paced by how fast he moves), sweep (the scythe
   sweep; form 2's spin and whip too), quake (the hoof quake with its leap; form 2's spikes), cast (bolts, shards, calling
   the kids, the smoke blink), roar (waking), change (form 1 -> 2, both rigs in step through the cross-fade), hit (a flinch
   laid over whatever plays). The wind-up of each move is stretched to the boss's own e.wind, so the scythe lands when the
   hit does; moves cross-fade.
   NC.BaphSpine.draw(ctx, e, sprite, x, y, o) -> false when it can't (no WebGL2, pages not loaded, ?spine=0): then the old
   auto rig (js/baphrig.js) draws. NC.BaphSpine.debug = true draws the bones. */
(function () {
  'use strict';
  const NC = window.NC, DATA = NC.BAPH_SPINE;
  if (!DATA) return;
  if (NC.ASSET_MANIFEST_BAPHSPINE) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_BAPHSPINE);
  const BS = (NC.BaphSpine = { on: true, debug: false, physics: true });
  const D2R = Math.PI / 180, PAD = 4, STEP = 1 / 60;

  // ---------------- the rigs, as typed arrays ----------------
  function prep(key) {
    const J = DATA[key], nb = J.bones.length, ns = J.slots.length;
    const R = { key, J, nb, ns, par: new Int16Array(nb), sx: new Float32Array(nb), sy: new Float32Array(nb), sr: new Float32Array(nb),
      len: new Float32Array(nb), name: J.bones.map((b) => b[0]), atts: {}, slotAtt: J.slots.map((s) => s[2]), anims: {} };
    J.bones.forEach((b, i) => { R.par[i] = b[1]; R.sx[i] = b[2]; R.sy[i] = b[3]; R.sr[i] = b[4]; R.len[i] = b[5]; });
    R.bone = (n) => R.name.indexOf(n);
    // every attachment's vertices in one buffer: uvs fixed, positions skinned each frame
    let base = 0;
    for (const [k, a] of Object.entries(J.atts)) {
      const n = a.uv.length / 2, off = new Int32Array(n);
      let p = 0;
      for (let v = 0; v < n; v++) { off[v] = p; p += 1 + a.v[p] * 4; }
      R.atts[k] = { base, n, off, w: Float32Array.from(a.v), tri: Uint16Array.from(a.tri.map((t) => t + base)), uv: a.uv };
      base += n;
    }
    R.nv = base;
    R.uv = new Float32Array(base * 2);
    for (const a of Object.values(R.atts)) R.uv.set(a.uv, a.base * 2);
    R.pos = new Float32Array(base * 2);
    R.idx = new Uint16Array(Object.values(R.atts).reduce((s, a) => s + a.tri.length, 0));
    for (const [name, A] of Object.entries(J.anims)) {
      const b = {};
      for (const [bi, q] of Object.entries(A.b)) b[bi] = { r: q.r ? Float32Array.from(q.r) : null, t: q.t ? Float32Array.from(q.t) : null };
      R.anims[name] = { d: A.d, b, s: A.s, o: A.o };
    }
    return R;
  }
  const RIGS = {};
  const rig = (key) => RIGS[key] || (RIGS[key] = prep(key));

  // ---------------- poses: deltas from the setup pose, so moves mix by weight ----------------
  // a key list [t, v, t, v ...] (stride 2) or [t, x, y ...] (stride 3): the value at time t, linear, held past the ends
  function at(K, stride, t, out, w) {
    const n = K.length / stride;
    if (t <= K[0] || n === 1) { for (let c = 1; c < stride; c++) out[c - 1] += w * K[c]; return; }
    if (t >= K[(n - 1) * stride]) { for (let c = 1; c < stride; c++) out[c - 1] += w * K[(n - 1) * stride + c]; return; }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (K[m * stride] <= t) lo = m; else hi = m; }
    const t0 = K[lo * stride], t1 = K[hi * stride], u = (t - t0) / (t1 - t0 || 1);
    for (let c = 1; c < stride; c++) out[c - 1] += w * (K[lo * stride + c] + (K[hi * stride + c] - K[lo * stride + c]) * u);
  }
  const tmp = [0, 0];
  function addClip(R, clip, t, w, P) {
    const A = R.anims[clip];
    if (!A || w <= 0) return;
    for (const bi in A.b) {
      const q = A.b[bi];
      if (q.r) { tmp[0] = 0; at(q.r, 2, t, tmp, w); P.r[bi] += tmp[0]; }
      if (q.t) { tmp[0] = tmp[1] = 0; at(q.t, 3, t, tmp, w); P.x[bi] += tmp[0]; P.y[bi] += tmp[1]; }
    }
  }
  const stepped = (keys, t) => { let v; for (const k of keys) { if (k[0] <= t) v = k; else break; } return v; };

  // ---------------- bones -> world (y up, Spine units = the sprite's px) ----------------
  function world(R, L, M, from) {
    for (let i = from || 0; i < R.nb; i++) {
      const p = R.par[i], r = L.r[i] * D2R, la = Math.cos(r), lc = Math.sin(r), x = L.x[i], y = L.y[i], o = i * 6;
      if (p < 0) { M[o] = la; M[o + 1] = -lc; M[o + 2] = lc; M[o + 3] = la; M[o + 4] = x; M[o + 5] = y; continue; }
      const q = p * 6, pa = M[q], pb = M[q + 1], pc = M[q + 2], pd = M[q + 3];
      M[o] = pa * la + pb * lc; M[o + 1] = -pa * lc + pb * la; M[o + 2] = pc * la + pd * lc; M[o + 3] = -pc * lc + pd * la;
      M[o + 4] = pa * x + pb * y + M[q + 4]; M[o + 5] = pc * x + pd * y + M[q + 5];
    }
  }
  const rotW = (M, i) => Math.atan2(M[i * 6 + 2], M[i * 6]);
  // two-bone IK (Spine's, for a child sitting at the end of its parent, no scale): the chain bends toward bendDir
  function ik(R, L, M, p, c, tg, bend) {
    const o = p * 6, px = M[o + 4], py = M[o + 5], tx = M[tg * 6 + 4] - px, ty = M[tg * 6 + 5] - py;
    const l1 = Math.hypot(L.x[c], L.y[c]), l2 = R.len[c];
    if (!l1 || !l2) return;
    let cs = (tx * tx + ty * ty - l1 * l1 - l2 * l2) / (2 * l1 * l2);
    cs = cs < -1 ? -1 : cs > 1 ? 1 : cs;
    const a2 = Math.acos(cs) * bend, aa = l1 + l2 * cs, bb = l2 * Math.sin(a2);
    const a1 = Math.atan2(ty * aa - tx * bb, tx * aa + ty * bb), gp = R.par[p];
    L.r[p] = (a1 - (gp >= 0 ? rotW(M, gp) : 0)) / D2R;
    L.r[c] = a2 / D2R;
  }

  // ---------------- the moves, from the fight's own state ----------------
  const ATTACK = { sweep: 1, quake: 1, cast: 1 };
  const SW_HIT = 0.777, Q_UP = 0.78, Q_HIT = 0.97, CAST_HOLD = 0.8, CAST_DOWN = 1.1; // (s into each clip: build_ncbaph.py)
  function target(e, S) {
    const st = e.state, t = e.t || 0, wind = e.wind || 0.001;
    if (e.testClip) return [e.testClip, e.testT || 0];                     // (tests: one clip at one time)
    if (e.changing || st === 'change') return ['change', Math.min(t, 3.4)];
    switch (st) {
      case 'roar': return ['roar', t * (1.6 / 1.4)];
      case 'sweep': case 'spin': case 'whip':
        return ['sweep', t < wind ? (t / wind) * SW_HIT : SW_HIT + (t - wind)];
      case 'quake': return ['quake', t < wind ? (t / wind) * Q_UP : Q_UP + Math.min(1, (t - wind) / 0.4) * (Q_HIT - Q_UP)];
      case 'spikes': return ['quake', t < wind ? (t / wind) * Q_HIT : Q_HIT + (t - wind)];
      case 'bolts': case 'shards': case 'summon': case 'blink': return ['cast', Math.min(t, CAST_HOLD)];
      case 'recover': { // the move that just struck plays out, then he stands
        const c = S.cur;
        if (c && ATTACK[c.name]) {
          const tt = c.name === 'cast' ? Math.max(c.t, CAST_DOWN) : c.t;
          if (tt < rig(S.key).anims[c.name].d) return [c.name, null, tt];
        }
        return ['idle', null];
      }
      case 'chase': return S.speed > 25 ? ['walk', null] : ['idle', null];
      default: return ['idle', null];
    }
  }
  function state(e, key) {
    const all = e._bspine || (e._bspine = {});
    return all[key] || (all[key] = { key, cur: null, prev: null, fade: 0, fadeD: 0, hit: -1, flash: 0, last: null, speed: 0,
      lx: e.x, ly: e.y, lz: e.z || 0, phys: null, acc: 0 });
  }
  function advance(e, S, dt) {
    const R = rig(S.key);
    // how fast he really moves (the walk is paced by it)
    if (dt > 0) { const v = Math.hypot(e.x - S.lx, e.y - S.ly) / dt; S.speed += (v - S.speed) * Math.min(1, dt * 8); }
    S.ly = e.y;
    const [name, abs, from] = target(e, S);
    const A = R.anims[name];
    if (!S.cur || S.cur.name !== name) {
      if (S.cur) { S.prev = S.cur; S.fade = 0; S.fadeD = name === 'change' ? 0.25 : ATTACK[name] ? 0.12 : 0.22; }
      S.cur = { name, t: from != null ? from : abs != null ? abs : 0 };
    } else if (abs != null) S.cur.t = abs;
    else if (from != null && from > S.cur.t) S.cur.t = from;      // (the cast's arm comes down when the spell is done)
    else {
      const rate = name === 'walk' ? Math.max(0.8, Math.min(2.2, S.speed / 60)) : 1;
      S.cur.t += dt * rate;
      if (name === 'idle' || name === 'walk') S.cur.t %= A.d;
    }
    if (S.prev) { S.fade += dt; if (S.fade >= S.fadeD) S.prev = null; }
    // a new hit: the flinch laid over the move
    if (e.flash > 0 && e.flash > S.flash + 1e-4 && !e.changing && (S.hit < 0 || S.hit > 0.25)) S.hit = 0;
    S.flash = e.flash || 0;
    if (S.hit >= 0) { S.hit += dt; if (S.hit > R.anims.hit.d) S.hit = -1; }
  }

  // ---------------- one frame of the rig: pose, IK, physics, skin ----------------
  function pose(e, S, dt, flip, kx) {
    const R = rig(S.key), nb = R.nb;
    const D = S.D || (S.D = { r: new Float32Array(nb), x: new Float32Array(nb), y: new Float32Array(nb) });
    D.r.fill(0); D.x.fill(0); D.y.fill(0);
    const w = S.prev ? Math.min(1, S.fade / S.fadeD) : 1, sm = w * w * (3 - 2 * w);
    addClip(R, S.cur.name, S.cur.t, sm, D);
    if (S.prev) addClip(R, S.prev.name, S.prev.t, 1 - sm, D);
    if (S.hit >= 0) addClip(R, 'hit', S.hit, ATTACK[S.cur.name] ? 0.6 : 1, D);
    const L = S.L || (S.L = { r: new Float32Array(nb), x: new Float32Array(nb), y: new Float32Array(nb) });
    for (let i = 0; i < nb; i++) { L.r[i] = R.sr[i] + D.r[i]; L.x[i] = R.sx[i] + D.x[i]; L.y[i] = R.sy[i] + D.y[i]; }
    const M = S.M || (S.M = new Float32Array(nb * 6));
    world(R, L, M);
    for (const [p, c, tg, bend] of R.J.ik) { ik(R, L, M, p, c, tg, bend); world(R, L, M, p); }
    // physics: each cloth / tail bone a spring on its turn, pushed by how its root moves (the boss's own steps and leaps too)
    if (BS.physics && R.J.phys.length) {
      if (!S.phys) S.phys = R.J.phys.map(([b]) => ({ b, off: 0, vel: 0, px: M[b * 6 + 4], py: M[b * 6 + 5] }));
      const mvx = (e.x - S.lx) / kx * (flip ? -1 : 1), mvz = ((e.z || 0) - S.lz) / kx;
      S.acc = Math.min(S.acc + dt, 0.1);
      const steps = Math.floor(S.acc / STEP);
      S.acc -= steps * STEP;
      R.J.phys.forEach(([b, inertia, strength, damping], k) => {
        const q = S.phys[k], o = b * 6, X = M[o + 4], Y = M[o + 5], th = rotW(M, b), len = R.len[b] || 40;
        const dx = X - q.px - mvx, dy = Y - q.py + mvz;               // (the world moving under him counts as his move)
        q.px = X; q.py = Y;
        q.off -= ((-dx * Math.sin(th) + dy * Math.cos(th)) / len) * inertia;
        for (let s = 0; s < steps; s++) { q.vel += -strength * q.off * STEP; q.off += q.vel * STEP; q.vel *= damping; }
        q.off = Math.max(-0.7, Math.min(0.7, q.off));
        L.r[b] += q.off / D2R;
        world(R, L, M, b);
      });
    }
    S.lx = e.x; S.lz = e.z || 0;
    // the slots: attachments (the blink) and the draw order (the scythe comes forward in a swing) from the move playing
    const A = R.anims[S.cur.name], att = R.slotAtt.slice();
    if (A.s) for (const si in A.s) { const k = stepped(A.s[si], S.cur.t); if (k) att[si] = k[1]; }
    let order = null;
    if (A.o && A.o.length) { const k = stepped(A.o, S.cur.t); if (k && k[1]) order = drawOrder(R.ns, k[1]); }
    // skin the visible meshes, gather their triangles back to front
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, ni = 0;
    const P = R.pos;
    for (let n = 0; n < R.ns; n++) {
      const si = order ? order[n] : n, an = att[si];
      if (!an) continue;
      const a = R.atts[R.J.slots[si][0] + '/' + an];
      if (!a) continue;
      const W = a.w;
      for (let v = 0; v < a.n; v++) {
        let p = a.off[v];
        const cnt = W[p++];
        let X = 0, Y = 0;
        for (let k = 0; k < cnt; k++, p += 4) {
          const o = W[p] * 6, bx = W[p + 1], by = W[p + 2], ww = W[p + 3];
          X += ww * (M[o] * bx + M[o + 1] * by + M[o + 4]); Y += ww * (M[o + 2] * bx + M[o + 3] * by + M[o + 5]);
        }
        const j = (a.base + v) * 2;
        P[j] = X; P[j + 1] = Y;
        if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
      }
      R.idx.set(a.tri, ni); ni += a.tri.length;
    }
    return { R, M, ni, minX, minY, maxX, maxY };
  }
  // Spine's draw-order key: [[slot, offset]...] moves those slots, the rest keep their order round them
  function drawOrder(n, offs) {
    const out = new Int32Array(n).fill(-1), un = [];
    let oi = 0;
    for (const [si, off] of offs) { while (oi !== si) un.push(oi++); out[oi + off] = oi++; }
    while (oi < n) un.push(oi++);
    for (let i = n - 1; i >= 0; i--) if (out[i] === -1) out[i] = un.pop();
    return out;
  }

  // ---------------- WebGL: the meshes into a canvas ----------------
  let glc = null, gl = null, prog = null, U = {}, failed = false, vbo = null, ubo = null, ibo = null;
  const TEX = {};
  const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; uniform vec4 u_box; out vec2 v_uv;
void main() { gl_Position = vec4((a_pos.x - u_box.x) / u_box.z * 2.0 - 1.0, (a_pos.y - u_box.y) / u_box.w * 2.0 - 1.0, 0.0, 1.0); v_uv = a_uv; }`;
  const FS = `#version 300 es
precision mediump float;
in vec2 v_uv; uniform sampler2D u_tex; uniform vec3 u_tint; uniform float u_tintK; out vec4 o;
void main() { vec4 c = texture(u_tex, v_uv); c.rgb = mix(c.rgb, u_tint * c.a, u_tintK); o = c; }`;
  let glLost = 0;
  function init() {
    // (the browser took the context away - a GPU reset, out of memory; js/crashguard.js counts it): a new one, as herospine does
    if (gl && gl.isContextLost()) { gl = null; for (const k in TEX) delete TEX[k]; failed = ++glLost > 3; }
    if (gl || failed) return !!gl;
    try {
      glc = document.createElement('canvas'); glc.width = 1600; glc.height = 1200;
      gl = glc.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
      if (!gl) throw new Error('no webgl2');
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      for (const k of ['box', 'tex', 'tint', 'tintK']) U[k] = gl.getUniformLocation(prog, 'u_' + k);
      U.pos = gl.getAttribLocation(prog, 'a_pos'); U.uv = gl.getAttribLocation(prog, 'a_uv');
      gl.uniform1i(U.tex, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      vbo = gl.createBuffer(); ubo = gl.createBuffer(); ibo = gl.createBuffer();
      return true;
    } catch (err) {
      failed = true; gl = null;
      console.warn('baphspine: off', err && err.message);
      return false;
    }
  }
  function texOf(page) {
    if (TEX[page]) return TEX[page];
    const s = NC.SPR[page];
    if (!s || !s.img || !s.img.naturalWidth) return null;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s.img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return (TEX[page] = t);
  }
  const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  // ---------------- drawn like NC.drawSpr(ctx, sprite, x, y, o) ----------------
  BS.draw = function (ctx, e, sprite, x, y, o) {
    if (!BS.on) return false;
    const key = String(sprite).replace(/_b$/, '');
    const J = DATA[key], s = NC.SPR[key];
    if (!J || !s || !s.img || !s.img.naturalWidth || !init()) return false;
    const tex = texOf(J.page);
    if (!tex) return false;
    o = o || {};
    const S = state(e, key), now = e.anim || 0, dt = S.last == null ? 0 : Math.max(0, Math.min(0.1, now - S.last));
    S.last = now;
    const k = s.w / s.img.naturalWidth;                       // game px per sprite px (= per Spine unit)
    advance(e, S, dt);
    const F = pose(e, S, dt, !!o.flip, k), R = F.R;
    const x0 = Math.floor(F.minX) - PAD, y0 = Math.floor(F.minY) - PAD;
    const RW = Math.min(4096, Math.ceil(F.maxX) + PAD - x0), RH = Math.min(4096, Math.ceil(F.maxY) + PAD - y0);
    if (RW > glc.width || RH > glc.height) { glc.width = Math.max(glc.width, RW); glc.height = Math.max(glc.height, RH); }
    const GH = glc.height;
    gl.viewport(0, GH - RH, RW, RH);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(U.box, x0, y0, RW, RH);
    const tint = o.tint && o.tint[1] > 0 ? o.tint : null, tc = tint ? hexRgb(tint[0]) : [0, 0, 0];
    gl.uniform3f(U.tint, tc[0], tc[1], tc[2]); gl.uniform1f(U.tintK, tint ? Math.min(1, tint[1]) : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, R.pos, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(U.pos); gl.vertexAttribPointer(U.pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, ubo);
    if (ubo._for !== R.key) { gl.bufferData(gl.ARRAY_BUFFER, R.uv, gl.STATIC_DRAW); ubo._for = R.key; }
    gl.enableVertexAttribArray(U.uv); gl.vertexAttribPointer(U.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, R.idx.subarray(0, F.ni), gl.DYNAMIC_DRAW);
    gl.drawElements(gl.TRIANGLES, F.ni, gl.UNSIGNED_SHORT, 0);
    // Spine (X, Y up) -> the sprite's px (X + ox, oy - Y) -> about the sprite's anchor, at its size
    const [ox, oy] = J.origin, W = s.img.naturalWidth, H = s.img.naturalHeight;
    const dx = (x0 + ox - s.ax * W) * k, dy = (oy - (y0 + RH) - s.ay * H) * k;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(glc, 0, 0, RW, RH, dx, dy, RW * k, RH * k);
    if (BS.debug) debugDraw(ctx, R, F.M, ox - s.ax * W, oy - s.ay * H, k);
    ctx.restore();
    return true;
  };
  function debugDraw(ctx, R, M, bx, by, k) {
    ctx.save(); ctx.scale(k, k); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd400'; ctx.fillStyle = '#ff4060';
    for (let i = 0; i < R.nb; i++) {
      const o = i * 6, X = M[o + 4], Y = M[o + 5], L = R.len[i];
      const tx = X + M[o] * L, ty = Y + M[o + 2] * L;
      ctx.beginPath(); ctx.moveTo(bx + X, by - Y); ctx.lineTo(bx + tx, by - ty); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx + X, by - Y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // (tests) the move playing on a boss: {key: {clip, t, prev, hit}}
  BS.status = (e) => Object.fromEntries(Object.entries(e._bspine || {}).map(([k, S]) => [k, { clip: S.cur && S.cur.name, t: S.cur && +S.cur.t.toFixed(3), prev: S.prev && S.prev.name, hit: +S.hit.toFixed(2), speed: Math.round(S.speed) }]));
  BS.rig = rig;

  // js/baphomet.js draws his body through NC.BaphRig.draw: ours first, the old auto rig when we can't
  const old = NC.BaphRig;
  NC.BaphRig = Object.assign({}, old, { draw: (ctx, e, sprite, x, y, o) => BS.draw(ctx, e, sprite, x, y, o) || !!(old && old.draw(ctx, e, sprite, x, y, o)) });
})();
