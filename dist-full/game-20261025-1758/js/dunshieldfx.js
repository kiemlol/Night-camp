/* dunshieldfx.js — the bat king, the ant queen and the crypt lord in the BLOOD-SHIELD recipe (2026-10-15, the user: "มังกรโอเค
   ทำราชาค้างคาว นางพญามด ราชาสุสาน ด้วยสูตรโล่เลือดเหมือนกันเลย", after js/lavadragonfx.js). Frames by tools/dunboss_fx.py (the Fire
   Mage's builders re-coloured per boss + a shadow bat, a crescent slash and a red eye in the same recipe): assets/vfx2d/
   batking (shadow violet), antqueen (acid green), antdirt (earth: the slam's dust dome), cryptlord (ghost blue). This file
   only plays them where js/dunbosses.js's fight happens:
     ราชาค้างคาว   danger circle / lane of shadow, crescent wing slashes along the swoop, the screech's ring + shadow bats
                  flying out, pops; RAGE: the cave goes dark but its red eyes, three waves of shadow bats
     นางพญามด     danger circle of acid, acid globs flying, pools of acid (in / ooze / out), the slam a dome of dust and
                  rocks with acid pops, dirt pops where the ants come up; RAGE: rings of dust domes and acid pops
     ราชาสุสาน     danger circle of ghost fire, ghost fireballs, the rain: ghost fire falling onto each circle and a pillar
                  of ghost fire bursting up, ghost flames where the skeletons rise; RAGE: a cold screen, pillars all round
   MIXED (the user, seeing the recipe's shadow bat: "อันนี้ไม่สวยเลย ... ต้องผสมอะไรยังไง" -> "ผสม"): the ENERGY is the recipe
   (bands, pools, domes, ghost fire, pops, licks, the crescent slash), the CREATURES and OBJECTS are the Codex paintings of
   js/dunbossfx.js (assets/dunfx: the shadow bat, the acid glob, the rocks, the ghost orb with its face, the bony hands),
   drawn plain - only moved, turned, squashed.
   The plain FX they ask for: puff -> pop (dust drawn by code dropped), ring -> the boss's band spreading, ember -> a lick /
   a pop. Only looks: the fight is the one the game server knows. Takes a boss over from js/dunbossfx.js once its sheets
   are in (NC.ShieldFX.on = false: the painted look). Load after js/lavadragonfx.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (!FX || !NC.DUNGEON_BOSSES) return;
  const SF = (NC.ShieldFX = { on: true, bloom: 0.35 });
  const TAU = Math.PI * 2, FPS = 15;
  const SH = {
    ring: { w: 512, h: 300, cols: 6, n: 12, ax: 256, ay: 150 },
    sea: { w: 576, h: 340, cols: 6, n: 22, ax: 288, ay: 170 },
    wall: { w: 448, h: 128, cols: 6, n: 12, ax: 224, ay: 64 },
    ball: { w: 384, h: 384, cols: 8, n: 16, ax: 236, ay: 192 },
    blast: { w: 448, h: 448, cols: 7, n: 14, ax: 224, ay: 340, back: true },
    pop: { w: 192, h: 192, cols: 8, n: 8, ax: 96, ay: 96 },
    tongue: { w: 160, h: 256, cols: 10, n: 30, ax: 80, ay: 240 },
    pillar: { w: 256, h: 512, cols: 7, n: 14, ax: 128, ay: 470 },
    bat: { w: 256, h: 176, cols: 8, n: 8, ax: 128, ay: 96 },
    slash: { w: 256, h: 256, cols: 8, n: 8, ax: 128, ay: 128 },
    glint: { w: 96, h: 96, cols: 6, n: 6, ax: 48, ay: 48 },
  };
  const KITS = {
    bat: { dir: 'batking', names: ['ring', 'sea', 'wall', 'pop', 'slash', 'glint'] },
    ant: { dir: 'antqueen', names: ['ring', 'sea', 'ball', 'pop', 'tongue'] },
    dirt: { dir: 'antdirt', names: ['blast', 'pop'] },
    crypt: { dir: 'cryptlord', names: ['ring', 'sea', 'ball', 'pop', 'tongue', 'pillar'] },
  };
  const BOSS = { bat_king: 'bat', ant_queen: 'ant', crypt_lord: 'crypt' };
  const load = (src) => { const im = new Image(); im.src = src; return im; };
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  const IMG = {};
  for (const [k, K] of Object.entries(KITS)) {
    IMG[k] = {};
    for (const n of K.names) {
      const base = 'assets/vfx2d/' + K.dir + '/' + n;
      IMG[k][n] = load(base + '.webp'); IMG[k][n + '_glow'] = load(base + '_glow.webp');
      if (SH[n].back) IMG[k][n + '_back'] = load(base + '_back.webp');
    }
  }
  const ready = (k) => !!IMG[k] && Object.values(IMG[k]).every(ok);
  // the Codex paintings each one's creatures and objects come from (assets/dunfx, merged by js/dunbossfx.js)
  const PICS = { bat: ['dfx_bat_bat'], ant: ['dfx_ant_glob', 'dfx_ant_rocks'], crypt: ['dfx_crypt_orb', 'dfx_crypt_hands'] };
  const SPR = (n) => { const s = NC.SPR[n]; return s && s.img ? s : null; };
  SF.live = (k) => SF.on && ready(k) && (k !== 'ant' || ready('dirt')) && (PICS[k] || []).every(SPR);
  const kitOf = (e) => { const k = e && BOSS[e.type]; return k && SF.live(k) ? k : null; };
  const ease = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const loopF = (t, n) => ((Math.floor(t * FPS) % n) + n) % n;
  const oneShot = (q, n) => Math.min(n - 1, Math.floor((Math.max(0, q.t) / q.life) * n));

  // frame f of kit k's sheet `name` with its anchor at (x, y), scaled s. o: part ('glow' / 'back'), flip, rot, a
  function blit(ctx, k, name, f, x, y, s, o) {
    o = o || {};
    const S = SH[name], glow = o.part === 'glow';
    const img = IMG[k] && IMG[k][name + (glow ? '_glow' : o.part === 'back' ? '_back' : '')];
    if (!ok(img) || s <= 0) return;
    const fw = glow ? S.w / 2 : S.w, fh = glow ? S.h / 2 : S.h;
    f = Math.max(0, Math.min(S.n - 1, f | 0));
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= SF.bloom * (o.glowK || 1); }
    if (o.a !== undefined) ctx.globalAlpha *= Math.max(0, Math.min(1, o.a));
    ctx.drawImage(img, (f % S.cols) * fw, Math.floor(f / S.cols) * fh, fw, fh, -S.ax * s, -S.ay * s, S.w * s, S.h * s);
    ctx.restore();
  }
  const both = (ctx, k, name, f, x, y, s, o) => { blit(ctx, k, name, f, x, y, s, o); blit(ctx, k, name, f, x, y, s, Object.assign({}, o, { part: 'glow' })); };
  // a Codex painting centred on (x, y) (o.ay 1: standing on y), w wide (its own aspect), o: rot, flip, a, sy (a squash)
  function pic(ctx, n, x, y, w, o) {
    const S = SPR(n);
    if (!S || w <= 0) return;
    o = o || {};
    const h = w * (S.img.height / S.img.width) * (o.sy || 1);
    ctx.save();
    if (o.a !== undefined) ctx.globalAlpha *= Math.max(0, Math.min(1, o.a));
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(S.img, -w / 2, o.ay ? -h : -h / 2, w, h);
    ctx.restore();
  }

  // the ground pieces are drawn under the characters ('low'): their bloom waits for 'glow'
  const GQ = [];
  let gq = null;
  FX.def('sf_gq', (ctx) => { for (const f of GQ) f(ctx); GQ.length = 0; }, 'glow');
  const baseAdd = FX.add;
  const add = (p) => baseAdd.call(FX, p);
  const glowLater = (f) => { if (!gq || !FX.list.includes(gq)) gq = add({ type: 'sf_gq', x: 0, y: 0, life: 1e9 }); GQ.push(f); };

  // ---------------- dunbosses.js's helpers ----------------
  const PAINT = {
    warn(ctx, p, u) { // the boss's band round a pool filling from the middle
      const k = p._sf, beat = 0.88 + 0.12 * Math.sin(p.t * 18), kf = (p.r / 270) * (0.2 + 0.8 * ease(u)), ff = 5 + loopF(p.t, 12), fr = loopF(p.t, 12), kr = p.r / 220;
      blit(ctx, k, 'sea', ff, p.x, p.y, kf, { a: 0.78 * beat });
      blit(ctx, k, 'ring', fr, p.x, p.y, kr, { a: 0.95 });
      glowLater((c) => { blit(c, k, 'ring', fr, p.x, p.y, kr, { part: 'glow' }); blit(c, k, 'sea', ff, p.x, p.y, kf, { part: 'glow', a: 0.6 }); });
    },
    lane(ctx, p, u) { // a strip of the boss's stuff along the attack, filling from the boss outwards
      const k = p._sf;
      if (!IMG[k].wall) return;
      const s = SH.wall, f = loopF(p.t, 12), W = p.w * 1.7, kk = Math.max(0.04, ease(u)), beat = 0.88 + 0.12 * Math.sin(p.t * 18);
      const draw = (c, glow, a, fill) => {
        const im = IMG[k][glow ? 'wall_glow' : 'wall'], fw = glow ? s.w / 2 : s.w, fh = glow ? s.h / 2 : s.h;
        if (!ok(im)) return;
        c.save(); c.translate(p.x, p.y); c.scale(1, 0.62); c.rotate(p.ang);
        c.beginPath(); c.rect(0, -W, p.len * fill, W * 2); c.clip();
        if (glow) { c.globalCompositeOperation = 'lighter'; c.globalAlpha *= SF.bloom; }
        c.globalAlpha *= a;
        c.drawImage(im, (f % s.cols) * fw, Math.floor(f / s.cols) * fh, fw, fh, 0, -W / 2, p.len, W);
        c.restore();
      };
      draw(ctx, false, 0.3 * beat, 1);
      draw(ctx, false, 0.95 * beat, kk);
      glowLater((c) => draw(c, true, 0.9, kk));
    },
    orb(ctx, c) { // (paintings) the acid glob points the way it flies, wobbling; the ghost orb keeps its face up
      const a = Math.atan2(c.vy, c.vx);
      if (c._sf === 'ant') { pic(ctx, 'dfx_ant_glob', c.x, c.y, c.R * 2.7, { rot: a, sy: 1 + 0.08 * Math.sin(c.t * 22) }); return; }
      const w = c.R * 3.3, left = c.vx < 0;
      pic(ctx, 'dfx_crypt_orb', c.x - Math.cos(a) * w * 0.16, c.y - Math.sin(a) * w * 0.16, w, { rot: left ? a - Math.PI : a, flip: left });
    },
    puddle(ctx, c) { // a pool of acid: spreads in, oozes, sinks away
      const k = c._sf, S = (c.R * 1.1) / 270, tin = c.t, tout = c.life - c.t;
      const f = tin < 0.33 ? Math.min(4, Math.floor((tin / 0.33) * 5)) : tout < 0.33 ? 17 + Math.min(4, Math.floor((1 - tout / 0.33) * 5)) : 5 + loopF(c.t, 12);
      blit(ctx, k, 'sea', f, c.x, c.y, S, { a: 0.95 });
      glowLater((g) => blit(g, k, 'sea', f, c.x, c.y, S, { part: 'glow', a: 0.7 }));
    },
  };

  // ---------------- the pieces ----------------
  FX.def('sf_pop', (ctx, q) => { if (q.t >= 0) both(ctx, q.kit, 'pop', oneShot(q, 8), q.x, q.y, q.k); }, 'glow');
  FX.def('sf_tongue', (ctx, q) => { if (q.t >= 0) both(ctx, q.kit, 'tongue', q.v * 10 + oneShot(q, 10), q.x, q.y, q.k, { flip: q.flip }); }, 'glow');
  FX.def('sf_ring', (ctx, q, u) => {
    if (q.t < 0) return;
    const r = NC.lerp(q.r0, q.r1, ease(u)), big = q.r1 > 300;
    both(ctx, q.kit, 'ring', loopF(q.t, 12), q.x, q.y, r / 220, { a: (big ? 0.6 : 0.95) * Math.pow(1 - u, 1.4) });
  }, 'glow');
  FX.def('sf_blast', (ctx, q) => { if (q.t >= 0) both(ctx, q.kit, 'blast', oneShot(q, 14), q.x, q.y, q.k); }, 'glow');
  FX.def('sf_blast_back', (ctx, q) => { if (q.t >= 0) blit(ctx, q.kit, 'blast', oneShot(q, 14), q.x, q.y, q.k, { part: 'back' }); }, 'low');
  FX.def('sf_pillar', (ctx, q) => { if (q.t >= 0) both(ctx, q.kit, 'pillar', oneShot(q, 14), q.x, q.y, q.k); }, 'glow');
  // (the painting of a shadow bat; the flap is a squash)
  FX.def('sf_bat', (ctx, q, u) => { if (q.t >= 0) pic(ctx, 'dfx_bat_bat', q.x, q.y, 130 * q.k * (0.8 + 0.3 * u), { a: 1 - u * u, flip: q.vx < 0, sy: 0.8 + 0.25 * Math.sin(q.t * 34 + q.ph) }); }, 'glow');
  // a painting bursting up out of the ground and sinking back (rocks, bony hands), standing among the characters
  FX.def('sf_stand', (ctx, q, u) => {
    if (q.t < 0) return;
    const up = ease(q.t / 0.12), down = u > 0.7 ? (u - 0.7) / 0.3 : 0;
    pic(ctx, q.pic, q.x, q.y, q.w * up, { ay: 1, flip: q.flip, a: 1 - down, sy: 0.6 + 0.4 * (1 - down) });
  }, 'sorted');
  FX.def('sf_slash', (ctx, q) => { if (q.t >= 0) both(ctx, 'bat', 'slash', oneShot(q, 8), q.x, q.y, q.k, { rot: q.ang }); }, 'glow');
  // ghost fire falling straight down onto (x, y) over its life (then a pillar bursts up there)
  FX.def('sf_fall', (ctx, q) => {
    if (q.t < 0) return;
    const u = Math.min(1, q.t / q.life), w = 1 - u * u;
    both(ctx, 'crypt', 'ball', loopF(q.t, 8), q.x, q.y - 40 - 560 * w, q.k, { rot: Math.PI / 2, a: Math.min(1, q.t / 0.06) });
  }, 'glow');

  const pop = (kit, x, y, k, delay) => add({ type: 'sf_pop', kit, x, y, k, life: 8 / FPS, t0: delay || 0 });
  const tongue = (kit, x, y, k, delay) => add({ type: 'sf_tongue', kit, x, y, k, v: (Math.random() * 3) | 0, flip: Math.random() < 0.5, life: 10 / FPS, t0: delay || 0 });
  function blast(kit, x, y, r, delay) {
    const k = (r * 0.8) / 130, life = 14 / FPS, t0 = delay || 0;
    add({ type: 'sf_blast_back', kit, x, y, k, life, t0 });
    add({ type: 'sf_blast', kit, x, y, k, life, t0 });
  }
  const pillar = (x, y, k, delay) => add({ type: 'sf_pillar', kit: 'crypt', x, y, k, life: 14 / FPS, t0: delay || 0 });
  const stand = (n, x, y, w, delay) => add({ type: 'sf_stand', pic: n, x, y, w, life: 0.9, t0: delay || 0, flip: Math.random() < 0.5 });
  // (landings timed on the game clock: the crypt's falls -> a pillar, the ant's rage domes)
  const LANDS = [];
  function fall(game, x, y, wait, k) {
    const lead = Math.min(wait, 0.3);
    add({ type: 'sf_fall', x, y, k: k || 0.7, life: Math.max(0.05, lead), t0: wait - lead });
    LANDS.push({ x, y, at: game.time + wait, kind: 'pillar', k: (k || 0.7) * 0.9 });
  }

  // ---------------- the plain FX a boss asks for ----------------
  const DUST = /^(160,140,130|215,218,230|160,140,190)$/;
  const greenish = (rgb) => { const c = String(rgb || '').split(',').map(Number); return c[1] > c[0] && c[1] > c[2]; };
  const none = (p) => { p.type = 'sf_none'; p.life = 0; };
  let cur = null;
  function convert(p, k, e) {
    p.kit = k;
    if (p.type === 'puff') {
      const dust = DUST.test(p.color || '');
      if (k === 'ant' && dust) { if (Math.random() < 0.5) none(p); else { p.type = 'sf_pop'; p.kit = 'dirt'; p.k = 0.4; p.life = 8 / FPS; p.vx = p.vy = 0; p.layer = 'glow'; } return; }
      if (dust || (k === 'ant' && !greenish(p.color) && p.color)) return none(p);
      p.type = 'sf_pop'; p.k = Math.max(0.25, (p.r1 || 36) / 90); p.life = 8 / FPS; p.vx = p.vy = 0; p.layer = 'glow';
    } else if (p.type === 'ring') {
      p.type = 'sf_ring'; p.layer = 'glow'; p.life = Math.max(p.life, 0.5);
    } else if (p.type === 'ember') {
      e._sfE = (e._sfE || 0) + 1;
      if (k === 'crypt' && e._sfE % 2 === 0) { p.type = 'sf_tongue'; p.y += 30; p.vx = p.vy = 0; p.k = 0.4 + Math.random() * 0.2; p.v = (Math.random() * 3) | 0; p.flip = Math.random() < 0.5; p.life = 10 / FPS; }
      else if (k !== 'crypt' && e._sfE % 2 === 0) { p.type = 'sf_pop'; p.k = 0.3; p.vx = p.vy = 0; p.life = 8 / FPS; }
      else none(p);
      p.layer = 'glow';
    }
  }
  FX.add = function (p) {
    if (p) {
      const e = p.dun ? p.owner : cur, k = kitOf(e);
      if (k) {
        if (p.dun) {
          if (PAINT[p.dun]) { p._sf = k; p._ph = Math.random(); p.draw = PAINT[p.dun]; }
          if (p.dun === 'orb') { // (its hit puff and pool are the boss's; an acid glob ends in a pop)
            const up = p.update, end = p.onEnd;
            p.update = function () { const o = cur; cur = e; try { return up && up.apply(this, arguments); } finally { cur = o; } };
            p.onEnd = function (c, g) { const o = cur; cur = e; try { if (k === 'ant') pop('ant', c.x, c.y, 0.55); return end && end.apply(this, arguments); } finally { cur = o; } };
          }
        } else convert(p, k, e);
      }
    }
    return baseAdd.call(this, p);
  };

  // ---------------- while one of the three updates ----------------
  const BAT_EYES = [[-32, -97], [-53, -97]]; // (on assets/monsters/bat_king.png pose A)
  function extras(game, e, k, s0, d0, r0, dt) {
    const z = e.z || 0;
    if (!r0 && e.raged && e.awake) rage(game, e, k);
    if (k === 'bat') {
      if (s0 === 'screech' && !d0 && e.done) for (let i = 0; i < 9; i++) { // shadow bats burst out of the screech
        const a = (i / 9) * TAU + NC.rand(-0.2, 0.2), sp = NC.rand(420, 620);
        add({ type: 'sf_bat', x: e.x, y: e.y - 60 - z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.62, drag: 1.2, life: NC.rand(0.6, 0.85), k: 0.85, ph: Math.random() * 8 });
      }
      if (e.state === 'swoop' && e.t >= e.wind) { // crescent wing slashes along the swoop
        e._sfW = (e._sfW || 0) - dt;
        if (e._sfW <= 0) { e._sfW = 0.1; add({ type: 'sf_slash', x: e.x, y: e.y - z - 50, ang: Math.atan2(Math.sin(e.ang) * 0.62, Math.cos(e.ang)), k: 0.75, life: 8 / FPS }); }
      }
    }
    if (k === 'ant' && s0 === 'slam' && !d0 && (e.state !== 'slam' || e.done)) { // a dome of dust, acid popping round it
      blast('dirt', e.x, e.y, 240);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.random() * 0.5, r = 170 + Math.random() * 60; pop('ant', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.58 - 20, 0.7, 0.1 + Math.random() * 0.15); }
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + Math.random() * 0.4, r = 120 + Math.random() * 90; stand('dfx_ant_rocks', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.58, 90 + Math.random() * 50, 0.05 + Math.random() * 0.1); }
    }
    if (k === 'crypt' && e.state === 'rain' && e.spots && e.spots !== e._sfSpots) { // ghost fire falls onto each circle
      e._sfSpots = e.spots;
      for (const q of e.spots) fall(game, q.x, q.y + 4, Math.max(0, q.at - e.t), 0.6);
    }
    if (s0 === 'summon' && !d0 && e.done) for (const m of game.enemies) if (m.owner === e && !m._sf) { // the minions come up
      m._sf = true;
      if (k === 'ant') { pop('dirt', m.x, m.y - 20, 0.8); stand('dfx_ant_rocks', m.x, m.y + 4, 80); }
      else if (k === 'crypt') { stand('dfx_crypt_hands', m.x, m.y + 4, 95); for (let i = 0; i < 2; i++) tongue('crypt', m.x + NC.rand(-34, 34), m.y + 6, 0.45, 0.05 + i * 0.06); }
      else pop('bat', m.x, m.y - 30, 0.6);
    }
  }
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    const k = kitOf(e);
    if (!k) return baseUpdate.apply(this, arguments);
    const s0 = e.state, d0 = e.done, r0 = e.raged, o = cur;
    cur = e;
    let out;
    try { out = baseUpdate.apply(this, arguments); } finally { cur = o; }
    extras(game, e, k, s0, d0, r0, dt);
    return out;
  };
  const baseUpd = FX.update;
  FX.update = function (dt, game) {
    const r = baseUpd.apply(this, arguments);
    if (LANDS.length && game) for (let i = LANDS.length - 1; i >= 0; i--) if (game.time >= LANDS[i].at) {
      const q = LANDS.splice(i, 1)[0];
      if (q.kind === 'pillar') { pillar(q.x, q.y, q.k); pop('crypt', q.x, q.y - 20, 0.6); }
      else if (q.kind === 'dirt') { blast('dirt', q.x, q.y, q.r); pop('ant', q.x, q.y - 20, 0.6, 0.12); stand('dfx_ant_rocks', q.x + NC.rand(-30, 30), q.y + 6, 70 + Math.random() * 40, 0.05); game.shake = Math.max(game.shake || 0, 6); }
    }
    return r;
  };

  // ---------------- the rage ----------------
  FX.def('sf_rage', (ctx, q) => {
    const env = Math.min(1, q.t / 0.35, (q.life - q.t) / 0.6);
    if (env <= 0.003) return;
    const tint = (rgb, a, mode) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = mode || 'source-over'; ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); };
    if (q.kit === 'bat') {
      tint('6,3,14', 0.78 * env);
      const e = q.owner;
      if (e && !e.dead) for (const [dx, dy] of BAT_EYES) both(ctx, 'bat', 'glint', loopF(q.t, 6), e.x + (e.face > 0 ? -dx : dx), e.y - (e.z || 0) + dy, 0.32, { a: env });
    } else if (q.kit === 'crypt') {
      tint('40,110,190', 0.32 * env, 'multiply'); tint('90,170,255', 0.12 * env, 'lighter');
    }
  }, 'glow');
  function rage(game, e, k) {
    const v = { x: game.cam.x, y: game.cam.y, w: game.vw, h: game.vh }, p = game.player;
    add({ type: 'sf_rage', kit: k, owner: e, life: k === 'bat' ? 3.2 : 2.8 });
    game.shake = Math.max(game.shake || 0, 22);
    if (NC.GLFX && NC.GLFX.zoom) NC.GLFX.zoom(e.x, e.y - 80, 0.06, 0.45);
    const spot = (fx, fy, r) => { // (somewhere on the floor, not in the pits)
      let x = fx(), y = fy();
      for (let i = 0; i < 12 && !game.world.fits(x, y, r || 20); i++) { x = fx(); y = fy(); }
      return [x, y];
    };
    if (k === 'bat') { // three waves of shadow bats across the dark
      for (let w = 0; w < 3; w++) for (let i = 0; i < 14; i++) {
        const dir = w % 2 ? -1 : 1, y = v.y + NC.rand(0.1, 0.9) * v.h, x = dir > 0 ? v.x - NC.rand(40, 300) : v.x + v.w + NC.rand(40, 300);
        add({ type: 'sf_bat', x, y, vx: dir * NC.rand(700, 1000), vy: NC.rand(-80, 80), life: NC.rand(1.4, 1.9), t0: 0.3 + w * 0.7 + Math.random() * 0.3, k: NC.rand(0.9, 1.5), ph: Math.random() * 8 });
      }
    } else if (k === 'ant') { // rings of dust domes, acid popping between them
      blast('dirt', e.x, e.y, 300);
      for (let ring = 0; ring < 3; ring++) {
        const n = 6 + ring * 3, r = 240 + ring * 170;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + Math.random() * 0.3, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.58;
          if (!game.world.fits(x, y, 10)) continue;
          LANDS.push({ x, y, r: NC.rand(70, 100), kind: 'dirt', at: game.time + 0.15 + ring * 0.25 + Math.random() * 0.1 });
        }
      }
    } else if (k === 'crypt') { // ghost fire falling all round the hero, then pillars
      for (let i = 0; i < 14; i++) {
        const [x, y] = spot(() => p.x + NC.rand(-0.46, 0.46) * v.w, () => p.y + NC.rand(-0.4, 0.4) * v.h * 0.8);
        fall(game, x, y, 0.35 + (i % 7) * 0.13 + (i >= 7 ? 0.9 : 0) + Math.random() * 0.1, NC.rand(0.7, 1));
      }
    }
  }
  SF.rage = (e) => { const k = kitOf(e); if (k && NC.game) rage(NC.game, e, k); };
})();
