/* life.js — อาชีพเสริม (life skills), the core shared by ตัดไม้ (js/life_wood.js), ขุดแร่ (js/life_mine.js) and
   ปลูกผัก (js/life_farm.js). The plan: the Artifact "อาชีพเสริม Night Camp" (2026-09-29).
     levels     each life skill has its own Lv 1–30 (NC.Life.lv / addXp), perks every 5 levels
     tools      axe / pickaxe / watering can in 4 tiers (+ the hoe), kept in a tool pouch, never in a weapon slot;
                the hero holds the tool only while working (the weapon comes back after)
     materials  logs, ores, gems, crops and seeds are NC.MATERIALS (the pouch, the merchant buys them); they pop out
                of the tree / vein / plot like monster drops (game.loot) and fly to the hero
     working    B next to a node, or a click on it: the hero stops, faces it and strikes with B / Space / J / a click;
                moving walks away. Each node kind brings its own timing game (a ring round the trunk, a glint on the
                rock); a strike on time counts double
     window     H: levels, tools, perks, where to go, what has been found (js/lifebook.js)
     mentors    ลุงบีเวอร์ฟันเก (axes), ตุ่นหัวไฟ (pickaxes), ยายกระต่าย (seeds, plots, cans): NPCs in the camp
   Saved under its own key (nightcamp.life.v1). Art: assets/life/ (tools/life_art.py from assets/gen/make_life_prompts.py). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  if (NC.ASSET_MANIFEST_LIFE) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_LIFE);
  const MAT = NC.MATERIALS;

  // ---------------- the life skills, their levels and perks ----------------
  const MAXLV = 30;
  const SKILLS = {
    wood: { name: 'ตัดไม้', tool: 'axe', icon: 't_axe1', rgb: '214,160,90',
      perks: [[5, 'รอยขวานกว้างขึ้น'], [10, 'ได้ไม้เพิ่มบ่อยขึ้น'], [15, 'ต้นไม้ล้มเร็วขึ้น'], [20, 'ของแถมหายากออกบ่อยขึ้น'],
        [25, 'ไม้จันทร์ออกบ่อยขึ้น'], [30, 'ปรมาจารย์: ฟันเข้าเนื้อได้ไม้เพิ่มทุกครั้ง']] },
    mine: { name: 'ขุดแร่', tool: 'pick', icon: 't_pick1', rgb: '150,170,220',
      perks: [[5, 'ประกายค้างนานขึ้น'], [10, 'ได้แร่เพิ่มบ่อยขึ้น'], [15, 'เคาะเสียงเบาลง 30%'], [20, 'เจออัญมณีบ่อยขึ้น'],
        [25, 'แร่ดาวตกออกบ่อยขึ้น'], [30, 'ปรมาจารย์: เคาะตรงประกายแทบไม่มีเสียง']] },
    farm: { name: 'ปลูกผัก', tool: 'can', icon: 't_can1', rgb: '120,200,110',
      perks: [[5, 'ผักโตเร็วขึ้น 10%'], [10, 'เก็บเกี่ยวได้เพิ่มบ่อยขึ้น'], [15, 'ได้เมล็ดคืนบ่อยขึ้น'], [20, 'ผักโตเร็วขึ้นอีก 10%'],
        [25, 'อีกาไม่กล้าเข้าใกล้'], [30, 'ปรมาจารย์: ผักทุกแปลงได้ดาวเพิ่ม 1']] },
  };
  const RANKS = [[30, 'ปรมาจารย์'], [20, 'เชี่ยวชาญ'], [10, 'ชำนาญ'], [1, 'มือใหม่']];
  const rankOf = (lv) => RANKS.find((r) => lv >= r[0])[1];
  const xpNeed = (lv) => Math.round(12 * Math.pow(lv, 1.8)); // Lv → Lv+1

  // ---------------- tools ----------------
  const TOOLS = {
    axe: { skill: 'wood', names: ['ขวานตัดไม้เหล็ก', 'ขวานเหล็กกล้า', 'ขวานเงินจันทร์', 'ขวานดาวตก'], sprite: (t) => 't_axe' + t, mentor: 'ลุงบีเวอร์ฟันเก' },
    pick: { skill: 'mine', names: ['อีเต้อเหล็ก', 'อีเต้อเหล็กกล้า', 'อีเต้อเงินจันทร์', 'อีเต้อดาวตก'], sprite: (t) => 't_pick' + t, mentor: 'ตุ่นหัวไฟ' },
    can: { skill: 'farm', names: ['บัวรดน้ำสังกะสี', 'บัวรดน้ำทองแดง', 'บัวรดน้ำเงินจันทร์', 'บัวรดน้ำดาวตก'], sprite: (t) => 't_can' + t, mentor: 'ยายกระต่าย' },
  };
  // what the next tier costs (tier 2, 3, 4): life Lv, coins, materials
  const UPGRADES = {
    axe: [{ lv: 8, coins: 1000, mats: { lf_oak: 12, lf_iron: 6 } }, { lv: 16, coins: 10000, mats: { lf_pine: 15, lf_moonsilver: 6, lf_moonwood: 3 } },
      { lv: 24, coins: 60000, mats: { lf_silverwood: 12, lf_starore: 4, lf_moonwood: 8 } }],
    pick: [{ lv: 8, coins: 1000, mats: { lf_stone: 15, lf_iron: 10 } }, { lv: 16, coins: 10000, mats: { lf_silver: 8, lf_moonsilver: 6, lf_willow: 6 } },
      { lv: 24, coins: 60000, mats: { lf_obsidian: 10, lf_starore: 4, lf_silverwood: 6 } }],
    can: [{ lv: 8, coins: 800, mats: { lf_copper: 8, lf_stone: 10 } }, { lv: 16, coins: 8000, mats: { lf_moonsilver: 5, lf_moonflower: 5, lf_willow: 5 } },
      { lv: 24, coins: 50000, mats: { lf_starore: 3, lf_silverwood: 6, lf_pumpkin: 10 } }],
  };

  // ---------------- materials (the pouch; the merchant buys them) ----------------
  const MATS = {
    // wood
    lf_birch: ['ไม้เบิร์ช', 6, 'ท่อนไม้เปลือกขาวลายดำ เบาและตรง จากทุ่งหญ้าแสงจันทร์'],
    lf_oak: ['ไม้โอ๊ก', 8, 'ไม้เนื้อแข็งสีน้ำตาลอ่อน ทำด้ามเครื่องมือได้ดี'],
    lf_pine: ['ไม้สน', 12, 'ไม้สนหอมกลิ่นยาง มียางสีทองซึมออกมา'],
    lf_willow: ['ไม้หลิว', 18, 'ไม้หลิวริมน้ำ เหนียวและโค้งงอได้ดี'],
    lf_charcoal: ['ถ่าน', 24, 'ถ่านจากต้นไม้ที่ไหม้ ยังคุแดงอยู่นิด ๆ เชื้อเพลิงชั้นดี'],
    lf_acacia: ['ไม้อะคาเซีย', 30, 'ไม้สีส้มแดงจากผาหินแดง ทนแดดทนลม'],
    lf_silverwood: ['ไม้เงิน', 45, 'ไม้เปลือกเงินจากทะเลสาบหมอกเงา เนื้อไม้เป็นประกายมุก'],
    lf_ancient: ['ไม้โบราณ', 70, 'ไม้จากต้นไม้ยักษ์ยุคดึกดำบรรพ์ วงปีถี่นับไม่ถ้วน'],
    lf_moonwood: ['ไม้จันทร์', 90, 'ไม้เปลือกเงินอมฟ้าจากต้นไม้แสงจันทร์ ออกเฉพาะกลางคืน', true],
    lf_apple: ['แอปเปิล', 5, 'แอปเปิลแดงสด หล่นลงมาตอนต้นไม้ล้ม'],
    lf_pear: ['สาลี่', 6, 'สาลี่ฉ่ำหวานจากสวนสาลี่ในไร่ฟักทอง'],
    lf_nest: ['รังนก', 15, 'รังนกกิ่งไม้กับไข่สีฟ้าลายจุดสองฟอง'],
    lf_sap: ['ยางไม้', 20, 'ยางไม้สีทองข้นหนืดในขวดโหล'],
    lf_amber: ['อำพัน', 60, 'อำพันใสสีทองส้ม มีใบไม้จิ๋วติดอยู่ข้างใน'],
    // ores and gems
    lf_stone: ['หิน', 2, 'ก้อนหินธรรมดา ใช้ทำฐานเครื่องมือ'],
    lf_copper: ['แร่ทองแดง', 10, 'ก้อนทองแดงสีส้มเงา มีคราบเขียวนิด ๆ'],
    lf_quartz: ['ควอตซ์', 14, 'ผลึกควอตซ์สีชมพูขาวจากถ้ำค้างคาว'],
    lf_iron: ['แร่เหล็ก', 18, 'ก้อนแร่เหล็กสีสนิม หนักมือ'],
    lf_silver: ['แร่เงิน', 30, 'แร่เงินเป็นประกายจากเหมืองมดชั้นลึก'],
    lf_moonsilver: ['เงินจันทร์', 45, 'แร่เงินเรืองแสงสีฟ้าเป็นรูปจันทร์เสี้ยว จากสุสานใต้ดิน'],
    lf_soul: ['ผลึกวิญญาณ', 50, 'ผลึกสีม่วงอมเขียวที่มีควันวิญญาณวนอยู่'],
    lf_orange: ['ผลึกส้ม', 55, 'ผลึกสีส้มอุ่นมือ จากเหมืองร้างในผาหินแดง'],
    lf_obsidian: ['ออบซิเดียน', 70, 'แก้วภูเขาไฟสีดำคมกริบ ขอบยังเรืองส้ม'],
    lf_fireore: ['แร่เพลิง', 85, 'แร่สีแดงที่ข้างในลุกโชนเหมือนมีไฟ'],
    lf_starore: ['แร่ดาวตก', 200, 'หินสีครามที่มีผลึกรูปดาวสีทองฝังอยู่ หายากมาก', true],
    lf_ruby: ['ทับทิม', 300, 'อัญมณีสีแดงสด เจอตอนเคาะแร่ได้จังหวะ', true],
    lf_sapphire: ['ไพลิน', 300, 'อัญมณีสีน้ำเงินเข้ม เจอตอนเคาะแร่ได้จังหวะ', true],
    lf_emerald: ['มรกต', 300, 'อัญมณีสีเขียว เจอตอนเคาะแร่ได้จังหวะ', true],
    lf_topaz: ['บุษราคัม', 250, 'อัญมณีสีเหลืองทอง เจอตอนเคาะแร่ได้จังหวะ', true],
    lf_amethyst: ['อเมทิสต์', 250, 'อัญมณีสีม่วง เจอตอนเคาะแร่ได้จังหวะ', true],
    // crops and seeds
    lf_carrot: ['แครอท', 8, 'แครอทสดกรอบจากแปลงข้างค่าย'],
    lf_potato: ['มันฝรั่ง', 12, 'มันฝรั่งหัวอวบสีทอง'],
    lf_wheat: ['ข้าวสาลี', 16, 'ฟ่อนข้าวสาลีสีทองมัดด้วยเชือก'],
    lf_herb: ['สมุนไพรฮีล', 22, 'ใบรูปหัวใจกับดอกแดงเรืองแสง กลิ่นหอมสดชื่น'],
    lf_pumpkin: ['ฟักทอง', 34, 'ฟักทองลูกกลมสีส้มสด'],
    lf_moonflower: ['ดอกจันทร์', 60, 'ดอกไม้ที่บานเฉพาะกลางคืน เรืองแสงสีขาวอมฟ้า'],
    sd_carrot: ['เมล็ดแครอท', 2, 'ถุงเมล็ดแครอท ปลูกที่แปลงผักข้างค่าย'],
    sd_potato: ['หัวพันธุ์มันฝรั่ง', 3, 'ถุงหัวพันธุ์มันฝรั่ง ปลูกที่แปลงผักข้างค่าย'],
    sd_wheat: ['เมล็ดข้าวสาลี', 4, 'ถุงเมล็ดข้าวสาลี ปลูกที่แปลงผักข้างค่าย'],
    sd_herb: ['เมล็ดสมุนไพรฮีล', 6, 'ถุงเมล็ดสมุนไพรฮีล ปลูกที่แปลงผักข้างค่าย'],
    sd_pumpkin: ['เมล็ดฟักทอง', 10, 'ถุงเมล็ดฟักทอง ปลูกที่แปลงผักข้างค่าย'],
    sd_moonflower: ['เมล็ดดอกจันทร์', 18, 'ถุงผ้าลายดาวใส่เมล็ดดอกจันทร์ บานเฉพาะกลางคืน'],
  };
  for (const id in MATS) {
    const [name, price, desc, rare] = MATS[id];
    MAT[id] = { name, price, desc, life: true };
    if (rare) MAT[id].rare = true;
    if (id.startsWith('sd_')) MAT[id].keep = true; // (the merchant's "sell all" leaves the seeds)
  }
  const lifeIcon = (id) => ((NC.ASSET_MANIFEST_LIFE || {})[id] || {}).src || '';
  const baseIcon = NC.matIcon;
  NC.matIcon = (id) => lifeIcon(id) || baseIcon(id);
  const SOURCE = {}; // id -> where it comes from (the pouch tells); the skill files fill it
  const baseSource = NC.matSource;
  NC.matSource = (id) => SOURCE[id] || baseSource(id);

  // ---------------- the player's life record ----------------
  const KEY = 'nightcamp.life.v1';
  function blank() {
    const r = { tools: { axe: 1, pick: 1, can: 1 } };
    for (const s in SKILLS) r[s] = { lv: 1, xp: 0 };
    return r;
  }
  const rec = (p) => p.life || (p.life = blank());
  const lvOf = (p, s) => rec(p)[s].lv;
  const toolTier = (p, t) => rec(p).tools[t] || 1;

  function addXp(game, s, n) {
    const p = game.player, r = rec(p)[s];
    if (r.lv >= MAXLV || !(n > 0)) return;
    r.xp += Math.round(n);
    let up = false;
    while (r.lv < MAXLV && r.xp >= xpNeed(r.lv)) { r.xp -= xpNeed(r.lv); r.lv++; up = true; }
    if (r.lv >= MAXLV) r.xp = 0;
    if (up) {
      const S = SKILLS[s], perk = S.perks.find((k) => k[0] === r.lv);
      game.toast(`${S.name} Lv ${r.lv}!${perk ? ' · ' + perk[1] : ''}`);
      NC.HUD.log(`${S.name} ขึ้นเป็น Lv ${r.lv} (${rankOf(r.lv)})`, 'item');
      FX.stars(p.x, p.y - 90, 18, S.rgb, { speed: 260 });
      FX.ring(p.x, p.y, 20, 170, S.rgb, 0.6, 8);
    }
    FX.text(p.x + 40, p.y - 150, `+${Math.round(n)} ${SKILLS[s].name}`, 'rgb(' + SKILLS[s].rgb + ')', 17);
    save(game);
    refreshWindow();
  }

  function save(game) {
    const p = game.player;
    if (game.noSave || !p || !p.life) return;
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign({ v: 1 }, p.life))); } catch (e) { /* storage blocked */ }
  }
  (NC.saveHooks || (NC.saveHooks = [])).push((game) => save(game));
  (NC.loadHooks || (NC.loadHooks = [])).push((game, params) => {
    const p = game.player, r = (p.life = blank());
    let s = null;
    if (!NC.ONLINE) { try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; } }
    if (s) {
      for (const k in SKILLS) if (s[k]) { r[k].lv = Math.max(1, Math.min(MAXLV, s[k].lv | 0)); r[k].xp = Math.max(0, s[k].xp | 0); }
      for (const t in TOOLS) if (s.tools && s.tools[t]) r.tools[t] = Math.max(1, Math.min(4, s.tools[t] | 0));
      for (const k in s) if (!(k in r) && k !== 'v') r[k] = s[k]; // (the skill files keep their own parts: the garden)
    }
    for (const f of L.onLoad) f(game, p, s, params);
  });

  // ---------------- drops: pop out of the node like a monster's drop, then fly to the hero ----------------
  function drop(game, id, n, x, y, o) {
    if (!MAT[id] || !(n > 0)) return;
    const spread = (o && o.spread) || 50;
    for (let i = 0; i < n; i++) {
      game.loot.push({ kind: 'loot', mat: id, x: x + NC.rand(-spread, spread), y: y + NC.rand(-spread * 0.35, spread * 0.35), sort: y, t: 0,
        z: (o && o.z) || 20, vz: NC.rand(380, 540), spin: NC.rand(0, 6) });
    }
    if (MAT[id].rare) { FX.stars(x, y - 60, 16, '255,220,120', { speed: 280 }); FX.ring(x, y, 20, 180, '255,220,120', 0.6, 9); }
  }
  const roll = (p) => Math.random() < p;

  const L = (NC.Life = {
    SKILLS, TOOLS, UPGRADES, MAXLV, SOURCE, xpNeed, rankOf, rec, lvOf, toolTier, addXp, save, drop, roll, lifeIcon,
    onLoad: [], // (game, p, saved, params) after the record is loaded
    finders: [], // (game) => the nodes of the map the hero is on (see "working" below)
    GUIDE: { wood: [], mine: [], farm: [] }, // the window's "where to go" rows: { mat, name, lv, tier, where, night }
    mentors: [], // the camp's teachers (below)
  });
  function refreshWindow() { if (L.refresh) L.refresh(); }

  // ---------------- the tools as things the hero can hold (NC.ITEMS, never in the bag or the loot) ----------------
  const ITEMS = NC.ITEMS, K = NC.SkillKit, V = NC.VFX, Anim = NC.Anim;
  const HOLD = {
    axe: { style: 'swing', wtype: 'axe', grip: 0.2, restAng: -1.95, stance: -0.95 },
    pick: { style: 'smash', wtype: 'hammer', grip: 0.16, restAng: -1.9, stance: -1.1, twoHanded: true, grip2: 12 },
    can: { style: 'swing', wtype: 'mace', grip: 0.86, restAng: -1.57, stance: -1.57 }, // (hangs from its handle, spout forward)
  };
  const toolItem = (id, name, hold) => (ITEMS[id] = Object.assign({ slot: 'tool', name, sprite: id, rarity: 'common', dmg: [1, 1], cd: 0.5, dur: 0.3,
    hitAt: 0.1, reach: 120, arc: 1.2, aspd: 1, desc: '' }, hold));
  for (const t in TOOLS) for (let i = 1; i <= 4; i++) toolItem(TOOLS[t].sprite(i), TOOLS[t].names[i - 1], HOLD[t]);
  toolItem('t_hoe', 'จอบพรวนดิน', HOLD.pick);
  toolItem('t_none', 'มือเปล่า', { style: 'swing', grip: 0.5, restAng: -1.57, stance: -1.57 }); ITEMS.t_none.sprite = 'lf_none'; // (empty hands: planting, picking)
  // the chop: the axe drawn back over the shoulder, then swung level into the trunk at waist height
  if (Anim && Anim.addClip) Anim.addClip('lfChop', { dur: 0.42, in: 0.05, out: 0.12, keys: {
    // (arm and weapon angles: 0 = straight ahead, negative = raised, positive = lowered)
    aF: [[0.12, -2.5, 'out'], [0.2, 0.45, 'in'], [0.42, 0.6]], eF: [[0.12, 0.6], [0.2, 0.1], [0.42, 0.2]],
    wAng: [[0.12, -2.7, 'out'], [0.2, 0.05, 'in'], [0.3, 0.3], [0.42, 0.1]],
    aB: [[0.12, -0.4], [0.2, 0.3], [0.42, 0.1]], lean: [[0.12, -0.08], [0.2, 0.14], [0.42, 0.06]],
    kF: [[0.12, 0.3], [0.2, 0.5], [0.42, 0.2]], kB: [[0.12, 0.3], [0.42, 0.2]], head: [[0.2, 0.05], [0.42, 0]],
  } });
  // the hero holds a tool only while p.toolShow lasts: the weapon is swapped for the draw and the pose, never kept
  const showTool = (game, p, id, secs) => { p.toolShow = { id, until: secs === Infinity ? Infinity : game.time + secs }; };
  const withTool = (base) => function () {
    const game = NC.game, p = game && game.player, t = p && p.toolShow;
    if (!t || !ITEMS[t.id] || !p.equip || game.time > t.until) return base.apply(this, arguments);
    const w = p.equip.weapon, sh = p.equip.shield;
    p.equip.weapon = t.id; p.equip.shield = null;
    try { return base.apply(this, arguments); } finally { p.equip.weapon = w; p.equip.shield = sh; }
  };
  NC.updateHeroAnim = withTool(NC.updateHeroAnim);
  NC.drawPlayer = withTool(NC.drawPlayer);

  // ---------------- working a node: the hero stops, faces it and strikes on B / Space / J / a click ----------------
  // a node (the skill files make them): { skill, x, y (its foot), hx, hy (where the tool lands), reach, lv, tier, hp,
  //   left, game: 'ring' | 'glint' | null, name, verb, box: [x0, y0, x1, y1] (for clicks), ok() (still there),
  //   hit(game, p, node, perfect), done(game, p, node), use(game, p, node) (instant work: the garden) }
  const CLIPS = { wood: ['lfChop', 0.2], mine: ['smash1', 0.232] };
  const STRIKE_CD = 0.46;
  function nodesHere(game) { const out = []; for (const f of L.finders) { const a = f(game); if (a) for (const n of a) out.push(n); } return out; }
  function nearest(game, p) {
    let best = null, bd = Infinity;
    for (const n of nodesHere(game)) {
      if (n.ok && !n.ok()) continue;
      const d = NC.dist(p.x, p.y, n.x, n.y);
      if (d < (n.reach || 130) && d < bd) { best = n; bd = d; }
    }
    return best;
  }
  function blocked(game, p, n) {
    const S = SKILLS[n.skill];
    if (lvOf(p, n.skill) < (n.lv || 1)) return `ต้องมี${S.name} Lv ${n.lv}`;
    if (n.tier && toolTier(p, S.tool) < n.tier) return `ต้องใช้${TOOLS[S.tool].names[n.tier - 1]}ขึ้นไป`;
    return '';
  }
  function interact(game, p, n) {
    if (p.dead > 0 || p.sit) return;
    const why = blocked(game, p, n);
    if (why) { FX.text(n.x, (n.hy || n.y - 80) - 60, why, '#ffb0a0', 22); return; }
    // (Discord #175, 2026-10-21: work started over a cast bar took its channel, the cast never ended and every skill was
    // refused after it. Not while a cast fills: online the server's cast goes on and refuses the work too)
    if (p.casting && p.channel && p.channel.cast) { FX.text(p.x, p.y - 170, 'รอร่ายสกิลจบก่อน', '#fff3cf', 20); return; }
    if (p.casting && NC.cancelCast) NC.cancelCast(game, p); // (a cast left without its bar: let go of)
    if (n.use) { n.use(game, p, n); return; }
    begin(game, p, n);
  }
  const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function newGame(p, a) {
    const n = a.node, lv = lvOf(p, n.skill);
    if (n.game === 'ring') {
      a.mg = { kind: 'ring', ang: Math.random() * TAU, spd: TAU * (0.8 + (n.lv || 1) * 0.01), dir: Math.random() < 0.5 ? 1 : -1,
        half: 0.28 + lv * 0.006 + (lv >= 5 ? 0.06 : 0) + a.tier * 0.04 };
      a.mg.notch = a.mg.ang + a.mg.dir * NC.rand(1.7, 3.6);
    } else {
      a.mg = { kind: 'glint', t: 0, per: Math.max(0.8, 1.3 - (n.lv || 1) * 0.012), thr: 0.8 - (lv >= 5 ? 0.06 : 0) - a.tier * 0.025,
        gx: NC.rand(-0.28, 0.28), gy: NC.rand(0.3, 0.72) };
    }
  }
  function begin(game, p, n) {
    const S = SKILLS[n.skill], tier = toolTier(p, S.tool);
    const a = { node: n, skill: n.skill, tool: S.tool, tier, t: 0, cd: 0, queued: false, strikes: 0 };
    if (p.casting && NC.cancelCast) NC.cancelCast(game, p); // (a path that skipped interact: never a cast left without its bar)
    newGame(p, a);
    p.atk.on = false;
    p.lifeAct = a;
    p.channel = { life: true, t: 0, dur: Infinity, update: tick, end: null };
    showTool(game, p, TOOLS[S.tool].sprite(tier), Infinity);
    face(p, n);
    if (n.start) n.start(game, p, n);
  }
  // where the tool lands: the node's own point, or worked out from the hero (a tree: its trunk's edge on his side, at his
  // hands; Discord #181, 2026-10-21: the ring sat at the trunk's foot, away from the axe)
  const landAt = (n, p) => (n.bite && p ? n.bite(p) : [n.hx != null ? n.hx : n.x, n.hy != null ? n.hy : n.y - 60]);
  L.landAt = landAt;
  function face(p, n) {
    const [lx, ly] = landAt(n, p);
    p.aim = NC.angle(p.x, p.y - 50, lx, ly);
    p.face = n.x >= p.x ? 1 : -1;
  }
  function stop(game, p, why) {
    const a = p.lifeAct;
    p.lifeAct = null;
    if (p.channel && p.channel.life) p.channel = null;
    if (a) showTool(game, p, TOOLS[a.tool].sprite(a.tier), 0.35); // (the tool stays in hand a moment, then the weapon)
    if (why) FX.text(p.x, p.y - 170, why, '#fff3cf', 20);
  }
  function tick(game, p, ch, dt) {
    const a = p.lifeAct;
    if (!a) { p.channel = null; return; }
    const n = a.node;
    if (p.dead > 0 || (n.ok && !n.ok()) || NC.dist(p.x, p.y, n.x, n.y) > (n.reach || 130) + 60) return stop(game, p);
    if (game.input.mx || game.input.my) return stop(game, p); // walking away
    p.vx = p.vy = 0; p.moving = p.running = false;
    face(p, n);
    a.t += dt; a.cd -= dt;
    const m = a.mg;
    if (m.kind === 'ring') m.ang += m.spd * m.dir * dt; else m.t += dt;
    if (n.tick) n.tick(game, p, n, dt, a);
    if (a.queued && a.cd <= 0) strike(game, p);
  }
  function judge(a) {
    const m = a.mg;
    if (m.kind === 'ring') return Math.abs(wrapAng(m.ang - m.notch)) < m.half;
    const b = (1 - Math.cos((m.t / m.per) * TAU)) / 2;
    return b > m.thr && m.t > m.per * 0.2;
  }
  function strike(game, p) {
    const a = p.lifeAct;
    if (!a) return;
    if (a.cd > 0) { a.queued = true; return; }
    a.queued = false; a.cd = STRIKE_CD;
    const perfect = judge(a), n = a.node, [clip, at] = CLIPS[a.skill] || CLIPS.wood;
    face(p, n);
    if (Anim.CLIPS[clip]) K.pose(game, p, clip, 0.3);
    V.at(at, () => impact(game, p, a, perfect));
  }
  function impact(game, p, a, perfect) {
    if (p.lifeAct !== a) return;
    const n = a.node, lv = lvOf(p, a.skill);
    a.strikes++;
    const power = (1 + (a.tier - 1) * 0.5) * (1 + lv * 0.01);
    n.left -= perfect ? power * 2 : power;
    if (n.hit) n.hit(game, p, n, perfect, a);
    if (perfect) {
      const [hx, hy] = landAt(n, p);
      FX.text(hx, hy - 50, a.skill === 'wood' ? 'ฟันเข้าเนื้อ!' : 'ตรงประกาย!', '#ffe58f', 24);
      V.sparks(hx, hy, 8, '255,230,140', { min: 200, max: 460, size: 0.8 });
    }
    newGame(p, a);
    if (n.left <= 0) {
      stop(game, p);
      n.done(game, p, n, a);
    }
  }

  // ---------------- keys and clicks (caught before the game's own: B is the pouch, Space / J / a click attack) ----------------
  const typing = () => { const t = document.activeElement; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
  addEventListener('keydown', (e) => {
    const game = NC.game, p = game && game.player;
    if (!p || game.paused || e.repeat || typing() || p.fishAct) return; // (fishing: js/life_fish.js takes the keys)
    if (p.lifeAct) {
      if (e.code === 'KeyB' || e.code === 'Space' || e.code === 'KeyJ') { strike(game, p); e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    if (e.code !== 'KeyB') return;
    // (the nearer of a teacher and a node)
    const m = nearMentor(game, p), n = nearest(game, p);
    const dm = m ? NC.dist(p.x, p.y, m.x, m.y) : Infinity, dn = n ? NC.dist(p.x, p.y, n.x, n.y) : Infinity;
    if (m && dm <= dn) { openMentor(game, m); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (n) { interact(game, p, n); e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  const worldAt = (game, e) => [game.cam.x + (e.clientX * game.dpr) / game.scale, game.cam.y + (e.clientY * game.dpr) / game.scale];
  addEventListener('mousedown', (e) => {
    const game = NC.game, p = game && game.player;
    if (e.button !== 0 || !p || game.paused || e.target !== $('view') || p.fishAct) return;
    if (p.lifeAct) { strike(game, p); e.preventDefault(); e.stopImmediatePropagation(); return; }
    const [wx, wy] = worldAt(game, e);
    const m = L.mentors.find((q) => q.here(game) && Math.abs(wx - q.x) < 60 && wy > q.y - 170 && wy < q.y + 10 && NC.dist(p.x, p.y, q.x, q.y) < 420);
    if (m) { openMentor(game, m); e.preventDefault(); e.stopImmediatePropagation(); return; }
    let hit = null;
    for (const n of nodesHere(game)) {
      if (n.ok && !n.ok()) continue;
      const b = n.box || [n.x - 50, n.y - 100, n.x + 50, n.y + 10];
      if (wx >= b[0] && wx <= b[2] && wy >= b[1] && wy <= b[3] && NC.dist(p.x, p.y, n.x, n.y) < (n.reach || 130) + 40) { hit = n; break; }
    }
    if (hit) { interact(game, p, hit); e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // ---------------- drawn over the world (after the night light): the prompt and the timing games ----------------
  const P = NC.Party;
  function drawRing(ctx, game, a) {
    const n = a.node, m = a.mg, [x, y] = landAt(n, game.player), k = n.ringK || 1, rx = 62 * k, ry = 26 * k;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(30,24,44,0.75)'; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,243,207,0.35)'; ctx.stroke();
    // the notch (the axe mark): glowing gold
    const pulse = 0.75 + 0.25 * Math.sin(game.time * 10);
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, m.notch - m.half, m.notch + m.half);
    ctx.lineWidth = 14; ctx.strokeStyle = `rgba(255,214,90,${0.9 * pulse})`; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,250,220,0.95)'; ctx.stroke();
    // the marker running round
    const mx = x + Math.cos(m.ang) * rx, my = y + Math.sin(m.ang) * ry;
    V.glow(ctx, mx, my, 26, '255,255,255', 0.7, true);
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, TAU); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.restore();
  }
  function drawGlint(ctx, game, a) {
    const n = a.node, m = a.mg, w = n.w || 100, h = n.h || 100;
    const gx = n.x + m.gx * w, gy = n.y - m.gy * h, b = (1 - Math.cos((m.t / m.per) * TAU)) / 2, on = b > m.thr;
    V.glow(ctx, gx, gy, 30 + 50 * b, on ? '255,236,150' : '200,220,255', 0.35 + 0.6 * b, true);
    V.star(ctx, gx, gy, 8 + 20 * b, game.time * 1.5, on ? '#fff3b0' : '#dfe8ff', 0.5 + 0.5 * b);
    // the pulse bar over the rock (under it would sit on the hero's own bars)
    const bx = n.x - 50, by = n.y - h - 16;
    ctx.save();
    ctx.beginPath(); NC.rrect(ctx, bx, by, 100, 12, 6); ctx.fillStyle = 'rgba(30,24,44,0.8)'; ctx.fill();
    ctx.beginPath(); NC.rrect(ctx, bx + 100 * m.thr, by + 1, 100 * (1 - m.thr), 10, 5); ctx.fillStyle = 'rgba(255,214,90,0.9)'; ctx.fill();
    ctx.beginPath(); NC.rrect(ctx, bx + 2, by + 2, 96 * b, 8, 4); ctx.fillStyle = on ? '#fff3b0' : '#9fc8ff'; ctx.fill();
    ctx.restore();
  }
  const baseTags = P.drawTags;
  P.drawTags = function (ctx, game) {
    baseTags.call(P, ctx, game);
    const p = game.player;
    if (!p || !NC.drawTag) return;
    for (const f of L.overlays) f(ctx, game, p);
    const a = p.lifeAct;
    if (a) {
      if (a.mg.kind === 'ring') drawRing(ctx, game, a); else drawGlint(ctx, game, a);
      if (a.node.drawExtra) a.node.drawExtra(ctx, game, a);
      return;
    }
    if (p.dead > 0) return;
    const n = nearest(game, p);
    // (no prompt in the middle of a fight: the field is full of trees; the garden always shows it, and an ore vein - a few
    // a floor, in dungeons where a fight is always on: without it a vein was never seen as one, Discord #123)
    if (n && (n.skill === 'farm' || n.skill === 'mine' || !(p.lastFight > game.time - 3))) {
      const bob = Math.sin(game.time * 4) * 3, why = blocked(game, p, n), top = n.tagY != null ? n.tagY : (n.hy != null ? n.hy : n.y - 80) - 70;
      NC.drawTag(ctx, why || `กด B หรือคลิก: ${n.verb || SKILLS[n.skill].name}`, n.x, top + bob, 20, why ? '#ffb0a0' : '#fff3cf');
      if (n.label) NC.drawTag(ctx, n.label, n.x, top + 26 + bob, 16, '#e8e0d2');
    }
  };
  L.overlays = []; // (ctx, game, p): more world-space drawings after the light (the garden's timers)

  // ---------------- the mentors: animal teachers in the camp (drawn like the merchant, js/shop.js) ----------------
  // { id, name, title, sprite, spriteB, x, y, greet: [...], chat: [...], render(game, p) -> html, act(game, p, what, btn) }
  function nearMentor(game, p) { return L.mentors.find((m) => m.here(game) && NC.dist(p.x, p.y, m.x, m.y) < 180); }
  L.addMentor = function (m) {
    Object.assign(m, { kind: 'ally', npc: true, lifeNpc: true, dead: 0, face: 1, t: Math.random() * 5, wave: 0, say: '', sayT: 0, near: false, sort: m.y });
    m.here = m.here || ((game) => !!(game && game.world && game.world.shop));
    L.mentors.push(m);
    return m;
  };
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  L.ticks = []; // (game, dt) every frame, also while the hero is down (regrowth, the garden, the night)
  const hourOf = (game) => ((((game.minutes || 0) / 60) % 24) + 24) % 24;
  L.hour = hourOf;
  L.isNight = (game) => { const h = hourOf(game); return h < 5 || h >= 19.5; }; // (game.js: full night 19:30–05:00)
  const baseUpdate = P.update;
  P.update = function (game, dt) {
    baseUpdate.call(P, game, dt);
    const p = game.player;
    if (!p) return;
    for (const f of L.ticks) f(game, dt);
    for (const m of L.mentors) {
      if (!m.here(game)) continue;
      const d = NC.dist(p.x, p.y, m.x, m.y);
      m.t += dt; m.wave = Math.max(0, m.wave - dt); m.sayT = Math.max(0, m.sayT - dt);
      const near = d < 180 && p.dead <= 0;
      if (near && !m.near) { m.wave = 1.3; m.say = pickOne(m.greet); m.sayT = 3.6; }
      m.near = near;
      if (d < 700 && Math.abs(p.x - m.x) > 24) m.face = p.x < m.x ? -1 : 1;
      if (d < 560 && m.sayT <= 0 && Math.random() < dt / 12) { m.say = pickOne(near ? m.greet : m.chat); m.sayT = 3.6; }
    }
  };
  const baseCollect = P.collect;
  P.collect = function (list, visible) {
    baseCollect.call(P, list, visible);
    const game = NC.game;
    for (const m of L.mentors) if (m.here(game) && visible(m.x - 110, m.y - 200, m.x + 110, m.y + 40)) list.push(m);
  };
  const baseDraw = P.draw;
  P.draw = function (ctx, game, a) {
    if (!a.lifeNpc) return baseDraw.call(P, ctx, game, a);
    const pose = a.wave > 0 && NC.SPR[a.spriteB] ? a.spriteB : a.sprite, b = Math.sin(a.t * 2.4) * 0.018;
    if (NC.SPR[pose]) NC.drawSpr(ctx, pose, a.x, a.y, { flip: a.face < 0, sx: 1 + b * 0.5, sy: 1 - b });
  };
  function bubble(ctx, text, x, y, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = "500 20px 'Mitr', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(380, ctx.measureText(text).width + 30), h = 40;
    ctx.beginPath(); NC.rrect(ctx, x - w / 2, y - h, w, h, 14);
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 9, y - 2); ctx.lineTo(x, y + 12); ctx.lineTo(x + 9, y - 2); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 7, y - 6, 14, 6);
    ctx.fillStyle = NC.OUTLINE; ctx.fillText(text, x, y - h / 2 + 1, w - 20);
    ctx.restore();
  }
  L.overlays.push((ctx, game, p) => {
    const c = game.cam;
    for (const m of L.mentors) {
      if (!m.here(game) || m.x < c.x - 300 || m.x > c.x + game.vw + 300 || m.y < c.y - 300 || m.y > c.y + game.vh + 300) continue;
      const top = m.y - (m.h || 150) - 36;
      NC.drawTag(ctx, m.name, m.x, m.y + 32, 22, '#ffd873');
      NC.drawTag(ctx, m.title, m.x, m.y + 58, 16, '#e8e0d2');
      if (m.sayT > 0) bubble(ctx, m.say, m.x, top, NC.clamp(m.sayT / 0.3, 0, 1) * NC.clamp((3.6 - m.sayT) / 0.15, 0, 1));
      else if (m.near) NC.drawTag(ctx, 'กด B หรือคลิก เพื่อคุย', m.x, top - 8 + Math.sin(game.time * 4) * 3, 20, '#fff3cf');
    }
  });

  // ---------------- tool upgrades (used by the mentors' windows) ----------------
  function upgradeCost(p, tool) { const t = toolTier(p, tool); return t >= 4 ? null : UPGRADES[tool][t - 1]; }
  function canPay(p, c) {
    if (!c) return false;
    if (p.coins < c.coins) return false;
    for (const id in c.mats) if (NC.matCount(p, id) < c.mats[id]) return false;
    return true;
  }
  function costHtml(p, c) {
    const chip = (img, text, ok) => `<span class="${ok ? 'ok' : 'short'}">${img ? `<img src="${img}" alt="">` : ''}${text}</span>`;
    let h = chip(NC.matIcon('ic_coin'), NC.fmtCoins(c.coins), p.coins >= c.coins);
    for (const id in c.mats) h += chip(NC.matIcon(id), `${MAT[id].name} ${NC.matCount(p, id)}/${c.mats[id]}`, NC.matCount(p, id) >= c.mats[id]);
    return `<div class="lf-cost">${h}</div>`;
  }
  function upgrade(game, tool) {
    const p = game.player, c = upgradeCost(p, tool), S = SKILLS[TOOLS[tool].skill];
    if (!c || lvOf(p, TOOLS[tool].skill) < c.lv || !canPay(p, c)) return false;
    p.coins -= c.coins;
    for (const id in c.mats) { p.mats[id] -= c.mats[id]; if (!p.mats[id]) delete p.mats[id]; }
    const r = rec(p);
    r.tools[tool] = Math.min(4, r.tools[tool] + 1);
    const name = TOOLS[tool].names[r.tools[tool] - 1];
    game.toast(`ได้${name}!`);
    NC.HUD.log(`อัปเกรดเครื่องมือ: ${name} (${S.name})`, 'item');
    FX.stars(p.x, p.y - 80, 20, '255,220,120', { speed: 280 });
    showTool(game, p, TOOLS[tool].sprite(r.tools[tool]), 1.6);
    NC.saveGame(game);
    return true;
  }
  L.upgradeRow = function (p, tool) {
    const t = toolTier(p, tool), T = TOOLS[tool], S = SKILLS[T.skill];
    if (t >= 4) return `<div class="mt-item"><img src="${lifeIcon(T.sprite(4))}" alt=""><div><div class="n">${T.names[3]}</div><div class="w">เครื่องมือขั้นสูงสุดแล้ว!</div></div><span></span></div>`;
    const c = UPGRADES[tool][t - 1], ok = lvOf(p, T.skill) >= c.lv && canPay(p, c);
    return `<div class="mt-item"><img src="${lifeIcon(T.sprite(t + 1))}" alt=""><div><div class="n">${T.names[t]} (ขั้น ${t + 1})</div>` +
      `<div class="w">ต้องมี${S.name} Lv ${c.lv}${lvOf(p, T.skill) >= c.lv ? ' ✓' : ` (ตอนนี้ Lv ${lvOf(p, T.skill)})`}</div>${costHtml(p, c)}</div>` +
      `<button data-act="up:${tool}" ${ok ? '' : 'disabled'}>อัปเกรด</button></div>`;
  };
  L.upgrade = upgrade; L.costHtml = costHtml; L.canPay = canPay; L.showTool = showTool; L.nearest = nearest; L.stopWork = stop;
  L.work = interact; L.strike = strike; // (js/questauto.js: AUTO works a tree / vein / plot as B does)

  // ---------------- the mentor's window (H, the life skills, is js/lifebook.js; the old dark one built here is gone,
  // 2026-10-21) ----------------
  let mwin = null, mentor = null;
  const G = () => NC.game;
  function build(game) {
    mwin = document.createElement('div');
    mwin.id = 'lifementor'; mwin.className = 'panel'; mwin.hidden = true;
    mwin.innerHTML = '<div class="card mentor"><div class="ptitle"><span class="lf-title" id="mt-name"></span>' +
      `<span class="sh-coins" id="mt-coinbox"><img src="${NC.matIcon('ic_coin')}" alt=""><b id="mt-coins">0</b></span>` +
      '<button id="mt-close" aria-label="ปิด">✕</button></div><div id="mt-body"></div></div>';
    document.body.appendChild(mwin);
    $('mt-close').addEventListener('click', () => { NC.HUD.panel('lifementor', false); game.paused = false; });
    mwin.addEventListener('click', (ev) => {
      const t = ev.target.closest('button');
      if (!t || t.disabled || !mentor || !t.dataset.act) return;
      const [what, arg] = t.dataset.act.split(':');
      if (what === 'up') { if (upgrade(game, arg)) { mentor.wave = 1.2; mentor.say = pickOne(['เยี่ยมเลย ใช้ให้คุ้มนะ!', 'ของดีต้องคู่กับฝีมือดี!', 'ลองไปใช้ดูเลย!']); mentor.sayT = 3.6; } }
      else if (mentor.act) mentor.act(game, game.player, what, arg, t);
      renderMentor();
    });
  }
  L.refresh = () => renderMentor();
  // online the server takes a teacher's upgrade / plot / seeds only within 180 of them (backend life_actions.go
  // nearLifeMentor): opened from farther (a click reaches 420) every press came back refused and the coins returned
  // (Discord #100 ขยายแปลงไม่ได้ เงินเด้งกลับ, #101 อัปขั้นขุดแร่ไม่ได้, 2026-10-20). So the hero walks up first.
  const MENTOR_REACH_ONLINE = 150;
  function openMentor(game, m) {
    if (p0(game).lifeAct) return;
    const p = p0(game), online = !!(NC.Online && NC.Online.enabled);
    if (online && NC.dist(p.x, p.y, m.x, m.y) > MENTOR_REACH_ONLINE && NC.Travel && NC.Travel.go) {
      NC.Travel.go(game, { map: game.mapId, x: m.x, y: m.y + 60, r: 90, name: m.name, done: () => setTimeout(() => openMentor(game, m), 150) });
      game.toast(`เดินไปหา${m.name}ก่อน · เดินเองเพื่อหยุด`);
      return;
    }
    mentor = m;
    game.paused = NC.HUD.panel('lifementor', true);
  }
  const p0 = (game) => game.player;
  function renderMentor() {
    if (!mwin || mwin.hidden || !mentor) return;
    const game = G(), p = game.player;
    $('mt-name').textContent = mentor.name;
    $('mt-coins').textContent = NC.fmtCoins(p.coins);
    $('mt-body').innerHTML = `<div class="mt-top"><img src="${lifeIcon(mentor.sprite)}" alt=""><div class="mt-say">${mentor.talk ? mentor.talk(game, p) : pickOne(mentor.greet)}</div></div>` +
      mentor.render(game, p);
  }
  L.renderMentor = renderMentor;

  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build(game);
    const bar = document.querySelector('.menubar');
    if (bar) {
      const b = document.createElement('button');
      b.className = 'mbtn'; b.title = 'อาชีพเสริม: ตัดไม้ ขุดแร่ ปลูกผัก ตกปลา (H)';
      b.innerHTML = `<img src="${lifeIcon('t_axe1')}" alt=""><b>H</b>`;
      b.addEventListener('click', () => { game.paused = NC.HUD.panel('life'); });
      bar.appendChild(b);
    }
    const keys = document.querySelector('#pause .keys');
    if (keys) {
      const li = document.createElement('li');
      li.innerHTML = '<kbd>H</kbd> อาชีพเสริม — <b>ตัดไม้</b> ในทุ่ง <b>ขุดแร่</b> ในดันเจี้ยน <b>ปลูกผัก</b> ที่ฟาร์มหิ่งห้อย <b>ตกปลา</b> ริมน้ำ: เดินไปใกล้แล้วกด B หรือคลิก กดให้ตรงจังหวะได้ของเพิ่ม';
      keys.insertBefore(li, keys.lastElementChild);
    }
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (id === 'lifementor') {
      if (!mwin) return false;
      const on = show === undefined ? mwin.hidden : show;
      basePanel('pause', false); // closes every other window
      mwin.hidden = !on;
      if (on) renderMentor();
      return on;
    }
    if (mwin) mwin.hidden = true;
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyH' || e.repeat || !NC.game || !NC.game.player || typing()) return;
    NC.game.paused = NC.HUD.panel('life');
  });
})();
