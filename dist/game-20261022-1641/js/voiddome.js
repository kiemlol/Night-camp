/* voiddome.js — a void dome round the hero on the WebGL effects layer (js/glfx.js). 2026-10-05/06, after a Unity
   reference clip: "ทำให้ดูหน่อย", then "แต่งให้สวยขึ้น" → "ลองเลย", then the
   last list ("ทำทั้งหมดเลยลองดู ถ้าไม่ชอบก็ปรับกลับ"). What it does now:
     intro    three ribbons spiral up, the dome rises out of the ground (a dissolve with a bright front), a rune circle lights
              under it, a hum starts; it closes with a pop (overshoot), a ring running out on the ground, a flash, sparks
     looks    a glass hemisphere seen by the game's camera: the world behind bends toward its rim (GL.refract), clear in the
              middle so the hero stays readable, indigo inside, magenta Fresnel rim thicker on the lit side, a hot highlight up
              left, streaks flowing round it (showing through behind), a halo round the rim (bloom), smoke streams swirling
              round its foot, sparks orbiting it with short tails, the rune circle turning under it
     shield   absorbs damage (o.absorb): each blow ripples out from where it lands with sparks, the dome wobbles, the soaked
              amount floats up; a spider web of cracks grows where each blow lands (a bigger share, a bigger web); at 0
              it BREAKS FROM THE LAST BLOW (the user picked this, 2026-10-06): a star on the point, a web over the dome,
              then a hole opening from the point that eats the dome to the far side, glass shards torn off its edge and
              thrown on along the blow (behind the hero once they pass his row). VD.cracks = 'cells': the earlier look.
              VD.breakStyle picks other ways to break (js/voidbreaks.js): plates, melt, stardust, freeze, backlash, void
     wall     monsters that walk into it bounce off (a ripple where they touch); monster shots stop on it
     end      o.ending 'burst' (default): it pulls in, then bursts — a ring of force throws the monsters round it back;
              'sink': it sinks into the ground from the top
     sound    js/sfx.js patches: rise, pop, hum, hit, crack, shatter, implode, burst, push
   NC.VoidDomeFX.add(game, p, { hold, R, absorb, push, block, ending, runes, onBurst }) → q (q.end(), q.shatter())
   Test: ?voiddome (on the hero, 4 s, absorbs half the hero's HP). Pieces can be switched off: VD.refract / runes / orbit; VD.cracks 'web' | 'cells'.
   The version before this list: tools/backup/voiddome_v2.js (copy it over this file to go back). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, GL = NC.GLFX;
  if (!FX || !V || !GL) return;
  const VD = (NC.VoidDomeFX = { on: true, R: 180, refract: true, runes: true, orbit: true, cracks: 'web', breakStyle: 'hit' });
  // breakStyle (with cracks 'web'): how it goes when its HP runs out — 'hit' breaks from the last blow (here); the others
  // live in js/voidbreaks.js (VD.BREAKS): plates, melt, stardust, freeze, backlash, void
  // cracks: 'web' = a spider web round each blow it soaks and the break opening from the last blow; 'cells' = the earlier
  // look (cracks spread over the whole front at random, the dome bursts into thorns all at once)
  const rand = NC.rand, TAU = Math.PI * 2, C = GL.curve, P = GL.PAL, S = GL.SH;
  const CP = 0.866, SP = 0.5;        // the camera the dome shader assumes (30° down)
  const VIO = '190,90,255';
  const sfx = (n, o) => NC.SFX && NC.SFX.play(n, o);
  VD.ready = () => GL.ok();
  // a point on / round the dome (X across, Y up, Z toward the camera, in radii) → the screen
  const proj = (cx, cy, R, X, Y, Z) => [cx + X * R, cy - (Y * CP - Z * SP) * R];
  const INTRO = 0.95, OUTRO = 0.6, RISE = 1.35, PULL = 0.28, BREAK = 0.5, HOLE0 = 0.05;

  FX.def('vd_main', (ctx, q) => q.paint(ctx, 'glow'), 'glow');
  FX.def('vd_main_low', (ctx, b) => { if (b.main.dead || !FX.list.includes(b.main)) { b.dead = true; return; } b.main.paint(ctx, 'low'); }, 'low');
  FX.def('vd_ribbon', (ctx, q) => q.paint(), 'glow');
  FX.def('vd_lowpiece', (ctx, q) => q.paint(), 'low');

  // sparks flung off a point (additive streaks)
  const sparks = (x, y, n, ang, spread, o) => {
    const sp = GL.parts({ draw: (s, u) => { const a = Math.atan2(s.vy, s.vx), len = 5 + Math.hypot(s.vx, s.vy) * 0.03; GL.quad('glow', s.x, s.y, len, ((o && o.w) || 2.2) * (1 - u * 0.5), a, { shape: S.spark, pal: P.void, add: true, extra: 0.15, a: 1 - u }); } });
    for (let i = 0; i < n; i++) { const a = ang === undefined ? rand(0, TAU) : ang + rand(-spread, spread), v = rand((o && o.min) || 260, (o && o.max) || 620); sp.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 4, grav: (o && o.grav) || 300, life: rand(0.25, 0.5) }); }
  };

  VD.add = function (game, p, o) {
    o = o || {};
    if (!VD.ready()) return null;
    if (p.voidDome && !p.voidDome.dead) p.voidDome.end(true);
    const R = o.R || VD.R, hold = o.hold === undefined ? 3 : o.hold, sd = rand(0, 40);
    const ending = o.ending || 'burst';
    let hum = null;
    const q = FX.add({
      type: 'vd_main', x: p.x, y: p.y, life: 9999, endT: INTRO + hold, hitT: -9, ripples: [], webs: [], lastHit: null,
      hp0: o.absorb || 0, hp: o.absorb || 0, crack: 0, broken: false, burstT: null, R0: R,
      end(now) { if (q.t < q.endT) q.endT = Math.max(now ? q.t : INTRO * 0.6, q.t); },
      shatter() { shatter(game, p, q); },
      // how high the dome stands (the sink ending), and its size (pop, wobble, the pull before the burst)
      rise() {
        if (q.t < INTRO) return RISE * C(q.t / INTRO, [[0, 0], [0.35, 0], [1, 1]]);
        if (q.t < q.endT || ending === 'burst') return RISE;
        return RISE * (1 - Math.min(1, (q.t - q.endT) / OUTRO)) - 0.1;
      },
      size() {
        const u = (q.t - INTRO * 0.82) / 0.32;
        const pop = u > 0 && u < 1 ? 0.075 * Math.sin(Math.PI * u) * (1 - u * 0.35) - (u > 0.7 ? 0.02 * Math.sin(Math.PI * (u - 0.7) / 0.3) : 0) : 0;
        const w = Math.max(0, 1 - (q.t - q.hitT) / 0.45), wob = 0.028 * Math.sin((q.t - q.hitT) * 34) * w * w;
        const pull = ending === 'burst' && q.t > q.endT ? 1 - 0.82 * GL.ease(Math.min(1, (q.t - q.endT) / PULL)) : 1;
        return R * (1 + pop + wob) * pull;
      },
      // once broken, q.brk drives what is left of the dome (each break style sets it; t = seconds since the break):
      //   dur (painting stops after it), hole(t) → [x, y, z, r] a hole round a point (or null), front(t) / back(t) the
      //   halves' alpha, webs(t) the earlier crack webs, ground(t) the glow + runes, halo(t), boost(t), scale(t),
      //   update(t) each frame, life (q is dropped after it)
      paint(ctx, layer) {
        const B = q.broken ? q.brk : null, bt = B ? q.t - q.brokeT : 0;
        if (q.burstT !== null || (q.broken && (!B || bt > B.dur))) return;
        const x = p.x, y = p.y, er = q.rise(), Rn = q.size() * (B && B.scale ? B.scale(bt) : 1);
        if (er <= -0.05) return;
        const pulling = ending === 'burst' && q.t > q.endT ? Math.min(1, (q.t - q.endT) / PULL) : 0;
        const fade = B ? B.ground(bt) : 1, frontA = B ? B.front(bt) : 1, backA = B ? B.back(bt) : 1, websA = B ? B.webs(bt) : 1;
        const boost = Math.min(1, 0.6 * Math.max(0, 1 - (q.t - q.hitT) / 0.3) + pulling * 0.9 + (B && B.boost ? B.boost(bt) : 0)), pulse = 0.08 * Math.sin(q.t * 5);
        const hole = B && B.hole ? B.hole(bt) : null;
        const webs = (lay, mode, k) => {
          for (const w of q.webs) {
            const age = q.t - w.t, main = w === q.web;
            const reach = w.r * GL.out(Math.min(1, age / (main ? 0.14 : 0.1)), 2) * (main ? 1 : 1 + 0.35 * q.crack);
            const a = (main ? 1 : websA) * k;
            if (reach > 0.01 && a > 0.01) GL.quad(lay, x, y, Rn, Rn, 0, { shape: S.dome, pal: P.void, extra: mode, erode: er, seed: w.sd, add: true, a, p2: [w.I[0], w.I[1], w.I[2], reach], edge: main && hole ? hole[3] : 0 });
          }
        };
        if (layer === 'low') {
          const gA = Math.min(1, er / 0.6) * 0.55 * fade;
          GL.quad('low', x, y, Rn * 1.45, Rn * 0.72, 0, { shape: S.glow, tint: [0.55, 0.12, 0.85], add: true, a: gA });
          if (VD.runes && o.runes !== false) GL.quad('low', x, y, R * 1.2, R * 1.2 * SP, 0, { shape: S.runes, pal: P.void, add: true, pan: 0.35, seed: sd, extra: 0.25 + boost * 0.4, a: Math.min(1, er / 0.9) * (1 - pulling) * fade });
          if (backA > 0.005) {
            GL.quad('low', x, y, Rn, Rn, 0, { shape: S.dome, pal: P.void, extra: 2, erode: er, edge: 0.07, pan: 0.9 + pulling * 3, seed: sd, add: true, p2: hole, a: backA });
            webs('low', 6, backA);
          }
          return;
        }
        if (frontA > 0.005) q.paintFront('glow', { Rn, er, boost, pulse, pulling, hole, a: frontA, webs });
        GL.quad('glow', x, y, Rn * 1.35, Rn * 1.35, 0, { shape: S.dome, pal: P.void, extra: 4 + boost * 0.39, erode: er, seed: sd, add: true, a: 0.9 * (B ? B.halo(bt) : 1) });
        for (let i = q.ripples.length - 1; i >= 0; i--) {
          const r = q.ripples[i], u = (q.t - r.t) / 0.6;
          if (u >= 1) { q.ripples.splice(i, 1); continue; }
          if (frontA > 0.005) GL.quad('glow', x, y, Rn, Rn, 0, { shape: S.dome, pal: P.void, extra: 3, erode: er, pan: u, ns: r.lon, edge: r.h, seed: sd, add: true, p2: hole, a: frontA });
        }
      },
      // the front glass (body + light + crack webs): on the glow layer, or into a bake (no refraction there)
      // (f.only: 'body' just the see-through glass, 'light' just the additive light + webs: a bake keeps them apart)
      paintFront(lay, f) {
        const x = p.x, y = p.y, Rn = f.Rn, er = f.er;
        const glass = lay !== 'bake' && VD.refract && GL.refract, cells = VD.cracks === 'cells';
        if (f.only !== 'light') GL.quad(lay, x, y, Rn, Rn, 0, { shape: S.dome, pal: P.void, extra: 0, erode: er, edge: 0.07, pan: 0.9, seed: sd, tint: glass ? [0, 1, 1] : [1, 1, 1], refract: glass, p2: f.hole, a: f.a });
        if (f.only === 'body') return;
        GL.quad(lay, x, y, Rn, Rn, 0, { shape: S.dome, pal: P.void, extra: 1 + Math.min(1, f.boost + Math.max(0, f.pulse)) * 0.39, erode: er, edge: 0.07, pan: 0.9 + f.pulling * 3, seed: sd, add: true, ns: cells && q.crack > 0.01 ? 10 + q.crack : 3, p2: f.hole, a: f.a });
        f.webs(lay, 5, f.a);
      },
      // the front glass as it looks now, baked (for styles that break it into pieces): { img (the see-through body, drawn
      // normally), light (the light and cracks, drawn 'lighter'), x0, y0, w, h, Rn }
      bakeFront(k) {
        const Rn = q.size(), x0 = p.x - Rn * 1.04, y0 = p.y - Rn * 1.04, w = Rn * 2.08, h = Rn * 1.62;
        const webs = (lay, mode, a) => {
          for (const w of q.webs) GL.quad(lay, p.x, p.y, Rn, Rn, 0, { shape: S.dome, pal: P.void, extra: mode, erode: RISE, seed: w.sd, add: true, a: a * 0.75, p2: [w.I[0], w.I[1], w.I[2], w.r * (w === q.web ? 1 : 1 + 0.35 * q.crack)] });
        };
        const f = { Rn, er: RISE, boost: 0.2, pulse: 0, pulling: 0, hole: null, a: 1, webs };
        const img = GL.bake(x0, y0, w, h, k || 2.5, () => q.paintFront('bake', Object.assign({}, f, { only: 'body' })));
        const light = img && GL.bake(x0, y0, w, h, k || 2.5, () => q.paintFront('bake', Object.assign({}, f, { only: 'light' })));
        return img && light && { img, light, x0, y0, w, h, Rn };
      },
      update() {
        if (q.broken) { const bt = q.t - q.brokeT; if (q.brk && q.brk.update) q.brk.update(bt); if (bt > ((q.brk && q.brk.life) || 1.4)) q.dead = true; return; }
        if (q.burstT !== null) { if (q.t > q.burstT + 1.2) q.dead = true; return; }
        if (p.dead > 0 || p.hp <= 0) q.end(true);
        if (q.t >= q.endT) q.stopHum();
        if (ending === 'burst') {
          if (q.t >= q.endT && !q.pulled) { q.pulled = true; sfx('domeImplode'); }
          if (q.t >= q.endT + PULL) burst(game, p, q, o);
        } else if (q.t > q.endT + OUTRO + 0.05) q.dead = true;
        // a wall: monsters bounce off it, their shots stop on it
        if (q.t > INTRO * 0.8 && q.t < q.endT) {
          const Rn = q.size();
          if (o.push !== false) for (const e of game.enemies) {
            if (!(e.hp > 0) || e.dummy) continue;
            const gx = (e.x - p.x) / Rn, gz = (e.y - p.y) / (Rn * SP), d = Math.hypot(gx, gz);
            if (d >= 1 || d < 1e-4) continue;
            const k = 1.04 / d;
            e.x = p.x + (e.x - p.x) * k; e.y = p.y + (e.y - p.y) * k;
            e.kbx = (e.kbx || 0) + (gx / d) * 240; e.kby = (e.kby || 0) + (gz / d) * 120;
            if (game.time - (e._vdPush || -9) > 0.45) { e._vdPush = game.time; ripple(p, q, Math.atan2(gx, gz) || 0.01, 0.12, 6); sfx('domePush'); }
          }
          if (o.block !== false) for (const e of game.enemies) {
            if (!e.shots) continue;
            for (const s of e.shots) {
              if (s.dead) continue;
              const gx = (s.x - p.x) / Rn, gz = (s.y - p.y) / (Rn * SP);
              if (gx * gx + gz * gz >= 1) continue;
              s.dead = true;
              ripple(p, q, Math.atan2(gx, gz) || 0.01, Math.min(0.6, (s.z || 40) / (Rn * CP)), 8);
              sfx('domeHit', { k: 0.6 });
            }
          }
        }
      },
    });
    q.stopHum = () => { if (hum) { hum.stop(); hum = null; } };
    FX.add({ type: 'vd_main_low', main: q, x: 0, y: 0, life: 9999 });
    p.voidDome = q;
    sfx('domeRise');

    // the intro: three ribbons spiralling up round the hero
    for (let i = 0; i < 3; i++) {
      const th0 = (i / 3) * TAU + rand(-0.3, 0.3), turns = rand(1.3, 1.7) * (i % 2 ? 1 : -1), d = i * 0.06;
      FX.add({ type: 'vd_ribbon', life: 0.85, x: 0, y: 0, paint() {
        const u = Math.max(0, (this.t - d) / (0.85 - d));
        if (u <= 0) return;
        const pts = [];
        for (let k = 13; k >= 0; k--) {
          const v = Math.max(0, u - k * 0.035), hgt = 0.95 * GL.ease(v), th = th0 + turns * TAU * v;
          const rho = 1.08 * Math.sqrt(Math.max(0.02, 1 - hgt * hgt)) + 0.06;
          const [sx, sy] = proj(p.x, p.y, R, Math.cos(th) * rho, hgt, Math.sin(th) * rho);
          pts.push({ x: sx, y: sy, w: (k === 0 ? 1 : 5 * (1 - k / 14)) * (R / 135) * (1 - u * 0.4) });
        }
        GL.strip('glow', pts, { shape: S.blade, pal: P.void, add: true, extra: -0.12, pan: 4, ns: 4, seed: sd + i, a: Math.min(1, (1 - u) * 3) * 0.9 });
      } });
    }
    // it closes: the pop, a ring on the ground, a flash, sparks, the hum starts
    V.at(INTRO * 0.82, () => {
      if (q.dead || q.broken) return;
      const x0 = p.x, y0 = p.y;
      FX.add({ type: 'vd_lowpiece', life: 0.45, x: 0, y: 0, paint() {
        const u = this.t / this.life, r = R * (1.02 + 0.9 * GL.out(u, 2.2));
        GL.quad('low', x0, y0, r, r * SP * 1.05, 0, { shape: S.ring, pal: P.void, erode: C(u, [[0, 0.1], [0.3, 0.3], [1, 1]]), ns: 3, seed: sd, add: true, extra: -0.3, a: 0.85 });
      } });
      V.flash('170,80,255', 0.12, 0.22);
      V.shake(game, 4);
      const sp = GL.parts({ draw: (s, u) => { const ang = Math.atan2(s.vy, s.vx), len = 6 + Math.hypot(s.vx, s.vy) * 0.03; GL.quad('glow', s.x, s.y, len, 2.4 * (1 - u * 0.5), ang, { shape: S.spark, pal: P.void, add: true, a: 1 - u }); } });
      for (let i = 0; i < 26; i++) { const th = rand(0, TAU), [sx, sy] = proj(x0, y0, R, Math.cos(th), 0.02, Math.sin(th)), v = rand(220, 520); sp.add({ x: sx, y: sy, vx: Math.cos(th) * v, vy: -Math.sin(th) * v * SP - rand(40, 140), drag: 3.5, life: rand(0.3, 0.6) }); }
      sfx('domePop');
      if (NC.SFX && q.t < q.endT) hum = NC.SFX.loop('domeHum');
    });

    const live = () => !q.dead && !q.broken && q.burstT === null && q.t < q.endT;
    q.systems = [];
    const keep = (ps) => { if (ps) q.systems.push(ps); return ps; };
    // a few faint puffs at the foot
    keep(GL.parts({ life: 9999, spawnFor: 9999,
      draw: (s, u) => {
        const r = (s.r0 + (s.r1 - s.r0) * GL.out(u, 2)) * (R / 135);
        GL.quad(s.back ? 'low' : 'glow', s.x, s.y, r, r * 0.7, s.rot, { shape: S.puff, pal: P.void, erode: C(u, [[0, 0.25], [0.3, 0.3], [1, 1.25]]), seed: s.sd, ns: 1.6, pan: 0.5, extra: -0.2, a: 0.32 * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5 + 0.2) });
      },
      tick(ps, dt) {
        if (q.dead && !ps.parts.length) { ps.dead = true; return; }
        if (!live() || q.t < INTRO * 0.45) return;
        for (let n = 0; n < 8 * dt; n++) {
          const th = rand(0, TAU), rho = rand(0.92, 1.12), [sx, sy] = proj(p.x, p.y, R, Math.cos(th) * rho, rand(0, 0.12), Math.sin(th) * rho);
          ps.add({ x: sx, y: sy, vx: Math.cos(th) * rand(20, 50) + rand(-10, 10), vy: -Math.sin(th) * rand(8, 20) - rand(15, 40), drag: 1.2, life: rand(0.6, 1.0),
            r0: rand(18, 26), r1: rand(48, 70), rot: rand(0, TAU), sd: rand(0, 60), back: Math.sin(th) < 0 });
        }
      } }));
    // sparkles rising inside
    keep(GL.parts({ life: 9999, spawnFor: 9999,
      draw: (s, u) => { const k = Math.sin(u * Math.PI) * (0.7 + 0.3 * Math.sin(s.t * 22 + s.ph)); GL.quad('glow', s.x, s.y, s.r * k, s.r * k, 0, { shape: S.twinkle, pal: P.void, add: true, a: k }); },
      tick(ps, dt) {
        if (q.dead && !ps.parts.length) { ps.dead = true; return; }
        if (!live() || q.t < INTRO * 0.7) return;
        for (let n = 0; n < 16 * dt; n++) {
          const th = rand(0, TAU), rho = Math.sqrt(Math.random()) * 0.8, [sx, sy] = proj(p.x, p.y, R, Math.cos(th) * rho, rand(0.05, 0.6), Math.sin(th) * rho);
          ps.add({ x: sx, y: sy, vx: rand(-8, 8), vy: rand(-45, -15), drag: 0.5, life: rand(0.6, 1.2), r: rand(3, 7), ph: rand(0, 9) });
        }
      } }));
    // smoke streams swirling round the foot
    keep(GL.parts({ life: 9999, spawnFor: 9999,
      draw: (s, u) => {
        const pts = [], th = s.th0 + s.w * s.t, dir = Math.sign(s.w), Rn = q.size();
        for (let k = 9; k >= 0; k--) {
          const a = th - dir * k * 0.075, rho = s.rho * (1 + 0.22 * u), hgt = s.h + u * 0.2 + k * 0.004;
          const [x, y] = proj(p.x, p.y, Rn, Math.cos(a) * rho, hgt, Math.sin(a) * rho);
          pts.push({ x, y, w: s.W * Math.sin(Math.PI * (0.1 + 0.85 * (1 - k / 9))) * Math.sin(Math.PI * Math.min(1, u * 1.25)) + 0.5 });
        }
        GL.strip(Math.sin(th) < -0.05 ? 'low' : 'glow', pts, { shape: S.blade, pal: P.void, extra: -0.2, erode: C(u, [[0, 0.12], [0.55, 0.22], [1, 0.95]]), pan: 1.6, ns: 2.4, seed: s.sd, a: 0.8 });
      },
      tick(ps, dt) {
        if (q.dead && !ps.parts.length) { ps.dead = true; return; }
        if (!live() || q.t < INTRO * 0.5) return;
        for (let n = 0; n < 15 * dt; n++)
          ps.add({ x: p.x, y: p.y, vx: 0, vy: 0, life: rand(0.8, 1.3), th0: rand(0, TAU), w: rand(1.6, 2.6) * (Math.random() < 0.75 ? 1 : -1),
            rho: rand(0.97, 1.1), h: rand(0, 0.06), W: rand(8, 14) * (R / 180), sd: rand(0, 60) });
      } }));
    // sparks orbiting it with short tails (behind it: under the hero)
    if (VD.orbit) keep(GL.parts({ life: 9999, spawnFor: 9999,
      draw: (s, u) => {
        const Rn = q.size(), a = Math.min(1, Math.sin(u * Math.PI) * 1.6), pts = [];
        let hz = 0, hx = 0, hy = 0;
        for (let k = 8; k >= 0; k--) {
          const tt = s.t - k * 0.028, th = s.th0 + s.w * tt, lat = s.lat + 0.22 * Math.sin(tt * s.wl + s.ph), cl = Math.cos(lat) * 1.03;
          const X = cl * Math.cos(th), Y = Math.sin(lat) * 1.03, Z = cl * Math.sin(th), [x, y] = proj(p.x, p.y, Rn, X, Y, Z);
          pts.push({ x, y, w: (k === 0 ? 0.6 : 2.6 * (1 - k / 9)) * (Rn / 180) });
          if (k === 0) { hz = Z; hx = x; hy = y; }
        }
        const layer = hz < 0 ? 'low' : 'glow';
        GL.strip(layer, pts, { shape: S.blade, pal: P.void, add: true, extra: 0.25, pan: 3, ns: 3, a: a * (hz < 0 ? 0.6 : 1) });
        GL.quad(layer, hx, hy, 7 * a, 7 * a, 0, { shape: S.twinkle, pal: P.void, add: true, a });
      },
      tick(ps, dt) {
        if (q.dead && !ps.parts.length) { ps.dead = true; return; }
        if (!live() || q.t < INTRO) return;
        if (Math.random() < dt * 4.5)
          ps.add({ x: p.x, y: p.y, vx: 0, vy: 0, life: rand(1.4, 2.2), th0: rand(0, TAU), w: rand(1.3, 2.1) * (Math.random() < 0.5 ? 1 : -1), lat: rand(0.18, 0.7), wl: rand(2, 4), ph: rand(0, 9) });
      } }));
    V.light(p.x, p.y - R * 0.4, R * 3, VIO, 0.85, INTRO + hold + OUTRO, { follow: p });
    V.flash('120,40,180', 0.08, 0.25);
    return q;
  };

  // a ripple on the dome at (lon, h), sparks off it
  function ripple(p, q, lon, h, nSparks) {
    if (q.ripples.length > 3) q.ripples.shift();
    q.ripples.push({ t: q.t, lon, h });
    const R = q.size(), cr = Math.sqrt(1 - h * h), [ix, iy] = proj(p.x, p.y, R, Math.sin(lon) * cr, h, Math.cos(lon) * cr);
    if (nSparks) sparks(ix, iy, nSparks, Math.atan2(-h, Math.sin(lon)), 0.9);
  }
  // where a blow lands: on the side facing the attacker (its row looked up from fromX), turned a little toward the camera
  // so its cracks show. I = that point on the unit dome (x across, y up, z toward the camera); blow = attacker to hero
  function hitPoint(game, p, q, fromX) {
    const R = q.size();
    let ax = fromX, ay = p.y;
    if (ax === undefined) ax = p.x + (Math.random() < 0.5 ? -1 : 1) * R * 2;
    else if (game) { let bd = 1e9; for (const e of game.enemies) if (e.hp > 0 && Math.abs(e.x - ax) < 2 && Math.abs(e.y - p.y) < bd) { bd = Math.abs(e.y - p.y); ay = e.y; } }
    let gx = (ax - p.x) / R, gz = (ay - p.y) / (R * SP);
    if (Math.hypot(gx, gz) < 1e-3) gx = 1;
    const n = Math.hypot(gx, gz), lon = Math.atan2(gx, gz) * 0.65 + rand(-0.15, 0.15), h = rand(0.22, 0.48), cr = Math.sqrt(1 - h * h);
    return { lon, h, I: [Math.sin(lon) * cr, h, Math.cos(lon) * cr], blow: [-gx / n, -gz / n] };
  }
  VD.hit = function (p, fromX, game) {
    const q = p && p.voidDome;
    if (!q || q.dead || q.broken || q.t < INTRO * 0.8) return;
    q.hitT = q.t;
    if (VD.cracks === 'web') {
      const hp = (q.lastHit = hitPoint(game || NC.game, p, q, fromX));
      ripple(p, q, hp.lon, hp.h, 14);
    } else {
      const side = fromX === undefined ? (Math.random() < 0.5 ? -1 : 1) : fromX < p.x ? -1 : 1;
      ripple(p, q, side * rand(0.85, 1.25), rand(0.25, 0.5), 14);
    }
    sfx('domeHit');
  };

  // what still floats round the dome fades out fast once it is gone
  function cut(q) { for (const ps of q.systems || []) for (const s of ps.parts) s.life = Math.min(s.life, s.t + 0.22 + Math.random() * 0.1); }
  // the shield breaks: the dome bursts into crystal shards
  function shatter(game, p, q) {
    if (q.broken) return;
    q.broken = true; q.brokeT = q.t; q.stopHum(); cut(q);
    if (VD.cracks === 'web') {
      FX.num(p.x, p.y - 170, 'โล่แตก!', { fill: '#e6b8ff', size: 34 });
      return (VD.BREAKS[VD.breakStyle] || VD.BREAKS.hit)(game, p, q);
    }
    const R = q.size();
    const sh = GL.parts({ draw: (s, u) => {
      GL.quad(s.back ? 'low' : 'glow', s.x, s.y, s.L * 0.5, s.w, s.rot || 0, { shape: S.thorn, pal: P.void, erode: C(u, [[0, 0], [0.45, 0], [1, 1]]), edge: 0.12, ns: 3, seed: s.sd, extra: 0.18 });
    } });
    for (let i = 0; i < 34; i++) {
      const th = rand(0, TAU), lat = Math.asin(rand(0.02, 0.95)), cl = Math.cos(lat), X = cl * Math.cos(th), Y = Math.sin(lat), Z = cl * Math.sin(th);
      const [x, y] = proj(p.x, p.y, R, X, Y, Z), v = rand(220, 520);
      sh.add({ x, y, vx: X * v, vy: -(Y * CP - Z * SP) * v - rand(80, 200), drag: 1.5, grav: 900, life: rand(0.6, 1.0), spin: rand(-14, 14), rot: rand(0, TAU),
        L: rand(18, 36) * (R / 180), w: rand(6, 11) * (R / 180), sd: rand(0, 40), back: Z < 0 });
    }
    sparks(p.x, p.y - R * 0.45, 30, undefined, 0, { min: 300, max: 800, w: 2.6 });
    V.flash('200,120,255', 0.28, 0.3);
    V.shake(game, 12);
    V.stop(game, 0.08);
    sfx('domeShatter');
    FX.num(p.x, p.y - 170, 'โล่แตก!', { fill: '#e6b8ff', size: 34 });
  }
  // ---- the break from the last blow: a star on the point, a web over the whole dome, then a hole opening from the point
  // that eats the dome to the far side, glass shards torn off its edge and thrown on along the blow ----
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
  const shardDraw = (lay) => (s, u) => {
    const f = Math.cos(s.ph + s.t * s.flip), glint = Math.pow(Math.max(0, f), 10);
    GL.quad(lay, s.x, s.y, s.L * (0.25 + 0.75 * Math.abs(f)), s.W, s.rot || 0, { shape: S.shard, pal: P.void, seed: s.sd, extra: glint * 0.35, erode: C(u, [[0, 0], [0.55, 0], [1, 1]]) });
  };
  // shards land on their own ground line (gy moves with them across the ground) and skid; one that crosses the hero's row
  // moves to the other layer (behind him: under the characters, in front: over them)
  const shardTick = (q, p, back) => (ps, dt) => {
    const other = back ? q.shF : q.shB;
    for (let i = ps.parts.length - 1; i >= 0; i--) {
      const s = ps.parts[i];
      s.gy += s.gv * dt; s.gv *= Math.exp(-(s.drag || 0) * dt);
      if (s.y > s.gy && s.vy > 0) { s.y = s.gy; s.vy *= -0.22; s.vx *= 0.45; s.spin *= 0.4; s.flip *= 0.5; }
      if (other && !other.dead && (s.gy < p.y) !== back) { ps.parts.splice(i, 1); other.parts.push(s); }
    }
  };
  // one shard at a point on the dome (P3, unit), thrown along d (3D: x across, y up, z toward the camera) at speed v
  function shard(p, q, P3, d, v) {
    const R = q.size(), [x, y] = proj(p.x, p.y, R, P3[0], P3[1], P3[2]), k = R / 180;
    (P3[2] < 0 ? q.shB : q.shF).add({ x, y, vx: d[0] * v, vy: -(d[1] * CP - d[2] * SP) * v, gy: p.y + P3[2] * SP * R, gv: d[2] * SP * v,
      drag: 1.3, grav: 1100, life: rand(0.6, 1.0), spin: rand(-11, 11), rot: rand(0, TAU), flip: rand(7, 16), ph: rand(0, TAU),
      L: rand(11, 24) * k, W: rand(8, 15) * k, sd: rand(0, 40) });
  }
  // the blow's direction turned a little at random, rising by `up`
  const along = (blow, spread, up) => { const a = Math.atan2(blow[1], blow[0]) + rand(-spread, spread); return unit([Math.cos(a), up, Math.sin(a)]); };
  function breakFromHit(game, p, q) {
    const R = q.size();
    const hit = q.lastHit || { lon: 0.9, h: 0.35, I: [Math.sin(0.9) * 0.937, 0.35, Math.cos(0.9) * 0.937], blow: [-1, 0] };
    q.web = { I: hit.I, t: q.t, sd: rand(0, 40), r: 1.5, blow: hit.blow };
    q.webs.push(q.web);
    q.hitT = q.t; q.peelN = 0;
    const holeR = (bt) => { const u = (bt - HOLE0) / (BREAK - HOLE0); return u <= 0 ? 0 : 0.1 + 3.6 * Math.pow(Math.min(1, u), 1.5); };
    const last = (bt) => 1 - Math.max(0, (bt / BREAK - 0.8) / 0.2);   // the far piece fades as the hole reaches it
    const early = (bt) => 1 - Math.min(1, (bt / BREAK) * 1.6);
    q.brk = { dur: BREAK, life: 1.4, front: last, back: last, webs: early, ground: early,
      halo: (bt) => Math.max(0, 1 - (bt / BREAK) * 4), boost: (bt) => 0.25 * Math.max(0, 1 - (bt / BREAK) * 5),
      hole: (bt) => { const r = holeR(bt); return r > 0 ? [hit.I[0], hit.I[1], hit.I[2], r] : null; },
      update: (bt) => peel(p, q, holeR(bt), bt) };
    q.shF = GL.parts({ spawnFor: BREAK + 0.1, draw: shardDraw('glow'), tick: shardTick(q, p, false) });
    q.shB = GL.parts({ low: true, spawnFor: BREAK + 0.1, draw: shardDraw('low'), tick: shardTick(q, p, true) });
    const [ix, iy] = proj(p.x, p.y, R, hit.I[0], hit.I[1], hit.I[2]), bx = hit.blow[0], bz = hit.blow[1];
    FX.add({ type: 'vd_ribbon', life: 0.22, x: 0, y: 0, paint() {
      const u = this.t / this.life, r = R * 0.34 * (0.6 + u);
      GL.quad('glow', ix, iy, r, r, 0, { shape: S.star, pal: P.void, add: true, seed: 3, extra: 0.05, a: 0.85 * (1 - u) });
    } });
    sparks(ix, iy, 14, Math.atan2(-bz * SP, -bx), 0.7, { min: 250, max: 600 });            // back toward the attacker
    sparks(ix, iy, 22, Math.atan2(bz * SP, bx), 0.45, { min: 400, max: 900, w: 2.6 });     // on along the blow
    for (let i = 0; i < 14; i++) shard(p, q, hit.I, along(hit.blow, 0.5, rand(0.05, 0.6)), rand(380, 760));
    V.flash('200,120,255', 0.2, 0.25);
    V.shake(game, 12);
    V.stop(game, 0.08);
    sfx('domeShatter');
  }
  // while the hole grows: shards torn off its edge (about 13 per radian of sweep), thrown along the blow and off the glass
  function peel(p, q, hr, bt) {
    if (hr <= 0 || bt > BREAK) return;
    const I = q.web.I, T = unit(cross(Math.abs(I[1]) < 0.97 ? [0, 1, 0] : [1, 0, 0], I)), B = cross(I, T);
    const c = Math.cos(hr), sn = Math.sin(hr);
    for (let want = Math.floor(Math.min(hr, 3.14) * 13) - q.peelN; want > 0; want--) {
      q.peelN++;
      const ph = rand(0, TAU), cp = Math.cos(ph), sp = Math.sin(ph);
      const P3 = [0, 1, 2].map((i) => c * I[i] + sn * (cp * T[i] + sp * B[i]));
      if (P3[1] < 0.03) continue;                       // below the ground: no glass there
      const d = along(q.web.blow, 0.6, rand(0.1, 0.5)), o = rand(0.3, 0.7);
      shard(p, q, P3, unit([d[0] + P3[0] * o, d[1] + P3[1] * o, d[2] + P3[2] * o]), rand(170, 400));
    }
  }

  VD.BREAKS = { hit: breakFromHit };
  VD._ = { CP, SP, RISE, VIO, proj, sparks, sfx, shard, shardDraw, shardTick, along, unit, cross, rand, TAU };

  // the burst ending: a ring of force throws the monsters round it back
  function burst(game, p, q, o) {
    q.burstT = q.t; q.stopHum(); cut(q);
    const R = q.R0, x0 = p.x, y0 = p.y;
    FX.add({ type: 'vd_lowpiece', life: 0.5, x: 0, y: 0, paint() {
      const u = this.t / this.life, r = R * (0.2 + 2.1 * GL.out(u, 2.4));
      GL.quad('low', x0, y0, r, r * SP * 1.05, 0, { shape: S.ring, pal: P.void, erode: C(u, [[0, 0], [0.35, 0.2], [1, 1]]), ns: 3, add: true, extra: 0.05 });
      GL.quad('low', x0, y0, r * 0.9, r * 0.9 * SP, 0, { shape: S.glow, tint: [0.7, 0.3, 1], add: true, a: 0.6 * (1 - u) });
    } });
    FX.add({ type: 'vd_ribbon', life: 0.3, x: 0, y: 0, paint() {
      const u = this.t / this.life, r = R * 0.5 * (1 + u * 1.5);
      GL.quad('glow', x0, y0 - R * 0.35, r, r, 0, { shape: S.glow, tint: [0.85, 0.5, 1], add: true, a: 1 - u });
    } });
    sparks(x0, y0 - R * 0.3, 34, undefined, 0, { min: 400, max: 950, grav: 120 });
    V.flash('190,110,255', 0.24, 0.28);
    V.shake(game, 10);
    V.stop(game, 0.06);
    sfx('domeBurst');
    if (o.push !== false) for (const e of game.enemies) {
      if (!(e.hp > 0) || e.dummy) continue;
      const gx = (e.x - x0) / (R * 2.2), gz = (e.y - y0) / (R * 2.2 * SP), d = Math.hypot(gx, gz);
      if (d >= 1) continue;
      const n = Math.max(1e-3, d), f = 1 - d * 0.5;
      e.kbx = (e.kbx || 0) + (gx / n) * 1500 * f; e.kby = (e.kby || 0) + (gz / n) * 750 * f;
      e.slow = Math.max(e.slow || 0, 0.7);   // (stunned for a moment: they visibly fly back)
    }
    if (o.onBurst) o.onBurst(game, p);
  }

  // blows on a shielded hero: soaked by the dome (cracking it), a ripple where they land
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game.player, q = p && p.voidDome;
    if (!q || q.dead || q.broken || q.burstT !== null || !(dmg > 0) || p.inv > 0 || q.t < INTRO * 0.8) return baseHurt.apply(this, arguments);
    VD.hit(p, fromX, game);
    if (q.hp0 > 0 && q.hp > 0) {
      const take = Math.min(q.hp, dmg), before = q.crack;
      q.hp -= take; dmg -= take;
      q.crack = 1 - q.hp / q.hp0;
      FX.num(p.x + rand(-20, 20), p.y - 160, String(Math.round(take)), { fill: '#d7a8ff', size: 28 });
      if (VD.cracks === 'web' && q.lastHit) {   // a web of cracks where it landed, bigger for a bigger share of the shield
        q.webs.push({ I: q.lastHit.I, t: q.t, sd: rand(0, 40), r: Math.min(1.3, 0.35 + 2.4 * take / q.hp0) });
        if (q.webs.length > 7) q.webs.shift();
      }
      if (Math.floor(q.crack * 4) > Math.floor(before * 4)) sfx('domeCrack');
      if (q.hp <= 0) shatter(game, p, q);
      if (!(dmg > 0)) { p.inv = Math.max(p.inv || 0, 0.35); return; }
    }
    return baseHurt.call(this, game, dmg, fromX);
  };

})();
