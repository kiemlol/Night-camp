/* rootboss.js — ผู้ถูกรากสิง, the root-possessed human bosses (design 2026-10-14 "เขตล่าและผู้ถูกรากสิง"; the user picked
   look A: the Dark Tree's roots grow THROUGH a cool outfit). One per hunting area (js/fields6.js), the size of a player
   hero (scale 1; the story bosses are 1.45), wandering the area's four sections:
     killed -> 60–90 min (random) -> a random section of the area (deeper ones likelier), a random named zone in it (never
     a safe camp, not by a warp) -> a notice to everyone in the area: "รากใต้ดินสั่น… มีคนเห็น X แถว <zone> (<section>)"
     -> walks from zone to zone -> nobody hits it for 20 min: it sinks into the ground and comes up in another section
     5–10 min later (a new notice) -> killed: the roots let go, it drops its own outfit and weapon (boss rates,
     bossrate.js), a root core always, and the clock starts again.
   It fights with js/dunbosses.js's moves (the game server already knows those nine) and is drawn as a person like
   js/storyboss.js, with the glowing root eye laid on its face through the glasses slot (js/glasses.js).
   PILOT: ฮาร์เวน ผู้เก็บเกี่ยวยามดึก, Lv 20 (the area's top + 2 since the B1–B3 plan; was 24), ไร่ฟักทอง + its B sections: a scythe; slam, a leaping dash (swoop), blink, calls crows.
   Art: assets/rig_harlock_* (the coat, tools/rigcut.py) + assets/lost/ (hat, scythe, eye) from
   assets/gen/make_harlock_prompts.py -> tools/harlock_cut.py; assets/lost.manifest.js.
   Offline the clock lives in this browser (localStorage nightcamp.rootboss.v1; ?fresh keeps it in memory only).
   Online, backend/server/root_bosses*.go owns the clock and online/world.js mirrors its monsters.
   Inspect: NC.RootBoss.state, ?equip=robe_harlock,hat_harlock,scythe_harlock,glasses_rooteye on the hero. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, DB = NC.DUNGEON_BOSSES, M = NC.ASSET_MANIFEST;
  if (!DB || !NC.BOSSES || !NC.AREAS) return;
  if (NC.ASSET_MANIFEST_LOST) Object.assign(M, NC.ASSET_MANIFEST_LOST);
  if (!M.rooteye) return; // (no art yet)
  const MIN = 60 * 1000;
  const rand = (a, b) => a + Math.random() * (b - a);
  ITEMS.glasses_rooteye = { slot: 'glasses', name: 'ตารากสิง', sprite: 'rooteye', rarity: 'epic', stats: {}, fit: 1, dx: 0, dy: 0,
    desc: 'ดวงตาของคนที่รากต้นไม้มืดเข้าไปอยู่ในร่าง (ของบอส ไม่ดรอป)', noDrop: true };
  const order = (ids) => { if (NC.ITEM_ORDER) for (const id of ids) if (ITEMS[id] && !NC.ITEM_ORDER.includes(id)) NC.ITEM_ORDER.push(id); };
  const B = {};

  // ---------------- the pilot, Harven, by hand (his outfit and scythe also drop from him) ----------------
  if (M.rig_harlock_torso && M.hat_harlock5 && M.w_harlock && NC.MAPS.cornmaze) {
    ITEMS.robe_harlock = { slot: 'robe', name: 'โค้ทผู้เก็บเกี่ยวยามดึก', rig: 'harlock', rarity: 'epic', lvReq: 20,
      stats: { def: 8, mdef: 4, agi: 3, crit: 0.03 },
      desc: 'โค้ทหนังสีน้ำตาลเข้มคอตั้ง สายคาดอกหัวเข็มขัดเหล็ก รากดำมีผลึกเรืองแสงยังเกาะอยู่ที่หลัง · จากฮาร์เวน' };
    const HW = M.hat_harlock5.wear || { fit: 1.5, seat: 0.23, clip: true };
    // (seat: hatcut measured 0.23 off Codex's drawing, where the hat perched on the green head; the user: "หมวก… วางไม่
    // ตรงจุด". Pulled down to 0.42: the brim at the brows, the hair framing the face under it, like the concept)
    ITEMS.hat_harlock = { slot: 'hat', name: 'หมวกปีกกว้างเถารากดำ', sprite: 'hat_harlock5', rarity: 'epic', lvReq: 20,
      fit: 1.39, seat: 0.46, dx: 0, clip: HW.clip, soft: 0.3, stats: { def: 3, agi: 2 },
      desc: 'หมวกหนังปีกกว้างยอดงอ คาดเข็มขัดหัวเหล็ก รากดำกับผลึกชมพูงอกออกจากปีกหมวก · จากฮาร์เวน' };
    if (ITEMS.scythe) {
      const W = Object.assign({}, ITEMS.scythe, {
        id: 'scythe_harlock', sprite: 'w_harlock', name: 'เคียวรากดำของฮาร์เวน', rarity: 'epic', lvReq: 20, element: 'shadow',
        dmg: ITEMS.scythe.dmg ? ITEMS.scythe.dmg.map((v) => Math.round(v * 1.1)) : [90, 116], stats: { agi: 2, crit: 0.04 },
        desc: 'เคียวยาวใบเหล็กร้าวเรืองแสง ด้ามเป็นรากไม้ดำบิดเกลียวมีผลึกงอก · จากฮาร์เวน',
      });
      for (const k of Object.keys(W)) if (k[0] === '_') delete W[k];
      ITEMS.scythe_harlock = W;
    }
    order(['robe_harlock', 'hat_harlock', 'scythe_harlock']);
    // (2026-10-18: only the ไร่ร้างหลังเขา line, Lv 10–18; the pumpkin farm + its B1–B3 became the Lv 1–10 maps)
    B.harlock = { name: 'ฮาร์เวน ผู้เก็บเกี่ยวยามดึก', lv: 20, area: 'farm', maps: { farm2: 2, cornmaze: 3, pens: 3, threshing: 3 }, // (+ its B1–B3 sections; maps not built are skipped)
      skipZones: ['ทุ่งสไลม์ริมทาง'], // (the newcomers' slime field, Lv 1–5)
      equip: { hair: 'hair_spiky', top: 'top_traveler', pants: 'pants_traveler', shoes: 'shoes_traveler', cape: null,
        robe: 'robe_harlock', hat: 'hat_harlock', weapon: ITEMS.scythe_harlock ? 'scythe_harlock' : 'staff', glasses: 'glasses_rooteye' },
      element: 'shadow', atkElement: 'neutral', moves: ['slam', 'swoop', 'blink', 'summon'], minion: ['crow', 3], fx: '225,70,235',
      drops: [['robe_harlock', 1], ['hat_harlock', 1], ['scythe_harlock', 0.5]],
      core: ['mat_rootcore_harlock', 'แก่นรากของฮาร์เวน', 'ปมรากไม้ดำที่หลุดออกจากหลังฮาร์เวน ข้างในยังมีผลึกเรืองแสงเต้นช้า ๆ'] };
  }

  // ---------------- the other twenty, one per area (NC.AREA_DATA.bosses, js/areas_data.js), as their art comes in ----------------
  // their gear: the outfit (the rig of its parts sheet), the headgear (a region's sheet of heads), the weapon (a copy of
  // its type's best ordinary weapon at their level, a tenth stronger), all at their level; a boss is left out until all
  // of its pieces are cut; its face is a creator head (js/look.js), put on once the look pictures are in
  const MAGIC = ['staff', 'orb', 'lantern', 'torch', 'instrument', 'puppet', 'book', 'bell'];
  const RANGED = ['bow', 'xbow', 'pistol', 'shotgun'];
  function baseWeapon(wt, lv) {
    let best = null;
    for (const [id, it] of Object.entries(ITEMS)) {
      if (it.slot !== 'weapon' || it.wtype !== wt || !it.lvReq || it.lvReq > lv || it.noDrop || /_harlock$|^c3_/.test(id)) continue;
      if (!best || it.lvReq > best.lvReq) best = it;
    }
    return best || Object.values(ITEMS).find((it) => it.slot === 'weapon' && it.wtype === wt);
  }
  const AD = NC.AREA_DATA;
  for (const [id, X] of Object.entries((AD && AD.bosses) || {})) {
    if (B[id] || !M['rig_' + id + '_torso'] || !M['w_' + id] || (X.hat && !M['hat_' + id])) continue;
    const maps = {};
    for (const [m, w] of Object.entries(X.weights || {})) if (NC.MAPS[m]) maps[m] = w;
    if (!Object.keys(maps).length) continue;
    const first = X.name.split(' ')[0], L = X.lv, wt = X.weapon.wtype, base = baseWeapon(wt, L);
    if (!base) continue;
    const role = MAGIC.includes(wt) ? 'magic' : RANGED.includes(wt) ? 'ranged' : 'melee';
    const main = role === 'magic' ? 'int' : role === 'ranged' ? 'dex' : ['dagger', 'dsword', 'katar'].includes(wt) ? 'agi' : 'str';
    const r = (k) => Math.max(1, Math.round(L * k));
    ITEMS['robe_' + id] = { slot: 'robe', name: X.outfitTh || 'ชุดของ' + first, rig: id, rarity: 'epic', lvReq: L,
      stats: role === 'magic' ? { def: r(0.22), mdef: r(0.3), [main]: r(0.125), cdr: 0.03 }
        : { def: r(role === 'ranged' ? 0.28 : 0.33), mdef: r(0.17), [main]: r(0.125), crit: 0.03 },
      desc: `${X.outfitTh || 'ชุด'}ที่รากดำงอกทะลุออกมา ผลึกเรืองแสงยังเกาะอยู่ตามแขนและหลัง · จาก${first}` };
    if (X.hat) {
      const HW = M['hat_' + id].wear || { fit: 1.5, seat: 0.4, clip: true }, F = X.hatFit || {};
      // (a hood, a pelt, an open helmet: tools/lost_cut.py hoods made its _fill mask: worn like the fashion hoods, the head
      // showing only inside its outline, the face through the opening)
      const hood = !!M['hat_' + id + '_fill'];
      ITEMS['hat_' + id] = { slot: 'hat', name: X.hatTh || 'หมวกของ' + first, sprite: 'hat_' + id, rarity: 'epic', lvReq: L,
        fit: F.fit || HW.fit, seat: F.seat != null ? F.seat : HW.seat, dx: F.dx || 0, clip: hood ? false : F.clip != null ? F.clip : HW.clip,
        hood, soft: hood ? 0 : 0.3,
        stats: { def: r(0.125), [main]: Math.max(1, Math.round(L / 12)) }, desc: `${X.hatTh || 'หมวก'} รากดำกับผลึกชมพูงอกออกมา · จาก${first}` };
    }
    const wid = wt + '_' + id;
    const W = Object.assign({}, base, { id: wid, sprite: 'w_' + id, name: X.weapon.name, rarity: 'epic', lvReq: L,
      dmg: base.dmg ? base.dmg.map((v) => Math.round(v * 1.1)) : base.dmg, desc: `${X.weapon.name} รากดำพันรอบ ผลึกเรืองแสงงอกตามด้าม · จาก${first}` });
    if (X.atkElement && X.atkElement !== 'neutral') W.element = X.atkElement;
    if (X.weaponFit) Object.assign(W, X.weaponFit); // (areas_data.py weaponFit: e.g. a short handle gripped higher)
    for (const k of Object.keys(W)) if (k[0] === '_') delete W[k];
    ITEMS[wid] = W;
    order(['robe_' + id, 'hat_' + id, wid]);
    // (a summon needs its minion's species; every boss keeps a move it can use from afar: areas_data.py has one each)
    const moves = X.moves.filter((m) => m !== 'summon' || (X.minion && NC.SPECIES[X.minion[0]]));
    B[id] = { name: X.name, lv: L, area: X.area, maps, skipZones: X.skip || [], head: X.head,
      equip: { hair: 'hair_spiky', top: 'top_traveler', pants: 'pants_traveler', shoes: 'shoes_traveler', cape: null,
        robe: 'robe_' + id, hat: X.hat ? 'hat_' + id : null, weapon: wid, glasses: 'glasses_rooteye' },
      element: X.element, atkElement: X.atkElement, moves, minion: X.minion || null, fx: '225,70,235',
      drops: [['robe_' + id, 1]].concat(X.hat ? [['hat_' + id, 1]] : [], [[wid, 0.5]]),
      core: ['mat_rootcore_' + id] };
  }
  if (!Object.keys(B).length) return;

  for (const [id, D] of Object.entries(B)) {
    // (atkK 2.8, was 1.4: 2026-10-19 the user: "อยากให้บอสโหดขึ้น ตีแรงมากขึ้น ทั้งหมดเลย". With class gear a blow took
    // 6-12% of a fighter's HP (biggest move 5-17%), barely more than a plain monster of its level; now 14-26% (20-39%),
    // a mage's 26-55% (39-82%), no one-hit kill)
    const S = { name: D.name, element: D.element, atkElement: D.atkElement, r: 30, hpK: 26, atkK: 2.8, defK: 1.1, mdefK: 1, agiK: 0.9,
      dexK: 1, expK: 30, spd: 135, aggro: 600 };
    // (every one needs a move it can use from afar - swoop, breath, orbs, rain or acid: dunbosses.js's picker has nothing
    // to pick and throws when the hero stands off and only close moves are listed. fly 0: swoop is then a low leaping
    // dash along its lane, not a dive from the air)
    DB[id] = Object.assign({}, S, { moves: D.moves, minion: D.minion, top: 205, fx: D.fx, human: true, fly: 0,
      light: [320, '160,70,255'] }); // (a violet light round him: at night his aura lights the ground)
    NC.MONSTERS[id] = S;
    NC.BOSSES[id] = { respawn: 3600, drops: 0, top: 205 };
    if (NC.LOOT_DATA && NC.LOOT_DATA.bosses) NC.LOOT_DATA.bosses[id] = D.drops.filter(([it]) => ITEMS[it]);
    if (NC.MATERIALS && NC.MAT_DROPS) {
      if (D.core[1]) NC.MATERIALS[D.core[0]] = { name: D.core[1], price: 900, desc: D.core[2] };
      NC.MAT_DROPS[id] = [[D.core[0], 1, 1, 2]];
    }
  }

  // ---------------- the clock ----------------
  const KEY = 'nightcamp.rootboss.v1', MEMONLY = NC.ONLINE;
  const ST = (() => { if (MEMONLY) return {}; try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })();
  const save = () => { if (!MEMONLY) try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) { /* full or blocked */ } };
  const say = (game, text) => { if (game.toast) game.toast(text); if (NC.HUD && NC.HUD.log) NC.HUD.log(text, 'warn'); };
  const inArea = (game, D) => !!(game && D.maps[game.mapId]);
  const where = (s) => `${s.zone ? 'แถว' + s.zone + ' ' : ''}(${NC.areaLabel ? NC.areaLabel(s.map) : s.map})`;

  // a section (weighted, not the one it just left), then a zone in it that is not a safe camp
  function pickMap(D, avoid) {
    const list = Object.entries(D.maps).filter(([m]) => NC.MAPS[m] && m !== avoid);
    let r = Math.random() * list.reduce((a, [, w]) => a + w, 0);
    for (const [m, w] of list) if ((r -= w) <= 0) return m;
    return list[0][0];
  }
  const inRect = (x, y, q) => x > q[0] && x < q[2] && y > q[1] && y < q[3];
  function zonesOf(map, D) {
    const def = NC.MAPS[map], safe = def.safe || [];
    return (def.zones || []).filter((z) => z.rect && !(D.skipZones || []).includes(z.name) &&
      !safe.some((q) => inRect((z.rect[0] + z.rect[2]) / 2, (z.rect[1] + z.rect[3]) / 2, q)));
  }
  // a walkable point in the zone (or anywhere on the map), off the safe camps and the warps; a crowded zone (an orchard,
  // the maze): the free spot nearest its middle, so he is where the notice said
  function pointIn(world, map, zone) {
    const def = NC.MAPS[map], safe = def.safe || [], warps = def.warps || [];
    const q = zone ? zone.rect : [200, 200, def.W - 200, def.H - 200];
    const ok = (x, y) => !safe.some((s) => inRect(x, y, [s[0] - 150, s[1] - 150, s[2] + 150, s[3] + 150])) &&
      !warps.some((w) => Math.hypot(w.x - x, w.y - y) < 500) && (!world || !world.fits || world.fits(x, y, 40));
    for (let n = 0; n < 200; n++) {
      const x = rand(q[0] + 60, q[2] - 60), y = rand(q[1] + 60, q[3] - 60);
      if (ok(x, y)) return [Math.round(x), Math.round(y)];
    }
    if (zone) {
      const cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2;
      for (let r = 40; r < 1200; r += 40) for (let a = 0; a < 6.28; a += 0.35) {
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.7;
        if (ok(x, y)) return [Math.round(x), Math.round(y)];
      }
    }
    return null;
  }

  function appear(game, id, D, s) {
    if (NC.RootBoss.server) return; // (online: the game server brings them up, js/online/rootboss.js)
    const map = pickMap(D, s.left);
    const zs = zonesOf(map, D), zone = zs.length ? zs[Math.floor(Math.random() * zs.length)] : null;
    Object.assign(s, { phase: 'out', map, zone: zone ? zone.name : '', x: null, y: null, until: Date.now() + 20 * MIN, left: null });
    if (game.mapId === map) placeHere(game, id, D, s);
    save();
    if (inArea(game, D)) { s._told = true; s._toldMap = game.mapId; say(game, `รากใต้ดินสั่น… มีคนเห็น ${D.name} ${where(s)}`); }
  }
  function placeHere(game, id, D, s) {
    if (s.x == null) {
      const def = NC.MAPS[s.map], zone = (def.zones || []).find((z) => z.name === s.zone);
      const at = pointIn(game.world, s.map, zone) || pointIn(game.world, s.map, null);
      if (!at) return null;
      [s.x, s.y] = at;
    }
    const e = NC.makeEnemy(id, s.x, s.y, D.lv);
    if (!e) return null;
    e.rootBoss = true;
    game.enemies.push(e);
    return e;
  }
  function sink(game, id, D, s, e) {
    if (e) {
      NC.FX.puff(e.x, e.y - 20, 18, { speed: 160, color: '60,40,50' });
      const i = game.enemies.indexOf(e);
      if (i >= 0) game.enemies.splice(i, 1);
      for (const m of game.enemies) if (m.owner === e) m.dead = 1;
    }
    Object.assign(s, { phase: 'wait', left: s.map, until: Date.now() + rand(5, 10) * MIN, x: null, y: null });
    save();
    if (inArea(game, D)) say(game, `${D.name} มุดหายลงไปใต้ดิน… รากกำลังพาไปโผล่ที่อื่น`);
  }
  const live = (game, id) => game.enemies.find((e) => e.type === id && !e.dead);

  // a creator head for the face (js/look.js), as soon as the look's pictures are in
  const face = (D) => {
    if (!D.head || D._face || !NC.Look || !NC.Look.ready || !NC.Look.ready()) return;
    const h = NC.Look.register(D.head);
    if (h) { D.equip.hair = h; D._face = true; }
  };
  function tick(game) {
    if (!game || !game.world || !game.player || NC.RootBoss.server) return; // (online: the server's clock, js/online/rootboss.js)
    const t = Date.now();
    for (const [id, D] of Object.entries(B)) {
      face(D);
      const s = ST[id] || (ST[id] = { phase: 'wait', until: t + rand(3, 8) * MIN });
      if (s.phase === 'out' && !D.maps[s.map]) Object.assign(s, { phase: 'wait', left: null, until: t + rand(1, 3) * MIN, x: null, y: null }); // (a saved spot on a map it no longer visits)
      if (s.phase === 'wait') {
        if (t >= s.until) appear(game, id, D, s);
        continue;
      }
      const e = live(game, id);
      if (e) { s.x = Math.round(e.x); s.y = Math.round(e.y); }
      else if (game.mapId === s.map && !(s._tryT > t)) { if (!placeHere(game, id, D, s)) s._tryT = t + 3000; } // (no room yet: try again soon)
      if (t >= s.until && !(e && e.awake)) sink(game, id, D, s, e);
      if (!s._told && inArea(game, D) && game.mapId !== s._toldMap) { // (coming into the area while it is out)
        s._told = true; s._toldMap = game.mapId;
        say(game, `มีข่าวว่า ${D.name} กำลังเดินอยู่${where(s)}`);
      }
    }
  }
  // a new map: its old copy went with the old world; tell the area again
  const baseEnter = NC.Maps.monsters;
  NC.Maps.monsters = function (world) {
    const list = baseEnter.apply(this, arguments);
    for (const s of Object.values(ST)) s._told = false;
    return list;
  };

  // ---------------- walking from zone to zone while nobody fights it ----------------
  function wander(game, e, D, dt) {
    const w = game.world, s = ST[e.type];
    if (!e._wp || Math.hypot(e.x - e._wp[0], e.y - e._wp[1]) < 40 || (e._wpT -= dt) <= 0) {
      let zone = null;
      const zs = zonesOf(game.mapId, D);
      if (zs.length) zone = Math.random() < 0.25 ? zs[Math.floor(Math.random() * zs.length)] : zs.find((z) => inRect(e.x, e.y, z.rect)) || zs[0];
      e._wp = pointIn(w, game.mapId, zone) || [e.x + rand(-300, 300), e.y + rand(-200, 200)];
      e._wpT = rand(10, 18);
      if (s && zone) s.zone = zone.name;
    }
    const a = NC.angle(e.x, e.y, e._wp[0], e._wp[1]);
    const x0 = e.x, y0 = e.y;
    NC.tryMove(w, e, Math.cos(a) * 62 * dt, Math.sin(a) * 62 * dt);
    if (Math.hypot(e.x - x0, e.y - y0) < 0.5) e._wpT -= dt * 3; // (a wall: look for another way soon)
    e.face = Math.cos(a) > 0 ? 1 : -1;
    e.sx = e.x; e.sy = e.y; // (its home walks with it: the leash and the way back follow)
  }
  const baseUpdate = NC.updateEnemy;
  NC.updateEnemy = function (game, e, dt) {
    const D = B[e.type];
    if (D && !e.dead) {
      // lost the hero: in the maze it can get stuck chasing round a wall for ever (and never sink): after 12 s with the
      // hero out of reach it gives up where it stands and goes back to its walk, its wounds closing slowly
      const p = game.player, far = !p || p.dead > 0 || Math.hypot(p.x - e.x, p.y - e.y) > 1300;
      e._farT = e.awake && far ? (e._farT || 0) + dt : 0;
      if (e._farT > 12) { e.awake = false; e.state = 'idle'; e._farT = 0; e.sx = e.x; e.sy = e.y; e.raged = e.hp < e.maxHp * 0.5; }
      if (!e.awake && e.state === 'idle') {
        wander(game, e, D, dt);
        if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
      }
    }
    return baseUpdate.apply(this, arguments);
  };

  // ---------------- hits keep it here; its death starts the clock ----------------
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e) {
    const out = baseDamage.apply(this, arguments);
    const D = B[e.type], s = D && ST[e.type];
    if (s && s.phase === 'out') {
      if (e.dead) {
        Object.assign(s, { phase: 'wait', until: Date.now() + rand(60, 90) * MIN, x: null, y: null, left: null });
        save();
        say(game, `รากหลุดออกจากร่างของ ${D.name} แล้ว… เขาได้หลับเสียที`);
      } else s.until = Math.max(s.until, Date.now() + 20 * MIN);
    }
    return out;
  };

  // ---------------- drawn as a person, the size of a hero ----------------
  const Anim = NC.Anim;
  const baseDraw = NC.drawEnemy;
  NC.drawEnemy = function (ctx, game, e) {
    const D = B[e.type];
    if (!D) return baseDraw.apply(this, arguments);
    face(D);
    if (!e.rig) e.rig = { anim: Anim.makeState(), hatS: {}, walk: 0, lx: e.x, face: -1 };
    const R = e.rig, dt = Math.min(0.1, Math.max(0, game.time - (R.t || game.time))); R.t = game.time;
    const dx = e.x - R.lx; R.lx = e.x;
    const moving = Math.abs(dx) + Math.abs(e.y - (R.ly === undefined ? e.y : R.ly)) > 0.4; R.ly = e.y;
    if (Math.abs(dx) > 0.3) R.face = dx > 0 ? 1 : -1;
    else if (e.awake && game.player) R.face = game.player.x > e.x ? 1 : -1;
    R.walk += dt * (moving ? 1 : 0);
    const W = ITEMS[D.equip.weapon] || {}, SET = Anim.setOf(Anim.movesFor({ idle: 'idle', set: 'basic' }, W));
    const busy = e.state && !['idle', 'chase', 'recover', 'return'].includes(e.state);
    const fight = e.awake || busy;
    // (the scythe always in hand, even on his walks: walkReady / ready)
    Anim.setBase(R.anim, e.dead ? 'death' : moving ? (fight ? 'runReady' : 'walkReady') : SET.ready, 0.16);
    if (busy && e.state !== R.lastState) { const c = SET.combo(W.style)[Math.floor(Math.random() * 3)]; if (Anim.CLIPS[c]) Anim.play(R.anim, c); }
    R.lastState = e.state;
    Anim.update(R.anim, dt, 1, () => {});
    const c = NC.animCtx(D.equip, { al: 0, walk: R.walk, moving, hurt: e.hurt ? 1 : 0, idleStyle: 'idle', ready: SET.ready });
    const P = Anim.evaluate(R.anim, c);
    P.face = R.face;
    NC.hatSpring(R.hatS, D.equip, P, dx * 60 * R.face, dt);
    ctx.save();
    ctx.fillStyle = 'rgba(20,14,30,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 34, 10, 0, 0, Math.PI * 2); ctx.fill();
    const A = aura(game, e, dt);
    if (A) A.back(ctx); else if (NC.VFX) NC.VFX.glow(ctx, e.x, e.y - 70, 120, D.fx, e.raged ? 0.34 : 0.18, true);
    NC.drawHero(ctx, D.equip, P, e.x, e.y, { scale: 1 });
    if (A) A.front(ctx);
    ctx.restore();
  };

  // ---------------- the dark aura (the user: "ทำออร่ารอบตัวบอสด้วยแบบม่วงๆ ให้ดูน่ากลัวหน่อย") ----------------
  // painted pieces only (assets/lost/aura_*, Codex: make_harlock_prompts.py aura -> harlock_cut.py aura); the code only
  // places, turns, scales and fades them: a ring of violet mist and roots on the ground breathing under him, a dark halo
  // behind his body, wisps of violet smoke-flame rising round him (the ones behind him under his body, the rest over it),
  // more and bigger when he is angry or fighting
  const WISPS = ['aura_wisp1', 'aura_wisp2', 'aura_wisp3', 'aura_wisp4'];
  function aura(game, e, dt) {
    const G = NC.SPR.aura_ground, Hl = NC.SPR.aura_halo;
    if (!G || !G.img || !Hl || !Hl.img) return null;
    // k: how strong (walking 1, fighting 1.1, angry 1.25); the wisps about half his height, the ring a little wider
    // than his shoulders' swing, so the aura frames him and never hides him
    const T = game.time, k = e.raged ? 1.25 : e.awake ? 1.1 : 1, W = (e._wisps = e._wisps || []);
    e._wispT = (e._wispT || 0) - dt;
    while (e._wispT <= 0) { // (a new wisp every ~0.16 s, faster when angry)
      e._wispT += 0.16 / k;
      const a = Math.random() * Math.PI * 2;
      W.push({ a, r: 22 + Math.random() * 22, t: 0, life: 1.0 + Math.random() * 0.6, s: 0.45 + Math.random() * 0.25,
        n: WISPS[Math.floor(Math.random() * WISPS.length)], sw: Math.random() * 6, flip: Math.random() < 0.5 });
    }
    for (let i = W.length - 1; i >= 0; i--) if ((W[i].t += dt) > W[i].life) W.splice(i, 1);
    const wisp = (ctx, w, front) => {
      const S = NC.SPR[w.n];
      if (!S || !S.img) return;
      const u = w.t / w.life, al = Math.sin(Math.PI * u) * (front ? 0.5 : 0.85), sc = w.s * (0.8 + 0.4 * u) * k;
      const x = e.x + Math.cos(w.a) * w.r + Math.sin(T * 2 + w.sw) * 5, y = e.y + Math.sin(w.a) * w.r * 0.35 - 6 - u * 80;
      ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); if (w.flip) ctx.scale(-1, 1);
      ctx.drawImage(S.img, -S.w * sc / 2, -S.h * sc, S.w * sc, S.h * sc);
      ctx.restore();
    };
    return {
      back(ctx) {
        const p = (0.75 + 0.1 * (k - 1) / 0.25) * (1 + Math.sin(T * 2.2) * 0.04);
        ctx.save();
        ctx.globalAlpha = 0.92; // the ring on the ground, breathing
        ctx.drawImage(G.img, e.x - G.w * p / 2, e.y - G.h * p / 2, G.w * p, G.h * p);
        ctx.globalAlpha = (0.42 + Math.sin(T * 1.7) * 0.1) * k; // the halo behind him
        const hs = 0.72 * k * (1 + Math.sin(T * 1.3) * 0.05);
        ctx.drawImage(Hl.img, e.x - Hl.w * hs / 2, e.y - 66 - Hl.h * hs / 2, Hl.w * hs, Hl.h * hs);
        ctx.restore();
        for (const w of W) if (Math.sin(w.a) < 0) wisp(ctx, w, false);
      },
      front(ctx) { for (const w of W) if (Math.sin(w.a) >= 0) wisp(ctx, w, true); },
    };
  }

  // ---------------- every frame ----------------
  (NC.assetsLoaded || (NC.assetsLoaded = [])).push(() => {
    const baseLoot = NC.updateLoot;
    NC.updateLoot = function (game) { try { tick(game); } catch (err) { console.error(err); } return baseLoot.apply(this, arguments); };
  });

  NC.RootBoss = {
    B, state: ST, face,
  };
})();
