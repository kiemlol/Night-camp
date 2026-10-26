/* bots.js — other adventurers: five on every map, each with a name, a level for that map, a job (knight, mage,
   archer, rogue, healer or traveler) and a look: a fashion onesie with a fashion hat (often from another set), or job
   clothes with a fashion hat. Never a boss set. They wander, hunt the map's monsters (not the ones the hero or the
   party are fighting, and never a boss), use their job's skill, drink potions, chat in speech bubbles, cheer after
   a kill, faint and come back. In the camp most of them just hang around and chat.
   Built from party.js's pieces (NC.Party.lib): the same rig, attacks, skills and monster targeting as party members;
   their kills are their own (no EXP or drops for the hero). ?bots=0 turns them off, ?bots=8 puts 8 on each map. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  const rand = NC.rand, dist = NC.dist, angle = NC.angle, clamp = NC.clamp;
  const PER_MAP = NC.ONLINE ? 0 : 5; // (online: the server's heroes are the crowd)
  const L = () => NC.Party.lib;

  const NAMES = ['ข้าวเหนียวมะม่วง', 'MintChoco', 'น้องหมีเนย', 'xXDarkBladeXx', 'ส้มตำปูปลาร้า', 'PunPun', 'จอมเวทหลงทาง',
    'Kaimook', 'TaroMilkTea', 'ชาไทยหวานน้อย', 'NightOwl', 'มะพร้าวน้ำหอม', 'BunnyHop', 'เป็ดน้อยผจญภัย', 'GoldenSlime',
    'ปลาทูทอด', 'Moonlight', 'หมูกระทะ', 'SirWaffle', 'น้ำแข็งใส', 'ขนมครก', 'Pumpkin99', 'FrogPrince', 'นักธนูตาหวาน'];
  const MAP_ORDER = ['camp', 'meadow', 'woods', 'canyon', 'farm', 'marsh', 'graveyard', 'burnt', 'wind', 'swamp', 'volcano', 'lake', 'prime', // (fields2.js / fields3.js)
    'batcave', 'antmine1', 'antmine2', 'antmine3', 'crypt1', 'crypt2', 'lavavent1', 'lavavent2', // (dungeons.js)
    'road', 'salt', 'peak', 'nroad', 'outer', 'canal', 'isle', 'dark', 'cathedral', // (fields4.js)
    'owl1', 'owl2', 'owl3', 'ledger1', 'ledger2', 'puppet1', 'puppet2', 'bell1', 'bell2', 'bell3', 'bell4', 'bell5', 'bell6', 'bell7', 'grave1', 'grave2', // (dungeons2.js)
    'farm2', 'meadow2', 'marsh2', 'marsh3', 'graveyard2', 'woods2', 'wind2', 'swamp2', 'canyon2', 'canyon3', 'prime2', 'roots1', 'roots2']; // (fields5.js)
  const LV = { camp: [6, 22], meadow: [12, 24], woods: [30, 46], canyon: [62, 84], farm: [6, 16], marsh: [14, 26], graveyard: [20, 34],
    burnt: [34, 48], wind: [40, 54], swamp: [52, 66], volcano: [70, 88], lake: [74, 92], prime: [78, 96],
    batcave: [10, 18], antmine1: [17, 27], antmine2: [28, 40], antmine3: [40, 52], crypt1: [36, 46], crypt2: [46, 56], lavavent1: [76, 88], lavavent2: [86, 96],
    road: [34, 46], salt: [40, 52], peak: [50, 62], nroad: [64, 76], outer: [72, 86], canal: [78, 90], isle: [86, 96], dark: [88, 99],
    cathedral: [94, 99], owl1: [52, 58], owl2: [55, 60], owl3: [57, 62], ledger1: [80, 88], ledger2: [84, 92], puppet1: [90, 96],
    puppet2: [92, 99], bell1: [96, 99], bell2: [96, 99], bell3: [97, 99], bell4: [97, 99], bell5: [98, 99], bell6: [98, 99], bell7: [99, 99],
    grave1: [98, 99], grave2: [99, 99],
    farm2: [12, 22], meadow2: [16, 26], marsh2: [22, 32], marsh3: [28, 38], graveyard2: [30, 42], woods2: [38, 50], wind2: [46, 58],
    swamp2: [58, 70], canyon2: [64, 76], canyon3: [72, 84], prime2: [90, 99], roots1: [64, 72], roots2: [70, 78] };
  // (balance 2026-10-16: a map the two lists above don't name, e.g. the B1–B3 hunting sections and the pilot maps, takes its
  // level band from its own lvText "Lv a–b" and a slot after the listed maps, so its adventurers fit it and have other names)
  const slotOf = (mapId) => { const i = MAP_ORDER.indexOf(mapId); if (i >= 0) return i; let h = 7; for (const ch of String(mapId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return MAP_ORDER.length + (h % 997); };
  const lvOf = (mapId) => { if (LV[mapId]) return LV[mapId]; const m = /(\d+)\s*[–-]\s*(\d+)/.exec((NC.MAPS && NC.MAPS[mapId] && NC.MAPS[mapId].lvText) || ''); return m ? [Number(m[1]), Number(m[2])] : [10, 20]; };
  const FASHION = ['duck', 'mushroom', 'frog', 'panda', 'bunny', 'pumpkin'];
  const OUTFITS = ['traveler', 'knight', 'mage', 'ranger', 'rogue', 'priest'];
  const HAIRS = ['hair_spiky', 'hair_neat', 'hair_ponytail', 'hair_long', 'hair_buzz', 'hair_brown', 'hair_curly'];
  const JOBS = [
    { job: 'knight', role: 'tank', th: 'อัศวิน', outfit: 'knight', weapons: ['sword', 'greatsword', 'spear', 'axe', 'hammer'],
      stat: { str: 0.55, agi: 0.2, vit: 0.75, int: 0.05, dex: 0.3, luk: 0.1 }, hpK: 1.5, defAdd: 15, dmgK: 0.55, range: 0, cd: 10 },
    { job: 'mage', role: 'mage', th: 'จอมเวท', outfit: 'mage', weapons: ['staff'],
      stat: { str: 0.05, agi: 0.2, vit: 0.3, int: 0.9, dex: 0.5, luk: 0.1 }, hpK: 1, dmgK: 0.6, range: 380, cd: 6 },
    { job: 'archer', role: 'archer', th: 'นักธนู', outfit: 'ranger', weapons: ['bow'],
      stat: { str: 0.2, agi: 0.45, vit: 0.3, int: 0.05, dex: 0.9, luk: 0.2 }, hpK: 1.05, dmgK: 0.55, range: 420, cd: 5 },
    { job: 'rogue', role: 'rogue', th: 'โจร', outfit: 'rogue', weapons: ['dagger'],
      stat: { str: 0.6, agi: 0.8, vit: 0.3, int: 0.05, dex: 0.35, luk: 0.3 }, hpK: 1.15, dmgK: 0.55, range: 0, cd: 5 },
    { job: 'priest', role: 'healer', th: 'พระ', outfit: 'priest', weapons: ['staff_holy'],
      stat: { str: 0.05, agi: 0.25, vit: 0.45, int: 0.85, dex: 0.35, luk: 0.15 }, hpK: 1.1, dmgK: 0.35, range: 340, cd: 3.5 },
    { job: 'traveler', role: 'fighter', th: 'นักเดินทาง', outfit: 'traveler', weapons: ['sword', 'axe', 'spear'],
      stat: { str: 0.5, agi: 0.4, vit: 0.45, int: 0.1, dex: 0.35, luk: 0.2 }, hpK: 1.2, dmgK: 0.55, range: 0, cd: 99 },
  ];
  const SAY = {
    town: ['ตี้ไหมครับ เวล 20 ขึ้น', 'ขายยาแดง 10 ขวดค่ะ', 'ใครไปบอสเห็ดบ้าง~', 'ชุดนี้น่ารักมะ >.<', 'afk แป๊บนะ',
      'ใครเห็นคทาหายากบ้าง', 'ไปผาหินแดงกันเถอะ', 'รอเพื่อนแป๊บ', 'หวัดดีทุกคน~', 'เงียบจังวันนี้'],
    field: ['มอนเยอะดีแมพนี้', 'เวลขึ้นช้าจัง T_T', 'มีใครอยู่แถวนี้ไหม', 'ตีด้วยกันไหม', 'ดรอปไม่ออกเลย', 'สู้ๆ ทุกคน!',
      'ใกล้เวลอัพแล้ว!', 'ฮึบ!', 'แมพนี้สวยจัง', 'ใครรู้ทางไปบอสบ้าง'],
    kill: ['เย้!', 'gg', '^^', 'อีกตัว!', 'ง่ายมาก~', 'ได้ของไหมนะ'],
    potion: ['กินยาก่อน!', 'เกือบไปแล้ว', 'ฮีลด่วน!'],
    faint: ['อ๊ากก', 'ไปก่อนนะ...', 'T_T'],
    back: ['กลับมาแล้ว~', 'ลุยต่อ!'],
    help: ['ฮีลให้นะ~', 'สู้ๆ นะ!', 'ระวังด้วย!'],
  };
  const pickR = (R, a) => a[Math.floor(R() * a.length)];
  const isBoss = (e) => !!((NC.BOSSES && NC.BOSSES[e.type]) || e.owner);

  // ---------------- who they are ----------------
  // a look: a fashion onesie with a fashion hat (usually another set's: mixed), or job clothes with a fashion hat
  function outfit(R, J) {
    const fashion = FASHION.filter((id) => NC.ITEMS['robe_' + id] && NC.ITEMS['hat_' + id]);
    const eq = { hair: pickR(R, HAIRS), robe: null, cape: null, top: 'top_' + J.outfit, pants: 'pants_' + J.outfit, shoes: 'shoes_' + J.outfit,
      hat: fashion.length ? 'hat_' + pickR(R, fashion) : null, weapon: pickR(R, J.weapons) };
    if (fashion.length && R() < 0.5) {
      const suit = pickR(R, fashion);
      eq.robe = 'robe_' + suit;
      eq.hat = 'hat_' + (R() < 0.3 || fashion.length < 2 ? suit : pickR(R, fashion.filter((f) => f !== suit)));
    } else if (R() < 0.3) { // job clothes mixed from two jobs
      eq.pants = 'pants_' + pickR(R, OUTFITS); eq.shoes = 'shoes_' + pickR(R, OUTFITS);
    }
    // some wear glasses (js/glasses.js)
    const specs = Object.keys(NC.ITEMS).filter((id) => NC.ITEMS[id].slot === 'glasses' && NC.itemReady(id));
    eq.glasses = specs.length && R() < 0.3 ? pickR(R, specs) : null;
    return eq;
  }
  const arenas = (mapId) => (NC.MAPS[mapId] && NC.MAPS[mapId].clear) || [];
  const inArena = (mapId, x, y, pad) => arenas(mapId).some((c) => ((x - c.x) / (c.r + pad)) ** 2 + ((y - c.y) / ((c.r + pad) * 0.62)) ** 2 < 1);
  // a free spot: around the camp's fire for the camp, anywhere open in a field (not in a boss clearing)
  function spot(world, mapId, R, near, r) {
    for (let k = 0; k < 60; k++) {
      const x = near ? near[0] + (R() - 0.5) * 2 * r : 120 + R() * (world.W - 240), y = near ? near[1] + (R() - 0.5) * 2 * r * 0.7 : 160 + R() * (world.H - 320);
      if (x < 80 || y < 100 || x > world.W - 80 || y > world.H - 80 || !world.fits(x, y, 30) || inArena(mapId, x, y, 350)) continue;
      return [Math.round(x), Math.round(y)];
    }
    return null;
  }
  function create(game, world, mapId) {
    const R = NC.rng(9173 + slotOf(mapId) * 131), out = [];
    const order = NAMES.slice().sort((a, b) => NC.hash(a.length, a.charCodeAt(0), 5) - NC.hash(b.length, b.charCodeAt(0), 5));
    const base = Math.max(0, slotOf(mapId)) * PER_MAP, [lv0, lv1] = lvOf(mapId);
    const town = mapId === 'camp', centre = [world.spawn.x, world.spawn.y];
    for (let tries = 0; out.length < PER_MAP && tries < 200; tries++) {
      const at = town ? spot(world, mapId, R, centre, 650) : spot(world, mapId, R, null, 0);
      if (!at) continue;
      if (!town && tries < 150 && out.some((o) => dist(o.x, o.y, at[0], at[1]) < 500)) continue; // spread over the map
      const i = out.length, J = pickR(R, JOBS);
      const def = { id: `bot_${mapId}_${i}`, name: order[(base + i) % order.length], job: J.job, role: J.role, th: J.th, color: '#ffffff',
        equip: outfit(R, J), stat: J.stat, hpK: J.hpK, defAdd: J.defAdd || 0, dmgK: J.dmgK * 0.6, range: J.range, skill: { name: '', cd: J.cd } };
      const a = L().make(def, at[0], at[1]);
      Object.assign(a, { bot: true, mapId, home: at, hunts: !town || i < 2, roam: town ? 620 : 1300, wp: null, wait: R() * 3, scan: 0,
        potCd: 0, say: null, sayT: 0, nextSay: 3 + R() * 18, fade: 1, leaving: undefined, face: R() < 0.5 ? 1 : -1, onKill, onFaint });
      L().rebuild(a, Math.round(lv0 + R() * (lv1 - lv0)));
      out.push(a);
    }
    return out;
  }

  // ---------------- what they do ----------------
  function chat(a, kind, p) { if (Math.random() < (p === undefined ? 1 : p)) { a.say = NC.pick(SAY[kind]); a.sayT = 3.8; } }
  // a rest after each kill (sometimes a long one): they hunt at an easy pace and leave monsters for the hero
  function onKill(game, a) { a.target = null; a.wait = Math.random() < 0.3 ? rand(7, 14) : rand(2.5, 5); a.scan = a.wait; chat(a, 'kill', 0.35); }
  function onFaint(game, a) {
    a.hp = 0; a.dead = 1; a.leaving = 5; a.fade = 1; a.atk.on = false; a.cast = null; a.target = null;
    FX.puff(a.x, a.y - 30, 6, { speed: 110, color: '120,110,140' });
    chat(a, 'faint', 0.8);
    for (const e of game.enemies) if (e.tgt === a) { e.tgt = null; e.tgtLock = 0; }
  }
  // back from the camp: somewhere else on the map, full of health
  function comeBack(game, a) {
    const R = Math.random, at = spot(game.world, a.mapId, R, a.mapId === 'camp' ? a.home : null, a.mapId === 'camp' ? 500 : 0) || a.home;
    a.x = at[0]; a.y = at[1]; a.vx = a.vy = 0; a.sort = a.y;
    a.dead = 0; a.hp = a.maxHp; a.fade = 1; a.leaving = undefined; a.inv = 1.5; a.wp = null; a.wait = 1;
    a.anim = NC.Anim.makeState();
    FX.ring(a.x, a.y - 10, 20, 140, '255,230,150', 0.6, 8);
    chat(a, 'back', 0.6);
  }
  function potion(game, a) {
    const got = Math.round(Math.min(a.maxHp - a.hp, a.maxHp * 0.45));
    a.hp += got; a.potCd = 12;
    FX.num(a.x, a.y - 150, '+' + got, { fill: '#8dff8a', size: 34 });
    FX.stars(a.x, a.y - 70, 6, '255,120,140', { speed: 120, size: 0.6 });
    const s = NC.SPR.ic_potion;
    if (s) FX.add({ type: 'custom', layer: 'glow', life: 0.9, x: a.x, y: a.y, draw(ctx, p, u) {
      ctx.save(); ctx.globalAlpha = 1 - u; const k = 44 / Math.max(s.img.width, s.img.height);
      ctx.drawImage(s.img, p.x - (s.img.width * k) / 2, p.y - 190 - 40 * u, s.img.width * k, s.img.height * k); ctx.restore();
    } });
    chat(a, 'potion', 0.5);
  }
  // monsters for a bot: near it, not the hero's side of the map, not someone else's fight, never a boss
  function prey(game, a) {
    const P = game.player;
    let best = null, bs = Infinity;
    for (const e of game.enemies) {
      if (!L().alive(e) || e.dummy || isBoss(e) || inArena(a.mapId, e.x, e.y, 150)) continue;
      const d = dist(a.x, a.y, e.x, e.y);
      if (d > 480 || dist(e.x, e.y, P.x, P.y) < 480 || e === game.target || (e.tgt && !e.tgt.bot)) continue;
      if (Bots.list.some((b) => b !== a && b.target === e)) continue;
      if (d < bs) { bs = d; best = e; }
    }
    return best;
  }
  function skill(game, a, e, W) {
    const lib = L(), P = game.player;
    switch (a.def.role) {
      case 'tank': {
        const near = game.enemies.filter((m) => lib.alive(m) && !isBoss(m) && dist(m.x, m.y, a.x, a.y) < 300 && (!m.tgt || m.tgt.bot) && dist(m.x, m.y, P.x, P.y) > 420);
        if (near.length < 2) return;
        for (const m of near) { m.tgt = a; m.tgtLock = game.time + 5; }
        FX.ring(a.x, a.y - 20, 30, 300, '255,130,90', 0.5, 8);
        break;
      }
      case 'mage':
        if (dist(a.x, a.y, e.x, e.y) > 480) return;
        lib.castPose(a, W);
        lib.shoot(game, a, e, { type: 'fire', kind: 'magic', mul: 1, element: 'fire', big: true, onHit: (x, y) => lib.explode(game, a, x, y) });
        break;
      case 'archer':
        if (dist(a.x, a.y, e.x, e.y) > 520) return;
        lib.castPose(a, W);
        for (const s of [-0.06, 0.06]) lib.shoot(game, a, e, { type: 'arrow', kind: 'phys', mul: 1.4, spread: s });
        break;
      case 'rogue': {
        if (dist(a.x, a.y, e.x, e.y) > 130 + e.r) return;
        const ang = angle(a.x, a.y, e.x, e.y);
        for (const k of [0, 1]) {
          if (!lib.alive(e)) break;
          lib.strike(game, a, e, { kind: 'phys', mul: 1.6, element: 'poison', kx: Math.cos(ang) * 60, ky: Math.sin(ang) * 60 });
          FX.slash(e.x, e.y - 55, ang + (k ? 0.9 : -0.9), 80, '140,255,110', k ? -a.face : a.face);
        }
        break;
      }
      case 'healer': {
        // itself or another adventurer; and a kind stranger heals the hero too when he's in trouble close by
        let who = null;
        if (P.dead <= 0 && P.hp / P.maxHp < 0.4 && dist(a.x, a.y, P.x, P.y) < 360) { who = P; chat(a, 'help', 0.7); }
        for (const b of Bots.list) if (!who && b.dead <= 0 && b.hp / b.maxHp < 0.6 && dist(a.x, a.y, b.x, b.y) < 420) who = b;
        if (!who) return;
        lib.castPose(a, W); lib.heal(game, a, who);
        break;
      }
      default: return;
    }
    a.skillCd = a.def.skill.cd * rand(0.9, 1.3);
    a.lastFight = game.time;
  }

  function think(game, a, dt) {
    const lib = L(), world = game.world, W = NC.ITEMS[a.equip.weapon] || {};
    a.inv = Math.max(0, a.inv - dt); a.hurt = Math.max(0, a.hurt - dt);
    a.atk.cd = Math.max(0, a.atk.cd - dt); a.skillCd = Math.max(0, a.skillCd - dt);
    a.potCd -= dt; a.sayT -= dt; a.nextSay -= dt;
    a.combat += ((game.time - a.lastFight < 2.2 ? 1 : 0) - a.combat) * Math.min(1, dt * 8);
    a.moving = false;
    if (a.leaving !== undefined) { // fainted: lies there, fades, comes back elsewhere
      a.leaving -= dt;
      a.fade = clamp(a.leaving, 0, 1);
      if (a.leaving <= 0) comeBack(game, a);
      return;
    }
    a.hp = Math.min(a.maxHp, a.hp + a.d.hpRegen * (a.combat > 0.5 ? 0.6 : 3) * dt);
    if (a.hp < a.maxHp * 0.35 && a.potCd <= 0) potion(game, a);
    if (a.nextSay <= 0) { chat(a, a.mapId === 'camp' ? 'town' : 'field', a.mapId === 'camp' ? 0.9 : 0.6); a.nextSay = rand(22, 55); }
    // the fight: whoever is hitting it, else something to hunt
    let e = a.target;
    if (e && (!lib.alive(e) || !game.enemies.includes(e) || dist(a.x, a.y, e.x, e.y) > 900)) e = a.target = null;
    if (!e) for (const m of game.enemies) if (m.tgt === a && lib.alive(m)) { e = a.target = m; break; }
    if (!e && a.hunts && (a.scan -= dt) <= 0) { a.scan = rand(1, 2); e = a.target = prey(game, a); }
    if (e && a.skillCd <= 0 && !a.atk.on) skill(game, a, e, W);
    else if (!e && a.def.role === 'healer' && a.skillCd <= 0) skill(game, a, null, W);
    let gx, gy, speed = 210;
    if (e) {
      const de = dist(a.x, a.y, e.x, e.y), reach = a.def.range || (W.reach || 90) * 0.7 + e.r;
      if (de > reach) { gx = e.x; gy = e.y; speed = 300; }
      else if (a.def.range && de < reach * 0.45) { const g = angle(e.x, e.y, a.x, a.y); gx = a.x + Math.cos(g) * 140; gy = a.y + Math.sin(g) * 90; speed = 300; }
      else if (!a.atk.on && a.atk.cd <= 0) lib.attack(game, a, e, W);
      a.aim = angle(a.x, a.y - 50, e.x, e.y - 45);
      if (!a.atk.on) a.face = Math.cos(a.aim) >= 0 ? 1 : -1;
      a.wp = null;
    } else if (a.wait > 0) {
      a.wait -= dt;
    } else {
      if (!a.wp) {
        a.wp = spot(world, a.mapId, Math.random, a.home, a.roam) || a.home;
        if (a.mapId !== 'camp' && Math.random() < 0.25) a.home = [a.x, a.y]; // field bots drift across the map over time
      }
      if (dist(a.x, a.y, a.wp[0], a.wp[1]) < 40) { a.wp = null; a.wait = rand(1.5, a.mapId === 'camp' ? 7 : 4); }
      else { gx = a.wp[0]; gy = a.wp[1]; }
    }
    let mx = 0, my = 0;
    if (gx !== undefined) { const d = dist(a.x, a.y, gx, gy); if (d > 6) { mx = (gx - a.x) / d; my = (gy - a.y) / d; } }
    const sp = speed * (a.atk.on ? 0.35 : 1), k = 1 - Math.exp(-dt * 10);
    a.vx += (mx * sp - a.vx) * k; a.vy += (my * sp - a.vy) * k;
    const ox = a.x, oy = a.y;
    NC.tryMove(world, a, a.vx * dt, a.vy * dt);
    const moved = Math.hypot(a.x - ox, a.y - oy) / Math.max(dt, 1e-3);
    a.moving = moved > 40;
    a.running = a.moving && moved > (a.running ? 170 : 210);
    if (a.moving) a.walk += dt * moved * (a.running ? 0.0663 : 0.085);
    if (a.moving && !e && Math.abs(a.vx) > 30) a.face = a.vx > 0 ? 1 : -1;
    if (Math.abs(mx) + Math.abs(my) > 0.5 && moved < 20) { if ((a.stuck += dt) > 1.2) { a.stuck = 0; a.wp = null; a.target = null; a.wait = 0.3; } } else a.stuck = 0;
    a.sort = a.y;
  }

  // ---------------- the adventurers of the map the hero is on ----------------
  const Bots = (NC.Bots = {
    get list() { const w = NC.game && NC.game.world; return (w && w.bots) || []; },
    onMap(game) { if (!game.world.bots) game.world.bots = PER_MAP ? create(game, game.world, game.mapId || 'camp') : []; },
    update(game, dt) {
      if (!game.world.bots) Bots.onMap(game);
      for (const a of game.world.bots) { think(game, a, dt); L().animate(game, a, dt); }
    },
    drawTags(ctx, game, bar) {
      const c = game.cam, vw = game.vw, vh = game.vh;
      for (const a of Bots.list) {
        if (!a.pose || a.x < c.x - 200 || a.x > c.x + vw + 200 || a.y < c.y - 100 || a.y > c.y + vh + 300) continue;
        ctx.save();
        ctx.globalAlpha = a.fade;
        if (a.dead <= 0 && (a.hp < a.maxHp - 1 || a.combat > 0.3)) {
          const f = a.hp / a.maxHp;
          bar(ctx, a.x - 38, a.y + 16, 76, 6, f, f > 0.5 ? '#6ad36a' : f > 0.25 ? '#f2c14e' : '#ee5a5a');
        }
        if (NC.drawTag) NC.drawTag(ctx, a.name, a.x, a.y + 38, 19, '#ffffff');
        if (a.say && a.sayT > 0) bubble(ctx, a.say, a.x, a.y - 208, clamp(a.sayT / 0.3, 0, 1) * clamp((3.8 - a.sayT) / 0.15, 0, 1));
        ctx.restore();
      }
    },
  });
  function bubble(ctx, text, x, y, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = "500 20px 'Mitr', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(320, ctx.measureText(text).width + 28), h = 38;
    ctx.beginPath();
    NC.rrect(ctx, x - w / 2, y - h, w, h, 14);
    ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 9, y - 2); ctx.lineTo(x, y + 12); ctx.lineTo(x + 9, y - 2); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(x - 7, y - 6, 14, 6); // (covers the outline between bubble and tail)
    ctx.fillStyle = NC.OUTLINE;
    ctx.fillText(text, x, y - h / 2 + 1, w - 20);
    ctx.restore();
  }
})();
