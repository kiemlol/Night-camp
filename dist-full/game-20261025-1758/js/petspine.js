/* petspine.js — the wolf hunter's wolf and the hunter's hawk as ONE painted picture each, bent by a Spine rig (the user,
   2026-10-19: "ทำหมากับนกใหม่ ไม่ต้องใช้รอยต่อแต่เป็นเฟรมเดียว แล้วใช้ rig อันใหม่ หมาดูหน้าตาดุนิดนึง นกก็เป็นเหยี่ยวไปเลย").
   Before, js/petrig.js drew both from separately painted pieces turned at joints, and the joints showed. Now Codex paints
   each creature once, whole (assets/gen/make_petspine_prompts.py: the wolf a little fiercer, the falcon a real hawk), a few
   edit passes paint only what lies under the near legs / the near wing and the face swaps, and the rig is cut from that
   one picture: every piece's edge that lies inside another piece moves with it (weighted meshes), so at rest it IS the
   painting and in motion it bends like one picture. The rigs are built by the rig builder's build_ncpets.py
   (NCWolf, NCHawk in Spine Rig Studio's rigs, viewable in the studio) and brought in by tools/pet_spine.py
   (assets/petspine.rig.js + the atlas pages assets/petspine/).
   Our own small player, like js/baphspine.js: bones, rotate / translate / scale keys, weighted meshes, attachment keys,
   spring physics on the tail / scarf / tail feathers, drawn by WebGL at the screen's own resolution and placed on the
   canvas. petrig.js keeps everything else: the pets' state (its wolfStep / falconStep: speed, gait phase, trot or gallop,
   bites, blinks, the tail's spring, the hawk's wingbeat, dive and strike), the hooks into pets.js and skills_v21.js, the
   puppet / wyvern / lantern rigs. Here only the wolf's and the falcon's drawing is swapped, through NC.PetRig.draw, so
   every caller keeps working: the summoned wolf, the spirit pack's glowing wolves, the hunter's falcon (and its golden
   twin, another player's falcon replayed by net.js), Void Comet's armoured frames (voidcomet.js wraps NC.PetRig.draw
   after this file and still draws first while the set is on) and its storm (vcstorm.js).
   The moves (clips in the rig): wolf idle / trot / gallop (sampled at the gait's own phase, blended by petrig's amp and
   gal), bite, hit, sniff, stalk (petrig's "play bow" moment: now a low hunting crouch), howl (when the hunter howls);
   hawk glide / flap (at petrig's beat phase), dive (wings swept back), strike (wings flared, talons raking), and the
   head / legs pictures swapped (blink, bite, screech, open talons).
   ?petspine=0: the old cut-out rigs. NC.PetSpine.debug = true draws the bones. */
