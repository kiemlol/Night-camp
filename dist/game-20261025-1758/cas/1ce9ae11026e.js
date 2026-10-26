/* gl2d_mesh.js — the hero's and the pets' Spine rigs drawn as meshes straight into the WebGL2 screen's batch (2026-10-19,
   the user: "ทำระยะ 3 ต่อเลย: rig ฮีโร่และสัตว์เลี้ยงวาดเป็น mesh ตรงลงจอใน batch เดียว"). README "จอเกมด้วย WebGL2" (ระยะ 3).
   Before: each hero / pet was drawn by its own GL program into a framebuffer of its own (phase 2: a layer of the shared
   context), at about twice its size, then placed on the screen as a picture: per hero a framebuffer clear, a draw, a resolve
   and a break of the screen's batch. Now herospine.js blit() / petspine.js render() hand their frame (the posed vertices, the
   atlas uvs, the per-vertex alpha, the weapon pictures in draw order, the hit tint) to NC.GL2D.rig.hero / .pet, which put the
   triangles into the screen's own batch under the ctx's transform, alpha, clip, filter and blend - at screen resolution,
   multisampled like everything else. Drawn into a plain 2D canvas (the windows' previews) they keep the old way.
   ?glrig=0 = the old way everywhere (phase 2). NC.GL2D.rig.stats: heroes / pets / vertices drawn this way. */
(function () {
  'use strict';
  const NC = window.NC, G = NC.GL2D;
  if (!G || !G.on || !G.Ctx) return;
  const I = G._, P = G.path, pack = P.pack;
  const { Bt, IB, vtx, begin, unitOf, texFor, DSTMODE } = I;
  const RG = (G.rig = { on: true, stats: { heroes: 0, pets: 0, verts: 0 } });
  if (!RG.on) return;

  let stamp = new Uint32Array(1024), remap = new Int32Array(1024), gen = 1;
  const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  // a 2x3 affine product: A then B applied to a point = mul(A, B) (column vectors: A x B)
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];

  // the triangles idx[from, to) of a mesh (pos / uv per vertex, alpha per vertex or none) into ctx's batch; L = mesh -> device
  function emit(ctx, E, pos, uv, idx, from, to, alpha, al, L, T) {
    if (to <= from) return;
    const n = pos.length >> 1;
    if (stamp.length < n) { stamp = new Uint32Array(n * 2); remap = new Int32Array(n * 2); }
    if (++gen > 0xfffffff0) { stamp.fill(0); gen = 1; }
    const s = ctx._s, A = s.alpha;
    begin(Math.min(n, to - from), to - from, E);
    const u = unitOf(E), misc = (u | ((T ? 65 : 1) << 8)) >>> 0;
    const g0 = T ? T[0] : 0, g1 = T ? T[1] : 0, g2 = T ? T[2] : 0, g3 = T ? T[3] : 0;
    const a = L[0], b = L[1], c = L[2], d = L[3], e = L[4], f = L[5];
    const col1 = pack(255, 255, 255, A * al);
    for (let i = from; i < to; i++) {
      const v = idx[i];
      if (stamp[v] !== gen) {
        stamp[v] = gen;
        const X = pos[2 * v], Y = pos[2 * v + 1];
        remap[v] = vtx(a * X + c * Y + e, b * X + d * Y + f, uv[2 * v], uv[2 * v + 1], alpha ? pack(255, 255, 255, A * al * alpha[v]) : col1, misc, g0, g1, g2, g3);
        RG.stats.verts++;
      }
      IB[Bt.in++] = remap[v];
    }
  }
  const QI = new Uint16Array([0, 1, 2, 0, 2, 3]);
  // can this ctx take meshes now? (ours, and a blend the batch draws in one go)
  function ready(ctx) {
    if (!(ctx instanceof G.Ctx) || G.lost) return false;
    const op = ctx._s.op;
    return op !== 'copy' && !DSTMODE[op];
  }

  // the hero (herospine.js blit): R = the rig (R.J.page atlas, R.pos/uv/alpha/idx), F = the frame (F.ni, F.sprites: weapon
  // pictures at their place in the draw order), (x, y) his feet, k = game px per rig unit, flip = facing left
  RG.hero = function (ctx, R, F, x, y, k, flip, o) {
    if (!ready(ctx)) return false;
    const atlas = NC.SPR[R.J.page], Ea = atlas && atlas.img && atlas.ready !== false && texFor(atlas.img);
    if (!Ea) return false;
    const sps = F.sprites || [], Es = [];
    for (const sp of sps) { const E = sp.q.tex === 'atlas' ? Ea : texFor(sp.q.img); if (!E) return false; Es.push(E); }
    const s = ctx._s, oa = o && o.alpha !== undefined ? o.alpha : 1;
    // Spine (y up, the root at his feet) -> the ctx: translate (x, y), mirror for a left-facing hero, scale k with y down
    const L = mul([s.a, s.b, s.c, s.d, s.e, s.f], [flip ? -k : k, 0, 0, -k, x, y]);
    const tint = o && o.tint && o.tint[1] > 0 ? o.tint : null;
    let T = null;
    if (tint) { const c = hexRgb(tint[0]), t = Math.min(1, tint[1]); T = [c[0] * t, c[1] * t, c[2] * t, 1 - t]; }
    ctx._use(s.op);
    let from = 0;
    for (let i = 0; i < sps.length; i++) {
      const sp = sps[i];
      emit(ctx, Ea, R.pos, R.uv, R.idx, from, sp.at, R.alpha, oa, L, T);
      from = sp.at;
      emit(ctx, Es[i], sp.q.pos, sp.q.uv, QI, 0, 6, null, oa * (sp.al === undefined ? 1 : sp.al), L, T);
    }
    emit(ctx, Ea, R.pos, R.uv, R.idx, from, F.ni, R.alpha, oa, L, T);
    RG.stats.heroes++;
    return true;
  };

  // a pet (petspine.js render): R.pos / uv / idx in painting px (y up), F.ni triangles, (x, y) its root, s = world units per
  // painting px, o: { flip, rot, alpha, tint }
  RG.pet = function (ctx, R, F, x, y, sc, o) {
    if (!ready(ctx)) return false;
    const atlas = NC.SPR[R.J.page], Ea = atlas && atlas.img && atlas.ready !== false && texFor(atlas.img);
    if (!Ea) return false;
    const s = ctx._s;
    let M = mul([s.a, s.b, s.c, s.d, s.e, s.f], [1, 0, 0, 1, x, y]);
    if (o.flip) M = mul(M, [-1, 0, 0, 1, 0, 0]);
    if (o.rot) { const co = Math.cos(o.rot), si = Math.sin(o.rot); M = mul(M, [co, si, -si, co, 0, 0]); }
    M = mul(M, [sc, 0, 0, -sc, 0, 0]);
    const tint = o.tint && o.tint[1] > 0 ? o.tint : null;
    let T = null;
    if (tint) { const c = hexRgb(tint[0]), t = Math.min(1, tint[1]); T = [c[0] * t, c[1] * t, c[2] * t, 1 - t]; }
    ctx._use(s.op);
    emit(ctx, Ea, R.pos, R.uv, R.idx, 0, F.ni, null, o.alpha !== undefined ? o.alpha : 1, M, T);
    RG.stats.pets++;
    return true;
  };
})();
