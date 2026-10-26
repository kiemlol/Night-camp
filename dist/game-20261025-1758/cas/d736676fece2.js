/* pets.js — the hero's summons: the wolf hunter's wolf (it stays until it falls; the higher its skill, the bigger and
   stronger it grows), the dragon knight's baby wyvern and the warlock's lantern spirit (for a while). Each follows the
   hero, picks the monster nearest him, and fights its own way (the skill file that summons it says how: o.act);
   monsters may turn on the wolf (it is one of party.js's actors, so they chase and hit it like a friend).
   Pets.summon(game, p, type, o): o = { skill, lv, scale, hp (x the hero's max HP), dur (seconds, or none: until it falls),
   act(game, pet, e) (its attack on e, every o.every seconds when in reach), name, glow (rgb) }.
   Drawn and updated through party.js's hooks (update / collect / draw / drawTags / onMap). Art: assets/class2/pet_*
   (Codex, tools/monster_cut.py; drawn facing left like the monsters). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  const TAU = Math.PI * 2, rand = NC.rand, dist = NC.dist;
  const alive = (e) => e && !e.dead && e.hp > 0;
  const Pets = (NC.Pets = { list: [] });

  // a (sprite A), b (sprite B), fly (height above the ground), speed, r (body), reach (to attack from), solid (monsters can
  // hit it), shadow [rx, ry]
  const KINDS = {
    wolf: { a: 'pet_wolf', b: 'pet_wolf_b', fly: 0, speed: 380, r: 24, reach: 95, solid: true, shadow: [32, 10] },
    wyvern: { a: 'pet_wyvern', b: 'pet_wyvern_b', fly: 105, speed: 330, r: 20, reach: 460, solid: false, shadow: [22, 7] },
    lantern: { a: 'pet_lantern', b: 'pet_lantern_b', fly: 78, speed: 300, r: 18, reach: 380, solid: false, shadow: [16, 6] },
  };
  Pets.KINDS = KINDS;

  // online (?online) every summon is the server's (js/online-pets.js puts them in the list from its snapshots): a cast's
  // look (game.presentationOnly) or another player's replayed cast (js/net.js) gets a summon to read and nothing more - no
  // fight of its own, no place in the list, no look (the server's `pet` event plays that where its summon comes in)
  const serverOwns = (game) => !!(game && game.presentationOnly) || !!(NC.Online && NC.Online.enabled);
  Pets.summon = function (game, p, type, o) {
    const standIn = serverOwns(game);
    if (!standIn) Pets.dismiss(type, true);
    const T = KINDS[type], maxHp = Math.max(30, Math.round(p.maxHp * (o.hp || 0.4)));
    const q = {
      kind: 'ally', pet: true, type, T, owner: p, skill: o.skill, lv: o.lv || 1, name: o.name || '', every: o.every || 1, act: o.act, glow: o.glow,
      x: p.x - p.face * 70, y: p.y + 14, r: T.r, sort: p.y, face: p.face, anim: rand(0, 5), moving: false, lunge: 0, fire: 0,
      target: null, atkT: 0.4, dead: 0, inv: 0.8, hurt: 0, hp: maxHp, maxHp, scale: o.scale || 1, fade: 0,
      until: o.dur ? game.time + o.dur : Infinity, lastFight: -99, pose: true,
      d: { flee: 0, pdodge: 0, def: 0, vdef: 0, mdef: 0, armorElement: 'neutral' },
      onFaint(game, a) { Pets.dismiss(a.type); NC.HUD.log(`${a.name || 'ผู้ช่วย'}หมดแรง · เรียกใหม่ได้เมื่อสกิลพร้อม`, 'warn'); },
    };
    if (standIn) return q;
    Pets.list.push(q);
    Pets.summonLook(q.x, q.y, o.glow);
    return q;
  };
  // the looks of a summon's coming and going (the online client draws the server's with them, js/online-pets.js)
  Pets.summonLook = function (x, y, glow) {
    V.ring(x, y, 20, 150, 10, glow || '255,236,170', 0.5);
    V.smoke(x, y - 30, 8, '#e8e4f4', '#ffffff', { size: 0.9, lifeK: 0.7 });
    V.stars(x, y - 60, 10, '#fff0b0', glow || '255,236,170', { speed: 220 });
  };
  Pets.dismissLook = function (x, y, glow) {
    V.smoke(x, y - 30, 8, '#d8d4e4', '#ffffff', { size: 0.9, lifeK: 0.7 });
    V.motes(x, y - 40, 10, glow || '255,236,170', { spread: 40, rise: 120 });
  };
  Pets.dismiss = function (type, quiet) {
    for (let i = Pets.list.length - 1; i >= 0; i--) {
      const q = Pets.list[i];
      if (type && q.type !== type) continue;
      if (q.remote) continue; // (the server's goes with its record only: js/online-pets.js)
      Pets.list.splice(i, 1);
      if (!quiet) Pets.dismissLook(q.x, q.y - q.T.fly, q.glow);
    }
  };
  Pets.get = (type) => Pets.list.find((q) => q.type === type) || null;
  Pets.targets = () => Pets.list.filter((q) => q.T.solid && q.dead <= 0);

  // ---------------- what they do ----------------
  function pickTarget(game, q) {
    const p = q.owner;
    if (alive(q.target) && dist(q.target.x, q.target.y, p.x, p.y) < 700) return q.target;
    let best = null, bd = 480;
    for (const e of game.enemies) {
      if (!alive(e)) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // online a summon is the server's (js/online-pets.js): it only eases to where the server has it and counts its looks
  function remoteStep(q, dt) {
    q.anim += dt; q.inv = Math.max(0, q.inv - dt); q.hurt = Math.max(0, q.hurt - dt);
    q.lunge = Math.max(0, q.lunge - dt); q.fire = Math.max(0, q.fire - dt);
    q.fade = Math.min(1, q.fade + dt * 4);
    const k = Math.min(1, dt * 12);
    q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; q.sort = q.y;
  }
  function update(game, q, dt) {
    if (q.remote) return remoteStep(q, dt);
    const p = q.owner, T = q.T;
    q.anim += dt; q.inv = Math.max(0, q.inv - dt); q.hurt = Math.max(0, q.hurt - dt);
    q.lunge = Math.max(0, q.lunge - dt); q.fire = Math.max(0, q.fire - dt);
    q.fade = Math.min(1, q.fade + dt * 4);
    if (game.time > q.until || p.dead > 0) { Pets.dismiss(q.type); return; }
    // a long way off (a portal, a dash): it catches up at once
    if (dist(q.x, q.y, p.x, p.y) > 760) { q.x = p.x - p.face * 70; q.y = p.y + 14; V.smoke(q.x, q.y - 30, 5, '#e8e4f4', '#ffffff', { size: 0.7, lifeK: 0.5 }); }
    // it heals slowly while nothing hits it
    if (game.time - q.lastFight > 4) q.hp = Math.min(q.maxHp, q.hp + q.maxHp * 0.03 * dt);
    const d = p.d || {};
    Object.assign(q.d, { flee: d.flee || 0, def: Math.round((d.def || 0) * 0.8), vdef: d.vdef || 0, mdef: d.mdef || 0 });
    const e = (q.target = pickTarget(game, q));
    let gx, gy, spd = T.speed;
    if (e) {
      const a = NC.angle(e.x, e.y, q.x, q.y), want = T.reach * 0.8;
      gx = e.x + Math.cos(a) * want; gy = e.y + Math.sin(a) * want * 0.6;
      q.face = e.x > q.x ? 1 : -1;
      q.atkT -= dt;
      if (q.atkT <= 0 && dist(q.x, q.y, e.x, e.y) < T.reach + e.r) {
        q.atkT = q.every / Math.max(0.5, (p.d && p.d.aspdMul) || 1) * (q.fast || 1);
        q.lastFight = game.time;
        if (q.act) q.act(game, q, e);
        if (T.solid && !e.tgt && Math.random() < 0.3) { e.tgt = q; e.tgtLock = game.time + 2; }
      }
    } else { gx = p.x - p.face * 80; gy = p.y + 18; spd *= 0.9; }
    const dx = gx - q.x, dy = gy - q.y, l = Math.hypot(dx, dy);
    q.moving = l > 14;
    if (q.moving) {
      const step = Math.min(l, spd * dt * (l > 300 ? 1.4 : 1));
      if (T.fly) { q.x += (dx / l) * step; q.y += (dy / l) * step; } else NC.tryMove(game.world, q, (dx / l) * step, (dy / l) * step);
      if (!e && Math.abs(dx) > 8) q.face = dx > 0 ? 1 : -1;
    }
    q.sort = q.y;
  }
  const baseUpdate = NC.Party.update;
  NC.Party.update = function (game, dt) {
    baseUpdate(game, dt);
    for (const q of Pets.list.slice()) update(game, q, dt);
  };
  const baseOnMap = NC.Party.onMap;
  NC.Party.onMap = function (game) {
    baseOnMap(game);
    const p = game.player;
    for (const q of Pets.list) { q.x = p.x - p.face * 70; q.y = p.y + 14; q.target = null; }
  };

  // ---------------- drawing (among the characters, by their feet) ----------------
  const baseCollect = NC.Party.collect;
  NC.Party.collect = function (list, visible) {
    baseCollect(list, visible);
    for (const q of Pets.list) if (visible(q.x - 120, q.y - 220, q.x + 120, q.y + 40)) list.push(q);
  };
  const baseDraw = NC.Party.draw;
  NC.Party.draw = function (ctx, game, o) {
    if (!o.pet) return baseDraw(ctx, game, o);
    const q = o, T = q.T, t = q.anim;
    let name = T.a, y = q.y, rot = 0, sy = 1;
    if (q.type === 'wolf') {
      if (q.lunge > 0) { name = T.b; rot = -0.08; }
      else if (q.moving) { name = Math.floor(t * 8) % 2 ? T.b : T.a; y -= Math.abs(Math.sin(t * 16)) * 5; }
      else sy = 1 + Math.sin(t * 2.4) * 0.02;
    } else {
      y -= T.fly + Math.sin(t * 3) * 7;
      if (q.type === 'wyvern') name = q.fire > 0 ? T.b : Math.floor(t * 6) % 2 ? T.b : T.a;
      else name = q.fire > 0 ? T.b : T.a;
    }
    if (q.glow) V.glow(ctx, q.x, y - 26 * q.scale, 70 * q.scale, q.glow, q.type === 'lantern' ? 0.55 : 0.28, false);
    if (q.aura) q.aura(ctx, q, y);
    const tint = q.hurt > 0 ? ['#ff5a5a', (q.hurt / 0.3) * 0.6] : q.tint || null;
    NC.drawSpr(ctx, name, q.x, y, { flip: q.face > 0, scale: q.scale, rot: rot * q.face, sy, tint, alpha: q.fade * (q.inv > 0 && Math.floor(game.time * 20) % 2 ? 0.6 : 1) });
  };
  // the wolf's health under it; the others' time left as a thin ring
  const baseTags = NC.Party.drawTags;
  NC.Party.drawTags = function (ctx, game) {
    baseTags(ctx, game);
    for (const q of Pets.list) {
      const w = 64, x = q.x - w / 2, y = q.y + 16;
      if (q.T.solid) {
        const f = Math.max(0, q.hp / q.maxHp);
        ctx.save();
        ctx.fillStyle = 'rgba(20,16,28,0.8)'; ctx.fillRect(x - 2, y - 2, w + 4, 11);
        ctx.fillStyle = f > 0.5 ? '#6ad36a' : f > 0.25 ? '#f2c14e' : '#ee5a5a'; ctx.fillRect(x, y, w * f, 7);
        ctx.restore();
        if (NC.drawTag && q.name) NC.drawTag(ctx, q.name, q.x, y + 28, 18, '#ffe7b0');
      } else if (q.until < Infinity && NC.drawTag) NC.drawTag(ctx, `${Math.ceil(q.until - game.time)}`, q.x, q.y - q.T.fly - 70 * q.scale, 16, '#d6f5ff');
    }
  };
})();
