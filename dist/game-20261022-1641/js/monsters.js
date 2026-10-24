/* monsters.js — the monsters of Night Camp's maps (they replace the old slime and hollow): six coloured slimes and ten
   other species that move and fight in four ways:
     hop     slimes: rest, hop (towards the hero once it has seen them), a hit when they land (entities.js's slime moves)
     melee   walks up, winds up (the attack pose, a red flicker), lunges and strikes: skeleton, scarecrow; the stump and
             the golem slam the ground instead (everything in the circle in front of them is hit)
     charge  stops at a distance, paws the ground, then dashes straight through where the hero was: boar, wolf (it
             leaps), scorpion
     fly     hovers above the ground, circles the hero, rises for a moment, then swoops down to bite: bat, bee, moth
   The maps keep their 'slime' and 'hollow' spawn slots (the weaker and the stronger kind of an area; their levels are
   in stats.js / maps.js); ROSTER says which species fill them on each map and zone, in fixed shares (the same map
   always gets the same mix, and a respawn brings the same monster back to its spot).
   It plugs into entities.js from the outside, like boss.js: NC.MONSTERS entries, and NC.makeEnemy / spawnLevel /
   updateEnemy / drawEnemy / damageEnemy / labelTop / Maps.monsters are wrapped, so only these species take the new
   code paths. Load it after boss.js and before party.js (party.js wraps updateEnemy around this to aim monsters at
   allies). Art: assets/monsters/ (+ assets/monsters.manifest.js): pose A = <species>, pose B = <species>_b, made with
   assets/gen/make_monster_prompts.py -> Codex -> tools/monster_cut.py. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);

  // ---------------- the species ----------------
  // stats as in stats.js NC.MONSTERS (x the base curve of their level). color: the puff when it dies; light: [radius,
  // rgb] it glows with at night; shadow: [rx, ry] for a big body; per kind: reach / windup / lunge / slam (melee),
  // dash: [from how far, speed, seconds] + leap (charge), hover / swoop / flap (fly)
  const SLIME = { kind: 'hop', r: 26, hpK: 0.65, atkK: 0.75, defK: 0.4, mdefK: 1.2, agiK: 0.3, dexK: 0.5, expK: 0.8, spd: 0, aggro: 480 };
  const MON = { r: 24, hpK: 1, atkK: 1, defK: 1, mdefK: 0.5, agiK: 0.6, dexK: 0.7, expK: 1.2, spd: 150, aggro: 560 };
  const sp = (base, o) => Object.assign({}, base, o);
  const SPECIES = {
    slime_green: sp(SLIME, { name: 'สไลม์ใบไม้', element: 'wind', atkElement: 'wind', color: '120,205,90' }),
    slime_blue: sp(SLIME, { name: 'สไลม์น้ำใส', element: 'water', atkElement: 'water', color: '90,165,255' }),
    slime_stone: sp(SLIME, { name: 'สไลม์หินตะไคร่', element: 'earth', atkElement: 'earth', defK: 0.9, mdefK: 0.8, color: '160,170,175' }),
    slime_honey: sp(SLIME, { name: 'สไลม์น้ำผึ้ง', element: 'neutral', atkElement: 'neutral', hpK: 0.75, color: '255,190,70' }),
    slime_glow: sp(SLIME, { name: 'สไลม์เรืองแสง', element: 'poison', atkElement: 'poison', color: '90,235,225', light: [190, '90,235,225'] }),
    slime_lava: sp(SLIME, { name: 'สไลม์ลาวา', element: 'fire', atkElement: 'fire', atkK: 0.85, color: '255,120,50', light: [210, '255,140,60'], embers: true }),

    bat: sp(MON, { name: 'ค้างคาวรัตติกาล', kind: 'fly', element: 'shadow', atkElement: 'shadow', r: 22, hpK: 0.7, atkK: 0.8, defK: 0.5, mdefK: 0.6,
      agiK: 1.2, dexK: 0.8, expK: 1, spd: 170, aggro: 520, color: '120,100,170', hover: 46, swoop: 560, flap: 16 }),
    bee: sp(MON, { name: 'ผึ้งยักษ์', kind: 'fly', element: 'wind', atkElement: 'wind', r: 22, hpK: 0.75, atkK: 0.9, defK: 0.6, mdefK: 0.6,
      agiK: 1.1, dexK: 0.9, expK: 1.1, spd: 160, aggro: 560, color: '255,205,70', hover: 42, swoop: 600, flap: 22 }),
    moth: sp(MON, { name: 'ผีเสื้อราตรีเรืองแสง', kind: 'fly', element: 'wind', atkElement: 'poison', r: 24, hpK: 0.8, atkK: 0.85, defK: 0.5,
      mdefK: 0.9, agiK: 1, dexK: 0.8, expK: 1.1, spd: 130, aggro: 520, color: '130,235,230', hover: 52, swoop: 440, flap: 9, light: [170, '110,230,230'] }),

    boar: sp(MON, { name: 'หมูป่าเขี้ยวตัน', kind: 'charge', element: 'earth', atkElement: 'neutral', r: 30, hpK: 1.2, atkK: 1.1, defK: 1.2,
      mdefK: 0.4, agiK: 0.4, dexK: 0.6, expK: 1.2, spd: 105, aggro: 520, color: '150,105,70', dash: [330, 640, 0.5], dust: '150,120,90', shadow: [50, 14] }),
    wolf: sp(MON, { name: 'หมาป่าเงาจันทร์', kind: 'charge', element: 'earth', atkElement: 'neutral', r: 28, hpK: 1, atkK: 1.15, defK: 0.9,
      mdefK: 0.5, agiK: 0.9, dexK: 0.9, expK: 1.3, spd: 175, aggro: 620, color: '120,130,160', dash: [300, 760, 0.38], leap: 34, dust: '120,120,140', shadow: [62, 15] }),
    scorpion: sp(MON, { name: 'แมงป่องแดง', kind: 'charge', element: 'fire', atkElement: 'fire', r: 30, hpK: 1.1, atkK: 1.2, defK: 1.3,
      mdefK: 0.6, agiK: 0.7, dexK: 0.9, expK: 1.3, spd: 140, aggro: 560, color: '230,110,60', dash: [260, 580, 0.42], dust: '190,110,70', shadow: [56, 15] }),

    skeleton: sp(MON, { name: 'โครงกระดูกทหาร', kind: 'melee', element: 'undead', atkElement: 'neutral', hpK: 1, atkK: 1.1, defK: 1.1, mdefK: 0.4,
      agiK: 0.5, dexK: 0.8, expK: 1.2, spd: 125, aggro: 560, color: '215,210,190', reach: 92, windup: 0.45, lunge: 360, slash: '210,230,255' }),
    scarecrow: sp(MON, { name: 'หุ่นไล่กาผีสิง', kind: 'melee', element: 'earth', atkElement: 'neutral', r: 26, hpK: 1.1, atkK: 1, defK: 0.9,
      mdefK: 0.6, agiK: 0.4, dexK: 0.7, expK: 1.2, spd: 105, aggro: 540, color: '215,180,110', reach: 120, windup: 0.55, lunge: 300, recover: 0.7, slash: '255,225,160' }),
    stump: sp(MON, { name: 'ตอไม้ผี', kind: 'melee', element: 'earth', atkElement: 'earth', r: 32, hpK: 1.4, atkK: 1.1, defK: 1.4, mdefK: 0.5,
      agiK: 0.2, dexK: 0.6, expK: 1.3, spd: 80, aggro: 480, color: '150,110,70', reach: 100, windup: 0.65, lunge: 110, slam: 118, recover: 0.8,
      dust: '120,95,70', shadow: [56, 16] }),
    golem: sp(MON, { name: 'โกเลมหินแดง', kind: 'melee', element: 'neutral', atkElement: 'earth', r: 40, hpK: 1.8, atkK: 1.3, defK: 1.6, mdefK: 0.6,
      agiK: 0.1, dexK: 0.7, expK: 1.6, spd: 68, aggro: 500, color: '210,120,80', reach: 125, windup: 0.85, lunge: 50, slam: 150, recover: 1,
      heavy: true, dust: '170,110,80', shadow: [80, 22], light: [150, '255,150,70'] }),
  };
  Object.assign(NC.MONSTERS, SPECIES);
  NC.SPECIES = SPECIES;

  // ---------------- who lives where ----------------
  // the maps' spawn slots ('slime': the weaker kind of the area, 'hollow': the stronger one) -> [species, weight], by
  // map and zone ('*': the rest of the map; DEFAULT: a map not listed here)
  const ROSTER = {
    camp: {
      'ค่ายกลางป่า': { slime: [['slime_green', 1]], hollow: [['bat', 1], ['boar', 1]] },
      'ซากป้อมหินเก่า': { slime: [['slime_stone', 1]], hollow: [['skeleton', 2], ['wolf', 1]] },
      'ป่าตะวันออก': { slime: [['slime_honey', 1]], hollow: [['wolf', 1]] },
    },
    // (the new camp, js/camp.js, has no ruins or eastern forest any more: their species live in the fields now)
    meadow: { '*': { slime: [['slime_blue', 2], ['slime_honey', 1], ['bee', 1]], hollow: [['scarecrow', 1], ['bee', 1]] } },
    woods: { '*': { slime: [['slime_glow', 2], ['slime_stone', 1]], hollow: [['moth', 1], ['stump', 1], ['wolf', 1]] } },
    canyon: { '*': { slime: [['slime_lava', 1]], hollow: [['scorpion', 1], ['golem', 1], ['skeleton', 1]] } },
  };
  const DEFAULT = { slime: [['slime_green', 1]], hollow: [['bat', 1], ['boar', 1]] };
  NC.ROSTER = ROSTER;

  const mapOf = (world) => world.field || 'camp';
  const slotAt = new Map(); // 'map:x,y' -> the slot that spot had ('slime' | 'hollow'): its level range, for respawns
  const spotKey = (world, x, y) => mapOf(world) + ':' + Math.round(x) + ',' + Math.round(y);
  // the species of an area are dealt out in their shares as the map places its monsters (the one furthest behind
  // its share next), so the mix is always the same on the same map: counts reset when a map is (re)loaded
  let dealt = new Map();

  function speciesFor(world, slot, x, y) {
    const R = ROSTER[mapOf(world)] || {};
    const z = world.zones ? world.zones.find((zn) => zn.test(x, y)) : null;
    const list = ((z && R[z.name]) || R['*'] || DEFAULT)[slot] || DEFAULT[slot];
    slotAt.set(spotKey(world, x, y), slot);
    const key = mapOf(world) + '|' + (z ? z.name : '') + '|' + slot;
    const d = dealt.get(key) || { n: 0, got: {} };
    dealt.set(key, d);
    const sum = list.reduce((s, it) => s + it[1], 0);
    let best = list[0][0], most = -Infinity;
    for (const [id, w] of list) {
      const behind = (w / sum) * (d.n + 1) - (d.got[id] || 0);
      if (behind > most + 1e-9) { most = behind; best = id; }
    }
    d.n++; d.got[best] = (d.got[best] || 0) + 1;
    return best;
  }

  const baseMake = NC.makeEnemy;
  NC.makeEnemy = function (type, x, y, lv) {
    const world = NC.game && NC.game.world;
    if ((type === 'slime' || type === 'hollow') && world) type = speciesFor(world, type, x, y);
    const e = baseMake(type, x, y, lv);
    const S = SPECIES[type];
    if (S && S.kind !== 'hop') { e.state = 'idle'; e.t = NC.rand(0, 1.5); e.roamFor = NC.rand(1.2, 2.6); e.z = S.hover || 0; e.zt = e.z; }
    return e;
  };
  // a respawn asks for the level of the species itself: the spot's slot gives it
  const baseLevel = NC.spawnLevel;
  NC.spawnLevel = function (world, type, x, y) {
    if (SPECIES[type] && world) type = slotAt.get(spotKey(world, x, y)) || (SPECIES[type].kind === 'hop' ? 'slime' : 'hollow');
    return baseLevel(world, type, x, y);
  };

  // ---------------- moving and fighting ----------------
  const walk = (game, e, a, v, dt) => {
    NC.tryMove(game.world, e, Math.cos(a) * v * dt, Math.sin(a) * v * dt);
    if (Math.abs(Math.cos(a)) > 0.2) e.face = Math.cos(a) > 0 ? 1 : -1;
  };
  // 'idle': strolls around the spot it lives at
  function wander(game, e, dt, v) {
    if (e.t > (e.roamFor || 2)) { e.t = 0; e.roamFor = NC.rand(1.4, 3); e.wx = e.sx + NC.rand(-150, 150); e.wy = e.sy + NC.rand(-90, 90); }
    const d = e.wx === undefined ? 0 : NC.dist(e.x, e.y, e.wx, e.wy);
    e.moving = d > 14;
    if (e.moving) walk(game, e, NC.angle(e.x, e.y, e.wx, e.wy), v, dt);
  }
  // 'return': walks back home (healed on arrival), turning round if the hero comes close again
  function goHome(game, e, S, dt, c) {
    if (c.home < 30) { e.state = 'idle'; e.t = 0; e.hp = e.maxHp; return; }
    walk(game, e, NC.angle(e.x, e.y, e.sx, e.sy), 170, dt); e.moving = true;
    if (c.alive && c.dp < S.aggro * 0.6 && c.home < 700) { e.state = 'chase'; e.t = 0; }
  }
  const lostTrack = (e, c) => !c.alive || c.home > 1150;

  function strike(game, e, S) {
    const p = game.player;
    if (S.slam) { // a ground slam in front of it: whoever stands in the circle is hit
      const cx = e.x + e.face * S.slam * 0.45, cy = e.y + 6;
      FX.ring(cx, cy, 20, S.slam * 1.15, '255,232,196', 0.45, 10);
      FX.puff(cx, cy, 9, { speed: 180, color: S.dust || '150,120,90' });
      game.shake = Math.max(game.shake, S.heavy ? 12 : 7);
      if (p.dead <= 0 && ((p.x - cx) / S.slam) ** 2 + ((p.y - cy) / (S.slam * 0.62)) ** 2 < 1) NC.monsterAttack(game, e);
      return;
    }
    FX.slash(e.x + e.face * 30, e.y - 60, e.atkAng, 95, S.slash || '255,120,120', e.face);
    if (p.dead <= 0 && NC.dist(e.x, e.y, p.x, p.y) < S.reach + 28 && angDiff(NC.angle(e.x, e.y, p.x, p.y), e.atkAng) < 1.3) NC.monsterAttack(game, e);
  }

  const AI = {
    melee(game, e, S, dt, k, c) {
      switch (e.state) {
        case 'idle':
          wander(game, e, dt, 55 * k);
          if (c.alive && c.dp < S.aggro) { e.state = 'chase'; e.t = 0; }
          break;
        case 'chase':
          if (lostTrack(e, c)) { e.state = 'return'; break; }
          e.moving = true; e.face = Math.cos(c.toP) > 0 ? 1 : -1;
          if (c.dp < S.reach) { e.state = 'windup'; e.t = 0; e.atkAng = c.toP; e.moving = false; break; }
          walk(game, e, c.toP, S.spd * k, dt);
          break;
        case 'windup':
          e.moving = false;
          if (e.t > S.windup / k) { e.state = 'strike'; e.t = 0; e.hitDone = false; }
          break;
        case 'strike':
          if (S.lunge) NC.tryMove(game.world, e, Math.cos(e.atkAng) * S.lunge * dt, Math.sin(e.atkAng) * S.lunge * dt);
          if (!e.hitDone && e.t > 0.05) { e.hitDone = true; strike(game, e, S); }
          if (e.t > 0.16) { e.state = 'recover'; e.t = 0; }
          break;
        case 'recover':
          if (e.t > (S.recover || 0.65)) { e.state = 'chase'; e.t = 0; }
          break;
        case 'return': goHome(game, e, S, dt, c); break;
        default: e.state = 'idle'; e.t = 0;
      }
    },

    charge(game, e, S, dt, k, c) {
      const p = game.player, [from, speed, time] = S.dash;
      switch (e.state) {
        case 'idle':
          wander(game, e, dt, 50 * k);
          if (c.alive && c.dp < S.aggro) { e.state = 'chase'; e.t = 0; }
          break;
        case 'chase':
          if (lostTrack(e, c)) { e.state = 'return'; break; }
          e.moving = true; e.face = Math.cos(c.toP) > 0 ? 1 : -1;
          if (c.dp < from && e.t > 0.35) { e.state = 'windup'; e.t = 0; e.atkAng = c.toP; e.moving = false; break; }
          walk(game, e, c.toP, S.spd * k, dt);
          break;
        case 'windup': // paws the ground, keeps its eyes on the hero, then goes for where the hero was
          e.moving = false;
          if (e.t < 0.35) { e.atkAng = c.toP; e.face = Math.cos(c.toP) > 0 ? 1 : -1; }
          if (Math.random() < dt * 10) FX.puff(e.x - e.face * 24, e.y, 1, { speed: 40, size: 0.5, color: S.dust });
          if (e.t > 0.6 / k) { e.state = 'dash'; e.t = 0; e.hitDone = false; FX.puff(e.x, e.y, 4, { speed: 90, size: 0.7, color: S.dust }); }
          break;
        case 'dash': {
          const v = speed * k, bx = e.x, by = e.y;
          NC.tryMove(game.world, e, Math.cos(e.atkAng) * v * dt, Math.sin(e.atkAng) * v * dt);
          e.face = Math.cos(e.atkAng) > 0 ? 1 : -1; e.moving = true;
          if (S.leap) e.z = Math.sin(Math.PI * Math.min(1, e.t / time)) * S.leap;
          if (Math.random() < dt * 24) FX.puff(e.x - Math.cos(e.atkAng) * 26, e.y, 1, { speed: 40, size: 0.6, color: S.dust });
          if (!e.hitDone && p.dead <= 0 && NC.dist(e.x, e.y, p.x, p.y) < e.r + 44) { e.hitDone = true; NC.monsterAttack(game, e); }
          if (e.t > time || (e.t > 0.08 && NC.dist(bx, by, e.x, e.y) < v * dt * 0.3)) { e.state = 'recover'; e.t = 0; e.z = 0; } // (a wall stops it)
          break;
        }
        case 'recover':
          e.moving = false; e.z = 0;
          if (e.t > 0.85) { e.state = 'chase'; e.t = 0; }
          break;
        case 'return': goHome(game, e, S, dt, c); break;
        default: e.state = 'idle'; e.t = 0;
      }
    },

    fly(game, e, S, dt, k, c) {
      const p = game.player;
      switch (e.state) {
        case 'idle':
          e.zt = S.hover;
          wander(game, e, dt, 60 * k);
          if (c.alive && c.dp < S.aggro) { e.state = 'chase'; e.t = 0; e.cool = NC.rand(0.4, 1); }
          break;
        case 'chase': { // circles the hero at a little distance, weaving
          if (lostTrack(e, c)) { e.state = 'return'; break; }
          e.zt = S.hover; e.moving = true;
          const orbit = c.toP + Math.PI + Math.sin(e.anim * 1.3 + e.sx) * 0.9;
          const tx = p.x + Math.cos(orbit) * 150, ty = p.y + Math.sin(orbit) * 90, d = NC.dist(e.x, e.y, tx, ty);
          if (d > 10) walk(game, e, NC.angle(e.x, e.y, tx, ty), Math.min(S.spd * k, d * 4), dt);
          e.face = p.x > e.x ? 1 : -1;
          if (c.dp < 250 && e.t > (e.cool || 1)) { e.state = 'windup'; e.t = 0; }
          break;
        }
        case 'windup': // rises a little and hangs there: the swoop is coming
          e.zt = S.hover + 28; e.moving = false; e.face = p.x > e.x ? 1 : -1;
          if (e.t > 0.42 / k) { e.state = 'swoop'; e.t = 0; e.atkAng = c.toP; e.hitDone = false; }
          break;
        case 'swoop': {
          const v = S.swoop * k;
          NC.tryMove(game.world, e, Math.cos(e.atkAng) * v * dt, Math.sin(e.atkAng) * v * dt);
          e.zt = 8; e.moving = true;
          if (!e.hitDone && p.dead <= 0 && NC.dist(e.x, e.y, p.x, p.y) < e.r + 40) { e.hitDone = true; NC.monsterAttack(game, e); }
          if (e.t > 0.42) { e.state = 'recover'; e.t = 0; e.cool = NC.rand(1, 1.8); }
          break;
        }
        case 'recover': // climbs back up and away
          e.zt = S.hover; e.moving = true;
          walk(game, e, e.atkAng, 110 * k, dt);
          if (e.t > 0.6) { e.state = 'chase'; e.t = 0; }
          break;
        case 'return': e.zt = S.hover; goHome(game, e, S, dt, c); break;
        default: e.state = 'idle'; e.t = 0;
      }
      // its height eases towards where it wants to be, with a gentle bob
      e.z += (e.zt + Math.sin(e.anim * 4) * 5 - e.z) * Math.min(1, dt * (e.state === 'swoop' ? 14 : 6));
    },
  };

  // a glowing monster lights up the night around it (a light of the map that follows it)
  function glowAt(game, e, S) {
    const L = game.world.lights;
    if (!L) return;
    if (!e.light || !L.includes(e.light)) { e.light = { x: e.x, y: e.y, r: S.light[0], rgb: S.light[1], flick: Math.random() * 10, owner: e, mon: true }; L.push(e.light); }
    e.light.x = e.x; e.light.y = e.y - 40 - (e.z || 0);
  }

  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    const S = SPECIES[e.type];
    if (!S) return baseUpdate(game, e, dt);
    if (S.kind === 'hop') { // a slime: entities.js's own hops
      baseUpdate(game, e, dt);
      if (e.dead) return;
      if (S.light) glowAt(game, e, S);
      if (S.embers && Math.random() < dt * 4)
        FX.add({ type: 'ember', x: e.x + NC.rand(-22, 22), y: e.y - 34 - e.z, vx: NC.rand(-15, 15), vy: NC.rand(-90, -50), life: NC.rand(0.5, 0.9) });
      return;
    }
    // the base update does the timers, poison, freeze / stun and knockback; its slime moves must not take these over
    const st = e.state;
    e.state = 'held';
    baseUpdate(game, e, dt);
    if (e.state === 'held') e.state = st;
    if (e.dead) return;
    if (S.light) glowAt(game, e, S);
    if (e.frozen > 0 || e.stun > 0) { if (S.kind === 'fly') e.z += (S.hover * 0.5 - e.z) * Math.min(1, dt * 3); return; }
    const p = game.player;
    const c = { alive: p.dead <= 0, dp: NC.dist(e.x, e.y, p.x, p.y), toP: NC.angle(e.x, e.y, p.x, p.y), home: NC.dist(e.x, e.y, e.sx, e.sy) };
    (AI[S.kind] || AI[S.base] || AI.melee)(game, e, S, dt, (e.slow > 0 ? 0.45 : 1) * (e.rush || 1), c); // (monkinds.js adds kinds; S.base: a leader's own way)
    e.sort = e.y;
  };

  NC.MON_KIT = { AI, walk, wander, goHome, lostTrack, strike, angDiff }; // (monkinds.js builds its kinds from these)

  // ---------------- drawing ----------------
  const tintOf = (e) => (e.flash > 0 ? ['#ffffff', 0.85] : e.frozen > 0 ? ['#bfeaff', 0.55] : e.slow > 0 ? ['#8fd8ff', 0.45] : e.poison ? ['#7fe05a', 0.35] : null);
  const pose = (type, b) => (b && NC.SPR[type + '_b'] ? type + '_b' : type);

  function drawBody(ctx, game, e, S) {
    if (NC.MON_DRAW && NC.MON_DRAW[S.kind] && NC.MON_DRAW[S.kind](ctx, game, e, S)) return; // (monkinds.js)
    S = S.base ? Object.assign({}, S, { kind: S.base }) : S;
    let tint = tintOf(e);
    const flip = e.face > 0, z = e.z || 0;
    if (S.shadow && (NC.Gfx?.profile || NC.Graphics?.profile)?.shadows !== 'none') NC.drawShadow(ctx, e.x, e.y, S.shadow[0], S.shadow[1], 0.22);
    if (S.kind === 'hop') { // squash and stretch, as entities.js does for its slime
      const idle = Math.sin(e.anim * 5) * 0.05, air = e.state === 'hop' ? 0.14 : 0;
      const sx = 1 + idle + (e.squash || 0) * 0.22 - air * 0.6, sy = 1 - idle - (e.squash || 0) * 0.2 + air;
      NC.drawSpr(ctx, e.type, e.x, e.y - z, { flip, sx, sy, tint });
      return;
    }
    // the wind-up flickers red: the hit is coming
    if (!tint && e.state === 'windup' && Math.floor(e.t * 14) % 2 === 0) tint = ['#ff4a4a', 0.32];
    if (S.kind === 'fly') {
      const B = e.state === 'swoop' || (e.state === 'windup' && e.t > 0.3);
      const beat = Math.sin(e.anim * S.flap);
      const sx = B ? 1 : 1 - beat * 0.035, sy = B ? 1 : 1 + beat * 0.08;
      const rot = e.state === 'swoop' ? 0.38 * e.face : e.state === 'windup' ? -0.14 * e.face : Math.sin(e.anim * 2) * 0.05;
      NC.drawSpr(ctx, pose(e.type, B), e.x, e.y - z, { flip, sx, sy, rot, tint });
      return;
    }
    if (S.kind === 'charge') {
      const B = e.state === 'dash' || (e.state === 'windup' && e.t > 0.35 && !S.leap); // (the wolf's B is its leap)
      let dx = 0, rot = 0, bob = 0;
      if (e.state === 'windup') dx = Math.sin(e.t * 60) * 2.5; // pawing: a shiver
      else if (e.state === 'dash') { rot = 0.06 * e.face; bob = -Math.abs(Math.sin(e.anim * 14)) * 4; }
      else if (e.moving) bob = -Math.abs(Math.sin(e.anim * 10)) * 4;
      else bob = Math.sin(e.anim * 2.5) * 1.5;
      NC.drawSpr(ctx, pose(e.type, B), e.x + dx, e.y - z + bob, { flip, rot, tint });
      return;
    }
    // melee: the attack pose for the wind-up and the strike, a lean into it
    const B = e.state === 'windup' || e.state === 'strike' || (e.state === 'recover' && e.t < 0.12);
    let dx = 0, rot = 0, sy = 1;
    if (e.state === 'windup') { rot = -0.1 * e.face * Math.min(1, e.t / 0.2); dx = -5 * e.face; }
    else if (e.state === 'strike') { rot = 0.16 * e.face; if (S.slam) sy = 0.95; }
    const bob = e.moving ? -Math.abs(Math.sin(e.anim * (S.heavy ? 6 : 9))) * (S.heavy ? 3 : 5) : Math.sin(e.anim * 2.5) * 2;
    NC.drawSpr(ctx, pose(e.type, B), e.x + dx, e.y + bob, { flip, rot, sy, tint });
  }

  // frozen in a block of ice / stars over the head (entities.js draws these for its own two)
  function overlays(ctx, game, e) {
    const V = NC.VFX;
    if (!V) return;
    const s = NC.SPR[e.type], z = e.z || 0;
    const w = s ? Math.min(160, s.w * 0.9) : 100, h = s ? s.h * 1.05 : 120;
    if (e.frozen > 0) {
      const a = Math.min(1, e.frozen / 0.25);
      ctx.save();
      ctx.globalAlpha *= 0.55 * a;
      V.spike(ctx, e.x, e.y + 6 - z, w, h, 0, ['#8fd8ff', '#d9f4ff', '#ffffff'], 1, 0.4);
      ctx.restore();
      V.glow(ctx, e.x, e.y - z - h * 0.4, w, V.RGB.ice, 0.35 * a, false);
    }
    if (e.stun > 0) {
      const top = NC.labelTop(e) + 34;
      for (let i = 0; i < 3; i++) { const a = game.time * 5 + (i / 3) * TAU; V.star(ctx, e.x + Math.cos(a) * 30, top + Math.sin(a) * 9, 9, a, '#ffe066', 1); }
    }
  }

  const baseDraw = NC.drawEnemy;
  NC.drawEnemy = function (ctx, game, e) {
    const S = SPECIES[e.type];
    if (!S || !NC.SPR[e.type]) return baseDraw(ctx, game, e);
    if (e.mini) { ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.mini, e.mini); ctx.translate(-e.x, -e.y); } // (a split-off piece)
    drawBody(ctx, game, e, S);
    if (e.mini) ctx.restore();
    overlays(ctx, game, e);
  };
  // the name tag and HP bar: over the art's own height (pose A), and over a flier's height
  const baseTop = NC.labelTop;
  NC.labelTop = (e) => {
    const s = SPECIES[e.type] && NC.SPR[e.type];
    return s ? e.y - s.h * (e.mini || 1) - 24 - (e.z || 0) : baseTop(e);
  };

  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const S = SPECIES[e.type], was = e.hp;
    if (S && S.heavy) { kx *= 0.3; ky *= 0.3; } // the golem hardly budges
    baseDamage(game, e, r, kx, ky, o);
    if (!S || !(was > 0 && e.hp <= 0)) return;
    FX.puff(e.x, e.y - 30 - (e.z || 0), 8, { speed: 150, color: S.color });
    if (e.light) {
      const L = game.world.lights, i = L ? L.indexOf(e.light) : -1;
      if (i >= 0) L.splice(i, 1);
      e.light = null;
    }
  };

  // a map (re)loaded: the lights of the monsters that were on it last time go (the new ones light up their own)
  const baseMonsters = NC.Maps.monsters;
  NC.Maps.monsters = function (world) {
    if (world.lights) for (let i = world.lights.length - 1; i >= 0; i--) if (world.lights[i].mon) world.lights.splice(i, 1);
    dealt = new Map();
    return baseMonsters(world);
  };
})();
