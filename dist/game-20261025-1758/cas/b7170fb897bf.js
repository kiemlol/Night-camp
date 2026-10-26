/* petrig.js — the summons as cutout rigs: separate pieces (body, heads, legs, tail) moved by code every frame, instead
   of pets.js's two still pictures swapped. The user's wish (2026-09-28): "summon frames that move, not stiff pictures".
   So far: the wolf hunter's wolf — its legs step with the distance it really runs (a trot when slow, a bounding
   gallop when fast), its tail swings on a spring (it streams back when running, lags when it starts or stops, wags
   when it waits), the head follows its target, blinks, opens its jaws on a bite, flinches when hit; left alone it
   sniffs the ground, tilts its head, or drops into a play bow. It pops in with a little hop when summoned.
   And the hunter's falcon (skills_v21.js asks NC.PetRig.falcon to draw it): flying at the hero's side, wingbeats and
   glides, a hawk's head snaps, a screech on take-off, a folded-wing stoop and a talons-first strike.
   And the puppeteer's battle puppet: a marionette on strings (see its section).
   And the dragon knight's baby wyvern and the warlock's lantern spirit (see their sections).
   A pet type without a rig here (or whose pieces failed to load) keeps pets.js's drawing.
   Art: assets/petrig/pr_<pet>_<piece>.png (assets/petrig.manifest.js), made with assets/gen/make_petrig_prompts.py ->
   Codex -> tools/monster_cut.py (one scale for every piece). The pieces face LEFT, like the monsters; the rig works in
   that "art space" (forward = -x, y down, origin on the ground under the body) and flips when the pet faces right.
   NC.PetRig.draw(ctx, type, st, x, y, o) draws a rig in any state (tests, effects); NC.PetRig.fresh() is a new state. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  const TAU = Math.PI * 2, rand = NC.rand;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const toward = (v, to, k) => v + (to - v) * Math.min(1, k);
  if (NC.ASSET_MANIFEST_PETRIG) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_PETRIG);

  // ---------------- the rigs ----------------
  // bones, drawn in this order. part: the sprite (a pose may swap it: P[id].img); piv: the joint inside the piece
  // (fractions of its size); at: where that joint sits, in world units, on the parent's joint (the body's is its
  // centre) or, for the root, above the feet; k: the piece's own size; dark: a far limb, drawn a shade darker
  const RIGS = {
    wolf: {
      pre: 'pr_wolf_',
      imgs: ['body', 'head', 'blink', 'bite', 'tail', 'legF', 'legB'],
      bones: [
        // the far legs behind the body (its edge in front of them is a real outline); the near legs and the tail over
        // it, with no outline where they cover it (join); every leg bends below the joint instead of turning stiffly
        { id: 'legBf', parent: 'body', part: 'legB', piv: [0.45, 0.18], at: [13.5, 3.2], dark: true, bend: [0.25, 0.7] },
        { id: 'legFf', parent: 'body', part: 'legF', piv: [0.5, 0.15], at: [-3.6, 4.2], dark: true, bend: [0.22, 0.65] },
        { id: 'body', parent: null, part: 'body', piv: [0.5, 0.5], at: [0, -27.9] },
        { id: 'tail', parent: 'body', part: 'tail', piv: [0.15, 0.8], at: [13.6, -3.9], join: true },
        { id: 'legB', parent: 'body', part: 'legB', piv: [0.45, 0.18], at: [10, 4.7], join: [0.02, 0.16], bend: [0.25, 0.7] },
        { id: 'legF', parent: 'body', part: 'legF', piv: [0.5, 0.15], at: [-7.1, 5.7], join: [0.02, 0.16], bend: [0.22, 0.65] },
        { id: 'head', parent: 'body', part: 'head', piv: [0.68, 0.86], at: [-11.4, -4.2], k: 1.16 },
      ],
      legs: { legF: 0, legFf: 1, legB: 2, legBf: 3 }, // which of the gait's four phases each leg takes
      k: 1.06, // the whole rig (to match the old picture's size)
      stride: [46, 105], // world units per step cycle: trotting, galloping
      swing: [0.5, 0.85], // how far the paws swing (radians; the legs bend, so the paw travels less than a stiff turn)
      lift: [3.5, 6],
      step: (game, q, dt) => wolfStep(game, q, dt),
      pose: (R, st, q) => wolfPose(R, st, q),
    },
  };
  NC.PetRig = { RIGS };

  const S = () => NC.SPR;
  const ready = (R) => R.ok || (R.ok = R.imgs.every((n) => S()[R.pre + n]));
  const darkCache = new Map();
  function darkOf(name) { // a far limb: the piece a shade darker (its own outline stays)
    let cv = darkCache.get(name);
    if (cv) return cv;
    const s = S()[name];
    cv = document.createElement('canvas');
    cv.width = s.img.width; cv.height = s.img.height;
    const c = cv.getContext('2d');
    c.drawImage(s.img, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(28,22,52,0.3)';
    c.fillRect(0, 0, cv.width, cv.height);
    darkCache.set(name, cv);
    return cv;
  }

  // ---------------- the state (one per pet) ----------------
  NC.PetRig.fresh = () => ({
    age: 0, lx: null, ly: null, spd: 0, lastSpd: 0, amp: 0, gal: 0, ph: 0,
    tailA: 0, tailV: 0, headA: 0, look: 0, blinkT: 0, blinkIn: rand(1, 3), bite: 0, lastLunge: 0,
    idle: 0, bowT: 0, sniffT: 0, tiltT: 0, tilt: 0, tiltIn: rand(2, 4), stepAt: 0,
  });

  // ================= the wolf =================
  function wolfStep(game, q, dt) {
    const R = RIGS[q.type], st = q.rig || (q.rig = NC.PetRig.fresh());
    if (dt <= 0) return;
    st.age += dt;
    if (st.lx === null) { st.lx = q.x; st.ly = q.y; }
    let d = Math.hypot(q.x - st.lx, q.y - st.ly);
    st.lx = q.x; st.ly = q.y;
    if (d > 160) d = 0; // it jumped to the hero (a warp, a long way off)
    st.spd = toward(st.spd, d / dt, dt * 12);
    const acc = (st.spd - st.lastSpd) / dt;
    st.lastSpd = st.spd;
    const T = q.T, run = st.spd / (T.speed || 300);
    st.amp = toward(st.amp, clamp(run / 0.45, 0, 1), dt * 10);
    st.gal = toward(st.gal, run > 0.8 ? 1 : 0, dt * 5);
    const stride = lerp(R.stride[0], R.stride[1], st.gal) * (q.scale || 1);
    const ph0 = st.ph;
    st.ph += (d / stride) * TAU;
    // a puff of dust when the hind paws land in a gallop
    if (st.gal > 0.6 && st.amp > 0.7 && !T.fly && Math.floor((ph0 + 0.6) / TAU) !== Math.floor((st.ph + 0.6) / TAU) && V && V.smoke) {
      V.smoke(q.x - q.face * 14 * (q.scale || 1), q.y + 2, 1, '#cdbfa2', '#ebe1cb', { size: 0.32, min: 10, max: 40, rise: 12, lifeK: 0.45, layer: 'low', a: 0.55 });
    }
    // the bite: pets.js sets q.lunge when it attacks
    if ((q.lunge || 0) > st.lastLunge + 0.01) st.bite = 0.32;
    st.lastLunge = q.lunge || 0;
    st.bite = Math.max(0, st.bite - dt);
    // blinking
    st.blinkT = Math.max(0, st.blinkT - dt);
    if ((st.blinkIn -= dt) <= 0) { st.blinkT = 0.13; st.blinkIn = rand(1.8, 4.5); if (Math.random() < 0.2) st.blinkIn = 0.25; }
    // left alone: a play bow, a sniff, a head tilt
    const busy = st.spd > 25 || (q.target && !q.target.dead) || st.bite > 0 || (q.hurt || 0) > 0;
    st.idle = busy ? 0 : st.idle + dt;
    st.bowT = Math.max(0, st.bowT - dt); st.sniffT = Math.max(0, st.sniffT - dt);
    if (busy) { st.bowT = Math.min(st.bowT, 0.2); st.sniffT = 0; }
    if (st.idle > 2.5 && !st.bowT && !st.sniffT && Math.random() < dt * 0.35) {
      if (Math.random() < 0.45) st.bowT = 1.7; else st.sniffT = 1.4;
    }
    st.tiltT = Math.max(0, st.tiltT - dt);
    if ((st.tiltIn -= dt) <= 0) { st.tiltIn = rand(2.5, 5); if (!busy) { st.tiltT = rand(0.8, 1.4); st.tilt = rand(-0.16, 0.2); } }
    // where it looks: at its target, a little
    let look = 0;
    const e = q.target;
    if (e && !e.dead) {
      const hx = q.x - q.face * 16 * (q.scale || 1), hy = q.y - 40 * (q.scale || 1);
      look = -clamp(Math.atan2((e.y - 40) - hy, Math.abs(e.x - hx) + 40), -0.6, 0.6) * 0.5;
    }
    st.look = toward(st.look, look, dt * 6);
    // the tail: a spring pulled toward its pose, kicked by speeding up and slowing down
    const bow = st.bowT > 0 ? Math.sin(Math.min(1, st.bowT / 1.7) * Math.PI) : 0;
    const wagF = bow > 0.1 ? 15 : st.amp > 0.3 ? 6 : 9, wagA = bow > 0.1 ? 0.32 : lerp(0.2, 0.08, st.amp);
    const want = Math.sin(st.age * wagF) * wagA + st.amp * lerp(0.2, 0.55, st.gal) - bow * 0.25 + ((q.hurt || 0) > 0 ? 0.5 : 0);
    st.tailV += ((want - st.tailA) * 160 - st.tailV * 13) * dt + acc * 0.00035;
    st.tailA += st.tailV * dt;
    st.tailA = clamp(st.tailA, -0.7, 1.2);
  }

  // ---------------- a state -> the angle and offset of every bone ----------------
  // (every bone: rot, dx/dy on its joint, sx/sy, img (another piece), hide)
  const blank = (R) => { const P = {}; for (const b of R.bones) P[b.id] = { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1, img: null, hide: false }; return P; };
  function wolfPose(R, st, q) {
    const P = blank(R);
    const amp = st.amp, gal = st.gal, ph = st.ph;
    // the gait: a trot moves the diagonal legs together; a gallop the front pair, then the hind pair
    const offs = [lerp(0, 0, gal), lerp(Math.PI, 0.4, gal), lerp(Math.PI, Math.PI, gal), lerp(0, Math.PI + 0.4, gal)];
    const sw = lerp(R.swing[0], R.swing[1], gal) * amp, lf = lerp(R.lift[0], R.lift[1], gal) * amp;
    for (const id in R.legs) {
      const o = ph + offs[R.legs[id]];
      P[id].rot = Math.sin(o) * sw * (id[3] === 'B' ? 0.85 : 1);
      P[id].dy = -Math.max(0, Math.cos(o)) * lf;
    }
    const B = P.body, H = P.head;
    // trot: a small double bob; gallop: up in the stretch, down when gathered, the body rocking
    const breath = Math.sin(st.age * 2.6) * (1 - amp);
    B.dy = -amp * lerp(1.8 * Math.abs(Math.sin(ph)), 6 * Math.max(0, Math.sin(ph)) + 1, gal);
    B.rot = -0.035 * amp + gal * amp * 0.07 * Math.cos(ph);
    B.sx = 1 + gal * amp * 0.05 * Math.sin(ph) - breath * 0.01;
    B.sy = 1 - gal * amp * 0.035 * Math.sin(ph) + breath * 0.025;
    H.rot = st.look + amp * lerp(0.05 * Math.sin(ph * 2), -0.08 * Math.cos(ph), gal) - breath * 0.02;
    H.dy = breath * 0.4;
    if (st.tiltT > 0) H.rot += st.tilt * Math.sin(Math.min(1, st.tiltT / 0.3) * Math.PI / 2);
    P.tail.rot = st.tailA;
    // left alone: the play bow (chest down, front paws out, tail up) and the sniff (nose to the ground)
    const bow = st.bowT > 0 ? Math.sin(Math.min(1, st.bowT / 1.7) * Math.PI) : 0;
    if (bow > 0) {
      const k = Math.min(1, bow * 1.6);
      B.rot -= 0.24 * k; B.dy += 4 * k;
      P.legF.rot += 0.95 * k; P.legFf.rot += 0.85 * k; P.legF.dy -= 5 * k; P.legFf.dy -= 5 * k;
      P.legB.rot -= 0.12 * k; P.legBf.rot -= 0.12 * k;
      H.rot += 0.3 * k;
    }
    if (st.sniffT > 0) {
      const k = Math.min(1, Math.sin(Math.min(1, st.sniffT / 1.4) * Math.PI) * 2);
      H.rot -= (0.32 + Math.sin(st.age * 19) * 0.04) * k; B.rot -= 0.05 * k;
    }
    // the bite: jaws open and the head thrusts in, the body stretches after it; then a small recoil
    if (st.bite > 0) {
      const u = 1 - st.bite / 0.32;
      if (u < 0.55) {
        const k = Math.sin((u / 0.55) * Math.PI / 2);
        H.img = 'bite'; H.dx -= 5 * k; H.rot -= 0.14 * k;
        B.rot -= 0.07 * k; B.sx *= 1 + 0.05 * k;
        P.legF.rot += 0.45 * k; P.legFf.rot += 0.4 * k; P.legB.rot -= 0.3 * k; P.legBf.rot -= 0.3 * k;
      } else {
        const k = Math.sin(((u - 0.55) / 0.45) * Math.PI);
        H.rot += 0.1 * k; H.dx += 2 * k;
      }
    }
    // hurt: a flinch, eyes squeezed shut
    const hurt = q ? (q.hurt || 0) / 0.3 : 0;
    if (hurt > 0) { H.rot += 0.25 * hurt; H.dx += 3 * hurt; B.rot += 0.08 * hurt; H.img = 'blink'; }
    if (!H.img) H.img = st.blinkT > 0 ? 'blink' : 'head';
    return P;
  }

  // ---------------- drawing ----------------
  // own: the bone being drawn (a bending limb turns itself, strip by strip, in bent())
  function apply(ctx, R, P, id, own) {
    const b = R.byId[id], p = P[id];
    if (b.parent) apply(ctx, R, P, b.parent);
    ctx.translate(b.at[0] + p.dx, b.at[1] + p.dy);
    if (p.rot && !(own && (b.bend || b.join))) ctx.rotate(p.rot);
    if (p.sx !== 1 || p.sy !== 1) ctx.scale(p.sx, p.sy);
    if (b.k) ctx.scale(b.k, b.k);
  }
  // a limb that bends like a skinned mesh instead of turning stiffly: cut into strips, the top ones stay with the
  // body (so the joint never swings out from under it), the turn grows smoothly down to the paw. b.bend = [from, to]:
  // where the bend starts and where it is full (fractions of the piece's height). The strips are drawn solid into a
  // scratch canvas first, where their small overlaps can't show.
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const scratch = () => { const cv = document.createElement('canvas'); return { cv, c: cv.getContext('2d') }; };
  const LIMB = scratch(), FUR = scratch();
  function bentInto(c, img, sp, b, rot) {
    const w = sp.w, h = sp.h, px = b.piv[0] * w, py = b.piv[1] * h, N = 12, hs = (h - py) / N, k = img.height / h;
    if (!b.bend) { c.rotate(rot); c.drawImage(img, -px, -py, w, h); return; } // (a stiff piece that joins the body)
    c.drawImage(img, 0, 0, img.width, (py + 1) * k, -px, -py, w, py + 1); // above the joint: still
    let x = 0, y = 0;
    for (let i = 0; i < N; i++) {
      const y0 = py + i * hs, a = rot * smooth(b.bend[0] * h, b.bend[1] * h, y0 + hs / 2), over = i === N - 1 ? 0 : 1.2;
      c.save(); c.translate(x, y); c.rotate(a);
      c.drawImage(img, 0, y0 * k, img.width, Math.min(img.height - y0 * k, (hs + over) * k), -px, 0, w, Math.min(h - y0, hs + over));
      c.restore();
      x -= Math.sin(a) * hs; y += Math.cos(a) * hs;
    }
  }
  // a near limb over the body (b.join): games hide such joints by giving the whole creature ONE outline, round its
  // silhouette only. So where the limb lies over the body it is drawn without its outline (fur only, furOf), its very
  // top faded into the body's fur (b.join = [from, to], fractions of its height; or true: no fade, e.g. the tail);
  // outside the body it keeps its outline, which starts right where it leaves the body's edge. The body's own edge
  // under the limb is covered by fur.
  function bent(ctx, img, sp, b, rot, R, P) {
    const w = sp.w, h = sp.h, px = b.piv[0] * w, py = b.piv[1] * h;
    const m = ctx.getTransform(), sc = Math.min(4, Math.max(0.5, Math.hypot(m.a, m.b))), mg = Math.max(w, h) * 0.9; // margin: the swing
    const bw = Math.ceil((w + mg * 2) * sc), bh = Math.ceil((h + mg * 2) * sc), at = [(px + mg) * sc, (py + mg) * sc];
    const layer = (L, im) => {
      if (L.cv.width < bw) L.cv.width = bw;
      if (L.cv.height < bh) L.cv.height = bh;
      L.c.setTransform(1, 0, 0, 1, 0, 0); L.c.globalCompositeOperation = 'source-over';
      L.c.clearRect(0, 0, L.cv.width, L.cv.height); // (all of it: drawing a part of it samples a pixel beyond)
      L.c.setTransform(sc, 0, 0, sc, at[0], at[1]); // the joint
      bentInto(L.c, im, sp, b, rot);
    };
    layer(LIMB, img);
    const body = b.join && R.byId[b.parent], bsp = body && S()[R.pre + (P[body.id].img || body.part)];
    if (bsp) {
      // the body's silhouette in the limb's frame (the limb sits at b.at on the body's joint, unturned)
      const p = P[b.id], bx = -(b.at[0] + p.dx) - body.piv[0] * bsp.w, by = -(b.at[1] + p.dy) - body.piv[1] * bsp.h;
      layer(FUR, furOf(R.pre + b.part));
      const F = FUR.c;
      F.globalCompositeOperation = 'destination-in'; F.drawImage(bsp.img, bx, by, bsp.w, bsp.h); // fur only over the body
      F.setTransform(1, 0, 0, 1, 0, 0);
      if (Array.isArray(b.join)) {
        const g = F.createLinearGradient(0, (b.join[0] * h + mg) * sc, 0, (b.join[1] * h + mg) * sc);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
        F.fillStyle = g; F.fillRect(0, 0, bw, bh);
      }
      const L = LIMB.c;
      L.globalCompositeOperation = 'destination-out'; L.drawImage(bsp.img, bx, by, bsp.w, bsp.h); // outlined limb only outside it
      // (added, not laid over: the two halves split the body's soft edge between them, so no see-through hairline)
      L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'lighter';
      L.drawImage(FUR.cv, 0, 0, bw, bh, 0, 0, bw, bh);
      L.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(LIMB.cv, 0, 0, bw, bh, -px - mg, -py - mg, bw / sc, bh / sc);
  }
  // a piece without its dark outline, for where it lies over the body: the outline (and the soft pixels between it
  // and the fur) is painted over with the fur next to it, then the edge is pulled in a pixel and feathered, so the
  // limb's fur melts into the body's fur with no line and no pale rim
  const furCache = new Map();
  function furOf(name) {
    let cv = furCache.get(name);
    if (cv) return cv;
    const s = S()[name];
    cv = document.createElement('canvas');
    cv.width = s.img.width; cv.height = s.img.height;
    const c = cv.getContext('2d');
    c.drawImage(s.img, 0, 0);
    try {
      const W = cv.width, H = cv.height, d = c.getImageData(0, 0, W, H), px = d.data, n = W * H;
      const line = new Uint8Array(n), known = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3];
        if (a > 8 && 0.3 * r + 0.59 * g + 0.11 * b < 92) line[i] = 1;
      }
      const near = (i, f) => { const x = i % W, y = (i / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && f(Y * W + X)) return true; } return false; };
      const wide = line.slice();
      for (let i = 0; i < n; i++) if (!line[i] && px[i * 4 + 3] > 8 && near(i, (j) => line[j])) wide[i] = 1; // + the soft rim
      for (let i = 0; i < n; i++) known[i] = !wide[i] && px[i * 4 + 3] > 200 ? 1 : 0;
      // grow the fur's colours into the outline, a ring per pass
      for (let pass = 0; pass < 12; pass++) {
        const add = [];
        for (let i = 0; i < n; i++) {
          if (!wide[i] || known[i]) continue;
          let r = 0, g = 0, b = 0, k = 0;
          const x = i % W, y = (i / W) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx, Y = y + dy, j = Y * W + X;
            if (X < 0 || Y < 0 || X >= W || Y >= H || !known[j]) continue;
            r += px[j * 4]; g += px[j * 4 + 1]; b += px[j * 4 + 2]; k++;
          }
          if (k) add.push(i, r / k, g / k, b / k);
        }
        if (!add.length) break;
        for (let t = 0; t < add.length; t += 4) { const i = add[t]; px[i * 4] = add[t + 1]; px[i * 4 + 1] = add[t + 2]; px[i * 4 + 2] = add[t + 3]; known[i] = 1; }
      }
      // the edge: two pixels in, then a soft 3x3 blur of the alpha (four times): the limb's fur fades into the body's
      let al = new Float32Array(n);
      for (let i = 0; i < n; i++) al[i] = px[i * 4 + 3];
      for (let pass = 0; pass < 2; pass++) {
        const ero = new Float32Array(n);
        for (let i = 0; i < n; i++) { let m = al[i]; const x = i % W, y = (i / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; m = Math.min(m, X < 0 || Y < 0 || X >= W || Y >= H ? 0 : al[Y * W + X]); } ero[i] = m; }
        al = ero;
      }
      for (let pass = 0; pass < 4; pass++) {
        const bl = new Float32Array(n);
        for (let i = 0; i < n; i++) { let t = 0, k = 0; const x = i % W, y = (i / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; t += X < 0 || Y < 0 || X >= W || Y >= H ? 0 : al[Y * W + X]; k++; } bl[i] = t / k; }
        al = bl;
      }
      for (let i = 0; i < n; i++) px[i * 4 + 3] = Math.min(px[i * 4 + 3], al[i]);
      c.putImageData(d, 0, 0);
    } catch (e) { /* (a tainted canvas: keep the outline) */ }
    furCache.set(name, cv);
    return cv;
  }

  // o: { flip (face right), scale, alpha, tint: [colour, amount] }
  NC.PetRig.draw = function (ctx, type, st, x, y, o, q) {
    const R = RIGS[type];
    if (!R || !ready(R)) return false;
    o = o || {};
    if (!R.byId) { R.byId = {}; for (const b of R.bones) R.byId[b.id] = b; }
    const P = R.pose(R, st, q);
    // summoned: it pops in with a little hop
    let s = (o.scale || 1) * (R.k || 1), hop = 0;
    if (st.age < 0.5 && !R.noPop) {
      const u = st.age / 0.5;
      s *= u < 0.3 ? 0.35 + 0.75 * (u / 0.3) : 1 + 0.1 * Math.sin(((u - 0.3) / 0.7) * Math.PI * 2) * (1 - (u - 0.3) / 0.7);
      hop = -Math.sin(Math.min(1, u / 0.7) * Math.PI) * 22;
    }
    // (the points where strings tie on, in the world: for the puppet's strings)
    if (R.attach) {
      const M = boneMats(R, P, [o.flip ? -s : s, 0, 0, s, x, y + hop * (o.scale || 1)]);
      st.attach = R.attach.map(([id, fx, fy]) => { const b = R.byId[id], sp = S()[R.pre + (P[id].img || b.part)]; return sp ? at(M[id], (fx - b.piv[0]) * sp.w, (fy - b.piv[1]) * sp.h) : [x, y]; });
      st.mats = M; st.P = P;
    }
    const alpha = o.alpha === undefined ? 1 : o.alpha, tint = o.tint && o.tint[1] > 0 ? o.tint : null;
    // see-through or tinted: the pieces go into a buffer first, so their overlaps don't show through each other
    const buf = alpha < 0.999 || tint ? buffer(ctx, s) : null;
    const c = buf ? buf.c : ctx;
    c.save();
    if (buf) c.setTransform(buf.k, 0, 0, buf.k, BOX[0] * buf.k, BOX[1] * buf.k);
    else c.translate(x, y + hop * (o.scale || 1));
    c.scale(o.flip ? -s : s, s);
    for (const b of R.bones) {
      const p = P[b.id], name = R.pre + (p.img || b.part), sp = S()[name];
      if (!sp || p.hide) continue;
      c.save();
      apply(c, R, P, b.id, true);
      const img = b.dark ? darkOf(name) : sp.img;
      const pv = (R.piv && p.img && R.piv[p.img]) || b.piv;
      if (b.bend || b.join) bent(c, img, sp, b, p.rot, R, P);
      else c.drawImage(img, -pv[0] * sp.w, -pv[1] * sp.h, sp.w, sp.h);
      c.restore();
    }
    c.restore();
    if (buf) {
      if (tint) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = tint[1]; c.fillStyle = tint[0]; c.fillRect(0, 0, buf.cv.width, buf.cv.height); c.restore(); }
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.drawImage(buf.cv, 0, 0, buf.w, buf.h, x - BOX[0], y + hop * (o.scale || 1) - BOX[1], buf.w / buf.k, buf.h / buf.k);
      ctx.restore();
    }
    return true;
  };
  // the buffer: world units BOX around the feet (the biggest pet, scaled), at the screen's resolution
  const BOX = [150, 190], bufCv = document.createElement('canvas');
  function buffer(ctx, s) {
    const m = ctx.getTransform(), k = Math.min(3, Math.max(0.5, Math.hypot(m.a, m.b)));
    const w = Math.ceil(BOX[0] * 2 * k), h = Math.ceil((BOX[1] + 40) * k);
    if (bufCv.width < w) bufCv.width = w;
    if (bufCv.height < h) bufCv.height = h;
    const c = bufCv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, bufCv.width, bufCv.height);
    return { cv: bufCv, c, k, w, h };
  }

  // ================= the hunter's falcon (skills_v21.js) =================
  // The user wants a real hawk, flying at the hero's side all the time (no perching). skills_v21.js keeps its logic
  // (f.st: 'perch' = at the hero's side, 'go', 'strike', 'back'; f.x/f.y; f.face) and asks NC.PetRig.falcon() to
  // draw it. Here: wingbeats with a fast downstroke and the tips lagging, glides between bursts, a lean into the
  // flight, the head snapping from one spot to the next and locking onto the nearest monster, a screech on take-off,
  // a stoop with the wings folded, and at the target wings flared high, talons raking. Origin: the body's middle.
  RIGS.falcon = {
    pre: 'pr_falcon_',
    imgs: ['body', 'head', 'shriek', 'wingIn', 'wingOut', 'fold', 'tail', 'legOpen', 'legGrip'],
    bones: [
      { id: 'wingFi', parent: 'body', part: 'wingIn', piv: [0.2, 0.9], at: [1.5, -4.5], dark: true, k: 0.9 },
      { id: 'wingFo', parent: 'body', part: 'wingOut', piv: [0.2, 0.92], at: [0, 0], dark: true, k: 0.9 },
      { id: 'legf', parent: 'body', part: 'legGrip', piv: [0.5, 0.12], at: [1.5, 3.5], dark: true },
      { id: 'leg', parent: 'body', part: 'legGrip', piv: [0.5, 0.12], at: [-1, 4] },
      { id: 'tail', parent: 'body', part: 'tail', piv: [0.08, 0.5], at: [8.5, -0.5] },
      { id: 'body', parent: null, part: 'body', piv: [0.5, 0.5], at: [0, 0] },
      { id: 'head', parent: 'body', part: 'head', piv: [0.72, 0.82], at: [-6.5, -2.5], k: 1.15 },
      { id: 'fold', parent: 'body', part: 'fold', piv: [0.12, 0.45], at: [-3.5, -2.5] },
      { id: 'wingI', parent: 'body', part: 'wingIn', piv: [0.2, 0.9], at: [-1.5, -3.5] },
      { id: 'wingO', parent: 'body', part: 'wingOut', piv: [0.2, 0.92], at: [0, 0] },
    ],
    wrist: [0.62, 0.12], // where the outer half sits on the inner one (fractions of wingIn)
    k: 1.3, // (as big as the old flying picture)
    pose: (R, st) => falconPose(R, st),
  };
  const falconFresh = () => ({ age: rand(0, 5), t0: null, lx: null, ly: null, vx: 0, vy: 0, sp: 0, ph: rand(0, TAU), flapW: 1, burst: 0,
    last: 'perch', takeoff: 0, screech: 0, dive: 0, atk: 0, head: 0, headT: 0, snapIn: 0.5, e: 0.3, e2: 0.3 });
  // wing height through a beat: +1 up, -1 down; the downstroke takes 40 % of it
  const beat = (ph) => { const u = ((ph / TAU) % 1 + 1) % 1; return u < 0.4 ? Math.cos((u / 0.4) * Math.PI) : Math.cos(Math.PI + ((u - 0.4) / 0.6) * Math.PI); };
  function falconStep(game, p, f, st, dt) {
    st.age += dt;
    if (st.lx === null) { st.lx = f.x; st.ly = f.y; }
    let vx = (f.x - st.lx) / dt, vy = (f.y - st.ly) / dt;
    if (Math.hypot(f.x - st.lx, f.y - st.ly) > 300) vx = vy = 0; // (a jump: a map change)
    st.lx = f.x; st.ly = f.y;
    st.vx = toward(st.vx, vx, dt * 10); st.vy = toward(st.vy, vy, dt * 10);
    st.sp = Math.hypot(st.vx, st.vy);
    if (f.st !== st.last) {
      if (st.last === 'perch' && f.st === 'go') { st.takeoff = 0.22; st.screech = 0.45; }
      if (f.st === 'back') st.takeoff = 0.3;
      st.last = f.st;
    }
    st.takeoff = Math.max(0, st.takeoff - dt); st.screech = Math.max(0, st.screech - dt);
    st.dive = toward(st.dive, f.st === 'go' && st.takeoff <= 0 ? 1 : 0, dt * 14);
    st.atk = toward(st.atk, f.st === 'strike' ? 1 : 0, dt * 16);
    // wingbeats: bursts of flaps and short glides at the hero's side; hard, fast beats on take-off and when hurrying
    const hurry = clamp(st.sp / 500, 0, 1);
    st.burst -= dt;
    if (st.burst < -0.55 || (hurry > 0.4 && st.burst < 0)) st.burst = rand(0.7, 1.3);
    const flapping = st.takeoff > 0 || f.st === 'back' || hurry > 0.25 || st.burst > 0;
    st.flapW = toward(st.flapW, flapping ? 1 : 0, dt * 6);
    st.ph += dt * TAU * (st.takeoff > 0 ? 9 : lerp(4.2, 7.5, hurry)) * (0.25 + 0.75 * st.flapW);
    const eg = 0.55 + Math.sin(st.age * 1.7) * 0.07; // gliding: wings held up in a shallow V
    st.e = lerp(eg, beat(st.ph), st.flapW); st.e2 = lerp(eg + 0.05, beat(st.ph - 0.9), st.flapW);
    // the head: snaps to a new spot and holds it, or locks onto the nearest monster
    let prey = null, pd = 620;
    for (const e of game.enemies) { if (!e || e.dead || e.hp <= 0) continue; const d = Math.hypot(e.x - f.x, e.y - f.y); if (d < pd) { pd = d; prey = e; } }
    if (f.st === 'strike' || f.st === 'go') prey = f.e || prey;
    st.snapIn -= dt;
    if (prey) {
      const dx = Math.abs(prey.x - f.x) + 30, dy = (prey.y - 50) - f.y;
      st.headT = -clamp(Math.atan2(dy, dx), -0.9, 0.9) * 0.6;
    } else if (st.snapIn <= 0) { st.snapIn = rand(0.35, 1.6); st.headT = rand(-0.3, 0.25); }
    st.head = toward(st.head, st.headT, dt * 30);
  }
  function falconPose(R, st) {
    const P = blank(R), B = P.body, H = P.head;
    const dive = st.dive, atk = st.atk, hurry = clamp(st.sp / 500, 0, 1);
    // the body: a hover leans a little up, speed leans it into the flight; the stoop points it down; the strike stands it up
    const pitch = -clamp(Math.atan2(st.vy, Math.abs(st.vx) + 1), -0.9, 0.9);
    let rot = lerp(0.12 - 0.22 * hurry, pitch * 0.7, clamp(st.sp / 700, 0, 1));
    rot = lerp(rot, Math.min(pitch, 0) - 0.35, dive);
    rot = lerp(rot, 0.5, atk);
    B.rot = rot;
    B.dy = -st.e * 1.6 * (1 - dive); // (the beat lifts it)
    // the head keeps level and looks around
    H.rot = -rot * 0.75 + st.head;
    H.img = st.screech > 0 || atk > 0.5 ? 'shriek' : null;
    // the wings: height e (+1 up, -1 down) squashes the piece through the edge-on middle of the stroke
    const open = 1 - dive;
    const wing = (inn, out, e, e2) => {
      const flare = 0.78 + Math.sin(st.age * TAU * 10) * 0.22;
      e = lerp(e, flare, atk); e2 = lerp(e2, flare, atk);
      const syI = Math.sign(e || 1) * (0.3 + 0.7 * Math.abs(e)), rotI = lerp(-0.3, 0.55, (1 - e) / 2);
      P[inn].rot = rotI; P[inn].sy = syI;
      const bI = R.byId[inn], sp = S()[R.pre + bI.part], k = bI.k || 1;
      const lx = (R.wrist[0] - bI.piv[0]) * sp.w * k, ly = (R.wrist[1] - bI.piv[1]) * sp.h * k * syI;
      P[out].dx = bI.at[0] + lx * Math.cos(rotI) - ly * Math.sin(rotI);
      P[out].dy = bI.at[1] + lx * Math.sin(rotI) + ly * Math.cos(rotI);
      P[out].rot = rotI + 0.25 * (e - e2) - 0.1;
      P[out].sy = Math.sign(e2 || 1) * (0.3 + 0.7 * Math.abs(e2));
      P[inn].hide = P[out].hide = open < 0.5;
    };
    wing('wingI', 'wingO', st.e, st.e2);
    wing('wingFi', 'wingFo', st.e, st.e2);
    P.fold.hide = open >= 0.5;
    // the legs: tucked back in flight, talons thrust forward and raking at the target
    const tuck = -1.0 + Math.sin(st.age * 2.3) * 0.08;
    P.leg.rot = lerp(tuck, 0.85 + Math.sin(st.age * TAU * 5) * 0.3, atk);
    P.legf.rot = lerp(tuck + 0.15, 0.7 + Math.sin(st.age * TAU * 5 + 2) * 0.3, atk);
    if (atk > 0.5) P.leg.img = P.legf.img = 'legOpen';
    // the tail: steers a little, closes in the stoop, fans down to brake at the target
    P.tail.rot = Math.sin(st.age * 2.1) * 0.08 * (1 - dive) + atk * 0.45 - rot * 0.2;
    P.tail.sy = lerp(lerp(1, 0.8, dive), 1.25, atk);
    return P;
  }
  NC.PetRig.falconFresh = falconFresh;
  // skills_v21.js's drawFalcon asks this first: true = drawn here
  NC.PetRig.falcon = function (ctx, game, p, f) {
    const R = RIGS.falcon;
    if (!R || !ready(R)) return false;
    if (!R.byId) { R.byId = {}; for (const b of R.bones) R.byId[b.id] = b; }
    const st = f.rig || (f.rig = falconFresh());
    const dt = st.t0 === null ? 0 : clamp(game.time - st.t0, 0, 0.1);
    st.t0 = game.time;
    if (dt > 0) falconStep(game, p, f, st, dt);
    // at the hero's side it drifts in a slow loop
    const side = f.st === 'perch' ? 1 : 0;
    st.side = toward(st.side === undefined ? side : st.side, side, dt * 3);
    const x = f.x + Math.sin(st.age * 1.1 + f.i * 2) * 9 * st.side, y = f.y + Math.sin(st.age * 2.2 + f.i) * 5 * st.side;
    if (f.gold) V.glow(ctx, x, y, 70, '255,210,90', 0.5, true);
    NC.PetRig.draw(ctx, 'falcon', st, x, y, { flip: f.face > 0, scale: 1.1, tint: f.gold ? ['#ffd24a', 0.45] : null });
    return true;
  };

  // ================= the puppeteer's battle puppet (jobs3_skills_c.js: pp_axe / pp_shield / pp_xbow) =================
  // A wooden marionette knight in pieces with ball joints (seams are welcome here: they are its joints). It hangs from
  // the strings: it bobs as it walks, the knee strings pull the thighs up and the shins dangle, the arms swing loose on
  // springs and lag behind; the strings run from the puppeteer's control bar to the ring on its helmet, its hands and
  // its knees. Attacks by build: the axe winds up over the head and chops, the shield bashes, the crossbow kicks back.
  // A spin (ระบำหุ่น) turns it round and round; it is put together piece by piece when summoned and falls apart when it
  // breaks. Origin: the ground under its feet; the invisible pelvis bone carries the torso and the legs.
  const PUP = {
    pre: 'pr_puppet_',
    imgs: ['head', 'torso', 'armU', 'armL', 'thigh', 'shin', 'axe', 'shield', 'xbow'],
    bones: [
      { id: 'pelvis', parent: null, part: null, piv: [0, 0], at: [0, -39.5] },
      { id: 'shinF', parent: 'thighF', part: 'shin', piv: [0.6, 0.12], at: [0, 11.5], dark: true },
      { id: 'thighF', parent: 'pelvis', part: 'thigh', piv: [0.5, 0.13], at: [10, 0], dark: true },
      { id: 'foreF', parent: 'armF', part: 'armL', piv: [0.5, 0.1], at: [0, 19], dark: true },
      { id: 'armF', parent: 'torso', part: 'armU', piv: [0.5, 0.14], at: [15, -25.6], dark: true },
      { id: 'shinN', parent: 'thighN', part: 'shin', piv: [0.6, 0.12], at: [0, 11.5] },
      { id: 'thighN', parent: 'pelvis', part: 'thigh', piv: [0.5, 0.13], at: [-11.7, 0] },
      { id: 'torso', parent: 'pelvis', part: 'torso', piv: [0.5, 0.88], at: [0, 0] },
      { id: 'head', parent: 'torso', part: 'head', piv: [0.5, 0.95], at: [0, -31], k: 1.1 },
      { id: 'wpnU', parent: 'foreN', part: 'axe', piv: [0.72, 0.72], at: [0.7, 24.4] },
      { id: 'foreN', parent: 'armN', part: 'armL', piv: [0.5, 0.1], at: [0, 19] },
      { id: 'armN', parent: 'torso', part: 'armU', piv: [0.5, 0.14], at: [-15, -25.6] },
      { id: 'wpnO', parent: 'foreN', part: 'shield', piv: [0.5, 0.5], at: [0.7, 24.4] },
    ],
    piv: { axe: [0.72, 0.72], shield: [0.5, 0.5], xbow: [0.62, 0.55] }, // (each weapon's grip)
    // where the strings tie on: [bone, x, y (fractions of its piece)], the knees fainter
    attach: [['head', 0.5, 0.03], ['foreN', 0.5, 0.95], ['foreF', 0.5, 0.95], ['thighN', 0.5, 0.92], ['thighF', 0.5, 0.92]],
    k: 1.1, // (as big as the old picture)
    noPop: true, // (it is put together piece by piece instead)
    stride: 70,
    step: (game, q, dt) => puppetStep(game, q, dt),
    pose: (R, st, q) => puppetPose(R, st, q),
    strings: (ctx, q, st) => puppetStrings(ctx, q, st),
  };
  RIGS.pp_axe = RIGS.pp_shield = RIGS.pp_xbow = PUP;
  const buildOf = (q) => (q && q.type ? q.type.slice(3) : 'axe');
  // the arms' rest and aim per build (radians; 0 = hanging down, + = the hand forward): upper arm, forearm, weapon
  const HOLD = {
    axe: { armN: 0.3, foreN: 1.2, wpn: -1.35, armF: -0.15, foreF: 0.35 },
    shield: { armN: 0.85, foreN: 0.55, wpn: -1.4, armF: 0.1, foreF: 0.45 },
    xbow: { armN: 1.1, foreN: 0.35, wpn: -1.45, armF: 1.0, foreF: 0.5 },
  };
  const spring = (sp, want, k, c, dt) => { sp.v += ((want - sp.a) * k - sp.v * c) * dt; sp.a += sp.v * dt; };
  const puppetFresh = () => ({ age: 0, lx: null, ly: null, spd: 0, lastSpd: 0, amp: 0, ph: 0, face: 0, turn: 0, danceT: 0,
    atk: 0, lastLunge: 0, twitch: 0, twitchIn: rand(2, 4), twitchArm: 0, tilt: 0, tiltIn: rand(2, 5),
    sp: { armN: { a: 0, v: 0 }, foreN: { a: 0, v: 0 }, armF: { a: 0, v: 0 }, foreF: { a: 0, v: 0 }, head: { a: 0, v: 0 }, torso: { a: 0, v: 0 } } });
  function puppetStep(game, q, dt) {
    const st = q.rig || (q.rig = puppetFresh());
    if (dt <= 0) return;
    st.age += dt;
    if (st.lx === null) { st.lx = q.x; st.ly = q.y; st.face = q.face; }
    let d = Math.hypot(q.x - st.lx, q.y - st.ly);
    st.lx = q.x; st.ly = q.y;
    if (d > 160) d = 0; // (a swap, a warp)
    st.spd = toward(st.spd, d / dt, dt * 12);
    const acc = (st.spd - st.lastSpd) / dt;
    st.lastSpd = st.spd;
    st.amp = toward(st.amp, clamp(st.spd / ((q.T.speed || 320) * 0.5), 0, 1), dt * 8);
    st.ph += (d / (PUP.stride * (q.scale || 1))) * TAU;
    // a turn (the spin of ระบำหุ่น flips it): it spins round instead of snapping
    if (q.face !== st.face) { st.face = q.face; st.turn = 0.16; st.danceT = 0.5; }
    st.turn = Math.max(0, st.turn - dt); st.danceT = Math.max(0, st.danceT - dt);
    // an attack: puppetHit sets q.lunge
    if ((q.lunge || 0) > st.lastLunge + 0.01) st.atk = buildOf(q) === 'axe' ? 0.45 : 0.32;
    st.lastLunge = q.lunge || 0;
    st.atk = Math.max(0, st.atk - dt);
    // idle: now and then the puppeteer jerks a string, an arm jumps up and falls back; the head tilts
    const busy = st.spd > 30 || st.atk > 0 || st.danceT > 0;
    if ((st.twitchIn -= dt) <= 0) { st.twitchIn = rand(2.5, 5.5); if (!busy) { st.twitch = 0.22; st.twitchArm = Math.random() < 0.5 ? 0 : 1; } }
    st.twitch = Math.max(0, st.twitch - dt);
    if ((st.tiltIn -= dt) <= 0) { st.tiltIn = rand(1.8, 4); st.tilt = busy ? 0 : rand(-0.22, 0.22); }
    // the arms and head on springs: loose when walking or waiting, snappy in an attack
    const H = HOLD[buildOf(q)], w = st.amp, sw = Math.sin(st.ph);
    const want = { armN: H.armN - 0.35 * sw * w * (buildOf(q) === 'axe' ? 1 : 0.4), foreN: H.foreN, armF: H.armF + 0.4 * sw * w, foreF: H.foreF + 0.2 * w, head: st.tilt, torso: 0 };
    if (st.twitch > 0) want[st.twitchArm ? 'armF' : 'armN'] += 1.3;
    if (st.danceT > 0) { want.armN = 1.7; want.foreN = 0.2; want.armF = -1.2; }
    const a = st.atk, b = buildOf(q);
    if (a > 0) {
      // (the axe goes up the front and over the head, so the chop comes back down over the top)
      if (b === 'axe') { const u = 1 - a / 0.45; if (u < 0.4) { want.armN = 3.35; want.foreN = 0.25; want.torso = 0.14; } else { want.armN = 1.5; want.foreN = 0.15; want.torso = -0.22; } }
      else if (b === 'shield') { want.armN = 1.5; want.foreN = 0.05; want.torso = -0.2; }
      else { const u = 1 - a / 0.32; if (u < 0.35) { want.armN = H.armN - 0.45; want.foreN = H.foreN - 0.25; want.torso = 0.12; } }
    }
    const k = a > 0 ? 520 : 120, c = a > 0 ? 30 : 9;
    for (const id of ['armN', 'foreN', 'armF', 'foreF', 'head', 'torso']) spring(st.sp[id], want[id], id === 'foreN' || id === 'foreF' ? k * 0.8 : k, c, dt);
    // speeding up leaves the arms behind, a hit knocks them up
    st.sp.armN.v -= acc * 0.0012; st.sp.armF.v -= acc * 0.0012;
    if ((q.hurt || 0) > 0.25) { st.sp.armN.v += 6; st.sp.armF.v -= 6; st.sp.head.v += 5; st.sp.torso.v += 3; }
  }
  function puppetPose(R, st, q) {
    const P = blank(R), b = buildOf(q), w = st.amp, ph = st.ph;
    // the gait: a marionette's high knees and dangling shins, a bounce at every step, the whole puppet held up a little
    for (const [th, sh, o] of [['thighN', 'shinN', 0], ['thighF', 'shinF', Math.PI]]) {
      const s = Math.sin(ph + o), lift = Math.max(0, Math.cos(ph + o));
      P[th].rot = w * (0.55 * s + 0.35 * lift);
      P[sh].rot = -w * 0.95 * lift + w * 0.1;
    }
    const bob = Math.sin(st.age * 2.4) * 1.6 * (1 - w);
    P.pelvis.dy = -w * 5 * Math.abs(Math.sin(ph)) - 2 - bob;
    P.pelvis.rot = 0.04 * Math.sin(ph) * w;
    P.torso.rot = -0.06 * w + st.sp.torso.a;
    P.head.rot = st.sp.head.a + 0.05 * Math.sin(ph * 2) * w;
    for (const id of ['armN', 'foreN', 'armF', 'foreF']) P[id].rot = st.sp[id].a;
    // the weapon in the near hand: the axe and the crossbow behind the fist, the shield over it
    const H = HOLD[b], hand = st.sp.armN.a + st.sp.foreN.a;
    const wp = b === 'shield' ? 'wpnO' : 'wpnU';
    P[b === 'shield' ? 'wpnU' : 'wpnO'].hide = true;
    P[wp].img = b;
    P[wp].rot = b === 'axe' ? H.wpn + (st.sp.armN.a - H.armN) * 0.35 : -hand + (b === 'xbow' ? -0.05 : 0);
    if (b === 'axe' && st.atk > 0) { // (the axe's own angle in the world: raised back over the head, then down onto the target)
      const u = 1 - st.atk / 0.45, e = u < 0.4 ? 0 : Math.min(1, (u - 0.4) / 0.2), world = lerp(-0.35, 2.1, e * e * (3 - 2 * e));
      P[wp].rot = world - (st.sp.armN.a + st.sp.foreN.a + st.sp.torso.a - 0.06 * st.amp);
    }
    // put together when summoned: every piece drops in on its string, one after another
    if (st.age < 0.9) {
      R.bones.forEach((bn, i) => {
        if (!bn.part) return;
        const u = clamp((st.age - i * 0.035) / 0.4, 0, 1), e = 1 - Math.pow(1 - u, 3);
        P[bn.id].dy -= (1 - e) * 70;
        P[bn.id].rot += (1 - e) * (i % 2 ? 1.2 : -1.2);
        if (u <= 0) P[bn.id].hide = true;
      });
    }
    // a turn: squashed through edge-on as it spins
    if (st.turn > 0) P.pelvis.sx = Math.max(0.12, 1 - st.turn / 0.16);
    return P;
  }
  // the strings: from the control bar (K.tip) to the attach points found by NC.PetRig.draw
  function puppetStrings(ctx, q, st) {
    const K = NC.SkillKit, pts = st.attach;
    if (!K || !pts || !q.owner) return;
    const [hx, hy] = K.tip(q.owner);
    ctx.save(); ctx.lineWidth = 1.4;
    pts.forEach(([x, y], i) => {
      ctx.strokeStyle = `rgba(215,195,255,${i >= 3 ? 0.3 : 0.55})`;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + x) / 2, Math.min(hy, y) - 30, x, y); ctx.stroke();
    });
    ctx.restore();
  }
  // broken: the pieces fall apart and tumble, then fade
  FX.def('prbreak', (ctx, f, u) => {
    ctx.save(); ctx.globalAlpha *= u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    for (const c of f.pieces) {
      const sp = S()[c.name];
      if (!sp) continue;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(c.sx, c.sy);
      ctx.drawImage(c.dark ? darkOf(c.name) : sp.img, -c.piv[0] * sp.w, -c.piv[1] * sp.h, sp.w, sp.h);
      ctx.restore();
    }
    ctx.restore();
  }, 'high');
  NC.PetRig.puppetFresh = puppetFresh;

  // ================= the dragon knight's baby wyvern (class2_skills_a.js: pets.js type 'wyvern') =================
  // Chubby bat-winged flight: quick beats that bob it up on every downstroke (the falcon's wing trick: the wing piece
  // squashed through edge-on), a two-part tail swinging on springs with its little flame always burning upward and
  // flickering, dangling hind legs, the head watching its target; when it breathes fire (pets.js q.fire) the jaws open,
  // the head thrusts in and the body kicks back. Origin: where pets.js puts it (q.y minus its flying height).
  // a wing of two halves (inner, outer) at height e (+1 up .. -1 down): squashed along its length through the middle of
  // the stroke, mirrored below; the outer half sits on the inner one's wrist and lags (e2)
  function flapWing(R, P, inn, out, e, e2, up, down) {
    const syI = Math.sign(e || 1) * (0.3 + 0.7 * Math.abs(e)), rotI = lerp(up, down, (1 - e) / 2);
    P[inn].rot = rotI; P[inn].sy = syI;
    const bI = R.byId[inn], sp = S()[R.pre + bI.part], k = bI.k || 1;
    const lx = (R.wrist[0] - bI.piv[0]) * sp.w * k, ly = (R.wrist[1] - bI.piv[1]) * sp.h * k * syI;
    P[out].dx = bI.at[0] + lx * Math.cos(rotI) - ly * Math.sin(rotI);
    P[out].dy = bI.at[1] + lx * Math.sin(rotI) + ly * Math.cos(rotI);
    P[out].rot = rotI + 0.3 * (e - e2) - 0.08;
    P[out].sy = Math.sign(e2 || 1) * (0.3 + 0.7 * Math.abs(e2));
  }
  RIGS.wyvern = {
    pre: 'pr_wyvern_',
    imgs: ['body', 'head', 'fire', 'wingIn', 'wingOut', 'leg', 'tailA', 'tailB', 'flame'],
    bones: [
      // the far wing and leg behind (darker); the tail behind the body, its tip joined to its base with one outline;
      // the near leg joined over the belly
      { id: 'wingFi', parent: 'body', part: 'wingIn', piv: [0.12, 0.9], at: [2, -6], dark: true, k: 0.9 },
      { id: 'wingFo', parent: 'body', part: 'wingOut', piv: [0.12, 0.9], at: [0, 0], dark: true, k: 0.9 },
      { id: 'legF', parent: 'body', part: 'leg', piv: [0.4, 0.2], at: [2.7, 4.8], dark: true },
      { id: 'tailA', parent: 'body', part: 'tailA', piv: [0.08, 0.45], at: [8.5, 0.9], k: 0.75 },
      { id: 'tailB', parent: 'tailA', part: 'tailB', piv: [0.06, 0.4], at: [21, 2], join: true },
      { id: 'flame', parent: 'tailB', part: 'flame', piv: [0.5, 0.92], at: [18, -1.5] },
      { id: 'body', parent: null, part: 'body', piv: [0.5, 0.5], at: [0, -19] },
      { id: 'leg', parent: 'body', part: 'leg', piv: [0.4, 0.2], at: [-1.1, 5.1], join: true },
      { id: 'head', parent: 'body', part: 'head', piv: [0.78, 0.82], at: [-9, -2.6] },
      { id: 'wingI', parent: 'body', part: 'wingIn', piv: [0.12, 0.9], at: [-1, -5] },
      { id: 'wingO', parent: 'body', part: 'wingOut', piv: [0.12, 0.9], at: [0, 0] },
    ],
    wrist: [0.7, 0.1],
    k: 1,
    glowA: 0.28,
    step: (game, q, dt) => wyvernStep(game, q, dt),
    pose: (R, st, q) => wyvernPose(R, st, q),
  };
  const wyvernFresh = () => ({ age: 0, lx: null, ly: null, vx: 0, sp: 0, acc: 0, ph: rand(0, TAU), e: 0.5, e2: 0.5, look: 0, fire: 0, lastFire: 0,
    tA: { a: 0, v: 0 }, tB: { a: 0, v: 0 }, legs: { a: 0, v: 0 }, blinkIn: 2 });
  function wyvernStep(game, q, dt) {
    const st = q.rig || (q.rig = wyvernFresh());
    if (dt <= 0) return;
    st.age += dt;
    if (st.lx === null) { st.lx = q.x; st.ly = q.y; }
    let dx = q.x - st.lx; const dyv = q.y - st.ly;
    if (Math.hypot(dx, dyv) > 200) dx = 0;
    st.lx = q.x; st.ly = q.y;
    const vx = toward(st.vx, (dx / dt) * -q.face, dt * 8); // (forward speed: the art faces left)
    st.acc = (vx - st.vx) / dt; st.vx = vx;
    st.sp = Math.abs(vx);
    const hurry = clamp(st.sp / 300, 0, 1);
    st.ph += dt * TAU * lerp(4.2, 6.5, hurry);
    const beatW = (ph) => { const u = ((ph / TAU) % 1 + 1) % 1; return u < 0.4 ? Math.cos((u / 0.4) * Math.PI) : Math.cos(Math.PI + ((u - 0.4) / 0.6) * Math.PI); };
    const shallow = (v) => (v < 0 ? v * 0.55 : v); // (short wings on a round body: a shallow downstroke)
    st.e = shallow(beatW(st.ph)); st.e2 = shallow(beatW(st.ph - 0.45));
    // breathing fire: pets.js sets q.fire when it shoots
    if ((q.fire || 0) > st.lastFire + 0.01) st.fire = 0.4;
    st.lastFire = q.fire || 0;
    st.fire = Math.max(0, st.fire - dt);
    // where it looks
    let look = 0;
    const e = q.target;
    if (e && !e.dead) look = -clamp(Math.atan2((e.y - 40) - (q.y - (q.T.fly || 0)), Math.abs(e.x - q.x) + 40), -0.8, 0.8) * 0.5;
    st.look = toward(st.look, look, dt * 6);
    // the tail on springs: swings with the beats, trails back when it hurries, the tip lagging behind the base
    // (it curls up like the old picture: the base a little up, the tip more; hurrying straightens it out behind)
    spring(st.tA, Math.sin(st.ph * 0.5) * 0.18 - 0.35 + hurry * 0.3, 70, 7, dt);
    spring(st.tB, Math.sin(st.ph * 0.5 - 1) * 0.25 - 0.6 + hurry * 0.45, 55, 6, dt);
    st.tA.v -= st.acc * 0.0008; st.tB.v -= st.acc * 0.0012;
    spring(st.legs, -0.25 + Math.max(0, -st.e) * 0.35 - hurry * 0.5, 90, 8, dt);
  }
  function wyvernPose(R, st, q) {
    const P = blank(R), B = P.body, H = P.head, f = st.fire > 0 ? Math.sin(Math.min(1, (0.4 - st.fire) / 0.12) * Math.PI / 2) * Math.min(1, st.fire / 0.15) : 0;
    const hurry = clamp(st.sp / 300, 0, 1);
    B.dy = -st.e * 3 + Math.sin(st.age * 1.6) * 2;
    B.rot = -0.12 * hurry + 0.12 * f + Math.sin(st.ph) * 0.03;
    H.rot = st.look - B.rot * 0.6 - 0.12 * f;
    H.dx = -3 * f;
    H.img = f > 0.2 ? 'fire' : null;
    flapWing(R, P, 'wingI', 'wingO', st.e, st.e2, -0.25, 0.6);
    flapWing(R, P, 'wingFi', 'wingFo', st.e, st.e2, -0.25, 0.6);
    P.tailA.rot = st.tA.a; P.tailB.rot = st.tB.a;
    // the flame burns upward whatever the tail does, and flickers
    P.flame.rot = -(B.rot + P.tailA.rot + P.tailB.rot) + Math.sin(st.age * 23) * 0.12;
    P.flame.sy = 1 + Math.sin(st.age * 17) * 0.14 + Math.sin(st.age * 29) * 0.08;
    P.flame.sx = 1 - Math.sin(st.age * 17) * 0.08;
    P.leg.rot = st.legs.a; P.legF.rot = st.legs.a + 0.25;
    return P;
  }

  // ================= the warlock's lantern spirit (class2_skills_a.js: pets.js type 'lantern') =================
  // An iron lantern swinging from its ring like a pendulum as it floats after the warlock (moving tips it back, stopping
  // swings it forward), the teal ghost inside sloshing a beat behind, blinking, and glaring with its flame flared up
  // when it casts (q.fire); the wisp below waves like a flame.
  RIGS.lantern = {
    pre: 'pr_lantern_',
    imgs: ['frame', 'ghost', 'blink', 'angry', 'wisp'],
    bones: [
      { id: 'ring', parent: null, part: null, piv: [0, 0], at: [0, -46] },
      { id: 'wisp', parent: 'frame', part: 'wisp', piv: [0.4, 0.05], at: [-1, 29.5], bend: [0.1, 0.9] },
      { id: 'ghost', parent: 'frame', part: 'ghost', piv: [0.5, 0.62], at: [-1.3, 20], k: 0.72 },
      { id: 'frame', parent: 'ring', part: 'frame', piv: [0.5, 0.05], at: [0, 0] },
    ],
    k: 1,
    glowA: 0.55,
    step: (game, q, dt) => lanternStep(game, q, dt),
    pose: (R, st, q) => lanternPose(R, st, q),
  };
  const lanternFresh = () => ({ age: 0, lx: null, vx: 0, sw: { a: 0, v: 0 }, gh: { a: 0, v: 0 }, wi: { a: 0, v: 0 }, fire: 0, lastFire: 0, blinkT: 0, blinkIn: rand(1.5, 3) });
  function lanternStep(game, q, dt) {
    const st = q.rig || (q.rig = lanternFresh());
    if (dt <= 0) return;
    st.age += dt;
    if (st.lx === null) st.lx = q.x;
    let dx = q.x - st.lx; st.lx = q.x;
    if (Math.abs(dx) > 200) dx = 0;
    const vx = toward(st.vx, (dx / dt) * -q.face, dt * 8), acc = (vx - st.vx) / dt;
    st.vx = vx;
    // a pendulum from the ring: speeding forward tips the bottom back (+), with a slow idle sway
    spring(st.sw, clamp(vx / 1100, -0.28, 0.28) + Math.sin(st.age * 1.3) * 0.06, 34, 3.4, dt);
    st.sw.v += acc * 0.00022;
    st.sw.a = clamp(st.sw.a, -0.6, 0.6);
    spring(st.gh, -st.sw.a * 0.6, 60, 5, dt); // (the ghost stays more upright: it sloshes)
    spring(st.wi, -st.sw.a * 0.8 + Math.sin(st.age * 3.1) * 0.25, 40, 4, dt);
    if ((q.fire || 0) > st.lastFire + 0.01) st.fire = 0.45;
    st.lastFire = q.fire || 0;
    st.fire = Math.max(0, st.fire - dt);
    st.blinkT = Math.max(0, st.blinkT - dt);
    if ((st.blinkIn -= dt) <= 0) { st.blinkT = 0.14; st.blinkIn = rand(1.6, 4); }
  }
  function lanternPose(R, st) {
    const P = blank(R), f = st.fire > 0 ? Math.min(1, st.fire / 0.15) : 0;
    P.frame.rot = st.sw.a;
    P.ring.dy = Math.sin(st.age * 2.2) * 3;
    P.ghost.rot = st.gh.a;
    P.ghost.dy = Math.sin(st.age * 3.3) * 1.2;
    const br = Math.sin(st.age * 4.1);
    P.ghost.sx = 1 + br * 0.04 - f * 0.05; P.ghost.sy = 1 - br * 0.04 + f * 0.16;
    P.ghost.img = f > 0.2 ? 'angry' : st.blinkT > 0 ? 'blink' : null;
    P.wisp.rot = st.wi.a;
    P.wisp.sx = 1 + Math.sin(st.age * 5.3) * 0.12;
    return P;
  }

  // ---------------- forward kinematics: where a point of a bone ends up in the world ----------------
  const mmul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  function boneMats(R, P, base) {
    const out = {};
    const get = (id) => {
      if (out[id]) return out[id];
      const b = R.byId[id], p = P[id], c = Math.cos(p.rot), s = Math.sin(p.rot), k = b.k || 1;
      let m = [c * p.sx * k, s * p.sx * k, -s * p.sy * k, c * p.sy * k, b.at[0] + p.dx, b.at[1] + p.dy];
      m = mmul(b.parent ? get(b.parent) : base, m);
      return (out[id] = m);
    };
    for (const b of R.bones) get(b.id);
    return out;
  }
  const at = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  // ---------------- hooks: pets.js's update and drawing (through party.js) ----------------
  if (NC.Party && NC.Pets) {
    const baseUpdate = NC.Party.update;
    NC.Party.update = function (game, dt) {
      baseUpdate(game, dt);
      for (const q of NC.Pets.list) if (RIGS[q.type] && RIGS[q.type].step) RIGS[q.type].step(game, q, dt);
    };
    const baseDraw = NC.Party.draw;
    NC.Party.draw = function (ctx, game, o) {
      if (!o.pet || !RIGS[o.type] || !ready(RIGS[o.type]) || !o.rig) return baseDraw(ctx, game, o);
      const q = o, y = q.y - (q.T.fly || 0);
      const R = RIGS[q.type];
      if (q.glow) V.glow(ctx, q.x, y - 26 * q.scale, 70 * q.scale, q.glow, R.glowA || 0.28, false);
      if (q.aura && !R.strings) q.aura(ctx, q, y);
      const tint = q.hurt > 0 ? ['#ff5a5a', (q.hurt / 0.3) * 0.6] : q.tint || null;
      NC.PetRig.draw(ctx, q.type, q.rig, q.x, y, { flip: q.face > 0, scale: q.scale, tint, alpha: q.fade * (q.inv > 0 && Math.floor(game.time * 20) % 2 ? 0.6 : 1) }, q);
      if (R.strings) R.strings(ctx, q, q.rig);
    };
  }

  if (NC.Pets) {
    const baseDismiss = NC.Pets.dismiss;
    NC.Pets.dismiss = function (type, quiet) {
      if (!quiet) for (const q of NC.Pets.list) {
        const R = RIGS[q.type], st = q.rig;
        if ((type && q.type !== type) || R !== PUP || !st || !st.mats) continue;
        const pieces = [];
        for (const b of R.bones) {
          const p = st.P[b.id], name = R.pre + (p.img || b.part), m = st.mats[b.id];
          if (!b.part || p.hide || !S()[name]) continue;
          pieces.push({ name, dark: b.dark, piv: (R.piv && p.img && R.piv[p.img]) || b.piv, x: m[4], y: m[5], rot: Math.atan2(m[1], m[0]), sx: Math.hypot(m[0], m[1]) * Math.sign(m[0] * m[3] - m[1] * m[2] || 1), sy: Math.hypot(m[2], m[3]),
            vx: rand(-160, 160), vy: rand(-320, -120), spin: rand(-9, 9), floor: q.y + rand(-6, 10) });
        }
        FX.add({ type: 'prbreak', layer: 'high', x: q.x, y: q.y, life: 1.6, pieces, update(f, dt) { // (fx.js calls it every step)
          for (const c of pieces) {
            c.vy += 1100 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.spin * dt;
            if (c.y > c.floor) { c.y = c.floor; c.vy *= -0.35; c.vx *= 0.6; c.spin *= 0.5; }
          }
        } });
      }
      return baseDismiss.apply(this, arguments);
    };
  }

  // the spirit pack (class2_skills_b.js): the glowing wolves gallop with the rig too
  const spiritDraw = (ctx, q, u) => {
    const a = V.fade(u, 0.1, 0.2);
    if (!q.rig) { q.rig = NC.PetRig.fresh(); q.rig.age = 1; q.rig.amp = 1; q.rig.gal = 1; q.rig.ph = rand(0, TAU); }
    q.rig.ph += 0.42; // (about one frame of a fast gallop)
    V.glow(ctx, q.x, q.y - 40, 90, '150,200,255', 0.6 * a, true);
    if (!NC.PetRig.draw(ctx, 'wolf', q.rig, q.x, q.y, { flip: q.vx > 0, scale: 1.1, alpha: 0.85 * a, tint: ['#9fd0ff', 0.75] })) {
      NC.drawSpr(ctx, Math.floor(q.t * 10) % 2 ? 'pet_wolf_b' : 'pet_wolf', q.x, q.y, { flip: q.vx > 0, scale: 1.1, alpha: 0.85 * a, tint: ['#9fd0ff', 0.75] });
    }
  };
  FX.def('vspiritwolf', spiritDraw, 'glow');
})();
