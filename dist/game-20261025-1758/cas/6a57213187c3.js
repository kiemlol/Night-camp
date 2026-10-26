/* emberfx.js — the Fire Mage's skills drawn by code (2026-10-03, the user after the crimson shield: "ลอง revoke vfx
   สกิลของเมจไฟทั้งหมด ใช้สูตรนี้แทน"). tools/ember_fx.py draws the frames into assets/vfx2d/ember/ with the shield's
   recipe in fire tones (flat tones, dark-red outlines, marbled swirls, foam dissolves, a bloom sheet each):
     tongue   flame licks (3 kinds): every flame the Fire Mage's skills raise
     pillar   เสาเพลิง: a column of fire bursting from a ring on the ground
     sea      ทะเลเพลิง (and the small pools of fire left behind): lava fire on the ground, in / loop / out
     ring     วงแหวนเพลิง: a band of fire on the ground round the hero, licks rising along it
     blast    ระบายความร้อน, ไฟระเบิด (8 burns), the meteors' landings: a dome of fire (its back half under the characters)
     ball     the orb's fireballs (ลูกไฟตีปกติ), เพลิงตามติด's little ones, ไฟลาม's leaps, อุกกาบาต (a rock in the fire)
     flame    a standing flame (a loop, 3 kinds): EVERY fire-coloured effect flame in the game (V.flameAt's 'vflame', so the
              explosions, burns, trails of all jobs; not the campfires, which draw V.flame themselves), the burn mark
     wall     กำแพงไฟ (the Mage's Flame Barrier): a strip of lava laid along the wall, a row of standing flames on it
     pop      a small impact splash
   The skills' numbers and rules stay as in jobs3_skills_a.js: RUN.fm_* are re-written here with the same logic, and the
   hooks there (the 8-burn blast, the seeking fireballs, the leaps, the self-burn) call NC.EmberFX when it is live.
   NC.EmberFX.on = false: the old look. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, RUN = NC.SKILL_RUN, K = NC.SkillKit;
  if (!FX || !V || !RUN || !K) return;
  const EF = (NC.EmberFX = { on: true, bloom: 0.35 });
  const rand = NC.rand, TAU = Math.PI * 2, alive = K.alive;
  const FIRE = (K.C && K.C.fire) || '255,140,60';
  const D = 'assets/vfx2d/ember/';
  // the sheets (tools/ember_fx.py, meta.json): frame size, columns, frames, the anchor (feet / centre) in the frame
  const SH = {
    tongue: { w: 160, h: 256, cols: 10, n: 30, ax: 80, ay: 240 },
    pillar: { w: 256, h: 512, cols: 7, n: 14, ax: 128, ay: 470 },
    blast: { w: 448, h: 448, cols: 7, n: 14, ax: 224, ay: 340, back: true },
    sea: { w: 576, h: 340, cols: 6, n: 22, ax: 288, ay: 170 },
    ring: { w: 512, h: 300, cols: 6, n: 12, ax: 256, ay: 150 },
    ball: { w: 384, h: 384, cols: 8, n: 16, ax: 236, ay: 192 },
    pop: { w: 192, h: 192, cols: 8, n: 8, ax: 96, ay: 96 },
    flame: { w: 160, h: 256, cols: 12, n: 36, ax: 80, ay: 240 },
    wall: { w: 448, h: 128, cols: 6, n: 12, ax: 224, ay: 64 },
  };
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const IMG = {};
  for (const n in SH) {
    IMG[n] = load(D + n + '.webp');
    IMG[n + '_glow'] = load(D + n + '_glow.webp');
    if (SH[n].back) IMG[n + '_back'] = load(D + n + '_back.webp');
  }
  EF.ready = () => Object.values(IMG).every(ok);
  EF.live = () => EF.on && EF.ready();
  const FPS = 15;

  // frame f of a sheet with its anchor at (x, y), scaled k. o: part ('glow' = the bloom, added; 'back'), flip, rot, a
  function blit(ctx, name, f, x, y, k, o) {
    o = o || {};
    const s = SH[name], glow = o.part === 'glow';
    const img = IMG[name + (glow ? '_glow' : o.part === 'back' ? '_back' : '')];
    if (!ok(img) || k <= 0) return;
    const fw = glow ? s.w / 2 : s.w, fh = glow ? s.h / 2 : s.h;
    f = Math.max(0, Math.min(s.n - 1, f | 0));
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= EF.bloom * (o.glowK || 1); }
    if (o.a !== undefined) ctx.globalAlpha *= Math.max(0, o.a);
    ctx.drawImage(img, (f % s.cols) * fw, Math.floor(f / s.cols) * fh, fw, fh, -s.ax * k, -s.ay * k, s.w * k, s.h * k);
    ctx.restore();
  }
  const both = (ctx, name, f, x, y, k, o) => { blit(ctx, name, f, x, y, k, o); blit(ctx, name, f, x, y, k, Object.assign({}, o, { part: 'glow' })); };
  const oneShot = (q, n) => Math.min(n - 1, Math.floor((q.t / q.life) * n));
  EF.blit = blit;

  // ---------------- flames ----------------
  FX.def('em_tongue', (ctx, q) => {
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.scale(q.wide, 1);   // (the drawn licks are slim: a little wider on the ground)
    both(ctx, 'tongue', q.v * 10 + oneShot(q, 10), 0, 0, q.k, { flip: q.flip });
    ctx.restore();
  }, 'glow');
  // a flame lick standing on (x, y), about h tall; o: life, vx, vy, v (kind 0..2)
  EF.tongue = (x, y, h, o) => {
    o = o || {};
    return FX.add({ type: 'em_tongue', x, y, k: h / 200, wide: o.wide || 1.45, v: o.v !== undefined ? o.v : Math.floor(rand(0, 3)), flip: Math.random() < 0.5,
      life: o.life || rand(0.55, 0.72), vx: o.vx || 0, vy: o.vy || 0 });
  };
  // a burning monster while the hero is a Fire Mage (statuses.js asks): fewer, bigger licks than the old flecks
  // a burning monster (statuses.js asks; every job's burns since 2026-10-03: "สถานะไฟก็ยังไม่เปลี่ยน เปลี่ยนให้หมด")
  EF.burning = (game, e, s, dt) => {
    if (!EF.live()) return false;
    if (Math.random() < dt * (0.9 + s.n * 0.25)) EF.tongue(e.x + rand(-20, 20), e.y - rand(0, 26), rand(40, 54) + s.n * 2, { vy: -40, life: rand(0.42, 0.55), wide: 1.25 });
    return true;
  };
  // a standing flame (the loop) with its base at (x, y), w wide and h tall; ph its clock (frames), v its kind 0..2
  EF.flameLoop = (ctx, x, y, w, h, ph, a, v) => {
    if (h < 2 || !(a > 0.01)) return;
    const k = h / 200, sx = w / 76 / k;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, 1);
    both(ctx, 'flame', (v || 0) * 12 + (((Math.floor(ph) % 12) + 12) % 12), 0, 0, k, { a });
    ctx.restore();
  };
  // every fire-coloured effect flame (V.flameAt: explosions, burns, trails, K.flames ...) is the drawn loop now; the
  // other palettes (poison, ice, the wisps') keep vfx.js's shape
  FX.def('vflame', (ctx, p, u) => {
    const k = u < 0.15 ? u / 0.15 : 1 - Math.pow((u - 0.15) / 0.85, 1.5);
    if (p.pal === V.PAL.fire && EF.live()) return EF.flameLoop(ctx, p.x, p.y, p.w * k * 1.3, p.h * k * 1.1, p.t * 14 + p.ph * 3, 1, Math.floor(p.ph) % 3);
    V.flame(ctx, p.x, p.y, p.w * k, p.h * k, p.t * 14 + p.ph, p.pal, 1);
  }, 'glow');
  EF.tongues = (x, y, n, spread, hmin, hmax) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * spread;
      V.at(rand(0, 0.12), () => EF.tongue(x + Math.cos(a) * d, y + Math.sin(a) * d * V.SQ, rand(hmin || 60, hmax || 110)));
    }
  };

  // ---------------- ground fire: pools (the sea) and bands (the ring) ----------------
  // drawn under the characters ('low'); their bloom goes on after the night lighting ('glow')
  FX.def('em_ground', (ctx, q) => q.paint(ctx, 'main'), 'low');
  FX.def('em_ground_glow', (ctx, b) => { if (b.main.dead || !FX.list.includes(b.main)) { b.dead = true; return; } b.main.paint(ctx, 'glow'); }, 'glow');
  const ground = (q) => { FX.add(q); FX.add({ type: 'em_ground_glow', main: q, x: q.x, y: q.y, life: q.life + 0.1 }); return q; };
  const seaFrame = (q) => {
    const t = q.t, inT = 5 / FPS, outT = q.life - 5 / FPS;
    if (t < inT) return Math.floor(t * FPS);
    if (t >= outT) return 17 + Math.floor((t - outT) * FPS);
    return 5 + (Math.floor((t - inT) * FPS) % 12);
  };
  // a pool of fire of radius r for dur seconds (move it through .x / .y)
  EF.pool = (x, y, r, dur) => ground({
    type: 'em_ground', x, y, life: dur, k: r / 270,
    paint(ctx, part) { blit(ctx, 'sea', seaFrame(this), this.x, this.y, this.k, { part: part === 'glow' ? 'glow' : undefined, glowK: 0.7 }); },
  });
  // bands of fire round `who` (radius () => R, times each of rings) for dur seconds
  EF.band = (who, R, rings, dur) => ground({
    type: 'em_ground', x: who.x, y: who.y, life: dur,
    paint(ctx, part) {
      const a = Math.min(1, this.t / 0.15, (this.life - this.t) / 0.3), f = Math.floor(this.t * FPS) % 12;
      for (const m of rings) blit(ctx, 'ring', (f + Math.round(m * 5)) % 12, who.x, who.y, (R() * m) / 220, { part: part === 'glow' ? 'glow' : undefined, a, flip: m > 1 });
    },
  });

  // ---------------- the dome blast ----------------
  FX.def('em_blast', (ctx, q) => both(ctx, 'blast', oneShot(q, 14), q.x, q.y, q.k), 'glow');
  FX.def('em_blast_back', (ctx, q) => blit(ctx, 'blast', oneShot(q, 14), q.x, q.y, q.k, { part: 'back' }), 'low');
  // a blast of fire of radius r at (x, y) (the dome is about 0.8 r); o: shake, flash, tongues, sparks
  EF.blast = (game, x, y, r, o) => {
    o = o || {};
    const k = (r * 0.8) / 130, life = 14 / FPS;
    FX.add({ type: 'em_blast_back', x, y, k, life });
    FX.add({ type: 'em_blast', x, y, k, life });
    V.light(x, y - r * 0.4, r * 2.6, FIRE, 1, 0.8, { flick: true });
    V.sparks(x, y - r * 0.35, o.sparks || 16, '255,170,80', { size: 1.1, min: 380, max: 900, sq: 0.8 });
    if (o.tongues) V.at(0.18, () => EF.tongues(x, y, o.tongues, r * 0.8, 60, 120));
    if (o.shake !== 0 && game) V.shake(game, o.shake || 6);
    if (o.flash) V.flash(o.flash, 0.16, 0.3);
    if (o.smoke !== false && V.smoke) V.at(0.35, () => V.smoke(x, y - 20, 5, '#4a3a3a', '#6a5555', { size: 1, lifeK: 0.8 }));
  };

  // ---------------- fireballs ----------------
  // a fireball (or a meteor) at (x, y) flying along ang, head radius 50 * k (meteor 60 * k)
  EF.drawBall = (ctx, x, y, ang, k, meteor, t) => both(ctx, 'ball', (meteor ? 8 : 0) + (Math.floor(t * FPS) % 8), x, y, k, { rot: ang });
  EF.ballLook = (k, meteor) => (ctx, q) => EF.drawBall(ctx, q.x, q.y, Math.atan2(q.vy || 0, q.vx || 1), k, meteor, q.t);
  FX.def('em_pop', (ctx, q) => both(ctx, 'pop', oneShot(q, 8), q.x, q.y, q.k), 'glow');
  EF.pop = (x, y, r) => FX.add({ type: 'em_pop', x, y, k: (r || 60) / 70, life: 8 / FPS });
  // ไฟลาม: a little fireball arcs from a fallen one to the next
  FX.def('em_leap', (ctx, q, u) => {
    const x = q.x0 + (q.x1 - q.x0) * u, y = q.y0 + (q.y1 - q.y0) * u - Math.sin(u * Math.PI) * 90;
    const dx = q.x1 - q.x0, dy = q.y1 - q.y0 - Math.cos(u * Math.PI) * 90 * Math.PI;
    EF.drawBall(ctx, x, y, Math.atan2(dy, dx), 0.36, false, q.t);
  }, 'glow');
  EF.leap = (e, f) => {
    FX.add({ type: 'em_leap', x: e.x, y: e.y, x0: e.x, y0: e.y - 50, x1: f.x, y1: f.y - 50, life: 0.32,
      onEnd: () => { EF.pop(f.x, f.y - 50, 50); EF.tongue(f.x, f.y - 10, 70); } });
  };

  // ---------------- the orb's basic fireballs (ลูกไฟตีปกติ) ----------------
  const fireOrb = () => {
    const g = NC.game, p = g && g.player;
    return !!(p && NC.isJob && NC.isJob(p, 'firemage') && NC.skillLv(p, 'fm_orbfire') > 0 && NC.wtypeOf && NC.wtypeOf(NC.weaponDef(p)) === 'orb');
  };
  FX.def('em_bolt', (ctx, q) => EF.drawBall(ctx, q.x, q.y, Math.atan2(q.vy, q.vx), q.big ? 0.42 : 0.32, false, q.t), 'glow');
  const BLUE = { '150,220,255': 1, '170,230,255': 1, '160,210,255': 1 };
  let inBolt = false, muzzleAt = -1;
  const baseAdd = FX.add;
  FX.add = function (q) {
    if (q && EF.live() && fireOrb()) {
      const now = NC.game.time;
      if (q.type === 'bolt') {
        q.type = 'em_bolt'; q.layer = 'glow'; muzzleAt = now;
        const up = q.update;
        if (up) q.update = function () { inBolt = true; try { return up.apply(this, arguments); } finally { inBolt = false; } };
      } else if ((inBolt || muzzleAt === now) && BLUE[q.color]) {
        if (q.type === 'ring') { if (inBolt) { EF.pop(q.x, q.y, q.r1 * 0.7); return q; } q.color = '255,150,70'; }
        else q.color = '255,180,90';
      }
    }
    return baseAdd.apply(this, arguments);
  };

  // ---------------- the skills (same rules as jobs3_skills_a.js) ----------------
  const OLD = {};
  for (const id of ['fm_pillar', 'fm_sea', 'fm_ring', 'fm_vent', 'fm_seek', 'fm_meteor']) OLD[id] = RUN[id];
  const HEAT = () => NC.heat || { v: 0 };
  const wt = (p) => (NC.wtypeOf ? NC.wtypeOf(NC.weaponDef(p)) : '');
  const castPose = (game, p, lock) => K.pose(game, p, K.clip(p, 'bolt', 0), lock || 0.3);
  const shout = (p, text, fill) => FX.text(p.x, p.y - 200, text, fill || '#ffe28a', 32);
  const scale = (p, id) => (NC.skillScale ? NC.skillScale(p, id) : 1);
  const live = (id, self, args) => { if (EF.live()) return true; if (OLD[id]) OLD[id].apply(self, args); return false; };

  RUN.fm_pillar = function (game, p, lv) {
    if (!live('fm_pillar', this, arguments)) return;
    castPose(game, p, 0.3);
    const e0 = K.target(game, p, 600);
    let [tx, ty] = e0 ? [e0.x, e0.y] : K.ground(game, p, 440);
    const n = wt(p) === 'staff' ? 4 : 3;
    for (let i = 0; i < n; i++) V.at(0.12 + i * 0.22, () => {
      if (e0 && alive(e0)) { tx = e0.x; ty = e0.y; }
      FX.add({ type: 'em_pillar', x: tx, y: ty + 4, k: 0.72, flip: i % 2 === 1, life: 14 / FPS });
      V.light(tx, ty - 120, 380, FIRE, 1, 0.7, { flick: true });
      V.sparks(tx, ty - 80, 8, '255,170,80', { ang: -Math.PI / 2, spread: 0.7, min: 420, max: 820, size: 0.9 });
      V.shake(game, 3);
      for (const e of K.around(game, tx, ty, 110)) K.hit(game, p, 'fm_pillar', e, 0, -140, '255,170,90', lv >= 5 && NC.statusOf(e, 'burn') ? 1.2 : 1);
      if (i === n - 1 && lv >= 10) {
        const x0 = tx, y0 = ty;
        EF.pool(x0, y0, 100 * scale(p, 'fm_pillar'), 3);
        K.zone(game, p, 'fm_pillar', x0, y0, 100, 3, 0.5, { rgb: FIRE, color: '255,170,90', circle: false, glow: false,
          tick(z, dt) { if (Math.random() < dt * 5) EF.tongue(x0 + rand(-70, 70), y0 + rand(-26, 26), rand(50, 80)); } });
      }
    });
  };
  FX.def('em_pillar', (ctx, q) => both(ctx, 'pillar', oneShot(q, 14), q.x, q.y, q.k, { flip: q.flip }), 'glow');

  RUN.fm_sea = function (game, p, lv) {
    if (!live('fm_sea', this, arguments)) return;
    castPose(game, p, 0.3);
    const [tx, ty] = K.ground(game, p, 480), R = 320, Rs = R * scale(p, 'fm_sea');
    const hunt = lv >= 10 ? K.target(game, p, 700, 400) : null;
    const pool = EF.pool(tx, ty, Rs, 6);
    K.zone(game, p, 'fm_sea', tx, ty, R, 6, 0.5, {
      rgb: FIRE, color: '255,170,90', status: ['burn', 4], circle: false, glow: false,
      each(e) { if (lv >= 5) K.slow(e, 0.6); },
      tick(q, dt) {
        if (hunt && alive(hunt)) { q.x += Math.sign(hunt.x - q.x) * Math.min(Math.abs(hunt.x - q.x), 60 * dt); q.y += Math.sign(hunt.y - q.y) * Math.min(Math.abs(hunt.y - q.y), 40 * dt); }
        pool.x = q.x; pool.y = q.y;
        if (q.t < 5.6 && Math.random() < dt * 10) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * Rs * 0.85; EF.tongue(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * V.SQ, rand(60, 120)); }
      },
    });
    V.light(tx, ty - 40, Rs * 2.4, FIRE, 0.9, 6, { flick: true });
  };

  RUN.fm_ring = function (game, p, lv) {
    if (!live('fm_ring', this, arguments)) return;
    castPose(game, p, 0.25);
    const last = new Map();
    let R = 170;
    const rings = lv >= 10 ? [1, 1.55] : [1];
    EF.band(p, () => R, rings, 4);
    K.zone(game, p, 'fm_ring', p.x, p.y, R, 4, 0.1, {
      rgb: FIRE, circle: false, glow: false, hits: false, follow: p,
      tick(z, dt) {
        if (lv >= 5) R = Math.min(300, R + 40 * dt);
        for (const k of rings) {
          const rr = R * k;
          if (z.t < 3.7 && Math.random() < dt * 12 * k) { const a = rand(0, TAU); EF.tongue(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * V.SQ, rand(60, 100)); }
          for (const e of K.around(game, p.x, p.y, rr + 40)) {
            const d = Math.hypot(e.x - p.x, (e.y - p.y) / 0.62);
            if (d < rr - 60) continue;
            const key = e.id || e;
            if (game.time - (last.get(key) || -9) < 1.2) continue;
            last.set(key, game.time);
            const a = NC.angle(p.x, p.y, e.x, e.y);
            K.hit(game, p, 'fm_ring', e, Math.cos(a) * 420, Math.sin(a) * 300, '255,170,90');
            EF.pop(e.x, e.y - 40, 50);
          }
        }
      },
    });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; EF.tongue(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * V.SQ, rand(70, 110)); }
    V.light(p.x, p.y - 40, 520, FIRE, 0.8, 4, { follow: p, flick: true });
  };

  RUN.fm_vent = function (game, p, lv) {
    if (!live('fm_vent', this, arguments)) return;
    const H = HEAT(), h = H.v;
    K.pose(game, p, 'cheer', 0.3);
    const r = 220 + h * 1.4;
    K.nova(game, p, 'fm_vent', p.x, p.y, r, { fx: false, kb: 380, color: '255,170,90' });
    EF.blast(game, p.x, p.y, r * scale(p, 'fm_vent'), { shake: 4 + h / 15, flash: h >= 80 ? '255,160,80' : null, tongues: 6 + Math.round(h / 10) });
    if (h >= 100 && lv >= 5) {
      EF.pool(p.x, p.y, 200 * scale(p, 'fm_vent'), 4);
      K.zone(game, p, 'fm_vent', p.x, p.y, 200, 4, 0.5, { rgb: FIRE, color: '255,170,90', mul: 0.3, status: ['burn', 3], circle: false, glow: false });
    }
    if (lv >= 10) p.fmQuick = game.time + 5;
    H.v = 0; H.vented = game.time;
    shout(p, 'ระบายความร้อน!', '#ffb070');
  };

  RUN.fm_seek = function (game, p, lv) {
    if (!live('fm_seek', this, arguments)) return;
    K.pose(game, p, 'cheer', 0.25);
    K.startBuff(game, p, 'fm_seek', lv);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; EF.tongue(p.x + Math.cos(a) * 80, p.y + Math.sin(a) * 80 * V.SQ, rand(60, 90), { life: 0.6 }); }
    EF.pop(p.x, p.y - 70, 70);
    V.light(p.x, p.y - 60, 320, FIRE, 0.8, 0.7, { follow: p });
  };

  // ---------------- the Mage's fire: ลูกไฟ (fireball) and กำแพงไฟ (mg_firewall), same rules as skills.js / skills_t1.js ----------------
  OLD.fireball = RUN.fireball;
  OLD.mg_firewall = RUN.mg_firewall;
  const H1 = NC.skillHelpers || {};
  // skills.js's explode(): everything within r is pushed 300 and hit; here a dome of fire
  const boom = (game, p, id, x, y, r, big) => {
    EF.blast(game, x, y, r, { shake: big ? 10 : 6, tongues: big ? 8 : 5, sparks: big ? 18 : 12 });
    V.decal(x, y, r * 0.9, 'scorch', 3);
    for (const e of H1.around(game, x, y, r)) {
      const a = NC.angle(x, y, e.x, e.y);
      H1.strike(game, p, id, e, Math.cos(a) * 300, Math.sin(a) * 300 * 0.7, { color: '255,160,80', big });
    }
  };
  RUN.fireball = function (game, p, lv) {
    if (!EF.live() || !H1.strike || !H1.tip || !H1.fireAim) return OLD.fireball.apply(this, arguments);
    H1.pose(game, p, 'bolt1', 0.28);
    // skills.js's path (fireAim): it settles onto the aim line, a monster already on the staff is burst on at once
    const launch = H1.fireAim(p);
    V.at(0.08, () => {
      const { sx, sy, a, burst, steer, solid } = launch(game), v = 900, c = Math.cos(a), s = Math.sin(a);
      EF.pop(sx, sy, 40);
      if (burst) { boom(game, p, 'fireball', burst[0], burst[1], 125, false); return; }
      const ball = FX.add({
        type: 'vproj', layer: 'glow', x: sx, y: sy, vx: c * v, vy: s * v, life: 0.8,
        update(q) {
          steer(q, v);
          if (Math.random() < 0.3) V.smoke(q.x - c * 50, q.y - s * 50, 1, '#6a5a60', '#8a7a80', { size: 0.5, lifeK: 0.5, rise: 40, a: 0.6 });
          for (const e of game.enemies)
            if (alive(e) && NC.dist(q.x, q.y, e.x, e.y - 50) < 40 + e.r) { q.dead = true; return; }
          if (solid(q)) q.dead = true;
        },
        draw(ctx, q) { V.glow(ctx, q.x, q.y, 80, FIRE, 0.55, true); EF.drawBall(ctx, q.x, q.y, Math.atan2(q.vy, q.vx), 0.5, false, q.t); },
        onEnd(q) { boom(game, p, 'fireball', q.x, q.y + 40, 125, false); },
      });
      V.light(sx, sy, 300, FIRE, 0.9, 0.8, { follow: ball, flick: true });
    });
  };
  // a flame standing on the wall (fades in and out with it)
  FX.def('em_wallflame', (ctx, q) => {
    const a = Math.min(1, q.t / 0.18, (q.life - q.t) / 0.35), grow = Math.min(1, 0.3 + q.t / 0.25);
    const h = q.h * grow * (1 + 0.07 * Math.sin(q.t * 9 + q.ph));
    EF.flameLoop(ctx, q.x, q.y, h * 0.5, h, q.t * 15 + q.ph * 5, a, q.v);
  }, 'glow');
  RUN.mg_firewall = function (game, p, lv) {
    if (!EF.live()) return OLD.mg_firewall.apply(this, arguments);
    castPose(game, p, 0.35);
    const [cx, cy] = K.ground(game, p, 320), a = p.aim + Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a) * V.SQ, half = 170;
    const push = [Math.cos(p.aim), Math.sin(p.aim)], life = 5.2;
    V.light(cx, cy - 40, 520, FIRE, 1, life, { flick: true });
    // the strip of lava along the wall, laid on the ground (the sheet is drawn from above: turned, then squashed)
    ground({
      type: 'em_ground', x: cx, y: cy, life,
      paint(ctx, part) {
        const t = this.t, al = Math.min(1, t / 0.15, (this.life - t) / 0.4), grow = Math.min(1, 0.25 + t / 0.25);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, V.SQ);
        ctx.rotate(a);
        ctx.scale(grow, 1);
        blit(ctx, 'wall', Math.floor(t * FPS) % 12, 0, 0, half / 180, { part: part === 'glow' ? 'glow' : undefined, a: al });
        ctx.restore();
      },
    });
    // a row of flames on it, from the back row to the front (drawn in that order)
    const spots = [];
    for (let i = 0; i < 9; i++) { const k = -0.95 + (1.9 * i) / 8; spots.push([cx + dx * half * k + rand(-6, 6), cy + dy * half * k + rand(-4, 4)]); }
    spots.sort((u, w) => u[1] - w[1]).forEach(([x, y], i) => V.at(i * 0.025, () => FX.add({ type: 'em_wallflame', x, y, h: rand(130, 170), v: i % 3, ph: rand(0, 12), life: life - i * 0.025 })));
    let acc = 0;
    FX.add({
      type: 'timer', layer: 'none', life: 5,
      update(z, dt) {
        if (Math.random() < dt * 6) { const k = rand(-1, 1); EF.tongue(cx + dx * half * k, cy + dy * half * k, rand(80, 120)); }
        if (Math.random() < dt * 4) V.smoke(cx + dx * half * rand(-1, 1), cy - 120, 1, '#5a4a52', '#7a6a70', { size: 0.8, lifeK: 1, rise: 50, a: 0.55 });
        if ((acc += dt) < 0.3) return;
        acc -= 0.3;
        for (const e of game.enemies) {
          if (!K.alive(e)) continue;
          const vx = e.x - cx, vy = e.y - cy, along = vx * dx + vy * dy, side = Math.abs(vx * -dy + vy * dx);
          if (Math.abs(along) < half + e.r && side < 46 + e.r) {
            const f = Math.sign(vx * push[0] + vy * push[1]) || 1;
            K.hit(game, p, 'mg_firewall', e, push[0] * 260 * f, push[1] * 200 * f, '255,160,80');
          }
        }
      },
    });
    V.flash('255,140,60', 0.1, 0.3);
  };

  // the Mage's ultimate in its fire form (มหาเวทธาตุ = อุกกาบาตถล่ม, skills.js RUN.meteor; the user: "revoke meteor ด้วย"):
  // the same rocks on the same paths and the same blasts (r 150, push 300, big hits), drawn as lava rocks in their fire
  // and landing in a dome of fire; a fire band on the ground instead of the red magic circle
  OLD.meteor = RUN.meteor;
  const H2 = NC.skillHelpers || {};
  const lerp = NC.lerp || ((a, b, k) => a + (b - a) * k);
  const mageMeteor = (game, p, id, x, y, delay) => V.at(delay, () => {
    const sx = x + 420, sy = y - 1050, dur = 0.62, ang = Math.atan2(y - 30 - sy, x - sx);
    const bx = -Math.cos(ang), by = -Math.sin(ang);
    const mark = V.mark(x, y, 110, '255,110,50', dur);
    FX.add({
      type: 'vproj', layer: 'glow', x: sx, y: sy, life: dur,
      update(q) {
        const k = Math.pow(q.t / dur, 2.2); // (seen coming, then fast)
        q.x = lerp(sx, x, k); q.y = lerp(sy, y - 30, k);
        if (Math.random() < 0.45) V.smoke(q.x + bx * 110, q.y + by * 110, 1, '#4a3a42', '#6a5a60', { size: 0.9, lifeK: 0.8, rise: 20, a: 0.7 });
        if (Math.random() < 0.5) V.motes(q.x, q.y, 1, FIRE, { rise: 60, spread: 26, lifeK: 0.7 });
      },
      draw(ctx, q) { V.glow(ctx, q.x, q.y, 130, FIRE, 0.7, true); EF.drawBall(ctx, q.x, q.y, ang, 0.95, true, q.t); },
      onEnd() {
        EF.blast(game, x, y, 145, { shake: 10, tongues: 7, sparks: 18, flash: '255,120,40' });
        V.decal(x, y, 135, 'scorch', 3);
        V.debris(x, y - 10, 8, V.PAL.rock, { size: 1, max: 520 });
        mark.dead = true;
        for (const e of (H2.around || K.around)(game, x, y, 150)) {
          const a = NC.angle(x, y, e.x, e.y);
          H2.strike(game, p, id, e, Math.cos(a) * 300, Math.sin(a) * 300 * 0.7, { color: '255,160,80', big: true });
        }
      },
    });
  });
  RUN.meteor = function (game, p, lv) {
    const S = NC.SKILLS && NC.SKILLS.meteor;
    if (!EF.live() || !H2.strike || !H2.ground || (S && S.form && S.form(p) !== 'fire')) return OLD.meteor.apply(this, arguments);
    H2.pose(game, p, 'cheer', 0.9);
    const [tx, ty] = H2.ground(game, p, 440), n = S.n(lv);
    V.flash('110,20,0', 0.25, 3.2, 'source-over');
    const R = 340, t0 = game.time;
    EF.band({ x: tx, y: ty }, () => R * Math.min(1, 0.55 + (game.time - t0) * 1.5), [1], 3.2);
    V.light(tx, ty - 40, 560, FIRE, 0.8, 3.2, { flick: true });
    V.every(2.6, 26, () => V.motes(tx + rand(-300, 300), ty + rand(-160, 160), 1, FIRE, { rise: 160, spread: 10 }));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 280;
      mageMeteor(game, p, 'meteor', tx + Math.cos(a) * d, ty + Math.sin(a) * d * 0.6, 0.5 + (i / Math.max(1, n - 1)) * 2.1);
    }
  };

  // อุกกาบาตถล่มของจอมเวทไฟ: everything a size up on the Mage's (the user: "มันต้องดูอลังการกว่า"): a deeper red sky, two
  // bands of fire and a lava pool where they fall, bigger rocks (white-hot at 100 heat), domes of 200, and the giant one
  // at 100 heat: a long fall onto a shadow, a hit-stop, a shockwave and a crater of lava left burning
  RUN.fm_meteor = function (game, p, lv) {
    if (!live('fm_meteor', this, arguments)) return;
    castPose(game, p, 0.4);
    const H = HEAT(), [tx, ty] = K.ground(game, p, 520), big = H.v >= 100, sc = scale(p, 'fm_meteor'), R = 360 * sc, t0 = game.time;
    const ir = NC.FM_METEOR_IR || 160, life = big ? 4.2 : 3.6;
    V.flash('70,8,0', 0.34, life, 'source-over');
    EF.band({ x: tx, y: ty }, () => R * Math.min(1, 0.5 + (game.time - t0) * 1.6), [1, 0.62], life);
    EF.pool(tx, ty, 150 * sc, life);
    V.light(tx, ty - 60, 760, FIRE, 0.9, life, { flick: true });
    V.every(life - 0.4, 40, () => V.motes(tx + rand(-R, R), ty + rand(-R, R) * V.SQ, 1, FIRE, { rise: 200, spread: 10 }));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; V.at(0.05 + i * 0.02, () => EF.tongue(tx + Math.cos(a) * R, ty + Math.sin(a) * R * V.SQ, rand(80, 120))); }
    const hot = (k) => (ctx, q) => { if (big) V.glow(ctx, q.x, q.y, 110 * k, '255,240,200', 0.55, true); EF.drawBall(ctx, q.x, q.y, Math.atan2(q.vy || 0, q.vx || 1), k, true, q.t); };
    K.rain(game, p, 'fm_meteor', tx, ty, 300, 8, 2.6, { rgb: FIRE, ir, fall: 0.45, color: '255,170,90', status: ['burn', 4], look: hot(1.15), spot: NC.fmMeteorSpot && NC.fmMeteorSpot(game, tx, ty),
      land(x, y) {
        EF.blast(game, x, y, ir * 1.25, { shake: 6, tongues: 5, sparks: 14, smoke: true });
        V.decal(x, y, ir * 0.9, 'scorch', 4);
        V.debris(x, y - 10, 6, V.PAL.rock, { size: 1, max: 560 });
      } });
    if (big) {
      V.at(2.3, () => V.mark(tx, ty, 250, '255,110,50', 1.35));
      V.at(2.9, () => K.rain(game, p, 'fm_meteor', tx, ty, 1, 1, 0.01, { rgb: FIRE, ir: 240, fall: 0.75, from: [200, -1150], mul: 3.2, look: hot(2.6), color: '255,150,70',
        land(x, y) {
          V.stop(game, 0.1);
          EF.blast(game, x, y, 400, { shake: 16, flash: '255,210,140', tongues: 22, sparks: 36 });
          V.ring(x, y, 40, 560, 26, '255,170,80', 0.6);
          V.ring(x, y, 20, 420, 10, '255,240,190', 0.45);
          EF.pool(x, y, 280 * sc, 3);
          V.decal(x, y, 300, 'scorch', 5);
          V.debris(x, y - 10, 16, V.PAL.rock, { size: 1.3, max: 820 });
        } }));
    }
    shout(p, big ? 'อุกกาบาตยักษ์!' : 'อุกกาบาตถล่ม!', '#ffb070');
  };
})();
