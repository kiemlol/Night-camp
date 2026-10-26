/* boss.js — map bosses (classic MMOs' MVPs). The Mushroom King (ราชาเห็ดเรืองแสง) sleeps in the arena of the glowing-
   mushroom woods: a huge HP pool, telegraphed attacks (a leaping ground slam, spore clouds, summoning mushlings, a
   charge once enraged), a big HP bar at the top of the screen during the fight, a long respawn and many drops.
   It plugs into entities.js from the outside: its species are NC.MONSTERS entries (stats.js turns them into numbers
   per level) and NC.updateEnemy / drawEnemy / damageEnemy / labelTop / drawEnemyBar are wrapped, so only the boss
   types take the new code paths. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);

  Object.assign(NC.MONSTERS, {
    mushking: { name: 'ราชาเห็ดเรืองแสง', element: 'poison', atkElement: 'poison', r: 64, hpK: 56, atkK: 1.6, defK: 1.2, mdefK: 0.8,
      agiK: 0.3, dexK: 0.9, expK: 40, spd: 72, aggro: 640 },
    mushling: { name: 'ลูกเห็ดพราย', element: 'earth', atkElement: 'neutral', r: 20, hpK: 0.45, atkK: 0.55, defK: 0.3, mdefK: 0.5,
      agiK: 0.6, dexK: 0.5, expK: 0.2, spd: 0, aggro: 900 },
  });
  // respawn: seconds after the kill; drops: loot rolls; top: the name tag height over the feet
  const BOSSES = { mushking: { respawn: 300, drops: 7, top: 330 } };
  NC.BOSSES = BOSSES;
  const isBoss = (e) => !!BOSSES[e.type];
  const cooldown = {}; // 'map:type' -> the time (s) the boss may come back
  NC.Boss = { cooldown }; // (for testing: NC.Boss.cooldown['woods:mushking'] = 0 brings it back)

  // ---------------- small helpers ----------------
  const hitHero = (game, e, mul) => {
    const p = game.player;
    if (p.inv > 0 || p.dead > 0) return false;
    const r = NC.monsterHit(e, p.d);
    if (r.miss) { FX.num(p.x, p.y - 150, r.lucky ? 'Lucky!' : 'MISS', { fill: r.lucky ? '#ffe28a' : '#cfd8ff', size: 34 }); p.inv = 0.3; return false; }
    NC.hurtPlayer(game, Math.max(1, Math.round(r.dmg * mul)), e.x);
    return true;
  };
  const inEllipse = (x, y, cx, cy, r) => ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.58)) ** 2 < 1;
  const pickW = (opts) => {
    let s = 0;
    for (const [, w] of opts) s += w;
    let r = Math.random() * s;
    for (const [k, w] of opts) if ((r -= w) <= 0) return k;
    return opts[opts.length - 1][0];
  };
  const now = () => performance.now() / 1000;
  const say = (game, text, kind) => { game.toast(text); NC.HUD.log(text, kind || 'warn'); };

  // a warning drawn on the ground: fills up until the hit lands
  function warnCircle(x, y, r, life, owner) {
    return FX.add({
      type: 'custom', layer: 'low', x, y, r, life, owner,
      draw(ctx, p, u) {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.scale(1, 0.58);
        ctx.fillStyle = `rgba(255,70,90,${0.12 + 0.1 * Math.sin(p.t * 18)})`;
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,90,110,0.32)';
        ctx.beginPath(); ctx.arc(0, 0, p.r * Math.min(1, u), 0, TAU); ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,120,130,0.85)';
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.stroke();
        ctx.restore();
      },
    });
  }
  function warnLane(x, y, ang, len, w, life, owner) {
    return FX.add({
      type: 'custom', layer: 'low', x, y, ang, len, w, life, owner,
      draw(ctx, p, u) {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.scale(1, 0.62); ctx.rotate(p.ang);
        ctx.fillStyle = `rgba(255,70,90,${0.12 + 0.1 * Math.sin(p.t * 18)})`;
        NC.rrect(ctx, 0, -p.w / 2, p.len, p.w, p.w / 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,90,110,0.32)';
        NC.rrect(ctx, 0, -p.w / 2, Math.max(p.w, p.len * Math.min(1, u)), p.w, p.w / 2); ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,120,130,0.85)';
        NC.rrect(ctx, 0, -p.w / 2, p.len, p.w, p.w / 2); ctx.stroke();
        ctx.restore();
      },
    });
  }
  // a cloud of glowing spores: drifts out, lingers, hurts the hero standing in it (poison)
  function sporeCloud(game, e, x, y, vx, vy, big) {
    const R = big ? 78 : 62;
    return FX.add({
      // drawn after the night lighting (layer 'glow') so the poison stays readable in the dark
      type: 'custom', layer: 'glow', x, y, vx, vy, drag: 2.4, life: big ? 5 : 4.2, R, owner: e, tick: 0.35, seed: Math.random() * 9,
      update(c, dt, g) {
        c.tick -= dt;
        const p = g.player;
        if (c.t > 0.35 && c.t < c.life - 0.4 && c.tick <= 0 && p.dead <= 0 && inEllipse(p.x, p.y, c.x, c.y, c.R)) {
          c.tick = 0.6;
          if (hitHero(g, c.owner, 0.34)) FX.puff(p.x, p.y - 60, 3, { speed: 60, color: '140,230,200', size: 0.6 });
        }
        if (NC.Party && c.t > 0.35 && c.t < c.life - 0.4 && (c.ptick = (c.ptick || 0) - dt) <= 0) { c.ptick = 0.6; NC.Party.hurtArea(g, c.owner, c.x, c.y, c.R, 0.34); }
        if (Math.random() < dt * 5) FX.add({ type: 'ember', x: c.x + NC.rand(-c.R, c.R) * 0.8, y: c.y + NC.rand(-c.R, c.R) * 0.4, vx: 0, vy: NC.rand(-60, -30), life: NC.rand(0.5, 0.9) });
      },
      draw(ctx, c, u) {
        const a = 0.8 * Math.min(1, c.t / 0.3) * Math.min(1, (c.life - c.t) / 0.6);
        ctx.save();
        ctx.globalAlpha = a;
        for (let i = 0; i < 5; i++) {
          const ang = c.seed + i * 1.26 + c.t * 0.4, rr = c.R * (0.34 + 0.12 * Math.sin(c.t * 2 + i));
          const px = c.x + Math.cos(ang) * c.R * 0.42, py = c.y + Math.sin(ang) * c.R * 0.24 - 14;
          const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
          g.addColorStop(0, 'rgba(150,255,215,0.55)'); g.addColorStop(0.7, 'rgba(90,200,190,0.28)'); g.addColorStop(1, 'rgba(90,200,190,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(140,255,215,0.55)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
        ctx.beginPath(); ctx.ellipse(c.x, c.y, c.R, c.R * 0.58, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      },
    });
  }

  // ---------------- the Mushroom King ----------------
  function wake(game, e) {
    if (e.awake) return;
    e.awake = true;
    e.state = 'roar'; e.t = 0;
    game.shake = Math.max(game.shake, 14);
    FX.ring(e.x, e.y - 60, 30, 420, '140,240,255', 0.8, 10);
    FX.stars(e.x, e.y - 260, 16, '150,240,255', { speed: 320 });
    say(game, `${e.name} ตื่นแล้ว!`);
  }

  function startAttack(game, e, kind) {
    const p = game.player;
    e.state = kind; e.t = 0; e.done = false;
    if (kind === 'slam') {
      e.wind = e.raged ? 0.7 : 0.9;
      const d = Math.min(260, NC.dist(e.x, e.y, p.x, p.y)), a = NC.angle(e.x, e.y, p.x, p.y);
      e.tx = e.x + Math.cos(a) * d; e.ty = e.y + Math.sin(a) * d;
      if (!game.world.fits(e.tx, e.ty, e.r)) { e.tx = e.x; e.ty = e.y; }
      e.jx = e.x; e.jy = e.y;
      warnCircle(e.tx, e.ty, 260, e.wind + 0.38, e);
    } else if (kind === 'spores') {
      e.wind = 0.65;
    } else if (kind === 'summon') {
      e.wind = 0.8;
      FX.puff(e.x, e.y - 40, 10, { speed: 160, color: '160,120,220' });
    } else if (kind === 'charge') {
      e.wind = 0.75;
      e.ang = NC.angle(e.x, e.y, p.x, p.y);
      warnLane(e.x, e.y, e.ang, 640, 170, e.wind, e);
    }
  }

  function pickAttack(game, e, dp) {
    const minions = game.enemies.filter((m) => m.owner === e && !m.dead).length;
    const opts = [];
    if (dp < 340) opts.push(['slam', 3]);
    opts.push(['spores', dp < 340 ? 2 : 3]);
    if (e.hp < e.maxHp * 0.8 && minions < 4 && e.summonCd <= 0) opts.push(['summon', 2.6]);
    if (e.raged && dp > 220) opts.push(['charge', 2.6]);
    startAttack(game, e, pickW(opts));
  }

  // ---------------- the walk home (this file and js/dunbosses.js; the server plays the same: backend patch 013) ----------------
  // Bug report #70 (Discord, 2026-10-19): a boss its charge carried past the 1500 leash turned back on the hero at once,
  // went home again the next frame and healed 3%/s on every walking frame while it was beaten. Now one leashed walks home
  // until 1000 from home before it turns on a hero again, it heals only after 3 s without losing HP (e.hurtAt, set by
  // NC.damageEnemy below), and one that has come no 30 nearer home in 3 s (a wall) is put back home, as a plain monster is.
  NC.bossStartHome = (e, home) => { e.state = 'return'; e.t = 0; e.homeWalk = { leashed: home > 1500, t: 0, by: 0, at: 0 }; };
  NC.bossWalkHome = function (world, e, dt, speed, alive, dp, aggro) {
    const W = e.homeWalk || (e.homeWalk = { leashed: false, t: 0, by: 0, at: 0 });
    const a = NC.angle(e.x, e.y, e.sx, e.sy);
    let home = NC.dist(e.x, e.y, e.sx, e.sy);
    e.face = Math.cos(a) > 0 ? 1 : -1;
    W.t += dt;
    if (!W.by || home <= W.by - 30) { W.by = home; W.at = W.t; }
    if (home >= 40 && W.t - W.at >= 3) { e.x = e.sx; e.y = e.sy; home = 0; }
    else NC.tryMove(world, e, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
    if (!(e.anim - e.hurtAt < 3)) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
    if (home < 40) { e.state = 'idle'; e.awake = false; e.raged = e.hp < e.maxHp * 0.5; }
    else if (alive && dp < aggro * 0.7 && (!W.leashed || home < 1000)) e.state = 'chase';
    if (e.state !== 'return') e.homeWalk = null;
  };

  function updateKing(game, e, dt) {
    if (e.dead) return; // (game.js updates the list once more before it drops the dead)
    const p = game.player, world = game.world, M = NC.MONSTERS.mushking;
    e.t += dt; e.anim += dt;
    e.flash = Math.max(0, e.flash - dt); e.slow = Math.max(0, e.slow - dt); e.show = Math.max(0, e.show - dt);
    e.kbx = e.kby = 0; // too heavy to be knocked back
    if (e.cd === undefined) { e.cd = 1; e.summonCd = 6; e.z = 0; }
    // its cap glows at night (a light that follows it)
    if (!e.light || !world.lights.includes(e.light)) {
      for (let i = world.lights.length - 1; i >= 0; i--) if (world.lights[i].boss) world.lights.splice(i, 1);
      e.light = { x: e.x, y: e.y, r: 420, rgb: '110,220,255', flick: Math.random() * 10, owner: e, boss: true };
      world.lights.push(e.light);
    }
    e.light.x = e.x; e.light.y = e.y - 270 - e.z;

    const alive = p.dead <= 0, dp = NC.dist(e.x, e.y, p.x, p.y), toP = NC.angle(e.x, e.y, p.x, p.y), home = NC.dist(e.x, e.y, e.sx, e.sy);
    if (!e.raged && e.hp < e.maxHp * 0.5) {
      e.raged = true;
      FX.ring(e.x, e.y - 80, 40, 520, '255,120,200', 0.9, 12);
      game.shake = Math.max(game.shake, 16);
      say(game, `${e.name} โกรธจัด! (ท่าพุ่งชน · สปอร์มากขึ้น)`);
    }
    const sp = (e.slow > 0 ? 0.6 : 1) * (e.raged ? 1.3 : 1);
    e.cd -= dt * (e.raged ? 1.35 : 1);
    e.summonCd -= dt;

    switch (e.state) {
      case 'idle': // asleep in its arena, breathing
        if (alive && dp < M.aggro) wake(game, e);
        break;
      case 'chase': // (entities.js puts a sleeping monster that is hit into 'chase')
        if (!e.awake) { wake(game, e); break; }
        if (!alive || home > 1500) { NC.bossStartHome(e, home); break; }
        e.face = Math.cos(toP) > 0 ? 1 : -1;
        if (dp > 150) NC.tryMove(world, e, Math.cos(toP) * M.spd * sp * dt, Math.sin(toP) * M.spd * sp * dt);
        if (e.cd <= 0) pickAttack(game, e, dp);
        break;
      case 'roar':
        if (Math.random() < dt * 20) FX.add({ type: 'ember', x: e.x + NC.rand(-120, 120), y: e.y - NC.rand(160, 300), vx: 0, vy: NC.rand(-160, -80), life: 0.8 });
        if (e.t > 1.3) { e.state = 'chase'; e.t = 0; e.cd = 0.6; }
        break;
      case 'slam': {
        if (e.t < e.wind) break; // crouching (the warning circle fills)
        const u = Math.min(1, (e.t - e.wind) / 0.38);
        e.x = NC.lerp(e.jx, e.tx, u); e.y = NC.lerp(e.jy, e.ty, u);
        e.z = Math.sin(Math.PI * u) * 150;
        if (u >= 1 && !e.done) {
          e.done = true; e.z = 0;
          game.shake = Math.max(game.shake, 18); game.hitstop = Math.max(game.hitstop, 0.05);
          FX.ring(e.x, e.y, 30, 300, '255,210,160', 0.45, 12);
          FX.puff(e.x, e.y, 14, { speed: 320, color: '170,160,190', size: 1.3 });
          if (alive && inEllipse(p.x, p.y, e.x, e.y, 262) && hitHero(game, e, 1.6)) {
            const a = NC.angle(e.x, e.y, p.x, p.y);
            for (let k = 0; k < 6; k++) NC.tryMove(world, p, Math.cos(a) * 22, Math.sin(a) * 14);
          }
          if (NC.Party) NC.Party.hurtArea(game, e, e.x, e.y, 262, 1.6); // the party members standing in it too
          e.state = 'recover'; e.t = 0; e.rec = 0.8; e.cd = NC.rand(1.4, 2.4);
        }
        break;
      }
      case 'spores':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          const n = e.raged ? 12 : 8, a0 = Math.random() * TAU;
          for (let i = 0; i < n; i++) {
            const a = a0 + (i / n) * TAU + NC.rand(-0.15, 0.15), s = NC.rand(420, 620);
            sporeCloud(game, e, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 36, Math.cos(a) * s, Math.sin(a) * s * 0.62);
          }
          if (e.raged) for (let i = 0; i < 2; i++) sporeCloud(game, e, p.x + NC.rand(-90, 90), p.y + NC.rand(-50, 50), 0, 0, true);
          FX.ring(e.x, e.y - 200, 20, 240, '150,255,215', 0.5, 8);
          e.state = 'recover'; e.t = 0; e.rec = 0.6; e.cd = NC.rand(1.8, 2.8);
        }
        break;
      case 'summon':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU + NC.rand(-0.4, 0.4);
            let x = e.x + Math.cos(a) * 170, y = e.y + Math.sin(a) * 110;
            if (!world.fits(x, y, 24)) { x = e.x; y = e.y + 60; }
            const m = NC.makeEnemy('mushling', x, y, NC.spawnLevel(world, 'mushling', x, y));
            m.owner = e; m.state = 'chase';
            game.enemies.push(m);
            FX.puff(x, y - 20, 6, { speed: 90, color: '170,130,230' });
          }
          e.summonCd = 14;
          e.state = 'recover'; e.t = 0; e.rec = 0.5; e.cd = NC.rand(1.2, 2);
        }
        break;
      case 'charge':
        if (e.t < e.wind) { e.face = Math.cos(e.ang) > 0 ? 1 : -1; break; }
        NC.tryMove(world, e, Math.cos(e.ang) * 1150 * dt, Math.sin(e.ang) * 1150 * dt);
        if (Math.random() < dt * 30) FX.puff(e.x, e.y, 1, { speed: 60, color: '170,160,190' });
        if (!e.done && alive && NC.dist(e.x, e.y, p.x, p.y) < e.r + 60 && hitHero(game, e, 1.3)) {
          e.done = true;
          const side = Math.sign(Math.sin(e.ang - NC.angle(e.x, e.y, p.x, p.y))) || 1;
          for (let k = 0; k < 6; k++) NC.tryMove(world, p, Math.cos(e.ang + side * 1.2) * 20, Math.sin(e.ang + side * 1.2) * 14);
        }
        if (e.t > e.wind + 0.56) { e.state = 'recover'; e.t = 0; e.rec = 0.95; e.cd = NC.rand(1.2, 2); FX.stars(e.x, e.y - 300, 5, '255,240,160', { speed: 90 }); }
        break;
      case 'recover':
        if (e.t > e.rec) { e.state = 'chase'; e.t = 0; }
        break;
      case 'return': // the hero ran off: walk home and heal a little on the way
        NC.bossWalkHome(world, e, dt, 160, alive, dp, M.aggro);
        break;
      default:
        e.state = e.awake ? 'chase' : 'idle';
    }
    e.sort = e.y;
  }

  function drawKing(ctx, game, e) {
    const tint = e.flash > 0 ? ['#ffffff', 0.7] : e.slow > 0 ? ['#8fd8ff', 0.4] : e.raged ? ['#ff5fa8', 0.12 + 0.08 * Math.sin(e.anim * 6)] : null;
    const winding = e.t < (e.wind || 0);
    const pose = e.state === 'roar' || (e.state === 'spores' && winding) || (e.state === 'summon' && winding) || (e.state === 'slam' && !winding);
    let sx = 1 + Math.sin(e.anim * 2.2) * 0.02, sy = 1 - Math.sin(e.anim * 2.2) * 0.02, rot = 0, dx = 0;
    if (e.state === 'slam' && winding) { const u = Math.min(1, e.t / e.wind); sx += 0.1 * u; sy -= 0.14 * u; }
    if (e.state === 'charge') { if (winding) dx = -Math.cos(e.ang) * 10 * Math.min(1, e.t / 0.2); else rot = 0.12 * (Math.cos(e.ang) > 0 ? 1 : -1); }
    if (e.state === 'chase') sy += Math.abs(Math.sin(e.anim * 4)) * 0.03;
    if (e.state === 'idle') { sy += Math.sin(e.anim * 1.3) * 0.02; }
    if ((NC.Gfx?.profile || NC.Graphics?.profile)?.shadows !== 'none') NC.drawShadow(ctx, e.x, e.y + 2, 120 - e.z * 0.25, 34 - e.z * 0.06, 0.4);
    NC.drawSpr(ctx, pose && NC.SPR.mushking_atk ? 'mushking_atk' : 'mushking', e.x + dx, e.y - e.z, { flip: e.face > 0, sx, sy, rot, tint });
    if (e.state === 'idle') { // asleep: a few z's
      ctx.save();
      ctx.font = "700 34px 'Baloo 2', sans-serif"; ctx.textAlign = 'center';
      ctx.lineWidth = 7; ctx.strokeStyle = NC.OUTLINE; ctx.fillStyle = '#dff6ff';
      for (let i = 0; i < 3; i++) {
        const u = (e.anim * 0.5 + i / 3) % 1;
        ctx.globalAlpha = Math.sin(u * Math.PI);
        const x = e.x - 90 + u * 60, y = e.y - 300 - u * 90;
        ctx.strokeText('z', x, y); ctx.fillText('z', x, y);
      }
      ctx.restore();
    }
  }

  function drawMushling(ctx, game, e) {
    const tint = e.flash > 0 ? ['#ffffff', 0.85] : e.slow > 0 ? ['#8fd8ff', 0.45] : null;
    const idle = Math.sin(e.anim * 6) * 0.05, air = e.state === 'hop' ? 0.14 : 0;
    const sx = 1 + idle + e.squash * 0.22 - air * 0.6, sy = 1 - idle - e.squash * 0.2 + air;
    NC.drawSpr(ctx, 'mushling', e.x, e.y - e.z, { flip: e.face < 0, sx, sy, tint }); // the art walks to the right
  }

  // ---------------- hooks into entities.js ----------------
  const baseUpdate = NC.updateEnemy, baseDraw = NC.drawEnemy, baseDamage = NC.damageEnemy, baseTop = NC.labelTop, baseBar = NC.drawEnemyBar;
  NC.updateEnemy = function (game, e, dt) {
    if (e.type === 'mushking') updateKing(game, e, dt);
    else baseUpdate(game, e, dt); // the mushling hops like a slime
  };
  NC.drawEnemy = function (ctx, game, e) {
    if (e.type === 'mushking') drawKing(ctx, game, e);
    else if (e.type === 'mushling') drawMushling(ctx, game, e);
    else baseDraw(ctx, game, e);
  };
  NC.labelTop = (e) => (isBoss(e) ? e.y - BOSSES[e.type].top - (e.z || 0) : e.type === 'mushling' ? e.y - 92 - (e.z || 0) : baseTop(e));
  NC.drawEnemyBar = function (ctx, e, game) {
    if (isBoss(e)) return; // the boss's bar is at the top of the screen
    baseBar(ctx, e, game);
  };
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const was = e.hp;
    if (isBoss(e)) { kx = 0; ky = 0; if (!e.awake && e.state === 'idle') wake(game, e); }
    baseDamage(game, e, r, kx, ky, o);
    if (e.hp < was) e.hurtAt = e.anim; // (a boss walking home heals only after 3 s without a blow: NC.bossWalkHome)
    if (was > 0 && e.hp <= 0) died(game, e);
  };

  function died(game, e) {
    // entities.js queued the usual 22 s respawn: summoned minions never come back, a boss comes back much later (tick)
    const i = game.respawns.findIndex((q) => q.type === e.type && q.x === e.sx && q.y === e.sy);
    if (i >= 0 && (e.owner || isBoss(e))) game.respawns.splice(i, 1);
    if (!isBoss(e)) return;
    const B = BOSSES[e.type];
    cooldown[game.mapId + ':' + e.type] = now() + B.respawn;
    for (let k = 0; k < B.drops; k++) NC.dropLoot(game, e.x + NC.rand(-140, 140), e.y + NC.rand(-70, 70), e);
    // 2 red + 1 blue of the boss's level's size (js/potions.js)
    const potSize = NC.POT ? NC.POT.sizeFor(e.lv) : 's';
    for (let k = 0; k < 3; k++)
      game.loot.push({ kind: 'loot', potion: k < 2 ? 'red' : 'blue', size: potSize, x: e.x + NC.rand(-120, 120), y: e.y + NC.rand(-50, 50), sort: e.y, t: 0, z: 0, vz: 520 });
    for (const m of game.enemies) if (m.owner === e && !m.dead) { m.hp = 0; m.dead = true; FX.puff(m.x, m.y - 20, 5, { speed: 90, color: '170,130,230' }); }
    for (const f of FX.list) if (f.owner === e) f.dead = true;
    const L = game.world.lights.indexOf(e.light);
    if (L >= 0) game.world.lights.splice(L, 1);
    game.shake = Math.max(game.shake, 20);
    for (let k = 0; k < 3; k++) FX.ring(e.x, e.y - 120, 30 + k * 40, 480 + k * 120, k === 1 ? '255,230,140' : '140,240,255', 0.7 + k * 0.2, 12);
    FX.stars(e.x, e.y - 200, 30, '255,230,140', { speed: 420 });
    say(game, `★ ปราบ ${e.name} สำเร็จ! (กลับมาอีกใน ${Math.round(B.respawn / 60)} นาที)`, 'exp');
  }

  // a boss that is still on its respawn timer is not placed when the map loads
  const baseMonsters = NC.Maps.monsters;
  NC.Maps.monsters = function (world) {
    return baseMonsters(world).filter((e) => !(isBoss(e) && (cooldown[world.mapId + ':' + e.type] || 0) > now()));
  };

  // ---------------- every frame: the boss HP bar and the respawn ----------------
  let el = null, lastTxt = '';
  function barEl() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'bossbar';
    // sized with the HUD's own unit (--u) and placed under the HUD's target frame (tick() keeps it there)
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);width:calc(500 * var(--u));z-index:5;' +
      'pointer-events:none;opacity:0;transition:opacity .35s;font-family:Mitr,sans-serif;color:#fff4d8;text-align:center;';
    const ink = '#2a2435';
    el.innerHTML =
      `<div class="bb-name" style="font-size:calc(26 * var(--u));font-weight:600;letter-spacing:.02em;-webkit-text-stroke:calc(5 * var(--u)) ${ink};paint-order:stroke fill"></div>` +
      `<div style="position:relative;height:calc(24 * var(--u));margin-top:calc(4 * var(--u));border-radius:999px;background:${ink};` +
      `border:calc(4 * var(--u)) solid ${ink};box-shadow:0 0 0 calc(3 * var(--u)) #c9a25a,0 calc(5 * var(--u)) 0 rgba(0,0,0,.25);overflow:hidden">` +
      '<div class="bb-back" style="position:absolute;inset:0;width:100%;background:#f2c14e;transition:width .6s ease .25s"></div>' +
      '<div class="bb-fill" style="position:absolute;inset:0;width:100%;background:linear-gradient(#ff7a8a,#d8364d)"></div>' +
      '<div style="position:absolute;left:4%;right:4%;top:16%;height:22%;border-radius:9px;background:rgba(255,255,255,.28)"></div>' +
      `<div class="bb-hp" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:calc(17 * var(--u));` +
      `font-weight:600;-webkit-text-stroke:calc(3 * var(--u)) ${ink};paint-order:stroke fill"></div>` +
      '</div>';
    document.body.appendChild(el);
    return el;
  }
  // under the HUD's target frame when it shows, else where it would be
  function place(b) {
    const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
    const tf = document.getElementById('tframe');
    let top = 16 * u;
    if (tf && !tf.hidden && tf.style.visibility !== 'hidden') top = tf.getBoundingClientRect().bottom + 10 * u;
    else if (tf) top = parseFloat(getComputedStyle(tf).top) || top;
    b.style.top = Math.round(top) + 'px';
  }
  function tick() {
    requestAnimationFrame(tick);
    const game = NC.game;
    if (!game || !game.player || !game.world) return;
    const p = game.player;
    // the fight: the nearest boss that is awake
    let boss = null;
    for (const e of game.enemies) if (isBoss(e) && !e.dead && e.awake && NC.dist(e.x, e.y, p.x, p.y) < 1700) boss = e;
    const b = barEl();
    b.style.opacity = boss ? 1 : 0;
    // the HUD's own target frame would show the same boss again: hidden while the big bar is up
    const tf = $('tframe'), same = boss && (game.target === boss || game.hover === boss);
    if (tf) tf.style.visibility = same ? 'hidden' : '';
    if (boss) {
      place(b);
      const f = NC.clamp(boss.hp / boss.maxHp, 0, 1);
      const name = `★ ${boss.name} · Lv ${boss.lv} · ธาตุ${NC.ELEMENT_INFO[boss.element].th}${boss.raged ? ' · โกรธ!' : ''}`;
      if (name !== lastTxt) { lastTxt = name; b.querySelector('.bb-name').textContent = name; }
      b.querySelector('.bb-fill').style.width = (f * 100).toFixed(2) + '%';
      b.querySelector('.bb-back').style.width = (f * 100).toFixed(2) + '%';
      b.querySelector('.bb-hp').textContent = `${Math.max(0, Math.ceil(boss.hp)).toLocaleString()} / ${boss.maxHp.toLocaleString()}`;
    }
    // a boss whose time is up comes back to its spot (when the hero is not standing right there)
    const world = game.world;
    if (game.hold || !world.spawns) return; // (hold: the world stopped, js/keeprun.js; an open window no longer stops it)
    for (const [type, x, y] of world.spawns) {
      if (!BOSSES[type]) continue;
      const key = game.mapId + ':' + type, at = cooldown[key];
      if (!at || at > now()) continue;
      if (game.enemies.some((e) => e.type === type && !e.dead) || NC.dist(x, y, p.x, p.y) < 900) continue;
      delete cooldown[key];
      game.enemies.push(NC.makeEnemy(type, x, y, NC.spawnLevel(world, type, x, y)));
      FX.puff(x, y - 40, 12, { speed: 160, color: '140,220,255' });
      NC.HUD.log(`${NC.MONSTERS[type].name} กลับมาแล้ว...`, 'warn');
    }
  }
  NC.Boss.tick = tick; // (tests drive it by hand when the tab is in the background)
  requestAnimationFrame(tick);
})();
