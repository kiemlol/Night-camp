/* throwstar.js — the ninja's giant shuriken (ขว้างดาวยักษ์วกกลับ) is thrown, not swung. The user (2026-10-01): "ตอนปาชูริเคน
   นินจาไม่ได้ปาหรอ ใช้ตีระยะประชิดหรอ", then "ทั้ง 2 ข้อ แล้วปาต้องปาตามดาวกระจายที่ถือด้วย" (both: a real throw pose for
   the skills, and a thrown basic attack; what flies is the star the hero holds).
     basic attack   every huuma (wtype 'huuma': the first one and the 40 of the catalog) gets style 'throw'. The combo is
                    three throws (overhand, side-arm, a jumping finisher): the star leaves the hand, spins out along the
                    aim (380; the finisher 440), slows at the far end or turns at a wall, and flies back into the hand. It
                    hits every monster on its way out and again on its way back. While it is out the hand is empty, so
                    the next throw waits for the catch
     skills         the star skills (js/ninjastars.js) throw the held huuma too (the hand stays empty until it is
                    back) and its shadow copies; คุไนระเบิด flicks the kunai with the other hand
     reach          the huuma's reach is its flight (380): the item card shows it and the auto farm throws from there
   The star kit (NC.THROW): one flying huuma, real (the picture in the hand) or a เงาดาว (its shadow copy: violet,
   see-through, gone in a puff), the boomerang flight, the ricochet's next target; js/ninjastars.js's skills fly it.
     ดาวคู่ (sh_throwing)  a throw may bring a shadow twin on a curve that crosses the real star (Lv 5: it bounces once)
     class 3              จ้าวเงาร้อยร่าง's shadow copies throw shadow stars (its signature and ดาวยักษ์พายุเงา's shards)
   Hooks: NC.throwWeapon (entities.js weaponHit calls it for style 'throw'), NC.Anim clips + COMBO.throw,
   NC.updatePlayer (no new throw while the star is out), NC.updateHeroAnim (the empty hand), NC.SKILL_RUN sh_kunai (the
   pose); js/net.js calls NC.throwLook / NC.throwHide for the other players online. Tuning: NC.THROW; balance with
   tools/balance.js (README: ดาวยักษ์ของนินจาปาจริง, สายดาวกระจายของนินจา). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, TAU = Math.PI * 2;
  const isStar = (W) => !!(W && W.wtype === 'huuma');
  const heldStar = (p) => { const W = p && p.equip && NC.ITEMS[p.equip.weapon]; return isStar(W) ? W : null; };
  // range: how far it flies (the finisher further); tOut / tBack: seconds out and back at attack speed 1;
  // kOut / kBack: the swing's damage for a hit on the way out / back; rad: its hit radius
  const T = (NC.THROW = { range: 380, finRange: 440, tOut: 0.28, tBack: 0.24, kOut: 0.85, kBack: 0.6, rad: 40 });

  // ---------------- every huuma is thrown ----------------
  // (no W.range: that marks a bow or a staff, and the balance harness would stand it off like one)
  for (const id in NC.ITEMS) {
    const it = NC.ITEMS[id];
    if (it && it.slot === 'weapon' && isStar(it)) Object.assign(it, { style: 'throw', reach: T.range });
  }
  if (NC.ITEMS.huuma) NC.ITEMS.huuma.desc = 'ดาวกระจายยักษ์สี่แฉก ปาไกล 380 แล้ววนกลับเข้ามือ โดนทั้งขาไปและขากลับ';

  // ---------------- the throwing poses ----------------
  // (angles: 0 = forward, + = down, - = up, in the rig's frame; AS / AW as in anim.js: a strike follows the aim, a
  // wind-up or follow-through only part of it, both kept in front of the body)
  const FRONT_UP = -Math.PI / 2 - 0.35, BACK_UP = -Math.PI - 0.1, DOWN = Math.PI / 2 + 0.25;
  const keep = (v, lo, hi, n) => NC.clamp(v, Math.min(lo, n), Math.max(hi, n));
  const AS = (n) => (c) => keep(c.al + n, FRONT_UP, DOWN, n);
  const AW = (n) => (c) => keep(n + (c.al < 0 ? 0.3 : 0.45) * c.al, BACK_UP, DOWN, n);
  const RB = (n) => (c) => c.rB + n; // the far arm, from hanging down
  // the throwing arm at the release: an up-aim hardly raises it (the fist would cover the face; the star still flies
  // along the aim)
  const AU = (n) => (c) => n + (c.al < 0 ? 0.2 * c.al : c.al);
  // the far leg steps forward into the throw (a, b: the wind-up and release keys, e: the end)
  const stepIn = (a, b, e) => ({
    legB: [[a, 0.3], [b, 0.5, 'out'], [e, 0.42]], kB: [[a, 0.5], [b, 0.62], [e, 0.55]],
    legF: [[a, -0.3], [b, -0.45, 'out'], [e, -0.38]], kF: [[a, 0.55], [b, 0.3], [e, 0.35]],
  });
  const HOLD = { tuck: [[0.03, 0]], ik: [[0.03, 0]], wPush: [[0.05, 0]] }; // one hand, the star in it
  // (a chibi's arm pointing level puts the fist at the chin: releases and follow-throughs stay a little below level,
  // and the arm is drawn behind the head (aBack) until it is past it)
  NC.Anim.addClip('throwStar1', { // overhand: the star cocked high behind the head, the other arm pointing at the target
    dur: 0.34, out: 0.12, cancel: 0.2, ev: [[0.125, 'hit']], lunge: [[0.1, 0], [0.16, 10]],
    phases: [[0, 0.1, 'a'], [0.1, 0.15, 's'], [0.15, 0.24, 'f'], [0.24, 0.34, 'r']],
    keys: Object.assign({
      aF: [[0.1, AW(-2.05), 'snap'], [0.15, AU(0.45), 'out'], [0.24, AW(1.05), 'inout'], [0.34, AW(0.85)]],
      eF: [[0.1, 1.05, 'snap'], [0.15, 0.08, 'out'], [0.24, 0.2], [0.34, 0.3]],
      wAng: [[0.1, AW(-2.6), 'snap'], [0.15, AS(0.4), 'out'], [0.34, AW(1.0)]],
      aBack: [[0.1, 1, 'step'], [0.12, 0]],
      aB: [[0.1, AS(-0.1)], [0.15, RB(0.9), 'out'], [0.34, RB(0.6)]], eB: [[0.1, 0.25], [0.15, 1.0], [0.34, 0.6]],
      lean: [[0.1, -0.14, 'snap'], [0.15, 0.24, 'out'], [0.24, 0.28], [0.34, 0.14]],
      head: [[0.1, -0.08], [0.15, 0.06], [0.34, 0.04]],
    }, stepIn(0.1, 0.15, 0.34), HOLD),
  });
  NC.Anim.addClip('throwStar2', { // side-arm: low behind the hip, flung flat
    dur: 0.32, out: 0.12, cancel: 0.18, ev: [[0.105, 'hit']], lunge: [[0.08, 0], [0.14, 8]],
    phases: [[0, 0.08, 'a'], [0.08, 0.13, 's'], [0.13, 0.22, 'f'], [0.22, 0.32, 'r']],
    keys: Object.assign({
      aF: [[0.08, AW(2.2), 'snap'], [0.13, AU(0.3), 'out'], [0.22, AW(0.35), 'inout'], [0.32, AW(0.6)]],
      eF: [[0.08, 0.9, 'snap'], [0.13, 0.05, 'out'], [0.22, 0.15], [0.32, 0.35]],
      wAng: [[0.08, AW(2.6), 'snap'], [0.13, AS(0.1), 'out'], [0.32, AW(0.5)]],
      aB: [[0.08, AS(0.1)], [0.13, RB(0.8), 'out'], [0.32, RB(0.55)]], eB: [[0.08, 0.3], [0.13, 1.0], [0.32, 0.5]],
      lean: [[0.08, -0.08, 'snap'], [0.13, 0.22, 'out'], [0.22, 0.24], [0.32, 0.12]],
      head: [[0.08, -0.04], [0.13, 0.04], [0.32, 0.03]],
    }, stepIn(0.08, 0.13, 0.32), HOLD),
  });
  NC.Anim.addClip('throwStar3', { // the finisher: crouch, leap, throw hard from the top of the jump, land
    dur: 0.48, out: 0.14, cancel: 0.34, finisher: true, ev: [[0.215, 'hit']], lunge: [[0.12, 0], [0.24, 18]],
    phases: [[0, 0.19, 'a'], [0.19, 0.24, 's'], [0.24, 0.34, 'f'], [0.34, 0.48, 'r']],
    keys: Object.assign({
      y: [[0.08, 0], [0.2, -34, 'out'], [0.32, 0, 'in'], [0.48, 0]],
      sq: [[0.07, 0.92, 'out'], [0.14, 1.05], [0.3, 1.0], [0.34, 0.92, 'out'], [0.44, 1.0]],
      kB: [[0.07, 1.0], [0.14, 0.4], [0.22, 0.9], [0.32, 0.4], [0.35, 0.8, 'out'], [0.48, 0.55]],
      kF: [[0.07, 1.05], [0.14, 0.45], [0.22, 1.0], [0.32, 0.5], [0.35, 0.85, 'out'], [0.48, 0.35]],
      legB: [[0.07, 0.3], [0.22, 0.45], [0.34, 0.5], [0.48, 0.42]], legF: [[0.07, -0.3], [0.22, -0.15], [0.34, -0.45], [0.48, -0.38]],
      aF: [[0.19, AW(-2.3), 'snap'], [0.24, AU(0.75), 'out'], [0.34, AW(1.1), 'inout'], [0.48, AW(0.85)]],
      eF: [[0.19, 1.2, 'snap'], [0.24, 0.06, 'out'], [0.34, 0.2], [0.48, 0.3]],
      wAng: [[0.19, AW(-2.8), 'snap'], [0.24, AS(0.65), 'out'], [0.48, AW(1.0)]],
      aBack: [[0.19, 1, 'step'], [0.213, 0]],
      aB: [[0.19, AS(-0.2)], [0.24, RB(1.0), 'out'], [0.48, RB(0.6)]], eB: [[0.19, 0.2], [0.24, 1.1], [0.48, 0.6]],
      lean: [[0.19, -0.22, 'snap'], [0.24, 0.32, 'out'], [0.34, 0.34], [0.48, 0.14]],
      head: [[0.19, -0.12], [0.24, 0.08], [0.48, 0.04]],
    }, HOLD),
  });
  NC.Anim.addClip('throwKunai', { // the kunai: a flick of the other hand; the huuma drops to the near side, out of its way
    dur: 0.3, out: 0.12, lunge: [[0.04, 0], [0.1, 6]],
    phases: [[0, 0.05, 'a'], [0.05, 0.1, 's'], [0.1, 0.18, 'f'], [0.18, 0.3, 'r']],
    keys: Object.assign({
      aF: [[0.05, AW(1.35)], [0.3, AW(1.2)]], eF: [[0.05, 0.25], [0.3, 0.3]], wAng: [[0.05, AW(1.9)], [0.3, AW(1.7)]],
      aB: [[0.05, -2.3, 'snap'], [0.1, AS(0.2), 'out'], [0.18, AS(0.35)], [0.3, RB(0.55)]],
      eB: [[0.05, 1.4, 'snap'], [0.1, 0.05, 'out'], [0.3, 0.45]],
      lean: [[0.05, -0.1, 'snap'], [0.1, 0.2, 'out'], [0.3, 0.1]],
      head: [[0.05, -0.05], [0.1, 0.05], [0.3, 0.03]],
    }, stepIn(0.05, 0.1, 0.3), HOLD),
  });
  NC.Anim.SETS.basic.combo.throw = ['throwStar1', 'throwStar2', 'throwStar3']; // (every move set falls back to the basic combo)

  // ---------------- the star in flight ----------------
  const handOf = (p) => (p.pose && NC.weaponLine(p.equip, p.pose, p.x, p.y)) || null;
  const alive = (e) => e && !e.dead && e.hp > 0;
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = NC.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - ax - dx * u, py - ay - dy * u);
  };
  // where a star spins round: the hole in its middle (the ring the hand holds), else its balance point; read once per
  // picture from its pixels (each of the 41 huumas is drawn differently)
  const PIV = {};
  function pivotOf(s) {
    if (PIV[s.name]) return PIV[s.name];
    let r = [0.5, 0.5];
    if (s.ready === false) return r; // (its picture still streaming in, js/assets.js: read it once it is there)
    try {
      const k = 96 / Math.max(s.img.width, s.img.height), cw = Math.max(8, Math.round(s.img.width * k)), ch = Math.max(8, Math.round(s.img.height * k));
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const g = c.getContext('2d');
      g.drawImage(s.img, 0, 0, cw, ch);
      const a = g.getImageData(0, 0, cw, ch).data, N = cw * ch, clear = (i) => a[i * 4 + 3] <= 40;
      let sx = 0, sy = 0, sn = 0;
      for (let i = 0; i < N; i++) if (a[i * 4 + 3] > 60) { sx += i % cw; sy += (i / cw) | 0; sn++; }
      if (sn) r = [(sx / sn + 0.5) / cw, (sy / sn + 0.5) / ch];
      const x0 = Math.round(sx / (sn || 1)), y0 = Math.round(sy / (sn || 1)), seen = new Uint8Array(N);
      let hole = null;
      for (let d = 0; d <= 10 && !hole; d++)
        for (let dy = -d; dy <= d && !hole; dy++)
          for (let dx = -d; dx <= d && !hole; dx++) {
            const x = x0 + dx, y = y0 + dy, i0 = y * cw + x;
            if (x < 1 || y < 1 || x >= cw - 1 || y >= ch - 1 || seen[i0] || !clear(i0)) continue;
            // flood the clear patch: a hole doesn't reach the picture's edge
            const st = [i0];
            let hx = 0, hy = 0, hn = 0, open = false;
            seen[i0] = 1;
            while (st.length) {
              const i = st.pop(), px = i % cw, py = (i / cw) | 0;
              hx += px; hy += py; hn++;
              if (px === 0 || py === 0 || px === cw - 1 || py === ch - 1) open = true;
              for (const j of [px > 0 ? i - 1 : -1, px < cw - 1 ? i + 1 : -1, i - cw, i + cw]) if (j >= 0 && j < N && !seen[j] && clear(j)) { seen[j] = 1; st.push(j); }
            }
            if (!open && hn >= 3 && hn < N * 0.06) hole = [(hx / hn + 0.5) / cw, (hy / hn + 0.5) / ch];
          }
      if (hole) r = hole;
    } catch (err) { /* (a picture that can't be read: its middle) */ }
    return (PIV[s.name] = r);
  }
  NC.THROW.pivotOf = pivotOf;
  // one huuma picture spinning round its axle; k: its size (the one in the hand is drawn at 0.95 * the rig's 0.87)
  const HELD_K = 0.95 * 0.87;
  function drawHuuma(ctx, s, x, y, rot, k, face, img) {
    const [px, py] = pivotOf(s), w = s.w * k, h = s.h * k;
    ctx.save(); ctx.translate(x, y); if (face < 0) ctx.scale(-1, 1); ctx.rotate(rot);
    ctx.drawImage(img || s.img, -px * w, -py * h, w, h);
    ctx.restore();
  }
  // a เงาดาว: the same picture, see-through and dark violet (only the star in the hand is real; every extra one is its
  // shadow)
  const SHADE = '#8a63e0', SHADE_RGB = '178,140,255';
  function drawShadow(ctx, s, x, y, rot, k, face, a) {
    V.glow(ctx, x, y, s.w * k * 0.55, SHADE_RGB, 0.35 * a, true);
    const g = ctx.globalAlpha;
    ctx.globalAlpha = g * a * 0.35; drawHuuma(ctx, s, x, y, rot, k, face);
    ctx.globalAlpha = g * a * 0.5; drawHuuma(ctx, s, x, y, rot, k, face, NC.tinted(s.name, SHADE));
    ctx.globalAlpha = g;
  }
  FX.def('throwstar', (ctx, q) => {
    const s = NC.SPR[q.sprite];
    if (!s || !s.img) return;
    const k = HELD_K * (q.k || 1), a = q.fade === undefined ? 1 : q.fade;
    if (q.glow) V.glow(ctx, q.x, q.y, 46 * (q.k || 1), q.glow, 0.42 * a, true);
    if (!q.shadow) { // its shadow on the ground
      ctx.save(); ctx.globalAlpha *= 0.26 * a; ctx.fillStyle = '#0c0818';
      ctx.beginPath(); ctx.ellipse(q.x, q.y + 80, s.w * k * 0.34, s.w * k * 0.1, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    // two fading copies behind it (the blur of the spin), then the star
    const one = (x, y, rot, al) => {
      if (q.shadow) return drawShadow(ctx, s, x, y, rot, k, q.face, al);
      const g = ctx.globalAlpha; ctx.globalAlpha = g * al; drawHuuma(ctx, s, x, y, rot, k, q.face); ctx.globalAlpha = g;
    };
    one(q.x - q.mx * 2, q.y - q.my * 2, q.rot - 0.9, 0.14 * a);
    one(q.x - q.mx, q.y - q.my, q.rot - 0.45, 0.3 * a);
    one(q.x, q.y, q.rot, a);
  }, 'high');
  const poof = (x, y) => FX.puff(x, y, 3, { speed: 70, size: 0.42, color: '120,96,170', lifeK: 0.6 });

  // ---------------- the star kit ----------------
  // NC.THROW.star(game, o): one flying huuma. o: sprite, face, shadow, k (size; 1 = as in the hand), x, y, rot, spin
  // (rad/s), rgb (its streaks), glow (rgb), layer, world, life (a safety cap), move(q, dt) -> true when it is done (it
  // moves q.x / q.y), hit(q, px, py) after each move (the stretch it flew), gone() (drop it now), end(q)
  const star = (NC.THROW.star = function (game, o) {
    const rgb = o.shadow ? SHADE_RGB : o.rgb || '220,225,240';
    return FX.add({
      type: 'throwstar', layer: o.layer || 'high', x: o.x, y: o.y, life: o.life || 4, rot: o.rot || 0, mx: 0, my: 0,
      sprite: o.sprite, face: o.face || 1, shadow: !!o.shadow, k: o.k || 1, glow: o.glow, born: game.time, fade: 1,
      update(q, dt) {
        if ((o.world && game.world !== o.world) || (o.gone && o.gone())) { q.dead = true; return; }
        const px = q.x, py = q.y, done = o.move(q, dt);
        q.mx = q.x - px; q.my = q.y - py;
        q.rot += dt * (o.spin || 22);
        if (o.hit) o.hit(q, px, py);
        if (q.shadow && q.life - q.t < 0.15) q.fade = Math.max(0, (q.life - q.t) / 0.15);
        if (Math.random() < 0.55) FX.add({ type: 'vstreak', x: q.x, y: q.y, vx: 0, vy: 0, len: 34, w: q.shadow ? 3 : 4, rgb, life: 0.16 });
        if (done) { q.dead = true; if (q.shadow) poof(q.x, q.y); }
      },
      onEnd: o.end,
    });
  });
  // the monsters within rad of the stretch it flew (px, py) -> (q.x, q.y), each once per set
  const sweep = (NC.THROW.sweep = (game, q, px, py, rad, set, fn) => {
    for (const e of game.enemies) {
      if (!alive(e) || set.has(e) || segDist(e.x, e.y - 45, px, py, q.x, q.y) >= rad + (e.r || 24)) continue;
      set.add(e);
      fn(e);
    }
  });
  // the ricochet's next monster: the nearest one within R it hasn't hit
  const next = (NC.THROW.next = (game, x, y, R, skip) => {
    let best = null, bd = R;
    for (const e of game.enemies) {
      if (!alive(e) || (skip && skip.has(e))) continue;
      const d = NC.dist(x, y, e.x, e.y - 45);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  });
  // q a step of v px/s towards (tx, ty): true once there
  const toward = (NC.THROW.toward = (q, tx, ty, v, dt, near) => {
    const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy), st = v * dt;
    if (d <= Math.max(near || 0, st)) { q.x = tx; q.y = ty; return true; }
    q.x += (dx / d) * st; q.y += (dy / d) * st;
    return false;
  });
  // where a thrower's star leaves from and how far it goes: just ahead of the fist (at the hand itself its first frame
  // would sit on the chibi's face), 380 from the hand (the finisher 440), at the angle it had in the hand
  function aimFrom(who, ang, fin) {
    const L = who.pose && NC.weaponLine(who.equip, who.pose, who.x, who.y), cx = Math.cos(ang), cy = Math.sin(ang);
    const h0 = L ? L.hand : [who.x + who.face * 30, who.y - 80];
    return { cx, cy, from: [h0[0] + cx * 34, h0[1] + cy * 34], R: (fin ? T.finRange : T.range) - 34,
      rot: L ? Math.atan2(who.face * (L.tip[0] - L.hand[0]), -(L.tip[1] - L.hand[1])) : 0 };
  }
  const handNow = (who) => () => { const L = handOf(who); return L ? L.hand : [who.x + who.face * 30, who.y - 80]; };
  // a boomerang's flight (a move for NC.THROW.star): out along (cx, cy) for R in tOut s, fast from the hand and slowing
  // to a hang at the far end (a wall turns it early); then o.hang s held there (o.during(q, dt) each frame of it); then
  // o.bounce: one ricochet to the nearest monster within bounce.R it hasn't hit (bounce.hit(e, q) there); then home on
  // o.hand() at vBack, picking up speed (o.hand null: it ends at the far end). q.back: on the way back (its hit set)
  const boomerang = (NC.THROW.boomerang = (game, o) => (q, dt) => {
    if (!q.ph) { q.ph = 'out'; q.u = 0; q.tb = 0; q.th = 0; }
    if (q.ph === 'out') {
      q.u = Math.min(1, q.u + dt / o.tOut);
      const d = o.R * (1 - (1 - q.u) * (1 - q.u));
      q.x = o.from[0] + o.cx * d; q.y = o.from[1] + o.cy * d;
      if (q.u < 1 && !(game.world.isSolid && NC.shotWall(game.world, q.x, q.y + 70))) return false;
      q.ph = o.hang ? 'hang' : 'turn';
    }
    if (q.ph === 'hang') {
      if ((q.th += dt) < o.hang) { if (o.during) o.during(q, dt); return false; }
      q.ph = 'turn';
    }
    if (q.ph === 'turn') {
      const e = o.bounce && next(game, q.x, q.y, o.bounce.R, o.bounce.skip);
      q.ph = e ? 'bounce' : 'back'; q.tgt = e; q.back = true;
      if (!o.hand) return true;
    }
    if (q.ph === 'bounce') {
      if (alive(q.tgt) && !toward(q, q.tgt.x, q.tgt.y - 45, o.vBack, dt, 12)) return false;
      if (alive(q.tgt)) o.bounce.hit(q.tgt, q);
      q.ph = 'back';
      if (!o.hand) return true;
    }
    q.tb += dt;
    const [hx, hy] = o.hand(), v = o.vBack * (0.3 + 0.7 * Math.min(1, q.tb / 0.1));
    if (!toward(q, hx, hy, v, dt, 30)) return false;
    if (o.caught) o.caught(hx, hy);
    return true;
  });
  const catchAt = (rgb) => (hx, hy) => FX.stars(hx, hy, 4, rgb, { speed: 110, size: 0.55 });
  Object.assign(NC.THROW, { drawHuuma, drawShadow, HELD_K, SHADE_RGB, aimFrom, handNow, catchAt, isStar, heldStar });

  const starOut = (game, p) => {
    const q = p && p._star;
    if (!q) return false;
    if (q.dead || FX.list.indexOf(q) < 0 || game.time - q.born > 3) { p._star = null; return false; }
    return true;
  };
  // (a skill threw the real star: p._sstar, js/ninjastars.js)
  const skillStarOut = (p) => { const q = p && p._sstar; if (q && !q.dead && FX.list.indexOf(q) >= 0) return true; if (p) p._sstar = null; return false; };
  // (entities.js weaponHit: dmg(e, k) rolls the swing's own damage, opts are its hit options, M the combo step's numbers)
  NC.throwWeapon = function (game, p, W, step, clip, dmg, opts, M) {
    if (starOut(game, p)) return; // (still out: the same star can't be thrown twice)
    const fin = step === 2, spd = Math.max(0.5, NC.atkSpeed(p, W)), A = aimFrom(p, p.atk.ang, fin);
    const rad = T.rad * (fin ? 1.25 : 1), kb = (W.kb || 200) * M.kb * 0.6, rgb = W.trailRgb || '220,225,240';
    const hitOut = new Set(), hitBack = new Set();
    const q = star(game, {
      sprite: W.sprite, face: p.face, x: A.from[0], y: A.from[1], rot: A.rot, rgb, world: game.world, spin: 22 * (0.6 + 0.4 * spd),
      move: boomerang(game, { from: A.from, cx: A.cx, cy: A.cy, R: A.R, tOut: T.tOut / spd, vBack: A.R / (T.tBack / spd), hand: handNow(p), caught: catchAt(rgb) }),
      hit(q, px, py) { // each monster once on the way out, once on the way back
        let first = true;
        sweep(game, q, px, py, rad, q.back ? hitBack : hitOut, (e) => {
          const r = dmg(e, q.back ? T.kBack : T.kOut), m = Math.hypot(q.mx, q.my) || 1, back = q.back ? 0.4 : 1;
          NC.damageEnemy(game, e, r, (q.mx / m) * kb * back, (q.my / m) * kb * 0.7 * back, opts);
          FX.sparks(q.x, q.y, 5, rgb);
          if (first) { game.hitstop = Math.max(game.hitstop || 0, fin ? 0.05 : 0.03); first = false; }
        });
      },
      gone: () => p.dead > 0,
      end: (q) => { if (p._star === q) p._star = null; },
    });
    p._star = q;
    if (fin) game.shake = Math.max(game.shake || 0, 5);
    twin(game, p, W, A, fin, spd);
  };

  // ---------------- ดาวคู่ (sh_throwing): a shadow twin with the throw ----------------
  // lv x 5% of the throws (Lv 10: the jumping finisher always) bring a shadow star on a loop round the real one: out on
  // a curve to one side, crossing the real star's line short of its end, back on a curve on the other side into the hand
  // (a second crossing). It hits what it passes each way (the skill's own multiplier); Lv 5: at the far end it bounces
  // into the nearest monster it hasn't hit before it comes back
  let twinSide = 1;
  function twin(game, p, W, A, fin, spd) {
    const lv = NC.skillLv(p, 'sh_throwing');
    if (!(lv > 0) || (NC.weaponOk && !NC.weaponOk(p, 'sh_throwing'))) return;
    if (!((fin && lv >= 10) || Math.random() * 100 < lv * 5)) return;
    twinSide = -twinSide;
    const nx = -A.cy * twinSide, ny = A.cx * twinSide, b = 105 * (A.R / 346), tOut = (T.tOut / spd) * 1.05, tBack = (T.tBack / spd) * 1.1;
    const ctl = [A.from[0] + A.cx * A.R * 0.45 + nx * b * 2, A.from[1] + A.cy * A.R * 0.45 + ny * b * 2];
    const end = [A.from[0] + A.cx * A.R - nx * b * 0.7, A.from[1] + A.cy * A.R - ny * b * 0.7];
    const bez = (P0, C, P2, u) => { const a = 1 - u; return [a * a * P0[0] + 2 * a * u * C[0] + u * u * P2[0], a * a * P0[1] + 2 * a * u * C[1] + u * u * P2[1]]; };
    const out = new Set(), back = new Set(), hand = handNow(p);
    const hitIt = (e, q) => { K.hit(game, p, 'sh_throwing', e, (q.mx || 0) * 5, (q.my || 0) * 4, SHADE_RGB); FX.sparks(q.x, q.y, 4, SHADE_RGB); };
    star(game, {
      sprite: W.sprite, face: p.face, shadow: true, x: A.from[0], y: A.from[1], rot: A.rot + 0.7, world: game.world, life: 3, spin: 24,
      move(q, dt) {
        if (!q.ph) { q.ph = 'out'; q.u = 0; }
        if (q.ph === 'out') {
          q.u = Math.min(1, q.u + dt / tOut);
          [q.x, q.y] = bez(A.from, ctl, end, 1 - (1 - q.u) * (1 - q.u));
          if (q.u < 1) return false;
          q.tgt = lv >= 5 && next(game, q.x, q.y, 320, out);
          q.ph = q.tgt ? 'bounce' : 'turn';
        }
        if (q.ph === 'bounce') {
          if (alive(q.tgt) && !toward(q, q.tgt.x, q.tgt.y - 45, 1500 * spd, dt, 12)) return false;
          if (alive(q.tgt) && !out.has(q.tgt)) { out.add(q.tgt); hitIt(q.tgt, q); }
          q.ph = 'turn';
        }
        if (q.ph === 'turn') { q.ph = 'back'; q.u = 0; q.b0 = [q.x, q.y]; }
        // back on the other side: a curve from where it turned into the hand (wherever the hand is now)
        q.u = Math.min(1, q.u + dt / tBack);
        const h = hand(), mid = [(q.b0[0] + h[0]) / 2 - nx * b * 1.6, (q.b0[1] + h[1]) / 2 - ny * b * 1.6];
        [q.x, q.y] = bez(q.b0, mid, h, q.u * q.u);
        return q.u >= 1;
      },
      hit(q, px, py) { if (q.ph === 'out' || q.ph === 'back') sweep(game, q, px, py, 36, q.ph === 'back' ? back : out, (e) => hitIt(e, q)); },
      gone: () => p.dead > 0,
    });
  }

  // online: another player's throw as everyone else sees it (js/net.js plays their clips here and passes their 'hit'
  // on): the star flies out and back into their hand, and hurts nothing (their monsters are theirs)
  NC.throwLook = function (r, W) {
    const game = NC.game;
    if (r._star && !r._star.dead && FX.list.indexOf(r._star) >= 0) return;
    const fin = !!(r.anim && r.anim.act === 'throwStar3'), spd = r.acSpeed || 1, A = aimFrom(r, r.aim || 0, fin), rgb = W.trailRgb || '220,225,240';
    r._star = star(game, {
      sprite: W.sprite, face: r.face, x: A.from[0], y: A.from[1], rot: A.rot, rgb, world: game.world, spin: 22 * (0.6 + 0.4 * spd),
      move: boomerang(game, { from: A.from, cx: A.cx, cy: A.cy, R: A.R, tOut: T.tOut / spd, vBack: A.R / (T.tBack / spd), hand: handNow(r), caught: catchAt(rgb) }),
      gone: () => !r.pose, end: (q) => { if (r._star === q) r._star = null; },
    });
  };
  // (net.js, after it posed another player: the hand is empty while their star is out)
  NC.throwHide = function (r, P) {
    const q = r._star;
    if ((q && !q.dead && FX.list.indexOf(q) >= 0) || skillStarOut(r) || (r._skillStarUntil || 0) > NC.game.time) P.wHide = 1;
  };

  // ---------------- no second throw while it is out; the hand is empty meanwhile ----------------
  // (a skill's real star counts too: p._sstar, and p._skillStarUntil)
  const handEmpty = (game, p) => starOut(game, p) || skillStarOut(p) || (p._skillStarUntil || 0) > game.time;
  NC.THROW.handFree = (game, p) => !!p && !handEmpty(game, p);
  // (a press while it is out is kept for 0.8 s and thrown the moment the star is caught: tapping never feels dropped)
  const baseUP = NC.updatePlayer;
  NC.updatePlayer = function (game) {
    const p = game.player;
    if (!p || !heldStar(p)) return baseUP.apply(this, arguments);
    const I = game.input, M = game.mouse, at = I.attack, md = M.down;
    if (handEmpty(game, p)) {
      if (at || md) p._throwWant = game.time;
      I.attack = false; M.down = false; p.atk.queued = false;
      try { return baseUP.apply(this, arguments); } finally { I.attack = at; M.down = md; }
    }
    const want = p._throwWant && game.time - p._throwWant < 0.8 && !(p.skillLock > 0);
    p._throwWant = 0;
    if (!want || at) return baseUP.apply(this, arguments);
    I.attack = true;
    try { return baseUP.apply(this, arguments); } finally { I.attack = at; }
  };
  const baseAnim = NC.updateHeroAnim;
  NC.updateHeroAnim = function (game) {
    const r = baseAnim.apply(this, arguments), p = game.player;
    if (p && p.pose && heldStar(p) && handEmpty(game, p)) p.pose.wHide = 1;
    return r;
  };

  // ---------------- the kunai: a flick of the other hand ----------------
  if (RUN && RUN.sh_kunai) {
    const base = RUN.sh_kunai;
    RUN.sh_kunai = function (game, p) {
      const r = base.apply(this, arguments);
      if (p && p.kind === 'player' && p.anim && !p.noPose && NC.Anim.CLIPS.throwKunai) { NC.Anim.play(p.anim, 'throwKunai'); p.anim.actT = 0.02; }
      return r;
    };
  }
  // the weapon rules of the star line (weapons.js: n = needs it): every star skill throws the huuma
  if (NC.weaponRule) for (const id of ['sh_throwing', 'sh_fan', 'sh_ricochet']) NC.weaponRule(id, 'n:huuma');

  // ---------------- class 3 จ้าวเงาร้อยร่าง: the shadow copies throw shadow stars ----------------
  const C3 = NC.C3, SL = C3 && C3.jobs && C3.jobs.shadowlord;
  if (SL) {
    const VIO = '190,140,255', copies = (p) => (NC.skillLv(p, 'sl_legion') >= 5 ? 2 : 1) + (C3.awake(p) ? 2 : 0);
    // where copy k stands (as its drawBack draws it): a step to either side of the hero; its hand
    const copyHand = (p, k) => {
      const side = k % 2 ? 1 : -1, f = p.face || 1;
      return [p.x + side * (50 + Math.floor(k / 2) * 40) * f + f * 26, p.y - 6 - Math.floor(k / 2) * 6 - 86];
    };
    NC.THROW.copyHand = copyHand; NC.THROW.copies = copies;
    // the signature: a skill's hit is repeated by one copy (a share of it, class3_skills_b.js): it throws a shadow star
    SL.sig.hooks.hit = function (game, p, e, r, o, lv) {
      if (!o.skill || (e._slT || 0) > game.time) return;
      e._slT = game.time + 0.18;
      const st = C3.state(p);
      (st.mul || (st.mul = {})).sl_legion = (o.mul || 1) * (0.15 + lv * 0.015) * (C3.awake(p) ? 1.3 : 1);
      const n = copies(p), k = (p._slI = ((p._slI || 0) + 1) % n), W = heldStar(p) || NC.ITEMS.huuma;
      V.at(0.1, () => {
        if (!alive(e)) return;
        const [hx, hy] = copyHand(p, k);
        star(game, {
          sprite: W.sprite, face: p.face, shadow: true, x: hx, y: hy, world: game.world, life: 1, spin: 26, k: 0.8,
          move(q, dt) {
            if (!alive(e)) return true;
            if (!toward(q, e.x, e.y - 45, 1700, dt, 14)) return false;
            K.hit(game, p, 'sl_legion', e, 0, 0, VIO);
            FX.sparks(q.x, q.y, 5, VIO);
            return true;
          },
        });
      });
    };
    // ดาวยักษ์พายุเงา (the power-up of ขว้างดาวยักษ์วกกลับ): its shards are small shadow stars (class3_core.js FXK.shards draws o.look)
    const E = SL.enh.find((x) => x.id === 'sl_huuma');
    if (E) E.look = (ctx, q) => {
      const W = heldStar(NC.game && NC.game.player) || NC.ITEMS.huuma, s = NC.SPR[W.sprite];
      if (s && s.img) drawShadow(ctx, s, q.x, q.y, q.t * 24, HELD_K * 0.42, 1, 1);
    };
  }
})();
