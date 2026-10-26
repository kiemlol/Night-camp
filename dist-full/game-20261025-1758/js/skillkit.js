/* skillkit.js — the building blocks of the bigger skill trees (skills_t1.js, class2_skills_*.js): the shapes a skill
   hits (around a point, a cone, a line, a projectile, a rain, a lasting zone, a dash, a chain, a pillar from the sky),
   the marks it leaves on monsters (vulnerable, weakened) and the looks that go with them, all made from vfx.js in the
   game's style. A skill file then says only what is special about each skill.
   NC.SkillKit (K): K.S(o) makes a skill entry (defaults: max 10, the active / buff / passive kind); K.def(list) adds
   entries to NC.SKILLS; the rest are the helpers below. The marks are read by skilltree.js (its NC.damageEnemy and
   NC.monsterHit wrappers). Loaded after skills.js (NC.skillHelpers, the vproj / vstreak / cutline effects). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, SK = NC.SKILLS, H = NC.skillHelpers;
  const TAU = Math.PI * 2, rand = NC.rand, clamp = NC.clamp, lerp = NC.lerp;
  const C = V.RGB, P = V.PAL;
  const K = (NC.SkillKit = { C, P, TAU });

  // ---------------- skill entries ----------------
  // kind: 'active' (default), 'buff' (a timed effect: buff(lv) -> stat changes, dur(lv)), 'passive' (pass(lv, p) ->
  // stat changes, never on the hotbar). req: [[skill, level], ...] to learn it; free: the level it starts at.
  K.S = function (o) {
    const kind = o.kind || (o.pass ? 'passive' : o.buff && !o.type ? 'buff' : 'active');
    const base = { max: 10, free: 0, kind, active: kind !== 'passive' };
    if (kind !== 'passive') Object.assign(base, { type: kind === 'buff' ? 'buff' : 'phys', element: null, sp: () => 10, mul: () => 1, cd: 5 });
    return Object.assign(base, o);
  };
  K.def = function (list) {
    for (const id in list) { SK[id] = list[id]; SK[id].id = id; }
  };
  const lvOf = (p, id) => NC.skillLv(p, id);
  K.lv = lvOf;

  // ---------------- targets ----------------
  const alive = (K.alive = (e) => e && !e.dead && e.hp > 0);
  K.around = H.around; K.nearest = H.nearest; K.within = H.within; K.ground = H.ground;
  K.strike = H.strike; K.pose = H.pose; K.hand = H.hand; K.tip = H.tip;
  K.push = (from, e, f) => { const a = NC.angle(from[0], from[1], e.x, e.y); return [Math.cos(a) * f, Math.sin(a) * f * 0.7]; };
  // the monster the hero means: the one nearest the mouse (within near), else the nearest in front
  K.target = function (game, p, range, near) {
    const [gx, gy] = H.ground(game, p, range);
    return H.nearest(game, gx, gy, near || 220, 1)[0] || H.nearest(game, p.x, p.y, range, 1, p.aim, 0.9)[0] || null;
  };
  // the hero's clip for a move: the weapon's own combo (swing / thrust / smash / bolt / arrow) in the chosen move set
  K.clip = function (p, style, i) {
    const W = NC.weaponDef(p) || {};
    const set = NC.Anim.setOf(NC.Anim.movesFor(p.moves, W));
    const c = set.combo(style || W.style || 'swing') || set.combo('swing');
    return c[Math.min(c.length - 1, i || 0)];
  };
  // a hit from a skill at a multiple of its own mul (extra: heroHit options; unset ones keep the skill's defaults, so an
  // ultimate still never misses)
  K.hit = function (game, p, id, e, kx, ky, color, k, extra) {
    const ex = {};
    if (extra) for (const key in extra) if (extra[key] !== undefined && key !== 'big') ex[key] = extra[key];
    if (k && k !== 1) ex.mul = SK[id].mul(lvOf(p, id)) * k;
    return H.strike(game, p, id, e, kx || 0, ky || 0, { color: color || '255,235,190', big: !!(extra && extra.big) }, ex);
  };

  // ---------------- marks on monsters (skilltree.js applies them) ----------------
  // vulnerable: takes k x damage from everyone; weak: its hits do k x damage; bound: can't move (stun)
  K.vuln = (game, e, k, dur, rgb) => {
    if (!alive(e)) return;
    e.vuln = { k: Math.max(k, e.vuln && e.vuln.until > game.time ? e.vuln.k : 1), until: game.time + dur, rgb: rgb || '255,90,90' };
  };
  K.weak = (game, e, k, dur) => { if (alive(e)) e.weak = { k, until: game.time + dur }; };
  K.stun = (game, e, dur) => NC.statusEnemy(game, e, 'stun', dur);
  K.freeze = (game, e, dur) => NC.statusEnemy(game, e, 'freeze', dur);
  K.poison = (game, p, e, dur, k) => NC.statusEnemy(game, e, 'poison', dur, Math.max(1, Math.round(Math.max(p.d.batk, p.d.matk[1]) * (k || 0.25) * ((p.d.poisonK || 1)))));
  K.slow = (e, dur) => { if (alive(e)) e.slow = Math.max(e.slow || 0, dur); };
  K.pull = (e, x, y, f) => { const a = NC.angle(e.x, e.y, x, y); e.kbx += Math.cos(a) * f; e.kby += Math.sin(a) * f * 0.7; };

  // ---------------- the party round the hero: the AI friends, and the real players' stand-ins (js/partysupport.js) ----------------
  K.friends = (game, p, r) => ((NC.allies ? NC.allies(game) : NC.Party && NC.Party.members) || []).filter((a) => a.dead <= 0 && NC.dist(a.x, a.y, p.x, p.y) < (r || 520));
  K.heal = function (game, who, amount, o) {
    if (!who || who.dead > 0) return 0;
    const got = Math.max(0, Math.min(Math.round(amount), who.maxHp - who.hp));
    who.hp += got;
    FX.num(who.x, who.y - 150, '+' + got, { fill: '#8dff8a', size: who === game.player ? 44 : 36 });
    FX.add({ type: 'vplus', x: who.x, y: who.y, life: 0.9 });
    if (!(o && o.quiet)) { V.ring(who.x, who.y - 6, 20, 120, 8, '150,255,170', 0.45); V.motes(who.x, who.y - 40, 8, '150,255,170', { spread: 60, rise: 150 }); }
    return got;
  };
  K.healPow = (p) => (p.d && p.d.healK) || 1;

  // ---------------- looks ----------------
  K.burst = function (game, x, y, r, rgb, o) {
    o = o || {};
    V.ring(x, y, 20, r * 1.15, o.w || 12, rgb, 0.45, o.col ? { col: o.col } : undefined);
    V.glowAt(x, y - 30, 30, r * 0.9, rgb, 0.8, 0.4, { hot: true });
    V.sparks(x, y - 30, o.sparks || 14, rgb, { max: 700 });
    V.light(x, y - 30, r * 2.4, rgb, 0.9, 0.5);
    if (o.flare !== false) V.flare(x, y - 40, r * 0.8, rgb, 0.3);
    if (o.decal) V.decal(x, y, r * 0.8, o.decal, 2.4, { rgb, n: 9 });
    if (o.smoke) V.smoke(x, y - 10, 6, o.smoke[0], o.smoke[1], { size: 1, lifeK: 0.8 });
    if (o.stars) V.stars(x, y - 40, o.stars, o.starFill || '#fff0b0', rgb, { speed: 320 });
    if (o.shake !== 0) V.shake(game, o.shake || 6);
    if (o.flash) V.flash(o.flash, 0.14, 0.3);
  };
  // a buff taking hold on someone: a ring, rising motes and stars, a short glow that follows them
  K.buffFx = function (game, who, rgb, o) {
    o = o || {};
    V.ring(who.x, who.y - 6, 20, o.r || 160, 10, rgb, 0.5);
    V.circle(who.x, who.y, (o.r || 160) * 0.8, rgb, 0.9, { style: o.style || 'holy', spin: 2, grow: true, follow: who, a: 0.8 });
    V.stars(who.x, who.y - 90, 10, o.fill || '#fff0b0', rgb, { speed: 260 });
    V.motes(who.x, who.y - 30, 14, rgb, { spread: 60, rise: 200 });
    V.light(who.x, who.y - 60, 320, rgb, 0.8, 0.7, { follow: who });
    if (o.flash !== false) V.flash(rgb, 0.08, 0.25);
  };
  // an arrow: a glowing ribbon, the shaft, the head and the fletching (like skills.js's own)
  K.drawArrow = function (ctx, q, rgb, scale, trail) {
    const a = Math.atan2(q.vy, q.vx), k = scale || 1, L = trail || 170;
    ctx.save();
    ctx.translate(q.x, q.y); ctx.rotate(a); ctx.scale(k, k);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(-L, 0, 0, 0);
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},0.75)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, -8); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.strokeStyle = '#fff4d0'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(8, -8); ctx.lineTo(8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-28, -8); ctx.lineTo(-22, 0); ctx.lineTo(-28, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    V.glow(ctx, q.x, q.y, 46 * k, rgb, 0.8, true);
  };
  // a blade shape (dagger, kunai): outlined steel with a light edge
  K.drawBlade = function (ctx, x, y, ang, len, w, fill, glowRgb) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(len * 0.6, 0); ctx.lineTo(-len * 0.1, -w); ctx.lineTo(-len * 0.4, 0); ctx.lineTo(-len * 0.1, w); ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.fillStyle = fill || '#dfe6ef'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(len * 0.55, 0); ctx.lineTo(-len * 0.1, -w * 0.35); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.rect(-len * 0.55, -w * 0.4, len * 0.18, w * 0.8); ctx.fillStyle = '#5a3a4a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.restore();
    if (glowRgb) V.glow(ctx, x, y, len * 0.9, glowRgb, 0.6, true);
  };
  // a shuriken: n points, spinning
  K.drawStar = function (ctx, x, y, r, rot, n, fill) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU, rr = i % 2 ? r * 0.32 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.fillStyle = fill || '#cfd6e2'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, TAU); ctx.fillStyle = '#39324a'; ctx.fill();
    ctx.restore();
  };
  // an orb of magic: a hot core, a soft glow, a toon rim
  K.drawOrb = function (ctx, x, y, r, rgb, core) {
    V.glow(ctx, x, y, r * 3.2, rgb, 0.9, true);
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = 3.5; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.fillStyle = `rgb(${rgb})`; ctx.fill();
    ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.5, 0, TAU); ctx.fillStyle = core || '#ffffff'; ctx.fill();
    ctx.restore();
  };
  // a little ghost (the warlock's souls): a round head, a wavy tail, two eyes
  K.drawGhost = function (ctx, x, y, s, t, rgb, a) {
    ctx.save(); ctx.globalAlpha *= a === undefined ? 1 : a;
    V.glow(ctx, x, y, s * 2.4, rgb, 0.7, false);
    ctx.beginPath();
    ctx.arc(x, y, s, Math.PI, 0);
    for (let i = 0; i <= 6; i++) { const u = i / 6, xx = x + s - u * s * 2, yy = y + s * 0.9 + Math.sin(t * 10 + u * 9) * s * 0.22 + (i % 2 ? s * 0.25 : 0); ctx.lineTo(xx, yy); }
    ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.fillStyle = `rgba(${rgb},0.92)`; ctx.fill();
    ctx.fillStyle = '#1e2a33';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + k * s * 0.35, y - s * 0.05, s * 0.14, s * 0.2, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  };

  // ---------------- shapes that hit ----------------
  const proj = (o) => FX.add(Object.assign({ type: 'vproj', layer: o.layer || 'glow' }, o));
  K.proj = proj;

  // everything round (x, y) within r: o.mul (x the skill's), kb (push), status [kind, dur], color, big, fx (false: no
  // default look), each(e) extra per monster. Returns the monsters hit.
  K.nova = function (game, p, id, x, y, r, o) {
    o = o || {};
    r *= NC.skillScale ? NC.skillScale(p, id) : 1; // (line resonance II: bigger)
    if (o.fx !== false) K.burst(game, x, y, r, o.rgb || C.gold, o);
    const got = K.around(game, x, y, r);
    for (const e of got) {
      const k = o.kb ? K.push([x, y], e, o.kb) : [0, 0];
      const res = K.hit(game, p, id, e, k[0], k[1], o.color, o.mul, { big: o.big, crit: o.crit, sure: o.sure });
      if (o.status && res && !res.miss) NC.statusEnemy(game, e, o.status[0], o.status[1], o.status[2]);
      if (o.each) o.each(e, res);
    }
    return got;
  };
  // in front of the hero: a cone (half-angle cone) out to range
  K.cone = function (game, p, id, range, cone, o) {
    o = o || {};
    range *= NC.skillScale ? NC.skillScale(p, id) : 1;
    const got = H.nearest(game, p.x, p.y - 20, range, 99, o.ang === undefined ? p.aim : o.ang, cone);
    for (const e of got) {
      const a = NC.angle(p.x, p.y, e.x, e.y);
      const res = K.hit(game, p, id, e, Math.cos(a) * (o.kb || 0), Math.sin(a) * (o.kb || 0) * 0.7, o.color, o.mul, { big: o.big, crit: o.crit });
      if (o.status && res && !res.miss) NC.statusEnemy(game, e, o.status[0], o.status[1], o.status[2]);
      if (o.each) o.each(e, res);
    }
    return got;
  };
  // along a line from (x0, y0) at angle a, len long and w wide (each monster once)
  K.lineHits = function (game, x0, y0, a, len, w) {
    const c = Math.cos(a), s = Math.sin(a);
    return game.enemies.filter((e) => {
      if (!alive(e)) return false;
      const dx = e.x - x0, dy = e.y - 30 - y0, along = dx * c + dy * s, side = Math.abs(-dx * s + dy * c);
      return along > -20 && along < len && side < w / 2 + e.r;
    });
  };

  // a projectile. o: from, ang, v, range, r (hit radius), pierce, home (turn rate, rad/s) + target, look(ctx, q) or
  // style ('orb' | 'arrow' | 'blade' | 'star' | 'ghost'), rgb, size, trail(q) (per frame), hit(e, q) (default: a hit
  // of the skill + sparks), end(q) (when it stops), arc (a lob: height), to [x, y] (a lob's landing spot)
  K.shot = function (game, p, id, o) {
    const from = o.from || (NC.weaponDef(p) && NC.weaponDef(p).magic ? H.tip(p) : H.hand(p));
    const a0 = o.ang === undefined ? p.aim : o.ang, v = o.v || 950, range = o.range || 900, rgb = o.rgb || C.gold;
    const hitSet = new Set();
    const q = proj({
      x: from[0], y: from[1], vx: Math.cos(a0) * v, vy: Math.sin(a0) * v, life: o.to ? o.dur || 0.45 : range / v, rot: 0, trailPts: [],
      update(q, dt) {
        if (o.to) { // a lob to a spot
          const k = q.t / q.life;
          q.x = lerp(from[0], o.to[0], k); q.y = lerp(from[1], o.to[1] - 30, k) - Math.sin(k * Math.PI) * (o.arc || 140);
        } else {
          if (o.home && o.target && alive(o.target)) {
            const want = NC.angle(q.x, q.y, o.target.x, o.target.y - 45), cur = Math.atan2(q.vy, q.vx);
            const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)), turn = clamp(d, -o.home * dt, o.home * dt), sp = Math.hypot(q.vx, q.vy);
            q.vx = Math.cos(cur + turn) * sp; q.vy = Math.sin(cur + turn) * sp;
          }
          q.x += q.vx * dt; q.y += q.vy * dt;
        }
        q.rot += dt * (o.spin || 0);
        q.trailPts.push([q.x, q.y]); if (q.trailPts.length > 9) q.trailPts.shift();
        if (o.trail) o.trail(q, dt);
        if (o.to) return;
        for (const e of game.enemies)
          if (!hitSet.has(e) && alive(e) && NC.dist(q.x, q.y, e.x, e.y - 45) < (o.r || 34) + e.r) {
            hitSet.add(e);
            if (o.hit) o.hit(e, q);
            else { K.hit(game, p, id, e, Math.cos(a0) * (o.kb || 140), Math.sin(a0) * (o.kb || 140) * 0.7, o.color, o.mul); V.sparks(q.x, q.y, 6, rgb, { size: 0.7 }); }
            if (!o.pierce) { q.dead = true; return; }
          }
        if (!o.pierce && !o.ghost && game.world.isSolid && NC.shotWall(game.world, q.x, q.y + 60)) q.dead = true;
      },
      draw(ctx, q) {
        if (o.look) return o.look(ctx, q);
        const s = o.size || 1, ang = Math.atan2(q.vy, q.vx);
        if (o.style === 'arrow') return K.drawArrow(ctx, q, rgb, s, o.tail);
        if (o.style === 'blade') return K.drawBlade(ctx, q.x, q.y, o.to ? q.rot : ang, 34 * s, 7 * s, o.fill, rgb);
        if (o.style === 'star') { V.glow(ctx, q.x, q.y, 40 * s, rgb, 0.6, true); return K.drawStar(ctx, q.x, q.y, 16 * s, q.rot, 4, o.fill); }
        if (o.style === 'ghost') return K.drawGhost(ctx, q.x, q.y, 15 * s, q.t, rgb);
        // orb (default): a tail of its colour behind it
        const T = q.trailPts;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (let i = 1; i < T.length; i++) {
          const k = i / T.length;
          ctx.strokeStyle = `rgba(${rgb},${0.45 * k})`; ctx.lineWidth = 22 * s * k;
          ctx.beginPath(); ctx.moveTo(T[i - 1][0], T[i - 1][1]); ctx.lineTo(T[i][0], T[i][1]); ctx.stroke();
        }
        ctx.restore();
        K.drawOrb(ctx, q.x, q.y, 11 * s, rgb, o.core);
      },
      onEnd(q) { if (o.end) o.end(q); },
    });
    V.light(from[0], from[1], 220, rgb, 0.7, q.life, { follow: q });
    return q;
  };

  // things falling from the sky onto (x, y) within R: n of them over dur; each lands with a hit of radius ir.
  // o: look (ctx, q) for the falling thing, land(x, y) extra look, mul, rgb, status, from (dx, dy of the sky start),
  // spot(i, R) -> [x, y] or null: where the i-th one lands (null: anywhere in the circle)
  K.rain = function (game, p, id, x, y, R, n, dur, o) {
    o = o || {};
    const sc = NC.skillScale ? NC.skillScale(p, id) : 1;
    R *= sc; if (o.ir) o = Object.assign({}, o, { ir: o.ir * sc });
    const rgb = o.rgb || C.gold;
    for (let i = 0; i < n; i++) V.at((o.delay || 0) + (i / Math.max(1, n - 1)) * dur, () => {
      const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R, at = o.spot && o.spot(i, R);
      const tx = at ? at[0] : x + Math.cos(a) * d, ty = at ? at[1] : y + Math.sin(a) * d * V.SQ;
      const [fx, fy] = o.from || [120, -820], sx = tx + fx, sy = ty + fy, t = o.fall || 0.28;
      proj({
        x: sx, y: sy, vx: (tx - sx) / t, vy: (ty - 20 - sy) / t, life: t,
        draw(ctx, q) { if (o.look) o.look(ctx, q); else K.drawOrb(ctx, q.x, q.y, 10, rgb); },
        onEnd() {
          V.ring(tx, ty, 8, (o.ir || 70) * 1.1, 6, rgb, 0.3);
          V.glowAt(tx, ty - 16, 12, (o.ir || 70) * 1.2, rgb, 0.7, 0.3, { hot: true });
          V.sparks(tx, ty - 10, 6, rgb, { size: 0.7, max: 420 });
          if (o.land) o.land(tx, ty);
          for (const e of K.around(game, tx, ty, o.ir || 70)) {
            const res = K.hit(game, p, id, e, 0, 0, o.color, o.mul);
            if (o.status && res && !res.miss) NC.statusEnemy(game, e, o.status[0], o.status[1], o.status[2]);
            if (o.each) o.each(e, res);
          }
        },
      });
    });
  };

  // a lasting zone at (x, y) of radius r for dur: every `every` seconds it hits what is inside (o.mul, o.status,
  // o.each(e)); o.tick(dt) for its looks, o.pull (drag monsters in), o.circle (a magic circle on the ground)
  K.zone = function (game, p, id, x, y, r, dur, every, o) {
    o = o || {};
    r *= NC.skillScale ? NC.skillScale(p, id) : 1;
    const rgb = o.rgb || C.gold;
    if (o.circle !== false) V.circle(x, y, r, rgb, dur, { style: o.style || 'arcane', spin: o.spin || 1, grow: true, a: o.a || 0.85 });
    if (o.glow !== false) V.glowAt(x, y - 10, r * 0.8, r, rgb, o.glowA || 0.3, dur, { sq: V.SQ, fin: 0.05, fout: 0.2 });
    V.light(x, y - 30, r * 2.2, rgb, 0.7, dur);
    let acc = every; // (the first tick right away)
    return FX.add({
      type: 'timer', layer: 'none', life: dur, x, y,
      update(z, dt) {
        if (o.follow) { z.x = o.follow.x; z.y = o.follow.y; }
        if (o.tick) o.tick(z, dt);
        if (o.pull) for (const e of K.around(game, z.x, z.y, r * 1.3)) K.pull(e, z.x, z.y, o.pull * dt * 6);
        if ((acc += dt) >= every) {
          acc -= every;
          for (const e of K.around(game, z.x, z.y, r)) {
            if (o.hits === false) { if (o.each) o.each(e); continue; }
            const res = K.hit(game, p, id, e, 0, 0, o.color, o.mul);
            if (o.status && res && !res.miss) NC.statusEnemy(game, e, o.status[0], o.status[1], o.status[2]);
            if (o.each) o.each(e, res);
          }
          if (o.pulse) o.pulse(z);
        }
      },
      onEnd(z) { if (o.end) o.end(z); },
    });
  };

  // the hero dashes along ang for dist in dur (walls stop him), untouchable, hitting whoever he passes.
  // o: hit(e) (default: a hit + a slash), rgb, pal, trail color, end()
  K.dash = function (game, p, id, ang, dist, dur, o) {
    o = o || {};
    const dx = Math.cos(ang), dy = Math.sin(ang) * 0.8, rgb = o.rgb || C.wind, x0 = p.x, y0 = p.y;
    p.inv = Math.max(p.inv, dur + 0.12);
    if (Math.abs(dx) > 0.1) p.face = dx > 0 ? 1 : -1;
    p.dash = {
      t: 0, dur, vx: (dx * dist) / dur, vy: (dy * dist) / dur, ghost: 0, hit: new Set(),
      hitFn(game, e) {
        if (o.hit) return o.hit(e);
        K.hit(game, p, id, e, dx * 200, dy * 160, o.color, o.mul);
        V.slash(e.x, e.y - 60, 60, ang - 0.6, 1.8, 18, o.pal || P.wind, 0.22, { rgb });
      },
      tick(game, p, d) {
        if (Math.random() < 0.9) FX.add({ type: 'vstreak', x: p.x + rand(-30, 30), y: p.y - rand(20, 120), vx: -d.vx * 0.12, vy: -d.vy * 0.12, len: rand(40, 90), w: 3, rgb, life: 0.25 });
        if (o.tick) o.tick(p, d);
      },
      end(game, p) {
        FX.add({ type: 'cutline', x: x0, y: y0 - 55, x1: p.x, y1: p.y - 55, w: 14, color: rgb, life: 0.3 });
        if (o.end) o.end(p);
      },
    };
  };
  // step to (x, y) at once (in small steps, so walls stop it), with a puff at both ends
  K.blink = function (game, p, x, y, o) {
    o = o || {};
    const x0 = p.x, y0 = p.y, n = 16, rush = {};
    V.ghost(p, o.ghost || '#9a6ad8', 0.4);
    V.smoke(p.x, p.y - 20, 6, o.fill || '#3a2a4e', o.hi || '#5a4a72', { size: 0.9, lifeK: 0.6, max: 160, a: 0.9 });
    for (let i = 0; i < n; i++) NC.rushMove(game.world, p, (x - x0) / n, (y - y0) / n, rush);
    NC.finishRush(game.world, p, rush);
    V.smoke(p.x, p.y - 20, 6, o.fill || '#3a2a4e', o.hi || '#5a4a72', { size: 0.9, lifeK: 0.6, max: 160, a: 0.9 });
    if (o.line !== false) FX.add({ type: 'cutline', x: x0, y: y0 - 60, x1: p.x, y1: p.y - 60, w: 14, color: o.rgb || C.shadow, life: 0.3 });
    p.inv = Math.max(p.inv, 0.2);
  };
  // hold still for dur: update(ch, dt) each frame, end() after
  K.channel = function (game, p, dur, update, end) {
    p.channel = { t: 0, dur, update(game, p, ch, dt) { p.vx *= 0.8; p.vy *= 0.8; update(ch, dt); }, end: end ? () => end() : null };
  };
  // lightning (or anything) jumping from one monster to the next: n jumps, each hit once
  K.chain = function (game, p, id, first, n, jump, o) {
    o = o || {};
    const rgb = o.rgb || C.lightning, done = new Set();
    let cur = first, from = o.from || H.tip(p);
    for (let i = 0; i < n && cur; i++) {
      const c = cur, f = from;
      V.at(i * (o.gap || 0.07), () => {
        if (!alive(c)) return;
        V.boltAt(f[0], f[1], c.x, c.y - 50, rgb, 0.22, { w: o.w || 5, jag: 26, seg: 9 });
        V.glowAt(c.x, c.y - 50, 20, 110, rgb, 0.8, 0.25, { hot: true });
        V.sparks(c.x, c.y - 50, 8, rgb, { size: 0.8 });
        K.hit(game, p, id, c, 0, 0, o.color, o.mul * Math.pow(o.fall || 1, i));
        if (o.each) o.each(c);
      });
      done.add(c);
      from = [c.x, c.y - 50];
      cur = game.enemies.filter((e) => alive(e) && !done.has(e) && NC.dist(e.x, e.y, c.x, c.y) < jump).sort((a, b) => NC.dist(a.x, a.y, c.x, c.y) - NC.dist(b.x, b.y, c.x, c.y))[0];
    }
    return done;
  };
  // a pillar of light (or fire) from the sky onto (x, y): after `delay` it hits within r
  K.pillar = function (game, p, id, x, y, r, o) {
    o = o || {};
    const rgb = o.rgb || C.holy;
    V.circle(x, y, r, rgb, (o.delay || 0.2) + 0.5, { style: o.style || 'holy', spin: 2, grow: true });
    V.at(o.delay || 0.2, () => {
      V.beam(x, y, o.w || r * 0.8, o.h || 620, rgb, 0.45, o.beam);
      K.nova(game, p, id, x, y, r, Object.assign({ rgb, shake: 5 }, o, { delay: 0 }));
    });
  };

  // ---------------- buffs ----------------
  // a timed buff on the hero (its stat changes: SK[id].buff(lv), read by skilltree.js); dur defaults to SK[id].dur(lv)
  K.startBuff = function (game, p, id, lv, dur) {
    const S = SK[id];
    if (!p.buffs) p.buffs = {};
    if (!p.buffLv) p.buffLv = {};
    p.buffs[id] = dur || (S.dur ? S.dur(lv) : 20);
    p.buffLv[id] = lv;
    NC.applyGear(game);
    return p.buffs[id];
  };
  K.buffOn = (p, id) => p.buffs && p.buffs[id] > 0;
  // a buff for the AI friends too: they hit harder (party.js strike reads bless / blessK) or take less (guardK)
  K.buffFriends = function (game, p, o) {
    for (const a of K.friends(game, p, o.r || 520)) {
      if (o.atk) { a.bless = game.time + o.dur; a.blessK = Math.max(a.blessK && a.bless > game.time ? a.blessK : 1, o.atk); }
      if (o.guard) { a.guardUntil = game.time + o.dur; a.guardK = o.guard; }
      if (o.heal) K.heal(game, a, o.heal(a), { quiet: true });
      K.buffFx(game, a, o.rgb || C.holy, { flash: false, r: 120 });
    }
  };

  // ---------------- small looks used by many skills ----------------
  K.slashAt = (x, y, r, ang, pal, rgb, o) => V.slash(x, y, r, ang, (o && o.sweep) || 2.4, (o && o.thick) || 30, pal, (o && o.life) || 0.3, Object.assign({ rgb }, o || {}));
  K.flames = function (x, y, n, spread, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), d = rand(0, spread);
      V.flameAt(x + Math.cos(a) * d, y + Math.sin(a) * d * V.SQ, rand(28, 44) * (o.k || 1), rand(50, 90) * (o.k || 1), o.pal || P.fire, rand(0.35, 0.6), { vy: -60 });
    }
  };
  K.spikes = function (x, y, n, spread, pal, rgb, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), d = rand(0, spread);
      V.spikeAt(x + Math.cos(a) * d, y + Math.sin(a) * d * V.SQ, rand(24, 36) * (o.k || 1), rand(56, 100) * (o.k || 1), pal, rand(0.9, 1.2), { glowA: 0.35, rgb, rise: 0.08, sink: true });
    }
  };
})();
