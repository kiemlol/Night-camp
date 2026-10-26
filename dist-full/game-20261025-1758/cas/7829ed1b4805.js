/* archerfx.js — the Archer's skills drawn by code (2026-10-03, the user after the Fire Mage: "ทำ vfx ของนักธนูใหม่ด้วย"):
   js/emberfx.js's recipe in the archer's two colours, WIND (leaf green) and STAR (starlight gold). tools/archer_fx.py
   draws the frames into assets/vfx2d/archer/ (flat tones, dark outlines, marbled bands, foam dissolves, a bloom sheet each):
     shaft    an arrow with its ribbon trail (wind / star): every arrow the archer's skills shoot, the bow's basic arrows
     pop      a hit burst (wind petals / a star)
     gust     ธนูพายุทะลวง: wind ribbons twisting round the arrow
     beam     ธนูดาราพิฆาต: the starlight beam (a tile repeated along it); charge: the star gathering at the bow
     shock    ธนูกระแทก: crescents thrown forward from the hit
     rain     ห่าฝนธนู: the ring on the ground the arrows fall into
     vine     กับดักเถาวัลย์: vines shooting up round the caught monsters
     sigil    สมาธิเล็ง: a gold sight ring under the hero while the buff lasts
   The skills' numbers and rules stay as in skills.js (double, shower, gale, starshot) and skills_t1.js (ar_charge,
   ar_multishot, ar_snare): RUN.* are re-written here with the same logic, only the looks change.
   NC.ArcherFX.on = false: the old look. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, RUN = NC.SKILL_RUN, K = NC.SkillKit, SK = NC.SKILLS;
  if (!FX || !V || !RUN || !K || !K.shot) return;
  const AF = (NC.ArcherFX = { on: true, bloom: 0.45 });
  const rand = NC.rand, TAU = Math.PI * 2, alive = K.alive || ((e) => e && !e.dead && e.hp > 0);
  const GOLD = '255,210,90', WIND = '140,255,150', FPS = 15;
  const D = 'assets/vfx2d/archer/';
  // the sheets (tools/archer_fx.py, meta.json): frame size, columns, frames, the anchor in the frame
  const SH = {
    shaft: { w: 384, h: 96, cols: 8, n: 16, ax: 340, ay: 48 },
    pop: { w: 192, h: 192, cols: 8, n: 16, ax: 96, ay: 96 },
    gust: { w: 640, h: 192, cols: 5, n: 10, ax: 600, ay: 96 },
    beam: { w: 256, h: 176, cols: 8, n: 8, ax: 0, ay: 88 },
    charge: { w: 256, h: 256, cols: 6, n: 12, ax: 128, ay: 128 },
    shock: { w: 320, h: 256, cols: 5, n: 10, ax: 52, ay: 128 },
    rain: { w: 512, h: 300, cols: 6, n: 12, ax: 256, ay: 150 },
    vine: { w: 192, h: 256, cols: 8, n: 32, ax: 96, ay: 244 },
    sigil: { w: 384, h: 224, cols: 6, n: 12, ax: 192, ay: 112 },
  };
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const IMG = {};
  for (const n in SH) { IMG[n] = load(D + n + '.webp'); IMG[n + '_glow'] = load(D + n + '_glow.webp'); }
  AF.ready = () => Object.values(IMG).every(ok);
  AF.live = () => AF.on && AF.ready();

  // frame f of a sheet with its anchor at (x, y), scaled k. o: part 'glow' (the bloom, added), flip, rot, a, sx
  function blit(ctx, name, f, x, y, k, o) {
    o = o || {};
    const s = SH[name], glow = o.part === 'glow', img = IMG[name + (glow ? '_glow' : '')];
    if (!ok(img) || k <= 0) return;
    const fw = glow ? s.w / 2 : s.w, fh = glow ? s.h / 2 : s.h;
    f = Math.max(0, Math.min(s.n - 1, f | 0));
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.sx) ctx.scale(o.sx, 1);
    if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= AF.bloom * (o.glowK || 1); }
    if (o.a !== undefined) ctx.globalAlpha *= Math.max(0, Math.min(1, o.a));
    ctx.drawImage(img, (f % s.cols) * fw, Math.floor(f / s.cols) * fh, fw, fh, -s.ax * k, -s.ay * k, s.w * k, s.h * k);
    ctx.restore();
  }
  const both = (ctx, name, f, x, y, k, o) => { blit(ctx, name, f, x, y, k, o); blit(ctx, name, f, x, y, k, Object.assign({}, o, { part: 'glow' })); };
  const oneShot = (q, n) => Math.min(n - 1, Math.floor((q.t / q.life) * n));
  AF.blit = blit;

  // ---------------- arrows ----------------
  // an arrow with its ribbon at (x, y) flying along ang (tip at x, y), scale k; star: the gold one
  AF.drawShaft = (ctx, x, y, ang, k, star, t, a) => both(ctx, 'shaft', (star ? 8 : 0) + (Math.floor(t * FPS) % 8), x, y, k, { rot: ang, a });
  FX.def('ar_pop', (ctx, q) => both(ctx, 'pop', (q.star ? 8 : 0) + oneShot(q, 8), q.x, q.y, q.k, { rot: q.rot || 0 }), 'glow');
  // a hit burst of radius r (wind petals, or a gold star)
  AF.pop = (x, y, r, star) => FX.add({ type: 'ar_pop', x, y, star: !!star, k: (r || 50) / 70, rot: star ? 0 : rand(0, TAU), life: 8 / FPS });
  const LEAVES = ['#9fdc6a', '#6cc35a', '#c9f08a', '#e6ffb0'];
  const leaf = (x, y, vx, vy, life) => FX.add({ type: 'leaf', layer: 'glow', x, y, vx, vy, drag: 1.4, life: life || rand(0.6, 1.1), rot: rand(0, TAU), spin: rand(-9, 9), ph: rand(0, 6), color: NC.pick(LEAVES) });
  // a drawn arrow shot from the hand along the aim (+ off): the same flight and hit tests as skills.js's shootArrow.
  // o: off, star, k (scale), v, range, pierce, r, hit(e, q), trail(q, dt), look (another drawing)
  AF.arrow = (game, p, id, o) => {
    const [hx, hy] = K.hand(p), a = p.aim + (o.off || 0), k = o.k || 0.6, star = !!o.star;
    AF.pop(hx + Math.cos(a) * 14, hy + Math.sin(a) * 14, 30, star);
    const q = K.shot(game, p, id, {
      from: [hx, hy], ang: a, v: o.v || 1500, range: o.range || 950, r: o.r || 34, pierce: o.pierce,
      look: o.look || ((ctx, s) => AF.drawShaft(ctx, s.x, s.y, Math.atan2(s.vy, s.vx), k, star, s.t, Math.min(1, s.t / 0.05 + 0.3))),
      trail: o.trail, hit: o.hit,
    });
    V.light(hx, hy, 220, star ? GOLD : WIND, 0.7, q.life, { follow: q });
    return q;
  };

  // ---------------- the bow's basic arrows ----------------
  // the old arrow (fx.js) when the drawn ones are off; the drawn wind arrow otherwise, a petal burst where it hits
  const oldArrow = (ctx, p) => {
    const a = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(a);
    ctx.globalAlpha *= 0.35; ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-36, 0); ctx.stroke();
    ctx.globalAlpha /= 0.35;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#231a33'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.fillStyle = '#dfe6ef'; ctx.strokeStyle = '#231a33'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c94a3a';
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-24, -6); ctx.lineTo(-20, 0); ctx.lineTo(-24, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  FX.def('arrow', (ctx, p) => {
    if (!AF.live()) return oldArrow(ctx, p);
    AF.drawShaft(ctx, p.x + 12 * Math.cos(Math.atan2(p.vy, p.vx)), p.y + 12 * Math.sin(Math.atan2(p.vy, p.vx)), Math.atan2(p.vy, p.vx), p.big ? 0.58 : 0.5, false, p.t, Math.min(1, p.t / 0.04 + 0.4));
  });
  const baseAdd = FX.add;
  FX.add = function (q) {
    if (q && q.type === 'arrow' && q.update && AF.live()) {
      const up = q.update;
      q.update = function (o2) {
        const was = o2.dead, r = up.apply(this, arguments);
        if (!was && o2.dead && NC.game && !(NC.game.world.isSolid && NC.shotWall(NC.game.world, o2.x, o2.y + 60))) AF.pop(o2.x, o2.y, o2.big ? 42 : 34, false);
        return r;
      };
    }
    return baseAdd.apply(this, arguments);
  };

  // ---------------- ground pieces: drawn under the characters ('low'), their bloom after the lights ('glow') ----------------
  FX.def('ar_ground', (ctx, q) => q.paint(ctx, 'main'), 'low');
  FX.def('ar_ground_glow', (ctx, b) => { if (b.main.dead || !FX.list.includes(b.main)) { b.dead = true; return; } b.main.paint(ctx, 'glow'); }, 'glow');
  const ground = (q) => { FX.add(q); FX.add({ type: 'ar_ground_glow', main: q, x: q.x, y: q.y, life: q.life + 0.1 }); return q; };
  // a looping ground sheet (rain, sigil) at (x, y) of radius r for dur s; o.who: follow (x, y of who); o.until(): ends early
  const loopGround = (name, R0, x, y, r, dur, o) => ground({
    type: 'ar_ground', x, y, life: dur,
    paint(ctx, part) {
      if (o && o.who) { this.x = o.who.x; this.y = o.who.y; }
      if (o && o.until && o.until() && this.t < this.life - 0.3) this.t = this.life - 0.3;
      const a = Math.min(1, this.t / 0.15, (this.life - this.t) / 0.3) * ((o && o.a) || 1);
      const g = 0.75 + 0.25 * Math.min(1, this.t / 0.2);
      blit(ctx, name, Math.floor(this.t * FPS) % 12, this.x, this.y, (r / R0) * g, { part: part === 'glow' ? 'glow' : undefined, a });
    },
  });

  // ---------------- the skills (the same rules as skills.js / skills_t1.js) ----------------
  const OLD = {};
  for (const id of ['double', 'shower', 'gale', 'starshot', 'ar_charge', 'ar_multishot', 'ar_snare']) OLD[id] = RUN[id];
  const live = (id, self, args) => { if (AF.live()) return true; if (OLD[id]) OLD[id].apply(self, args); return false; };
  const bowPose = (game, p, i, lock) => K.pose(game, p, K.clip(p, 'arrow', i === undefined ? 1 : i), lock || 0.3);

  // ยิงคู่: two gold arrows, one after the other
  RUN.double = function (game, p, lv) {
    if (!live('double', this, arguments)) return;
    K.pose(game, p, 'bow2', 0.3);
    for (const [t, off] of [[0.1, -0.03], [0.24, 0.03]]) V.at(t, () => AF.arrow(game, p, 'double', {
      off, star: true, k: 0.74,
      hit(e, q) {
        K.strike(game, p, 'double', e, Math.cos(p.aim) * 160, Math.sin(p.aim) * 120, { color: '255,235,180' });
        AF.pop(q.x, q.y, 62, true);
        V.sparks(q.x, q.y, 6, GOLD, { size: 0.8 });
      },
    }));
  };

  // ห่าฝนธนู: arrows up, then twenty falling into a ring on the ground ahead
  RUN.shower = function (game, p, lv) {
    if (!live('shower', this, arguments)) return;
    K.pose(game, p, 'bow3', 0.6);
    const [tx, ty] = K.ground(game, p, 420);
    loopGround('rain', 220, tx, ty, 180, 1.55);
    V.light(tx, ty - 20, 260, WIND, 0.6, 1.4);
    V.at(0.2, () => {
      const [hx, hy] = K.hand(p);
      AF.pop(hx, hy - 10, 40, false);
      for (let i = 0; i < 3; i++) {
        const vx = rand(-90, 90), vy = -1700;
        K.proj({ x: hx + rand(-10, 10), y: hy, vx, vy, life: 0.3, draw(ctx, q) { AF.drawShaft(ctx, q.x, q.y, Math.atan2(vy, vx), 0.5, false, q.t, 1 - q.t / 0.3); } });
      }
    });
    const mul = SK.shower.mul(lv) * 0.6; // (20 arrows: each a little weaker than the old 12)
    for (let i = 0; i < 20; i++) V.at(0.4 + i * 0.032, () => {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 150, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * 0.62;
      const sx = x + 70, sy = y - 760, dur = 0.16, ang = Math.atan2(y - sy, x - sx);
      K.proj({
        x: sx, y: sy, vx: (x - sx) / dur, vy: (y - sy) / dur, life: dur,
        draw(ctx, q) { AF.drawShaft(ctx, q.x, q.y, ang, 0.5, false, q.t); },
        onEnd() {
          FX.add({ type: 'varrowin', x, y: y - 16, sort: y, ang: Math.atan2(sy - y, sx - x) + Math.PI, life: 1.2 });
          AF.pop(x, y - 14, 30, false);
          if (Math.random() < 0.5) leaf(x, y - 20, rand(-120, 120), rand(-200, -60), rand(0.4, 0.7));
          V.smoke(x, y, 1, '#cbbfae', '#efe6d8', { size: 0.4, lifeK: 0.5 });
          for (const e of K.around(game, x, y, 55)) K.strike(game, p, 'shower', e, 0, 0, { color: '200,255,190' }, { mul });
        },
      });
    });
  };

  // ธนูพายุทะลวง: an arrow inside twisting wind that pierces the whole line
  RUN.gale = function (game, p, lv) {
    if (!live('gale', this, arguments)) return;
    K.pose(game, p, 'bow3', 0.55);
    V.at(0.3, () => {
      const a = p.aim, [hx, hy] = K.hand(p);
      AF.pop(hx + Math.cos(a) * 20, hy + Math.sin(a) * 20, 64, false);
      V.smoke(hx, hy, 4, '#d7f2c8', '#ffffff', { size: 0.7, lifeK: 0.6 });
      V.shake(game, 6);
      AF.arrow(game, p, 'gale', {
        v: 1300, range: 1100, pierce: true,
        look(ctx, q) {
          const ang = Math.atan2(q.vy, q.vx), grow = Math.min(1, q.t / 0.12);
          both(ctx, 'gust', Math.floor(q.t * FPS) % 10, q.x, q.y, 0.78, { rot: ang, sx: 0.35 + 0.65 * grow });
        },
        trail(q) { if (Math.random() < 0.7) leaf(q.x - q.vx * 0.05, q.y - q.vy * 0.05, -q.vx * 0.1 + rand(-80, 80), -q.vy * 0.1 + rand(-80, 80), rand(0.4, 0.7)); },
        hit(e, q) {
          K.strike(game, p, 'gale', e, Math.cos(a) * 620, Math.sin(a) * 420, { big: true, color: '170,255,160' });
          AF.pop(e.x, e.y - 50, 84, false);
          for (let i = 0; i < 4; i++) leaf(e.x, e.y - 60, rand(-220, 220), rand(-240, 60));
        },
      });
    });
  };

  // ธนูดาราพิฆาต: the star gathers at the bow, then a beam of starlight across the screen
  FX.def('ar_chargefx', (ctx, q) => { const [hx, hy] = K.hand(q.p); both(ctx, 'charge', oneShot(q, 12), hx + Math.cos(q.p.aim) * 46, hy + Math.sin(q.p.aim) * 46, q.k); }, 'glow');
  FX.def('ar_beam', (ctx, q, u) => {
    const a = u < 0.1 ? u / 0.1 : 1 - Math.pow((u - 0.1) / 0.9, 1.4), L = q.len * Math.min(1, u / 0.08);
    const k = (q.w / 128) * (0.5 + 0.5 * a), tile = 256 * k, f = Math.floor(q.t * FPS) % 8;
    ctx.save();
    ctx.translate(q.x, q.y); ctx.rotate(q.ang);
    for (let x = 0; x < L; x += tile - 1) {
      const fade = Math.min(1, (L - x) / (tile * 0.8));       // (the tip thins out; one frame for every tile: the seams match)
      both(ctx, 'beam', f, x, 0, k, { a: a * fade });
    }
    ctx.restore();
  }, 'glow');
  RUN.starshot = function (game, p, lv) {
    if (!live('starshot', this, arguments)) return;
    K.pose(game, p, 'bow3', 1.0);
    const charge = 0.7;
    FX.add({ type: 'ar_chargefx', x: p.x, y: p.y, p, k: 1.0, life: 12 / FPS });
    p.channel = {
      t: 0, dur: charge,
      update(game, p, ch) {
        p.vx *= 0.8; p.vy *= 0.8;
        const [hx, hy] = K.hand(p);
        if (Math.random() < 0.6) V.gather(hx, hy, 1, NC.pick([GOLD, '255,240,190']), 170, 0.35);
        if (!ch.light) ch.light = V.light(hx, hy, 300, GOLD, 1, charge + 0.2);
        ch.light.x = hx; ch.light.y = hy;
      },
      end(game, p) {
        const [hx, hy] = K.hand(p), a = p.aim, c = Math.cos(a), s = Math.sin(a), len = 1300, W = 110;
        FX.add({ type: 'ar_beam', x: hx, y: hy, ang: a, len, w: W, life: 0.6 });
        AF.pop(hx, hy, 104, true);
        V.at(0.05, () => AF.pop(hx + c * len * 0.98, hy + s * len * 0.98, 110, true));
        V.flash('255,248,215', 0.32, 0.35);
        V.shake(game, 14); V.stop(game, 0.08);
        for (let i = 1; i <= 5; i++) V.light(hx + c * len * (i / 5), hy + s * len * (i / 5), 320, GOLD, 1, 0.6);
        V.every(0.35, 20, () => { const t = rand(0.05, 1); V.motes(hx + c * len * t, hy + s * len * t, 1, GOLD, { rise: 60, spread: 30, size: 1.2 }); });
        for (const e of game.enemies) {
          if (!alive(e)) continue;
          const dx = e.x - hx, dy = e.y - 50 - hy, along = dx * c + dy * s, side = Math.abs(-dx * s + dy * c);
          if (along > -20 && along < len && side < W / 2 + e.r + 20) {
            K.strike(game, p, 'starshot', e, c * 520, s * 380, { big: true, color: '255,240,190' });
            AF.pop(e.x, e.y - 50, 70, true);
          }
        }
      },
    };
  };

  // ธนูกระแทก: a heavy gold arrow; where it hits, crescents thrown forward and a stun
  FX.def('ar_shock', (ctx, q) => both(ctx, 'shock', oneShot(q, 10), q.x, q.y, q.k, { rot: q.ang }), 'glow');
  RUN.ar_charge = function (game, p, lv) {
    if (!live('ar_charge', this, arguments)) return;
    bowPose(game, p, 2, 0.45);
    V.at(0.22, () => {
      const a = p.aim;
      V.shake(game, 5);
      AF.arrow(game, p, 'ar_charge', {
        star: true, k: 0.95, v: 1350, range: 950,
        hit(e, q) {
          K.hit(game, p, 'ar_charge', e, Math.cos(a) * 760, Math.sin(a) * 520, '255,190,120', 1, { big: true });
          K.stun(game, e, 1);
          FX.add({ type: 'ar_shock', x: q.x - Math.cos(a) * 24, y: q.y - Math.sin(a) * 24, ang: a, k: 1.0, life: 10 / FPS });
          AF.pop(q.x, q.y, 74, true);
          V.sparks(q.x, q.y, 12, GOLD, { size: 0.9, ang: a, spread: 0.8 });
          V.smoke(q.x, q.y + 40, 3, '#cbbfae', '#efe6d8', { size: 0.6, lifeK: 0.6 });
          V.shake(game, 7);
        },
      });
    });
  };

  // ยิงกระจาย: five wind arrows in a fan
  RUN.ar_multishot = function (game, p, lv) {
    if (!live('ar_multishot', this, arguments)) return;
    bowPose(game, p, 1, 0.35);
    V.at(0.12, () => {
      for (let i = 0; i < 5; i++) {
        const a0 = p.aim + (i - 2) * 0.17;
        AF.arrow(game, p, 'ar_multishot', {
          off: (i - 2) * 0.17, k: 0.58, v: 1300, range: 850,
          hit(e, q) {
            K.hit(game, p, 'ar_multishot', e, Math.cos(a0) * 140, Math.sin(a0) * 140 * 0.7, '200,235,255');
            AF.pop(q.x, q.y, 40, false);
          },
        });
      }
    });
  };

  // กับดักเถาวัลย์: the trap snaps, vines shoot up round everything caught
  FX.def('ar_vine', (ctx, q) => both(ctx, 'vine', q.v * 16 + oneShot(q, 16), q.x, q.y, q.k, { flip: q.flip }), 'sorted');
  const vineAt = (x, y, h, v, flip, life) => FX.add({ type: 'ar_vine', x, y, sort: y, k: h / 200, v, flip, life: life || 1.4 });
  RUN.ar_snare = function (game, p, lv) {
    if (!live('ar_snare', this, arguments)) return;
    NC.throwTrap(game, p, 'ar_snare', {
      kind: 'snare', rgb: WIND, r: 70,
      boom(game, t) {
        V.decal(t.x, t.y, 90, 'goo', 2, { col: 'rgba(70,150,50,0.35)' });
        AF.pop(t.x, t.y - 12, 80, false);
        for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + rand(-0.2, 0.2); vineAt(t.x + Math.cos(a) * 58, t.y + Math.sin(a) * 32, rand(115, 150), i % 2, Math.cos(a) > 0, 1.2); }
        for (const e of K.around(game, t.x, t.y, 110)) {
          K.hit(game, p, 'ar_snare', e, 0, 0, '160,240,140', (p.d.trapK || 1));
          K.stun(game, e, SK.ar_snare.hold(NC.skillLv(p, 'ar_snare')));
          const hold = Math.max(1.2, Math.min(2.4, SK.ar_snare.hold(NC.skillLv(p, 'ar_snare'))));
          vineAt(e.x - 24, e.y + 4, 145, 0, true, hold);
          vineAt(e.x + 24, e.y + 6, 132, 1, false, hold);
          vineAt(e.x + 4, e.y + 10, 110, 1, true, hold);
          for (let i = 0; i < 3; i++) leaf(e.x, e.y - 40, rand(-160, 160), rand(-220, -40));
        }
      },
    });
  };

  // สมาธิเล็ง: a gold sight ring under the hero while the buff lasts
  NC.skillCasts.push((game, p, id) => {
    if (id !== 'ar_concentrate' || !AF.live() || !game || p !== game.player) return;
    const dur = (p.buffs && p.buffs.ar_concentrate) || 20;
    loopGround('sigil', 160, p.x, p.y, 110, dur, { who: p, a: 0.85, until: () => !(p.buffs && p.buffs.ar_concentrate > 0) });
    AF.pop(p.x, p.y - 60, 70, true);
  });
})();
