/* bl_arts.js — "ดรอปสร้างบิล" part 3: monster arts (วิชามอน). Every species can drop the "echo" of its own move; the hero
   learns it and uses it from two slots (keys 7 and 8, after the hotbar; click a slot to open the book). Every job can.
   Copies 1 / 3 / 10 = tier I / II / III (damage x1 / x1.25 / x1.5). Damage of a tier I art: 60% + 2% x the monster's
   level of ATK or MATK (the higher), in the monster's element. 22 families of moves (by species, the same keyword
   rules as the plan page) + 23 bosses with their own moves.
   Drop: a kill by the hero, Lv <= 40: 0.1% · Lv 41-80: 0.06% · Lv 81+: 0.04% · a map boss 2% · a story boss 3%
   It goes straight into the book (no pickup), with a toast.
   Hooks: NC.updatePlayer (keys, slots), NC.HUD.init (the slots), NC.damageEnemy (drops), NC.heroGuards (the shield
   move), NC.Pets (decoys and summons as the monster's own sprite), NC.saveGame / NC.loadGear.
   NC.BL.arts.cast(0) casts the first equipped art. */
(function () {
  'use strict';
  const NC = window.NC, SK = NC.SKILLS, K = NC.SkillKit, V = NC.VFX, FX = NC.FX, BL = NC.BL;
  if (!BL || !K) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const alive = (e) => e && !e.dead && e.hp > 0;
  const ROMAN = ['', 'I', 'II', 'III'], TIER_K = [0, 1, 1.25, 1.5], TIER_N = [0, 1, 3, 10];
  const ELTH = BL.ELTH;
  const RGB = { neutral: '235,225,200', water: '120,190,255', earth: '210,170,110', fire: '255,140,70', wind: '150,240,200', poison: '170,230,90',
    holy: '255,230,140', shadow: '170,120,255', ghost: '150,240,230', undead: '190,200,170' };
  // the art hits: one hidden skill per element (ATK or MATK, the higher)
  for (const el of NC.ELEMENTS) SK['bl_art_' + el] = { id: 'bl_art_' + el, name: 'วิชามอน', hidden: true, active: false, kind: 'active', type: 'best', element: el === 'neutral' ? null : el, max: 1, mul: () => 1, sp: () => 0, cd: 0, desc: () => '' };
  const sid = (el) => 'bl_art_' + (el || 'neutral');
  const palOf = (el) => (V.PAL && (V.PAL[el] || V.PAL.wind || V.PAL.fire)) || Object.values(V.PAL || {})[0];

  // ---------------- the families (name, text, cooldown) ----------------
  const FAM = {
    split: ['แตกร่าง', 'ทิ้งร่างแยก 2 ตัวล่อศัตรู 6 วิ พอหายไปแตกเป็นธาตุ{el} {p}% ATK', 18],
    bomb: ['วางระเบิด', 'วางระเบิดธาตุ{el} หน่วง 1.2 วิ ระเบิดวงกว้าง {p}% ATK', 14],
    heal: ['ยาประจำตัว', 'ฟื้นเลือดตัวเองและเพื่อนรอบตัว {h}% ของ HP สูงสุด', 30],
    shield: ['ตั้งโล่', 'ตั้งโล่ 3 วิ ลดดาเมจที่รับ 50% แล้วกระแทกกลับ {p}% ATK', 22],
    summon: ['เรียกลูกฝูง', 'เรียกลูกฝูงตัวจิ๋ว 2 ตัวช่วยสู้ 12 วิ ตัวละ {s}% ATK ต่อครั้ง', 35],
    shoot: ['ยิงพัด', 'ยิงกระสุนธาตุ{el} 3 ลูกเป็นรูปพัด ลูกละ {p}% ATK', 10],
    burrow: ['มุดดิน', 'มุดหายตัว 1.5 วิ (ศัตรูมองไม่เห็น) แล้วโผล่ทะลวง {p}% ATK', 16],
    sonic: ['คลื่นเสียง', 'ทิ้งวงคลื่นเสียงทำศัตรูมึน 1 วิ และ {p}% ATK', 15],
    spore: ['โปรยผง', 'โปรยผงรอบตัว ศัตรูช้าลง 4 วิ และ {p}% ATK', 18],
    swoop: ['โฉบ', 'โฉบไปข้างหน้า ฟันทุกตัวที่ผ่าน {p}% ATK', 12],
    leap: ['กระโดดทุบ', 'กระโดดไปจุดที่เล็ง ทุบพื้นธาตุ{el} {p}% ATK', 13],
    charge: ['พุ่งชน', 'พุ่งชนไปข้างหน้า ศัตรูกระเด็น {p}% ATK', 12],
    poison: ['บ่อพิษ', 'ทิ้งบ่อพิษ 5 วิ ศัตรูในบ่อเสีย {d}% ATK ทุกวินาที', 16],
    flame: ['ทางไฟ', 'วิ่งทิ้งทางไฟ 4 วิ ศัตรูที่เหยียบเสีย {d}% ATK ทุกครึ่งวินาที', 18],
    thread: ['ด้ายดึง', 'ดึงศัตรู 3 ตัวเข้าหาตัว {p}% ATK', 14],
    star: ['ดาวตก', 'ดาวตกเล็ก 3 ลูกลงรอบเป้า ลูกละ {p}% ATK (ศักดิ์สิทธิ์)', 16],
    hex: ['คำสาป', 'สาปศัตรูรอบเป้า 6 วิ รับดาเมจเพิ่ม 25% และ {p}% ATK', 20],
    phase: ['ร่างกลวง', 'ร่างเป็นเงา 1.5 วิ หลบทุกอย่าง แล้วฟันรอบตัว {p}% ATK', 18],
    quake: ['สะเทือนดิน', 'กระแทกพื้นรอบตัว ศัตรูล้ม 0.8 วิ {p}% ATK', 14],
    wave: ['คลื่นน้ำ', 'ปล่อยคลื่นเป็นแนวหน้าผลักศัตรู {p}% ATK', 12],
    gust: ['ลมหมุน', 'ลมหมุนรอบตัว 3 วิ ดูดศัตรูเข้ามา {d}% ATK ทุกครึ่งวินาที', 16],
    strike: ['ฟาดแรง', 'ฟาดเป้าหนักครั้งเดียว คริแน่นอน {p}% ATK', 10],
  };
  // bosses: [name, text, cooldown, move, mul (x ATK), extra]
  const BOSS = {
    bat_king: ['ฝูงค้างคาวราชา', 'ค้างคาว 6 ตัวพุ่งไล่ล่าศัตรู ตัวละ 120% ATK', 40, 'homing', 1.2, { n: 6 }],
    mushking: ['สวนเห็ดเรือง', 'วงเห็ด 8 วิ ศัตรูในวงช้าลงและติดพิษ ทุกวินาที 80% ATK', 45, 'zone', 0.8, { dur: 8, r: 230, slow: true, status: 'poison' }],
    ant_queen: ['คำสั่งราชินี', 'เรียกมดทหาร 3 ตัวสู้ด้วย 15 วิ ตัวละ 90% ATK', 50, 'summon', 0.9, { n: 3, dur: 15, as: 'soldier_ant' }],
    crypt_lord: ['มือจากหลุม', 'มือกระดูกโผล่ตามแนวตรง จับศัตรูนิ่ง 1.5 วิ 250% ATK', 35, 'line', 2.5, { stun: 1.5 }],
    lava_dragon: ['ลมหายใจลาวา', 'พ่นไฟเป็นกรวยต่อเนื่อง 2 วิ รวม 900% ATK', 40, 'breath', 1.5, { n: 6 }],
    hundred_string: ['ร้อยเส้นด้าย', 'ผูกศัตรู 5 ตัว รับดาเมจเพิ่ม 40% 8 วิ แล้วดึงเข้าหาตัว', 45, 'bind', 1.5, { n: 5, k: 1.4, dur: 8 }],
    aurelion: ['ดาวที่ร่วงหล่น', 'ดาวตกลูกใหญ่ตรงจุดเล็ง (หน่วง 1.5 วิ) 1,500% ATK ศักดิ์สิทธิ์', 90, 'meteor', 15, { r: 260, el: 'holy' }],
    sb_ivy: ['ขโมยไฟ', 'ระเบิดไฟรอบตัว ตัวที่ติดไฟอยู่โดนแรงขึ้นสองเท่า 300% ATK', 20, 'nova', 3, { r: 200, el: 'fire', burnX2: true }],
    sb_morrow: ['ยาเถื่อน', 'ปาขวดยาพิษ 3 ขวด ลูกละ 200% ATK ศัตรูช้าลง และฟื้น HP ตัวเอง 10%', 18, 'flasks', 2, { heal: 0.1 }],
    sb_raven: ['เงาพี่ชาย', 'เงาของเรายืนข้างตัว 8 วิ ฟันศัตรูทุกวินาที 150% ATK', 40, 'shade', 1.5, { dur: 8 }],
    sb_halvard: ['กำแพงเกลือ', 'กำแพงเกลือรอบตัว 5 วิ รับดาเมจลด 70%', 30, 'wall', 0, { dur: 5, k: 0.3 }],
    sb_ignis: ['ป้อนไฟ', 'จุดไฟทุกตัวรอบตัว แล้วระเบิดเปลวไฟ 400% ATK', 25, 'nova', 4, { r: 260, el: 'fire', burn: true }],
    sb_vosse: ['ตำราลมคลั่ง', 'ใบมีดลมหมุนรอบตัว 6 วิ ทุกครึ่งวินาที 120% ATK', 30, 'orbit', 1.2, { dur: 6, el: 'wind' }],
    sb_gareth: ['คำสาบานแตก', 'ATK +40% แต่รับดาเมจ +40% 10 วิ', 40, 'oath', 0, { dur: 10 }],
    sb_aldric: ['สั่งยิง', 'ห่าธนูเงาลงพื้นที่ 3 วิ รวม 12 ดอก ดอกละ 150% ATK', 35, 'rain', 1.5, { n: 12, dur: 3 }],
    sb_gorm: ['พุ่งเขาอสูร', 'พุ่งชนไกล ทะลุทุกตัว 400% ATK', 25, 'charge', 4, { dist: 420 }],
    sb_candle: ['เทียนไขละลาย', 'วางเทียน 3 เล่ม ระเบิดไฟใส่ศัตรูที่เข้าใกล้ เล่มละ 300% ATK', 25, 'mines', 3, { n: 3, el: 'fire' }],
    sb_quill: ['หมึกจารึก', 'ตราบนพื้น 8 วิ ศัตรูบนตรารับดาเมจเพิ่ม 30%', 35, 'mark', 0, { dur: 8, k: 1.3, r: 240 }],
    sb_nocturne: ['ราตรีศักดิ์สิทธิ์', 'รอบตัวเป็นกลางคืน 10 วิ (นับกับของแปดเปื้อนและรูนจันทร์) และ 300% ATK รอบตัว', 60, 'night', 3, { dur: 10, el: 'shadow' }],
    sb_puppet1: ['ต้นแบบ', 'ใช้สกิลล่าสุดซ้ำอีกครั้ง (ไม่เสีย SP ไม่ติดคูลดาวน์)', 30, 'copy', 0, {}],
    sb_puppet6: ['สปริงหกครั้ง', 'กระโดดกระแทก 6 ครั้งรอบตัว ครั้งละ 150% ATK', 30, 'bounce6', 1.5, { n: 6 }],
    sb_severin: ['พิพากษาแก้ว', 'ระฆังแก้วตกใส่ทุกตัวที่ติดสถานะผิดปกติ ตัวละ 300% ATK', 30, 'judge', 3, { el: 'holy' }],
    sb_lumen3: ['ไฟดวงสุดท้าย', 'ภายใน 60 วิ ถ้า HP จะหมด ฟื้นทันที 30% (ครั้งเดียว)', 600, 'lastflame', 0, { dur: 60 }],
  };

  // ---------------- the species list ----------------
  const species = () => Object.keys(NC.SPECIES || {}).filter((t) => !(NC.SPECIES[t] && NC.SPECIES[t].eliteOf));
  const lvOf = (t) => {
    const W = NC.LOOT_DATA && NC.LOOT_DATA.top && NC.LOOT_DATA.top[t];
    if (W) return W;
    const B = NC.BOSSES && NC.BOSSES[t];
    return (B && (B.lv || B.level)) || (NC.MON_LV && NC.MON_LV[t]) || 30;
  };
  const isBossT = (t) => !!BOSS[t] || !!(NC.BOSSES && NC.BOSSES[t]);
  function artOf(t) {
    const M = NC.MONSTERS[t] || NC.SPECIES[t] || {}, el = M.element || 'neutral', lv = lvOf(t);
    const p = 60 + 2 * lv;
    if (BOSS[t]) { const [n, d, cd, move, mul, x] = BOSS[t]; return { t, n, d, cd, move, mul, x: x || {}, el: (x && x.el) || el, lv, boss: true, mon: M.name || t }; }
    const fam = BL.familyOf(t), F = FAM[fam];
    const d = F[1].replace('{el}', ELTH(el)).replace('{p}', p).replace('{h}', 8 + Math.floor(lv / 10)).replace('{s}', 30 + Math.floor(lv / 2)).replace('{d}', 12 + Math.floor(lv / 4));
    return { t, fam, n: F[0], d, cd: F[2], el, lv, mul: p / 100, x: {}, mon: M.name || t };
  }

  // ---------------- what the hero has: copies per species, two slots ----------------
  const AS = { got: {}, slots: [null, null] };
  const tierOf = (t) => { const n = AS.got[t] || 0; return n >= 10 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0; };
  function gain(game, t, n) {
    const before = tierOf(t);
    AS.got[t] = (AS.got[t] || 0) + (n || 1);
    const a = artOf(t), p = game.player;
    FX.stars(p.x, p.y - 80, 18, '200,170,255', { speed: 260 });
    V.ring(p.x, p.y, 20, 170, 9, '200,170,255', 0.55);
    const up = tierOf(t) > before;
    game.toast(before ? (up ? `วิชามอน ${a.n} (${a.mon}) ขึ้นขั้น ${ROMAN[tierOf(t)]}!` : `เสียงสะท้อน ${a.n} (${a.mon}) ×${AS.got[t]}`) : `ได้วิชามอน! ${a.n} จาก${a.mon} · คลิกช่อง 7 / 8 เพื่อใส่`);
    NC.HUD.log(`ได้เสียงสะท้อน: ${a.n} (${a.mon}) ×${AS.got[t]}`, 'item');
    if (!AS.slots[0] && !AS.slots.includes(t)) AS.slots[0] = t; else if (!AS.slots[1] && !AS.slots.includes(t)) AS.slots[1] = t;
    save(game); paint(game.player, true);
  }

  // ---------------- the moves ----------------
  const aimAt = (game, p) => (game.mouse && game.mouse.active ? [game.mouse.wx, game.mouse.wy + 10] : [p.x + Math.cos(p.aim || 0) * 260, p.y + Math.sin(p.aim || 0) * 200]);
  const nearestTo = (game, x, y, r, n) => game.enemies.filter((e) => alive(e) && NC.dist(e.x, e.y, x, y) < r).sort((a, b) => NC.dist(a.x, a.y, x, y) - NC.dist(b.x, b.y, x, y)).slice(0, n || 1);
  const hit = (game, p, a, e, k, extra) => K.hit(game, p, sid(extra && extra.el || a.el), e, 0, 0, RGB[a.el], k, extra);
  const nova = (game, p, a, x, y, r, k, o) => K.nova(game, p, sid((o && o.el) || a.el), x, y, r, Object.assign({ rgb: RGB[(o && o.el) || a.el], mul: k, sure: true }, o || {}));
  function decoys(game, p, a, k, n, life, act) {
    const T = NC.Pets.KINDS, spr = NC.SPR[a.t] ? a.t : 'slime_green';
    for (let i = 0; i < n; i++) {
      const type = 'bl_pet' + i;
      T[type] = { a: spr, b: NC.SPR[spr + '_b'] ? spr + '_b' : spr, fly: 0, speed: 340, r: 20, reach: act ? 110 : 0, solid: true, shadow: [24, 8] };
      const q = NC.Pets.summon(game, p, type, { dur: life, hp: 0.25, scale: 0.6, name: a.mon, glow: RGB[a.el],
        act: act ? (g, q2, e) => { if (alive(e)) hit(g, p, a, e, k); } : null });
      if (q) { q.x = p.x + (i ? 70 : -70); q.y = p.y + 20; }
      if (!act && q) V.at(life, () => { nova(game, p, a, q.x, q.y, 170, k * 1.2); });
    }
  }
  const MOVES = {
    split: (game, p, a, k) => decoys(game, p, a, k, 2, 6, false),
    bomb(game, p, a, k) { const [x, y] = aimAt(game, p); V.circle(x, y, 150, RGB[a.el], 1.2, { style: 'arcane', spin: 2, grow: true, a: 0.6 }); V.at(1.2, () => { nova(game, p, a, x, y, 170, k * 1.3, { kb: 160 }); V.shake(game, 6); }); },
    heal(game, p, a) { const amt = p.maxHp * (0.08 + Math.floor(a.lv / 10) / 100); K.heal(game, p, amt); K.buffFriends(game, p, { r: 520, dur: 1, heal: () => amt * 0.6, rgb: '150,255,170' }); },
    shield(game, p, a, k) { p._blArtGuard = { until: game.time + 3, k: 0.5 }; V.ring(p.x, p.y, 30, 130, 10, RGB[a.el], 0.6); V.at(3, () => nova(game, p, a, p.x, p.y, 190, k, { kb: 200 })); },
    summon: (game, p, a, k) => decoys(game, p, a, k * 0.6, 2, 12, true),
    shoot(game, p, a, k) { for (const da of [-0.22, 0, 0.22]) K.shot(game, p, sid(a.el), { ang: (p.aim || 0) + da, v: 950, range: 700, rgb: RGB[a.el], mul: k, size: 1.2 }); },
    burrow(game, p, a, k) {
      p.inv = Math.max(p.inv, 1.5); p._blHide = game.time + 1.5;
      for (const e of game.enemies) if (e.tgt === p) { e.tgt = null; e.tgtLock = 0; }
      V.smoke(p.x, p.y - 10, 10, '#6a5238', '#8a7058', { size: 1, lifeK: 0.7 });
      V.at(1.5, () => { const e = nearestTo(game, p.x, p.y, 420)[0]; if (e) K.blink(game, p, e.x - 40, e.y, { rgb: RGB[a.el] }); nova(game, p, a, p.x, p.y, 150, k * 1.3, { kb: 120 }); });
    },
    sonic(game, p, a, k) { V.ring(p.x, p.y, 20, 220, 10, '210,190,255', 0.5); nova(game, p, a, p.x, p.y, 210, k, { status: ['stun', 1] }); },
    spore(game, p, a, k) { V.smoke(p.x, p.y - 30, 14, '#cfe8b0', '#f4ffe0', { size: 1.2, lifeK: 0.8 }); for (const e of nova(game, p, a, p.x, p.y, 230, k)) K.slow(e, 4); },
    swoop(game, p, a, k) { K.dash(game, p, sid(a.el), p.aim || 0, 300, 0.25, { rgb: RGB[a.el], mul: k }); },
    leap(game, p, a, k) { const [x, y] = aimAt(game, p), d = Math.min(360, NC.dist(p.x, p.y, x, y)); K.dash(game, p, sid(a.el), NC.angle(p.x, p.y, x, y), d, 0.3, { hit: () => {}, end: () => nova(game, p, a, p.x, p.y, 180, k * 1.2, { kb: 180 }) }); },
    charge(game, p, a, k) { K.dash(game, p, sid(a.el), p.aim || 0, 340, 0.3, { rgb: RGB[a.el], mul: k, hit: (e) => { hit(game, p, a, e, k); e.kbx = (e.kbx || 0) + Math.cos(p.aim || 0) * 420; e.kby = (e.kby || 0) + Math.sin(p.aim || 0) * 300; } }); },
    poison(game, p, a, k) { const [x, y] = aimAt(game, p); K.zone(game, p, sid('poison'), x, y, 150, 5, 1, { rgb: RGB.poison, mul: k * 0.25 + 0.12, status: ['poison', 3, Math.max(1, Math.round(p.d.batk * 0.15))] }); },
    flame(game, p, a, k) { K.zone(game, p, sid('fire'), p.x, p.y, 90, 4, 0.5, { rgb: RGB.fire, follow: p, mul: k * 0.2 + 0.1 }); },
    thread(game, p, a, k) { for (const e of nearestTo(game, p.x, p.y, 520, 3)) { K.pull(e, p.x, p.y, 900); hit(game, p, a, e, k); FX.add({ type: 'cutline', x: p.x, y: p.y - 60, x1: e.x, y1: e.y - 50, w: 4, color: '235,225,200', life: 0.3 }); } },
    star(game, p, a, k) { const [x, y] = aimAt(game, p); for (let i = 0; i < 3; i++) V.at(0.15 * i, () => { const sx = x + NC.rand(-70, 70), sy = y + NC.rand(-35, 35); V.beam(sx, sy, 50, 520, RGB.holy, 0.3); nova(game, p, a, sx, sy, 100, k, { el: 'holy' }); }); },
    hex(game, p, a, k) { const [x, y] = aimAt(game, p); for (const e of nova(game, p, a, x, y, 170, k * 0.6)) K.vuln(game, e, 1.25, 6, RGB[a.el]); },
    phase(game, p, a, k) { p.inv = Math.max(p.inv, 1.5); V.ghost(p, '#9a6ad8', 0.6); V.at(1.5, () => nova(game, p, a, p.x, p.y, 190, k * 1.2)); },
    quake(game, p, a, k) { V.shake(game, 8); nova(game, p, a, p.x, p.y, 220, k, { status: ['stun', 0.8], kb: 120 }); },
    wave(game, p, a, k) { K.cone(game, p, sid(a.el), 380, 0.4, { mul: k, kb: 380 }); V.ring(p.x + Math.cos(p.aim || 0) * 160, p.y + Math.sin(p.aim || 0) * 110, 20, 160, 8, RGB.water, 0.45); },
    gust(game, p, a, k) { K.zone(game, p, sid(a.el), p.x, p.y, 200, 3, 0.5, { rgb: RGB.wind, follow: p, pull: 4, mul: k * 0.25 + 0.1 }); },
    strike(game, p, a, k) { const e = nearestTo(game, p.x, p.y, 260)[0]; if (e) { hit(game, p, a, e, k * 1.4, { crit: true, sure: true, big: true }); V.slash(e.x, e.y - 60, 70, -0.6, 2, 22, palOf(a.el), 0.25, { rgb: RGB[a.el] }); } },
    // boss moves
    homing(game, p, a, k) { const T = nearestTo(game, p.x, p.y, 700, a.x.n); for (let i = 0; i < a.x.n; i++) { const e = T[i % Math.max(1, T.length)]; K.shot(game, p, sid(a.el), { ang: (p.aim || 0) + (i - a.x.n / 2) * 0.25, v: 700, range: 900, target: e, home: 5, rgb: RGB[a.el], mul: k, style: 'ghost' }); } },
    zone(game, p, a, k) { const [x, y] = aimAt(game, p); K.zone(game, p, sid(a.el), x, y, a.x.r, a.x.dur, 1, { rgb: RGB[a.el], mul: k, status: a.x.status === 'poison' ? ['poison', 3, Math.max(1, Math.round(p.d.batk * 0.2))] : null, each: a.x.slow ? (e) => K.slow(e, 1.2) : null }); },
    summon2(game, p, a, k) { decoys(game, p, Object.assign({}, a, { t: a.x.as || a.t }), k, a.x.n || 2, a.x.dur || 12, true); },
    line(game, p, a, k) { const got = K.lineHits(game, p.x, p.y, p.aim || 0, 520, 60); for (const e of got || []) { hit(game, p, a, e, k); K.stun(game, e, a.x.stun); } V.ring(p.x + Math.cos(p.aim || 0) * 260, p.y + Math.sin(p.aim || 0) * 180, 20, 140, 8, RGB.undead, 0.4); },
    breath(game, p, a, k) { for (let i = 0; i < a.x.n; i++) V.at(i * 0.33, () => { K.cone(game, p, sid(a.el), 340, 0.45, { mul: k }); V.flameAt && V.flameAt(p.x + Math.cos(p.aim || 0) * 120, p.y - 30, 50, 90, V.PAL.fire, 0.4, { vx: Math.cos(p.aim || 0) * 300 }); }); },
    bind(game, p, a) { for (const e of nearestTo(game, p.x, p.y, 520, a.x.n)) { K.vuln(game, e, a.x.k, a.x.dur, '235,225,200'); K.pull(e, p.x, p.y, 700); } },
    meteor(game, p, a, k) { const [x, y] = aimAt(game, p); V.circle(x, y, a.x.r, RGB.holy, 1.5, { style: 'arcane', spin: 3, grow: true, a: 0.8 }); V.at(1.5, () => { V.beam(x, y, 140, 900, RGB.holy, 0.5); V.shake(game, 14); nova(game, p, a, x, y, a.x.r, k, { el: 'holy', big: true }); }); },
    nova2(game, p, a, k) { for (const e of game.enemies) if (alive(e) && NC.dist(e.x, e.y, p.x, p.y) < a.x.r) { if (a.x.burn && NC.addStatus) NC.addStatus(game, e, 'burn', 4); const burning = NC.statusOf && NC.statusOf(e, 'burn'); hit(game, p, a, e, k * (a.x.burnX2 && burning ? 2 : 1)); } V.ring(p.x, p.y, 20, a.x.r, 12, RGB[a.el], 0.5); },
    flasks(game, p, a, k) { const [x, y] = aimAt(game, p); for (let i = 0; i < 3; i++) V.at(i * 0.15, () => { const fx = x + NC.rand(-80, 80), fy = y + NC.rand(-40, 40); for (const e of nova(game, p, a, fx, fy, 110, k, { el: 'poison' })) K.slow(e, 3); }); K.heal(game, p, p.maxHp * a.x.heal); },
    shade(game, p, a, k) { const until = game.time + a.x.dur; const tick = () => { if (game.time > until || p.dead > 0) return; const e = nearestTo(game, p.x, p.y, 200)[0]; if (e) { hit(game, p, a, e, k); V.slash(e.x, e.y - 60, 60, 0.6, 1.8, 18, palOf('shadow'), 0.2, { rgb: RGB.shadow }); } V.at(1, tick); }; V.ghost(p, '#4a2a6e', 0.8); V.at(1, tick); },
    wall(game, p, a) { p._blArtGuard = { until: game.time + a.x.dur, k: a.x.k }; V.ring(p.x, p.y, 40, 150, 14, '235,235,255', 0.8); },
    orbit(game, p, a, k) { K.zone(game, p, sid(a.el), p.x, p.y, 160, a.x.dur, 0.5, { rgb: RGB.wind, follow: p, mul: k }); },
    oath(game, p, a) { p._blOath = game.time + a.x.dur; NC.applyGear(game); V.at(a.x.dur, () => NC.applyGear(game)); V.ring(p.x, p.y, 20, 140, 10, '255,120,90', 0.5); },
    rain(game, p, a, k) { const [x, y] = aimAt(game, p); K.rain(game, p, sid(a.el), x, y, 200, a.x.n, a.x.dur, { mul: k, rgb: RGB.shadow }); },
    charge2(game, p, a, k) { K.dash(game, p, sid(a.el), p.aim || 0, a.x.dist, 0.35, { rgb: RGB.earth, mul: k }); },
    mines(game, p, a, k) { for (let i = 0; i < a.x.n; i++) { const mx = p.x + Math.cos((i / a.x.n) * 6.28) * 120, my = p.y + Math.sin((i / a.x.n) * 6.28) * 80; let done = false; V.circle(mx, my, 40, RGB.fire, 12, { style: 'arcane', spin: 1, a: 0.6 }); K.zone(game, p, sid('fire'), mx, my, 70, 12, 0.25, { hits: false, circle: false, glow: false, each: () => { if (done) return; done = true; nova(game, p, a, mx, my, 150, k, { el: 'fire' }); } }); } },
    mark(game, p, a) { const [x, y] = aimAt(game, p); K.zone(game, p, sid(a.el), x, y, a.x.r, a.x.dur, 0.5, { hits: false, rgb: '180,150,255', each: (e) => K.vuln(game, e, a.x.k, 1, '180,150,255') }); },
    night(game, p, a, k) { BL.forceNight = game.time + a.x.dur; NC.applyGear(game); V.at(a.x.dur, () => NC.applyGear(game)); nova(game, p, a, p.x, p.y, 220, k, { el: 'shadow' }); },
    copy(game, p) { const id = p._blLastCast; if (id && NC.SKILL_RUN[id]) { try { NC.SKILL_RUN[id](game, p, NC.skillLv(p, id), 'q'); } catch (e) { /* skip */ } } },
    bounce6(game, p, a, k) { for (let i = 0; i < a.x.n; i++) V.at(i * 0.25, () => { const e = nearestTo(game, p.x, p.y, 320)[0]; if (e) K.blink(game, p, e.x - 30, e.y, { line: false }); nova(game, p, a, p.x, p.y, 140, k); }); },
    judge(game, p, a, k) { for (const e of game.enemies) if (alive(e) && NC.dist(e.x, e.y, p.x, p.y) < 700 && (e.stun > 0 || e.slow > 0 || e.poison && e.poison.t > 0 || (e.st && Object.values(e.st).some((s) => s.t > 0)))) { V.beam(e.x, e.y, 40, 500, RGB.holy, 0.3); hit(game, p, a, e, k, { el: 'holy' }); } },
    lastflame(game, p, a) { p._blLastFlame = game.time + a.x.dur; V.ring(p.x, p.y, 20, 120, 8, '255,170,90', 0.5); },
  };
  MOVES.summon_boss = MOVES.summon2;
  const MOVE_OF = { summon: 'summon2', nova: 'nova2', charge: 'charge2' };
  // the boss moves' extra states
  if (NC.heroGuards) NC.heroGuards.push((game, p, dmg) => {
    const G = p._blArtGuard;
    if (G && game.time < G.until) dmg *= G.k;
    if (p._blLastFlame && game.time < p._blLastFlame && p.hp - dmg <= 0) { p._blLastFlame = 0; p.hp = Math.round(p.maxHp * 0.3); FX.stars(p.x, p.y - 80, 24, '255,170,90', { speed: 300 }); game.toast('ไฟดวงสุดท้าย!'); return 0; }
    return dmg;
  });
  NC.skillModSources.push((p) => (p && p.kind === 'player' && NC.game && p._blOath > NC.game.time ? { atk: 40, taken: -40 } : null));
  NC.skillCasts.push((game, p, id) => { if (p === game.player && SK[id] && !SK[id].hidden) p._blLastCast = id; });
  // the shadow move: night while it lasts (taints and the moon rune read BL.night)
  const night0 = BL.night;
  BL.night = (G) => (BL.forceNight && G && G.time < BL.forceNight) || night0(G);

  // ---------------- casting: keys 7 / 8, the slots ----------------
  const want = [false, false];
  addEventListener('keydown', (e) => {
    const t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || e.repeat) return;
    if (e.code === 'Digit7') want[0] = true;
    if (e.code === 'Digit8') want[1] = true;
  });
  function cast(game, i) {
    const p = game.player, t = AS.slots[i];
    if (!t || !tierOf(t) || p.dead > 0 || p.casting || p.channel || game.paused || (p.cd['blart' + i] || 0) > 0) return false;
    if (NC.HS && NC.HS.noSkill(p)) return false; // (stunned, frozen, asleep or silenced: js/hstatus.js)
    const a = artOf(t), tier = tierOf(t), k = (a.mul || 1) * TIER_K[tier] * (NC.PvP && NC.PvP.duel ? 0.5 : 1);
    const fn = a.boss ? MOVES[MOVE_OF[a.move] || a.move] : MOVES[a.fam];
    if (!fn) return false;
    p.cd['blart' + i] = p.cdFull['blart' + i] = a.cd;
    p.combat = 1; p.lastFight = game.time;
    try { fn(game, p, a, k); } catch (err) { console.warn('monster art', t, err); }
    NC.HUD.log(`วิชามอน: ${a.n}`, 'skill');
    return true;
  }

  // the two slots on the hotbar (like the dash slot, js/dash.js)
  const SL = [];
  function makeSlots() {
    const bar = document.querySelector('#hud .hotbar');
    if (!bar || SL.length) return;
    for (let i = 0; i < 2; i++) {
      const s = document.createElement('div');
      s.className = 'hslot skill blart'; s.id = 'hs-blart' + i;
      s.innerHTML = `<span class="key">${7 + i}</span><img alt=""><div class="cd"></div><span class="cdt"></span>`;
      s.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (AS.slots[i] && !e.shiftKey) want[i] = true; else openBook(); });
      s.addEventListener('contextmenu', (e) => { e.preventDefault(); openBook(); });
      bar.insertBefore(s, bar.querySelector('#hs-dash') || bar.querySelector('.expbars') || null);
      SL.push({ el: s, img: s.querySelector('img'), cd: s.querySelector('.cd'), cdt: s.querySelector('.cdt'), shown: '' });
    }
  }
  const iconCache = {};
  function monIcon(t) {
    if (iconCache[t]) return iconCache[t];
    const S = NC.SPR[t];
    let src = BL.icon('bl_echo');
    if (S && S.ready === false) { if (NC.Sprites) NC.Sprites.need([t], 1); return src; } // (still streaming in, js/assets.js: the crystal for now, nothing kept)
    try { if (S && S.img) { const c = document.createElement('canvas'), w = S.img.naturalWidth || S.img.width, h = S.img.naturalHeight || S.img.height, m = Math.max(w, h); c.width = c.height = 96; c.getContext('2d').drawImage(S.img, (96 - (w * 96) / m) / 2, (96 - (h * 96) / m) / 2, (w * 96) / m, (h * 96) / m); src = c.toDataURL(); } } catch (e) { /* the crystal */ }
    return (iconCache[t] = src);
  }
  function paint(p, force) {
    if (!SL.length) return;
    if (document.documentElement.classList.contains('mob')) { const it = document.getElementById('mb-items'); if (it) for (const s of SL) if (s.el.parentNode !== it) it.appendChild(s.el); }
    for (let i = 0; i < 2; i++) {
      const S = SL[i], t = AS.slots[i], key = (t || '') + ':' + tierOf(t || '');
      if (force || S.shown !== key) {
        S.shown = key;
        S.img.src = t ? monIcon(t) : BL.icon('bl_echo');
        S.el.classList.toggle('empty', !t);
        const a = t && artOf(t);
        S.el.title = t ? `${a.n} ${ROMAN[tierOf(t)]} (${a.mon}) · ${a.d} · คูลดาวน์ ${a.cd} วิ · ปุ่ม ${7 + i} · คลิกขวาเปิดสมุดวิชามอน` : `ช่องวิชามอน (ปุ่ม ${7 + i}) · คลิกเพื่อเปิดสมุดวิชามอน`;
      }
      const left = (p.cd && p.cd['blart' + i]) || 0, full = (p.cdFull && p.cdFull['blart' + i]) || 1;
      S.cd.style.setProperty('--p', left > 0 ? Math.round((100 * left) / full) + '%' : '0%');
      S.cdt.textContent = left > 0 ? (left >= 1 ? String(Math.ceil(left)) : left.toFixed(1)) : '';
    }
  }
  const baseUpd = NC.updatePlayer;
  NC.updatePlayer = function (g, dt) {
    const p = g.player;
    if (p) for (let i = 0; i < 2; i++) if (want[i]) { want[i] = false; cast(g, i); }
    if (p && p._blHide > g.time) for (const e of g.enemies) if (e.tgt === p) { e.tgt = null; e.tgtLock = 0; }
    const res = baseUpd.apply(this, arguments);
    if (p) paint(p);
    return res;
  };
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) { baseInit(game); makeSlots(); paint(game.player, true); };

  // ---------------- the book: every art the hero has, put one in a slot ----------------
  let win = null, filter = '';
  function openBook() {
    const game = NC.game;
    if (!win) {
      win = document.createElement('div');
      win.id = 'blarts'; win.className = 'panel'; win.hidden = true;
      win.innerHTML = '<div class="card shop forge"><div class="ptitle"><span>สมุดวิชามอน</span><button id="bla-close" aria-label="ปิด">✕</button></div><div id="bla-body"></div></div>';
      document.body.appendChild(win);
      win.querySelector('#bla-close').addEventListener('click', () => { win.hidden = true; game.paused = false; });
      addEventListener('keydown', (e) => { if (e.key === 'Escape' && win && !win.hidden) { e.stopPropagation(); win.hidden = true; game.paused = false; } }, true);
      win.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.blaset) { const [t, i] = b.dataset.blaset.split(':'); const j = AS.slots.indexOf(t); if (j >= 0) AS.slots[j] = null; AS.slots[Number(i)] = t; save(game); paint(game.player, true); render(); }
        if (b.dataset.blaoff) { AS.slots[Number(b.dataset.blaoff)] = null; save(game); paint(game.player, true); render(); }
        if (b.dataset.blaf !== undefined) { filter = b.dataset.blaf; render(); }
      });
    }
    win.hidden = false; game.paused = true;
    render();
  }
  function render() {
    if (!win || win.hidden) return;
    const mine = Object.keys(AS.got).filter((t) => AS.got[t] > 0 && (NC.SPECIES[t] || BOSS[t])).map(artOf).sort((a, b) => (b.boss - a.boss) || b.lv - a.lv);
    const all = species().length + Object.keys(BOSS).filter((t) => !NC.SPECIES[t]).length;
    const list = mine.filter((a) => !filter || (filter === 'boss' ? a.boss : !a.boss));
    const slotsH = [0, 1].map((i) => { const t = AS.slots[i], a = t && artOf(t); return `<div class="fg-act"><b>ช่อง ${7 + i}</b><span>${a ? `${esc(a.n)} ${ROMAN[tierOf(t)]} · ${esc(a.mon)}` : 'ว่าง'}</span>${a ? `<button class="big alt" data-blaoff="${i}">เอาออก</button>` : ''}</div>`; }).join('');
    win.querySelector('#bla-body').innerHTML = `<div class="fg-jobs">มีแล้ว ${mine.length} / ${all} วิชา · เก็บซ้ำ 1 / 3 / 10 ชิ้น = ขั้น I / II / III · กด 7 / 8 ใช้วิชาในช่อง</div>` +
      `<div class="fg-kinds">${[['', 'ทั้งหมด'], ['mon', 'มอน'], ['boss', 'บอส']].map(([k, t]) => `<button data-blaf="${k}" class="${filter === k ? 'on' : ''}">${t}</button>`).join('')}</div>` +
      `<div class="fg-make">${slotsH}</div>` +
      '<div class="fg-make">' + (list.length ? list.map((a) => {
        const tr = tierOf(a.t), next = tr < 3 ? ` · อีก ${TIER_N[tr + 1] - AS.got[a.t]} ชิ้นถึงขั้น ${ROMAN[tr + 1]}` : ' · ขั้นสูงสุด';
        return `<div class="fg-recipe"><img class="fg-ic" src="${monIcon(a.t)}" alt=""><div class="fg-rt"><b>${esc(a.n)} ${ROMAN[tr]}${a.boss ? ' · บอส' : ''}</b>` +
          `<small>${esc(a.mon)} Lv ${a.lv} · ธาตุ${esc(ELTH(a.el))} · คูลดาวน์ ${a.cd} วิ · ×${AS.got[a.t]}${next}</small><div class="fg-need"><span>${esc(a.d)}</span></div></div>` +
          `<button class="big" data-blaset="${a.t}:0">ช่อง 7</button><button class="big alt" data-blaset="${a.t}:1">ช่อง 8</button></div>`;
      }).join('') : '<div class="fg-empty">ยังไม่มีวิชามอน · มอนทุกสายพันธุ์มีโอกาสดรอปเสียงสะท้อนของท่าประจำตัว (บอสดรอปง่ายกว่า)</div>') + '</div>';
  }

  // ---------------- drops ----------------
  const rateOf = (e) => { if (/^sb_/.test(e.type || '') || e.type === 'aurelion') return 0.03; if (isBossT(e.type) || e.isBoss) return 0.02; const lv = e.lv || lvOf(e.type); return lv <= 40 ? 0.001 : lv <= 80 ? 0.0006 : 0.0004; };
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const was = e.hp;
    baseDamage(game, e, r, kx, ky, o);
    if (!(was > 0 && e.hp <= 0) || e.lootless || game.time - (e._heroT || -9) > 1) return;
    const S = NC.SPECIES && NC.SPECIES[e.type], t = S && S.eliteOf ? S.eliteOf : e.type;
    if (!(NC.SPECIES[t] || BOSS[t])) return;
    if (Math.random() < rateOf(e)) gain(game, t, 1);
  };

  // ---------------- saving ----------------
  const KEY = NC.BL_SAVE_KEY || 'nightcamp.buildloot.v1';
  function save(game) {
    if (game.noSave) return;
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
    s.arts = { got: AS.got, slots: AS.slots };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ }
  }
  const baseSave = NC.saveGame;
  NC.saveGame = function (game) { baseSave.apply(this, arguments); save(game); };
  const baseLoad = NC.loadGear;
  NC.loadGear = function (game, prm) {
    baseLoad.apply(this, arguments);
    AS.got = {}; AS.slots = [null, null];
    if (!NC.ONLINE) try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s && s.arts) { for (const t in s.arts.got || {}) AS.got[t] = Math.max(0, s.arts.got[t] | 0); AS.slots = (s.arts.slots || [null, null]).slice(0, 2).map((t) => (t && AS.got[t] ? t : null)); } } catch (e) { /* none */ }
  };

  BL.arts = { FAM, BOSS, artOf, tierOf, got: AS, gain: (t, n) => gain(NC.game, t, n), cast: (i) => cast(NC.game, i), open: openBook, MOVES };
})();
