/* monkinds.js — eight more ways for a monster to fight (the expansion plan, part 1: more variety from Lv 10 on), on top
   of monsters.js's four (hop / melee / charge / fly). A species picks one with `kind`:
     ranged    keeps its distance, aims (a red line shows where) and shoots: shot {rgb, speed, size, n, spread, mul}, range
     summoner  keeps its distance, calls helpers (minion: [species, how many alive at most]) and otherwise shoots a weak bolt
     healer    keeps its distance, heals the most hurt monster near it (a green beam), otherwise shoots
     bomber    runs in, swells for a moment (a red circle on the ground shows the blast) and bursts: blast, blastMul. It is
               gone then (no loot); kill it first and it drops as usual
     burrow    digs in (can't be hit), a mound races to the hero, a ring of dirt shows where it will come up, then it bursts
               out (pose B) and fights on the surface for a while
     shield    melee, but physical hits from the front do 30% ("บล็อก"): go round it or use magic
     splitter  melee; when it falls it breaks into splitN (2) small pieces (e.mini, a third of the HP, no loot)
     leader    fights the way of its `base` (charge / fly / melee); monsters near it move and attack faster (a gold ring at
               their feet); when it falls the pack runs home
   It needs monsters.js's small hooks (NC.MON_KIT, NC.MON_DRAW, S.base, e.rush, e.mini) and the lootless checks in
   loot.js / materials.js. Load after monsters.js (and boss.js, which drops the respawn of anything with an owner). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, K = NC.MON_KIT, TAU = Math.PI * 2;
  if (!K || !NC.SPECIES) return;
  const { AI, walk, wander, goHome, lostTrack } = K;
  const SPECIES = NC.SPECIES;
  const NEW = new Set(['ranged', 'summoner', 'healer', 'bomber', 'burrow', 'shield', 'splitter', 'leader']);
  const mine = (e) => { const S = SPECIES[e.type]; return S && NEW.has(S.kind) ? S : null; };

  // a hit on the hero from a monster, times mul
  function hit(game, e, mul) {
    const p = game.player;
    if (p.inv > 0 || p.dead > 0) return;
    const r = NC.monsterHit(e, p.d);
    if (r.miss) { FX.num(p.x, p.y - 150, r.lucky ? 'Lucky!' : 'MISS', { fill: r.lucky ? '#ffe28a' : '#cfd8ff', size: 34 }); p.inv = 0.3; return; }
    NC.hurtPlayer(game, Math.max(1, Math.round(r.dmg * (mul || 1))), e.x);
  }

  // ---------------- keeping a distance (ranged, summoner, healer) ----------------
  function keepAway(game, e, S, dt, k, c) {
    const range = S.range || 380, p = game.player;
    e.moving = true; e.face = Math.cos(c.toP) > 0 ? 1 : -1;
    if (c.dp > range) walk(game, e, c.toP, S.spd * k, dt);
    else if (c.dp < range * 0.55) { walk(game, e, c.toP + Math.PI, S.spd * 0.8 * k, dt); e.face = p.x > e.x ? 1 : -1; }
    else { const side = c.toP + (Math.sin(e.anim * 0.7 + e.sx) > 0 ? 1.4 : -1.4); walk(game, e, side, S.spd * 0.35 * k, dt); e.face = p.x > e.x ? 1 : -1; }
  }
  function shoot(game, e, S, ang) {
    const sh = S.shot || {}, n = sh.n || 1, spread = sh.spread || 0.25, v = sh.speed || 520;
    e.shots = e.shots || [];
    for (let i = 0; i < n; i++) {
      const a = ang + (n > 1 ? (i / (n - 1) - 0.5) * spread * 2 : 0);
      e.shots.push({ x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, z: 50 });
    }
    FX.puff(e.x + e.face * 30, e.y - 50, 3, { speed: 60, size: 0.5, color: sh.rgb || '255,220,150' });
  }
  function moveShots(game, e, S, dt) {
    if (!e.shots || !e.shots.length) return;
    const p = game.player, w = game.world, sh = S.shot || {};
    for (const s of e.shots) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.t > 1.8 || (w.isSolid && NC.shotWall(w, s.x, s.y))) { s.dead = true; continue; }
      if (p.dead <= 0 && Math.hypot(s.x - p.x, (s.y - p.y) * 1.3) < 42 + (sh.size || 14)) {
        s.dead = true; hit(game, e, sh.mul || 1);
        FX.puff(s.x, s.y - s.z, 5, { speed: 120, size: 0.6, color: sh.rgb || '255,220,150' });
      }
    }
    e.shots = e.shots.filter((s) => !s.dead);
  }
  const allies = (game, e, r) => game.enemies.filter((m) => m !== e && !m.dead && m.hp > 0 && m.kind === 'enemy' && Math.hypot(m.x - e.x, m.y - e.y) < r);

  const ranged = (act) => (game, e, S, dt, k, c) => {
    switch (e.state) {
      case 'idle':
        wander(game, e, dt, 50 * k);
        if (c.alive && c.dp < S.aggro) { e.state = 'chase'; e.t = 0; e.cool = NC.rand(0.4, 1.2); }
        break;
      case 'chase':
        if (lostTrack(e, c)) { e.state = 'return'; break; }
        keepAway(game, e, S, dt, k, c);
        e.cool = (e.cool || 0) - dt;
        if (e.cool <= 0 && c.dp < (S.range || 380) * 1.15) {
          const what = act(game, e, S);
          if (what) { e.state = 'windup'; e.t = 0; e.act = what; e.atkAng = c.toP; e.moving = false; }
          else e.cool = 0.6;
        }
        break;
      case 'windup': // aims (or gathers its power); the wind-up flickers red
        e.moving = false;
        if (e.act === 'shoot' && e.t < 0.4 / k) { e.atkAng = c.toP; e.face = Math.cos(c.toP) > 0 ? 1 : -1; }
        if (e.t > (e.act === 'shoot' ? 0.6 : 0.9) / k) { e.state = 'act'; e.t = 0; doAct(game, e, S); }
        break;
      case 'act':
        if (e.t > 0.35) { e.state = 'chase'; e.t = 0; e.cool = e.act === 'shoot' ? (S.fire || 2.2) : (S.every || 5); }
        break;
      case 'return': goHome(game, e, S, dt, c); break;
      default: e.state = 'idle'; e.t = 0;
    }
  };
  function doAct(game, e, S) {
    if (e.act === 'shoot') return shoot(game, e, S, e.atkAng);
    if (e.act === 'summon') {
      const [type, most] = S.minion, n = Math.min(2, most - helpers(game, e).length);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, x = e.x + Math.cos(a) * 90, y = e.y + Math.sin(a) * 55;
        if (game.world.fits && !game.world.fits(x, y, 26)) continue;
        const m = NC.makeEnemy(type, x, y, Math.max(1, e.lv - 2));
        if (!m) continue;
        m.owner = e; m.lootless = true; m.exp = Math.round(m.exp * 0.25); m.jexp = Math.round(m.jexp * 0.25);
        m.state = 'chase'; m.t = 0;
        game.enemies.push(m);
        FX.ring(x, y, 10, 90, S.fx || '200,170,255', 0.6, 6);
      }
      return;
    }
    if (e.act === 'heal') {
      const m = e.healOn;
      if (!m || m.dead) return;
      const add = Math.round(m.maxHp * (S.heal || 0.18));
      m.hp = Math.min(m.maxHp, m.hp + add);
      e.beam = { m, t: 0.6 };
      FX.num(m.x, NC.labelTop(m) - 40, '+' + add, { fill: '#8fe06a', size: 30 });
      FX.stars(m.x, m.y - 50, 6, '150,255,150', { speed: 140 });
    }
  }
  const helpers = (game, e) => game.enemies.filter((m) => m.owner === e && !m.dead);
  AI.ranged = ranged(() => 'shoot');
  AI.summoner = ranged((game, e, S) => (helpers(game, e).length < S.minion[1] && (e.sumCool || 0) <= game.time ? (e.sumCool = game.time + (S.every || 7), 'summon') : S.shot ? 'shoot' : null));
  AI.healer = ranged((game, e, S) => {
    if ((e.healCool || 0) <= game.time) {
      const hurt = allies(game, e, 420).concat([e]).filter((m) => m.hp < m.maxHp * 0.85).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) { e.healOn = hurt; e.healCool = game.time + (S.every || 5); return 'heal'; }
    }
    return S.shot ? 'shoot' : null;
  });

  // ---------------- bomber ----------------
  AI.bomber = (game, e, S, dt, k, c) => {
    switch (e.state) {
      case 'idle':
        wander(game, e, dt, 55 * k);
        if (c.alive && c.dp < S.aggro) { e.state = 'chase'; e.t = 0; }
        break;
      case 'chase':
        if (lostTrack(e, c)) { e.state = 'return'; break; }
        e.moving = true; e.face = Math.cos(c.toP) > 0 ? 1 : -1;
        if (c.dp < 95) { e.state = 'fuse'; e.t = 0; e.moving = false; break; }
        walk(game, e, c.toP, S.spd * 1.15 * k, dt);
        break;
      case 'fuse':
        e.moving = false;
        if (e.t > (S.fuse || 1.1)) burst(game, e, S);
        break;
      case 'return': goHome(game, e, S, dt, c); break;
      default: e.state = 'idle'; e.t = 0;
    }
  };
  function burst(game, e, S) {
    const R = S.blast || 150, p = game.player;
    FX.ring(e.x, e.y, 20, R * 1.2, S.fx || '255,170,80', 0.7, 12);
    FX.puff(e.x, e.y - 30, 16, { speed: 260, color: S.color || '255,170,80' });
    game.shake = Math.max(game.shake, 10);
    if (p.dead <= 0 && Math.hypot(p.x - e.x, (p.y - e.y) * 1.4) < R) hit(game, e, S.blastMul || 2.2);
    // gone: no loot, no EXP; back later like any other monster
    e.hp = 0; e.dead = true; e.selfDestruct = true;
    if (e.light) { const L = game.world.lights, i = L ? L.indexOf(e.light) : -1; if (i >= 0) L.splice(i, 1); e.light = null; }
    if (!e.owner) game.respawns.push({ type: e.type, x: e.sx, y: e.sy, t: 22 });
  }

  // ---------------- burrow ----------------
  AI.burrow = (game, e, S, dt, k, c) => {
    const p = game.player;
    if (e.state === 'windup' || e.state === 'strike' || e.state === 'recover') { // its bite on the surface: melee's
      AI.melee(game, e, S, dt, k, c);
      return;
    }
    switch (e.state) {
      case 'idle':
        wander(game, e, dt, 50 * k);
        if (c.alive && c.dp < S.aggro) { e.state = 'chase'; e.t = 0; e.cool = 0.5; }
        break;
      case 'chase': // on the surface: walks up and bites (as melee), and digs in when the hero is far
        if (lostTrack(e, c)) { e.state = 'return'; break; }
        e.cool = (e.cool || 0) - dt;
        if (c.dp > 200 && e.cool <= 0) { e.state = 'dig'; e.t = 0; e.moving = false; break; }
        AI.melee(game, e, S, dt, k, c);
        break;
      case 'dig':
        if (e.t > 0.4) { e.state = 'under'; e.t = 0; e.hidden = true; }
        break;
      case 'under': { // a mound races to the hero
        walk(game, e, c.toP, S.spd * 1.7 * k, dt);
        if (Math.random() < dt * 18) FX.puff(e.x, e.y, 1, { speed: 50, size: 0.6, color: S.dust || '140,110,80' });
        if (c.dp < 40 || e.t > 2.6) { e.state = 'rise'; e.t = 0; e.popX = e.x; e.popY = e.y; }
        break;
      }
      case 'rise': // a ring of dirt where it comes up
        if (e.t > 0.6 / k) {
          e.hidden = false; e.state = 'popped'; e.t = 0;
          FX.puff(e.x, e.y, 12, { speed: 200, color: S.dust || '140,110,80' });
          FX.ring(e.x, e.y, 20, 110, '220,190,150', 0.5, 8);
          if (p.dead <= 0 && Math.hypot(p.x - e.x, (p.y - e.y) * 1.4) < 100) hit(game, e, S.popMul || 1.4);
        }
        break;
      case 'popped':
        if (e.t > 0.9) { e.state = 'chase'; e.t = 0; e.cool = S.every || 4.5; }
        break;
      case 'return': e.hidden = false; goHome(game, e, S, dt, c); break;
      default: e.state = 'idle'; e.t = 0;
    }
  };
  AI.shield = AI.melee;
  AI.splitter = AI.melee;

  // ---------------- every frame: shots, beams, the leaders' aura ----------------
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    if (e.rush && (e.rushT || 0) < game.time) e.rush = 0;
    const S = mine(e);
    if (S && e.hidden && e.state !== 'under' && e.state !== 'rise' && e.state !== 'dig') e.hidden = false;
    baseUpdate(game, e, dt);
    if (!S) return;
    moveShots(game, e, S, dt);
    if (e.beam) { e.beam.t -= dt; if (e.beam.t <= 0) e.beam = null; }
    if (S.kind === 'leader' && !e.dead) for (const m of allies(game, e, 380)) { m.rush = 1.3; m.rushT = game.time + 0.4; }
  };

  // ---------------- hits on them ----------------
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const S = mine(e);
    if (!S) return baseDamage.apply(this, arguments);
    if (e.hidden) return; // underground
    if (S.kind === 'shield' && r && !r.miss && !r.magic && !(o && o.dot) && e.stun <= 0 && e.frozen <= 0) {
      const p = game.player;
      if (p && (p.x - e.x) * e.face > 0) { // from the front
        r = Object.assign({}, r, { dmg: Math.max(1, Math.round(r.dmg * 0.3)) });
        if ((e.blockT || 0) < game.time) { e.blockT = game.time + 0.5; FX.num(e.x, NC.labelTop(e) - 20, 'บล็อก', { fill: '#cfe3ff', size: 28 }); }
        FX.sparks(e.x + e.face * 34, e.y - 50, 4, '220,235,255');
        kx *= 0.3; ky *= 0.3;
      }
    }
    const was = e.hp;
    baseDamage.call(this, game, e, r, kx, ky, o);
    if (!(was > 0 && e.hp <= 0)) return;
    if (S.kind === 'splitter' && !e.mini) split(game, e, S);
    if (S.kind === 'leader') for (const m of allies(game, e, 460)) if (m.state !== 'idle') { m.state = 'return'; m.t = 0; }
  };
  function split(game, e, S) {
    const n = S.splitN || 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random(), x = e.x + Math.cos(a) * 40, y = e.y + Math.sin(a) * 26;
      const m = NC.makeEnemy(e.type, x, y, e.lv);
      if (!m) continue;
      m.mini = 0.58; m.r = Math.round(m.r * 0.6); m.owner = e; m.lootless = true;
      m.maxHp = m.hp = Math.max(1, Math.round(m.maxHp * 0.3));
      m.exp = Math.round(m.exp * 0.3); m.jexp = Math.round(m.jexp * 0.3);
      m.state = 'chase'; m.t = 0; m.kbx = Math.cos(a) * 260; m.kby = Math.sin(a) * 160;
      game.enemies.push(m);
    }
  }

  // ---------------- drawing (monsters.js calls these first for the new kinds) ----------------
  const tintOf = (e) => (e.flash > 0 ? ['#ffffff', 0.85] : e.frozen > 0 ? ['#bfeaff', 0.55] : e.slow > 0 ? ['#8fd8ff', 0.45] : e.poison ? ['#7fe05a', 0.35] : null);
  const pose = (type, b) => (b && NC.SPR[type + '_b'] ? type + '_b' : type);
  function body(ctx, game, e, S, B, o) {
    let tint = tintOf(e);
    if (!tint && e.state === 'windup' && Math.floor(e.t * 14) % 2 === 0) tint = ['#ff4a4a', 0.3];
    if (S.shadow) NC.drawShadow(ctx, e.x, e.y, S.shadow[0], S.shadow[1], 0.22);
    const bob = e.moving ? -Math.abs(Math.sin(e.anim * 9)) * 4 : Math.sin(e.anim * 2.5) * 2;
    NC.drawSpr(ctx, pose(e.type, B), e.x + ((o && o.dx) || 0), e.y + bob - (e.z || 0), Object.assign({ flip: e.face > 0, tint }, o || {}));
  }
  function shots(ctx, e, S) {
    if (!e.shots) return;
    const sh = S.shot || {}, rgb = sh.rgb || '255,220,150', R = sh.size || 14;
    for (const s of e.shots) {
      const g = ctx.createRadialGradient(s.x, s.y - s.z, 0, s.x, s.y - s.z, R * 2.2);
      g.addColorStop(0, `rgba(255,255,255,0.95)`); g.addColorStop(0.35, `rgba(${rgb},0.9)`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y - s.z, R * 2.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${rgb},0.35)`; ctx.lineWidth = R; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x, s.y - s.z); ctx.lineTo(s.x - s.vx * 0.05, s.y - s.z - s.vy * 0.05); ctx.stroke();
    }
  }
  function aim(ctx, e) { // a thin red line where the shot will go
    ctx.save();
    ctx.strokeStyle = `rgba(255,80,80,${0.25 + 0.35 * Math.min(1, e.t / 0.5)})`; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.moveTo(e.x, e.y - 10); ctx.lineTo(e.x + Math.cos(e.atkAng) * 380, e.y - 10 + Math.sin(e.atkAng) * 380); ctx.stroke();
    ctx.restore();
  }
  const groundRing = (ctx, x, y, R, u, rgb) => {
    ctx.save();
    ctx.fillStyle = `rgba(${rgb},${0.12 + 0.18 * u})`; ctx.strokeStyle = `rgba(${rgb},0.8)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, R * u, R * 0.55 * u, 0, 0, TAU); ctx.fillStyle = `rgba(${rgb},0.22)`; ctx.fill();
    ctx.restore();
  };
  const far = (ctx, game, e, S) => { // ranged / summoner / healer
    if (e.state === 'windup' && e.act === 'shoot') aim(ctx, e);
    if (e.beam && e.beam.m && !e.beam.m.dead) {
      const m = e.beam.m;
      ctx.save(); ctx.strokeStyle = `rgba(150,255,150,${e.beam.t})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(e.x, e.y - 60); ctx.lineTo(m.x, m.y - 50); ctx.stroke(); ctx.restore();
    }
    const B = e.state === 'windup' || e.state === 'act';
    if (B && e.act !== 'shoot' && NC.VFX) NC.VFX.glow(ctx, e.x, e.y - 60, 110, e.act === 'heal' ? '150,255,150' : (S.fx || '200,170,255'), 0.35, true);
    body(ctx, game, e, S, B);
    shots(ctx, e, S);
    return true;
  };
  NC.MON_DRAW = Object.assign(NC.MON_DRAW || {}, {
    ranged: far, summoner: far, healer: far,
    bomber(ctx, game, e, S) {
      if (e.state !== 'fuse') { body(ctx, game, e, S, false); return true; }
      const u = Math.min(1, e.t / (S.fuse || 1.1));
      groundRing(ctx, e.x, e.y, S.blast || 150, u, '255,80,60');
      const s = 1 + 0.35 * u, fl = Math.floor(e.t * (8 + u * 16)) % 2 === 0;
      body(ctx, game, e, S, true, { sx: s, sy: s, dx: Math.sin(e.t * 70) * 2 * u, tint: fl ? ['#ffffff', 0.55] : ['#ff5040', 0.3] });
      return true;
    },
    burrow(ctx, game, e, S) {
      if (e.state === 'dig') { body(ctx, game, e, S, false, { sy: Math.max(0.1, 1 - e.t / 0.4) }); return true; }
      if (e.state === 'under' || e.state === 'rise') { // only a mound of earth shows
        const R = 36 + Math.sin(game.time * 20) * 2;
        ctx.save();
        ctx.fillStyle = 'rgba(90,70,50,0.9)'; ctx.strokeStyle = 'rgba(42,36,53,0.9)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(e.x, e.y - 6, R, R * 0.45, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        if (e.state === 'rise') groundRing(ctx, e.popX, e.popY, 100, Math.min(1, e.t / 0.6), '230,190,120');
        return true;
      }
      body(ctx, game, e, S, e.state === 'popped' || e.state === 'windup' || e.state === 'strike');
      return true;
    },
  });
  // the leaders' pack: a gold ring at the feet of those it spurs on
  const baseDraw = NC.drawEnemy;
  NC.drawEnemy = function (ctx, game, e) {
    if (e.rush && !e.dead) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,215,110,0.75)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, e.r * 1.5, e.r * 0.5, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    const S = mine(e);
    if (S && S.kind === 'leader' && !e.dead && NC.VFX) NC.VFX.glow(ctx, e.x, e.y - 30, 120, '255,215,110', 0.18, true);
    return baseDraw.apply(this, arguments);
  };
})();
