/* bl_core.js — "ดรอปสร้างบิล" (build loot, 2026-10-11), part 1: element essences, coating oils, element ammo, tainted
   gear. Plan: claude.ai/artifact/FqXfXTCvgyDNvzfPe3wh7p (the user: "ทำเลย ลุย เดี๋ยวค่อยทำบาลานซ์").
   - Papa Moo (js/forge.js, the tab "ธาตุ · แปดเปื้อน") extracts 3 of a monster's own material into 1 essence of that
     monster's element, makes oils (5 essences + 300 coins: the weapon hits with that element 10 min, a hidden enchant
     buff like holy water) and ammo packs (2 essences + 200 coins = 100 shots: a ranged weapon shoots that element),
     Dark Sap (10 shadow / ghost / undead materials, at night only) and Moon Dew (10 holy materials).
   - Tainted gear: 1 drop in 50 of a gear copy carries a trait (an upside with a downside); Dark Sap re-rolls one
     (or taints a clean piece), Moon Dew washes it off. Saved on the copy (c.taint, js/gearbag.js keeps the field).
   - Materials drop 1–3 pieces (was 1, 2 at 15%).
   Hooks: NC.FORGE_TABS (forge.js), NC.lootHeard, NC.matQty, NC.skillModSources, NC.heroHit, NC.damageEnemy,
   NC.derive, NC.skillTicks, NC.matCardExtras / NC.invActs (bag buttons), NC.rowsHtml / NC.invBadge, NC.HUD.renderBuffs,
   NC.saveGame / NC.loadGear. Art: assets/shop/bl_*.png + assets/buildloot.manifest.js (tools/buildloot_cut.py).
   NC.BL.taintCopy(copy, 'glass') applies a taint to a copy. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, SK = NC.SKILLS, MAT = NC.MATERIALS;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');

  // ---------------- elements, icons ----------------
  const ELS = ['water', 'earth', 'fire', 'wind', 'poison', 'holy', 'shadow', 'ghost', 'undead'];
  const ELTH = (el) => (NC.ELEMENT_INFO && NC.ELEMENT_INFO[el] ? NC.ELEMENT_INFO[el].th : el);
  const ICONS = NC.ASSET_MANIFEST_BUILDLOOT || {};
  if (NC.ASSET_MANIFEST_SHOP) Object.assign(NC.ASSET_MANIFEST_SHOP, ICONS);
  // the oils' buff icons (the skill bar's buff row reads NC.ASSET_MANIFEST)
  if (NC.ASSET_MANIFEST) for (const el of ELS) if (ICONS['bl_oil_' + el]) NC.ASSET_MANIFEST['bl_oil_' + el] = ICONS['bl_oil_' + el];
  const icon = (id) => (ICONS[id] ? ICONS[id].src : NC.matIcon(id));

  // ---------------- the new pouch items ----------------
  const ESS = {}, OIL = {}, AMMO = {};
  for (const el of ELS) {
    ESS[el] = 'bl_ess_' + el; OIL[el] = 'bl_oil_' + el; AMMO[el] = 'bl_ammo_' + el;
    MAT[ESS[el]] = { name: 'แก่นธาตุ' + ELTH(el), price: 30, kindTh: 'แก่นธาตุ', desc: `สกัดจากวัตถุดิบของมอนธาตุ${ELTH(el)} ใช้ทำน้ำมันเคลือบอาวุธและกระสุนที่ป๋าหมูหริ่ง` };
    MAT[OIL[el]] = { name: 'น้ำมันเคลือบ' + ELTH(el), price: 120, kindTh: 'น้ำมันเคลือบ', desc: `ทาอาวุธแล้วตีเป็นธาตุ${ELTH(el)} 10 นาที (ใช้จากกระเป๋า)` };
    MAT[AMMO[el]] = { name: 'ซองกระสุนธาตุ' + ELTH(el), price: 60, kindTh: 'กระสุนธาตุ', desc: `100 นัด ใช้ได้ทั้งลูกธนู กระสุนปืน และคุไน ยิงเป็นธาตุ${ELTH(el)} (ใช้จากกระเป๋า)` };
    if (ICONS['bl_ammo_bullet']) NC.ASSET_MANIFEST_SHOP[AMMO[el]] = ICONS['bl_ammo_bullet'];
  }
  MAT.bl_dark_sap = { name: 'ยางไม้มืด', price: 300, kindTh: 'ของแปดเปื้อน', desc: 'ยางข้นสีดำม่วงจากต้นไม้มืด ราดของสวมใส่ให้ "แปดเปื้อน" ได้พลังแรงแลกข้อเสีย (สุ่ม) ที่ป๋าหมูหริ่ง' };
  MAT.bl_moon_dew = { name: 'น้ำค้างจันทร์', price: 300, kindTh: 'ของแปดเปื้อน', desc: 'น้ำค้างใสจากแสงจันทร์ ล้างรอยแปดเปื้อนออกจากของสวมใส่ ที่ป๋าหมูหริ่ง' };

  // ---------------- where each material comes from: its monster's element ----------------
  let matEl = null;
  function matElements() {
    if (matEl) return matEl;
    matEl = {};
    for (const sp in NC.MAT_DROPS) {
      const M = NC.MONSTERS[sp];
      if (!M) continue;
      for (const [id] of NC.MAT_DROPS[sp]) if (MAT[id] && !matEl[id]) matEl[id] = M.element || 'neutral';
    }
    return matEl;
  }
  // a material that can be extracted: a monster's own (not a crafted one, a crop, a fish, a boss trophy)
  const extractable = (id) => { const M = MAT[id], el = matElements()[id]; return !!(M && el && el !== 'neutral' && !M.rare && !M.life && !M.food && !M.keep && !/^bl_/.test(id)); };

  // ---------------- the pouch: count, take ----------------
  const has = (p, id) => (NC.matCount ? NC.matCount(p, id) : (p.mats && p.mats[id]) || 0);
  function take(p, id, n) { p.mats[id] -= n; if (p.mats[id] <= 0) delete p.mats[id]; }
  const give = (game, id, n) => NC.addMat(game, id, n);

  // ---------------- materials drop 1-3 pieces ----------------
  const baseQty = NC.matQty;
  NC.matQty = function (e, n0) {
    const n = n0 === 1 ? 1 + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.2 ? 1 : 0) : n0;
    return baseQty ? baseQty(e, n) : n;
  };

  // ---------------- oils: a hidden enchant buff (skilltree.js: an enchant buff sets the weapon's element) ----------------
  const OIL_SEC = 600;
  for (const el of ELS) SK['bl_oil_' + el] = { id: 'bl_oil_' + el, name: 'น้ำมันเคลือบ' + ELTH(el), kind: 'buff', hidden: true, max: 1, icon: 'bl_oil_' + el,
    enchant: el, buff: () => ({}), dur: () => OIL_SEC, sp: () => 0, cd: 0, mul: () => 0 };
  function useOil(game, el) {
    const p = game.player;
    if (has(p, OIL[el]) <= 0) return;
    for (const e2 of ELS) if (p.buffs && p.buffs['bl_oil_' + e2] > 0) p.buffs['bl_oil_' + e2] = 0;
    take(p, OIL[el], 1);
    NC.SkillKit.startBuff(game, p, 'bl_oil_' + el, 1, OIL_SEC);
    if (NC.VFX && NC.VFX.sparks) NC.VFX.sparks(p.x, p.y - 50, 18, '255,220,150', { size: 0.8 });
    game.toast(`ทาน้ำมันเคลือบ${ELTH(el)}แล้ว: อาวุธเป็นธาตุ${ELTH(el)} 10 นาที`);
    NC.saveTrade(game);
  }

  // ---------------- ammo: loaded element + shots left ----------------
  const ST = { el: null, shots: 0 };
  const rangedW = (W) => !!W && (['arrow', 'bolt', 'throw'].includes(W.style) || W.shot === 'bullet' ||
    /bow|gun|pistol|rifle|kunai|shuriken|huuma|sling/.test((NC.wtypeOf && NC.wtypeOf(W)) || ''));
  const ammoOn = (p) => ST.el && ST.shots > 0 && rangedW(ITEMS[p.equip && p.equip.weapon]);
  function loadAmmo(game, el) {
    const p = game.player;
    if (has(p, AMMO[el]) <= 0) return;
    if (ST.el !== el && ST.shots > 0 && ST.el) give(game, AMMO[ST.el], Math.floor(ST.shots / 100));   // (whole packs left go back)
    if (ST.el !== el) ST.shots = 0;
    take(p, AMMO[el], 1);
    ST.el = el; ST.shots += 100;
    NC.applyGear(game);
    game.toast(`ใส่กระสุนธาตุ${ELTH(el)} (${ST.shots} นัด)${rangedW(ITEMS[p.equip.weapon]) ? '' : ' · ใช้กับอาวุธยิงไกลเท่านั้น'}`);
    NC.saveTrade(game); save(game);
  }
  function unloadAmmo(game) {
    if (ST.el && ST.shots >= 100) give(game, AMMO[ST.el], Math.floor(ST.shots / 100));
    ST.el = null; ST.shots = 0;
    NC.applyGear(game); save(game);
  }
  // one shot spent per frame that hits (a volley hitting five monsters is one shot)
  let shotT = -1;
  function spendShot(game) {
    if (shotT === game.time) return;
    shotT = game.time;
    if (--ST.shots <= 0) {
      const el = ST.el, p = game.player;
      if (has(p, AMMO[el]) > 0) { take(p, AMMO[el], 1); ST.shots = 100; NC.HUD.log(`ใส่ซองกระสุนธาตุ${ELTH(el)}ซองใหม่ (เหลือ ${has(p, AMMO[el])} ซอง)`, 'item'); NC.saveTrade(game); }
      else { ST.el = null; ST.shots = 0; game.toast(`กระสุนธาตุ${ELTH(el)}หมดแล้ว`); NC.applyGear(game); }
      save(game);
    }
  }
  // the weapon's element: the oil first (an enchant buff, already set), else the loaded ammo
  const baseDerive = NC.derive;
  NC.derive = function (p) {
    const d = baseDerive(p);
    if (p && p.kind === 'player' && ammoOn(p) && !(p.buffs && Object.keys(p.buffs).some((id) => p.buffs[id] > 0 && SK[id] && SK[id].enchant))) d.atkElement = ST.el;
    return d;
  };

  // ---------------- tainted gear ----------------
  // each trait: mods (skill-mod keys, maybe by day / by night), hit(r, e, p, G) -> damage factor, tick(game, p, dt)
  const night = (G) => !!(NC.BL && NC.BL.forceNight && G && G.time < NC.BL.forceNight) || (NC.nightK ? NC.nightK(G) : 0) >= 0.5;   // (forceNight: a monster art, js/bl_arts.js)
  const TRAITS = {
    thirst: { name: 'กระหาย', up: 'ATK / MATK +25%', down: 'เสีย HP 1% ทุกวินาที ตอนไม่ได้สู้', mods: { atk: 25, matk: 25 },
      tick(game, p, dt) { if (game.time - (p.lastFight || -99) > 4 && p.hp > p.maxHp * 0.1) { p._blThirst = (p._blThirst || 0) + dt; if (p._blThirst >= 1) { p._blThirst -= 1; p.hp = Math.max(1, p.hp - Math.ceil(p.maxHp * 0.01)); } } } },
    moonblind: { name: 'ตาบอดจันทร์', up: 'คริ +40% ตอนกลางคืน', down: 'HIT −30 ตอนกลางวัน', modsAt: (n) => (n ? { crit: 40 } : { hit: -30 }) },
    nightshade: { name: 'เงาราตรี', up: 'ดาเมจ +30% ตอนกลางคืน', down: 'ดาเมจ −20% ตอนกลางวัน', hit: (r, e, p, G) => (night(G) ? 1.3 : 0.8) },
    glass: { name: 'แก้วเปราะ', up: 'ดาเมจ +35%', down: 'รับดาเมจ +25%', mods: { taken: -25 }, hit: () => 1.35 },
    fireheart: { name: 'หัวใจไฟ', up: 'ดาเมจธาตุไฟ +40%', down: 'รับดาเมจ +15%', mods: { el_fire: 40, taken: -15 } },
    coldblood: { name: 'เลือดเย็น', up: 'คูลดาวน์สกิล −20%', down: 'SP ฟื้นช้าลง 50%', mods: { cdr: 20, spReg: -50 } },
    lastbreath: { name: 'ลมหายใจสุดท้าย', up: 'HP ยิ่งต่ำยิ่งแรง (ต่ำกว่า 30% ดาเมจ ×2)', down: 'การฟื้น HP ได้ผลครึ่งเดียว', mods: { heal: -50 },
      hit: (r, e, p) => 1 + Math.max(0, Math.min(1, (1 - p.hp / Math.max(1, p.maxHp)) / 0.7)) },
    biggame: { name: 'นักล่าตัวใหญ่', up: 'ดาเมจใส่บอสและมอนตัวใหญ่ +30%', down: 'ดาเมจใส่มอนตัวเล็ก −15%', hit: (r, e) => (NC.isBigMon && NC.isBigMon(e) ? 1.3 : NC.isSmallMon && NC.isSmallMon(e) ? 0.85 : 1) },
    hollowbone: { name: 'กระดูกกลวง', up: 'ความเร็วโจมตี +20%', down: 'รับดาเมจ +20%', mods: { aspd: 20, taken: -20 } },
    deeproot: { name: 'รากลึก', up: 'ยืนนิ่ง 2 วิ แล้วดาเมจ +40%', down: 'เดินช้าลง 15%', mods: { spd: -15 }, hit: (r, e, p) => ((p._blStill || 0) >= 2 ? 1.4 : 1) },
    frenzy: { name: 'คลั่งไล่ล่า', up: 'ฆ่าทุก 5 ตัว ATK +8% (ซ้อน 5 ชั้น)', down: 'ชั้นหายหมดเมื่อ HP ต่ำกว่าครึ่ง', modsFn: (p) => ({ atk: 8 * Math.min(5, Math.floor((p._blKills || 0) / 5)) }) },
    skillweave: { name: 'ตาข่ายเงา', up: 'ดาเมจสกิล +25%', down: 'ATK −15%', mods: { skill: 25, atk: -15 } },
    wisp: { name: 'ดวงไฟหลอน', up: 'ตี 15% มีดวงไฟผีตามตีอีก 80%', down: 'ดวงไฟออกทุกครั้ง เสีย SP 5',
      hit(r, e, p) { if (Math.random() < 0.15 && p.sp >= 5) { p.sp -= 5; if (NC.VFX && NC.VFX.sparks) NC.VFX.sparks(e.x, e.y - 40, 10, '150,240,230', { size: 0.7 }); return 1.8; } return 1; } },
    sacrifice: { name: 'สังเวย', up: 'SP ไม่พอ ร่ายด้วย HP แทนได้ (1 SP = 2 HP)', down: 'ยาฟื้น SP ไม่มีผล' },
    thirdeye: { name: 'เงาสะท้อน', up: 'หลบสมบูรณ์ +12', down: 'HP สูงสุด −15%', mods: { pdodge: 12, hpPct: -15 } },
    bark: { name: 'เปลือกรากไม้', up: 'รับดาเมจ −20%', down: 'ความเร็วโจมตี −15%', mods: { taken: 20, aspd: -15 } },
    onemind: { name: 'ใจเดียว', up: 'ตีปกติ (ไม่ใช่สกิล) +30%', down: 'ดาเมจสกิล −15%', mods: { skill: -15 }, hit: (r, e, p, G, o) => (o && o.skill ? 1 : 1.3) },
    shadowfoot: { name: 'เงาตามตัว', up: 'FLEE +25', down: 'รับดาเมจ +15% ตอนกลางวัน', modsAt: (n) => (n ? { flee: 25 } : { flee: 25, taken: -15 }) },
  };
  const TKEYS = Object.keys(TRAITS);
  const SLOTS = ['weapon', 'shield', 'hat', 'top', 'pants', 'robe', 'cape', 'acc1', 'acc2'];
  function wornTraits(p) {
    const out = new Set();
    if (!NC.GEAR || !p || !p.equip) return out;
    for (const k of SLOTS) { const c = p.equip[k] && NC.GEAR.wornIn(p, k); if (c && c.taint && TRAITS[c.taint]) out.add(c.taint); }
    return out;
  }
  let tCache = { key: '', set: new Set() };
  const traitsOf = (p) => {
    const key = SLOTS.map((k) => { const c = p.equip && p.equip[k] && NC.GEAR && NC.GEAR.wornIn(p, k); return c ? c.u + ':' + (c.taint || '') : ''; }).join('|');
    if (key !== tCache.key) tCache = { key, set: wornTraits(p) };
    return tCache.set;
  };
  NC.skillModSources.push((p) => {
    if (!p || p.kind !== 'player') return null;
    const T = traitsOf(p);
    if (!T.size) return null;
    const m = {}, n = night(NC.game);
    const add = (o) => { for (const k in o) m[k] = (m[k] || 0) + o[k]; };
    for (const k of T) { const t = TRAITS[k]; if (t.mods) add(t.mods); if (t.modsAt) add(t.modsAt(n)); if (t.modsFn) add(t.modsFn(p)); }
    return m;
  });
  // damage on every hit: the traits' factors, ammo spent
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHit(d, e, o), G = NC.game, p = G && G.player;
    if (!p || p.kind !== 'player' || d !== p.d || !e || !(r.dmg > 0)) return r;
    if (ammoOn(p)) spendShot(G);
    const T = traitsOf(p);
    if (!T.size) return r;
    let k = 1;
    for (const id of T) if (TRAITS[id].hit) k *= TRAITS[id].hit(r, e, p, G, o);
    if (k !== 1) r.dmg = Math.max(1, Math.round(r.dmg * k));
    return r;
  };
  // kills (คลั่งไล่ล่า), standing still (รากลึก), the day/night switch, the per-frame traits
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const was = e.hp;
    baseDamage(game, e, r, kx, ky, o);
    const p = game.player;
    if (was > 0 && e.hp <= 0 && game.time - (e._heroT || -9) < 1 && traitsOf(p).has('frenzy')) {
      const before = Math.floor((p._blKills || 0) / 5);
      p._blKills = Math.min(25, (p._blKills || 0) + 1);
      if (Math.floor(p._blKills / 5) !== before) NC.applyGear(game);
    }
  };
  let wasNight = null;
  NC.skillTicks.push((game, p, dt) => {
    const T = traitsOf(p);
    p._blStill = p.moving ? 0 : (p._blStill || 0) + dt;
    const n = night(game);
    if (n !== wasNight) { wasNight = n; if (T.size) NC.applyGear(game); }
    if (!T.size) return;
    if (T.has('frenzy') && p._blKills && p.hp < p.maxHp * 0.5) { p._blKills = 0; NC.applyGear(game); }
    for (const id of T) if (TRAITS[id].tick) TRAITS[id].tick(game, p, dt);
  });
  // drops: 1 gear copy in 50 comes tainted
  const TAINT_RATE = 1 / 50;
  const rollTrait = (not) => { let k; do k = TKEYS[Math.floor(Math.random() * TKEYS.length)]; while (k === not && TKEYS.length > 1); return k; };
  NC.lootHeard.push((game, e, id, copy) => {
    if (!copy || copy.taint || Math.random() >= TAINT_RATE) return;
    copy.taint = rollTrait();
    if (game.loot) { const l = game.loot.find((x) => x.inst === copy); if (l) l.rare = true; }
    NC.HUD.log(`ของแปดเปื้อน! ${ITEMS[id] ? ITEMS[id].name : id} · ${TRAITS[copy.taint].name}`, 'item');
  });
  function taintCopy(game, c, k) { c.taint = k; delete c._fx; tCache.key = ''; NC.applyGear(game); NC.saveGame(game); }

  // ---------------- showing a taint: the copy's rows, the bag badge ----------------
  const traitLine = (k) => { const t = TRAITS[k]; return t ? `<span class="gb-opt bl-taint">☾ แปดเปื้อน · ${esc(t.name)}: <i class="bl-up">+ ${esc(t.up)}</i> <i class="bl-down">− ${esc(t.down)}</i></span>` : ''; };
  const baseRows = NC.rowsHtml;
  NC.rowsHtml = (c, empty) => (c && c.taint ? traitLine(c.taint) : '') + baseRows(c, empty);
  const baseBadge = NC.invBadge;
  NC.invBadge = function (p, en) {
    let h = baseBadge(p, en);
    if (en.kind === 'item' && NC.GEAR && (en.copy ? [en.copy] : NC.GEAR.copies(p, en.id)).some((c) => c.taint)) h += '<i class="bl-badge" title="แปดเปื้อน">☾</i>';
    return h;
  };

  // ---------------- the bag: use an oil, load ammo ----------------
  (NC.matCardExtras = NC.matCardExtras || []).push((p, en) => {
    const oil = ELS.find((el) => en.id === OIL[el]), am = ELS.find((el) => en.id === AMMO[el]);
    if (oil) return `<div class="iv-acts"><button class="iv-btn blue" data-act="bl:oil:${oil}">ทาน้ำมัน</button></div>`;
    if (am) return `<div class="iv-lines"><div class="fx">${ST.el === am ? `ใส่อยู่ เหลือ ${ST.shots} นัด` : ST.el ? `ตอนนี้ใส่กระสุนธาตุ${ELTH(ST.el)}` : 'ยังไม่ได้ใส่กระสุน'}</div></div>` +
      `<div class="iv-acts"><button class="iv-btn blue" data-act="bl:ammo:${am}">ใส่กระสุน</button>${ST.el ? '<button class="iv-btn dark" data-act="bl:unload">ถอดกระสุน</button>' : ''}</div>`;
    return '';
  });
  if (NC.invActs) NC.invActs.push((game, a, en) => {
    if (!en || en.kind !== 'mat') return false;
    let m = /^bl:oil:(\w+)$/.exec(a || '');
    if (!m && a === 'main') { const el = ELS.find((x) => en.id === OIL[x]); if (el) m = [0, el]; }
    if (m) { useOil(game, m[1]); return true; }
    let q = /^bl:ammo:(\w+)$/.exec(a || '');
    if (!q && a === 'main') { const el = ELS.find((x) => en.id === AMMO[x]); if (el) q = [0, el]; }
    if (q) { loadAmmo(game, q[1]); return true; }
    if (a === 'bl:unload') { unloadAmmo(game); return true; }
    return false;
  });
  // the loaded ammo on the HUD, beside the buffs
  const baseBuffs = NC.HUD.renderBuffs.bind(NC.HUD);
  NC.HUD.renderBuffs = function (p) {
    baseBuffs(p);
    const box = document.getElementById('buffs');
    if (!box) return;
    let el = box.querySelector('.buff.bl-ammo');
    if (!ST.el || ST.shots <= 0) { if (el) el.remove(); return; }
    if (!el || el.dataset.el !== ST.el) {
      if (el) el.remove();
      el = document.createElement('div');
      el.className = 'buff bl-ammo'; el.dataset.el = ST.el;
      el.innerHTML = `<img src="${icon(AMMO[ST.el])}" alt=""><b></b>`;
      box.appendChild(el);
    }
    el.title = `กระสุนธาตุ${ELTH(ST.el)}${rangedW(ITEMS[p.equip.weapon]) ? '' : ' (ใช้กับอาวุธยิงไกลเท่านั้น)'}`;
    el.querySelector('b').textContent = ST.shots;
    el.classList.toggle('ending', ST.shots < 20);
  };

  // ---------------- Papa Moo's tab ----------------
  const RECIPE = { ess: 3, oil: { ess: 5, coins: 300 }, ammo: { ess: 2, coins: 200 }, sap: 10, dew: 10 };
  const SAP_ELS = ['shadow', 'ghost', 'undead'];
  let sec = 'ess', pickU = null;
  const pill = (id, n, ok) => `<span class="${ok ? '' : 'fg-miss'}"><img src="${icon(id)}" alt="">${esc(MAT[id] ? MAT[id].name : id)} ${n}</span>`;
  function myMats(p, els) { return Object.keys(p.mats || {}).filter((id) => has(p, id) > 0 && extractable(id) && (!els || els.includes(matElements()[id]))).sort((a, b) => ELS.indexOf(matElements()[a]) - ELS.indexOf(matElements()[b]) || (MAT[a].price || 0) - (MAT[b].price || 0)); }
  const sumOf = (p, ids) => ids.reduce((s, id) => s + has(p, id), 0);
  // take n pieces from a group of materials, the cheapest first
  function takeFrom(p, ids, n) { for (const id of ids.slice().sort((a, b) => (MAT[a].price || 0) - (MAT[b].price || 0))) { const k = Math.min(n, has(p, id)); if (k > 0) { take(p, id, k); n -= k; } if (n <= 0) break; } }
  function renderTab(body, game) {
    const p = game.player;
    const tabs = [['ess', 'สกัดแก่นธาตุ'], ['oil', 'น้ำมัน · กระสุน'], ['taint', 'แปดเปื้อน']];
    let h = '<div class="fg-kinds bl-secs">' + tabs.map(([k, t]) => `<button data-blsec="${k}" class="${k === sec ? 'on' : ''}">${t}</button>`).join('') + '</div>';
    if (sec === 'ess') {
      const list = myMats(p);
      h += '<div class="fg-make">' + (list.length ? list.map((id) => {
        const el = matElements()[id], n = has(p, id), ok = n >= RECIPE.ess;
        return `<div class="fg-recipe"><img class="fg-ic" src="${icon(id)}" alt=""><div class="fg-rt"><b>${esc(MAT[id].name)} ×${fmt(n)}</b>` +
          `<small>ธาตุ${ELTH(el)} · ${RECIPE.ess} ชิ้น → แก่นธาตุ${ELTH(el)} 1 ชิ้น</small><div class="fg-need">${pill(ESS[el], has(p, ESS[el]), true)}</div></div>` +
          `<button class="big" data-blext="${id}" ${ok ? '' : 'disabled'}>สกัด</button><button class="big alt" data-blextall="${id}" ${ok ? '' : 'disabled'}>ทั้งหมด</button></div>`;
      }).join('') : '<div class="fg-empty">ยังไม่มีวัตถุดิบของมอนที่สกัดได้ ลองล่ามอนที่มีธาตุ (น้ำ ดิน ไฟ ลม พิษ ศักดิ์สิทธิ์ มืด ผี อมตะ) ก่อนนะ</div>') + '</div>';
      const nsap = sumOf(p, myMats(p, SAP_ELS)), ndew = sumOf(p, myMats(p, ['holy'])), isN = night(game);
      h += '<div class="fg-make">' +
        `<div class="fg-recipe"><img class="fg-ic" src="${icon('bl_dark_sap')}" alt=""><div class="fg-rt"><b>ยางไม้มืด</b><small>วัตถุดิบมอนธาตุมืด / ผี / อมตะ ${RECIPE.sap} ชิ้น · ตอนกลางคืนเท่านั้น${isN ? '' : ' (ตอนนี้กลางวัน)'}</small>` +
        `<div class="fg-need"><span class="${nsap >= RECIPE.sap ? '' : 'fg-miss'}">มีอยู่ ${fmt(nsap)}/${RECIPE.sap}</span>${pill('bl_dark_sap', has(p, 'bl_dark_sap'), true)}</div></div>` +
        `<button class="big" data-blmake="sap" ${nsap >= RECIPE.sap && isN ? '' : 'disabled'}>สกัด</button></div>` +
        `<div class="fg-recipe"><img class="fg-ic" src="${icon('bl_moon_dew')}" alt=""><div class="fg-rt"><b>น้ำค้างจันทร์</b><small>วัตถุดิบมอนธาตุศักดิ์สิทธิ์ ${RECIPE.dew} ชิ้น</small>` +
        `<div class="fg-need"><span class="${ndew >= RECIPE.dew ? '' : 'fg-miss'}">มีอยู่ ${fmt(ndew)}/${RECIPE.dew}</span>${pill('bl_moon_dew', has(p, 'bl_moon_dew'), true)}</div></div>` +
        `<button class="big" data-blmake="dew" ${ndew >= RECIPE.dew ? '' : 'disabled'}>สกัด</button></div></div>`;
      h += '<div class="st-note">ป๋าหมูหริ่งสกัดวัตถุดิบของมอนเป็นแก่นธาตุตามธาตุของมอนตัวนั้น · วัตถุดิบของบอส ผัก ปลา และของหายากสกัดไม่ได้</div>';
    } else if (sec === 'oil') {
      const W = ITEMS[p.equip.weapon], rw = rangedW(W);
      h += '<div class="fg-make">' + ELS.map((el) => {
        const ne = has(p, ESS[el]), okO = ne >= RECIPE.oil.ess && p.coins >= RECIPE.oil.coins, okA = ne >= RECIPE.ammo.ess && p.coins >= RECIPE.ammo.coins;
        return `<div class="fg-recipe"><img class="fg-ic" src="${icon(OIL[el])}" alt=""><div class="fg-rt"><b>ธาตุ${ELTH(el)}</b>` +
          `<small>น้ำมัน: แก่น ${RECIPE.oil.ess} + ${RECIPE.oil.coins} เหรียญ · กระสุน 100 นัด: แก่น ${RECIPE.ammo.ess} + ${RECIPE.ammo.coins} เหรียญ</small>` +
          `<div class="fg-need">${pill(ESS[el], ne, ne >= RECIPE.ammo.ess)}${pill(OIL[el], has(p, OIL[el]), true)}${pill(AMMO[el], has(p, AMMO[el]), true)}</div></div>` +
          `<button class="big" data-bloil="${el}" ${okO ? '' : 'disabled'}>ทำน้ำมัน</button><button class="big alt" data-blammo="${el}" ${okA ? '' : 'disabled'}>ทำกระสุน</button></div>`;
      }).join('') + '</div>' +
        `<div class="st-note">ทาน้ำมันและใส่กระสุนได้จากกระเป๋า (I → อื่นๆ) · น้ำมันเปลี่ยนธาตุของอาวุธ 10 นาที · กระสุนใช้กับอาวุธยิงไกล${rw ? ' (อาวุธที่ถืออยู่ใช้ได้)' : ' (อาวุธที่ถืออยู่ไม่ใช่อาวุธยิงไกล)'}` +
        `${ST.el ? ` · ตอนนี้ใส่กระสุนธาตุ${ELTH(ST.el)} เหลือ ${ST.shots} นัด` : ''}</div>`;
    } else {
      const list = NC.GEAR ? NC.GEAR.bag(p).filter((c) => ITEMS[c.id]) : [];
      if (!list.some((c) => c.u === pickU)) pickU = list.length ? (list.find((c) => c.taint) || list[0]).u : null;
      const c = list.find((x) => x.u === pickU);
      h += '<div class="fg-wrap"><div class="fg-list">' + (list.length ? list.map((x) => `<button class="fg-copy${x.u === pickU ? ' sel' : ''}" data-blpick="${x.u}">` +
        `<img src="${NC.itemIcon ? (() => { try { return NC.itemIcon(x.id, 96).toDataURL(); } catch (e) { return ''; } })() : ''}" alt=""><span><b style="color:${NC.RARITY[ITEMS[x.id].rarity].color}">${esc(NC.copyName(x))}</b>` +
        `<small>${x.taint ? '☾ ' + esc(TRAITS[x.taint].name) : 'ไม่แปดเปื้อน'}</small></span></button>`).join('') : '<div class="fg-empty">ยังไม่มีของสวมใส่</div>') + '</div>';
      if (c) {
        h += `<div class="fg-side"><div class="fg-head"><b>${esc(NC.copyName(c))}</b></div>` +
          (c.taint ? `<div class="fg-rows">${traitLine(c.taint)}</div>` : '<div class="fg-rows"><div class="fg-row fg-hole">— ไม่แปดเปื้อน —</div></div>') +
          `<div class="fg-act"><b>ราดยางไม้มืด</b><span>ยางไม้มืด 1 ขวด · สุ่มรอยแปดเปื้อน 1 อย่าง (แทนรอยเดิม) · ของไม่แตก</span>` +
          `<button class="big" id="bl-sap" ${has(p, 'bl_dark_sap') > 0 ? '' : 'disabled'}>ราดยางไม้มืด (มี ${has(p, 'bl_dark_sap')})</button></div>` +
          `<div class="fg-act"><b>ล้างด้วยน้ำค้างจันทร์</b><span>น้ำค้างจันทร์ 1 ขวด · ล้างรอยออก</span>` +
          `<button class="big" id="bl-dew" ${c.taint && has(p, 'bl_moon_dew') > 0 ? '' : 'disabled'}>ล้างรอย (มี ${has(p, 'bl_moon_dew')})</button></div></div>`;
      }
      h += '</div><div class="st-note">รอยแปดเปื้อนให้พลังแรงแลกข้อเสีย ใส่หลายชิ้นได้หลายรอย (รอยเดียวกันนับครั้งเดียว) · ของที่ดรอปมีโอกาส 1 ใน 50 ออกมาแปดเปื้อนอยู่แล้ว</div>';
    }
    body.innerHTML = h;
  }
  function clickTab(t, game) {
    const p = game.player, D = t.dataset;
    if (D.blsec) { sec = D.blsec; return true; }
    if (D.blpick) { pickU = Number(D.blpick); return true; }
    if (D.blext || D.blextall) {
      const id = D.blext || D.blextall, el = matElements()[id], times = D.blextall ? Math.floor(has(p, id) / RECIPE.ess) : 1;
      if (times <= 0) return true;
      take(p, id, times * RECIPE.ess); give(game, ESS[el], times);
      game.toast(`สกัดได้แก่นธาตุ${ELTH(el)} ×${times}`); NC.saveTrade(game); return true;
    }
    if (D.blmake === 'sap' || D.blmake === 'dew') {
      const els = D.blmake === 'sap' ? SAP_ELS : ['holy'], ids = myMats(p, els), n = D.blmake === 'sap' ? RECIPE.sap : RECIPE.dew;
      if (sumOf(p, ids) < n || (D.blmake === 'sap' && !night(game))) return true;
      takeFrom(p, ids, n); give(game, D.blmake === 'sap' ? 'bl_dark_sap' : 'bl_moon_dew', 1);
      game.toast(D.blmake === 'sap' ? 'ได้ยางไม้มืด 1 ขวด' : 'ได้น้ำค้างจันทร์ 1 ขวด'); NC.saveTrade(game); return true;
    }
    if (D.bloil || D.blammo) {
      const el = D.bloil || D.blammo, R = D.bloil ? RECIPE.oil : RECIPE.ammo;
      if (has(p, ESS[el]) < R.ess || p.coins < R.coins) return true;
      take(p, ESS[el], R.ess); p.coins -= R.coins; if (NC.Econ && NC.Econ.sink) NC.Econ.sink('buildloot', R.coins);
      give(game, D.bloil ? OIL[el] : AMMO[el], 1);
      game.toast(D.bloil ? `ได้น้ำมันเคลือบ${ELTH(el)} 1 ขวด` : `ได้ซองกระสุนธาตุ${ELTH(el)} (100 นัด)`); NC.saveTrade(game); return true;
    }
    if (t.id === 'bl-sap' || t.id === 'bl-dew') {
      const c = NC.GEAR && NC.GEAR.bag(p).find((x) => x.u === pickU);
      if (!c) return true;
      if (t.id === 'bl-sap' && has(p, 'bl_dark_sap') > 0) { take(p, 'bl_dark_sap', 1); taintCopy(game, c, rollTrait(c.taint)); game.toast(`แปดเปื้อน: ${TRAITS[c.taint].name}`); }
      if (t.id === 'bl-dew' && c.taint && has(p, 'bl_moon_dew') > 0) { take(p, 'bl_moon_dew', 1); taintCopy(game, c, undefined); delete c.taint; game.toast('ล้างรอยแปดเปื้อนแล้ว'); }
      NC.saveTrade(game); return true;
    }
    return false;
  }
  (NC.FORGE_TABS = NC.FORGE_TABS || []).push({ key: 'bl', label: 'ธาตุ · แปดเปื้อน', render: renderTab, click: clickTab });

  // ---------------- saving: the loaded ammo ----------------
  const KEY = 'nightcamp.buildloot.v1';
  function save(game) {
    if (game.noSave) return;
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    s.ammo = { el: ST.el, shots: ST.shots };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ }
  }
  NC.BL_SAVE_KEY = KEY;
  (NC.saveHooks || (NC.saveHooks = [])).push((game) => save(game));
  (NC.loadHooks || (NC.loadHooks = [])).push((game, prm) => {
    ST.el = null; ST.shots = 0;
    if (!NC.ONLINE) try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s && s.ammo && ELS.includes(s.ammo.el)) { ST.el = s.ammo.el; ST.shots = Math.max(0, s.ammo.shots | 0); } } catch (e) { /* none */ }
  });

  NC.BL = Object.assign(NC.BL || {}, { ELS, ELTH, TRAITS, ESS, OIL, AMMO, ammo: ST, matElements, extractable, traitsOf, rollTrait,
    taintCopy: (c, k) => taintCopy(NC.game, c, k || rollTrait()), useOil: (el) => useOil(NC.game, el), loadAmmo: (el) => loadAmmo(NC.game, el), icon, has, take, give, night });
})();
