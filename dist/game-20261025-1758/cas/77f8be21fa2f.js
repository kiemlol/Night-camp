/* setfx.js — each outfit set's own power at 4 pieces (3 since the shoes became part of the trousers, js/lowermerge.js), and the boss sets (the Loot Book, 2026-09-30: "ความสามารถไม่ซ้ำกัน").
   The 80 sets of js/outfits.js keep their line bonus at 3 pieces (x2 at 4); with the set's accessory in either slot the
   set's own passive switches on too. Most passives are js/wabil.js specs (they run through NC.gearFx) or skill-mod keys
   (NC.skillModSources); the rest are run here:
     shieldLow  a shield of x% HP when HP falls under y% (every z s)      shell     damage taken −60% for 3 s under 40% HP
     charge     after 2 s of walking the next hit is +x% and knocks back    still     standing still 3 s: less damage, regen
     revive     back up with x% HP (every y s)                             block     one hit stopped every x s
     starfall   a meteor on the nearest monster every x s in a fight       gelShield a hit may give a gel shield of 5% HP
     opener     the first hit on a monster at full HP +x%                  slowHit   x% of hits slow the monster 40% 2 s
     nightTaken / insectTaken  less damage at night / from insects        nightRegen  HP back at night
     matDouble  x% of the materials picked up come twice                  matPlus   x% chance of one more
     lifeMore   the same for one life skill's finds                        rest      sitting heals x times faster
     exp        EXP +x% from monsters                                      sell      the merchant pays +x% (js/economy.js)
     warpOff / warpFree   cheaper warps / free warps a day (js/economy.js)
   Boss sets: any weapon of a map boss (its kind D rows in js/loot_data.js) + that boss's hat (hats2 'boss') + its crown
   worn as an accessory (new items acc_crown_<boss>, dropped by the boss) = 3 pieces, a passive of their own.
   Hooks: NC.gearFx (read by wabil.js), NC.skillModSources, NC.heroHit, NC.heroGuards, NC.hurtPlayer, NC.skillTicks,
   NC.updatePlayer, NC.gainXp, NC.addMat, the bag card (NC.invCardExtras). NC.SetFx.active(p) lists what is on. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX, V = NC.VFX, OF = NC.OUTFITS;
  if (!OF) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const ELS = ['fire', 'water', 'wind', 'earth', 'holy', 'shadow', 'poison', 'ghost'];
  const allEl = (v) => Object.fromEntries(ELS.map((e) => ['el_' + e, v]));

  // [text, specs] — specs: wabil specs, { t: 'mods', ... } skill-mod keys, or this file's own kinds
  const S = {
    hv_tin: ['HP ต่ำกว่า 30% ได้โล่กันดาเมจ 15% ของ HP สูงสุด (ทุก 60 วิ)', [{ t: 'shieldLow', at: 30, pct: 15, cd: 60 }]],
    hv_boar: ['เดินต่อเนื่อง 2 วิ ตีแรกแรง +40% และกระแทกถอย', [{ t: 'charge', pct: 40 }]],
    hv_bark: ['ยืนนิ่ง 3 วิ: โดนดาเมจลดลง 10% และฟื้น HP 1% ต่อวิ', [{ t: 'still', taken: 10, regen: 1 }]],
    hv_shell: ['มอนที่ตีเราโดนสะท้อน 8%', [{ t: 'reflect', pct: 8 }]],
    hv_camp: ['กลางคืนโดนดาเมจลดลง 8%', [{ t: 'nightTaken', pct: 8 }]],
    lt_scout: ['เดินเร็ว +5%', [{ t: 'mods', spd: 5 }]],
    lt_bat: ['กลางคืน ตีดูดเลือด 2%', [{ t: 'leech', pct: 2, night: true }]],
    lt_fox: ['คริติคอล +5% · หลบการโจมตีเพิ่ม 3%', [{ t: 'mods', crit: 5, pdodge: 3 }]],
    lt_bee: ['ตีเร็ว +5% · ตี 5% ติดพิษ', [{ t: 'aspd', v: 5 }, { t: 'status', st: 'poison', chance: 5 }]],
    lt_crow: ['ขายวัตถุดิบให้ลุงโกโก้ได้ราคา +5%', [{ t: 'sell', pct: 5 }]],
    mg_novice: ['SP ฟื้น +10%', [{ t: 'mods', spReg: 10 }]],
    mg_mush: ['ตี 8% ระเบิดสปอร์พิษรอบเป้า 80%', [{ t: 'proc', fx: 'spores', chance: 8, mul: 0.8 }]],
    mg_moth: ['กลางคืนแรงขึ้น 6%', [{ t: 'night', night: 6, day: 0 }]],
    mg_leaf: ['ฮีลแรง +10%', [{ t: 'mods', heal: 10 }]],
    mg_candle: ['ใช้ SP น้อยลง 15%', [{ t: 'mods', spCost: 15 }]],
    rg_trail: ['เดินเร็ว +5% · วาร์ปถูกลง 20%', [{ t: 'mods', spd: 5 }, { t: 'warpOff', pct: 20 }]],
    rg_frog: ['ต้านน้ำ 15%', [{ t: 'resist', el: 'water', pct: 15 }]],
    rg_wolf: ['แรงกับมอนเผ่าสัตว์ +12%', [{ t: 'vsRace', race: 'brute', pct: 12 }]],
    rg_camp: ['นั่งพักฟื้น HP/SP เร็ว 2 เท่า', [{ t: 'rest', k: 2 }]],
    rg_fly: ['HIT +10 · ความเร็วโจมตี +3%', [{ t: 'mods', hit: 10 }, { t: 'aspd', v: 3 }]],
    hv_iron: ['โดนดาเมจลดลง 5% · DEF +3', [{ t: 'mods', taken: 5, def: 3 }]],
    hv_stone: ['DEF +5 · โดนดาเมจลดลง 4%', [{ t: 'mods', def: 5, taken: 4 }]],
    hv_bear: ['ทุกการตีครั้งที่ 4 ปล่อยแรงกระแทกรอบตัว 120% และฟื้น HP 3%', [{ t: 'every', n: 4, fx: 'holyburst', mul: 1.2, heal: 3 }]],
    hv_beetle: ['ดาเมจจากมอนเผ่าแมลงลดลง 20%', [{ t: 'raceTaken', race: 'insect', pct: 20 }]],
    hv_forge: ['ATK +5% · ต้านไฟ 15%', [{ t: 'mods', atk: 5 }, { t: 'resist', el: 'fire', pct: 15 }]],
    lt_raccoon: ['3% ของวัตถุดิบที่เก็บได้มา 2 เท่า', [{ t: 'matDouble', pct: 3 }]],
    lt_snake: ['ตี 8% ติดพิษ · แรง +15% กับมอนที่ติดพิษ', [{ t: 'status', st: 'poison', chance: 8 }, { t: 'vsPoisoned', pct: 15 }]],
    lt_shadow: ['ตีแรกใส่มอนที่เลือดเต็ม +40%', [{ t: 'opener', pct: 40 }]],
    lt_lizard: ['ต้านไฟ 20% · หลบการโจมตีเพิ่ม 3%', [{ t: 'resist', el: 'fire', pct: 20 }, { t: 'mods', pdodge: 3 }]],
    lt_cat: ['ความเร็วโจมตี +6% · คริติคอล +3%', [{ t: 'aspd', v: 6 }, { t: 'mods', crit: 3 }]],
    mg_star: ['กลางคืนแรงขึ้น 8%', [{ t: 'night', night: 8, day: 0 }]],
    mg_ink: ['คูลดาวน์สกิล −5%', [{ t: 'mods', cdr: 5 }]],
    mg_potion: ['HP ฟื้นเอง +25%', [{ t: 'mods', hpReg: 25 }]],
    mg_slime: ['โดนตี 10% ได้เกราะวุ้นซับดาเมจ 5% ของ HP', [{ t: 'gelShield', chance: 10, pct: 5 }]],
    mg_cloud: ['ธาตุน้ำและลมแรง +10%', [{ t: 'mods', el_water: 10, el_wind: 10 }]],
    rg_fisher: ['ตกปลา 15% ได้ปลาเพิ่มอีก 1 ตัว', [{ t: 'lifeMore', skill: 'fish', pct: 15 }]],
    rg_miner: ['ขุดแร่ 15% ได้แร่เพิ่มอีก 1 ก้อน', [{ t: 'lifeMore', skill: 'mine', pct: 15 }]],
    rg_herbal: ['เก็บผัก 15% ได้เพิ่มอีก 1 · ฮีล +5%', [{ t: 'lifeMore', skill: 'farm', pct: 15 }, { t: 'mods', heal: 5 }]],
    rg_courier: ['เดินเร็ว +8% · วาร์ปฟรีวันละ 3 ครั้ง', [{ t: 'mods', spd: 8 }, { t: 'warpFree', n: 3 }]],
    rg_climber: ['ต้านลม 15% · FLEE +5', [{ t: 'resist', el: 'wind', pct: 15 }, { t: 'mods', flee: 5 }]],
    hv_owl: ['กลางคืนแรงขึ้น 10%', [{ t: 'night', night: 10, day: 0 }]],
    hv_crystal: ['MDEF +8 · โดนดาเมจลดลง 3%', [{ t: 'mods', mdef: 8, taken: 3 }]],
    hv_ember: ['ตี 10% ติดเผา · ต้านน้ำ 20%', [{ t: 'status', st: 'burn', chance: 10 }, { t: 'resist', el: 'water', pct: 20 }]],
    hv_turtle: ['HP ต่ำกว่า 40% หดในกระดอง 3 วิ ดาเมจรับ −60% (ทุก 90 วิ)', [{ t: 'shell', at: 40, pct: 60, dur: 3, cd: 90 }]],
    hv_stag: ['ฆ่ามอน ฟื้น HP 2%', [{ t: 'killHeal', pct: 2 }]],
    lt_night: ['กลางคืนแรงขึ้น 12%', [{ t: 'night', night: 12, day: 0 }]],
    lt_panther: ['คริติคอลแรงขึ้น 20% · ตีแรกใส่มอนที่เลือดเต็ม +20%', [{ t: 'mods', critDmg: 20 }, { t: 'opener', pct: 20 }]],
    lt_firefly: ['แรงกับมอนธาตุเงา +15% · กลางคืน +5%', [{ t: 'vsEl', els: ['shadow'], pct: 15 }, { t: 'night', night: 5, day: 0 }]],
    lt_spider: ['ตี 10% พันใยมอน ช้าลง 40% 2 วิ', [{ t: 'slowHit', chance: 10, k: 0.4, dur: 2 }]],
    lt_mantis: ['คริติคอลแรงขึ้น 25%', [{ t: 'mods', critDmg: 25 }]],
    mg_tide: ['โอกาสติดเย็นเฉียบ +20% · ธาตุน้ำแรง +5%', [{ t: 'mods', st_chill: 20, el_water: 5 }]],
    mg_bloom: ['ฮีลแรง +15%', [{ t: 'mods', heal: 15 }]],
    mg_rune: ['พลังสกิล +8% · ใช้ SP น้อยลง 8%', [{ t: 'mods', skill: 8, spCost: 8 }]],
    mg_clock: ['คูลดาวน์สกิล −8%', [{ t: 'mods', cdr: 8 }]],
    mg_frost: ['โอกาสติดเย็นเฉียบ +30% · ธาตุน้ำแรง +5%', [{ t: 'mods', st_chill: 30, el_water: 5 }]],
    rg_elk: ['แรงกับบอสและมอนตัวใหญ่ +10%', [{ t: 'vsBig', pct: 10, small: 0 }]],
    rg_ranger: ['สัตว์ข้างตัวแรง +15%', [{ t: 'mods', pet: 15 }]],
    rg_navigator: ['กลางคืนแรงขึ้น 8% · HIT +10', [{ t: 'night', night: 8, day: 0 }, { t: 'mods', hit: 10 }]],
    rg_falcon: ['สัตว์ข้างตัวแรง +20%', [{ t: 'mods', pet: 20 }]],
    rg_polar: ['ต้านน้ำ 25%', [{ t: 'resist', el: 'water', pct: 25 }]],
    hv_moon: ['HP สูงสุด +8% · กลางคืนฟื้น HP 0.5% ต่อวิ', [{ t: 'mods', hpPct: 8 }, { t: 'nightRegen', pct: 0.5 }]],
    hv_wyrm: ['โดนดาเมจลดลง 8% · ตี 5% พ่นไฟเป็นกรวย 150%', [{ t: 'mods', taken: 8 }, { t: 'proc', fx: 'breath', chance: 5, mul: 1.5, st: 'burn' }]],
    hv_nebula: ['ระหว่างสู้ ดาวตกลงใส่มอนที่ใกล้สุดทุก 8 วิ 200%', [{ t: 'starfall', every: 8, mul: 2 }]],
    hv_aurora: ['ทุก 20 วิ กันการโจมตีได้ 1 ครั้ง', [{ t: 'block', every: 20 }]],
    hv_guardian: ['ตายไม่ได้ 1 ครั้งทุก 5 นาที (เหลือ HP 1 อมตะ 2 วิ)', [{ t: 'revive', pct: 0, cd: 300, inv: 2 }]],
    lt_phantom: ['หลบการโจมตีเพิ่ม 8%', [{ t: 'mods', pdodge: 8 }]],
    lt_storm: ['ทุกการตีครั้งที่ 5 ฟ้าผ่าลงเป้า 150% + ช็อต', [{ t: 'every', n: 5, fx: 'lightning', mul: 1.5, st: 'shock' }]],
    lt_thorn: ['มอนที่ตีเราโดนสะท้อน 12%', [{ t: 'reflect', pct: 12 }]],
    lt_ghostcat: ['ตายแล้วฟื้นทันที HP 30% (ทุก 9 นาที)', [{ t: 'revive', pct: 30, cd: 540, inv: 1.5 }]],
    lt_gold: ['วัตถุดิบที่เก็บได้ 10% ได้เพิ่มอีก 1 ชิ้น', [{ t: 'matPlus', pct: 10 }]],
    mg_dream: ['ตี 8% ทำให้มอนช็อต', [{ t: 'status', st: 'shock', chance: 8 }]],
    mg_phoenix: ['ตายแล้วฟื้นด้วยไฟ HP 50% (ทุก 10 นาที)', [{ t: 'revive', pct: 50, cd: 600, inv: 2, fire: true }]],
    mg_spirit: ['ฮีลแรง +20% · HP ฟื้นเอง +30%', [{ t: 'mods', heal: 20, hpReg: 30 }]],
    mg_void: ['พลังสกิล +12%', [{ t: 'mods', skill: 12 }]],
    mg_prism: ['ทุกธาตุแรงขึ้น 8%', [{ t: 'mods', ...allEl(8) }]],
    rg_voyager: ['ตีทะลุ: ตัวหลังเป้าโดน 25%', [{ t: 'pierce', pct: 25 }]],
    rg_legend: ['แรงกับบอสและมอนตัวใหญ่ +15%', [{ t: 'vsBig', pct: 15, small: 0 }]],
    rg_moonwalk: ['กลางคืนแรงขึ้น 10% · เดินเร็ว +5%', [{ t: 'night', night: 10, day: 0 }, { t: 'mods', spd: 5 }]],
    rg_campking: ['EXP จากมอน +5%', [{ t: 'exp', pct: 5 }]],
    rg_windwalk: ['เดินเร็ว +10% · ความเร็วโจมตี +5%', [{ t: 'mods', spd: 10 }, { t: 'aspd', v: 5 }]],
  };
  NC.SET_PASSIVES = S;

  // ---------------- the boss sets ----------------
  const BOSSSET = {
    bat_king: { name: 'ราตรีราชาค้างคาว', hat: 'hat_hc_boss_batking', crown: 'mat_bat_crown', stats: { agi: 3, flee: 6 },
      text: 'กลางคืนตีดูดเลือด 3% · ทุกการตีครั้งที่ 6 ฝูงค้างคาวรุมเป้า', fx: [{ t: 'leech', pct: 3, night: true }, { t: 'every', n: 6, fx: 'bats', mul: 0.9 }] },
    mushking: { name: 'สปอร์ราชาเห็ด', hat: 'hat_hc_boss_mushking', crown: 'mat_king_crown', stats: { int: 4, sp: 60 },
      text: 'ตี 8% ระเบิดสปอร์พิษ · พิษแรงขึ้น 25%', fx: [{ t: 'proc', fx: 'spores', chance: 8, mul: 1.2 }, { t: 'mods', poison: 25 }] },
    ant_queen: { name: 'รังนางพญามด', hat: 'hat_hc_boss_antqueen', crown: 'mat_queen_tiara', stats: { vit: 4, hp: 300 },
      text: 'ตี 5% เรียกมดทหารช่วยสู้ 10 วิ · โดนดาเมจลดลง 6%', fx: [{ t: 'summon', kind: 'ant', chance: 5, dur: 10, max: 3 }, { t: 'mods', taken: 6 }] },
    crypt_lord: { name: 'บัลลังก์ราชาสุสาน', hat: 'hat_hc_boss_cryptlord', crown: 'mat_lord_crown', stats: { int: 4, mdef: 6 },
      text: 'ฆ่าได้เรียกทหารกระดูกช่วยสู้ (สูงสุด 3) · ตี 8% ติดคำสาป', fx: [{ t: 'killSummon', kind: 'skeleton', dur: 12, max: 3 }, { t: 'status', st: 'curse', chance: 8 }] },
    lava_dragon: { name: 'หัวใจมังกรลาวา', hat: 'hat_hc_boss_lavadragon', crown: 'mat_dragon_heart', stats: { str: 5, def: 4 },
      text: 'ทุกการตีครั้งที่ 8 ลมหายใจมังกร 250% + เผา · ต้านไฟ 30%', fx: [{ t: 'every', n: 8, fx: 'breath', mul: 2.5, st: 'burn' }, { t: 'resist', el: 'fire', pct: 30 }] },
  };
  const LD = NC.LOOT_DATA || { bosses: {} };
  for (const b in BOSSSET) {
    const B = BOSSSET[b], M = NC.MATERIALS[B.crown], id = 'acc_crown_' + b;
    B.acc = id;
    B.weapons = new Set((LD.bosses[b] || []).map((r) => r[0]).filter((x) => ITEMS[x] && ITEMS[x].slot === 'weapon'));
    const man = NC.matIcon ? NC.matIcon(B.crown) : '';
    if (man && !NC.ASSET_MANIFEST[id]) NC.ASSET_MANIFEST[id] = { src: man, w: 64, h: 64 };
    ITEMS[id] = { slot: 'acc', sprite: id, name: (M ? M.name : 'มงกุฎ') + ' (สวม)', rarity: 'legend', stats: B.stats, lvReq: 20,
      bossSet: b, desc: `มงกุฎของบอส สวมเป็นเครื่องประดับได้ · ชิ้นที่ 3 ของเซ็ต${B.name}` };
    if (LD.bosses[b]) LD.bosses[b].push([id, 4]);
  }
  NC.BOSS_SETS = BOSSSET;

  // ---------------- what is on ----------------
  const accOn = (p, id) => p.equip.acc1 === id || p.equip.acc2 === id;
  function active(p) {
    const out = [];
    const w = OF.setOf && OF.setOf(p);
    if (w && w.n >= 2 && S[w.S.id]) out.push({ name: w.S.name, text: S[w.S.id][0], fx: S[w.S.id][1] });
    for (const b in BOSSSET) {
      const B = BOSSSET[b];
      if (B.weapons.has(p.equip.weapon) && p.equip.hat === B.hat && accOn(p, B.acc)) out.push({ name: 'เซ็ต' + B.name, text: B.text, fx: B.fx });
    }
    return out;
  }
  let key = '', cache = [];
  function fxOf(p) {
    const k = [p.equip.weapon, p.equip.hat, p.equip.top, p.equip.pants, p.equip.shoes, p.equip.robe, p.equip.acc1, p.equip.acc2].join('|');
    if (k !== key) { key = k; cache = active(p).flatMap((a) => a.fx); }
    return cache;
  }
  const has = (p, t) => fxOf(p).filter((a) => a.t === t);
  NC.gearFx = (p) => fxOf(p); // (js/wabil.js: its specs among the weapon's)
  NC.SetFx = { active, has: (p, t) => has(p, t), fxOf };
  NC.skillModSources.push((p) => {
    if (!p || p.kind !== 'player') return null;
    let m = null;
    for (const a of fxOf(p)) if (a.t === 'mods') { m = m || {}; for (const k in a) if (k !== 't') m[k] = (m[k] || 0) + a[k]; }
    return m;
  });

  // ---------------- this file's own kinds ----------------
  const G = () => NC.game;
  const nightNow = (game) => (NC.nightK ? NC.nightK(game) : 0) >= 0.5;
  const cdOf = (p, id) => (p._setCd || (p._setCd = {}))[id] || 0;
  const setCd = (p, id, t) => { (p._setCd || (p._setCd = {}))[id] = t; };
  // less damage taken
  NC.heroGuards.push((game, p, dmg, att) => {
    const t = game.time;
    for (const a of fxOf(p)) {
      if (a.t === 'nightTaken' && nightNow(game)) dmg *= 1 - a.pct / 100;
      else if (a.t === 'raceTaken' && att && NC.raceOf && NC.raceOf(att) === a.race) dmg *= 1 - a.pct / 100;
      else if (a.t === 'still' && (p._stillT || 0) >= 3) dmg *= 1 - a.taken / 100;
      else if (a.t === 'block' && t >= cdOf(p, 'block')) { setCd(p, 'block', t + a.every); V.ring(p.x, p.y - 40, 20, 110, 6, '190,240,255', 0.4); FX.num(p.x, p.y - 150, 'กันได้!', { fill: '#bfefff', size: 26 }); return 0; }
      else if (a.t === 'shell' && (p._shellT || 0) > t) dmg *= 1 - a.pct / 100;
    }
    // shields
    if (p._shieldHp > 0) { const s = Math.min(p._shieldHp, dmg); p._shieldHp -= s; dmg -= s; if (dmg <= 0) return 0; }
    const hpAfter = p.hp - dmg;
    for (const a of fxOf(p)) {
      if (a.t === 'shieldLow' && hpAfter < p.maxHp * a.at / 100 && t >= cdOf(p, 'shieldLow')) {
        setCd(p, 'shieldLow', t + a.cd); p._shieldHp = p.maxHp * a.pct / 100;
        V.ring(p.x, p.y - 40, 20, 130, 8, '255,230,150', 0.5); FX.num(p.x, p.y - 160, 'โล่!', { fill: '#ffe7a6', size: 28 });
      } else if (a.t === 'shell' && hpAfter < p.maxHp * a.at / 100 && t >= cdOf(p, 'shell')) {
        setCd(p, 'shell', t + a.cd); p._shellT = t + a.dur;
        FX.num(p.x, p.y - 160, 'หดในกระดอง!', { fill: '#b6f0a0', size: 26 });
      } else if (a.t === 'gelShield' && Math.random() * 100 < a.chance && !(p._shieldHp > 0)) {
        p._shieldHp = p.maxHp * a.pct / 100; V.ring(p.x, p.y - 40, 16, 100, 6, '140,220,255', 0.4);
      }
    }
    return Math.max(1, Math.round(dmg));
  });
  // back up from a faint
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game.player;
    if (p && p.kind === 'player' && !(p.dead > 0) && p.hp > 0) {
      const r = has(p, 'revive').find((a) => game.time >= cdOf(p, 'revive'));
      if (r && p.hp - dmg <= 0 && !(p.inv > 0)) {
        setCd(p, 'revive', game.time + r.cd);
        p.hp = Math.max(1, Math.round(p.maxHp * r.pct / 100)); p.inv = r.inv;
        V.ring(p.x, p.y - 40, 20, 180, 10, r.fire ? '255,160,80' : '255,240,200', 0.6);
        FX.stars(p.x, p.y - 80, 14, r.fire ? '255,170,90' : '255,240,200', { speed: 260 });
        FX.num(p.x, p.y - 170, 'ฟื้นคืน!', { fill: '#ffe7a6', size: 34 });
        if (r.fire && NC.WABIL) { const e = game.enemies.find((x) => !x.dead && NC.dist(x.x, x.y, p.x, p.y) < 300); if (e) NC.WABIL.SPELL.breath(game, p, e, { mul: 2, st: 'burn' }); }
        return;
      }
    }
    return baseHurt.apply(this, arguments);
  };
  // damage on the hero's hits
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const r = baseHit(d, e, o), game = G(), p = game && game.player;
    if (!p || d !== p.d || !e || !(r.dmg > 0)) return r;
    let k = 1;
    for (const a of fxOf(p)) {
      if (a.t === 'opener' && e.hp >= e.maxHp) k *= 1 + a.pct / 100;
      else if (a.t === 'charge' && (p._walkT || 0) >= 2) { k *= 1 + a.pct / 100; p._walkT = 0; e.kbx = (e.kbx || 0) + (e.x > p.x ? 260 : -260); }
    }
    if (k !== 1) r.dmg = Math.max(1, Math.round(r.dmg * k));
    return r;
  };
  NC.basicHits.push((game, p, e, r) => {
    for (const a of fxOf(p)) if (a.t === 'slowHit' && Math.random() * 100 < a.chance && NC.SkillKit) NC.SkillKit.slow(e, a.k, a.dur);
  });
  // every frame: walking, standing still, night regen, the star fall
  NC.skillTicks.push((game, p, dt) => {
    const fx = fxOf(p);
    if (!fx.length) return;
    if (p.moving) { p._walkT = (p._walkT || 0) + dt; p._stillT = 0; } else { p._stillT = (p._stillT || 0) + dt; if (!p.atk) p._walkT = 0; }
    for (const a of fx) {
      if (a.t === 'still' && p._stillT >= 3 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * a.regen / 100 * dt);
      else if (a.t === 'nightRegen' && nightNow(game) && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * a.pct / 100 * dt);
      else if (a.t === 'starfall' && game.time - (p.lastFight || -99) < 4 && game.time >= cdOf(p, 'starfall')) {
        const e = game.enemies.filter((x) => !x.dead && x.hp > 0 && NC.dist(x.x, x.y, p.x, p.y) < 700).sort((a2, b2) => NC.dist(a2.x, a2.y, p.x, p.y) - NC.dist(b2.x, b2.y, p.x, p.y))[0];
        if (e && NC.WABIL) { setCd(p, 'starfall', game.time + a.every); NC.WABIL.SPELL.meteor(game, p, e, { mul: a.mul }); }
      }
    }
  });
  // sitting heals faster (rest.js heals once; the set adds the rest)
  const baseUpd = NC.updatePlayer;
  NC.updatePlayer = function (game, dt) {
    const r = baseUpd.apply(this, arguments), p = game.player;
    if (p.sit && p.dead <= 0 && p.d) for (const a of has(p, 'rest')) {
      p.hp = Math.min(p.maxHp, p.hp + p.d.hpRegen * 3 * (a.k - 1) * dt);
      p.sp = Math.min(p.maxSp, p.sp + p.d.spRegen * 3 * (a.k - 1) * dt);
    }
    return r;
  };
  // EXP
  (NC.xpFilters || (NC.xpFilters = [])).push((game, n, jn) => {
    const e = has(game.player, 'exp').reduce((s, a) => s + a.pct, 0);
    return [e ? Math.round(n * (1 + e / 100)) : n, jn];
  });
  // materials picked up
  const lifeOf = (id) => {
    const L = NC.Life, M = NC.MATERIALS[id];
    if (/^fs_/.test(id)) return 'fish';
    if (!L || !L.GUIDE || !M || !M.life) return null;
    for (const s in L.GUIDE) if ((L.GUIDE[s] || []).some((g) => g.mat === id)) return s;
    return /^lf_(ruby|sapphire|emerald|topaz|amethyst)/.test(id) ? 'mine' : null;
  };
  const baseAdd = NC.addMat;
  NC.addMat = function (game, id, n) {
    const p = game && game.player;
    if (p && p.equip && n > 0 && !/^sd_/.test(id)) {
      for (const a of fxOf(p)) {
        if (a.t === 'matDouble' && /^mat_/.test(id) && Math.random() * 100 < a.pct) n *= 2;
        else if (a.t === 'matPlus' && /^mat_/.test(id) && Math.random() * 100 < a.pct) n += 1;
        else if (a.t === 'lifeMore' && lifeOf(id) === a.skill && Math.random() * 100 < a.pct) n += 1;
      }
    }
    return baseAdd.call(this, game, id, n);
  };
  NC.setSellBonus = (p) => (p ? has(p, 'sell').reduce((s, a) => s + a.pct, 0) : 0);
  NC.setWarpOff = (p) => (p ? has(p, 'warpOff').reduce((s, a) => s + a.pct, 0) : 0);
  NC.setWarpFree = (p) => (p ? has(p, 'warpFree').reduce((s, a) => s + a.n, 0) : 0);

  // ---------------- the bag card: the set's passive, the boss set ----------------
  NC.invCardExtras && NC.invCardExtras.push((p, id) => {
    const it = ITEMS[id];
    if (!it) return '';
    if (it.of && S[it.of.set]) {
      const on = active(p).some((a) => a.fx === S[it.of.set][1]);
      return `<div class="sf-box ${on ? 'on' : ''}"><b>ครบ 3 ชิ้น (กับเครื่องประดับของเซ็ต):</b> ${esc(S[it.of.set][0])}${on ? ' <span>✔ ทำงานอยู่</span>' : ''}</div>`;
    }
    for (const b in BOSSSET) {
      const B = BOSSSET[b];
      if (B.weapons.has(id) || it === ITEMS[B.hat] || id === B.acc) {
        const on = active(p).some((a) => a.fx === B.fx);
        const bits = [['อาวุธของ' + (NC.MONSTERS[b] || {}).name, B.weapons.has(p.equip.weapon)], [(ITEMS[B.hat] || {}).name, p.equip.hat === B.hat], [ITEMS[B.acc].name, accOn(p, B.acc)]];
        return `<div class="sf-box boss ${on ? 'on' : ''}"><b>เซ็ต${esc(B.name)} (3 ชิ้น):</b> ${esc(B.text)}` +
          `<div class="pcs">${bits.map(([n, ok]) => `<span class="${ok ? 'ok' : ''}">${ok ? '●' : '○'} ${esc(n || '')}</span>`).join('')}</div></div>`;
      }
    }
    return '';
  });
  const css = document.createElement('style');
  css.textContent = `
    .sf-box{margin-top:calc(8*var(--u));padding:calc(7*var(--u)) calc(10*var(--u));border-radius:calc(12*var(--u));background:rgba(143,217,168,.07);border:calc(2*var(--u)) solid rgba(143,217,168,.2);font:400 calc(15*var(--u))/1.45 'Mitr',sans-serif;color:#c9d6e8}
    .sf-box b{color:#bfeccb;font-weight:600}.sf-box.on{border-color:rgba(143,240,138,.6)}.sf-box span{color:#8ff08a}
    .sf-box.boss{background:rgba(255,201,77,.07);border-color:rgba(255,201,77,.25)}.sf-box.boss b{color:#ffd873}
    .sf-box .pcs{display:flex;flex-direction:column;margin-top:calc(3*var(--u));color:#9ca1c4}.sf-box .pcs .ok{color:#8ff08a}`;
  document.head.appendChild(css);
})();