(function () {
  'use strict';
  const NC = window.NC, DATA = NC.PET_SPINE;
  if (!DATA || !NC.PetRig) return;
  if (NC.ASSET_MANIFEST_PETSPINE) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_PETSPINE);
  const PS = (NC.PetSpine = { on: true, debug: false, physics: true });
  const D2R = Math.PI / 180, TAU = Math.PI * 2, PAD = 3, STEP = 1 / 60;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const cyc = (ph) => (((ph || 0) / TAU) % 1 + 1) % 1;

  // ---------------- the rigs, as typed arrays ----------------
  function prep(key) {
    const J = DATA[key], nb = J.bones.length, ns = J.slots.length;
    const R = { key, J, nb, ns, par: new Int16Array(nb), sx: new Float32Array(nb), sy: new Float32Array(nb), sr: new Float32Array(nb),
      ssx: new Float32Array(nb), ssy: new Float32Array(nb), len: new Float32Array(nb), name: J.bones.map((b) => b[0]), atts: {},
      slotAtt: J.slots.map((s) => s[2]), slotIx: {}, anims: {} };
    J.bones.forEach((b, i) => { R.par[i] = b[1]; R.sx[i] = b[2]; R.sy[i] = b[3]; R.sr[i] = b[4]; R.len[i] = b[5]; R.ssx[i] = b[6] == null ? 1 : b[6]; R.ssy[i] = b[7] == null ? 1 : b[7]; });
    J.slots.forEach((s, i) => { R.slotIx[s[0]] = i; });
    R.bone = (n) => R.name.indexOf(n);
    let base = 0;
    for (const [k, a] of Object.entries(J.atts)) {
      const n = a.uv.length / 2, off = new Int32Array(n);
      let p = 0;
      for (let v = 0; v < n; v++) { off[v] = p; p += 1 + a.v[p] * 4; }
      R.atts[k] = { base, n, off, w: Float32Array.from(a.v), tri: Uint16Array.from(a.tri.map((t) => t + base)), uv: a.uv, page: a.page || 0 };
      base += n;
    }
    R.nv = base;
    R.uv = new Float32Array(base * 2);
    for (const a of Object.values(R.atts)) R.uv.set(a.uv, a.base * 2);
    R.pos = new Float32Array(base * 2);
    R.idx = new Uint16Array(Object.values(R.atts).reduce((s, a) => s + a.tri.length, 0));
    for (const [name, A] of Object.entries(J.anims)) {
      const b = {};
      for (const [bi, q] of Object.entries(A.b)) b[bi] = { r: q.r ? Float32Array.from(q.r) : null, t: q.t ? Float32Array.from(q.t) : null, s: q.s ? Float32Array.from(q.s) : null };
      R.anims[name] = { d: A.d || 1, b, s: A.s || {} };
    }
    return R;
  }
  const RIGS = {};
  const rig = (key) => RIGS[key] || (RIGS[key] = prep(key));

  // ---------------- clips -> deltas from the setup pose (so moves mix by weight) ----------------
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
  function addClip(R, clip, t, w, D) {
    const A = R.anims[clip];
    if (!A || w <= 0) return;
    for (const bi in A.b) {
      const q = A.b[bi];
      if (q.r) { tmp[0] = 0; at(q.r, 2, t, tmp, w); D.r[bi] += tmp[0]; }
      if (q.t) { tmp[0] = tmp[1] = 0; at(q.t, 3, t, tmp, w); D.x[bi] += tmp[0]; D.y[bi] += tmp[1]; }
      if (q.s) { tmp[0] = tmp[1] = 0; at(q.s, 3, t, tmp, w); D.sx[bi] += tmp[0]; D.sy[bi] += tmp[1]; } // (stored as scale - 1)
    }
  }
  const stepped = (keys, t) => { let v; for (const k of keys) { if (k[0] <= t) v = k; else break; } return v; };

  // ---------------- bones -> world (y up, units = the painting's px) ----------------
  function world(R, L, M, from) {
    for (let i = from || 0; i < R.nb; i++) {
      const p = R.par[i], r = L.r[i] * D2R, cs = Math.cos(r), sn = Math.sin(r), x = L.x[i], y = L.y[i], kx = L.sx[i], ky = L.sy[i], o = i * 6;
      const la = cs * kx, lb = -sn * ky, lc = sn * kx, ld = cs * ky;
      if (p < 0) { M[o] = la; M[o + 1] = lb; M[o + 2] = lc; M[o + 3] = ld; M[o + 4] = x; M[o + 5] = y; continue; }
      const q = p * 6, pa = M[q], pb = M[q + 1], pc = M[q + 2], pd = M[q + 3];
      M[o] = pa * la + pb * lc; M[o + 1] = pa * lb + pb * ld; M[o + 2] = pc * la + pd * lc; M[o + 3] = pc * lb + pd * ld;
      M[o + 4] = pa * x + pb * y + M[q + 4]; M[o + 5] = pc * x + pd * y + M[q + 5];
    }
  }
  const rotW = (M, i) => Math.atan2(M[i * 6 + 2], M[i * 6]);

  // one frame: layers [[clip, time, weight] ...], extra {bone: {r, x, y, sx, sy}} added by code, swaps {slot: attachment}
  function pose(R, S, layers, extra, swaps, mv, dt) {
    const nb = R.nb;
    const D = S.D || (S.D = { r: new Float32Array(nb), x: new Float32Array(nb), y: new Float32Array(nb), sx: new Float32Array(nb), sy: new Float32Array(nb) });
    D.r.fill(0); D.x.fill(0); D.y.fill(0); D.sx.fill(0); D.sy.fill(0);
    for (const [c, t, w] of layers) addClip(R, c, t, w, D);
    if (extra) for (const n in extra) {
      const i = R.bone(n), e = extra[n];
      if (i < 0) continue;
      if (e.r) D.r[i] += e.r; if (e.x) D.x[i] += e.x; if (e.y) D.y[i] += e.y; if (e.sx) D.sx[i] += e.sx; if (e.sy) D.sy[i] += e.sy;
    }
    const L = S.L || (S.L = { r: new Float32Array(nb), x: new Float32Array(nb), y: new Float32Array(nb), sx: new Float32Array(nb), sy: new Float32Array(nb) });
    for (let i = 0; i < nb; i++) { L.r[i] = R.sr[i] + D.r[i]; L.x[i] = R.sx[i] + D.x[i]; L.y[i] = R.sy[i] + D.y[i]; L.sx[i] = R.ssx[i] + D.sx[i]; L.sy[i] = R.ssy[i] + D.sy[i]; }
    const M = S.M || (S.M = new Float32Array(nb * 6));
    world(R, L, M);
    // physics: a tail / a scarf end / tail feathers each a spring on its turn, pushed by how the creature moves
    if (PS.physics && R.J.phys && R.J.phys.length) {
      if (!S.phys) S.phys = R.J.phys.map(([b]) => ({ b, off: 0, vel: 0, px: M[b * 6 + 4], py: M[b * 6 + 5] }));
      S.acc = Math.min((S.acc || 0) + dt, 0.1);
      const steps = Math.floor(S.acc / STEP);
      S.acc -= steps * STEP;
      R.J.phys.forEach(([b, inertia, strength, damping], k) => {
        const q = S.phys[k], o = b * 6, X = M[o + 4], Y = M[o + 5], th = rotW(M, b), len = R.len[b] || 30;
        const dx = X - q.px - mv[0], dy = Y - q.py - mv[1];
        q.px = X; q.py = Y;
        if (dt > 0) q.off -= ((-dx * Math.sin(th) + dy * Math.cos(th)) / len) * inertia;
        for (let s = 0; s < steps; s++) { q.vel += -strength * q.off * STEP; q.off += q.vel * STEP; q.vel *= damping; }
        q.off = clamp(q.off, -0.6, 0.6);
        L.r[b] += q.off / D2R;
        world(R, L, M, b);
      });
    }
    // the slots' pictures: the setup's, the clips' attachment keys (the heaviest layer that keys a slot wins), the swaps
    const att = R.slotAtt.slice(), wgt = new Float32Array(R.ns);
    for (const [c, t, w] of layers) {
      const A = R.anims[c];
      if (!A || w < 0.5) continue;
      for (const si in A.s) { const k = stepped(A.s[si], t); if (k && w >= wgt[si]) { att[si] = k[1]; wgt[si] = w; } }
    }
    if (swaps) for (const sl in swaps) { const si = R.slotIx[sl]; if (si !== undefined && swaps[sl] !== undefined) att[si] = swaps[sl]; }
    // skin the meshes shown, back to front
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, ni = 0;
    const P = R.pos;
    for (let si = 0; si < R.ns; si++) {
      const an = att[si];
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
    return { M, ni, minX, minY, maxX, maxY };
  }

  // ---------------- WebGL: the meshes into a canvas, at the screen's resolution ----------------
  let glc = null, gl = null, prog = null, U = {}, failed = false, vbo = null, ubo = null, ibo = null, glLost = 0;
  const TEX = {};
  const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; uniform vec4 u_box; out vec2 v_uv;
void main() { gl_Position = vec4((a_pos.x - u_box.x) / u_box.z * 2.0 - 1.0, (a_pos.y - u_box.y) / u_box.w * 2.0 - 1.0, 0.0, 1.0); v_uv = a_uv; }`;
  const FS = `#version 300 es
precision mediump float;
in vec2 v_uv; uniform sampler2D u_tex; uniform vec3 u_tint; uniform float u_tintK; out vec4 o;
void main() { vec4 c = texture(u_tex, v_uv); c.rgb = mix(c.rgb, u_tint * c.a, u_tintK); o = c; }`;
  function init() {
    if (gl && gl.isContextLost()) { gl = null; for (const k in TEX) delete TEX[k]; failed = ++glLost > 3; } // (a GPU reset: a new context, as herospine does)
    if (gl || failed) return !!gl;
    try {
      glc = document.createElement('canvas'); glc.width = 512; glc.height = 512;
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
      console.warn('petspine: off', err && err.message);
      return false;
    }
  }
  function texOf(page) {
    if (TEX[page]) return TEX[page];
    const s = NC.SPR[page];
    if (!s || !s.img || s.ready === false || !(s.img.naturalWidth || s.img.width)) { if (s && s.ready === false && NC.Sprites && NC.Sprites.want) NC.Sprites.want(page); return null; }
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

  // draw a posed rig: x, y = the rig's root (the wolf's feet, the hawk's middle) in the ctx; s = world units per painting
  // px (the pet's size); o: { flip (face right: the paintings face LEFT), alpha, tint: [colour, amount], rot }
  function render(ctx, R, F, x, y, s, o) {
    // (the WebGL2 screen, js/gl2d_mesh.js: the meshes straight into the screen's batch; a plain 2D canvas keeps the way below)
    if (!PS.debug && !PS.wire && NC.GL2D && NC.GL2D.rig && NC.GL2D.rig.on && NC.GL2D.rig.pet(ctx, R, F, x, y, s, o)) return true;
    const tex = texOf(R.J.page);
    if (!tex) return false;
    const m = ctx.getTransform(), scr = Math.max(0.05, Math.hypot(m.a, m.b)), k = Math.min(3, s * scr); // screen px per painting px
    const x0 = F.minX - PAD / k, y0 = F.minY - PAD / k;
    const RW = Math.min(2048, Math.ceil((F.maxX - F.minX) * k + PAD * 2)), RH = Math.min(2048, Math.ceil((F.maxY - F.minY) * k + PAD * 2));
    if (RW <= 0 || RH <= 0) return true;
    if (RW > glc.width || RH > glc.height) { glc.width = Math.max(glc.width, RW); glc.height = Math.max(glc.height, RH); }
    const GH = glc.height;
    gl.viewport(0, GH - RH, RW, RH);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(U.box, x0, y0, RW / k, RH / k);
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
    // the painting's Y goes up: its top row (y0 + RH / k) lands at -(...) * s in the world
    ctx.save();
    ctx.translate(x, y);
    if (o.flip) ctx.scale(-1, 1);
    if (o.rot) ctx.rotate(o.rot);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(glc, 0, 0, RW, RH, x0 * s, -(y0 + RH / k) * s, RW / k * s, RH / k * s);
    if (PS.debug) debugDraw(ctx, R, F.M, s);
    if (PS.wire) wireDraw(ctx, R, F, s);
    ctx.restore();
    return true;
  }
  function wireDraw(ctx, R, F, s) { // (tests) the triangles drawn this frame
    ctx.save(); ctx.scale(s, -s); ctx.lineWidth = 0.6 / s; ctx.strokeStyle = 'rgba(80,255,160,0.55)';
    const P = R.pos, I = R.idx;
    ctx.beginPath();
    for (let i = 0; i < F.ni; i += 3) {
      const a = I[i] * 2, b = I[i + 1] * 2, c = I[i + 2] * 2;
      ctx.moveTo(P[a], P[a + 1]); ctx.lineTo(P[b], P[b + 1]); ctx.lineTo(P[c], P[c + 1]); ctx.closePath();
    }
    ctx.stroke(); ctx.restore();
  }
  function debugDraw(ctx, R, M, s) {
    ctx.save(); ctx.scale(s, -s); ctx.lineWidth = 1.5 / s; ctx.strokeStyle = '#ffd400'; ctx.fillStyle = '#ff4060';
    for (let i = 0; i < R.nb; i++) {
      const o = i * 6, X = M[o + 4], Y = M[o + 5], L = R.len[i];
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + M[o] * L, Y + M[o + 2] * L); ctx.stroke();
      ctx.beginPath(); ctx.arc(X, Y, 2.5 / s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------- the wolf: petrig's state -> the moves ----------------
  const env = (T, D, inn, out) => { const u = 1 - T / D; return clamp(Math.min(u / inn, (1 - u) / out), 0, 1); };
  const sm = (v) => v * v * (3 - 2 * v);
  function wolfMoves(R, st, q, now) {
    const amp = st.amp || 0, gal = st.gal || 0, ph = cyc(st.ph), L = [];
    const dI = R.anims.idle.d, dT = R.anims.trot.d, dG = R.anims.gallop.d;
    L.push(['idle', (st.age || 0) % dI, 1 - amp], ['trot', ph * dT, amp * (1 - gal)], ['gallop', ph * dG, amp * gal]);
    // left alone: the hunting crouch (petrig's "bow" moment), the sniff
    if (st.bowT > 0) L.push(['stalk', R.anims.stalk.d * 0.5, sm(env(st.bowT, 1.7, 0.25, 0.25))]);
    if (st.sniffT > 0) L.push(['sniff', (1.4 - st.sniffT) % R.anims.sniff.d, sm(env(st.sniffT, 1.4, 0.2, 0.25))]);
    // the hunter's howl (hookHowl below)
    const hw = q && q._howl ? now - q._howl : 9;
    if (hw < R.anims.howl.d) L.push(['howl', hw, 1]);
    if (st.bite > 0) L.push(['bite', (1 - st.bite / 0.32) * R.anims.bite.d, 1]);
    const hurt = q ? (q.hurt || 0) / 0.3 : 0;
    if (hurt > 0) L.push(['hit', (1 - hurt) * R.anims.hit.d, 1]);
    // the head follows its target and tilts now and then; the tail rides petrig's spring (canvas turns -> the rig's y-up turns)
    let head = -(st.look || 0) / D2R;
    if (st.tiltT > 0) head -= (st.tilt || 0) * Math.sin(Math.min(1, st.tiltT / 0.3) * Math.PI / 2) / D2R;
    const extra = { head: { r: head * 0.8 }, neck: { r: head * 0.2 }, tail_1: { r: -(st.tailA || 0) / D2R * 0.7 } };
    const swaps = {};
    if ((st.blinkT > 0 || hurt > 0) && !(st.bite > 0) && !(hw < R.anims.howl.d)) swaps.face = 'blink';
    return [L, extra, swaps];
  }

  // ---------------- the hawk ----------------
  function hawkMoves(R, st) {
    const dive = st.dive || 0, atk = st.atk || 0, flapW = st.flapW === undefined ? 1 : st.flapW, free = (1 - dive) * (1 - atk);
    const L = [['glide', (st.age || 0) % R.anims.glide.d, free * (1 - flapW)], ['flap', cyc(st.ph) * R.anims.flap.d, free * flapW]];
    if (dive > 0) L.push(['dive', (st.age || 0) % R.anims.dive.d, dive * (1 - atk)]);
    if (atk > 0) L.push(['strike', (st.age || 0) % R.anims.strike.d, atk]);
    // the body: a hover leans a little up, speed leans it into the flight, the stoop points it down, the strike stands it
    // up (petrig's falconPose numbers, canvas radians: + = nose up); the head keeps level and looks round (st.head)
    const sp = st.sp || 0, hurry = clamp(sp / 500, 0, 1);
    const pitch = -clamp(Math.atan2(st.vy || 0, Math.abs(st.vx || 0) + 1), -0.9, 0.9);
    let rot = (0.06 - 0.16 * hurry) * (1 - clamp(sp / 700, 0, 1)) + pitch * 0.6 * clamp(sp / 700, 0, 1);
    rot = rot + (Math.min(pitch, 0) - 0.3 - rot) * dive;
    rot = rot + (0.35 - rot) * atk;
    const extra = { cha: { r: -rot / D2R }, head: { r: -(-rot * 0.75 + (st.head || 0)) / D2R } };
    const swaps = {};
    if (st.screech > 0 || atk > 0.5) swaps.beak = 'shriek';
    if (atk > 0.5) swaps.talons = 'open';
    return [L, extra, swaps];
  }

  // ---------------- drawn in place of petrig's pieces ----------------
  const CTRL = { wolf: wolfMoves, falcon: hawkMoves };
  const KEY = { wolf: 'wolf', falcon: 'hawk' };
  PS.draw = function (ctx, type, st, x, y, o, q) {
    const key = KEY[type], J = key && DATA[key];
    if (!PS.on || !J || !st || !init()) return false;
    const R = rig(key);
    o = o || {};
    const S = st._ps || (st._ps = {}), now = NC.game ? NC.game.time : performance.now() / 1000;
    const dt = S.t == null ? 0 : clamp(now - S.t, 0, 0.1);
    S.t = now;
    const [layers, extra, swaps] = CTRL[type](R, st, q, now);
    // summoned: it pops in with a little hop (as petrig did)
    let s = J.k * (o.scale || 1), hop = 0;
    if ((st.age || 0) < 0.5) {
      const u = st.age / 0.5;
      s *= u < 0.3 ? 0.35 + 0.75 * (u / 0.3) : 1 + 0.1 * Math.sin(((u - 0.3) / 0.7) * Math.PI * 2) * (1 - (u - 0.3) / 0.7);
      hop = -Math.sin(Math.min(1, u / 0.7) * Math.PI) * 22 * (o.scale || 1);
    }
    // (the world moving under it, in painting px, facing as it faces: the physics)
    const mv = [S.x == null || dt <= 0 ? 0 : ((x - S.x) / s) * (o.flip ? -1 : 1), S.y == null || dt <= 0 ? 0 : -(y - S.y) / s];
    if (Math.abs(mv[0]) > 80 || Math.abs(mv[1]) > 80) mv[0] = mv[1] = 0;
    S.x = x; S.y = y;
    const F = pose(R, S, layers, extra, swaps, mv, dt);
    S.F = F;
    return render(ctx, R, F, x, y + hop, s, o);
  };
  // (tests and proof sheets) one clip at one time, drawn anywhere: PS.drawAt(ctx, 'wolf', [['gallop', 0.2, 1]], x, y, {scale})
  PS.drawAt = function (ctx, type, layers, x, y, o, swaps, extra) {
    const key = KEY[type] || type, J = DATA[key];
    if (!J || !init()) return false;
    const R = rig(key), S = { };
    o = o || {};
    const F = pose(R, S, layers, extra || null, swaps || null, [0, 0], 0);
    return render(ctx, R, F, x, y, J.k * (o.scale || 1), o);
  };
  PS.rig = rig;
  PS.ready = (type) => { const key = KEY[type] || type, J = DATA[key]; return !!(J && init() && texOf(J.page)); };

  // the pages stream in (js/assets.js LATER): a hero whose job has the wolf or the falcon asks for them early, a summon at
  // once, so the old pieces don't show for a moment the first time
  const PAGES = Object.values(DATA).map((J) => J.page);
  const want = (pri) => { if (NC.Sprites && NC.Sprites.need) NC.Sprites.need(PAGES, pri); };
  let wanted = false, checkT = 0;
  if (NC.Party && NC.Party.update) {
    const baseUpd = NC.Party.update;
    NC.Party.update = function (game) {
      baseUpd.apply(this, arguments);
      if (wanted || !game || (checkT -= 1) > 0) return;
      checkT = 60;
      const p = game.player, sk = p && NC.jobSkills ? NC.jobSkills(p) : [];
      if (sk.includes('wh_wolf') || sk.includes('wh_blitz')) { wanted = true; want(1); }
    };
  }
  if (NC.Pets && NC.Pets.summon) {
    const baseSummon = NC.Pets.summon;
    NC.Pets.summon = function (game, p, type) { if (type === 'wolf') want(0); return baseSummon.apply(this, arguments); };
  }

  // NC.PetRig.draw: ours for the wolf and the falcon, petrig's pieces when we can't (no WebGL2, the page not in yet, ?petspine=0)
  const base = NC.PetRig.draw;
  NC.PetRig.draw = function (ctx, type, st, x, y, o, q) {
    if (CTRL[type] && PS.draw(ctx, type, st, x, y, o, q)) return true;
    return base.apply(this, arguments);
  };

  // the hunter's howl (class2_skills_b.js RUN.wh_howl gives the wolf a buff ring and w.fast = 0.8): the wolf throws its head
  // back and howls with him. (NC.SKILL_RUN is looked up at every cast: keys, the hotbar, AUTO, the online looks.)
  const RUN = NC.SKILL_RUN;
  if (RUN && RUN.wh_howl) {
    const baseHowl = RUN.wh_howl;
    RUN.wh_howl = function (game, p) {
      const r = baseHowl.apply(this, arguments), w = NC.Pets && NC.Pets.get('wolf');
      if (w && w.owner === p) w._howl = game.time;
      return r;
    };
  }
})();
