/* skills.js — every job's skills (Q E R and the ultimate F) and the boss sets' ultimates: what they do and how they
   look. Each skill: a pose (anim.js), the hits (stats.js NC.heroHit through NC.damageEnemy) and its effects, put
   together from vfx.js in the game's style: toon shapes with the dark outline, glows, lights at night, flashes.
   entities.js calls NC.castSkill (SP, cooldown) and NC.updateSkills (buffs, channels). */
(function () {
  'use strict';
  const NC = window.NC;
  const FX = NC.FX, V = NC.VFX, SK = NC.SKILLS;
  const TAU = Math.PI * 2;
  const rand = NC.rand, clamp = NC.clamp, lerp = NC.lerp;
  const P = V.PAL, C = V.RGB;

  // ---------------- helpers ----------------
  const lvOf = (p, id) => NC.skillLv(p, id);
  const bestKind = (p) => { const d = p.d, a = d.batk + (d.watk[0] + d.watk[1]) / 2, m = (d.matk[0] + d.matk[1]) / 2; return m > a ? 'magic' : 'phys'; };
  const weaponElement = (p) => (p.buffs && p.buffs.fireblade > 0 ? 'fire' : p.d.atkElement);
  // the ground point the hero aims at (the mouse, up to maxD away; else ahead)
  const ground = (game, p, maxD) => {
    if (game.mouse.active) {
      const dx = game.mouse.wx - p.x, dy = game.mouse.wy - p.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, maxD / d);
      return [p.x + dx * k, p.y + dy * k];
    }
    return [p.x + Math.cos(p.aim) * maxD * 0.85, p.y + Math.sin(p.aim) * maxD * 0.6];
  };
  const within = (e, x, y, r) => (e.x - x) ** 2 + ((e.y - y) / 0.62) ** 2 < (r + e.r) ** 2;
  const alive = (e) => !e.dead && e.hp > 0;
  const around = (game, x, y, r) => game.enemies.filter((e) => alive(e) && within(e, x, y, r));
  const nearest = (game, x, y, r, n, dir, cone) => game.enemies
    .filter((e) => alive(e) && NC.dist(x, y, e.x, e.y) < r && (!dir || Math.abs(Math.atan2(Math.sin(NC.angle(x, y, e.x, e.y) - dir), Math.cos(NC.angle(x, y, e.x, e.y) - dir))) < cone))
    .sort((a, b) => NC.dist(x, y, a.x, a.y) - NC.dist(x, y, b.x, b.y)).slice(0, n || 99);
  // a skill's hit on one monster (knockback kx, ky; o: damage-number options; extra: NC.heroHit options)
  const strike = (game, p, id, e, kx, ky, o, extra) => {
    if (!alive(e)) return null;
    const S = SK[id], kind = S.type === 'best' ? bestKind(p) : S.type === 'buff' ? 'phys' : S.type;
    const r = NC.heroHit(p.d, e, Object.assign({ kind, mul: S.mul(lvOf(p, id)), skill: true, sid: id, element: S.element || weaponElement(p), hitBonus: 10, sure: !!S.ult }, extra || {})); // sid: the skill (line resonance, skilltree.js)
    NC.damageEnemy(game, e, r, kx || 0, ky || 0, o || {});
    return r;
  };
  const push = (from, e, f) => { const a = NC.angle(from[0], from[1], e.x, e.y); return [Math.cos(a) * f, Math.sin(a) * f * 0.7]; };
  // the hero's pose for a skill (no basic attacks meanwhile, slowed)
  const pose = (game, p, clip, lock) => {
    if (p.noPose) return; // (a spell cast by itself off a basic hit: the swing goes on)
    if (clip && NC.Anim.CLIPS[clip]) NC.Anim.play(p.anim, clip);
    p.atk.on = false;
    p.skillLock = Math.max(p.skillLock || 0, lock || 0.35);
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    p.combat = 1; p.lastFight = game.time;
  };
  const hand = (p) => { const L = p.pose && NC.weaponLine(p.equip, p.pose, p.x, p.y); return L ? L.hand : [p.x + p.face * 30, p.y - 80]; };
  const tip = (p) => { const L = p.pose && NC.weaponLine(p.equip, p.pose, p.x, p.y); return L ? L.tip : [p.x + p.face * 60, p.y - 90]; };
  NC.skillHelpers = { ground, around, nearest, strike, pose, hand, tip, within };

  // a generic projectile: its own draw and update (dies when it hits or runs out)
  FX.def('vproj', (ctx, p, u) => p.draw(ctx, p, u), 'glow');
  const proj = (o) => FX.add(Object.assign({ type: 'vproj', layer: o.layer || 'glow' }, o));

  // ---------------- casting ----------------
  NC.castSkill = function (game, p, key) {
    const id = NC.skillForKey(p, key);
    if (!id || !RUN[id]) return false;
    if (!p.buffs) p.buffs = {};
    const S = SK[id], lv = lvOf(p, id), cost = S.sp(lv);
    if (p.cd[key] > 0) return false;
    if (p.sp < cost) {
      if (game.time - (p.noSpT || -9) > 1) { p.noSpT = game.time; FX.num(p.x, p.y - 170, 'SP ไม่พอ', { fill: '#8fc8ff', size: 30 }); NC.HUD.log('SP ไม่พอสำหรับ ' + S.name, 'warn'); }
      return false;
    }
    p.sp -= cost;
    p.cd[key] = p.cdFull[key] = S.cd * (1 - p.d.cdr);
    if (S.ult) V.flash('255,255,255', 0.08, 0.2);
    RUN[id](game, p, lv, key);
    return true;
  };

  // buffs (guard, fireblade, shadow) and channels (the rogue's flurry, the archer's charge): ticked every frame
  NC.updateSkills = function (game, dt) {
    const p = game.player;
    p.skillLock = Math.max(0, (p.skillLock || 0) - dt);
    if (!p.buffs) p.buffs = {};
    for (const k in p.buffs) p.buffs[k] = Math.max(0, p.buffs[k] - dt);
    // the burning blade: flames licking along the weapon
    if (p.buffs.fireblade > 0 && p.pose && Math.random() < dt * 34) {
      const L = NC.weaponLine(p.equip, p.pose, p.x, p.y);
      if (L) {
        const k = rand(0.3, 1), x = lerp(L.base[0], L.tip[0], k), y = lerp(L.base[1], L.tip[1], k);
        V.flameAt(x, y + 6, rand(10, 16), rand(18, 30), P.fire, rand(0.25, 0.4), { vy: -60 });
        if (Math.random() < 0.3) V.motes(x, y, 1, C.fire, { rise: 90, spread: 6, size: 0.7 });
      }
    }
    // shadow step's sure critical: dark wisps rising around the hero
    if (p.buffs.shadow > 0 && Math.random() < dt * 14) V.motes(p.x + rand(-26, 26), p.y - rand(10, 110), 1, C.shadow, { rise: 70, spread: 4, size: 1 });
    if (p.channel) {
      p.channel.t += dt;
      p.channel.update(game, p, p.channel, dt);
      if (p.channel && p.channel.t >= p.channel.dur) { const c = p.channel; p.channel = null; if (c.end) c.end(game, p, c); }
    }
  };

  // ---------------- the skills ----------------
  const RUN = (NC.SKILL_RUN = {});

  // ======== traveler ========
  // Q: a golden circle, then a ring of swirling golden clouds bursts out
  RUN.q = function (game, p, lv) {
    pose(game, p, 'stormB3', 0.55);
    V.circle(p.x, p.y, 250, C.gold, 1.2, { style: 'holy', spin: 1.4, grow: true, follow: p });
    V.gather(p.x, p.y - 70, 18, C.gold, 170, 0.38);
    V.light(p.x, p.y - 40, 380, C.gold, 0.7, 1.1, { follow: p });
    V.at(0.4, () => {
      const R = 215;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        FX.cloud(p.x + Math.cos(a) * R, p.y - 30 + Math.sin(a) * R * 0.62, 42, i * 0.018, 1.0);
        V.glowAt(p.x + Math.cos(a) * R, p.y - 30 + Math.sin(a) * R * 0.62, 20, 90, C.gold, 0.55, 0.6);
      }
      V.ring(p.x, p.y, 40, 320, 16, C.gold, 0.55);
      V.ring(p.x, p.y, 20, 230, 7, '255,250,220', 0.4);
      V.glowAt(p.x, p.y - 40, 60, 260, C.gold, 0.6, 0.4, { hot: true });
      V.flare(p.x, p.y - 70, 150, C.gold, 0.35);
      V.light(p.x, p.y - 30, 560, C.gold, 1, 0.9);
      V.stars(p.x, p.y - 60, 16, '#ffd35c', C.gold, { speed: 460 });
      V.motes(p.x, p.y - 20, 22, C.gold, { spread: 220, rise: 180 });
      V.flash('255,235,160', 0.16, 0.35);
      V.shake(game, 9);
      for (const e of around(game, p.x, p.y, 275)) { const k = push([p.x, p.y], e, 430); strike(game, p, 'q', e, k[0], k[1], { big: true, color: '255,220,120' }); }
    });
  };

  // E: a dash of wind and leaves (the dash itself: entities.js p.dash; these are its looks)
  const LEAF = ['#9fdc6a', '#6cc35a', '#c9f08a', '#e6ffb0'];
  const leaf = (x, y, vx, vy, life) => FX.add({ type: 'leaf', layer: 'glow', x, y, vx, vy, drag: 1.4, life: life || rand(0.6, 1.1), rot: rand(0, TAU), spin: rand(-9, 9), ph: rand(0, 6), color: NC.pick(LEAF) });
  RUN.e = function (game, p, lv) {
    const I = game.input;
    let dx = I.mx, dy = I.my;
    if (!dx && !dy) { dx = Math.cos(p.aim); dy = Math.sin(p.aim); }
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const dur = 0.17, dist = 340;
    p.inv = Math.max(p.inv, dur + 0.1);
    if (Math.abs(dx) > 0.1) p.face = dx > 0 ? 1 : -1;
    const x0 = p.x, y0 = p.y;
    V.ring(p.x, p.y, 20, 130, 8, C.wind, 0.35);
    V.smoke(p.x, p.y - 10, 5, '#d7f2c8', '#ffffff', { size: 0.8, lifeK: 0.6 });
    for (let i = 0; i < 10; i++) leaf(p.x, p.y - rand(20, 90), rand(-160, 160), rand(-200, 40));
    V.light(p.x, p.y - 60, 300, C.wind, 0.8, 0.6, { follow: p });
    p.dash = {
      t: 0, dur, vx: (dx * dist) / dur, vy: (dy * dist) / dur, ghost: 0, hit: new Set(),
      hitFn(game, e) {
        strike(game, p, 'e', e, dx * 170, dy * 170, { color: '150,255,130' });
        V.slash(e.x, e.y - 60, 60, Math.atan2(dy, dx) - 0.6, 1.8, 18, P.wind, 0.22);
        for (let i = 0; i < 5; i++) leaf(e.x, e.y - 60, rand(-220, 220), rand(-240, 60));
      },
      tick(game, p, d, dt) {
        if (Math.random() < 0.9) FX.add({ type: 'vstreak', x: p.x + rand(-30, 30), y: p.y - rand(20, 120), vx: -d.vx * 0.12, vy: -d.vy * 0.12, len: rand(40, 90), w: 3, rgb: C.wind, life: 0.25 });
        if (Math.random() < 0.7) leaf(p.x + rand(-20, 20), p.y - rand(20, 110), -d.vx * 0.15 + rand(-80, 80), -d.vy * 0.15 + rand(-120, 40));
      },
      end(game, p) {
        V.ring(p.x, p.y, 20, 170, 10, C.wind, 0.4);
        for (let i = 0; i < 14; i++) leaf(p.x, p.y - rand(20, 100), rand(-260, 260), rand(-280, 60));
        V.stars(p.x, p.y - 55, 8, '#c9f08a', C.wind, { speed: 300, size: 0.8 });
        FX.add({ type: 'cutline', x: x0, y: y0 - 55, x1: p.x, y1: p.y - 55, w: 14, color: C.wind, life: 0.3 });
      },
    };
  };

  // R: ice spikes erupt all round, shards fly out, frost on the ground
  RUN.r = function (game, p, lv) {
    pose(game, p, 'bolt3', 0.5);
    V.decal(p.x, p.y, 230, 'frost', 2.2);
    V.gather(p.x, p.y - 70, 14, C.ice, 150, 0.32);
    V.light(p.x, p.y - 40, 420, C.ice, 0.8, 1.2, { follow: p });
    V.at(0.32, () => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + rand(-0.1, 0.1), d = rand(95, 150);
        V.spikeAt(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.62, rand(26, 38), rand(60, 105), P.ice, rand(0.9, 1.2), { glowA: 0.35, rgb: C.ice, rise: 0.09 });
      }
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + 0.1;
        FX.add({
          type: 'shard', x: p.x, y: p.y - 45, vx: Math.cos(a) * 820, vy: Math.sin(a) * 820 * 0.72, life: 0.45, hit: new Set(),
          update(s) {
            for (const e of game.enemies)
              if (!s.hit.has(e) && alive(e) && NC.dist(s.x, s.y, e.x, e.y - 40) < 42 + e.r) {
                s.hit.add(e);
                e.slow = Math.max(e.slow, 2.6);
                strike(game, p, 'r', e, s.vx * 0.2, s.vy * 0.2, { color: '170,225,255' }, { flat: 20 * lv });
                V.sparks(s.x, s.y, 5, C.ice, { size: 0.7 });
              }
          },
        });
      }
      V.ring(p.x, p.y, 30, 260, 12, C.ice, 0.45);
      V.glowAt(p.x, p.y - 40, 50, 230, C.ice, 0.6, 0.4, { hot: true });
      V.flare(p.x, p.y - 60, 150, C.ice, 0.32);
      V.smoke(p.x, p.y - 10, 10, '#e6f6ff', '#ffffff', { size: 1.1, max: 220, lifeK: 0.8, a: 0.8 });
      V.motes(p.x, p.y - 40, 24, C.ice, { spread: 200, rise: 90, rise0: 10 });
      V.flash('190,230,255', 0.14, 0.3);
      V.shake(game, 7);
    });
  };

  // F: stars fall from the sky onto the enemies around
  const fallingStar = (game, p, id, x, y, delay, o) => V.at(delay, () => {
    const sx = x + 280, sy = y - 900, dur = 0.42;
    V.decal(x, y, 60, 'crack', 0.9, { rgb: C.gold, n: 6, a: 0 });
    proj({
      x: sx, y: sy, life: dur, trail: [],
      update(q) {
        const k = V.easeIn(q.t / dur);
        q.x = lerp(sx, x, k); q.y = lerp(sy, y - 20, k);
        q.trail.push([q.x, q.y]); if (q.trail.length > 10) q.trail.shift();
        if (Math.random() < 0.6) V.motes(q.x, q.y, 1, C.gold, { rise: 20, spread: 6, lifeK: 0.5 });
      },
      draw(ctx, q) {
        for (let i = 1; i < q.trail.length; i++) {
          const a = q.trail[i - 1], b = q.trail[i], k = i / q.trail.length;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          ctx.strokeStyle = `rgba(${C.gold},${0.5 * k})`; ctx.lineWidth = 26 * k; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,240,${0.8 * k})`; ctx.lineWidth = 8 * k; ctx.stroke();
          ctx.restore();
        }
        V.glow(ctx, q.x, q.y, 70, C.gold, 0.9, true);
        V.star(ctx, q.x, q.y, 26, q.t * 9, '#ffd35c', 1);
      },
      onEnd() {
        V.ring(x, y, 20, 150, 10, C.gold, 0.4);
        V.glowAt(x, y - 20, 30, 150, C.gold, 0.9, 0.35, { hot: true });
        V.stars(x, y - 30, 7, '#ffe68a', C.gold, { speed: 300, size: 0.8 });
        V.sparks(x, y - 20, 10, C.gold);
        V.light(x, y - 20, 260, C.gold, 0.9, 0.5);
        V.shake(game, 4);
        for (const e of around(game, x, y, 95)) strike(game, p, id, e, 0, -60, { color: '255,220,120' });
      },
    });
  });
  RUN.starfall = function (game, p, lv) {
    pose(game, p, 'cheer', 0.9);
    V.flash('10,14,40', 0.3, 2.6, 'source-over');
    V.circle(p.x, p.y, 330, C.gold, 2.8, { style: 'holy', spin: 0.9, grow: true });
    V.light(p.x, p.y - 60, 500, C.gold, 0.6, 2.8, { follow: p });
    V.gather(p.x, p.y - 120, 24, C.gold, 220, 0.5);
    const foes = around(game, p.x, p.y, 480);
    for (let i = 0; i < 12; i++) {
      const e = foes.length ? foes[i % foes.length] : null;
      const a = rand(0, TAU), d = rand(60, 380);
      const x = e ? e.x + rand(-30, 30) : p.x + Math.cos(a) * d, y = e ? e.y + rand(-15, 15) : p.y + Math.sin(a) * d * 0.62;
      fallingStar(game, p, 'starfall', x, y, 0.35 + i * 0.15);
    }
  };

  // ======== knight ========
  // Q: a great golden slash, an impact star, the ground cracks; stuns
  RUN.bash = function (game, p, lv) {
    pose(game, p, 'swing3', 0.5);
    const a = p.aim, c = Math.cos(a), s = Math.sin(a);
    V.glowAt(hand(p)[0], hand(p)[1], 20, 90, C.gold, 0.8, 0.3, { follow: null });
    V.gather(p.x + c * 30, p.y - 80, 10, C.gold, 110, 0.26);
    V.at(0.28, () => {
      const ix = p.x + c * 170, iy = p.y - 20 + s * 110;
      V.slash(p.x + c * 10, p.y - 70, 170, a, 2.7, 52, P.gold, 0.34, { dir: p.face, rgb: C.gold });
      // the impact: a star of light
      V.flare(ix, iy - 40, 170, C.gold, 0.34);
      V.glowAt(ix, iy - 40, 40, 170, C.gold, 0.8, 0.35, { hot: true });
      V.sparks(ix, iy - 40, 18, '255,235,180', { ang: a, spread: 1.1, max: 900 });
      V.decal(ix, iy, 120, 'crack', 1.6, { rgb: C.gold, n: 9 });
      V.smoke(ix, iy, 6, '#cbbfae', '#efe6d8', { size: 0.9, lifeK: 0.7 });
      V.ring(ix, iy, 20, 170, 10, C.gold, 0.35);
      V.light(ix, iy - 40, 360, C.gold, 1, 0.5);
      V.shake(game, 11); V.stop(game, 0.07);
      for (const e of nearest(game, p.x, p.y - 20, 230, 99, a, 1.05)) {
        strike(game, p, 'bash', e, c * 420, s * 300, { big: true, color: '255,230,160' });
        NC.statusEnemy(game, e, 'stun', 1.2);
      }
    });
  };

  // E: a ring of fire bursts from the slammed sword; the blade keeps burning
  RUN.magnum = function (game, p, lv) {
    pose(game, p, 'smash3', 0.6);
    V.gather(p.x, p.y - 70, 14, C.fire, 150, 0.34);
    V.light(p.x, p.y - 50, 300, C.fire, 0.7, 0.6, { follow: p });
    V.at(0.36, () => {
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU + rand(-0.08, 0.08), d = rand(40, 90), sp = rand(380, 560);
        V.flameAt(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.62, rand(34, 50), rand(70, 120), P.fire, rand(0.45, 0.65), { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.62, drag: 3.6 });
      }
      for (let i = 0; i < 8; i++) V.flameAt(p.x + rand(-40, 40), p.y + rand(-10, 20), rand(50, 70), rand(130, 190), P.fire, rand(0.5, 0.7), { vy: -80 });
      V.glowAt(p.x, p.y - 40, 60, 320, C.fire, 1, 0.5, { hot: true });
      V.ring(p.x, p.y, 40, 300, 20, C.fire, 0.5, { col: '#ff8a3a' });
      V.ring(p.x, p.y, 20, 210, 8, '255,230,140', 0.35);
      V.smoke(p.x, p.y - 10, 12, '#5a4a52', '#7a6a70', { size: 1.2, max: 260, lifeK: 1, a: 0.85 });
      V.motes(p.x, p.y - 20, 30, C.fire, { spread: 260, rise: 220 });
      V.decal(p.x, p.y, 230, 'scorch', 3.5);
      V.light(p.x, p.y - 30, 640, C.fire, 1, 1.0, { flick: true });
      V.flash('255,150,60', 0.2, 0.35);
      V.shake(game, 12); V.stop(game, 0.05);
      for (const e of around(game, p.x, p.y, 250)) { const k = push([p.x, p.y], e, 460); strike(game, p, 'magnum', e, k[0], k[1], { big: true, color: '255,160,80' }); }
      p.buffs.fireblade = 8;
    });
  };

  // R: a dome of holy light (less damage taken)
  FX.def('vdome', (ctx, q, u) => {
    const p = q.follow, a = V.fade(u, 0.06, 0.12), pulse = q.hitT ? Math.max(0, 1 - (q.t - q.hitT) / 0.3) : 0;
    V.glow(ctx, p.x, p.y - 70, 150, C.holy, 0.25 * a + 0.4 * pulse, false);
    V.dome(ctx, p.x, p.y - 20, 92 + pulse * 10, 118 + pulse * 12, C.holy, a, q.t);
  }, 'glow');
  RUN.guard = function (game, p, lv) {
    pose(game, p, 'cheer', 0.35);
    const S = SK.guard, dur = S.dur(lv);
    p.buffs.guard = dur; p.guardRed = S.red(lv);
    p.guardFx = FX.add({ type: 'vdome', follow: p, x: p.x, y: p.y, life: dur });
    V.circle(p.x, p.y, 130, C.holy, dur, { style: 'holy', spin: 1.6, follow: p, a: 0.8 });
    V.beam(p.x, p.y, 120, 520, C.holy, 0.6);
    V.ring(p.x, p.y, 30, 200, 12, C.holy, 0.4);
    V.stars(p.x, p.y - 80, 12, '#ffe68a', C.holy, { speed: 260 });
    V.light(p.x, p.y - 60, 320, C.holy, 0.7, dur, { follow: p });
    V.flash('255,240,190', 0.12, 0.3);
  };
  // a hit taken under the dome: it ripples
  NC.guardHit = function (game, p) {
    if (p.guardFx) p.guardFx.hitT = p.guardFx.t;
    V.sparks(p.x, p.y - 80, 8, C.holy, { size: 0.8 });
    V.ring(p.x, p.y - 10, 60, 130, 6, C.holy, 0.25);
  };

  // F: a giant sword of light falls from the sky
  FX.def('vsword', (ctx, q, u) => {
    const fall = q.fall, t = q.t;
    let y, a = 1;
    if (t < fall) y = lerp(q.y - 1150, q.y + 30, V.easeIn(t / fall));
    else { y = q.y + 30; a = 1 - clamp((t - fall - 0.55) / 0.45, 0, 1); }
    if (a <= 0) return;
    V.glow(ctx, q.x, y - 230, 260, C.holy, 0.6 * a, false);
    if (t < fall) { // the column of light it leaves behind
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, y - 900, 0, y - 200);
      g.addColorStop(0, `rgba(${C.holy},0)`); g.addColorStop(1, `rgba(${C.holy},0.35)`);
      ctx.fillStyle = g; ctx.fillRect(q.x - 40, y - 900, 80, 700);
      ctx.restore();
    }
    V.lightSword(ctx, q.x, y, 470, 70, a);
  }, 'glow');
  FX.def('vrays', (ctx, q, u) => {
    const a = V.fade(u, 0.1, 0.5) * (q.a || 1);
    ctx.save();
    ctx.translate(q.x, q.y); ctx.scale(1, V.SQ);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < q.n; i++) {
      const ang = (i / q.n) * TAU + q.t * (q.spin || 0.6);
      ctx.save(); ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, 0, q.r, 0);
      g.addColorStop(0, `rgba(${q.rgb},${0.55 * a})`); g.addColorStop(1, `rgba(${q.rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(q.r, -q.w); ctx.lineTo(q.r, q.w); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }, 'low');
  RUN.judgment = function (game, p, lv) {
    pose(game, p, 'stormS3', 0.8);
    const [tx, ty] = ground(game, p, 380), fall = 0.5;
    V.circle(tx, ty, 300, C.holy, 1.8, { style: 'holy', spin: 1.1, grow: true });
    FX.add({ type: 'vrays', x: tx, y: ty, r: 380, w: 26, n: 10, rgb: C.holy, spin: 0.8, life: 1.8 });
    V.gather(tx, ty - 60, 24, C.holy, 280, 0.5);
    V.light(tx, ty - 40, 500, C.holy, 0.8, 1.9);
    FX.add({ type: 'vsword', x: tx, y: ty, fall, life: fall + 1.0 });
    V.at(fall, () => {
      V.flash('255,248,215', 0.3, 0.4);
      V.shake(game, 18); V.stop(game, 0.12);
      V.ring(tx, ty, 40, 420, 24, C.holy, 0.6);
      V.ring(tx, ty, 20, 280, 10, '255,255,240', 0.45);
      V.glowAt(tx, ty - 60, 80, 380, C.holy, 0.85, 0.55, { hot: true });
      V.flare(tx, ty - 80, 320, C.holy, 0.5, { spin: 0.8 });
      V.decal(tx, ty, 300, 'crack', 3, { rgb: C.holy, n: 14 });
      V.debris(tx, ty - 10, 16, P.rock, { size: 1.1, max: 640 });
      V.smoke(tx, ty - 10, 16, '#cfc3b2', '#f2eadc', { size: 1.5, max: 420, lifeK: 1.1 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; V.beam(tx + Math.cos(a) * 190, ty + Math.sin(a) * 190 * 0.6, 46, 400, C.holy, 0.55, { a: 0.7 }); }
      V.sparks(tx, ty - 40, 32, C.holy, { max: 1000 });
      V.stars(tx, ty - 60, 14, '#ffe68a', C.holy, { speed: 520 });
      V.light(tx, ty - 40, 820, C.holy, 1, 1.1);
      for (const e of around(game, tx, ty, 310)) { const k = push([tx, ty], e, 520); strike(game, p, 'judgment', e, k[0], k[1], { big: true, color: '255,240,190' }); NC.statusEnemy(game, e, 'stun', 1); }
    });
  };

  // ======== mage ========
  // Q: a fireball that explodes
  const explode = (game, p, id, x, y, r, big) => {
    const k = big ? 1.4 : 1;
    for (let i = 0; i < 14 * k; i++) {
      const a = rand(0, TAU), sp = rand(200, 460) * k;
      V.flameAt(x + Math.cos(a) * 20, y + Math.sin(a) * 12, rand(28, 44) * k, rand(50, 90) * k, P.fire, rand(0.35, 0.55), { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 60, drag: 4 });
    }
    V.glowAt(x, y - 30, 40, 220 * k, C.fire, 1, 0.4, { hot: true });
    V.ring(x, y, 20, r * 1.25, 14 * k, C.fire, 0.4, { col: '#ff8a3a' });
    V.ring(x, y, 10, r * 0.9, 6, '255,235,150', 0.3);
    V.smoke(x, y - 20, 8 * k, '#5a4a52', '#7a6a70', { size: 1 * k, max: 200 * k, lifeK: 0.9, a: 0.85 });
    V.motes(x, y - 20, 14 * k, C.fire, { spread: 90 * k, rise: 200 });
    V.decal(x, y, r * 0.9, 'scorch', 3);
    V.light(x, y - 30, 380 * k, C.fire, 1, 0.6, { flick: true });
    V.shake(game, big ? 10 : 6);
    for (const e of around(game, x, y, r)) { const kk = push([x, y], e, 300); strike(game, p, id, e, kk[0], kk[1], { color: '255,160,80', big }); }
  };
  // ลูกไฟ's path (2026-10-18): the ball still leaves the staff tip (up to ~100 px above and ahead of the hero), but it
  // settles onto the hero's aim line (chest -> where it was aimed, the aim taken at the cast), so it reaches what it was
  // cast at; and a monster already between the chest and the tip (close, or overlapping the hero) is burst on at once
  // instead of flown past. It used to fly beside the line from the tip: in auto-farm runs 20-34% of fireballs hit nothing
  // (monsters up or down the screen passed 40-60 px to the side, monsters too close passed over); now 1-2%. ?oldfb: the old path.
  // emberfx.js's ลูกไฟ uses the same (NC.skillHelpers.fireAim).
  const OLD_FB = false;
  const FB_SETTLE = 110; // the sideways gap to the aim line shrinks e-fold every 110 units flown
  // at the cast: launch(game) for the moment the ball leaves the staff -> { sx, sy, a, burst, steer(q, v), solid(q) }
  const fireAim = (p) => {
    const a0 = p.aim;
    return (game) => {
      const [sx, sy] = tip(p), a = OLD_FB ? p.aim : a0, c = Math.cos(a), s = Math.sin(a);
      const ox = p.x, oy = p.y - 50, dx = sx - ox, dy = sy - oy, L2 = dx * dx + dy * dy || 1;
      let burst = null, hu = 2;
      if (!OLD_FB)
        for (const e of game.enemies) {
          if (!alive(e)) continue;
          const ex = e.x - ox, ey = e.y - 50 - oy, along = ex * c + ey * s;
          if (along < -e.r) continue; // behind the hero
          const u = clamp((ex * dx + ey * dy) / L2, 0, 1); // its nearest point on the staff, the ball's reach from there
          if (Math.hypot(ex - dx * u, ey - dy * u) >= 40 + e.r || u >= hu) continue;
          // where a ball flying in bursts: on the hero's side of it (the blast pushes it away), never behind the chest
          const back = Math.min(40 + e.r, Math.max(0, along));
          hu = u; burst = [e.x - c * back, e.y - 10 - s * back];
        }
      return {
        sx, sy, a, burst,
        // its velocity (speed v) each frame: the sideways gap to the aim line closing
        steer(q, v) {
          const off = OLD_FB ? 0 : (q.y - oy) * c - (q.x - ox) * s, lat = clamp((-off * v) / FB_SETTLE, -0.6 * v, 0.6 * v), fw = Math.sqrt(v * v - lat * lat);
          q.vx = c * fw - s * lat; q.vy = s * fw + c * lat;
        },
        // a wall or rock in its way: the ground under the aim line (the tip stands over the hero, so the ground 60 below
        // the ball itself was the hero's back: a hero just south of a tree or fence lost the ball at the staff)
        solid(q) {
          if (!game.world.isSolid) return false;
          if (OLD_FB) return NC.shotWall(game.world, q.x, q.y + 60);
          const along = (q.x - ox) * c + (q.y - oy) * s;
          return NC.shotWall(game.world, ox + c * along, oy + s * along + 50);
        },
      };
    };
  };
  NC.skillHelpers.fireAim = fireAim;
  RUN.fireball = function (game, p, lv) {
    pose(game, p, 'bolt1', 0.28);
    const launch = fireAim(p);
    V.at(0.08, () => {
      const { sx, sy, a, burst, steer, solid } = launch(game), v = 900, c = Math.cos(a), s = Math.sin(a);
      V.ring(sx, sy, 6, 60, 6, C.fire, 0.25, { sq: 1 });
      V.glowAt(sx, sy, 10, 80, C.fire, 0.9, 0.25, { hot: true });
      if (burst) { explode(game, p, 'fireball', burst[0], burst[1], 125, false); return; } // a monster on the staff already
      const ball = proj({
        x: sx, y: sy, vx: c * v, vy: s * v, life: 0.8, spin: 0,
        update(q, dt) {
          steer(q, v);
          if (Math.random() < 0.8) V.flameAt(q.x - c * 18 + rand(-6, 6), q.y - s * 18 + rand(-6, 6) + 14, rand(16, 24), rand(26, 40), P.fire, rand(0.18, 0.28), { vx: -c * 120, vy: -s * 120 - 60 });
          if (Math.random() < 0.3) V.smoke(q.x - c * 30, q.y - s * 30, 1, '#6a5a60', '#8a7a80', { size: 0.5, lifeK: 0.5, rise: 40, a: 0.7 });
          for (const e of game.enemies)
            if (alive(e) && NC.dist(q.x, q.y, e.x, e.y - 50) < 40 + e.r) { q.dead = true; return; }
          if (solid(q)) q.dead = true;
        },
        draw(ctx, q) {
          V.glow(ctx, q.x, q.y, 90, C.fire, 0.9, true);
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.atan2(q.vy, q.vx) - Math.PI / 2);
          V.flame(ctx, 0, -22, 44, 82, q.t * 20, P.fire, 1); // the flame streams back
          ctx.restore();
          ctx.save();
          ctx.beginPath(); ctx.arc(q.x, q.y, 17, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
          ctx.fillStyle = '#ffd06a'; ctx.fill();
          ctx.beginPath(); ctx.arc(q.x - 4, q.y - 4, 8, 0, TAU); ctx.fillStyle = '#fff8e0'; ctx.fill();
          ctx.restore();
        },
        onEnd(q) { explode(game, p, 'fireball', q.x, q.y + 40, 125, false); },
      });
      V.light(sx, sy, 300, C.fire, 0.9, 0.8, { follow: ball, flick: true });
    });
  };

  // E: lightning strikes the nearest enemies, arcs jump between them
  RUN.thunder = function (game, p, lv) {
    pose(game, p, 'bolt2', 0.3);
    const S = SK.thunder, n = S.n(lv);
    const foes = nearest(game, p.x, p.y, 560, n);
    const spots = foes.length ? foes.map((e) => [e.x, e.y, e]) : [[...ground(game, p, 320), null]];
    V.glowAt(tip(p)[0], tip(p)[1], 10, 90, C.lightning, 1, 0.3, { hot: true });
    spots.forEach(([x, y, e], i) => V.at(0.08 + i * 0.09, () => {
      if (e && !alive(e)) return;
      const tx = e ? e.x : x, ty = e ? e.y : y;
      V.boltAt(tx + rand(-80, 80), ty - 760, tx, ty - 30, C.lightning, 0.3, { w: 8, jag: 46, seg: 14 });
      V.boltAt(tx + rand(-120, 120), ty - 700, tx, ty - 30, C.lightning, 0.22, { w: 3.5, jag: 60, seg: 12 });
      V.glowAt(tx, ty - 40, 30, 180, C.lightning, 0.85, 0.3, { hot: true });
      V.flare(tx, ty - 40, 120, C.lightning, 0.26);
      V.ring(tx, ty, 16, 140, 8, C.lightning, 0.3);
      V.sparks(tx, ty - 30, 16, C.lightning, { max: 820 });
      V.decal(tx, ty, 70, 'crack', 1.2, { rgb: C.lightning, n: 7 });
      V.light(tx, ty - 60, 420, C.lightning, 1, 0.35);
      V.flash('200,235,255', 0.14, 0.18);
      V.shake(game, 6);
      if (i > 0) { const [px, py, pe] = spots[i - 1]; V.boltAt(pe ? pe.x : px, (pe ? pe.y : py) - 60, tx, ty - 60, C.lightning, 0.2, { w: 3, jag: 26, seg: 8 }); }
      if (e) { strike(game, p, 'thunder', e, 0, 0, { color: '170,230,255' }); NC.statusEnemy(game, e, 'stun', 0.4); }
      else for (const f of around(game, tx, ty, 80)) strike(game, p, 'thunder', f, 0, 0, { color: '170,230,255' });
    }));
  };

  // R: a line of ice spikes along the ground; what it catches freezes
  RUN.frostdiver = function (game, p, lv) {
    pose(game, p, 'bolt1', 0.3);
    const a = p.aim, c = Math.cos(a), s = Math.sin(a), hit = new Set(), S = SK.frostdiver;
    V.glowAt(tip(p)[0], tip(p)[1], 10, 90, C.ice, 1, 0.3, { hot: true });
    for (let k = 0; k < 13; k++) V.at(0.06 + k * 0.03, () => {
      const d = 60 + k * 40, x = p.x + c * d, y = p.y + s * d * 0.7;
      for (let j = 0; j < 2 + (k % 2); j++) V.spikeAt(x + rand(-22, 22), y + rand(-12, 12), rand(26, 40), rand(58, 110), P.ice, rand(1, 1.3), { glowA: 0.35, rgb: C.ice, rise: 0.08, sink: false });
      V.decal(x, y, 60, 'frost', 2);
      V.motes(x, y - 20, 3, C.ice, { spread: 30, rise: 60 });
      V.light(x, y - 30, 220, C.ice, 0.7, 0.8);
      for (const e of around(game, x, y, 60))
        if (!hit.has(e)) { hit.add(e); strike(game, p, 'frostdiver', e, 0, 0, { color: '170,225,255' }); NC.statusEnemy(game, e, 'freeze', S.freeze(lv)); }
    });
    V.at(0.5, () => V.shake(game, 5));
  };

  // F: a red circle, the sky darkens, meteors rain down
  // a meteor: a burning rock with a comet's tail; a target closes in on the ground where it will land
  const meteorAt = (game, p, id, x, y, delay) => V.at(delay, () => {
    const sx = x + 420, sy = y - 1050, dur = 0.62, seed = Math.floor(rand(0, 9999)), ang = Math.atan2(y - 30 - sy, x - sx);
    const bx = -Math.cos(ang), by = -Math.sin(ang); // backwards along the fall
    const mark = V.mark(x, y, 110, '255,110,50', dur);
    proj({
      x: sx, y: sy, life: dur, trail: [],
      update(q) {
        const k = Math.pow(q.t / dur, 2.2); // seen coming, then fast
        q.x = lerp(sx, x, k); q.y = lerp(sy, y - 30, k);
        q.trail.push([q.x, q.y]); if (q.trail.length > 12) q.trail.shift();
        if (Math.random() < 0.75) V.flameAt(q.x + bx * 30 + rand(-16, 16), q.y + by * 30 + rand(-12, 12) + 26, rand(24, 36), rand(44, 70), P.fire, rand(0.18, 0.3), { vx: bx * 160 + rand(-40, 40), vy: by * 160 - 60 });
        if (Math.random() < 0.5) V.smoke(q.x + bx * 70, q.y + by * 70, 1, '#4a3a42', '#6a5a60', { size: 0.9, lifeK: 0.8, rise: 20, a: 0.7 });
        if (Math.random() < 0.5) V.motes(q.x, q.y, 1, C.fire, { rise: 60, spread: 26, lifeK: 0.7 });
      },
      draw(ctx, q) {
        // the tail: a burning streak tapering back along the path
        const T = q.trail;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (let i = 1; i < T.length; i++) {
          const k = i / T.length;
          ctx.beginPath(); ctx.moveTo(T[i - 1][0], T[i - 1][1]); ctx.lineTo(T[i][0], T[i][1]);
          ctx.strokeStyle = `rgba(255,120,40,${0.4 * k})`; ctx.lineWidth = 90 * k; ctx.stroke();
          ctx.strokeStyle = `rgba(255,220,140,${0.75 * k})`; ctx.lineWidth = 34 * k; ctx.stroke();
        }
        ctx.restore();
        V.glow(ctx, q.x, q.y, 150, C.fire, 1, true);
        // the head: flames wrapped round the rock, streaming back
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang - Math.PI / 2);
        V.flame(ctx, 0, 34, 104, 200, q.t * 22, P.fire, 1);
        ctx.restore();
        V.rock(ctx, q.x, q.y, 40, q.t * 7, seed, 1, '#ffd060');
      },
      onEnd() {
        explode(game, p, id, x, y, 150, true);
        V.flare(x, y - 40, 190, C.fire, 0.34);
        V.debris(x, y - 10, 8, P.rock, { size: 1, max: 520 });
        V.flash('255,120,40', 0.12, 0.2);
        mark.dead = true;
      },
    });
  });
  RUN.meteor = function (game, p, lv) {
    pose(game, p, 'cheer', 0.9);
    const [tx, ty] = ground(game, p, 440), n = SK.meteor.n(lv);
    V.flash('110,20,0', 0.25, 3.2, 'source-over');
    V.circle(tx, ty, 340, C.fire, 3.2, { style: 'arcane', spin: 0.9, grow: true });
    V.light(tx, ty - 40, 560, C.fire, 0.8, 3.2, { flick: true });
    V.every(2.6, 26, () => V.motes(tx + rand(-300, 300), ty + rand(-160, 160), 1, C.fire, { rise: 160, spread: 10 }));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 280;
      meteorAt(game, p, 'meteor', tx + Math.cos(a) * d, ty + Math.sin(a) * d * 0.6, 0.5 + (i / Math.max(1, n - 1)) * 2.1);
    }
  };

  // ======== archer ========
  // an arrow of light: the shaft, a glowing head, a ribbon of light behind
  const drawArrow = (ctx, q, rgb, scale, trail) => {
    const a = Math.atan2(q.vy, q.vx), k = scale || 1, L = trail || 180;
    ctx.save();
    ctx.translate(q.x, q.y); ctx.rotate(a); ctx.scale(k, k);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(-L, 0, 0, 0);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},0.75)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, -9); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
    const g2 = ctx.createLinearGradient(-L * 0.6, 0, 0, 0);
    g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(1, 'rgba(255,255,255,0.85)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(-L * 0.6, 0); ctx.lineTo(0, -2.5); ctx.lineTo(0, 2.5); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.strokeStyle = '#fff4d0'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(8, -8); ctx.lineTo(8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-28, -8); ctx.lineTo(-22, 0); ctx.lineTo(-28, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    V.glow(ctx, q.x, q.y, 50 * k, rgb, 0.8, true);
  };
  const shootArrow = (game, p, id, rgb, o) => {
    const [hx, hy] = hand(p), a = p.aim + (o.off || 0), v = o.v || 1500, c = Math.cos(a), s = Math.sin(a), hit = new Set();
    V.ring(hx, hy, 6, 50, 5, rgb, 0.22, { sq: 1 });
    V.glowAt(hx, hy, 10, 70, rgb, 0.9, 0.2, { hot: true });
    const q = proj({
      x: hx, y: hy, vx: c * v, vy: s * v, life: (o.range || 950) / v,
      update(q) {
        if (Math.random() < 0.5) V.motes(q.x, q.y, 1, rgb, { rise: 20, spread: 4, lifeK: 0.5, size: 0.8 });
        if (o.tick) o.tick(q);
        for (const e of game.enemies)
          if (!hit.has(e) && alive(e) && NC.dist(q.x, q.y, e.x, e.y - 50) < 34 + e.r) {
            hit.add(e);
            o.hit(e, q);
            if (!o.pierce) { q.dead = true; return; }
          }
        if (!o.pierce && game.world.isSolid && NC.shotWall(game.world, q.x, q.y + 60)) q.dead = true;
      },
      draw(ctx, q) { if (o.draw) o.draw(ctx, q); else drawArrow(ctx, q, rgb, o.scale, o.trail); },
    });
    V.light(hx, hy, 220, rgb, 0.7, q.life, { follow: q });
    return q;
  };
  RUN.double = function (game, p, lv) {
    pose(game, p, 'bow2', 0.3);
    for (const [t, off] of [[0.1, -0.03], [0.24, 0.03]]) V.at(t, () => shootArrow(game, p, 'double', C.gold, {
      off, scale: 1.3, trail: 280,
      hit(e, q) {
        strike(game, p, 'double', e, Math.cos(p.aim) * 160, Math.sin(p.aim) * 120, { color: '255,235,180' });
        V.sparks(q.x, q.y, 8, C.gold, { size: 0.8 });
        V.flare(q.x, q.y, 70, C.gold, 0.22);
        V.ring(q.x, q.y + 40, 10, 80, 5, C.gold, 0.25);
      },
    }));
  };
  // E: arrows up, then a rain of arrows onto the ground ahead
  FX.def('varrowin', (ctx, q, u) => {
    const a = u > 0.7 ? (1 - u) / 0.3 : 1;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(q.x, q.y); ctx.rotate(q.ang);
    ctx.lineCap = 'round';
    ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(2, 0); ctx.stroke();
    ctx.strokeStyle = '#a8764a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(2, 0); ctx.stroke();
    ctx.fillStyle = '#7fd67a'; ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(-26, -7); ctx.lineTo(-20, 0); ctx.lineTo(-26, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }, 'sorted');
  RUN.shower = function (game, p, lv) {
    pose(game, p, 'bow3', 0.6);
    const [tx, ty] = ground(game, p, 420);
    V.circle(tx, ty, 170, C.wind, 1.4, { style: 'arcane', spin: 1.8, grow: true });
    V.light(tx, ty - 20, 260, C.wind, 0.6, 1.4);
    V.at(0.2, () => {
      const [hx, hy] = hand(p);
      for (let i = 0; i < 6; i++) FX.add({ type: 'vstreak', x: hx + rand(-10, 10), y: hy, vx: rand(-60, 60), vy: -1800, len: 90, w: 4, rgb: C.wind, life: 0.3 });
      V.ring(hx, hy, 6, 50, 5, C.wind, 0.22, { sq: 1 });
    });
    const mul = SK.shower.mul(lv) * 0.6; // 20 arrows: each a little weaker than the old 12
    for (let i = 0; i < 20; i++) V.at(0.4 + i * 0.032, () => {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 150, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * 0.62;
      const sx = x + 70, sy = y - 760, dur = 0.16;
      proj({
        x: sx, y: sy, vx: (x - sx) / dur, vy: (y - sy) / dur, life: dur,
        draw(ctx, q) { drawArrow(ctx, q, C.wind, 1, 260); },
        onEnd() {
          FX.add({ type: 'varrowin', x, y: y - 16, sort: y, ang: Math.atan2(sy - y, sx - x) + Math.PI, life: 1.2 });
          V.flare(x, y - 12, 46, C.wind, 0.18);
          V.sparks(x, y - 10, 4, C.wind, { size: 0.6, max: 380 });
          V.smoke(x, y, 2, '#cbbfae', '#efe6d8', { size: 0.45, lifeK: 0.6 });
          V.ring(x, y, 6, 60, 4, C.wind, 0.25);
          for (const e of around(game, x, y, 55)) strike(game, p, 'shower', e, 0, 0, { color: '200,255,190' }, { mul });
        },
      });
    });
  };
  // R: an arrow wrapped in a wind vortex that pierces everything in its line
  RUN.gale = function (game, p, lv) {
    pose(game, p, 'bow3', 0.55);
    V.at(0.3, () => {
      const a = p.aim;
      V.ring(hand(p)[0], hand(p)[1], 10, 120, 10, C.wind, 0.35, { sq: 1 });
      V.smoke(hand(p)[0], hand(p)[1], 5, '#d7f2c8', '#ffffff', { size: 0.8, lifeK: 0.6 });
      V.shake(game, 6);
      shootArrow(game, p, 'gale', C.wind, {
        v: 1300, range: 1100, pierce: true, scale: 1.4,
        tick(q) {
          if (Math.random() < 0.8) leaf(q.x, q.y, -q.vx * 0.1 + rand(-80, 80), -q.vy * 0.1 + rand(-80, 80), rand(0.4, 0.7));
          if (Math.random() < 0.6) FX.add({ type: 'vstreak', x: q.x + rand(-20, 20), y: q.y + rand(-30, 30), vx: -q.vx * 0.2, vy: -q.vy * 0.2, len: 110, w: 3, rgb: C.wind, life: 0.3 });
        },
        draw(ctx, q) {
          // two ribbons of wind spiralling round the flight line
          const ang = Math.atan2(q.vy, q.vx), c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c;
          for (const ph of [0, Math.PI]) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i <= 24; i++) {
              const t = i / 24, back = t * 260, w = Math.sin(q.t * 30 + t * 9 + ph) * 26 * (1 - t * 0.5);
              const x = q.x - c * back + nx * w, y = q.y - s * back + ny * w;
              i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.strokeStyle = `rgba(${C.wind},0.55)`; ctx.lineWidth = 10; ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.stroke();
            ctx.restore();
          }
          drawArrow(ctx, q, C.wind, 1.4);
        },
        hit(e, q) {
          strike(game, p, 'gale', e, Math.cos(a) * 620, Math.sin(a) * 420, { big: true, color: '170,255,160' });
          V.smoke(e.x, e.y - 40, 3, '#d7f2c8', '#ffffff', { size: 0.7, lifeK: 0.6 });
          V.ring(e.x, e.y, 10, 110, 7, C.wind, 0.3);
        },
      });
    });
  };
  // F: charge, then a beam of starlight across the screen
  FX.def('vlaser', (ctx, q, u) => {
    const a = u < 0.1 ? u / 0.1 : 1 - Math.pow((u - 0.1) / 0.9, 1.4), w = q.w * (0.4 + 0.6 * a) * (1 + 0.06 * Math.sin(q.t * 60));
    const c = Math.cos(q.ang), s = Math.sin(q.ang), L = q.len * Math.min(1, u / 0.08);
    ctx.save();
    ctx.translate(q.x, q.y); ctx.rotate(q.ang);
    const bar = (k, col) => { ctx.beginPath(); ctx.moveTo(0, -w * k / 2); ctx.lineTo(L, -w * k * 0.35); ctx.lineTo(L + w * k * 0.4, 0); ctx.lineTo(L, w * k * 0.35); ctx.lineTo(0, w * k / 2); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    ctx.globalAlpha *= a;
    bar(1.18, NC.OUTLINE);
    bar(1, `rgb(${q.rgb})`);
    ctx.globalCompositeOperation = 'lighter';
    bar(2.2, `rgba(${q.rgb},0.25)`);
    bar(0.5, 'rgba(255,255,255,0.95)');
    // energy rings running along it
    for (let i = 0; i < 7; i++) {
      const x = ((q.t * 1800 + i * (L / 7)) % L);
      ctx.beginPath(); ctx.ellipse(x, 0, 10, w * 0.62, 0, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
    V.glow(ctx, q.x, q.y, w * 1.6, q.rgb, a, true);
    V.glow(ctx, q.x + c * L, q.y + s * L, w * 1.2, q.rgb, a * 0.8, true);
  }, 'glow');
  RUN.starshot = function (game, p, lv) {
    pose(game, p, 'bow3', 1.0);
    const charge = 0.7;
    p.channel = {
      t: 0, dur: charge,
      update(game, p, ch) {
        p.vx *= 0.8; p.vy *= 0.8;
        const [hx, hy] = hand(p);
        if (Math.random() < 0.8) V.gather(hx, hy, 1, NC.pick([C.gold, C.wind]), 170, 0.35);
        if (!ch.circle) {
          ch.circle = V.circle(hx + Math.cos(p.aim) * 50, hy + 40, 120, C.gold, charge + 0.2, { style: 'star', spin: 3, grow: true });
          ch.light = V.light(hx, hy, 300, C.gold, 1, charge + 0.2);
        }
        ch.light.x = hx; ch.light.y = hy;
      },
      end(game, p) {
        const [hx, hy] = hand(p), a = p.aim, c = Math.cos(a), s = Math.sin(a), len = 1300, W = 110;
        FX.add({ type: 'vlaser', x: hx, y: hy, ang: a, len, w: W, rgb: C.gold, life: 0.6 });
        V.ring(hx, hy, 10, 200, 14, C.gold, 0.4, { sq: 1 });
        V.ring(hx, hy, 10, 130, 8, '255,255,255', 0.3, { sq: 1 });
        V.flare(hx, hy, 200, C.gold, 0.4, { spin: 2 });
        V.flash('255,248,215', 0.35, 0.35);
        V.shake(game, 14); V.stop(game, 0.08);
        for (let k = 1; k <= 5; k++) V.light(hx + c * len * (k / 5), hy + s * len * (k / 5), 320, C.gold, 1, 0.6);
        V.every(0.35, 20, () => { const t = rand(0.05, 1); V.motes(hx + c * len * t, hy + s * len * t, 1, C.gold, { rise: 60, spread: 30, size: 1.2 }); });
        for (const e of game.enemies) {
          if (!alive(e)) continue;
          const dx = e.x - hx, dy = e.y - 50 - hy, along = dx * c + dy * s, side = Math.abs(-dx * s + dy * c);
          if (along > -20 && along < len && side < W / 2 + e.r + 20) {
            strike(game, p, 'starshot', e, c * 520, s * 380, { big: true, color: '255,240,190' });
            V.sparks(e.x, e.y - 50, 10, C.gold, { ang: a, spread: 0.7 });
          }
        }
      },
    };
    V.glowAt(hand(p)[0], hand(p)[1], 10, 120, C.gold, 1, charge, { follow: null, fin: 0.9, fout: 0.05, hot: true });
  };

  // ======== rogue ========
  // a drop of poison falling with gravity
  FX.def('vdrop', (ctx, q, u) => {
    const a = u > 0.7 ? (1 - u) / 0.3 : 1;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.moveTo(q.x, q.y - q.s * 1.4); ctx.quadraticCurveTo(q.x + q.s, q.y, q.x, q.y + q.s * 0.8); ctx.quadraticCurveTo(q.x - q.s, q.y, q.x, q.y - q.s * 1.4);
    ctx.lineWidth = 2.5; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.fillStyle = '#8ee05a'; ctx.fill();
    ctx.beginPath(); ctx.arc(q.x - q.s * 0.25, q.y - q.s * 0.1, q.s * 0.25, 0, TAU); ctx.fillStyle = '#e9ffb8'; ctx.fill();
    ctx.restore();
  }, 'glow');
  const drips = (x, y, n) => { for (let i = 0; i < n; i++) FX.add({ type: 'vdrop', x: x + rand(-30, 30), y: y + rand(-20, 20), vx: rand(-80, 80), vy: rand(-160, -40), grav: 900, s: rand(5, 8), life: rand(0.5, 0.8) }); };
  RUN.envenom = function (game, p, lv) {
    pose(game, p, 'iaiS2', 0.36);
    const a = p.aim, c = Math.cos(a), s = Math.sin(a);
    [[0.06, -0.55], [0.18, 0.55]].forEach(([t, off], i) => V.at(t, () => {
      V.slash(p.x + c * 40, p.y - 70, 120, a + off, 2.4, 32, P.poison, 0.3, { dir: i ? -p.face : p.face, rgb: C.poison });
      drips(p.x + c * 110, p.y - 70, 6);
      V.motes(p.x + c * 100, p.y - 70, 5, C.poison, { spread: 40, rise: 90 });
      for (const e of nearest(game, p.x, p.y - 20, 190, 99, a, 1.1)) {
        strike(game, p, 'envenom', e, c * 140, s * 100, { color: '150,240,110' });
        NC.statusEnemy(game, e, 'poison', 3, Math.max(1, Math.round(p.d.batk * 0.25)));
      }
      V.shake(game, 4);
    }));
  };
  // E: vanish in smoke, step out of it behind the enemy
  const shadowPuff = (x, y, n) => {
    V.smoke(x, y - 20, n, '#3a2a4e', '#5a4a72', { size: 1, lifeK: 0.7, max: 180, a: 0.9 });
    V.motes(x, y - 60, n, C.shadow, { spread: 50, rise: 120 });
  };
  RUN.shadowstep = function (game, p, lv) {
    const a = p.aim, c = Math.cos(a), s = Math.sin(a);
    const e = nearest(game, p.x, p.y, 460, 1, a, 1.2)[0];
    const x0 = p.x, y0 = p.y;
    let tx, ty;
    if (e) { const ang = NC.angle(p.x, p.y, e.x, e.y); tx = e.x + Math.cos(ang) * 75; ty = e.y + Math.sin(ang) * 45; } else { tx = p.x + c * 300; ty = p.y + s * 210; }
    V.ghost(p, '#9a6ad8', 0.45);
    shadowPuff(p.x, p.y, 8);
    V.ring(p.x, p.y, 16, 120, 8, C.shadow, 0.3);
    // move there in small steps, so walls stop it
    const n = 16, rush = {};
    for (let i = 0; i < n; i++) NC.rushMove(game.world, p, (tx - x0) / n, (ty - y0) / n, rush);
    NC.finishRush(game.world, p, rush);
    if (e) p.face = e.x > p.x ? 1 : -1;
    FX.add({ type: 'cutline', x: x0, y: y0 - 60, x1: p.x, y1: p.y - 60, w: 16, color: C.shadow, life: 0.3 });
    shadowPuff(p.x, p.y, 8);
    V.slash(p.x, p.y - 70, 90, e ? NC.angle(p.x, p.y, e.x, e.y) : a, 2.2, 22, P.shadow, 0.26, { rgb: C.shadow });
    V.light(p.x, p.y - 60, 260, C.shadow, 0.8, 0.5);
    p.inv = Math.max(p.inv, 0.25);
    p.buffs.shadow = 3;
    if (e) strike(game, p, 'shadowstep', e, 0, 0, { color: '200,160,255' });
    pose(game, p, 'iaiS1', 0.2);
  };
  // R: a vial of poison thrown ahead: a cloud that burns for five seconds
  const drawFlask = (ctx, q) => {
    ctx.save();
    ctx.translate(q.x, q.y); ctx.rotate(q.t * 14);
    ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE;
    ctx.beginPath(); ctx.arc(0, 4, 12, 0, TAU); ctx.fillStyle = '#8ee05a'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(-5, -14, 10, 10); ctx.fillStyle = '#cfe8d8'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(-6, -19, 12, 6); ctx.fillStyle = '#a8764a'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-4, 1, 4, 0, TAU); ctx.fillStyle = '#e9ffb8'; ctx.fill();
    ctx.restore();
  };
  RUN.venomdust = function (game, p, lv) {
    pose(game, p, 'swing1', 0.3);
    const [tx, ty] = ground(game, p, 380);
    V.at(0.12, () => {
      const [hx, hy] = hand(p), dur = 0.38;
      proj({
        x: hx, y: hy, life: dur,
        update(q) { const k = q.t / dur; q.x = lerp(hx, tx, k); q.y = lerp(hy, ty - 30, k) - Math.sin(k * Math.PI) * 160; },
        draw(ctx, q) { drawFlask(ctx, q); },
        onEnd() {
          V.debris(tx, ty - 20, 8, ['#bfe8d0', '#e8fff2', '#ffffff'], { size: 0.5, max: 300 });
          V.decal(tx, ty, 170, 'goo', 5.6);
          V.ring(tx, ty, 20, 190, 10, C.poison, 0.4);
          V.light(tx, ty - 30, 360, C.poison, 0.8, 5.4);
          V.glowAt(tx, ty - 10, 150, 200, C.poison, 0.32, 5.2, { sq: V.SQ, fin: 0.05, fout: 0.2 });
          let acc = 0;
          FX.add({
            type: 'timer', layer: 'none', life: 5,
            update(o, dt) {
              if (Math.random() < dt * 14) V.smoke(tx + rand(-140, 140), ty + rand(-70, 70), 1, '#7acb52', '#c8f58a', { size: rand(0.9, 1.4), lifeK: 1.5, rise: 16, max: 36, a: 0.5 });
              if (Math.random() < dt * 10) V.motes(tx + rand(-130, 130), ty + rand(-60, 60), 1, C.poison, { rise: 80, spread: 6 });
              if (Math.random() < dt * 9) V.bubbles(tx + rand(-120, 120), ty + rand(-60, 60), 1, '#8ee05a', { spread: 4 });
              if (Math.random() < dt * 1.2) FX.add({ type: 'vskull', x: tx + rand(-90, 90), y: ty - rand(40, 90), vx: 0, vy: -40, s: rand(34, 48), life: 1.2 });
              if ((acc += dt) >= 0.5) {
                acc -= 0.5;
                for (const e of around(game, tx, ty, 165)) { strike(game, p, 'venomdust', e, 0, 0, { color: '150,240,110' }); NC.statusEnemy(game, e, 'poison', 2, Math.max(1, Math.round(p.d.batk * 0.2))); }
              }
            },
          });
          V.shake(game, 5);
        },
      });
    });
  };
  FX.def('vskull', (ctx, q, u) => {
    const a = V.fade(u, 0.2, 0.5) * 0.85;
    V.glow(ctx, q.x, q.y, q.s * 1.2, C.poison, 0.4 * a, false);
    V.skull(ctx, q.x, q.y, q.s, '#b8f07a', a);
  }, 'glow');
  // F: a flurry of shadow blades from every side, then a great cross cut
  RUN.sonic = function (game, p, lv) {
    const a = p.aim;
    const e = nearest(game, p.x, p.y, 440, 1, a, 1.4)[0];
    const cx = e ? e.x : p.x + Math.cos(a) * 200, cy = e ? e.y : p.y + Math.sin(a) * 140;
    V.flash('20,0,30', 0.4, 1.3, 'source-over');
    V.circle(cx, cy, 160, C.blood, 1.3, { style: 'occult', spin: 2.5, grow: true });
    V.light(cx, cy - 50, 360, C.blood, 0.8, 1.3);
    p.inv = Math.max(p.inv, 1.1);
    let step = 0;
    p.channel = {
      t: 0, dur: 0.95,
      update(game, p, ch) {
        p.vx = p.vy = 0;
        while (step < 8 && ch.t >= step * 0.09) {
          const ang = (step / 8) * TAU + rand(-0.3, 0.3), x = cx + Math.cos(ang) * 100, y = cy + Math.sin(ang) * 60;
          V.ghost(p, '#b05ad8', 0.3);
          if (!game.world.fits || game.world.fits(x, y, p.r)) { p.x = x; p.y = y; }
          p.face = cx > p.x ? 1 : -1;
          NC.Anim.play(p.anim, step % 2 ? 'iaiS1' : 'iaiS2');
          const cut = rand(0, Math.PI);
          FX.add({ type: 'cutline', x: cx - Math.cos(cut) * 160, y: cy - 60 - Math.sin(cut) * 100, x1: cx + Math.cos(cut) * 160, y1: cy - 60 + Math.sin(cut) * 100, w: 18, color: C.blood, life: 0.3 });
          V.sparks(cx, cy - 60, 6, C.blood, { size: 0.9 });
          if (e && alive(e)) strike(game, p, 'sonic', e, 0, 0, { color: '255,120,160' });
          V.stop(game, 0.025);
          step++;
        }
      },
      end(game, p) {
        const face = p.face;
        V.slash(cx, cy - 70, 170, -0.8, 2.5, 46, P.blood, 0.4, { rgb: C.blood, dir: 1 });
        V.slash(cx, cy - 70, 170, Math.PI + 0.8, 2.5, 46, P.shadow, 0.4, { rgb: C.shadow, dir: -1 });
        V.ring(cx, cy, 20, 280, 16, C.blood, 0.45);
        V.glowAt(cx, cy - 60, 40, 240, C.blood, 0.85, 0.4, { hot: true });
        V.flare(cx, cy - 70, 230, C.blood, 0.4, { rot: Math.PI / 4 });
        V.sparks(cx, cy - 60, 26, C.blood, { max: 900 });
        V.flash('255,230,240', 0.3, 0.3);
        V.shake(game, 14); V.stop(game, 0.12);
        for (const f of around(game, cx, cy, 160)) strike(game, p, 'sonic', f, (f.x - cx) * 3, (f.y - cy) * 3, { big: true, color: '255,120,160' }, { mul: SK.sonic.mul(lvOf(p, 'sonic')) * 2.5 });
        p.face = face;
        pose(game, p, 'iaiS3', 0.3);
      },
    };
  };

  // ======== boss sets' ultimates ========
  // Horned King: a stomp; rings of rock spikes burst out of glowing cracks
  RUN.b_quake = function (game, p, lv) {
    pose(game, p, 'smash3', 0.7);
    V.gather(p.x, p.y - 60, 14, C.rock, 160, 0.34);
    V.at(0.36, () => {
      V.decal(p.x, p.y, 380, 'crack', 3.2, { rgb: '255,110,50', n: 16, lw: 11 });
      [[110, 9], [200, 13], [290, 17]].forEach(([r, n], w) => V.at(w * 0.12, () => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + rand(-0.1, 0.1) + w * 0.2, d = r + rand(-20, 20);
          V.spikeAt(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.62, rand(48, 68), rand(74, 128) * (1.15 - w * 0.12), P.stone, rand(1.1, 1.4),
            { glowA: 0.45, rgb: '255,120,60', rise: 0.1, sink: true, tilt: Math.cos(a) * 0.32 + rand(-0.08, 0.08) });
        }
        V.ring(p.x, p.y, r * 0.6, r + 60, 14, '230,160,90', 0.4, { col: '#b0784a' });
        V.debris(p.x, p.y - 10, 6, P.rock, { size: 1, max: 480 });
        V.shake(game, 10);
      }));
      V.smoke(p.x, p.y, 16, '#9a8a78', '#c8b8a2', { size: 1.4, max: 380, lifeK: 1.2 });
      V.flash('255,130,60', 0.2, 0.4);
      V.light(p.x, p.y - 30, 700, '255,120,60', 1, 1.2, { flick: true });
      V.shake(game, 18); V.stop(game, 0.1);
      for (const e of around(game, p.x, p.y, 380)) { const k = push([p.x, p.y], e, 480); strike(game, p, 'b_quake', e, k[0], k[1], { big: true, color: '255,190,120' }); NC.statusEnemy(game, e, 'stun', 0.8); }
    });
  };
  // Occult Priest: a red sigil; shadow hands rise, drag the enemies in, then a crimson pillar
  FX.def('vtendril', (ctx, q, u) => {
    const rise = V.easeOut(Math.min(1, q.t / 0.25)), sink = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
    V.tendril(ctx, q.x, q.y, q.h * rise * sink, q.w, q.ph + q.t * 5, 1, V.PAL.shadow);
  }, 'sorted');
  RUN.b_ritual = function (game, p, lv) {
    pose(game, p, 'cheer', 0.9);
    const [tx, ty] = ground(game, p, 380);
    V.flash('30,0,20', 0.3, 2.4, 'source-over');
    V.circle(tx, ty, 300, '255,60,90', 2.4, { style: 'occult', spin: 1.2, grow: true });
    V.light(tx, ty - 40, 520, '255,60,90', 0.9, 2.4, { flick: true });
    V.every(2.0, 30, () => V.smoke(tx + rand(-260, 260), ty + rand(-130, 130), 1, '#2a1a3a', '#4a2a5a', { size: rand(0.8, 1.3), lifeK: 1.3, rise: 10, max: 30, a: 0.7 }));
    for (let i = 0; i < 12; i++) V.at(0.3 + i * 0.06, () => {
      const a = rand(0, TAU), d = rand(40, 260);
      FX.add({ type: 'vtendril', x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d * 0.62, sort: ty + Math.sin(a) * d * 0.62, h: rand(110, 180), w: rand(18, 26), ph: rand(0, 6), life: 1.5 });
    });
    V.every(1.2, 24, () => { for (const e of around(game, tx, ty, 320)) { const k = push([e.x, e.y], { x: tx, y: ty }, 90); e.kbx += k[0]; e.kby += k[1]; } });
    V.at(0.8, () => { for (const e of around(game, tx, ty, 320)) strike(game, p, 'b_ritual', e, 0, 0, { color: '255,120,160' }, { mul: 2.5 }); V.shake(game, 6); });
    V.at(1.6, () => {
      V.beam(tx, ty, 200, 760, '255,60,90', 0.7);
      V.ring(tx, ty, 40, 380, 20, '255,60,90', 0.5);
      V.glowAt(tx, ty - 60, 60, 320, '255,60,90', 1, 0.5, { hot: true });
      V.sparks(tx, ty - 60, 24, '255,90,120', { max: 900 });
      V.flash('255,80,120', 0.22, 0.35);
      V.shake(game, 14); V.stop(game, 0.08);
      for (const e of around(game, tx, ty, 320)) strike(game, p, 'b_ritual', e, 0, 0, { big: true, color: '255,120,160' });
    });
  };
  // Shadow Knight: eight spectral swords circle the hero, then fly into the enemies
  FX.def('vspecblade', (ctx, q, u) => {
    const a = q.state === 'fly' ? 1 : V.fade(Math.min(1, q.t / 0.9), 0.25, 0), ang = q.ang;
    ctx.save();
    ctx.translate(q.x, q.y); ctx.rotate(ang - Math.PI / 2); // (the blade's tip along ang)
    ctx.globalAlpha *= a;
    V.glow(ctx, 0, 0, 60, C.blood, 0.6, false);
    V.lightSword(ctx, 0, 60, 120, 20, 1, ['#6a0a2a', '#e0335a', '#ffd0dc']);
    ctx.restore();
  }, 'glow');
  RUN.b_blades = function (game, p, lv) {
    pose(game, p, 'cheer', 0.9);
    V.circle(p.x, p.y, 175, C.blood, 1.8, { style: 'occult', spin: 2, follow: p });
    V.light(p.x, p.y - 60, 380, C.blood, 0.8, 1.8, { follow: p });
    V.gather(p.x, p.y - 80, 16, C.blood, 190, 0.4);
    const foes = nearest(game, p.x, p.y, 620, 8);
    for (let i = 0; i < 8; i++) {
      const base = (i / 8) * TAU;
      const b = FX.add({
        type: 'vspecblade', x: p.x, y: p.y - 80, ang: Math.PI / 2, life: 2.2, state: 'orbit', hit: false,
        update(q, dt) {
          if (q.state === 'orbit') {
            const ang = base + q.t * 2.2, r = 150, sy = Math.sin(ang);
            q.x = p.x + Math.cos(ang) * r; q.y = p.y - 70 + sy * r * 0.5 + Math.sin(q.t * 7 + i) * 6;
            q.ang = Math.PI / 2 + Math.cos(ang) * 0.22;
            q.layer = sy < 0 ? 'sorted' : 'glow'; q.sort = p.y + sy * 40;
            if (q.t > 0.7 + i * 0.07) {
              q.state = 'fly'; q.layer = 'glow';
              V.flare(q.x, q.y, 70, C.blood, 0.2);
              const e = foes.length ? foes[i % foes.length] : null;
              q.tx = e ? e : { x: p.x + Math.cos(base) * 500, y: p.y + Math.sin(base) * 320 };
              V.sparks(q.x, q.y, 5, C.blood, { size: 0.7 });
            }
          } else if (q.state === 'fly') {
            const tx = q.tx.x, ty = q.tx.y - 60, d = NC.dist(q.x, q.y, tx, ty), ang = NC.angle(q.x, q.y, tx, ty), sp = 1500;
            q.ang = ang;
            q.x += Math.cos(ang) * Math.min(d, sp * dt); q.y += Math.sin(ang) * Math.min(d, sp * dt);
            if (Math.random() < 0.8) FX.add({ type: 'vstreak', x: q.x, y: q.y, vx: -Math.cos(ang) * 200, vy: -Math.sin(ang) * 200, len: 60, w: 5, rgb: C.blood, life: 0.25 });
            if (d < 20) {
              q.dead = true;
              V.sparks(q.x, q.y, 12, C.blood);
              V.ring(q.x, q.y + 60, 10, 110, 8, C.blood, 0.3);
              V.glowAt(q.x, q.y, 20, 120, C.blood, 1, 0.3, { hot: true });
              V.shake(game, 5);
              if (q.tx.hp !== undefined && alive(q.tx)) strike(game, p, 'b_blades', q.tx, Math.cos(ang) * 200, Math.sin(ang) * 150, { color: '255,120,160' });
            }
          }
        },
      });
      V.light(p.x, p.y - 80, 160, C.blood, 0.6, 2.2, { follow: b });
    }
    V.flash('40,0,10', 0.25, 1.6, 'source-over');
  };
  // Plague Shaman: a skull of green miasma rises, the plague spreads all round
  FX.def('vskullcloud', (ctx, q, u) => {
    const a = V.fade(u, 0.15, 0.45), s = lerp(80, 170, V.easeOut(u)), y = q.y - lerp(120, 270, V.easeOut(u));
    V.glow(ctx, q.x, y, s * 1.8, C.poison, 0.5 * a, false);
    for (let i = 0; i < 7; i++) { const ang = (i / 7) * TAU + q.t; V.blob(ctx, q.x + Math.cos(ang) * s * 0.7, y + Math.sin(ang) * s * 0.45, s * 0.42, i + 3, '#5aa84a', a * 0.62, '#8ee05a'); }
    V.skull(ctx, q.x, y, s, '#b8f07a', a);
    for (const k of [-1, 1]) V.glow(ctx, q.x + k * s * 0.19, y - s * 0.02, s * 0.22, '200,255,90', a, true);
  }, 'glow');
  RUN.b_plague = function (game, p, lv) {
    pose(game, p, 'stormB3', 0.8);
    V.gather(p.x, p.y - 60, 16, C.poison, 180, 0.4);
    V.at(0.42, () => {
      FX.add({ type: 'vskullcloud', x: p.x, y: p.y, life: 1.8 });
      for (let i = 0; i < 18; i++) { // the miasma rolls out in a wide ring
        const a = (i / 18) * TAU + rand(-0.1, 0.1), sp = rand(560, 780);
        FX.add({ type: 'vsmoke', layer: 'high', x: p.x + Math.cos(a) * 50, y: p.y + Math.sin(a) * 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, drag: 1.9,
          r0: 26, r1: 72, fill: '#7acb52', hi: '#c8f58a', life: rand(1.0, 1.3), seed: i * 7, a: 0.45 });
      }
      V.glowAt(p.x, p.y - 10, 120, 400, C.poison, 0.35, 1.6, { sq: V.SQ, fin: 0.05, fout: 0.5 });
      V.bubbles(p.x, p.y, 14, '#8ee05a', { spread: 220, size: 1.2 });
      V.debris(p.x, p.y - 30, 10, ['#d8cfb8', '#f2ead6', '#ffffff'], { size: 0.8, max: 520 });
      V.ring(p.x, p.y, 40, 400, 18, C.poison, 0.55);
      V.decal(p.x, p.y, 360, 'goo', 4, { col: 'rgba(70,150,50,0.4)' });
      V.motes(p.x, p.y - 30, 30, C.poison, { spread: 320, rise: 150 });
      V.light(p.x, p.y - 60, 680, C.poison, 1, 1.6);
      V.flash('120,230,90', 0.16, 0.4);
      V.shake(game, 14); V.stop(game, 0.06);
      for (const e of around(game, p.x, p.y, 380)) { strike(game, p, 'b_plague', e, 0, 0, { big: true, color: '150,240,110' }); NC.statusEnemy(game, e, 'poison', 6, Math.max(1, Math.round(Math.max(p.d.batk, p.d.matk[1]) * 0.35))); }
    });
  };
  // Fallen Paladin: pillars of gold-and-black light crash down in a cross
  RUN.b_fall = function (game, p, lv) {
    pose(game, p, 'cheer', 0.9);
    const a = p.aim, cx = p.x + Math.cos(a) * 170, cy = p.y + Math.sin(a) * 120;
    const spots = [[cx, cy], [cx - 190, cy - 110], [cx + 190, cy - 110], [cx - 190, cy + 110], [cx + 190, cy + 110]];
    V.flash('20,10,0', 0.25, 1.6, 'source-over');
    spots.forEach(([x, y], i) => {
      V.at(i * 0.15, () => V.circle(x, y, 120, C.holy, 0.9, { style: 'holy', spin: 2, grow: true }));
      V.at(0.4 + i * 0.15, () => {
        V.beam(x, y, 86, 1150, C.holy, 0.8, { inkCol: '#1a1020', dark: '#2c1a36' });
        V.flare(x, y - 50, 160, C.holy, 0.3);
        V.smoke(x, y - 10, 5, '#2a2030', '#4a3a50', { size: 1, max: 260, lifeK: 0.9, a: 0.8 });
        V.ring(x, y, 20, 200, 16, C.holy, 0.45, { col: '#2a1a10' });
        V.glowAt(x, y - 60, 40, 220, C.holy, 1, 0.45, { hot: true });
        V.decal(x, y, 140, 'crack', 2.2, { rgb: C.holy, n: 9 });
        V.sparks(x, y - 40, 16, C.holy, { max: 820 });
        V.light(x, y - 40, 420, C.holy, 1, 0.8);
        V.flash('255,240,190', 0.15, 0.25);
        V.shake(game, 10);
        for (const e of around(game, x, y, 135)) strike(game, p, 'b_fall', e, 0, -120, { big: true, color: '255,235,170' });
      });
    });
  };
  // Infernal Warlock: a vortex of purple-red hellfire turns and spreads out
  RUN.b_hellfire = function (game, p, lv) {
    pose(game, p, 'cheer', 0.9);
    V.circle(p.x, p.y, 200, '220,80,255', 2.2, { style: 'occult', spin: -2.4, follow: p });
    V.light(p.x, p.y - 40, 640, '220,80,255', 1, 2.2, { follow: p, flick: true });
    for (let k = 0; k < 6; k++) V.at(0.2 + k * 0.3, () => {
      const n = 22, off = k * 0.5;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU + off;
        FX.add({
          type: 'vflame', x: p.x, y: p.y, w: rand(30, 44), h: rand(60, 100), pal: P.hell, life: 0.8, ph: rand(0, 9),
          update(q) { const t = q.t / q.life, r = lerp(60, 380, V.easeOut(t)), a = a0 + t * 2.4; q.x = p.x + Math.cos(a) * r; q.y = p.y + Math.sin(a) * r * 0.62; },
        });
      }
      V.ring(p.x, p.y, 60, 400, 14, '220,80,255', 0.6, { col: '#b040ff' });
      V.motes(p.x, p.y - 20, 18, '220,80,255', { spread: 300, rise: 200 });
      V.shake(game, 6);
      for (const e of around(game, p.x, p.y, 390)) strike(game, p, 'b_hellfire', e, 0, 0, { color: '230,140,255' });
    });
    V.at(2.0, () => {
      for (let i = 0; i < 16; i++) { const a = rand(0, TAU), sp = rand(200, 460); V.flameAt(p.x, p.y, rand(40, 60), rand(90, 140), P.hell, 0.6, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, drag: 3 }); }
      V.glowAt(p.x, p.y - 40, 60, 360, '220,80,255', 1, 0.5, { hot: true });
      V.ring(p.x, p.y, 40, 420, 22, '255,60,120', 0.55);
      V.decal(p.x, p.y, 320, 'scorch', 3.5, { rgb: '220,90,255' });
      V.flash('230,120,255', 0.22, 0.35);
      V.shake(game, 16); V.stop(game, 0.08);
      for (const e of around(game, p.x, p.y, 400)) { const k = push([p.x, p.y], e, 460); strike(game, p, 'b_hellfire', e, k[0], k[1], { big: true, color: '230,140,255' }, { mul: 2 }); }
    });
  };

  // the job change: a pillar of light, stars, the new look
  NC.jobChangeFx = function (game, p, text) {
    V.beam(p.x, p.y, 180, 900, C.holy, 1.2);
    V.circle(p.x, p.y, 220, C.holy, 1.8, { style: 'holy', spin: 1.5, grow: true, follow: p });
    V.ring(p.x, p.y, 40, 360, 20, C.holy, 0.7);
    V.stars(p.x, p.y - 90, 24, '#ffe68a', C.holy, { speed: 520 });
    V.motes(p.x, p.y - 40, 40, C.holy, { spread: 180, rise: 260 });
    V.light(p.x, p.y - 60, 600, C.holy, 1, 1.8, { follow: p });
    V.flash('255,248,215', 0.4, 0.6);
    FX.text(p.x, p.y - 260, text || 'JOB CHANGE!', '#ffe28a', 70);
  };
})();
