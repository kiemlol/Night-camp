/* dunbosses.js — the bosses at the bottom of the dungeons (js/dungeons.js), classic MMOs' MVPs:
     ราชาค้างคาว (bat_king)      Lv 22  the secret bat nest: flies, swoops down a lane, screeches in a ring, calls bats
     นางพญามด (ant_queen)        Lv 50  ant mine B3: leaps onto the hero (a slam), spits a fan of acid (it pools on the
                                       floor), calls worker ants
     ราชาสุสาน (crypt_lord)      Lv 55  crypt floor 2: rings of ghost orbs, ghost fire falling round the hero, calls
                                       skeletons, blinks away
     มังกรลาวา (lava_dragon)     Lv 92  lava vent floor 2: breathes fire down a lane, a leaping slam, meteors
   Every attack is shown first (a red circle or lane on the ground fills up) so it can be dodged; under half their HP
   they get angry (faster, more of everything). They sleep until the hero comes near (or hits them).
   boss.js does the rest for every NC.BOSSES entry: the big HP bar at the top, the drops, the long respawn, killing
   their minions when they fall. Art: assets/monsters/ (pose A = the name, B = name_b), make_monster4_prompts.py.
   Load after dungeons.js (and boss.js, monsters.js, party.js). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;

  // stats as NC.MONSTERS entries (stats.js turns them into numbers per level); moves: what it does; minion: [species,
  // how many]; fly: its hover height; light: [radius, rgb]; top: the name tag over the feet
  const DEFS = {
    bat_king: { name: 'ราชาค้างคาว', element: 'shadow', atkElement: 'shadow', r: 50, hpK: 22, atkK: 1.4, defK: 0.9, mdefK: 0.8,
      agiK: 1, dexK: 1, expK: 24, spd: 160, aggro: 700, fly: 80, moves: ['swoop', 'screech', 'summon'], minion: ['bat', 3],
      light: [320, '200,160,255'], top: 300, fx: '200,160,255' },
    ant_queen: { name: 'นางพญามด', element: 'earth', atkElement: 'earth', r: 72, hpK: 48, atkK: 1.6, defK: 1.6, mdefK: 0.8,
      agiK: 0.3, dexK: 0.9, expK: 42, spd: 72, aggro: 720, moves: ['slam', 'acid', 'summon'], minion: ['worker_ant', 3],
      top: 330, fx: '170,255,120' },
    crypt_lord: { name: 'ราชาสุสาน', element: 'undead', atkElement: 'shadow', r: 58, hpK: 46, atkK: 1.7, defK: 1.2, mdefK: 1.4,
      agiK: 0.5, dexK: 1.1, expK: 48, spd: 82, aggro: 720, moves: ['orbs', 'rain', 'summon', 'blink'], minion: ['skeleton', 3],
      light: [400, '120,200,255'], top: 380, fx: '120,210,255' },
    lava_dragon: { name: 'มังกรลาวา', element: 'fire', atkElement: 'fire', r: 92, hpK: 55, atkK: 1.8, defK: 1.8, mdefK: 1,
      agiK: 0.3, dexK: 1, expK: 60, spd: 76, aggro: 760, moves: ['breath', 'slam', 'rain'], minion: ['fire_bat', 3],
      light: [480, '255,140,60'], top: 340, fx: '255,150,60' },
  };
  for (const [id, D] of Object.entries(DEFS)) {
    NC.MONSTERS[id] = { name: D.name, element: D.element, atkElement: D.atkElement, r: D.r, hpK: D.hpK, atkK: D.atkK, defK: D.defK,
      mdefK: D.mdefK, agiK: D.agiK, dexK: D.dexK, expK: D.expK, spd: D.spd, aggro: D.aggro };
    NC.BOSSES[id] = { respawn: 480, drops: 6, top: D.top };
  }
  const isMine = (e) => !!DEFS[e.type];

  // ---------------- helpers (as boss.js) ----------------
  const hitHero = (game, e, mul) => {
    const p = game.player;
    if (p.inv > 0 || p.dead > 0) return false;
    const r = NC.monsterHit(e, p.d);
    if (r.miss) { FX.num(p.x, p.y - 150, r.lucky ? 'Lucky!' : 'MISS', { fill: r.lucky ? '#ffe28a' : '#cfd8ff', size: 34 }); p.inv = 0.3; return false; }
    NC.hurtPlayer(game, Math.max(1, Math.round(r.dmg * mul)), e.x);
    return true;
  };
  const hurtParty = (game, e, x, y, r, mul) => { if (NC.Party && NC.Party.hurtArea) NC.Party.hurtArea(game, e, x, y, r, mul); };
  const inEllipse = (x, y, cx, cy, r) => ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.58)) ** 2 < 1;
  const inLane = (x, y, e) => { // along the lane from (lx, ly) at angle ang, len long, w wide (squashed like the ground)
    const dx = x - e.lx, dy = (y - e.ly) / 0.62, a = e.ang, along = dx * Math.cos(a) + dy * Math.sin(a) / 1, across = -dx * Math.sin(a) + dy * Math.cos(a);
    return along > 0 && along < e.len && Math.abs(across) < e.lw / 2;
  };
  const say = (game, text, kind) => { game.toast(text); NC.HUD.log(text, kind || 'warn'); };
  // (dun: which helper made an effect, so js/rootfx.js can paint the root-possessed bosses' ones with its Codex pieces)
  function warnCircle(x, y, r, life, owner, rgb) {
    return FX.add({ type: 'custom', dun: 'warn', layer: 'low', x, y, r, life, owner, draw(ctx, p, u) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.58);
      ctx.fillStyle = `rgba(255,70,90,${0.12 + 0.1 * Math.sin(p.t * 18)})`; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,90,110,0.32)'; ctx.beginPath(); ctx.arc(0, 0, p.r * Math.min(1, u), 0, TAU); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = `rgba(${rgb || '255,120,130'},0.85)`; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.stroke();
      ctx.restore();
    } });
  }
  function warnLane(x, y, ang, len, w, life, owner) {
    return FX.add({ type: 'custom', dun: 'lane', layer: 'low', x, y, ang, len, w, life, owner, draw(ctx, p, u) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.62); ctx.rotate(p.ang);
      ctx.fillStyle = `rgba(255,70,90,${0.12 + 0.1 * Math.sin(p.t * 18)})`; NC.rrect(ctx, 0, -p.w / 2, p.len, p.w, p.w / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,90,110,0.32)'; NC.rrect(ctx, 0, -p.w / 2, Math.max(p.w, p.len * Math.min(1, u)), p.w, p.w / 2); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,120,130,0.85)'; NC.rrect(ctx, 0, -p.w / 2, p.len, p.w, p.w / 2); ctx.stroke();
      ctx.restore();
    } });
  }
  // a glowing ball that flies until it hits the hero or a wall
  function orb(game, e, x, y, a, speed, rgb, mul, life, onEnd) {
    return FX.add({ type: 'custom', dun: 'orb', rgb, layer: 'glow', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.62, life: life || 1.6, owner: e, R: 30,
      update(c, dt, g) {
        const p = g.player;
        if (!NC.terrainFits(g.world, c.x, c.y, 6)) { c.dead = true; return; }
        if (p.dead <= 0 && Math.hypot(p.x - c.x, (p.y - 50 - c.y) * 1.2) < c.R + 22) { hitHero(g, c.owner, mul); c.dead = true; FX.puff(c.x, c.y, 5, { speed: 110, color: rgb }); }
      },
      onEnd: onEnd || null,
      draw(ctx, c) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.R * 1.8);
        g.addColorStop(0, `rgba(255,255,255,0.95)`); g.addColorStop(0.35, `rgba(${rgb},0.85)`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.R * 1.8, 0, TAU); ctx.fill();
        ctx.restore();
      } });
  }
  // a puddle (acid, lava) that hurts the hero standing in it now and then
  function puddle(game, e, x, y, R, life, rgb, mul) {
    return FX.add({ type: 'custom', dun: 'puddle', rgb, layer: 'low', x, y, R, life, owner: e, tick: 0.3,
      update(c, dt, g) {
        c.tick -= dt;
        const p = g.player;
        if (c.tick <= 0 && c.t > 0.2 && p.dead <= 0 && inEllipse(p.x, p.y, c.x, c.y, c.R)) { c.tick = 0.6; hitHero(g, c.owner, mul); }
      },
      draw(ctx, c) {
        const a = Math.min(1, c.t / 0.25) * Math.min(1, (c.life - c.t) / 0.5);
        ctx.save(); ctx.globalAlpha = a * 0.8; ctx.translate(c.x, c.y); ctx.scale(1, 0.58);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, c.R);
        g.addColorStop(0, `rgba(${rgb},0.75)`); g.addColorStop(0.8, `rgba(${rgb},0.45)`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c.R, 0, TAU); ctx.fill();
        ctx.restore();
      } });
  }

  // ---------------- the fight ----------------
  function wake(game, e) {
    if (e.awake) return;
    e.awake = true; e.state = 'roar'; e.t = 0;
    game.shake = Math.max(game.shake, 14);
    FX.ring(e.x, e.y - 60, 30, 440, DEFS[e.type].fx, 0.8, 10);
    say(game, `${e.name} ตื่นแล้ว!`);
  }
  function pick(game, e, D, dp) {
    const minions = game.enemies.filter((m) => m.owner === e && !m.dead).length, opts = [];
    for (const m of D.moves) {
      if (m === 'summon') { if (minions < 5 && e.summonCd <= 0 && e.hp < e.maxHp * 0.85) opts.push([m, 2.4]); continue; }
      if (m === 'slam' || m === 'screech') { if (dp < 420) opts.push([m, 3]); continue; }
      if (m === 'swoop' || m === 'breath') { opts.push([m, dp > 200 ? 3 : 1.5]); continue; }
      if (m === 'blink') { if (dp < 260) opts.push([m, 2]); continue; }
      opts.push([m, 2.5]);
    }
    let s = 0;
    for (const [, w] of opts) s += w;
    let r = Math.random() * s, k = opts[0][0];
    for (const [m, w] of opts) if ((r -= w) <= 0) { k = m; break; }
    start(game, e, D, k);
  }
  function start(game, e, D, kind) {
    const p = game.player, rage = e.raged ? 0.78 : 1;
    e.state = kind; e.t = 0; e.done = false; e.n = 0;
    if (kind === 'slam') {
      e.wind = 0.95 * rage;
      const d = Math.min(300, NC.dist(e.x, e.y, p.x, p.y)), a = NC.angle(e.x, e.y, p.x, p.y);
      e.tx = e.x + Math.cos(a) * d; e.ty = e.y + Math.sin(a) * d;
      if (!game.world.fits(e.tx, e.ty, e.r * 0.6)) { e.tx = e.x; e.ty = e.y; }
      e.jx = e.x; e.jy = e.y;
      warnCircle(e.tx, e.ty, 240, e.wind + 0.36, e);
    } else if (kind === 'swoop' || kind === 'breath') {
      e.wind = (kind === 'breath' ? 0.95 : 0.7) * rage;
      e.ang = NC.angle(e.x, e.y, p.x, p.y); e.lx = e.x; e.ly = e.y;
      e.len = kind === 'breath' ? 600 : 640; e.lw = kind === 'breath' ? 250 : 170;
      warnLane(e.x, e.y, e.ang, e.len, e.lw, e.wind, e);
    } else if (kind === 'screech') {
      e.wind = 0.85 * rage;
      warnCircle(e.x, e.y, 330, e.wind, e, D.fx);
    } else if (kind === 'rain') {
      e.wind = 0.2; e.spots = [];
      const n = e.raged ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = i === 0 ? 0 : NC.rand(90, 360);
        let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.62;
        if (!game.world.fits(x, y, 10)) { x = p.x; y = p.y; }
        const delay = 0.95 + i * 0.12;
        e.spots.push({ x, y, at: delay, done: false });
        warnCircle(x, y, 125, delay, e, D.fx);
      }
    } else if (kind === 'acid' || kind === 'orbs') {
      e.wind = 0.6 * rage;
    } else if (kind === 'summon') {
      e.wind = 0.8;
      FX.puff(e.x, e.y - 40, 10, { speed: 160, color: D.fx });
    } else if (kind === 'blink') {
      e.wind = 0.35;
    }
  }

  function update(game, e, dt) {
    if (e.dead) return;
    const D = DEFS[e.type], p = game.player, world = game.world;
    e.t += dt; e.anim += dt;
    e.flash = Math.max(0, e.flash - dt); e.slow = Math.max(0, e.slow - dt); e.show = Math.max(0, e.show - dt);
    e.kbx = e.kby = 0;
    if (e.cd === undefined) { e.cd = 1.2; e.summonCd = 8; e.z = D.fly || 0; }
    if (D.light) {
      if (!e.light || !world.lights.includes(e.light)) { e.light = { x: e.x, y: e.y, r: D.light[0], rgb: D.light[1], flick: Math.random() * 10, owner: e, boss: true }; world.lights.push(e.light); }
      e.light.x = e.x; e.light.y = e.y - D.top * 0.55 - (e.z || 0);
    }
    const alive = p.dead <= 0, dp = NC.dist(e.x, e.y, p.x, p.y), toP = NC.angle(e.x, e.y, p.x, p.y), home = NC.dist(e.x, e.y, e.sx, e.sy);
    if (!e.raged && e.awake && e.hp < e.maxHp * 0.5) {
      e.raged = true;
      FX.ring(e.x, e.y - 80, 40, 540, '255,120,160', 0.9, 12);
      game.shake = Math.max(game.shake, 16);
      say(game, `${e.name} โกรธจัด! (โจมตีเร็วขึ้น แรงขึ้น)`);
    }
    const sp = (e.slow > 0 ? 0.6 : 1) * (e.raged ? 1.3 : 1);
    e.cd -= dt * (e.raged ? 1.4 : 1); e.summonCd -= dt;
    const hover = D.fly ? D.fly + Math.sin(e.anim * 3) * 10 : 0;
    const settle = () => { if (D.fly) e.z += (hover - e.z) * Math.min(1, dt * 5); };

    switch (e.state) {
      case 'idle':
        settle();
        if (alive && dp < D.aggro) wake(game, e);
        break;
      case 'roar':
        settle();
        if (Math.random() < dt * 20) FX.add({ type: 'ember', x: e.x + NC.rand(-110, 110), y: e.y - NC.rand(120, 260), vx: 0, vy: NC.rand(-160, -80), life: 0.8 });
        if (e.t > 1.3) { e.state = 'chase'; e.t = 0; e.cd = 0.5; }
        break;
      case 'chase': {
        settle();
        if (!e.awake) { wake(game, e); break; }
        if (!alive || home > 1500) { NC.bossStartHome(e, home); break; }
        e.face = Math.cos(toP) > 0 ? 1 : -1;
        const want = D.fly ? 230 : 170;
        if (dp > want) NC.tryMove(world, e, Math.cos(toP) * D.spd * sp * dt, Math.sin(toP) * D.spd * sp * dt);
        else if (D.fly) { const a = toP + Math.PI / 2; NC.tryMove(world, e, Math.cos(a) * D.spd * 0.6 * dt, Math.sin(a) * D.spd * 0.4 * dt); }
        if (e.cd <= 0) pick(game, e, D, dp);
        break;
      }
      case 'slam': {
        if (e.t < e.wind) { settle(); break; }
        const u = Math.min(1, (e.t - e.wind) / 0.36);
        e.x = NC.lerp(e.jx, e.tx, u); e.y = NC.lerp(e.jy, e.ty, u);
        e.z = Math.sin(Math.PI * u) * 150;
        if (u >= 1 && !e.done) {
          e.done = true; e.z = 0;
          game.shake = Math.max(game.shake, 18); game.hitstop = Math.max(game.hitstop, 0.05);
          FX.ring(e.x, e.y, 30, 300, '255,220,170', 0.45, 12);
          FX.puff(e.x, e.y, 14, { speed: 320, color: '160,140,130', size: 1.3 });
          if (alive && inEllipse(p.x, p.y, e.x, e.y, 242) && hitHero(game, e, 1.5)) {
            const a = NC.angle(e.x, e.y, p.x, p.y);
            for (let k = 0; k < 6; k++) NC.tryMove(world, p, Math.cos(a) * 22, Math.sin(a) * 14);
          }
          hurtParty(game, e, e.x, e.y, 242, 1.5);
          e.state = 'recover'; e.t = 0; e.rec = 0.8; e.cd = NC.rand(1.3, 2.3);
        }
        break;
      }
      case 'swoop': {
        if (e.t < e.wind) { e.face = Math.cos(e.ang) > 0 ? 1 : -1; e.z += (D.fly + 40 - e.z) * Math.min(1, dt * 6); break; }
        NC.tryMove(world, e, Math.cos(e.ang) * 1150 * dt, Math.sin(e.ang) * 1150 * dt);
        e.z += (18 - e.z) * Math.min(1, dt * 12);
        if (Math.random() < dt * 30) FX.puff(e.x, e.y, 1, { speed: 60, color: '160,140,190' });
        if (!e.done && alive && NC.dist(e.x, e.y, p.x, p.y) < e.r + 60 && hitHero(game, e, 1.3)) e.done = true;
        if (e.t > e.wind + e.len / 1150) { e.state = 'recover'; e.t = 0; e.rec = 0.7; e.cd = NC.rand(1.1, 1.9); }
        break;
      }
      case 'breath': {
        if (e.t < e.wind) { e.face = Math.cos(e.ang) > 0 ? 1 : -1; break; }
        const u = e.t - e.wind;
        // a stream of fire down the lane: embers and a tick of damage while the hero is in it
        for (let k = 0; k < 4; k++) {
          const d = Math.random() * e.len, s = (Math.random() - 0.5) * e.lw * 0.8;
          const x = e.lx + Math.cos(e.ang) * d - Math.sin(e.ang) * s, y = e.ly + (Math.sin(e.ang) * d + Math.cos(e.ang) * s) * 0.62;
          FX.add({ type: 'ember', x, y: y - 30, vx: Math.cos(e.ang) * 160, vy: NC.rand(-160, -60), life: NC.rand(0.35, 0.7) });
        }
        if (Math.random() < dt * 12) FX.puff(e.lx + Math.cos(e.ang) * NC.rand(80, e.len), e.ly + Math.sin(e.ang) * NC.rand(80, e.len) * 0.62, 1, { speed: 40, color: '255,150,60', size: 1.2 });
        e.tick = (e.tick || 0) - dt;
        if (e.tick <= 0) { e.tick = 0.25; if (alive && inLane(p.x, p.y, e)) hitHero(game, e, 0.55); }
        if (u > 1.0) { e.state = 'recover'; e.t = 0; e.rec = 0.6; e.cd = NC.rand(1.2, 2); }
        break;
      }
      case 'screech':
        settle();
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          for (let k = 0; k < 3; k++) FX.ring(e.x, e.y - 40, 20 + k * 30, 340, D.fx, 0.5 + k * 0.12, 8);
          game.shake = Math.max(game.shake, 10);
          if (alive && inEllipse(p.x, p.y, e.x, e.y, 332) && hitHero(game, e, 0.9)) {
            const a = NC.angle(e.x, e.y, p.x, p.y);
            for (let k = 0; k < 8; k++) NC.tryMove(world, p, Math.cos(a) * 20, Math.sin(a) * 12);
          }
          hurtParty(game, e, e.x, e.y, 332, 0.9);
          e.state = 'recover'; e.t = 0; e.rec = 0.5; e.cd = NC.rand(1.4, 2.2);
        }
        break;
      case 'acid':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          const n = e.raged ? 7 : 5, spread = 0.95;
          for (let i = 0; i < n; i++) {
            const a = toP - spread / 2 + (spread * i) / (n - 1);
            orb(game, e, e.x + Math.cos(a) * 60, e.y - 70, a, 560, '150,255,100', 0.8, 1.3, (c, g) => { if (Math.random() < 0.5) puddle(g, e, c.x, c.y + 60, 70, 3.2, '130,230,90', 0.3); });
          }
          e.state = 'recover'; e.t = 0; e.rec = 0.5; e.cd = NC.rand(1.3, 2.1);
        }
        break;
      case 'orbs':
        if (e.t >= e.wind + e.n * 0.45 && e.n < 3) {
          const k = e.raged ? 10 : 8, off = e.n * 0.35;
          for (let i = 0; i < k; i++) orb(game, e, e.x, e.y - 120, off + (i / k) * TAU, 330, '130,210,255', 0.7, 2.6);
          FX.ring(e.x, e.y - 120, 20, 160, '130,210,255', 0.4, 6);
          e.n++;
        }
        if (e.n >= 3) { e.state = 'recover'; e.t = 0; e.rec = 0.6; e.cd = NC.rand(1.5, 2.4); }
        break;
      case 'rain': {
        let left = 0;
        for (const s of e.spots) {
          if (s.done) continue;
          left++;
          if (e.t < s.at) continue;
          s.done = true;
          FX.ring(s.x, s.y, 16, 150, D.fx, 0.4, 8);
          FX.puff(s.x, s.y, 8, { speed: 200, color: D.fx, size: 1.1 });
          for (let k = 0; k < 6; k++) FX.add({ type: 'ember', x: s.x + NC.rand(-50, 50), y: s.y - NC.rand(0, 60), vx: 0, vy: NC.rand(-220, -120), life: 0.7 });
          if (alive && inEllipse(p.x, p.y, s.x, s.y, 128)) hitHero(game, e, 1);
          hurtParty(game, e, s.x, s.y, 128, 1);
        }
        if (!left) { e.state = 'recover'; e.t = 0; e.rec = 0.4; e.cd = NC.rand(1.4, 2.2); }
        break;
      }
      case 'summon':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          const [type, n] = D.minion;
          for (let i = 0; i < n + (e.raged ? 1 : 0); i++) {
            const a = (i / n) * TAU + NC.rand(-0.4, 0.4);
            let x = e.x + Math.cos(a) * 190, y = e.y + Math.sin(a) * 120;
            if (!world.fits(x, y, 26)) { x = e.x; y = e.y + 80; }
            const m = NC.makeEnemy(type, x, y, Math.max(1, e.lv - 8));
            m.owner = e; m.state = 'chase';
            game.enemies.push(m);
            FX.puff(x, y - 20, 6, { speed: 90, color: D.fx });
          }
          e.summonCd = 14;
          e.state = 'recover'; e.t = 0; e.rec = 0.5; e.cd = NC.rand(1, 1.8);
        }
        break;
      case 'blink':
        if (e.t >= e.wind && !e.done) {
          e.done = true;
          FX.puff(e.x, e.y - 60, 12, { speed: 200, color: D.fx });
          for (let k = 0; k < 20; k++) {
            const a = Math.random() * TAU, d = NC.rand(320, 460), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.62;
            if (world.fits(x, y, e.r * 0.6) && NC.dist(x, y, e.sx, e.sy) < 1300) { e.x = x; e.y = y; break; }
          }
          FX.puff(e.x, e.y - 60, 12, { speed: 200, color: D.fx });
          FX.ring(e.x, e.y - 40, 20, 220, D.fx, 0.5, 8);
          e.state = 'recover'; e.t = 0; e.rec = 0.35; e.cd = 0.4;
        }
        break;
      case 'recover':
        settle();
        if (e.t > e.rec) { e.state = 'chase'; e.t = 0; }
        break;
      case 'return': // walk home (js/boss.js NC.bossWalkHome: leashed, no heal while beaten, put back home when walled off)
        settle();
        NC.bossWalkHome(world, e, dt, 170, alive, dp, D.aggro);
        break;
      default:
        e.state = e.awake ? 'chase' : 'idle';
    }
    e.sort = e.y;
  }

  function draw(ctx, game, e) {
    const D = DEFS[e.type];
    const tint = e.flash > 0 ? ['#ffffff', 0.7] : e.slow > 0 ? ['#8fd8ff', 0.4] : e.raged ? ['#ff5f7a', 0.1 + 0.07 * Math.sin(e.anim * 6)] : null;
    const winding = e.t < (e.wind || 0);
    const attack = e.state === 'roar' || (e.state !== 'chase' && e.state !== 'idle' && e.state !== 'recover' && e.state !== 'return' && (!winding || e.state === 'screech' || e.state === 'summon'));
    let sx = 1 + Math.sin(e.anim * 2.2) * 0.02, sy = 1 - Math.sin(e.anim * 2.2) * 0.02, rot = 0, dx = 0;
    if (e.state === 'slam' && winding) { const u = Math.min(1, e.t / e.wind); sx += 0.1 * u; sy -= 0.14 * u; }
    if (e.state === 'swoop' && !winding) rot = 0.3 * (Math.cos(e.ang) > 0 ? 1 : -1);
    if ((e.state === 'breath' || e.state === 'swoop') && winding) dx = -Math.cos(e.ang) * 10 * Math.min(1, e.t / 0.2);
    if (e.state === 'chase' && !D.fly) sy += Math.abs(Math.sin(e.anim * 4)) * 0.03;
    if (D.fly) { const beat = Math.sin(e.anim * 9); sx += beat * -0.03; sy += beat * 0.05; }
    const z = e.z || 0;
    NC.drawShadow(ctx, e.x, e.y + 2, e.r * 1.6 - z * 0.25, e.r * 0.45 - z * 0.06, 0.4);
    const name = attack && NC.SPR[e.type + '_b'] ? e.type + '_b' : e.type;
    NC.drawSpr(ctx, name, e.x + dx, e.y - z, { flip: e.face > 0, sx, sy, rot, tint });
    if (e.state === 'idle') { // asleep: a few z's
      ctx.save();
      ctx.font = "700 34px 'Baloo 2', sans-serif"; ctx.textAlign = 'center';
      ctx.lineWidth = 7; ctx.strokeStyle = NC.OUTLINE; ctx.fillStyle = '#dff6ff';
      for (let i = 0; i < 3; i++) {
        const u = (e.anim * 0.5 + i / 3) % 1;
        ctx.globalAlpha = Math.sin(u * Math.PI);
        const x = e.x - 80 + u * 60, y = e.y - D.top + 30 - u * 90 - z;
        ctx.strokeText('z', x, y); ctx.fillText('z', x, y);
      }
      ctx.restore();
    }
  }

  // ---------------- hooks ----------------
  const baseUpdate = NC.updateEnemy, baseDraw = NC.drawEnemy, baseDamage = NC.damageEnemy;
  NC.updateEnemy = function (game, e, dt) {
    if (isMine(e)) return update(game, e, dt);
    return baseUpdate.apply(this, arguments);
  };
  NC.drawEnemy = function (ctx, game, e) {
    if (isMine(e)) return draw(ctx, game, e);
    return baseDraw.apply(this, arguments);
  };
  NC.damageEnemy = function (game, e) {
    if (isMine(e) && !e.awake && e.hp > 0) wake(game, e);
    return baseDamage.apply(this, arguments);
  };
  NC.DUNGEON_BOSSES = DEFS;
})();
