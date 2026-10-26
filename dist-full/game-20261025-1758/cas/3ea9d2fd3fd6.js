/* entities.js — player, enemies, combat */
(function () {
  'use strict';
  const NC = window.NC;
  const FX = NC.FX;
  const TAU = Math.PI * 2;

  const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);

  // Sweep the whole move in short steps, including fast dashes and blinks, sliding along walls.
  NC.tryMove = function (world, e, dx, dy, rush) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const steps = Math.ceil(Math.hypot(dx, dy) / 8);
    if (!steps) return;
    dx /= steps; dy /= steps;
    const fits = (x, y) => rush ? NC.dashFits(world, x, y, e.r) : e.kind === 'enemy' ? NC.terrainFits(world, x, y, e.r) : world.fits(x, y, e.r);
    for (let i = 0; i < steps; i++) {
      if (dx && fits(e.x + dx, e.y)) e.x += dx;
      if (dy && fits(e.x, e.y + dy)) e.y += dy;
      if (rush && world.fits(e.x, e.y, e.r)) { rush.safeX = e.x; rush.safeY = e.y; }
    }
  };

  NC.finishRush = function (world, p, rush) {
    if (!world.fits(p.x, p.y, p.r) && Number.isFinite(rush.safeX) && Number.isFinite(rush.safeY)) {
      p.x = rush.safeX; p.y = rush.safeY;
    }
  };
  NC.rushMove = function (world, p, dx, dy, state) {
    const rush = state || {};
    if (!Number.isFinite(rush.safeX)) { rush.safeX = p.x; rush.safeY = p.y; }
    NC.tryMove(world, p, dx, dy, rush);
    if (!state) NC.finishRush(world, p, rush);
  };

  // Manual walking uses the same short paths as Auto when a prop blocks the held direction.
  // Return a direction only: online prediction and the server must receive the same input.
  const walkingRoutes = new WeakMap();
  NC.walkDirection = function (game, mx, my) {
    // The current client uses upstream passprops.js; retain this hook for the legacy online client.
    if (NC.PassProps && NC.PassProps.on) return [mx, my];
    const length = Math.hypot(mx, my), p = game.player, w = game.world;
    if (!length) { walkingRoutes.delete(p); return [0, 0]; }
    mx /= length; my /= length;
    if ((NC.Auto && NC.Auto.on) || (NC.Travel && NC.Travel.on) || !(NC.Auto && NC.Auto.findPath)) return [mx, my];
    const clear = (x, y) => {
      const n = Math.ceil(Math.hypot(x - p.x, y - p.y) / 8);
      for (let i = 1; i <= n; i++) if (!w.fits(p.x + (x - p.x) * i / n, p.y + (y - p.y) * i / n, p.r || 20)) return false;
      return true;
    };
    let route = walkingRoutes.get(p);
    if (route && (route.world !== w || route.mx * mx + route.my * my < .99)) { walkingRoutes.delete(p); route = null; }
    if (route && clear(route.x, route.y)) { walkingRoutes.delete(p); return [mx, my]; }
    if (!route && clear(p.x + mx * 32, p.y + my * 32)) return [mx, my];
    if (!route || game.time >= route.until) {
      const x = route ? route.x : p.x + mx * 160, y = route ? route.y : p.y + my * 160;
      const path = NC.Auto.findPath(game, p.x, p.y, x, y, 480);
      // A short detour must really reach the other side. Walls and map edges still stop walking.
      route = { world: w, mx, my, x, y, path: path && path.gap === 0 ? path : null, i: 0, until: game.time + .5 };
      walkingRoutes.set(p, route);
    }
    if (!route.path) return [mx, my];
    while (route.i < route.path.length - 1 && clear(...route.path[route.i + 1])) route.i++;
    const point = route.path[route.i], dx = point[0] - p.x, dy = point[1] - p.y, d = Math.hypot(dx, dy);
    return d > 1 ? [dx / d, dy / d] : [mx, my];
  };

  // ======================= player =======================
  NC.makePlayer = function (x, y) {
    return {
      kind: 'player', x, y, r: 20, vx: 0, vy: 0, face: 1, aim: 0, sort: y,
      lv: 1, xp: 0, hp: 40, maxHp: 40, sp: 10, maxSp: 10, potions: 0, spPotions: 0, name: '', job: 'traveler', jobLv: 1, jobXp: 0,
      atk: { on: false, step: 0, name: null, ang: 0, queued: false, cd: 0, lastEnd: -9, chain: -1, lunge: 0 },
      anim: NC.Anim.makeState(), pose: null, trail: [], moves: { idle: 'idle', set: 'basic' }, // move sets (animation lab)
      cd: { q: 0, e: 0, r: 0, f: 0, pot: 0, sppot: 0 }, cdFull: { q: 7, e: 3.5, r: 9, f: 40 }, buffs: {}, skillLock: 0, channel: null,
      equip: { hat: null, hair: 'hair_spiky', top: 'top_traveler', pants: 'pants_traveler', weapon: 'sword' },
      owned: new Set(), fresh: new Set(),
      stats: {}, base: null, skills: null, d: null, // gear bonuses, base stats, skill levels, combat values (stats.js)
      dash: null, inv: 0, hurt: 0, walk: 0, moving: false, dead: 0, combat: 0, lastFight: -99,
    };
  };

  const SHOULDER = (p) => ({ x: p.x - p.face * 10, y: p.y - 70 }); // the near shoulder: attacks start from here

  // one hit of the combo with the equipped weapon: its own reach, arc, damage, knockback and effect.
  // The third hit is the finisher: more damage and knockback, a longer hit-stop and a bigger impact.
  // A clip can ask for another hit shape: 'path' (everything along a dash), 'around' (a spin), 'slam' (a ground
  // shockwave), 'arc' (a swing even with a spear), 'fan' / 'nova' (bolts); hitMul splits a clip's damage over its hits.
  // A volley shares the move's power: each of the finisher's three bolts / arrows does half, a fan 1.5 / n, a nova's
  // ring 60%. W.hitK: the weapon's own basic-attack power (balance, 2026-09-27: a slow heavy swing hits much harder,
  // so the combos of all weapons come out even; skills don't use it).
  const STEP = [{ dmg: 1, kb: 1, stop: 0.045 }, { dmg: 1.15, kb: 1.1, stop: 0.05 }, { dmg: 1.8, kb: 1.8, stop: 0.1 }];
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = NC.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - ax - dx * u, py - ay - dy * u);
  };
  function weaponHit(game, p, W, step, clip) {
    const M = STEP[step], fin = step === 2, shape = clip && clip.hitShape, mul = (clip && clip.hitMul) || 1;
    const ang = p.atk.ang, cx = Math.cos(ang), cy = Math.sin(ang), sh = SHOULDER(p);
    const B = p.buffs || {}, fire = B.fireblade > 0 ? 'fire' : undefined, sure = B.shadow > 0, hk = W.hitK || 1;
    const dmg = (e, k = 1) => {
      const r = W.magic
        ? NC.heroHit(p.d, e, { kind: 'magic', mul: M.dmg * mul * k * hk * (W.matkMul || 0.45) * (1 + (p.stats.atk || 0)), flat: NC.rand(W.dmg[0], W.dmg[1]) * M.dmg * mul, element: fire })
        : NC.heroHit(p.d, e, { kind: 'phys', mul: M.dmg * mul * k * hk, element: fire, crit: sure });
      if (sure && !r.miss) B.shadow = 0; // (the sure critical is spent)
      if (fire && NC.VFX) NC.VFX.flameAt(e.x + NC.rand(-20, 20), e.y - 30, 26, 50, NC.VFX.PAL.fire, 0.35, { vy: -80 });
      return r;
    };
    const opts = { stun: W.stun, big: fin };
    const line = p.pose && NC.weaponLine(p.equip, p.pose, p.x, p.y);
    const tip = line ? line.tip : [sh.x + cx * 80, sh.y + cy * 80];
    if (W.style === 'throw' && NC.throwWeapon) return NC.throwWeapon(game, p, W, step, clip, dmg, opts, M); // (a thrown weapon, the ninja's huuma: js/throwstar.js)
    if (W.style === 'bolt' || W.style === 'arrow') {
      // one bolt, three for the finisher, a fan, or a ring bursting out of the ground (nova); a bow looses arrows from
      // its grip instead of magic from the staff's tip
      const arrow = W.style === 'arrow', v = arrow ? 1150 : 980, from = arrow && line ? line.hand : tip;
      const nova = shape === 'nova', n = nova ? 12 : shape === 'fan' ? clip.fan[0] : fin ? 3 : 1;
      const spread = shape === 'fan' ? clip.fan[1] : 0.2, each = nova ? 0.6 : Math.min(1, 1.5 / n);
      for (let i = 0; i < n; i++) {
        const off = nova ? (i / n) * TAU : (i - (n - 1) / 2) * spread;
        const a = ang + off, bx = Math.cos(a), by = Math.sin(a) * (nova ? 0.62 : 1), rad = arrow ? 30 : fin ? 44 : 34;
        FX.add({
          type: arrow ? 'arrow' : 'bolt', x: from[0], y: from[1] - (nova ? 30 : 0), vx: bx * v, vy: by * v, life: W.range / v, big: fin,
          update(o2) {
            for (const e of game.enemies)
              if (NC.dist(o2.x, o2.y, e.x, e.y - 45) < rad + e.r) {
                NC.damageEnemy(game, e, dmg(e, each), bx * W.kb * M.kb, by * W.kb * M.kb, Object.assign({ color: arrow ? '255,235,200' : '150,220,255' }, opts));
                o2.dead = true;
                if (arrow) FX.sparks(o2.x, o2.y, 6, '255,240,210');
                else { FX.ring(o2.x, o2.y, 8, fin ? 110 : 80, '150,220,255', 0.3, 8); FX.stars(o2.x, o2.y, 5, '170,230,255', { speed: 180, size: 0.6 }); }
                return;
              }
            if (NC.shotWall(game.world, o2.x, o2.y + 60)) { o2.dead = true; FX.puff(o2.x, o2.y, 3, { speed: 60, size: 0.5, color: '160,210,255' }); }
          },
        });
      }
      if (!arrow) FX.ring(tip[0], tip[1], 6, nova ? 260 : fin ? 70 : 40, '150,220,255', nova ? 0.5 : 0.25, nova ? 14 : fin ? 9 : 6);
      if (fin) game.shake = Math.max(game.shake, nova ? 12 : 6);
      return;
    }
    const reach = W.reach + (fin ? (W.style === 'thrust' ? 60 : 25) : 0), arc = W.arc + (fin ? 0.25 : 0);
    const ground = [tip[0], p.y + cy * 30], A = p.atk, hits = [];
    let any = false;
    for (const e of game.enemies) {
      let hit;
      if (shape === 'path') {
        hit = segDist(e.x, e.y - 30, A.x0, A.y0 - 30, p.x, p.y - 30) < 75 + e.r;
      } else if (shape === 'around') {
        hit = NC.dist(p.x, p.y - 30, e.x, e.y - 30) < reach + e.r;
      } else if (shape === 'slam') {
        hit = NC.dist(ground[0], ground[1], e.x, e.y) < (clip.slamR || 190) + e.r;
      } else if (shape === 'arc') {
        hit = NC.dist(p.x, p.y - 30, e.x, e.y - 30) < reach + e.r && angDiff(NC.angle(p.x, p.y - 30, e.x, e.y - 30), ang) < Math.max(arc, 1.2);
      } else if (W.style === 'thrust') {
        const dx = e.x - p.x, dy = e.y - 30 - (p.y - 40);
        const along = dx * cx + dy * cy, side = Math.abs(-dx * cy + dy * cx);
        hit = along > -10 && along < reach + e.r && side < 46 + e.r;
      } else if (W.style === 'smash' && fin) {
        hit = NC.dist(ground[0], ground[1], e.x, e.y) < 190 + e.r; // shockwave around the impact
      } else {
        hit = NC.dist(p.x, p.y - 30, e.x, e.y - 30) < reach + e.r && angDiff(NC.angle(p.x, p.y - 30, e.x, e.y - 30), ang) < arc;
      }
      if (hit) hits.push(e);
    }
    // (?rotime, js/rotiming.js: a swing is for one, as in classic MMOs: the nearest takes it all, the others NC.roSplash of
    // it, more for a combo's shaped blow and with a geared weapon swinging only; skills do the area work)
    const sk = NC.RO_TIME && NC.roSplash ? NC.roSplash(p, !!shape) : 1;
    if (sk < 1 && hits.length > 1) hits.sort((a, b) => NC.dist(tip[0], tip[1], a.x, a.y - 30) - NC.dist(tip[0], tip[1], b.x, b.y - 30));
    hits.forEach((e, i) => {
      any = true;
      let kx = cx, ky = cy;
      if (shape === 'around' || shape === 'slam') { const a = NC.angle(p.x, p.y, e.x, e.y); kx = Math.cos(a); ky = Math.sin(a); }
      NC.damageEnemy(game, e, dmg(e, i ? sk : 1), kx * W.kb * M.kb, ky * W.kb * M.kb, opts);
      if (shape === 'path') { FX.slash(e.x, e.y - 50, ang - 0.6, 70, '235,245,255', 1); FX.sparks(e.x, e.y - 50, 6, '220,240,255'); }
    });
    if (shape === 'path') {
      FX.add({ type: 'cutline', x: A.x0, y: A.y0 - 55, x1: p.x + cx * 40, y1: p.y - 55 + cy * 40, w: 16, color: '170,215,255', life: 0.35 });
      game.shake = Math.max(game.shake, 9);
    } else if (shape === 'around') {
      FX.ring(p.x, p.y - 20, 20, reach, W.trailRgb || '215,235,255', 0.3, 8);
    } else if (shape === 'slam') {
      FX.ring(ground[0], ground[1], 10, (clip.slamR || 190) + 40, '255,232,190', 0.5, 16);
      FX.puff(ground[0], ground[1], 12, { speed: 250, color: '200,195,210' });
      game.shake = Math.max(game.shake, 14);
    } else if (W.style === 'thrust' && shape !== 'arc') FX.add({ type: 'thrust', x: sh.x + cx * 30, y: sh.y + 10 + cy * 30, ang, len: reach, life: 0.18 });
    else if (W.style === 'smash' && !shape) {
      FX.ring(ground[0], ground[1], 10, fin ? 240 : 150, '255,225,170', fin ? 0.5 : 0.35, fin ? 16 : 12);
      FX.puff(ground[0], ground[1], fin ? 12 : 7, { speed: fin ? 240 : 170, color: '200,195,210' });
      game.shake = Math.max(game.shake, fin ? 14 : 9);
    } else if (fin && !shape) {
      FX.ring(ground[0], ground[1], 10, 150, '255,240,200', 0.35, 10);
      FX.puff(ground[0], ground[1], 6, { speed: 150, color: '210,205,220' });
      game.shake = Math.max(game.shake, 10);
    }
    if (any) game.hitstop = Math.max(game.hitstop, M.stop + (W.style === 'smash' || W.twoHanded ? 0.02 : 0));
  }
  NC.weaponHit = weaponHit; // (js/swingkeep.js lands the blows of a swing a skill cut short)

  function startAttack(game, p, W, step) {
    const A = p.atk;
    A.serial = (A.serial || 0) + 1;
    A.on = true; A.step = step; A.queued = false; A.ang = p.aim; A.lunge = 0; A.x0 = p.x; A.y0 = p.y;
    A.name = NC.Anim.setOf(NC.Anim.movesFor(p.moves, W)).combo(W.style)[step];
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    p.combat = 1; p.lastFight = game.time; // straight into the fighting stance
    NC.Anim.play(p.anim, A.name);
  }

  // One frame of a dash: the move, the afterimages, the monsters it runs through, the skill's own tick and end.
  // Shared with the online client's presentation of a dash (online.js tickPresentation).
  NC.stepDash = function (game, p, dt) {
    const d = p.dash;
    const elapsed = Math.min(dt, Math.max(0, d.dur - d.t));
    d.t += elapsed;
    NC.rushMove(game.world, p, d.vx * elapsed, d.vy * elapsed, d);
    if (d.t >= d.dur) NC.finishRush(game.world, p, d);
    if ((d.ghost -= dt) <= 0) {
      d.ghost = 0.028;
      if (p.pose) FX.add({ type: 'hero', x: p.x, y: p.y, equip: Object.assign({}, p.equip), pose: Object.assign({}, p.pose), color: '#9dff8f', life: 0.28 });
    }
    for (const e of game.enemies)
      if (!d.hit.has(e) && NC.dist(p.x, p.y, e.x, e.y) < 75 + e.r) { d.hit.add(e); if (d.hitFn) d.hitFn(game, e); }
    if (d.tick) d.tick(game, p, d, dt);
    if (d.t >= d.dur) { p.dash = null; if (d.end) d.end(game, p, d); }
    p.sort = p.y;
  };

  NC.updatePlayer = function (game, dt) {
    const p = game.player, input = game.input, world = game.world;
    for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
    // natural recovery (classic-MMO-like: VIT / INT and the recovery skills; half as fast while fighting)
    if (p.dead <= 0 && p.d) {
      const k = p.combat > 0.5 ? 0.5 : 1;
      p.hp = Math.min(p.maxHp, p.hp + p.d.hpRegen * k * dt);
      p.sp = Math.min(p.maxSp, p.sp + p.d.spRegen * k * dt);
    }
    p.atk.cd = Math.max(0, p.atk.cd - dt);
    p.inv = Math.max(0, p.inv - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    // fighting stance: on while attacking and for a moment after the last attack (the weapon leaves the belt/back)
    const fighting = p.atk.on || game.time - p.lastFight < 1.6;
    p.combat += ((fighting ? 1 : 0) - p.combat) * Math.min(1, dt * 8);

    if (p.dead > 0) {
      // the buffs go with the fall (2026-10-20, the owner: "บัฟค้างนะ เวลาตายทำให้บัฟหายด้วย"): they stood still while he lay
      // there (the skills' clock below is skipped) and came back with him. Online the server's fall empties its own too
      // (patch 022 buffs_on_death.go); this runs online as well (online/world.js keeps this update for a fallen hero)
      if (p.buffs) for (const k in p.buffs) if (p.buffs[k] > 0) p.buffs[k] = 0;
      p.dead -= dt;
      if (p.dead <= 0) {
        p.x = world.spawn.x; p.y = world.spawn.y; p.hp = p.maxHp; p.sp = p.maxSp; p.inv = 2;
        FX.ring(p.x, p.y, 20, 160, '255,230,150', 0.8);
        game.toast('ฟื้นคืนชีพที่ค่าย');
      }
      return;
    }

    // aim: mouse if it moved recently, otherwise the walking direction
    const [mx, my] = NC.walkDirection(game, input.mx, input.my);
    p._walkInput = [mx, my]; // legacy online input; current client uses passprops.js steering
    if (game.mouse.active) p.aim = NC.angle(p.x, p.y - 50, game.mouse.wx, game.mouse.wy);
    else if (mx || my) p.aim = Math.atan2(my, mx);

    // buffs and channels (skills.js); a channel (a charge, a flurry) holds the hero
    NC.updateSkills(game, dt);
    // 1: red potion (HP), 2: blue potion (SP) — js/potions.js picks the size (three of each since 2026-10-04). Read before a
    // channel holds him (Discord #161 / #182, 2026-10-21: no potion during the berserker's spin or a cast bar)
    if (input.potion) NC.drinkPotion(game, p, 'red');
    if (input.sppotion) NC.drinkPotion(game, p, 'blue');
    if (p.channel) { p.sort = p.y; return; }

    // dash (the traveler's E: skills.js sets it up and gives it its looks)
    if (p.dash) { NC.stepDash(game, p, dt); return; }

    // walking
    const W = NC.weaponDef(p);
    const slow = p.atk.on ? W.slow || 0.45 : p.skillLock > 0 ? 0.4 : 1;
    const spd = 310 * slow * (1 + p.d.spd);
    const k = 1 - Math.exp(-dt * 14);
    p.vx += (mx * spd - p.vx) * k;
    p.vy += (my * spd - p.vy) * k;
    (NC.walkMove || NC.tryMove)(world, p, p.vx * dt, p.vy * dt); // (js/passprops.js: round a rock or a trunk in the way)
    const speed = Math.hypot(p.vx, p.vy);
    p.moving = speed > 40;
    // facing (the user, 2026-10-18: facing the mouse while walking the other way was a moonwalk): walking sideways
    // turns him the way he goes; fighting with the mouse (the attack held, a swing on or just over, a skill's lock)
    // keeps him on the aim; otherwise the mouse turns him when it moves
    const ms = game.mouse, mMoved = ms.sx !== p._msx || ms.sy !== p._msy;
    p._msx = ms.sx; p._msy = ms.sy;
    const fight = input.attack || ms.down || p.atk.on || p.skillLock > 0 || game.time - p.atk.lastEnd < 0.4;
    const fx = ms.active && fight ? Math.cos(p.aim) : Math.abs(mx) > 0.15 ? mx : ms.active && mMoved ? Math.cos(p.aim) : 0;
    if (Math.abs(fx) > 0.15 && !p.atk.on) p.face = fx > 0 ? 1 : -1;
    // walking off away from where he faces (fighting on the move): he steps BACK, the walk cycle run backwards (never
    // a run), not forward steps sliding the wrong way
    p.back = p.moving && p.vx * p.face < -40 && Math.abs(p.vx) > speed * 0.35;
    // fast: run, slow (attacking, slowed): walk. The legs cycle as fast as the ground goes by, so the planted foot
    // doesn't slide: a run stance covers ~40 px in 42% of a cycle, a walk step ~37 px in half of one
    p.running = p.moving && !p.back && speed > (p.running ? 170 : 210);
    if (p.moving) p.walk += dt * speed * (p.running ? 0.0663 : 0.085) * (p.back ? -1 : 1);
    p.sort = p.y;

    // basic attack: a 3-hit combo. A press during an attack is buffered and chains into the next hit once the
    // clip reaches its cancel point; pressing again soon after a combo hit (not the finisher) continues it too.
    const want = input.attack || game.mouse.down, A = p.atk;
    if (A.on) {
      const clip = NC.Anim.CLIPS[A.name];
      if (want && p.anim.actT > 0.04) A.queued = true;
      if (A.queued && clip.cancel && p.anim.actT >= clip.cancel && A.step < 2) startAttack(game, p, W, A.step + 1);
    } else if (want && A.cd <= 0 && !(p.skillLock > 0)) {
      startAttack(game, p, W, game.time - A.lastEnd < 0.5 && A.chain >= 0 && A.chain < 2 ? A.chain + 1 : 0);
    }

    // skills: Q E R and the ultimate F (the job's, or the boss set's): skills.js
    for (const k of NC.HOTKEYS || ['q', 'e', 'r', 'f']) if (input[k] && !p.dash) NC.castSkill(game, p, k); // the 8 hotbar slots (skilltree.js)
  };
  // the one-size potion of before (js/potions.js replaces it): 25% of HP / SP, at least 30 / 15
  NC.drinkPotion = function (game, p, color) {
    const red = color === 'red', cd = red ? 'pot' : 'sppot', key = red ? 'potions' : 'spPotions', stat = red ? 'hp' : 'sp', max = red ? p.maxHp : p.maxSp;
    if (p.cd[cd] > 0 || !(p[key] > 0) || p[stat] >= max) return false;
    p.cd[cd] = 0.8; p[key]--;
    const heal = Math.round(Math.min(Math.max(red ? 30 : 15, max * 0.25), max - p[stat]));
    p[stat] += heal;
    FX.num(p.x, p.y - 150, '+' + heal, { fill: red ? '#8dff8a' : '#8fc8ff', size: 42 });
    FX.stars(p.x, p.y - 60, 8, red ? '255,120,140' : '120,180,255', { speed: 140, size: 0.7 });
    return true;
  };

  // In place of wrapping NC.gainXp (2026-10-25: 10 wraps, their order kept): NC.xpFilters (game, n, jn) => [n, jn] before
  // it lands, the last added first (as the outermost wrap ran first: the guild's and the root wind's change before
  // the set's), and NC.xpWatchers (game, was) after, in the order added; was = the hero's lv, xp, jobLv and jobXp before
  // (the filters touch none of them). A file adds with (NC.xpFilters || (NC.xpFilters = [])).push(f).
  NC.gainXp = function (game, n, jn) {
    const p = game.player, was = { lv: p.lv, xp: p.xp, jobLv: p.jobLv, jobXp: p.jobXp };
    const filters = NC.xpFilters || [];
    for (let i = filters.length - 1; i >= 0; i--) [n, jn] = filters[i](game, n, jn);
    landXp(game, n, jn);
    for (const f of NC.xpWatchers || []) f(game, was);
  };
  function landXp(game, n, jn) {
    const p = game.player;
    if (p.lv < NC.LV_MAX) p.xp += n;
    if (p.jobLv < NC.jobMax(p)) p.jobXp += jn || 0;
    let up = false, baseUp = false;
    while (p.lv < NC.LV_MAX && p.xp >= NC.xpNext(p.lv)) {
      p.xp -= NC.xpNext(p.lv);
      const before = NC.statusLeft(p);
      p.lv++; up = baseUp = true;
      NC.applyGear(game); p.hp = p.maxHp; p.sp = p.maxSp;
      FX.text(p.x, p.y - 190, 'LEVEL UP!', '#ffd65c', 64);
      FX.ring(p.x, p.y - 10, 30, 230, '255,214,92', 0.7, 14);
      FX.stars(p.x, p.y - 60, 16, '255,220,110', { speed: 320 });
      NC.HUD.log(`เลเวลอัพ! Base Lv ${p.lv} · แต้มสเตตัส +${NC.statusLeft(p) - before}`, 'level');
    }
    if (p.lv >= NC.LV_MAX) p.xp = 0;
    while (p.jobLv < NC.jobMax(p) && p.jobXp >= NC.jobNext(p.jobLv, p)) {
      p.jobXp -= NC.jobNext(p.jobLv, p);
      p.jobLv++; up = true;
      FX.text(p.x, p.y - (baseUp ? 250 : 190), 'JOB LEVEL UP!', '#9fe0ff', 52);
      FX.stars(p.x, p.y - 60, 12, '160,220,255', { speed: 280 });
      NC.HUD.log(`Job เลเวลอัพ! Job Lv ${p.jobLv} · แต้มสกิล +1`, 'job');
      if (NC.canChangeJob(p)) NC.HUD.log(`Job Lv ${p.jobLv}! เปลี่ยนอาชีพได้แล้ว กด K เพื่อเลือกอาชีพ`, 'level');
    }
    if (p.jobLv >= NC.jobMax(p)) p.jobXp = 0;
    if (up && !p.atk.on && p.dead <= 0) NC.Anim.play(p.anim, 'cheer'); // a little victory pose
    NC.saveGame(game);
  }

  // a monster's hit on the hero (stats.js NC.monsterHit): a miss or a lucky dodge shows as such
  NC.monsterAttack = function (game, e) {
    const p = game.player;
    if (p.inv > 0 || p.dead > 0) return;
    // Contact blows obey the same terrain line as the hero's online attacks.
    // Trees are decoration, but water and walls stop a bite or swing across their edge.
    const steps = Math.ceil(NC.dist(e.x, e.y, p.x, p.y) / 12);
    for (let i = 1; i <= steps; i++) {
      if (!NC.terrainFits(game.world, e.x + (p.x - e.x) * i / steps, e.y + (p.y - e.y) * i / steps, 0)) return;
    }
    const r = NC.monsterHit(e, p.d);
    if (r.miss) { FX.num(p.x, p.y - 150, r.lucky ? 'Lucky!' : 'MISS', { fill: r.lucky ? '#ffe28a' : '#cfd8ff', size: 34 }); p.inv = 0.3; return; }
    NC.hurtPlayer(game, r.dmg, e.x);
  };

  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game.player;
    if (p.inv > 0 || p.dead > 0) return;
    if (p.buffs && p.buffs.guard > 0) { dmg = Math.max(1, Math.round(dmg * (1 - (p.guardRed || 0.3)))); if (NC.guardHit) NC.guardHit(game, p); }
    p.hp = Math.max(0, p.hp - dmg);
    p.inv = 0.55; p.hurt = 0.3;
    p.lastFight = game.time; // being hit also makes the hero draw the weapon
    game.shake = Math.max(game.shake, 9);
    FX.num(p.x, p.y - 150, dmg, { fill: '#ff6b6b', size: 42 });
    const dir = Math.sign(p.x - fromX) || 1;
    NC.tryMove(game.world, p, dir * 24, 0);
    if (p.hp <= 0) {
      p.dead = 2.6;
      FX.puff(p.x, p.y - 30, 10, { speed: 150, color: '120,110,140' });
      game.toast('หมดแรง... กำลังกลับไปที่ค่าย');
      NC.HUD.log('หมดแรง... กลับไปฟื้นที่ค่าย', 'warn');
    }
  };

  // ---------------- the hero's animation: picks the base clip, runs the combo, root motion, swing trail ----------------
  NC.updateHeroAnim = function (game, dt) {
    const p = game.player, st = p.anim, A = p.atk, W = NC.weaponDef(p), Anim = NC.Anim;
    // the player's move sets: how the hero stands around (idle style) and fights (the attack set's stance + combo)
    // (a weapon may bring its own: the greatsword is held low and has its own combo)
    const MV = Anim.movesFor(p.moves, W), IDLE = Anim.BASE[MV.idle] ? MV.idle : 'idle', SET = Anim.setOf(MV);
    const move = p.running ? (p.combat > 0.5 ? 'runReady' : 'run') : p.combat > 0.5 ? 'walkReady' : 'walk';
    const base = p.dead > 0 ? 'death' : p.dash ? 'dash' : p.moving ? move : p.combat > 0.5 ? SET.ready : IDLE;
    if (st.base === 'death' && base !== 'death') { st.from = null; st.base = base; st.baseT = 0; } // respawn: stand up at once
    Anim.setBase(st, base, base === 'dash' || base === 'death' ? 0.06 : 0.16);
    if (p.dead > 0 && st.act) { st.act = null; A.on = false; }
    // little idle fidgets now and then; dropped as soon as something else happens
    if (base === IDLE && !st.act) {
      const F = Anim.FIDGETS[IDLE];
      if ((st.fidgetT += dt) > st.nextFidget) { if (F && F.length) Anim.play(st, NC.pick(F)); st.fidgetT = 0; st.nextFidget = NC.rand(9, 16); }
    } else {
      st.fidgetT = 0;
      if (st.act && Anim.CLIPS[st.act].fidget && base !== IDLE) Anim.stop(st);
    }
    Anim.update(st, dt, A.on ? NC.atkSpeed(p, W) : 1, (ev, clip) => { // (AGI and the speed buffs play the swings faster)
      if (!A.on) return;
      const line = p.pose && NC.weaponLine(p.equip, p.pose, p.x, p.y);
      if (ev === 'hit') weaponHit(game, p, W, A.step, clip);
      else if (ev === 'charge') {
        if (line) { FX.ring(line.tip[0], line.tip[1], 70, 8, '150,220,255', 0.3, 7); FX.stars(line.tip[0], line.tip[1], 6, '170,230,255', { speed: 90, size: 0.6 }); }
      } else if (ev === 'glint' || ev === 'sheathe') {
        // light catching the blade at the hilt: before the dash, and the click of the sheath at the end
        if (line) {
          FX.stars(line.hand[0], line.hand[1], ev === 'glint' ? 3 : 2, '235,245,255', { speed: 50, size: ev === 'glint' ? 0.9 : 0.6 });
          FX.ring(line.hand[0], line.hand[1], 4, 34, '220,240,255', 0.2, 4);
        }
      } else if (ev === 'dust') {
        // a heavy blade striking the ground: dust and a thud
        if (line) {
          FX.puff(line.tip[0], line.tip[1], 8, { speed: 170, color: '200,195,210' });
          FX.ring(line.tip[0], line.tip[1], 8, 90, '255,240,200', 0.3, 8);
          game.shake = Math.max(game.shake, 6);
        }
      } else if (ev === 'flash') {
        // the dash-through cut: a thin line of light along the path; the damage follows on the 'hit' key
        const cx = Math.cos(A.ang), cy = Math.sin(A.ang);
        FX.add({ type: 'cutline', x: A.x0 - cx * 20, y: A.y0 - 55, x1: p.x + cx * 50, y1: p.y - 55 + cy * 30, w: 5, color: '190,225,255', life: 0.26 });
      }
    });
    if (A.on) {
      const clip = Anim.CLIPS[A.name];
      // root motion: the step into the swing, along the aim (a long dash moves in small steps so it can't pass walls)
      const d = Anim.lungeAt(clip, p.anim.actT), dd = d - A.lunge;
      A.lunge = d;
      // (the step stops at a body in front: a boss or a training dummy that doesn't give way isn't walked into, and
      // the swing still lands; a dash-through cut passes them)
      const through = clip.hitShape === 'path' || clip.ghost, lx = Math.cos(A.ang), ly = Math.sin(A.ang) * 0.7;
      const blocked = () => !through && game.enemies.some((e) => !e.dead && (e.x - p.x) * lx + (e.y - p.y) * ly > 0 && Math.hypot(e.x - p.x, (e.y - p.y) * 1.4) < e.r + 48);
      if (dd > 0) for (let k = 0, n = Math.ceil(dd / 10); k < n && !blocked(); k++) NC.tryMove(game.world, p, (lx * dd) / n, (ly * dd) / n);
      // afterimages while dashing through, and a moment of safety
      if (clip.ghost && st.actT >= clip.ghost[0] && st.actT <= clip.ghost[1]) {
        p.inv = Math.max(p.inv, 0.06);
        if ((A.ghostT = (A.ghostT || 0) - dt) <= 0 && p.pose) {
          A.ghostT = 0.022;
          FX.add({ type: 'hero', x: p.x, y: p.y, equip: Object.assign({}, p.equip), pose: Object.assign({}, p.pose), color: '#bfe3ff', life: 0.24 });
        }
      }
      if (st.act !== A.name || st.outT >= 0) { // the clip is done (it keeps blending out): the attack is over
        A.on = false; A.lastEnd = game.time; A.chain = A.step; A.cd = A.step === 2 ? W.cd / ((p.d && p.d.aspdMul) || 1) : 0;
      }
    }
    const aim = A.on ? A.ang : p.aim;
    const al = Math.atan2(Math.sin(p.face > 0 ? aim : Math.PI - aim), Math.cos(p.face > 0 ? aim : Math.PI - aim));
    const c = NC.animCtx(p.equip, { al: NC.clamp(al, -1.2, 1.2), walk: p.walk, moving: p.moving, hurt: p.hurt / 0.3, idleStyle: IDLE, ready: SET.ready });
    const P = Anim.evaluate(st, c);
    P.face = p.face;
    NC.hatSpring(p.hatS || (p.hatS = {}), p.equip, P, p.vx * p.face, dt); // the hat's own little follow-through
    p.pose = P;
    // swing trail: sample the blade while the clip says the weapon is cutting
    const clip = A.on && Anim.CLIPS[A.name];
    if (clip && clip.trail && st.actT >= clip.trail[0] && st.actT <= clip.trail[1]) {
      const line = NC.weaponLine(p.equip, P, p.x, p.y);
      if (line) p.trail.push({ t: game.time, hand: line.hand, base: line.base, tip: line.tip });
    }
    while (p.trail.length && game.time - p.trail[0].t > 0.13) p.trail.shift();
  };

  // the swing trail (smear): a ribbon through the blade's recent positions, brightest at the tip
  NC.drawTrail = function (ctx, game) {
    const p = game.player, T = p.trail;
    if (T.length < 2) return;
    const W = NC.weaponDef(p), rgb = W.trailRgb || '215,235,255', now = game.time;
    const polar = (s) => {
      const a = Math.atan2(s.tip[1] - s.hand[1], s.tip[0] - s.hand[0]);
      return { h: s.hand, a, r0: Math.hypot(s.base[0] - s.hand[0], s.base[1] - s.hand[1]), r1: Math.hypot(s.tip[0] - s.hand[0], s.tip[1] - s.hand[1]) };
    };
    const at = (q, r) => [q.h[0] + Math.cos(q.a) * r, q.h[1] + Math.sin(q.a) * r];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < T.length; i++) {
      const A0 = polar(T[i - 1]), A1 = polar(T[i]);
      let da = A1.a - A0.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const n = Math.max(1, Math.ceil(Math.abs(da) / 0.18)); // subdivide big per-frame jumps into a smooth arc
      for (let k = 0; k < n; k++) {
        const u0 = k / n, u1 = (k + 1) / n;
        const q0 = { h: [NC.lerp(A0.h[0], A1.h[0], u0), NC.lerp(A0.h[1], A1.h[1], u0)], a: A0.a + da * u0, r0: NC.lerp(A0.r0, A1.r0, u0), r1: NC.lerp(A0.r1, A1.r1, u0) };
        const q1 = { h: [NC.lerp(A0.h[0], A1.h[0], u1), NC.lerp(A0.h[1], A1.h[1], u1)], a: A0.a + da * u1, r0: NC.lerp(A0.r0, A1.r0, u1), r1: NC.lerp(A0.r1, A1.r1, u1) };
        const age = (now - NC.lerp(T[i - 1].t, T[i].t, u1)) / 0.13, fade = Math.pow(Math.max(0, 1 - age), 1.3);
        if (fade <= 0.01) continue;
        const band = (f0, f1, col) => {
          const r = (q, f) => NC.lerp(q.r0, q.r1, f);
          const pA = at(q0, r(q0, f0)), pB = at(q0, r(q0, f1)), pC = at(q1, r(q1, f1)), pD = at(q1, r(q1, f0));
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(pA[0], pA[1]); ctx.lineTo(pB[0], pB[1]); ctx.lineTo(pC[0], pC[1]); ctx.lineTo(pD[0], pD[1]); ctx.closePath(); ctx.fill();
        };
        band(0, 1, `rgba(${rgb},${0.34 * fade})`);
        band(0.55, 1, `rgba(${W.trailCore || '255,255,255'},${0.5 * fade})`);   // (W.trailCore: a set may tint the hot edge too, js/bloodaura.js)
      }
    }
    ctx.restore();
  };

  NC.drawPlayer = function (ctx, game) {
    const p = game.player;
    if (!p.pose) return;
    const blink = p.dead <= 0 && p.inv > 0 && p.hurt <= 0 && !p.dash && Math.floor(game.time * 20) % 2 === 0;
    const fade = p.dead > 0 ? NC.clamp(p.dead / 0.7, 0, 1) : 1; // the body fades away before the respawn
    NC.drawHero(ctx, p.equip, p.pose, p.x, p.y, {
      alpha: (blink ? 0.45 : 1) * fade, tint: p.hurt > 0 && p.dead <= 0 ? ['#ff5a5a', (p.hurt / 0.3) * 0.7] : null,
    });
  };

  // ======================= enemies =======================
  const TYPES = NC.MONSTERS;

  NC.makeEnemy = function (type, x, y, lv) {
    const T = TYPES[type], S = NC.monsterStats(type, lv || 1);
    return Object.assign(S, {
      kind: 'enemy', type, x, y, sx: x, sy: y, r: T.r, hp: S.maxHp, sort: y,
      state: 'idle', t: NC.rand(0, 2), face: -1, flash: 0, kbx: 0, kby: 0, slow: 0, z: 0, show: 0,
      wx: x, wy: y, anim: NC.rand(0, 10), squash: 0,
    });
  };

  // a hit on a monster: r = the hit from stats.js (dmg, miss, crit, mod: the element's effect)
  // A poison tick's number: small and green, just under where the hit numbers rise. Shared with the online client.
  NC.enemyDotLooks = function (e, dmg, o) {
    if (NC.DmgFX && NC.DmgFX.hides && NC.DmgFX.hides(true)) return; // (ESC → ตั้งค่า → ตัวเลขดาเมจ ปิด / ของเรา: js/dmgburst.js)
    FX.num(e.x, NC.labelTop(e) - 22, dmg, { size: 30, fill: (o && o.fill) || '#9be35a' });
  };
  // The green motes a poisoned monster gives off, about six a second (online.js draws them for the server's poison too).
  NC.poisonMotes = function (e, dt) {
    if (Math.random() < dt * 6 && NC.VFX) NC.VFX.motes(e.x + NC.rand(-20, 20), e.y - NC.rand(20, 70), 1, NC.VFX.RGB.poison, { rise: 60, spread: 4, size: 0.9 });
  };
  // The looks of a hit on a monster: classic-MMO-style numbers (fx.js FX.dmg) and sparks. Shared with the online client,
  // which draws them for the server's combat events (online.js).
  NC.enemyHitLooks = function (e, r, o) {
    o = o || {};
    const top = NC.labelTop(e) - 52; // numbers rise from above the name tag
    const dmg = r.dmg;
    // the number: yellow for a critical, orange when the element hits its weak spot, grey when it is resisted
    const fill = r.crit ? '#ffe066' : r.mod >= 1.25 ? '#ffae5c' : r.mod < 1 ? '#aab4c8' : '#ffffff';
    // each hit arcs out the other way; a hit that landed twice or three times (r.hits: double attack, triple
    // attack) shows every blow, the last one tagged x2 / x3
    const size = (r.crit ? 60 : o.big ? 54 : 44) * (r.mod >= 1.25 ? 1.1 : r.mod < 1 ? 0.85 : 1);
    // (r.beats: a skill whose effect cuts several times shows its damage as that many numbers, one on each beat of
    // the effect, the parts uneven like real blows; js/samurai_skills.js and js/dmgburst.js set them)
    const beats = r.beats && r.beats.length > 1 && dmg >= r.beats.length ? r.beats : null;
    const n = beats ? beats.length : Math.max(1, Math.min(4, r.hits || 1)), each = Math.max(1, Math.round(dmg / n));
    let parts = null;
    if (beats) {
      const w = beats.map(() => 0.7 + Math.random() * 0.6), sw = w.reduce((a, b) => a + b, 0);
      parts = w.map((x) => Math.max(1, Math.floor((dmg * x) / sw)));
      parts[n - 1] = Math.max(1, dmg - parts.slice(0, -1).reduce((a, b) => a + b, 0));
    }
    for (let i = 0; i < n; i++) {
      e.numDir = -(e.numDir || 1);
      const v = parts ? parts[i] : i < n - 1 ? each : Math.max(1, dmg - each * (n - 1));
      FX.dmg(e.x, top, v, { size, fill: o.fill || fill, crit: r.crit, dir: e.numDir, delay: beats ? beats[i] : i * 0.08, tag: !beats && n > 1 && i === n - 1 ? 'x' + n : null });
    }
    FX.sparks(e.x, e.y - 45, 5, o.color || '255,255,255');
  };
  // A monster's death: the puff, the stars and four EXP orbs flying to `collector` (the hero offline, who gains the
  // EXP as they arrive; online gainXp is the server's and the orbs are only looks).
  NC.enemyDeathLooks = function (game, e, collector) {
    FX.puff(e.x, e.y - 30, 9, { speed: 150, color: e.type === 'slime' ? '90,80,150' : '70,60,90' });
    FX.stars(e.x, e.y - 50, 6, e.type === 'slime' ? '190,160,255' : '255,210,120', { speed: 220 });
    for (let i = 0; i < 4; i++)
      FX.add({
        type: 'orb', x: e.x, y: e.y - 40, vx: NC.rand(-220, 220), vy: NC.rand(-260, -60), drag: 3, life: 3, xp: e.exp / 4, jxp: e.jexp / 4,
        update(o2, dt) {
          if (o2.t < 0.35) return;
          const pl = collector || game.player, d = NC.dist(o2.x, o2.y, pl.x, pl.y - 60);
          const sp = 500 + o2.t * 900;
          o2.vx = ((pl.x - o2.x) / d) * sp; o2.vy = ((pl.y - 60 - o2.y) / d) * sp;
          if (d < 30) { o2.dead = true; NC.gainXp(game, o2.xp, o2.jxp); }
        },
      });
  };

  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    if (e.hp <= 0) return;
    o = o || {};
    const top = NC.labelTop(e) - 52; // numbers rise from above the name tag
    game.target = e; game.targetT = game.time;
    e.show = 3;
    if (e.state === 'idle') e.state = 'chase';
    if (r.miss) { e.numDir = -(e.numDir || 1); FX.dmg(e.x, top, 'MISS', { size: 32, fill: '#cfd8ff', dir: e.numDir }); return; }
    const dmg = r.dmg;
    e.hp -= dmg;
    if (o.dot) { // a poison tick: a small green number, no flinch (it can still kill)
      NC.enemyDotLooks(e, dmg, o);
      if (e.hp > 0) return;
    }
    e.flash = 0.14;
    if (o.stun) e.slow = Math.max(e.slow, o.stun);
    e.kbx += kx; e.kby += ky;
    if (!o.dot) NC.enemyHitLooks(e, r, o);
    if (e.hp <= 0) {
      e.dead = true;
      game.kills++;
      NC.enemyDeathLooks(game, e, game.player);
      NC.HUD.log(`ปราบ ${e.name} Lv ${e.lv} · +${e.exp} EXP · +${e.jexp} Job EXP`, 'exp');
      game.respawns.push({ type: e.type, x: e.sx, y: e.sy, t: 22 });
      NC.dropLoot(game, e.x, e.y, e); // (e: js/potions.js sizes a dropped potion by its level)
    }
  };

  // a status from a skill: stun / freeze (it stands still), poison (dmg every half second)
  NC.statusEnemy = function (game, e, kind, dur, dmg) {
    if (!e || e.dead || (NC.BOSSES && NC.BOSSES[e.type])) return; // (map bosses shrug statuses off)
    if (kind === 'stun') e.stun = Math.max(e.stun || 0, dur);
    else if (kind === 'freeze') { e.frozen = Math.max(e.frozen || 0, dur); e.state = e.type === 'hollow' ? 'recover' : e.state; }
    else if (kind === 'poison') e.poison = { t: Math.max(dur, (e.poison && e.poison.t) || 0), dmg: Math.max(dmg || 1, (e.poison && e.poison.dmg) || 0), acc: (e.poison && e.poison.acc) || 0 };
  };

  NC.updateEnemy = function (game, e, dt) {
    const p = game.player, world = game.world, T = TYPES[e.type];
    e.t += dt; e.anim += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.slow = Math.max(0, e.slow - dt);
    e.show = Math.max(0, e.show - dt);
    if (e.poison) {
      e.poison.t -= dt; e.poison.acc += dt;
      NC.poisonMotes(e, dt);
      if (e.poison.acc >= 0.5) { e.poison.acc -= 0.5; NC.damageEnemy(game, e, { dmg: e.poison.dmg, mod: 1 }, 0, 0, { dot: true }); }
      if (e.poison && e.poison.t <= 0) e.poison = null;
      if (e.dead) return;
    }
    if (e.frozen > 0 || e.stun > 0) {
      const was = e.frozen > 0;
      e.frozen = Math.max(0, (e.frozen || 0) - dt); e.stun = Math.max(0, (e.stun || 0) - dt);
      if (was && e.frozen <= 0 && NC.VFX) { // the ice breaks
        NC.VFX.debris(e.x, e.y - 40, 10, NC.VFX.PAL.ice, { size: 0.8, max: 380, layer: 'glow' });
        NC.VFX.sparks(e.x, e.y - 50, 8, NC.VFX.RGB.ice, { size: 0.8 });
      }
      if (Math.abs(e.kbx) + Math.abs(e.kby) > 1) {
        NC.tryMove(world, e, e.kbx * dt * (was ? 0.3 : 1), e.kby * dt * (was ? 0.3 : 1));
        const k = Math.exp(-dt * 9); e.kbx *= k; e.kby *= k;
      }
      e.sort = e.y;
      return;
    }
    const sp = e.slow > 0 ? 0.45 : 1;
    // knockback
    if (Math.abs(e.kbx) + Math.abs(e.kby) > 1) {
      NC.tryMove(world, e, e.kbx * dt, e.kby * dt);
      const k = Math.exp(-dt * 9); e.kbx *= k; e.kby *= k;
    }
    const alive = p.dead <= 0;
    const dp = NC.dist(e.x, e.y, p.x, p.y);
    const toP = NC.angle(e.x, e.y, p.x, p.y);
    const home = NC.dist(e.x, e.y, e.sx, e.sy);

    if (e.type === 'hollow') {
      switch (e.state) {
        case 'idle':
          if (e.t > 2.2) { e.t = 0; e.wx = e.sx + NC.rand(-140, 140); e.wy = e.sy + NC.rand(-90, 90); }
          if (NC.dist(e.x, e.y, e.wx, e.wy) > 12) {
            const a = NC.angle(e.x, e.y, e.wx, e.wy);
            NC.tryMove(world, e, Math.cos(a) * 60 * dt, Math.sin(a) * 60 * dt);
            e.face = Math.cos(a) > 0 ? 1 : -1;
          }
          if (alive && dp < T.aggro) e.state = 'chase';
          break;
        case 'chase':
          if (!alive || home > 1150) { e.state = 'return'; break; }
          e.face = Math.cos(toP) > 0 ? 1 : -1;
          if (dp < 92) { e.state = 'windup'; e.t = 0; e.atkAng = toP; break; }
          NC.tryMove(world, e, Math.cos(toP) * T.spd * sp * dt, Math.sin(toP) * T.spd * sp * dt);
          break;
        case 'windup':
          if (e.t > 0.45 / sp) { e.state = 'strike'; e.t = 0; e.hitDone = false; }
          break;
        case 'strike':
          NC.tryMove(world, e, Math.cos(e.atkAng) * 380 * dt, Math.sin(e.atkAng) * 380 * dt);
          if (!e.hitDone && e.t > 0.05) {
            e.hitDone = true;
            FX.slash(e.x + e.face * 30, e.y - 60, e.atkAng, 95, '255,120,120', e.face);
            if (alive && NC.dist(e.x, e.y, p.x, p.y) < 118 && angDiff(NC.angle(e.x, e.y, p.x, p.y), e.atkAng) < 1.3)
              NC.monsterAttack(game, e);
          }
          if (e.t > 0.14) { e.state = 'recover'; e.t = 0; }
          break;
        case 'recover':
          if (e.t > 0.65) e.state = 'chase';
          break;
        case 'return':
          if (home < 30) { e.state = 'idle'; e.hp = e.maxHp; break; }
          { const a = NC.angle(e.x, e.y, e.sx, e.sy); NC.tryMove(world, e, Math.cos(a) * 170 * dt, Math.sin(a) * 170 * dt); e.face = Math.cos(a) > 0 ? 1 : -1; }
          if (alive && dp < T.aggro * 0.6 && home < 700) e.state = 'chase';
          break;
      }
    } else {
      // slime: rest, then hop (towards the player when aggro)
      if (e.state === 'idle' || e.state === 'chase' || e.state === 'rest') {
        if (e.state !== 'rest') { e.state = 'rest'; e.t = 0; e.restFor = NC.rand(0.45, 0.9); }
        if (e.t > e.restFor / sp) {
          const aggro = alive && dp < T.aggro && home < 1100;
          const a = aggro ? toP + NC.rand(-0.3, 0.3) : NC.angle(e.x, e.y, e.sx + NC.rand(-160, 160), e.sy + NC.rand(-100, 100));
          const dist = aggro ? Math.min(150, dp) : 90;
          e.state = 'hop'; e.t = 0; e.hvx = (Math.cos(a) * dist) / 0.42; e.hvy = (Math.sin(a) * dist) / 0.42;
          e.face = Math.cos(a) > 0 ? 1 : -1;
        }
      } else if (e.state === 'hop') {
        const u = e.t / 0.42;
        e.z = Math.sin(Math.PI * Math.min(1, u)) * 46;
        NC.tryMove(world, e, e.hvx * sp * dt, e.hvy * sp * dt);
        if (u >= 1) {
          e.z = 0; e.state = 'rest'; e.t = 0; e.restFor = NC.rand(0.45, 0.9); e.squash = 1;
          FX.puff(e.x, e.y, 2, { speed: 40, size: 0.6, color: '150,140,190' });
          if (alive && NC.dist(e.x, e.y, p.x, p.y) < 62) NC.monsterAttack(game, e);
        }
      }
      e.squash = Math.max(0, e.squash - dt * 4);
    }
    e.sort = e.y;
  };

  NC.drawEnemy = function (ctx, game, e) {
    drawEnemyBody(ctx, game, e);
    if (!NC.VFX) return;
    const V = NC.VFX;
    if (e.frozen > 0) { // a block of ice around it
      const w = e.type === 'slime' ? 104 : 96, h = e.type === 'slime' ? 92 : 170, a = Math.min(1, e.frozen / 0.25);
      ctx.save();
      ctx.globalAlpha *= 0.55 * a;
      V.spike(ctx, e.x, e.y + 6, w, h, 0, ['#8fd8ff', '#d9f4ff', '#ffffff'], 1, 0.4);
      ctx.restore();
      V.glow(ctx, e.x, e.y - h * 0.4, w, V.RGB.ice, 0.35 * a, false);
    }
    if (e.stun > 0) { // stars circling over the head
      const top = NC.labelTop ? NC.labelTop(e) + 34 : e.y - 140;
      for (let i = 0; i < 3; i++) { const a = game.time * 5 + (i / 3) * Math.PI * 2; V.star(ctx, e.x + Math.cos(a) * 30, top + Math.sin(a) * 9, 9, a, '#ffe066', 1); }
    }
  };
  function drawEnemyBody(ctx, game, e) {
    const tint = e.flash > 0 ? ['#ffffff', 0.85] : e.frozen > 0 ? ['#bfeaff', 0.55] : e.slow > 0 ? ['#8fd8ff', 0.45] : e.poison ? ['#7fe05a', 0.35] : null;
    if (e.type === 'hollow') {
      let rot = 0, dx = 0;
      if (e.state === 'windup') { rot = -0.2 * e.face * Math.min(1, e.t / 0.2); dx = -6 * e.face; }
      else if (e.state === 'strike') rot = 0.24 * e.face;
      const bob = e.state === 'chase' || e.state === 'return' ? -Math.abs(Math.sin(e.anim * 9)) * 6 : Math.sin(e.anim * 2.5) * 3;
      NC.drawSpr(ctx, 'hollow', e.x + dx, e.y + bob, { flip: e.face > 0, rot, tint });
      if (e.state === 'windup' && Math.floor(e.t * 16) % 2 === 0) {
        // glint on the blade: telegraph
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gx = e.x - e.face * 58, gy = e.y - 88;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 26);
        g.addColorStop(0, 'rgba(255,90,90,0.9)'); g.addColorStop(1, 'rgba(255,90,90,0)');
        ctx.fillStyle = g; ctx.fillRect(gx - 26, gy - 26, 52, 52);
        ctx.restore();
      }
    } else {
      const idle = Math.sin(e.anim * 5) * 0.05;
      const air = e.state === 'hop' ? 0.14 : 0;
      const sx = 1 + idle + e.squash * 0.22 - air * 0.6, sy = 1 - idle - e.squash * 0.2 + air;
      NC.drawSpr(ctx, 'slime', e.x, e.y - e.z, { flip: e.face > 0, sx, sy, tint });
    }
  }

  // A shadow is one baked ellipse drawn to size (2026-10-24: FPS): an ellipse path filled per monster, hero and drop
  // every frame was a fifth of the screen's path work in a crowd. The same colour, its alpha through globalAlpha.
  let shadowSpr = null;
  function shadowOf() {
    if (shadowSpr) return shadowSpr;
    shadowSpr = document.createElement('canvas'); shadowSpr.width = 128; shadowSpr.height = 64;
    const s = shadowSpr.getContext('2d');
    s.fillStyle = 'rgb(16,18,34)'; s.beginPath(); s.ellipse(64, 32, 63, 31, 0, 0, TAU); s.fill(); // (1 px round it for the soft edge)
    return shadowSpr;
  }
  NC.drawShadow = function (ctx, x, y, rx, ry, a) {
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * (a || 0.35);
    ctx.drawImage(shadowOf(), x - rx * (64 / 63), y - ry * (32 / 31), rx * 2 * (64 / 63), ry * 2 * (32 / 31));
    ctx.globalAlpha = ga;
  };

  // a bar with the art's dark outline: frac filled with col, a light stripe on top
  function bar(ctx, x, y, w, h, frac, col, back) {
    ctx.fillStyle = NC.OUTLINE;
    NC.rrect(ctx, x - 3, y - 3, w + 6, h + 6, (h + 6) / 2); ctx.fill();
    ctx.fillStyle = back || '#3b3346';
    NC.rrect(ctx, x, y, w, h, h / 2); ctx.fill();
    const f = NC.clamp(frac, 0, 1);
    if (f > 0) {
      ctx.fillStyle = col;
      NC.rrect(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillRect(x + h / 2, y + h * 0.18, Math.max(0, w * f - h), Math.max(1.5, h * 0.22));
    }
  }
  // a name tag: the outlined text of the art style (and a little element badge before it)
  function tag(ctx, text, x, y, size, fill, el) {
    ctx.save();
    ctx.font = `600 ${size}px 'Mitr', 'Baloo 2', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.26; ctx.strokeStyle = NC.OUTLINE;
    const w = ctx.measureText(text).width, bs = size * 1.05, tx = el ? x + bs * 0.6 : x;
    ctx.strokeText(text, tx, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, tx, y);
    if (el) {
      const bx = tx - w / 2 - bs * 0.7, s = NC.SPR['el_' + el];
      if (s) ctx.drawImage(s.img, bx - bs / 2, y - bs / 2, bs, bs);
      else {
        ctx.fillStyle = NC.OUTLINE; ctx.beginPath(); ctx.arc(bx, y, bs * 0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = NC.ELEMENT_INFO[el].color; ctx.beginPath(); ctx.arc(bx, y, bs * 0.36, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  NC.drawTag = tag;

  // over a monster's head (when hurt, hovered or just hit): its name, level and element, and its HP (the hero's own
  // tag is under the hero's feet, so the two don't run into each other in a melee)
  NC.labelTop = (e) => e.y - (e.type === 'slime' ? 96 + (e.z || 0) : 172);
  NC.drawEnemyBar = function (ctx, e, game) {
    if (e.dummy) return; // (a training dummy shows its own numbers: dummy.js)
    const aimed = game && (game.hover === e || game.target === e);
    if (e.show <= 0 && e.hp >= e.maxHp && !aimed) return;
    const w = e.type === 'slime' ? 84 : 100, x = e.x - w / 2, y = NC.labelTop(e);
    tag(ctx, `${e.name} Lv ${e.lv}`, e.x, y - 20, 21, NC.levelColor ? NC.levelColor(e, game, aimed) : aimed ? '#fff3cf' : '#ffffff', e.element);
    bar(ctx, x, y, w, 9, e.hp / e.maxHp, e.hp / e.maxHp > 0.3 ? '#e0525c' : '#ff3b3b');
  };

  // under the hero: HP and SP bars, then the name (like classic MMOs)
  NC.drawPlayerTag = function (ctx, game) {
    const p = game.player;
    if (!p.pose || p.dead > 0) return;
    const w = 104, x = p.x - w / 2, y = p.y + 20, f = p.hp / p.maxHp;
    bar(ctx, x, y, w, 11, f, f > 0.5 ? '#6ad36a' : f > 0.25 ? '#f2c14e' : '#ee5a5a');
    bar(ctx, x, y + 17, w, 7, p.sp / p.maxSp, '#5aa9ff');
    if (p.name) tag(ctx, p.name, p.x, y + 48, 24, '#ffffff');
  };
})();
