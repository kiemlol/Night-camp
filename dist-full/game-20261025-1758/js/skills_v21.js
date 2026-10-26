/* skills_v21.js — the skill plan v2.1 the user asked for on 2026-09-27 (the Artifact "สายสกิล Night Camp", v2.1):
   - an auto-attack line in every job, like classic MMOs' AGI builds: faster swings, double / triple hits, criticals, and
     things that go off with a basic hit (a cleave, a spell cast by itself, the falcon, the wolf, shuriken, holy light)
   - buff builds: the knight's Berserk (fast and strong, basic hits only, the HP drains); the priest's party buffs as real
     stat points (Holy Blessing STR INT DEX, Swift Grace AGI, Hymn of Fortune LUK, Swift Chant: faster casting) and the bishop's
     high line (Shared Blessing, Song of Swiftness, Rite of Haste, Piercing Grace); the ranger's Inner Eye and Breaking Point
   - the hunter's falcon: it sits on the shoulder, Falcon Strike sends it, and it dives by itself off basic shots (LUK)
   - the rogue's pure critical line into the assassin's
   The 40 new skills are defined here with their effects, and some old ones are reworked (Swift Blade to 10 levels,
   Holy Blessing / Swift Grace as stat points, dagger and katar mastery). Which line each skill sits in and what it needs:
   skillplan.js. The basic-hit effects run off skilltree.js's NC.basicHits; a few rules live here too: Berserk locks the
   attack skills (castSkill), Breaking Point drops DEF to 0 (derive), Piercing Grace pierces DEF and Inner Eye never misses
   (heroHit), the party buffs speed up the AI friends (atkSpeed). Loaded after casting.js (its castSkill is the
   outermost one), before skillplan.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX, K = NC.SkillKit, RUN = NC.SKILL_RUN, SK = NC.SKILLS, H = NC.skillHelpers;
  const { C, P, TAU } = K;
  const rand = NC.rand, S = K.S, r1 = (v) => Math.round(v * 10) / 10, lerp = NC.lerp;
  const W = (p) => NC.weaponDef(p) || {};
  const lvOf = (p, id) => NC.skillLv(p, id);
  const melee = (p) => { const w = W(p); return !!w.style && !w.magic && w.style !== 'arrow'; };
  const bow = (p) => W(p).style === 'arrow';
  const staff = (p) => !!W(p).magic;
  const dual = (p) => !!W(p).dual;
  const spear = (p) => W(p).style === 'thrust';
  const on = (p, id) => K.buffOn(p, id);
  const bl = (p, id) => (on(p, id) ? (p.buffLv && p.buffLv[id]) || 1 : 0); // a running buff's level (0: off)
  const roll = (pct) => Math.random() * 100 < pct;
  const alive = K.alive;
  const pct = (k) => Math.round(k * 100);
  const HOLY = C.holy, RAGE = '255,70,60', TEAL = '120,255,220', FALCON = '160,220,255', GOLD = '255,215,90';
  const party = () => (NC.allies ? NC.allies(NC.game) : NC.Party && NC.Party.members) || []; // (+ the real players: js/partysupport.js)

  // ================= the new skills =================
  // short buffs set off by hits (they show on the buff bar); not in any job's list
  const X = (o) => S(Object.assign({ kind: 'buff', max: 1, hidden: true, sp: () => 0, cd: 0 }, o));
  K.def({
    // ---- knight: คลั่งศึก ----
    kn_cleave: S({ name: 'ฟันกวาด', icon: 'sk_kn_cleave', type: 'phys', mul: (lv) => 0.8 + lv * 0.03, pass: () => null,
      desc: (lv) => `ตีปกติระยะประชิด โดนศัตรูรอบเป้าด้วย ${lv * 2}% ของดาเมจ${lv >= 5 ? ' · กวาดกว้างขึ้น' : ''}${lv >= 10 ? ` · การตีครั้งที่ 5 ทุกครั้งปล่อยคลื่นดาบทะลุ ${pct(0.8 + lv * 0.03)}% ของ ATK` : ''}` }),
    kn_aurablade: S({ name: 'ดาบเรืองพลัง', icon: 'sk_kn_aurablade', kind: 'buff', max: 5, cd: 40, sp: (lv) => 18 + lv * 4, rgb: '150,205,255', circle: 'arcane',
      dur: (lv) => 40 + lv * 8, buff: () => ({}),
      desc: (lv) => `${40 + lv * 8} วิ: ตีปกติทุกครั้งแรงขึ้น ${lv * 6} + Base Lv ÷ 4 แบบไม่สน DEF${lv >= 5 ? ' · ติดไปกับฟันกวาดและคลื่นดาบด้วย' : ''}` }),
    kn_berserk: S({ name: 'บ้าคลั่ง', icon: 'sk_kn_berserk', kind: 'buff', ult: true, max: 5, cd: (lv) => 90 - lv * 6, sp: () => 30, rgb: RAGE, circle: 'occult',
      dur: (lv) => 15 + lv * 2, buff: (lv) => ({ aspd: 20, atk: 10 + lv * 2 }),
      desc: (lv) => `คลั่ง ${15 + lv * 2} วิ: ความเร็วโจมตี +20% ATK +${10 + lv * 2}% ดูดเลือด ${r1(2 + lv * 0.5)}% ของดาเมจที่ตี · ระหว่างคลั่งใช้ได้แค่ตีปกติกับบัฟ HP ลดวิละ 1.5% หมดแล้วเหนื่อย 5 วิ${lv >= 3 ? ' · ไม่สะดุ้งเมื่อโดนตี' : ''}${lv >= 5 ? ' · การตีครั้งที่ 3 ทุกครั้งปล่อยคลื่นดาบเล็ก' : ''}` }),
    kn_exhaust: X({ name: 'เหนื่อยหลังคลั่ง', icon: 'sk_kn_berserk', buff: () => ({ aspd: -20, spd: -20 }) }),
    x_quickcrit: X({ name: 'เพลงดาบเร่ง', icon: 'sk_kn_quicken', buff: () => ({ aspd: 20 }) }),
    // ---- paladin: ดาบศักดิ์สิทธิ์ ----
    pal_holyblade: S({ name: 'ดาบแสงสถิต', icon: 'sk_pal_holyblade', type: 'phys', element: 'holy', mul: (lv) => 0.8 + lv * 0.08, pass: () => null,
      desc: (lv) => `ตีปกติระยะประชิดแรงขึ้น ${lv * 4}% ด้วยแสง${lv >= 5 ? ` · การตีครั้งที่ 5 ทุกครั้งฟันกางเขนแสงรอบเป้า ${pct(0.8 + lv * 0.08)}% ของ ATK` : ''}${lv >= 10 ? ' · ตีปกติฟื้น HP 1% ของดาเมจ' : ''}` }),
    pal_zeal: S({ name: 'ศรัทธาร้อนแรง', icon: 'sk_pal_zeal', kind: 'buff', cd: 35, sp: (lv) => 20 + lv * 2, rgb: HOLY, circle: 'holy', enchant: 'holy', mul: () => 0.3,
      dur: (lv) => 30 + lv * 3, buff: (lv) => ({ aspd: lv * 2 }), aura: zealAura,
      desc: (lv) => `${30 + lv * 3} วิ: ความเร็วโจมตี +${lv * 2}% อาวุธเป็นธาตุแสง${lv >= 5 ? ' · ตีคริแล้วฟื้น HP 1%' : ''}${lv >= 10 ? ' · ออร่าแสงเผาศัตรูรอบตัววิละ 30% ของ ATK' : ''}` }),
    pal_faithblade: S({ name: 'ดาบแห่งศรัทธา', icon: 'sk_pal_faithblade', max: 5, type: 'phys', element: 'holy', mul: () => 1.5, pass: () => null,
      desc: (lv) => `ตีปกติฮีลคนที่เลือดน้อยสุดในทีม (รวมตัวเอง) 1% ของดาเมจ${lv >= 3 ? ' · ตีครบ 10 ครั้งปล่อยกางเขนแสงรอบตัว 150% ของ ATK' : ''}${lv >= 5 ? ' · บ้าคลั่งไม่เสีย HP และเปิดโล่อีจิสได้ระหว่างคลั่ง' : ''}` }),
    // ---- dragon knight: หอกรัว ----
    dk_quicken: S({ name: 'เร่งหอก', icon: 'sk_dk_quicken', kind: 'buff', cd: 30, sp: (lv) => 14 + lv * 2, rgb: '255,150,80', circle: 'arcane',
      dur: (lv) => 30 + lv * 3, buff: (lv, p) => (spear(p) ? { aspd: lv * 2, crit: r1(lv * 0.3), dbl: lv >= 5 ? 10 : 0 } : null),
      desc: (lv) => `${30 + lv * 3} วิ ถือหอก: ความเร็วโจมตี +${lv * 2}% คริติคอล +${r1(lv * 0.3)}%${lv >= 5 ? ' · ตีปกติโอกาส 10% แทงสองครั้ง' : ''}` }),
    dk_tail: S({ name: 'หางมังกร', icon: 'sk_dk_tail', type: 'phys', element: 'fire', mul: (lv) => 0.5 + lv * 0.05, pass: () => null,
      desc: (lv) => `ตีปกติระยะประชิดโอกาส ${r1(lv * 0.6)}% ปล่อยหอกไฟพุ่งทะลุเป็นแนว ${pct(0.5 + lv * 0.05)}% ของ ATK${lv >= 5 ? ' · ติดเผา' : ''}${lv >= 10 ? ' · แตกเป็น 3 แนว' : ''}` }),
    // ---- mage: เวทเร็ว ----
    mg_staffmastery: S({ name: 'ชำนาญคทา', icon: 'sk_mg_staffmastery', type: 'magic', mul: () => 0.5, pass: (lv, p) => (staff(p) ? { aspd: lv } : null),
      desc: (lv) => `ถือคทา: ลูกแก้วตีปกติแรงขึ้น ${lv * 4}% ความเร็วโจมตี +${lv}%${lv >= 5 ? ' · ลูกแก้วทะลุไปโดนอีกตัว 50%' : ''}${lv >= 10 ? ' · ยิงลูกแก้วลูกที่สอง 40%' : ''}` }),
    mg_autospell: S({ name: 'ร่ายอัตโนมัติ', icon: 'sk_mg_autospell', pass: () => null,
      desc: (lv) => `ตีปกติโอกาส ${r1(lv * 1.5)}% ร่ายลูกไฟ / หอกน้ำแข็ง / สายฟ้าฟาดเอง ตามใจธาตุที่เลเวลสูงสุด (เลเวลเวทไม่เกิน ${Math.ceil(lv * 0.7)}) ไม่ต้องร่าย ไม่เสีย SP (ได้ทุก 0.8 วิ)${lv >= 5 ? ' · SP เกิน 80% โอกาสเพิ่ม 30%' : ''}${lv >= 10 ? ' · โอกาส 30% ร่ายสองธาตุพร้อมกัน' : ''}` }),
    mg_memorize: S({ name: 'จดจำเวท', icon: 'sk_mg_memorize', kind: 'buff', max: 5, cd: 60, sp: (lv) => 25 + lv * 3, rgb: '170,150,255', circle: 'arcane',
      dur: () => 30, buff: (lv) => ({ castRed: lv * 10 }),
      desc: (lv) => `30 วิ: เวลาร่ายลดลง ${lv * 10}%${lv >= 5 ? ' · ร่ายครั้งแรกหลังเปิดออกทันที' : ''}` }),
    // ---- archmage: เวทรัวหลอมธาตุ ----
    am_doublecast: S({ name: 'เวทคู่', icon: 'sk_am_doublecast', type: 'magic', mul: () => 1.5, pass: () => null,
      desc: (lv) => `เวทจากร่ายอัตโนมัติและลูกแก้วตีปกติ มีโอกาส ${lv}% ออกซ้ำอีกครั้ง${lv >= 5 ? ' · ครั้งที่สองเป็นอีกธาตุ (เกิดปฏิกิริยาได้)' : ''}${lv >= 10 ? ' · ออกซ้ำครบ 10 ครั้งปล่อยพายุสามธาตุ 150% ของ MATK' : ''}` }),
    am_arcaneflux: S({ name: 'ประกายเวท', icon: 'sk_am_arcaneflux', kind: 'buff', cd: 40, sp: (lv) => 24 + lv * 2, rgb: '120,220,255', circle: 'arcane', mul: () => 0.6,
      dur: (lv) => 30 + lv * 3, buff: (lv, p) => Object.assign(staff(p) ? { aspd: lv, matk: lv } : {}, lv >= 5 ? { castRed: 20 } : {}), aura: fluxAura,
      desc: (lv) => `${30 + lv * 3} วิ ถือคทา: ความเร็วโจมตี +${lv}% MATK +${lv}%${lv >= 5 ? ' · เวลาร่ายลดลง 20%' : ''}${lv >= 10 ? ' · วงเวทรอบตัวยิงลูกแก้วใส่ศัตรูเองทุก 1.5 วิ (60% ของ MATK)' : ''}` }),
    // ---- warlock: ตะเกียงแกว่ง ----
    wl_swing: S({ name: 'ตะเกียงแกว่ง', icon: 'sk_wl_swing', type: 'magic', element: 'shadow', mul: (lv) => 0.4 + lv * 0.04, pass: () => null,
      desc: (lv) => `ลูกแก้วตีปกติเป็นไฟวิญญาณ ติดเผา แล้วกระโดดไปอีก ${lv >= 5 ? 2 : 1} ตัว ${pct(0.4 + lv * 0.04)}% ของ MATK${lv >= 10 ? ' · ฆ่าได้แล้วได้ดวงวิญญาณเพิ่ม' : ''}` }),
    wl_drain: S({ name: 'ดูดวิญญาณ', icon: 'sk_wl_drain', pass: () => null,
      desc: (lv) => `ตีปกติดูด HP ${lv}% ของดาเมจ และ SP ${r1(lv * 0.2)}%${lv >= 10 ? ' · HP เต็มแล้วส่วนเกินเป็นบาเรีย (สูงสุด 20% ของ HP)' : ''}` }),
    wl_blaze: S({ name: 'ตะเกียงเดือด', icon: 'sk_wl_blaze', kind: 'buff', max: 5, cd: 35, sp: (lv) => 20 + lv * 3, rgb: TEAL, circle: 'occult', mul: () => 0.6,
      dur: (lv) => 20 + lv * 3, buff: (lv) => ({ aspd: lv * 4 }),
      desc: (lv) => `${20 + lv * 3} วิ: ความเร็วโจมตี +${lv * 4}% ไฟวิญญาณจากการตีระเบิดเป็นวงเล็ก 60% ของ MATK${lv >= 5 ? ' · ได้ดวงวิญญาณสองเท่า' : ''}` }),
    // ---- archer / ranger ----
    ar_doubleshot: S({ name: 'ยิงเบิ้ล', icon: 'sk_ar_doubleshot', pass: (lv, p) => (bow(p) ? { dbl: lv * 2 } : null),
      desc: (lv) => `ถือธนู: ยิงปกติโอกาส ${lv * 2}% ปล่อยลูกที่สองตามไปทันที${lv >= 5 ? ' · ลูกเบิ้ลแรงขึ้น 10%' : ''}${lv >= 10 ? ' · บางครั้งออกสามลูก' : ''}` }),
    rg_fearbreeze: S({ name: 'พายุศรเร็ว', icon: 'sk_rg_fearbreeze', type: 'phys', mul: () => 0.6, pass: (lv, p) => (bow(p) ? { aspd: lv * 2 } : null),
      desc: (lv) => `ถือธนู: ความเร็วโจมตี +${lv * 2}% ยิงปกติโอกาส ${3 + lv}% ยิงเพิ่ม 2–4 ดอก ดอกละ 60% ของ ATK${lv >= 5 ? ' · ดอกเพิ่มเป็นธาตุลม' : ''}${lv >= 10 ? ' · ดอกที่คริติคอลยิงซ้ำอีกชุด' : ''}` }),
    rg_truesight: S({ name: 'ตาทิพย์', icon: 'sk_rg_truesight', kind: 'buff', cd: 40, sp: (lv) => 20 + lv * 3, rgb: '200,255,140', circle: 'star',
      dur: (lv) => 30 + lv * 3, buff: (lv) => { const f = Math.ceil(lv / 2); return { str: f, agi: f, vit: f, int: f, dex: f, luk: f, hit: lv * 2, crit: r1(lv * 0.5), atk: r1(lv * 0.5), critDmg: lv >= 5 ? 10 : 0, sureBasic: lv >= 10 ? 1 : 0 }; },
      desc: (lv) => `${30 + lv * 3} วิ: ทุกสเตตัส +${Math.ceil(lv / 2)} ATK +${r1(lv * 0.5)}% ความแม่น +${lv * 2} คริติคอล +${r1(lv * 0.5)}%${lv >= 5 ? ' · คริแรงขึ้น 10%' : ''}${lv >= 10 ? ' · ยิงปกติไม่พลาด' : ''}` }),
    rg_unlimit: S({ name: 'ปลดขีดจำกัด', icon: 'sk_rg_unlimit', kind: 'buff', ult: true, max: 5, cd: (lv) => 90 - lv * 6, sp: () => 40, rgb: GOLD, circle: 'star',
      dur: () => 20, buff: (lv) => ({ atk: lv * 6, unlimit: 1, dbl: lv >= 5 ? 20 : 0 }),
      desc: (lv) => `20 วิ: ATK +${lv * 6}% แต่ DEF และ MDEF เป็น 0 และไม่ฟื้น HP${lv >= 3 ? ' · ตัวเป็นประกายทอง ลูกธนูระเบิดเป็นประกายทอง' : ''}${lv >= 5 ? ' · ยิงเบิ้ลเพิ่ม 20%' : ''}` }),
    // ---- hunter: the falcon, the wolf ----
    wh_blitz: S({ name: 'เหยี่ยวโฉบล่า', icon: 'sk_wh_blitz', cd: 4, sp: (lv) => 8 + lv * 2, mul: () => 1, type: 'phys',
      need: (game, p) => (!hasFalcon(p) ? 'ยังไม่มีเหยี่ยว' : K.target(game, p, 760) ? true : 'ไม่มีเป้าหมายใกล้ ๆ'), // (out or not: sendFalcons)
      desc: (lv) => `สั่งเหยี่ยวโฉบ ${hitsOf(lv)} ครั้ง ครั้งละ ${falconDmg(NC.game && NC.game.player)} (ตาม DEX และ INT) ไม่สน DEF ไม่พลาด${lv >= 5 ? ' · โฉบโดนรอบเป้า 50%' : ''}${lv >= 10 ? ' · เหยี่ยวสายฟ้า ธาตุลม ติดช็อต' : ''}` }),
    wh_autoblitz: S({ name: 'เหยี่ยวโฉบอัตโนมัติ', icon: 'sk_wh_autoblitz', pass: () => null,
      desc: (lv) => { const p = NC.game && NC.game.player, luk = (p && p.d && p.d.luk) || 1; return `ยิงปกติโอกาส ${r1(luk / 6 + lv / 2)}% (LUK ÷ 6 + ${r1(lv / 2)}) ให้เหยี่ยวโฉบเอง 2 ครั้ง ไม่เสีย SP${lv >= 5 ? ' · ติดต่อกันเร็วขึ้น' : ''}${lv >= 10 ? ' · เหยี่ยวคริติคอลได้' : ''}`; } }),
    wh_steelcrow: S({ name: 'กรงเล็บเหล็ก', icon: 'sk_wh_steelcrow', max: 5, pass: () => null,
      desc: (lv) => `เหยี่ยวแรงขึ้น 20%${lv >= 3 ? ' · เป้าที่โดนโฉบรับดาเมจเพิ่ม 10% นาน 4 วิ' : ''}${lv >= 5 ? ' · เหยี่ยวทองตัวที่สองโฉบพร้อมกัน (แรง 35%)' : ''}` }),
    wh_wolfrush: S({ name: 'หมาป่าจู่โจม', icon: 'sk_wh_wolfrush', pass: () => null,
      desc: (lv) => `ยิงปกติโอกาส ${r1(lv * 0.6)}% ให้หมาป่าพุ่งไปกัดเป้าที่เรายิงทันที${lv >= 5 ? ' · กัดแล้วตรึง 1 วิ' : ''}${lv >= 10 ? ' · หมาป่ากัดแต่ละครั้ง เรายิงเร็วขึ้น 0.5% ซ้อน 10 ชั้น' : ''}` }),
    x_pack: X({ name: 'สัญชาตญาณฝูง', icon: 'sk_wh_wolfrush', buff: (lv, p) => ({ aspd: (p.packStacks || 0) * 0.5 }) }),
    // ---- rogue / assassin / shinobi ----
    ro_vital: S({ name: 'จุดตาย', icon: 'sk_ro_vital', pass: (lv, p) => (dual(p) ? { crit: lv, critDmg: lv >= 5 ? 20 : 0 } : null),
      desc: (lv) => `ถือมีดคู่: คริติคอล +${lv}%${lv >= 5 ? ' · คริแรงขึ้น 20%' : ''}${lv >= 10 ? ' · คริติคอลฟันสองครั้ง (แรงขึ้นอีก 10%)' : ''}` }),
    as_haste: S({ name: 'เร่งนักฆ่า', icon: 'sk_as_haste', kind: 'buff', cd: 30, sp: (lv) => 16 + lv * 2, rgb: '190,120,255', circle: 'occult',
      dur: (lv) => 30 + lv * 3, buff: (lv, p) => (dual(p) ? { aspd: lv * 2, crit: r1(lv * 0.5), spd: lv >= 5 ? 15 : 0 } : null),
      desc: (lv) => `${30 + lv * 3} วิ ถือมีดคู่: ความเร็วโจมตี +${lv * 2}% คริติคอล +${r1(lv * 0.5)}%${lv >= 5 ? ' · เดินเร็วขึ้น 15%' : ''}${lv >= 10 ? ' · ตีปกติทิ้งเงาที่ฟันซ้ำ 20%' : ''}` }),
    as_lethal: S({ name: 'คมมรณะ', icon: 'sk_as_lethal', pass: (lv) => ({ critDmg: r1(lv * 1.5) }),
      desc: (lv) => `ดาเมจคริติคอล +${r1(lv * 1.5)}%${lv >= 5 ? ' · คริแล้วติดเลือดออก 3 วิ' : ''}${lv >= 10 ? ' · คริติดกัน 3 ครั้ง ความเร็วโจมตี +15% นาน 4 วิ' : ''}` }),
    x_lethal: X({ name: 'คมมรณะเร่ง', icon: 'sk_as_lethal', buff: () => ({ aspd: 15 }) }),
    sh_throwing: S({ name: 'ชำนาญอาวุธซัด', icon: 'sk_sh_throwing', type: 'phys', mul: (lv) => 0.9 + lv * 0.07, pass: () => null,
      desc: (lv) => `ตีปกติโอกาส ${lv * 3}% ซัดชูริเคนเพิ่ม 2 อัน อันละ ${pct(0.9 + lv * 0.07)}% ของ ATK${lv >= 5 ? ' · ชูริเคนธาตุลม ติดช็อต' : ''}${lv >= 10 ? ' · ซัดคุไนระเบิดไฟแทน' : ''}` }),
    // ---- priest: บัฟทีม, พระนักสู้ ----
    pr_gloria: S({ name: 'บทสรรเสริญโชค', icon: 'sk_pr_gloria', kind: 'buff', max: 5, cd: 30, sp: (lv) => 20 + lv * 3, rgb: '200,255,120', circle: 'holy',
      dur: (lv) => 30 + lv * 6, buff: (lv) => ({ luk: lv * 5, critDmg: lv >= 5 ? 10 : 0 }), party: (lv) => ({ atk: 1 + lv * 0.01 }),
      desc: (lv) => `ตัวเองและเพื่อนรอบตัว ${30 + lv * 6} วิ: LUK +${lv * 5} (คริติคอลและหลบสมบูรณ์เพิ่ม)${lv >= 5 ? ' · คริแรงขึ้น 10%' : ''}` }),
    pr_suffragium: S({ name: 'พรเร่งร่าย', icon: 'sk_pr_suffragium', kind: 'buff', max: 5, cd: 20, sp: (lv) => 18 + lv * 2, rgb: '150,200,255', circle: 'holy',
      dur: () => 30, buff: (lv) => ({ castRed: lv * 6 }), party: () => ({ atk: 1 }),
      desc: (lv) => `ตัวเองและเพื่อนรอบตัว 30 วิ: เวลาร่ายลดลง ${lv * 6}%${lv >= 5 ? ' · ร่ายครั้งแรกหลังได้บัฟเร็วขึ้นอีก 30%' : ''}` }),
    pr_macemastery: S({ name: 'ชำนาญกระบอง', icon: 'sk_pr_macemastery', pass: (lv) => ({ aspd: lv }),
      desc: (lv) => `ตีปกติแรงขึ้น ${lv * 3}% ความเร็วโจมตี +${lv}% (อาวุธใดก็ได้)${lv >= 10 ? ' · การตีครั้งที่ 5 ทุกครั้งฟื้น HP คนที่เลือดน้อยสุด 2% ของ HP สูงสุด' : ''}` }),
    pr_duple: S({ name: 'ลงทัณฑ์', icon: 'sk_pr_duple', type: 'best', element: 'holy', mul: (lv) => 1 + lv * 0.12, pass: () => null,
      desc: (lv) => `ตีปกติโอกาส ${lv * 3}% เรียกแสงศักดิ์สิทธิ์ลงเป้า ${pct(1 + lv * 0.12)}% ของ ATK/MATK ธาตุแสง${lv >= 5 ? ' · ติดสถานะชำระ' : ''}${lv >= 10 ? ' · แสงลงอีกตัวข้าง ๆ' : ''}` }),
    // ---- bishop: สรรเสริญ (Arch Bishop), บทสวดศึก ----
    bi_clementia: S({ name: 'พรทั่วทัพ', icon: 'sk_bi_clementia', kind: 'buff', cd: 30, sp: (lv) => 40 + lv * 3, rgb: HOLY, circle: 'holy',
      dur: (lv) => (60 + lv * 6) * (lv >= 5 ? 2 : 1), buff: (lv, p) => { const b = lv + Math.floor((p.jobLv || 1) / 10); return { str: b, int: b, dex: b }; },
      party: (lv) => ({ atk: 1 + lv * 0.015, r: 800 }),
      desc: (lv) => `ทุกคนในทีมรัศมีกว้าง ${(60 + lv * 6) * (lv >= 5 ? 2 : 1)} วิ: STR INT DEX +${lv} และ +1 ทุก 10 Job Lv (ใช้แทนพรศักดิ์สิทธิ์)${lv >= 10 ? ' · ปีกแสงทั้งทีม' : ''}` }),
    bi_canto: S({ name: 'บทเพลงเท้าไว', icon: 'sk_bi_canto', kind: 'buff', cd: 30, sp: (lv) => 40 + lv * 3, rgb: '160,255,170', circle: 'holy',
      dur: (lv) => (60 + lv * 6) * (lv >= 10 ? 2 : 1), buff: (lv, p) => { const b = lv + Math.floor((p.jobLv || 1) / 10); return { agi: b, spd: 15, aspd: lv >= 5 ? 10 : 0 }; },
      party: (lv) => ({ haste: 1.05 + (lv >= 5 ? 0.1 : 0), r: 800 }),
      desc: (lv) => `ทุกคนในทีมรัศมีกว้าง ${(60 + lv * 6) * (lv >= 10 ? 2 : 1)} วิ: AGI +${lv} และ +1 ทุก 10 Job Lv เดินเร็วขึ้น 15% (ใช้แทนเพิ่มความเร็ว)${lv >= 5 ? ' · ความเร็วโจมตีทั้งทีม +10%' : ''}` }),
    bi_sacrament: S({ name: 'พิธีเร่งเวท', icon: 'sk_bi_sacrament', kind: 'buff', max: 5, cd: 60, sp: (lv) => 40 + lv * 4, rgb: '200,170,255', circle: 'holy',
      dur: () => 60, buff: (lv) => ({ castRed: lv * 8, cdr: lv * 4, castFixed0: lv >= 5 ? 1 : 0 }), party: () => ({ atk: 1 }),
      desc: (lv) => `ตัวเองและเพื่อนรอบตัว 60 วิ: เวลาร่ายลดลง ${lv * 8}% คูลดาวน์ลดลง ${lv * 4}%${lv >= 5 ? ' · ส่วนคงที่ของเวลาร่ายหายไป' : ''}` }),
    bi_expiatio: S({ name: 'พรทะลวงเกราะ', icon: 'sk_bi_expiatio', kind: 'buff', max: 5, cd: 60, sp: (lv) => 35 + lv * 5, rgb: '255,250,210', circle: 'holy',
      dur: () => 60, buff: (lv) => ({ pierceDef: lv * 5, pierceMdef: lv >= 5 ? 25 : 0 }), party: (lv) => ({ atk: 1 + lv * 0.03 }),
      desc: (lv) => `ตัวเองและเพื่อนรอบตัว 60 วิ: ตีทะลุ DEF ศัตรู ${lv * 5}%${lv >= 5 ? ' · ทะลุ MDEF 25% ด้วย' : ''}` }),
    bi_battlehymn: S({ name: 'เพลงสวดศึก', icon: 'sk_bi_battlehymn', kind: 'buff', cd: 40, sp: (lv) => 30 + lv * 2, rgb: '255,210,120', circle: 'holy', enchant: 'holy',
      dur: (lv) => 40 + lv * 4, buff: (lv) => ({ aspd: lv * 3, atk: lv }), party: (lv) => ({ haste: 1 + lv * 0.02 }), aura: hymnAura,
      desc: (lv) => `ตัวเองและเพื่อนรอบตัว ${40 + lv * 4} วิ: ความเร็วโจมตี +${lv * 3}% ATK +${lv}% อาวุธเป็นธาตุแสง${lv >= 5 ? ' · ตีคริแล้วฟื้น HP 1%' : ''}${lv >= 10 ? ' · เพลงสวดดังรอบตัวตลอดบัฟ' : ''}` }),
    bi_mercy: S({ name: 'มือเมตตา', icon: 'sk_bi_mercy', pass: () => null,
      desc: (lv) => `ตีปกติฟื้น HP ให้คนที่เลือดน้อยสุดในทีม (รวมตัวเอง) ${lv * 2}% ของดาเมจ${lv >= 10 ? ' · ฮีลเกินเป็นบาเรีย' : ''}` }),
    // ---- monk: คอมโบ ----
    mo_triple: S({ name: 'หมัดสามดาว', icon: 'sk_mo_triple', pass: () => null,
      desc: (lv) => `ตีปกติโอกาส ${lv * 3}% ต่อยสามหมัดติด แรง ${pct(1.4 + lv * 0.1)}% แล้วเปิดคอมโบ 1.2 วิ (ชุดหมัดพายุไม่เสีย SP)${lv >= 5 ? ' · ได้ลูกปราณ' : ''}${lv >= 10 ? ' · ระหว่างปราณเดือด โอกาสอย่างน้อย 30%' : ''}` }),
    mo_fury: S({ name: 'ปราณเดือด', icon: 'sk_mo_fury', kind: 'buff', max: 5, cd: 40, sp: (lv) => 20 + lv * 3, rgb: '255,160,80', circle: 'star',
      dur: (lv) => 30 + lv * 6, buff: (lv) => ({ crit: lv * 3, aspd: lv * 4 }),
      desc: (lv) => `${30 + lv * 6} วิ: คริติคอล +${lv * 3}% ความเร็วโจมตี +${lv * 4}%${lv >= 5 ? ' · หมัดสิ้นปราณไม่ต้องร่าย' : ''}` }),
    x_shield: X({ name: 'บาเรียวิญญาณ', icon: 'sk_wl_drain', buff: () => ({}) }),
  });

  // ================= old skills reworked =================
  Object.assign(SK.kn_quicken, { max: 10, cd: 30, sp: (lv) => 12 + lv * 2, dur: (lv) => 30 + lv * 3,
    buff: (lv, p) => (melee(p) ? { aspd: lv * 2, crit: r1(lv * 0.5) } : null),
    desc: (lv) => `${30 + lv * 3} วิ ถืออาวุธระยะประชิด: ความเร็วโจมตี +${lv * 2}% คริติคอล +${r1(lv * 0.5)}%${lv >= 5 ? ' · ตีปกติทิ้งรอยดาบ' : ''}${lv >= 10 ? ' · ตีคริแล้วเร็วขึ้นอีก 20% นาน 2 วิ' : ''}` });
  Object.assign(SK.ro_dagger, { pass: (lv, p) => (dual(p) ? { atk: lv * 2, aspd: lv + (lv >= 10 ? 10 : 0), flee: lv } : { flee: lv }),
    desc: (lv) => `หลบหลีก +${lv} · ถือมีดคู่: ATK +${lv * 2}% ความเร็วโจมตี +${lv + (lv >= 10 ? 10 : 0)}%` });
  Object.assign(SK.as_katar, { pass: (lv, p) => (dual(p) ? { crit: 3, critDmg: lv >= 3 ? 15 : 0 } : null),
    desc: (lv) => `ถือมีดคู่: คริติคอล +3%${lv >= 3 ? ' · คริแรงขึ้น 15%' : ''}${lv >= 5 ? ' · คริแล้วฟันซ้ำอัตโนมัติ 20%' : ''}` });
  Object.assign(SK.ar_bowmastery, { desc: (lv) => `ถือธนู: ATK +${r1(lv * 1.5)}% คริติคอล +${r1(lv * 0.5)}%${lv >= 10 ? ' · ทุกดอกที่ 5 ยิงคู่ (แรงขึ้น 50%)' : ''}` });
  Object.assign(SK.mg_sprecovery, { desc: (lv) => `ฟื้น SP +${lv * 8}% · SP สูงสุด +${lv}%${lv >= 10 ? ' · ร่ายอัตโนมัติคืน SP 1%' : ''}` });
  // the priest's buffs as classic MMO's: real stat points (a bigger bishop version replaces each one, they never add up)
  Object.assign(SK.blessing, { max: 10, cd: 20, rgb: '220,240,255', circle: 'holy', sp: (lv) => 20 + lv * 2, dur: (lv) => 60 + lv * 6,
    buff: (lv, p) => (on(p, 'bi_clementia') ? null : { str: lv, int: lv, dex: lv }), party: (lv) => ({ atk: 1 + lv * 0.01 }),
    desc: (lv) => `ตัวเองและเพื่อนรอบตัว ${60 + lv * 6} วิ: STR INT DEX +${lv} (ได้ทั้ง ATK MATK ความแม่น และร่ายเร็วขึ้น)${lv >= 10 ? ' · ปีกขาวค้างระหว่างบัฟ' : ''}` });
  Object.assign(SK.pr_agi, { dur: (lv) => 60 + lv * 6, buff: (lv, p) => (on(p, 'bi_canto') ? null : { agi: lv, spd: lv >= 10 ? 20 : 10 }), party: (lv) => ({ haste: 1 + lv * 0.01 }),
    desc: (lv) => `ตัวเองและเพื่อนรอบตัว ${60 + lv * 6} วิ: AGI +${lv} (โจมตีเร็วขึ้น) เดินเร็วขึ้น ${lv >= 10 ? 20 : 10}%` });
  Object.assign(SK.pr_angelus, { desc: (lv) => `ตัวเองและเพื่อนรอบตัว ${30 + lv * 6} วิ: VIT +${lv} DEF +${2 + lv} (เพื่อนรับดาเมจลดลง ${5 + lv}%)` });
  if (SK.mo_asura) SK.mo_asura.castFree = (p) => bl(p, 'mo_fury') >= 5;

  // ================= helpers =================
  // once per swing / per arrow: the first monster a basic attack hits this frame
  const once = (game, p, tag) => { const o = p._once || (p._once = {}); if (o[tag] === game.time) return false; o[tag] = game.time; return true; };
  // healing that comes from hits: added up and shown every 0.4 s (not a number per hit)
  function heroHeal(game, p, amount, overflowShield) {
    if (!(amount > 0) || p.dead > 0) return;
    const room = p.maxHp - p.hp, got = Math.min(room, amount);
    p.hp += got;
    p._healAcc = (p._healAcc || 0) + got;
    if (overflowShield && amount > room) { p.shield = Math.min(p.maxHp * 0.2, (p.shield || 0) + (amount - room)); K.startBuff(game, p, 'x_shield', 1, 8); }
  }
  // the one who needs it most: the hero or a friend round him, lowest HP share first
  function healLowest(game, p, amount, shield, share) {
    const all = [p, ...K.friends(game, p, 520)].filter((a) => a.dead <= 0 && a.maxHp > 0);
    const who = all.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!who) return;
    const n = share ? who.maxHp * share : amount;
    if (who === p) heroHeal(game, p, n, shield);
    else if (who.hp < who.maxHp) { who.hp = Math.min(who.maxHp, who.hp + n); who._healAcc = (who._healAcc || 0) + n; }
  }
  // a share of a hit on someone else (a cleave, an echo): the same roll, no new one
  function splash(game, e, r, k, color, fill) {
    if (!alive(e) || !(r.dmg > 0)) return;
    NC.damageEnemy(game, e, { dmg: Math.max(1, Math.round(r.dmg * k)), crit: r.crit, mod: r.mod }, 0, 0, { color: color || '220,235,255', fill });
  }
  // a skill's hit from a proc (knockback kx, ky; the number's colour; heroHit options)
  const hit = (game, p, id, e, o) => K.strike(game, p, id, e, (o && o.kx) || 0, (o && o.ky) || 0, { color: (o && o.color) || '255,235,190', fill: o && o.fill }, o && o.ex);
  const angTo = (p, e) => NC.angle(p.x, p.y - 50, e.x, e.y - 45);
  const others = (game, e, r, n) => game.enemies.filter((o) => o !== e && alive(o) && NC.dist(o.x, o.y, e.x, e.y) < r)
    .sort((a, b) => NC.dist(a.x, a.y, e.x, e.y) - NC.dist(b.x, b.y, e.x, e.y)).slice(0, n || 99);
  const shout = (p, text, fill) => FX.text(p.x, p.y - 200, text, fill || '#ffe28a', 34);

  // a crescent of steel flying out (the cleave's sword wave, the berserker's)
  function swordWave(game, p, id, k, rgb, size) {
    const a = p.atk && p.atk.on ? p.atk.ang : p.aim, s = size || 1;
    rgb = rgb || '200,230,255';
    K.shot(game, p, id, { from: [p.x + Math.cos(a) * 40, p.y - 60 + Math.sin(a) * 20], ang: a, v: 1150, range: 560, r: 50 * s, pierce: true, rgb, mul: k,
      look(ctx, q) {
        const an = Math.atan2(q.vy, q.vx), f = Math.min(1, q.t / 0.08) * (1 - Math.max(0, q.t / q.life - 0.7) / 0.3);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(an); ctx.scale(s, s);
        ctx.globalAlpha *= f; ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.arc(-16, 0, 62, -1.15, 1.15); ctx.arc(-46, 0, 56, 1.05, -1.05, true); ctx.closePath();
        ctx.fillStyle = `rgba(${rgb},0.55)`; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
        ctx.restore();
        V.glow(ctx, q.x, q.y, 70 * s, rgb, 0.45 * f, true);
      } });
  }

  // ================= the basic hits =================
  // (skilltree.js calls these on the hero's own weapon hits, before the number shows: r can still change)
  NC.basicHits.push((game, p, e, r) => {
    if (!game || p !== game.player || !(r.dmg > 0)) return;
    const L = (id) => lvOf(p, id), first = once(game, p, 'swing'), mel = melee(p);
    // ---- the hit itself ----
    let k = 1, flat = 0;
    if (mel && L('pal_holyblade')) k *= 1 + L('pal_holyblade') * 0.04;
    if (staff(p) && L('mg_staffmastery')) k *= 1 + L('mg_staffmastery') * 0.04;
    if (L('pr_macemastery')) k *= 1 + L('pr_macemastery') * 0.03;
    if (on(p, 'kn_aurablade')) flat += bl(p, 'kn_aurablade') * 6 + Math.floor(p.lv / 4);
    if (r.double && bow(p) && L('ar_doubleshot') >= 5) k *= 1.1;
    if (r.double && bow(p) && L('ar_doubleshot') >= 10 && roll(10)) { k *= 1.5; r.hits = 3; }
    if (first && bow(p) && L('ar_bowmastery') >= 10 && (p._arrowN = (p._arrowN || 0) + 1) % 5 === 0) { k *= 1.5; r.hits = Math.max(r.hits || 1, 2); }
    if (r.crit && dual(p) && L('ro_vital') >= 10) { k *= 1.1; r.hits = Math.max(r.hits || 1, 2); }
    if (first && L('mo_triple')) {
      const ch = Math.max(L('mo_triple') * 3, L('mo_triple') >= 10 && on(p, 'mo_fury') ? 30 : 0);
      if (roll(ch)) {
        k *= 1.4 + L('mo_triple') * 0.1; r.hits = 3;
        p.comboOpen = game.time + 1.2;
        FX.text(e.x, NC.labelTop(e) - 90, 'หมัดสามดาว!', '#ffcf6a', 30);
        V.ring(e.x, e.y - 40, 10, 110, 8, '255,200,90', 0.3);
        if (L('mo_triple') >= 5 && L('mo_spheres') && RUN.mo_spheres && (p.spheres || 0) < L('mo_spheres')) { p.noPose = true; try { RUN.mo_spheres(game, p, L('mo_spheres')); } finally { p.noPose = false; } }
      }
    }
    if (k !== 1 || flat) r.dmg = Math.max(1, Math.round(r.dmg * k + flat));

    // ---- what the hit gives back ----
    let steal = 0;
    if (on(p, 'kn_berserk')) steal += 2 + bl(p, 'kn_berserk') * 0.5;
    if (mel && L('pal_holyblade') >= 10) steal += 1;
    if (L('wl_drain')) { steal += L('wl_drain'); p.sp = Math.min(p.maxSp, p.sp + r.dmg * L('wl_drain') * 0.002); }
    if (steal) heroHeal(game, p, (r.dmg * steal) / 100, L('wl_drain') >= 10);
    if (r.crit && (bl(p, 'pal_zeal') >= 5 || bl(p, 'bi_battlehymn') >= 5)) heroHeal(game, p, p.maxHp * 0.01);
    if (L('pal_faithblade')) healLowest(game, p, r.dmg * 0.01);
    if (L('bi_mercy')) healLowest(game, p, r.dmg * L('bi_mercy') * 0.02, L('bi_mercy') >= 10);
    if (first && L('pr_macemastery') >= 10 && (p._maceN = (p._maceN || 0) + 1) % 5 === 0) healLowest(game, p, 0, false, 0.02);

    // ---- a share for the ones round the target (once a swing: from the first monster it hit) ----
    if (first && mel && L('kn_cleave')) {
      const kc = L('kn_cleave') * 0.02 * (bl(p, 'kn_aurablade') >= 5 ? 1.2 : 1);
      for (const o of others(game, e, L('kn_cleave') >= 5 ? 160 : 110)) splash(game, o, r, kc, '220,235,255');
    }
    if (on(p, 'wl_blaze') && staff(p)) V.at(0.05, () => {
      if (!alive(e)) return;
      K.burst(game, e.x, e.y, 90, TEAL, { shake: 0, sparks: 6, flare: false });
      for (const o of others(game, e, 110)) hit(game, p, 'wl_blaze', o, { color: TEAL, fill: '#bfefff', ex: { kind: 'magic', element: 'shadow' } });
    });
    if (!first) return;

    // ---- things set off by the swing / the shot (once each) ----
    const a = angTo(p, e);
    // knight: the blade's trail, the quicker blade after a critical, the sword waves
    if (bl(p, 'kn_quicken') >= 5 && mel) K.slashAt(e.x, e.y - 60, 90, a - 0.5, P.gold, '255,210,120', { life: 0.2, thick: 20 });
    if (r.crit && bl(p, 'kn_quicken') >= 10) K.startBuff(game, p, 'x_quickcrit', 1, 2);
    if (mel) p._swingN = (p._swingN || 0) + 1;
    if (mel && L('kn_cleave') >= 10 && p._swingN % 5 === 0) V.at(0.03, () => swordWave(game, p, 'kn_cleave', bl(p, 'kn_aurablade') >= 5 ? 1.2 : 1));
    if (mel && bl(p, 'kn_berserk') >= 5 && p._swingN % 3 === 0) V.at(0.03, () => swordWave(game, p, 'kn_cleave', 0.3, RAGE, 0.7));
    // paladin: a holy cross every 5th swing, a cross burst every 10th hit (faith)
    if (mel && L('pal_holyblade') >= 5 && p._swingN % 5 === 0) V.at(0.05, () => {
      if (!alive(e)) return;
      K.slashAt(e.x, e.y - 60, 110, Math.PI / 4, P.holy, HOLY, { life: 0.3, thick: 26 });
      K.slashAt(e.x, e.y - 60, 110, -Math.PI / 4, P.holy, HOLY, { life: 0.3, thick: 26 });
      for (const o of [e, ...others(game, e, 110)]) hit(game, p, 'pal_holyblade', o, { color: HOLY, fill: '#fff0a0' });
    });
    if (L('pal_faithblade') >= 3 && (p._faithN = (p._faithN || 0) + 1) % 10 === 0) V.at(0.05, () => {
      K.burst(game, p.x, p.y, 170, HOLY, { shake: 4, stars: 8 });
      for (const o of K.around(game, p.x, p.y, 170)) hit(game, p, 'pal_faithblade', o, { color: HOLY, fill: '#fff0a0' });
    });
    // dragon knight: the fire lances
    if (mel && L('dk_tail') && roll(L('dk_tail') * 0.6)) V.at(0.04, () => {
      const n = L('dk_tail') >= 10 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const an = a + (i - (n - 1) / 2) * 0.22;
        K.shot(game, p, 'dk_tail', { ang: an, v: 1250, range: 620, r: 40, pierce: true, rgb: C.fire, style: 'arrow', size: 1.5,
          hit(o) { const res = hit(game, p, 'dk_tail', o, { color: C.fire, fill: '#ffb56a', kx: Math.cos(an) * 160, ky: Math.sin(an) * 100 }); if (res && !res.miss && L('dk_tail') >= 5) NC.addStatus(game, o, 'burn', 4); },
          trail(q) { if (Math.random() < 0.6) V.flameAt(q.x, q.y + 10, 22, 40, P.fire, 0.3, { vy: -50 }); } });
      }
    });
    // mage: the bolt going through, a second bolt, spells cast by themselves
    if (staff(p)) {
      if (L('mg_staffmastery') >= 5) { const o = others(game, e, 230, 1)[0]; if (o) V.at(0.05, () => { V.boltAt(e.x, e.y - 50, o.x, o.y - 50, '150,220,255', 0.18, { w: 4, jag: 14, seg: 6 }); splash(game, o, r, 0.5, '150,220,255'); }); }
      const extra = (L('mg_staffmastery') >= 10 ? 1 : 0) + (L('am_doublecast') && roll(L('am_doublecast')) ? 1 : 0);
      for (let i = 0; i < extra; i++) V.at(0.07 + i * 0.07, () => {
        if (!alive(e)) return;
        K.shot(game, p, 'mg_staffmastery', { ang: angTo(p, e), v: 1000, range: 900, rgb: '150,220,255', target: e, home: 8, size: 0.8,
          hit(o, q) { splash(game, o, r, i ? 1 : 0.4, '150,220,255'); V.sparks(q.x, q.y, 6, '150,220,255', { size: 0.7 }); } });
      });
    }
    if (L('mg_autospell') && game.time >= (p._autoT || 0)) { // (one at most every 0.8 s)
      const full = p.sp > p.maxSp * 0.8, ch = L('mg_autospell') * 1.5 * (L('mg_autospell') >= 5 && full ? 1.3 : 1);
      if (roll(ch)) { p._autoT = game.time + 0.8; autoSpell(game, p, e, L('mg_autospell') >= 10 && roll(30) ? 2 : 1); }
    }
    // warlock: soul fire from the lantern
    if (staff(p) && L('wl_swing')) {
      if (roll(35 + L('wl_swing') * 3)) NC.addStatus(game, e, 'burn', 4);
      e._swingT = game.time;
      const jumps = others(game, e, 280, L('wl_swing') >= 5 ? 2 : 1);
      jumps.forEach((o, i) => soulJump(game, p, e, o, i * 0.08));
    }
    // ranger: more arrows in a gust
    if (bow(p) && L('rg_fearbreeze') && roll(3 + L('rg_fearbreeze'))) volley(game, p, e, 2 + Math.floor(Math.random() * 3), false);
    if (bow(p) && bl(p, 'rg_unlimit') >= 3) { V.sparks(e.x, e.y - 50, 8, GOLD, { max: 600 }); V.glowAt(e.x, e.y - 50, 10, 70, GOLD, 0.7, 0.2, { hot: true }); }
    // hunter: the falcon dives, the wolf pounces
    if (bow(p) && L('wh_autoblitz') && hasFalcon(p) && game.time > (p._blitzT || 0) && roll(p.d.luk / 6 + L('wh_autoblitz') / 2)) { // (away or not: sendFalcons chains it)
      const full = hitsOf(L('wh_blitz'));
      if (sendFalcons(game, p, e, Math.min(2, full), { crit: L('wh_autoblitz') >= 10, auto: true })) p._blitzT = game.time + (L('wh_autoblitz') >= 5 ? 0.3 : 0.8);
    }
    if (bow(p) && L('wh_wolfrush') && roll(L('wh_wolfrush') * 0.6)) wolfRush(game, p, e);
    // assassin: the shadow echo, the bleeding, a critical streak, the katar's second cut
    if (bl(p, 'as_haste') >= 10 && dual(p)) V.at(0.15, () => { if (!alive(e)) return; K.slashAt(e.x, e.y - 55, 80, a + 0.6, P.shadow, '190,120,255', { life: 0.2, thick: 18 }); splash(game, e, r, 0.2, '190,120,255', '#d8b8ff'); });
    if (r.crit) {
      if (L('as_lethal') >= 5) bleed(game, p, e, r.dmg);
      p._critRun = (p._critRun || 0) + 1;
      if (L('as_lethal') >= 10 && p._critRun >= 3) { p._critRun = 0; K.startBuff(game, p, 'x_lethal', 1, 4); }
      if (dual(p) && L('as_katar') >= 5) V.at(0.1, () => { if (!alive(e)) return; K.slashAt(e.x, e.y - 55, 90, a - 0.7, P.blood, '255,80,110', { life: 0.2, thick: 22 }); splash(game, e, r, 0.2, '255,80,110', '#ffd0dc'); });
    } else p._critRun = 0;
    // rogue: the venom heart poisons with basic hits
    if (p.d.mods && p.d.mods.venomHit && roll(p.d.mods.venomHit)) K.poison(game, p, e, 4);
    // (shinobi: sh_throwing is ดาวคู่ now, a shadow twin of a thrown huuma: js/throwstar.js)
    // priest: holy light from the sky
    if (L('pr_duple') && roll(L('pr_duple') * 3)) {
      const targets = [e, ...(L('pr_duple') >= 10 ? others(game, e, 260, 1) : [])];
      targets.forEach((o, i) => V.at(0.05 + i * 0.12, () => {
        if (!alive(o)) return;
        V.beam(o.x, o.y, 70, 560, HOLY, 0.4);
        V.circle(o.x, o.y, 80, HOLY, 0.5, { style: 'holy', spin: 2, grow: true });
        const res = hit(game, p, 'pr_duple', o, { color: HOLY, fill: '#fff0a0' });
        if (res && !res.miss && L('pr_duple') >= 5) NC.addStatus(game, o, 'purify', 4);
      }));
    }
  });

  // ================= the mage's spells that cast themselves =================
  const HEARTS = [['mg_fireheart', 'fireball'], ['mg_iceheart', 'frostdiver'], ['mg_stormheart', 'thunder']];
  const EL_RGB = { fireball: C.fire, frostdiver: C.ice, thunder: C.lightning };
  const spellOrder = (p) => HEARTS.map((h, i) => [h[1], lvOf(p, h[0]), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map((x) => x[0]);
  // a skill's moves aimed at e, with no pose, SP or cooldown (the swing goes on)
  function castAt(game, p, id, e) {
    const run = RUN[id];
    if (!run || !alive(e) || p.dead > 0) return;
    const lv = Math.max(1, Math.min(lvOf(p, id), Math.ceil(lvOf(p, 'mg_autospell') * 0.7) || 1)); // (autospell casts at 70% of its own level at most)
    const g = Object.create(game, { mouse: { value: { wx: e.x, wy: e.y - 10, sx: 0, sy: 0, active: true, down: false } }, autoCast: { value: true } }); // (autoCast: rotiming.js counts its hits as the swing's)
    const aim = p.aim, lock = p.skillLock;
    p.noPose = true; p.aim = angTo(p, e);
    try { run(g, p, lv, 'q'); } catch (err) { console.warn('autospell', id, err); } finally { p.noPose = false; p.aim = aim; p.skillLock = lock; }
    const h = K.tip(p);
    V.circle(h[0], h[1] + 60, 46, EL_RGB[id] || C.gold, 0.35, { style: 'arcane', spin: 4, grow: true, a: 0.8 });
  }
  function autoSpell(game, p, e, n) {
    const order = spellOrder(p);
    for (let i = 0; i < n; i++) V.at(i * 0.12, () => castAt(game, p, order[i % order.length], e));
    if (lvOf(p, 'mg_sprecovery') >= 10) p.sp = Math.min(p.maxSp, p.sp + p.maxSp * 0.01);
    const dc = lvOf(p, 'am_doublecast');
    if (dc && roll(dc)) {
      const id = order[dc >= 5 ? 1 : 0];
      V.at(0.25, () => castAt(game, p, id, alive(e) ? e : (K.nearest(game, p.x, p.y, 700, 1)[0] || e)));
      if (dc >= 10 && (p._dcN = (p._dcN || 0) + 1) % 10 === 0) V.at(0.4, () => elementStorm(game, p, e));
    }
  }
  // ten double casts: fire, ice and lightning burst on the spot one after another
  function elementStorm(game, p, e) {
    const x = e.x, y = e.y;
    [['fire', C.fire], ['water', C.ice], ['wind', C.lightning]].forEach(([el, rgb], i) => V.at(i * 0.12, () => {
      K.burst(game, x, y, 170, rgb, { shake: 5, stars: 6 });
      for (const o of K.around(game, x, y, 170)) hit(game, p, 'am_doublecast', o, { color: rgb, ex: { kind: 'magic', element: el, mul: 0.5 } });
    }));
    FX.text(x, y - 200, 'พายุธาตุ!', '#d8f0ff', 34);
  }

  // ================= the warlock's soul fire =================
  function soulJump(game, p, from, to, delay) {
    const x0 = from.x, y0 = from.y - 50;
    V.at(0.04 + delay, () => {
      if (!alive(to)) return;
      K.proj({ x: x0, y: y0, life: 0.24,
        update(q) { const u = q.t / q.life; q.x = lerp(x0, to.x, u); q.y = lerp(y0, to.y - 50, u) - Math.sin(u * Math.PI) * 50; },
        draw(ctx, q) { K.drawGhost(ctx, q.x, q.y, 11, q.t, TEAL); },
        onEnd() {
          if (!alive(to)) return;
          const res = hit(game, p, 'wl_swing', to, { color: TEAL, fill: '#bfefff', ex: { kind: 'magic' } });
          if (res && !res.miss && roll(40)) NC.addStatus(game, to, 'burn', 4);
          to._swingT = game.time;
          V.glowAt(to.x, to.y - 50, 12, 70, TEAL, 0.7, 0.25, { hot: true });
        } });
    });
  }
  // a soul more for a monster the lantern finished (and twice as many while the lantern blazes)
  NC.skillKills.push((game, e) => {
    const p = game.player, h = lvOf(p, 'wl_harvest');
    if (!h || !p.souls) return;
    let n = 0;
    if (lvOf(p, 'wl_swing') >= 10 && e._swingT && game.time - e._swingT < 0.4) n++;
    if (bl(p, 'wl_blaze') >= 5) n++;
    if (n) { p.souls.n = Math.min(3 + Math.floor(h / 2), p.souls.n + n); NC.applyGear(game); }
  });

  // ================= arrows, stars, bleeding =================
  function volley(game, p, e, n, again) {
    const lv = lvOf(p, 'rg_fearbreeze'), wind = lv >= 5, rgb = wind ? '140,255,150' : '255,235,200', a0 = angTo(p, e);
    for (let i = 0; i < n; i++) V.at(0.03 + i * 0.05, () => {
      const an = a0 + (i - (n - 1) / 2) * 0.09;
      K.shot(game, p, 'rg_fearbreeze', { from: K.hand(p), ang: an, v: 1350, range: 950, r: 32, style: 'arrow', rgb, size: 0.85,
        hit(o, q) {
          const res = hit(game, p, 'rg_fearbreeze', o, { color: rgb, kx: Math.cos(an) * 120, ky: Math.sin(an) * 80, ex: { element: wind ? 'wind' : undefined } });
          V.sparks(q.x, q.y, 5, rgb, { size: 0.6 });
          if (res && res.crit && lv >= 10 && !again) { again = true; volley(game, p, o, 2, true); }
        } });
    });
  }
  // bleeding (the assassin's criticals): a red number every 0.5 s for 3 s
  function bleed(game, p, e, dmg) {
    e.bleed = { until: game.time + 3, dmg: Math.max(1, Math.round(dmg * 0.08)), acc: 0 };
  }

  // ================= the hunter's falcon =================
  // it sits on the hero's shoulder; Falcon Strike (or a lucky shot) sends it: it flies to the monster, dives n times
  // (damage from DEX and INT, never misses, ignores DEF), then comes back. Steel Crow Lv 5: a golden one flies with it.
  const hitsOf = (lv) => Math.max(1, Math.ceil((lv || 1) / 2));
  const hasFalcon = (p) => !!p && p.kind === 'player' && lvOf(p, 'wh_blitz') > 0 && NC.jobSkills(p).includes('wh_blitz');
  const FAL = [];
  function falcons(p) {
    const n = lvOf(p, 'wh_steelcrow') >= 5 ? 2 : 1;
    while (FAL.length < n) FAL.push({ i: FAL.length, st: 'perch', x: p.x, y: p.y - 90, h: 0, t: 0, e: null, left: 0, face: 1, crit: false, gold: FAL.length === 1, fx: null });
    FAL.length = n;
    return FAL;
  }
  function falconDmg(p, crit) {
    if (!p || !p.d) return 0;
    const d = p.d, sc = lvOf(p, 'wh_steelcrow'), atk = (d.batk + ((d.watk && d.watk[0] + d.watk[1]) || 0) / 2) * (d.atkMul || 1);
    let v = (atk * 0.25 + d.dex * 1 + d.int * 0.5) * (d.petK || 1) * (sc ? 1.2 : 1);
    v *= 1 + (NC.RES_DMG[(d.resBySkill && d.resBySkill.wh_blitz) || 0] || 0) / 100; // (the falcon line's resonance)
    if (crit) v *= 1.4 * (1 + (d.critDmg || 0) / 100);
    return Math.round(v);
  }
  // a cast or a lucky shot while the falcon is away joins its flight (the user, 2026-10-21: "นกเวลากดสกิลควรจะกดได้รัวๆ
  // แต่ไปติดอนิเมชันจิก" - every press and every auto dive waited for it to fly home first, so attack speed did nothing):
  // its dives so far plus these, CHAIN_MAX at most, on the new monster at once - no flight home in between
  const CHAIN_MAX = 10;
  function sendFalcons(game, p, e, hits, o) {
    const F = falcons(p);
    if (!alive(e)) return false;
    const lv = lvOf(p, 'wh_blitz');
    for (const f of F) {
      if (f.st === 'perch' || (f.gold && f.st === 'gone')) { // (the golden one waits out of sight)
        Object.assign(f, { st: 'go', e, left: hits, t: 0, crit: !!(o && o.crit), splash: lv >= 5, storm: lv >= 10 });
        if (f.gold) { f.x = p.x + p.face * 30; f.y = p.y - 100; }
        continue;
      }
      if (f.st === 'gone') continue;
      f.left = Math.min(CHAIN_MAX, (f.st === 'back' ? 0 : f.left) + hits);
      if (f.e !== e || !alive(f.e) || f.st === 'back') { f.e = e; f.st = 'go'; f.t = 0; }
      f.crit = f.crit || !!(o && o.crit); f.splash = lv >= 5; f.storm = lv >= 10;
    }
    if (!(o && o.auto)) FX.text(p.x, p.y - 200, 'ปี๊ด!', '#cfe8ff', 28);
    return true;
  }
  // (not on the shoulder any more: the user wants it flying at the hero's side, a little behind and above the head)
  function perchOf(p, f) { return [p.x - p.face * (74 + f.i * 30), p.y - 130 - f.i * 8]; }
  function falconStrike(game, p, f) {
    let e = f.e;
    if (!alive(e)) e = f.e = K.nearest(game, f.x, f.y + 60, 260, 1)[0] || null;
    if (!e) { f.st = 'back'; return; }
    const d = p.d, c = f.crit && roll(d.crit);
    const el = f.storm ? 'wind' : 'neutral', mod = NC.elementMod(el, e.element), dmg = Math.round(falconDmg(p, c) * mod * rand(0.9, 1.1) * (f.gold ? 0.35 : 1));
    NC.damageEnemy(game, e, { dmg: mod > 0 ? Math.max(1, dmg) : 0, crit: c, mod }, 0, 0, { color: FALCON, fill: f.gold ? '#ffe28a' : '#9fe6ff' });
    V.sparks(e.x, e.y - 60, 7, f.gold ? GOLD : FALCON, { size: 0.7 });
    K.slashAt(e.x, e.y - 60, 60, rand(0, TAU), P.wind, FALCON, { life: 0.16, thick: 14 });
    if (f.storm) { V.boltAt(e.x, e.y - 260, e.x, e.y - 50, C.lightning, 0.15, { w: 4, jag: 16, seg: 7 }); NC.addStatus(game, e, 'shock', 2); }
    if (lvOf(p, 'wh_steelcrow') >= 3) K.vuln(game, e, 1.1, 4, FALCON);
    if (f.splash) for (const o of others(game, e, 110)) NC.damageEnemy(game, o, { dmg: Math.max(1, Math.round(dmg * 0.5)), crit: false, mod: 1 }, 0, 0, { color: FALCON, fill: '#9fe6ff' });
  }
  function updateFalcons(game, p, dt) {
    if (!hasFalcon(p)) { for (const f of FAL) if (f.fx) { f.fx.dead = true; f.fly.dead = true; f.fx = null; } return; }
    for (const f of falcons(p)) {
      // (its drawing: at the hero's side among the characters, in flight over everything so no name tag hides it; made
      // again if a map change cleared the effects)
      if (!f.fx || f.fx.dead || game.time - (f.drawnT || 0) > 0.5) {
        if (f.fx) { f.fx.dead = true; f.fly.dead = true; }
        f.drawnT = game.time;
        f.fx = FX.add({ type: 'custom', layer: 'sorted', x: f.x, y: f.y, life: 1e9, sort: p.y, draw: (ctx) => { f.drawnT = game.time; if (f.st === 'perch') drawFalcon(ctx, game, p, f); } });
        f.fly = FX.add({ type: 'custom', layer: 'glow', x: f.x, y: f.y, life: 1e9, draw: (ctx) => { if (f.st !== 'perch') drawFalcon(ctx, game, p, f); } });
      }
      f.t += dt;
      const [px, py] = perchOf(p, f);
      if (f.st === 'perch') {
        if (f.gold) { f.st = 'gone'; continue; } // (the golden one only comes for a strike)
        if (Math.hypot(px - f.x, py - f.y) > 420) { f.x = px; f.y = py; } // (a warp: it is there at once)
        const k = Math.min(1, dt * 5); f.x += (px - f.x) * k; f.y += (py - f.y) * k; f.h = 0; // (it follows, a beat behind)
        f.face = Math.abs(px - f.x) > 24 ? (px > f.x ? 1 : -1) : p.face;
      } else if (f.st === 'go') {
        const e = alive(f.e) ? f.e : null, tx = e ? e.x + (f.gold ? 46 : -46) : px, ty = e ? e.y - 150 : py;
        const d = Math.hypot(tx - f.x, ty - f.y), s = 1500 * dt;
        f.face = tx > f.x ? 1 : -1;
        if (!e) f.st = 'back';
        else if (d <= s + 20) { f.st = 'strike'; f.t = 0; f.x = tx; f.y = ty; }
        else { f.x += ((tx - f.x) / d) * s; f.y += ((ty - f.y) / d) * s; }
      } else if (f.st === 'strike') {
        const e = f.e;
        // (a dive: down onto the monster and up again, a little to either side each time)
        if (e) { const u = Math.min(1, f.t / 0.09), side = (f.left % 2 ? 1 : -1) * (f.gold ? -1 : 1); f.x = e.x + side * lerp(46, 10, u); f.y = e.y - lerp(150, 70, u); f.face = side < 0 ? 1 : -1; }
        if (f.t >= 0.09) { f.t = 0; falconStrike(game, p, f); if (--f.left <= 0 && f.st === 'strike') f.st = 'back'; }
      } else if (f.st === 'back') {
        if (f.gold) { f.st = 'gone'; V.sparks(f.x, f.y, 10, GOLD, { size: 0.8 }); continue; }
        const d = Math.hypot(px - f.x, py - f.y), s = 1300 * dt;
        f.face = px > f.x ? 1 : -1;
        if (d <= s + 10) { f.st = 'perch'; f.x = px; f.y = py; }
        else { f.x += ((px - f.x) / d) * s; f.y += ((py - f.y) / d) * s; }
      }
      if (f.fx) { f.fx.x = f.x; f.fx.sort = f.st === 'perch' ? p.y + 1 : (f.e && alive(f.e) ? f.e.y + 2 : p.y + 1); }
    }
  }
  function drawFalcon(ctx, game, p, f) {
    if (f.st === 'gone' || p.dead > 0) return;
    if (NC.PetRig && NC.PetRig.falcon && NC.PetRig.falcon(ctx, game, p, f)) return; // (petrig.js: the moving rig)
    const name = f.st === 'perch' ? 'pet_falcon' : f.st === 'strike' ? 'pet_falcon_c' : 'pet_falcon_b';
    const flap = f.st === 'perch' ? 1 + Math.sin(game.time * 2.2) * 0.02 : 1;
    const y = f.y + (f.st === 'perch' ? 0 : Math.sin(game.time * 12 + f.i) * 5);
    if (f.gold) V.glow(ctx, f.x, y - 20, 70, GOLD, 0.5, true);
    if (NC.ASSET_MANIFEST && NC.ASSET_MANIFEST[name]) {
      NC.drawSpr(ctx, name, f.x, y, { flip: f.face > 0, sy: flap, scale: f.st === 'perch' ? 1.05 : 1.1, tint: f.gold ? ['#ffd24a', 0.45] : null });
    } else { // (before the art has loaded: a small bird shape)
      ctx.save(); ctx.translate(f.x, y - 16); ctx.scale(f.face > 0 ? -1 : 1, 1);
      ctx.fillStyle = '#5a6a86'; ctx.strokeStyle = NC.OUTLINE; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-13, -8, 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffc233'; ctx.beginPath(); ctx.moveTo(-21, -8); ctx.lineTo(-28, -5); ctx.lineTo(-20, -4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  RUN.wh_blitz = function (game, p, lv) {
    const e = K.target(game, p, 760);
    if (!e) return;
    K.pose(game, p, 'cheer', 0.2);
    // online the falcon is the server's, drawn from its meters for every hunter (js/online-wolfhunter.js): a presented cast
    // or another's replayed one only calls it (the web's own falcon sent here stayed out for good: "เหยี่ยวยังโฉบอยู่")
    if (game.presentationOnly || (p.remote && NC.OnlineWolf && NC.Online && NC.Online.enabled)) { FX.text(p.x, p.y - 200, 'ปี๊ด!', '#cfe8ff', 28); return; }
    if (p.remote) return lookFalcon(game, p, e, hitsOf(lv), lv >= 10);
    sendFalcons(game, p, e, hitsOf(lv), { crit: lvOf(p, 'wh_autoblitz') >= 10 });
  };
  // what a cast is worth to AUTO (js/autofarm.js worthOf): every dive (falconDmg, through DEF, no miss), the golden one's 35%
  // with it, the dives' 50% splash from Lv 5, wind at Lv 10. Ranked as the skill's mul (1) x ATK and with no hits it could
  // learn (the dives are NC.damageEnemy's, not the hero's NC.heroHit), it sat at a fifth of the bow's own skills: AUTO almost
  // never sent the hawk, it had to be pressed by hand (2026-10-20, the owner from the players)
  SK.wh_blitz.autoWorth = (p, lv, e, game) => {
    const gold = lvOf(p, 'wh_steelcrow') >= 5 ? 1.35 : 1, mod = e && NC.elementMod ? NC.elementMod(lv >= 10 ? 'wind' : 'neutral', e.element) : 1;
    const splash = e && game && lv >= 5 ? 0.5 * others(game, e, 110).length : 0;
    return falconDmg(p) * hitsOf(lv) * gold * mod * (1 + splash);
  };
  // another player's falcon (their cast replayed by js/net.js, looks only: FAL is my hunter's): from their side to the
  // monster, the dives with the strike's sparks and slash, back to them
  function lookFalcon(game, p, e, hits, storm) {
    const f = { i: 0, st: 'go', x: 0, y: 0, h: 0, t: 0, e, left: hits, face: p.face, gold: false };
    [f.x, f.y] = perchOf(p, f);
    FX.text(p.x, p.y - 200, 'ปี๊ด!', '#cfe8ff', 28);
    FX.add({ type: 'custom', layer: 'glow', life: 8, x: f.x, y: f.y, draw: (ctx) => drawFalcon(ctx, game, p, f),
      update(q, dt) {
        f.t += dt;
        if (f.st !== 'back' && !alive(e)) f.st = 'back';
        if (f.st === 'go') {
          const tx = e.x - 46, ty = e.y - 150, d = Math.hypot(tx - f.x, ty - f.y), s = 1500 * dt;
          f.face = tx > f.x ? 1 : -1;
          if (d <= s + 20) { f.st = 'strike'; f.t = 0; f.x = tx; f.y = ty; } else { f.x += ((tx - f.x) / d) * s; f.y += ((ty - f.y) / d) * s; }
        } else if (f.st === 'strike') {
          const u = Math.min(1, f.t / 0.09), side = f.left % 2 ? 1 : -1;
          f.x = e.x + side * lerp(46, 10, u); f.y = e.y - lerp(150, 70, u); f.face = side < 0 ? 1 : -1;
          if (f.t < 0.09) return;
          f.t = 0;
          V.sparks(e.x, e.y - 60, 7, FALCON, { size: 0.7 });
          K.slashAt(e.x, e.y - 60, 60, rand(0, TAU), P.wind, FALCON, { life: 0.16, thick: 14 });
          if (storm) V.boltAt(e.x, e.y - 260, e.x, e.y - 50, C.lightning, 0.15, { w: 4, jag: 16, seg: 7 });
          if (--f.left <= 0) f.st = 'back';
        } else {
          const [px, py] = perchOf(p, f), d = Math.hypot(px - f.x, py - f.y), s = 1300 * dt;
          f.face = px > f.x ? 1 : -1;
          if (d <= s + 10) q.dead = true; else { f.x += ((px - f.x) / d) * s; f.y += ((py - f.y) / d) * s; }
        }
      } });
  }
  // (a map change: the falcons are back on the shoulder)
  if (NC.Maps && NC.Maps.go) { const g0 = NC.Maps.go; NC.Maps.go = function () { for (const f of FAL) { f.st = f.gold ? 'gone' : 'perch'; f.e = null; } return g0.apply(this, arguments); }; }

  // ================= the wolf pounces with the arrow =================
  function wolfRush(game, p, e) {
    const w = NC.Pets && NC.Pets.get('wolf');
    if (!w || !alive(e) || (w.rushT || 0) > game.time || !w.act) return;
    w.rushT = game.time + 0.8;
    V.smoke(w.x, w.y - 20, 5, '#e8e4f4', '#ffffff', { size: 0.7, lifeK: 0.5 });
    const an = NC.angle(e.x, e.y, w.x, w.y);
    w.x = e.x + Math.cos(an) * 60; w.y = e.y + Math.sin(an) * 36;
    V.smoke(w.x, w.y - 20, 5, '#e8e4f4', '#ffffff', { size: 0.7, lifeK: 0.5 });
    w.target = e; w.lunge = 0.2; w.face = e.x > w.x ? 1 : -1;
    w.act(game, w, e);
    if (lvOf(p, 'wh_wolfrush') >= 5) NC.statusEnemy(game, e, 'stun', 1);
  }
  // Lv 10: every bite of the wolf makes the hunter shoot faster (10 stacks, 5 s)
  function watchWolf(game, p) {
    const w = NC.Pets && NC.Pets.get('wolf');
    if (!w || w._rushWrapped || !w.act) return;
    const act = w.act;
    w._rushWrapped = true;
    w.act = function (g, q, e) {
      act.apply(this, arguments);
      if (lvOf(p, 'wh_wolfrush') >= 10) { p.packStacks = Math.min(10, (p.packStacks || 0) + 1); K.startBuff(g, p, 'x_pack', 1, 5); }
    };
  }

  // ================= buff looks and ticking =================
  function zealAura(game, p, dt) {
    if (bl(p, 'pal_zeal') < 10) return;
    if ((p._zealT = (p._zealT || 0) + dt) < 1) return;
    p._zealT = 0;
    V.ring(p.x, p.y - 6, 30, 170, 8, HOLY, 0.35);
    for (const e of K.around(game, p.x, p.y, 170)) hit(game, p, 'pal_zeal', e, { color: HOLY, fill: '#fff0a0' });
  }
  function fluxAura(game, p, dt) {
    if (bl(p, 'am_arcaneflux') < 10) return;
    if (!p._fluxFx || p._fluxFx.dead) p._fluxFx = FX.add({ type: 'custom', layer: 'glow', x: p.x, y: p.y, life: 1e9,
      update(q) { if (!on(p, 'am_arcaneflux')) { q.dead = true; p._fluxFx = null; } },
      draw(ctx) { const a = game.time * 2.2; V.magicCircle(ctx, p.x + Math.cos(a) * 70, p.y - 110 + Math.sin(a) * 22, 22, a * 2, '120,220,255', 0.9, 'arcane', 1); } });
    if ((p._fluxT = (p._fluxT || 0) + dt) < 1.5) return;
    p._fluxT = 0;
    const e = K.nearest(game, p.x, p.y, 620, 1)[0];
    if (!e) return;
    const a = game.time * 2.2, from = [p.x + Math.cos(a) * 70, p.y - 110 + Math.sin(a) * 22];
    K.shot(game, p, 'am_arcaneflux', { from, ang: NC.angle(from[0], from[1], e.x, e.y - 45), v: 900, range: 700, rgb: '120,220,255', target: e, home: 6, size: 0.8,
      hit(o, q) { hit(game, p, 'am_arcaneflux', o, { color: '120,220,255', fill: '#c8f0ff', ex: { kind: 'magic' } }); V.sparks(q.x, q.y, 6, '120,220,255', { size: 0.6 }); } });
  }
  function hymnAura(game, p) {
    if (bl(p, 'bi_battlehymn') < 10) return;
    if (Math.random() < 0.08) FX.add({ type: 'text', x: p.x + rand(-60, 60), y: p.y - rand(60, 150), vx: 0, vy: -50, life: 1.2, text: Math.random() < 0.5 ? '♪' : '♫', fill: '#ffe28a', size: 30 });
  }
  NC.skillTicks.push((game, p, dt) => {
    // berserk: the HP drains (not with the paladin's faith), red steam; its end leaves the hero out of breath
    if (on(p, 'kn_berserk')) {
      p._rage = true;
      if (lvOf(p, 'pal_faithblade') < 5 && p.hp > 1) p.hp = Math.max(1, p.hp - p.maxHp * 0.015 * dt);
      if (bl(p, 'kn_berserk') >= 3) p.hurt = 0;
      if (Math.random() < dt * 24) V.motes(p.x + rand(-30, 30), p.y - rand(10, 130), 1, RAGE, { rise: 110, spread: 6, size: 1.1 });
      if ((p._rageL = (p._rageL || 0) - dt) <= 0) { p._rageL = 0.25; V.light(p.x, p.y - 60, 300, RAGE, 0.45, 0.3, { follow: p }); }
    } else if (p._rage) {
      p._rage = false;
      K.startBuff(game, p, 'kn_exhaust', 1, 5);
      FX.text(p.x, p.y - 200, 'เหนื่อย...', '#ffb0a0', 32);
    }
    // the aura blade: the weapon glows blue
    if (on(p, 'kn_aurablade') && p.pose && Math.random() < dt * 30) {
      const L = NC.weaponLine(p.equip, p.pose, p.x, p.y);
      if (L) { const u = rand(0.35, 1); V.motes(lerp(L.base[0], L.tip[0], u), lerp(L.base[1], L.tip[1], u), 1, '150,205,255', { rise: 50, spread: 3, size: 0.9 }); }
    }
    // unlimit: golden sparks round the hero
    if (bl(p, 'rg_unlimit') >= 3 && Math.random() < dt * 14) V.motes(p.x + rand(-28, 28), p.y - rand(10, 130), 1, GOLD, { rise: 90, spread: 5, size: 0.9 });
    // the shield from overflowing drains / mercy wears off with its buff
    if (p.shield && !on(p, 'x_shield')) p.shield = 0;
    if (p.packStacks && !on(p, 'x_pack')) p.packStacks = 0;
    // heals from hits: one green number now and then
    if ((p._healShow = (p._healShow || 0) - dt) <= 0) {
      p._healShow = 0.4;
      for (const who of [p, ...party()]) if (who._healAcc >= 1) { FX.num(who.x, who.y - 150, '+' + Math.round(who._healAcc), { fill: '#8dff8a', size: 30 }); who._healAcc = 0; }
    }
    // bleeding monsters
    for (const e of game.enemies) if (e.bleed) {
      const b = e.bleed;
      if (game.time > b.until || !alive(e)) { e.bleed = null; continue; }
      if ((b.acc += dt) >= 0.5) { b.acc = 0; NC.damageEnemy(game, e, { dmg: b.dmg, mod: 1 }, 0, 0, { dot: true, fill: '#ff6b6b' }); V.sparks(e.x, e.y - 40, 3, '255,60,90', { size: 0.5 }); }
    }
    updateFalcons(game, p, dt);
    if (lvOf(p, 'wh_wolfrush') >= 10) watchWolf(game, p);
  });
  // the soul shield soaks hits before anything else
  NC.heroGuards.unshift((game, p, dmg) => {
    if (!(p.shield > 0)) return dmg;
    const soak = Math.min(p.shield, dmg);
    p.shield -= soak;
    if (soak > 0) V.ring(p.x, p.y - 60, 20, 90, 6, TEAL, 0.25);
    return dmg - soak;
  });

  // ================= the big buffs' own looks =================
  function teamBuff(game, p, id, lv, o) {
    const S = SK[id];
    K.pose(game, p, 'cheer', 0.4);
    K.startBuff(game, p, id, lv);
    K.buffFx(game, p, S.rgb, { style: S.circle || 'holy', r: (o && o.r) || 200 });
    if (S.party) K.buffFriends(game, p, Object.assign({ dur: S.dur(lv), rgb: S.rgb }, S.party(lv)));
    for (const who of [p, ...K.friends(game, p, (S.party && S.party(lv).r) || 520)]) {
      if (o && o.wings) FX.add({ type: 'vwings', follow: who, x: who.x, y: who.y, life: 1.2 });
      V.beam(who.x, who.y, 80, 520, S.rgb, 0.5);
    }
    if (o && o.circle) V.circle(p.x, p.y, o.circle, S.rgb, 1.2, { style: 'holy', spin: 1.2, grow: true, a: 0.9 });
  }
  RUN.blessing = (game, p, lv) => teamBuff(game, p, 'blessing', lv, { wings: true });
  RUN.bi_clementia = (game, p, lv) => teamBuff(game, p, 'bi_clementia', lv, { wings: true, circle: 320, r: 240 });
  RUN.bi_canto = (game, p, lv) => teamBuff(game, p, 'bi_canto', lv, { circle: 320, r: 240 });
  RUN.bi_sacrament = (game, p, lv) => teamBuff(game, p, 'bi_sacrament', lv, { circle: 260 });
  RUN.bi_expiatio = (game, p, lv) => teamBuff(game, p, 'bi_expiatio', lv, { circle: 260 });
  RUN.pr_gloria = (game, p, lv) => teamBuff(game, p, 'pr_gloria', lv, {});
  RUN.pr_suffragium = function (game, p, lv) { teamBuff(game, p, 'pr_suffragium', lv, {}); if (lv >= 5) p.castNextK = 0.7; };
  RUN.mg_memorize = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.3);
    K.startBuff(game, p, 'mg_memorize', lv);
    K.buffFx(game, p, SK.mg_memorize.rgb, { style: 'arcane' });
    if (lv >= 5) p.castInstant = true;
  };
  RUN.kn_berserk = function (game, p, lv) {
    K.pose(game, p, NC.Anim.CLIPS['animight:41_epic'] ? 'animight:41_epic' : 'cheer', 0.45);
    K.startBuff(game, p, 'kn_berserk', lv);
    V.ring(p.x, p.y - 6, 30, 300, 16, RAGE, 0.6);
    V.circle(p.x, p.y, 200, RAGE, 1, { style: 'occult', spin: 3, grow: true, follow: p });
    V.flash('255,60,40', 0.14, 0.3);
    V.shake(game, 12);
    FX.text(p.x, p.y - 210, 'BERSERK!', '#ff5a4a', 60);
    for (let i = 0; i < 16; i++) V.motes(p.x + rand(-40, 40), p.y - rand(10, 140), 1, RAGE, { rise: 220, spread: 12, size: 1.4 });
  };
  RUN.rg_unlimit = function (game, p, lv) {
    K.pose(game, p, 'cheer', 0.4);
    K.startBuff(game, p, 'rg_unlimit', lv);
    V.ring(p.x, p.y - 6, 30, 280, 14, GOLD, 0.6);
    V.beam(p.x, p.y, 120, 700, GOLD, 0.6);
    V.flash('255,230,120', 0.12, 0.3);
    FX.text(p.x, p.y - 210, 'UNLIMIT!', '#ffe070', 56);
  };

  // ================= the archmage's spells from the plan v2 (their numbers: skillplan.js) =================
  const castPose = (game, p, lock) => K.pose(game, p, K.clip(p, 'bolt', 0), lock);
  // ทะเลเพลิง: a sea of flames where the mouse is (Lv 5 wider, Lv 10 a turning firestorm that pulls monsters in)
  RUN.am_inferno = function (game, p, lv) {
    castPose(game, p, 0.35);
    const [tx, ty] = K.ground(game, p, 440), R = lv >= 5 ? 250 : 200, storm = lv >= 10;
    K.zone(game, p, 'am_inferno', tx, ty, R, 4, 0.4, {
      rgb: C.fire, style: 'arcane', color: '255,170,90', pull: storm ? 60 : 0,
      each(e, res) { if (res && !res.miss && roll(35)) NC.addStatus(game, e, 'burn', 4); },
      tick(z, dt) {
        if (Math.random() < dt * 26) {
          const a = storm ? z.t * 3 + rand(0, TAU) : rand(0, TAU), d = Math.sqrt(Math.random()) * R;
          V.flameAt(tx + Math.cos(a) * d, ty + Math.sin(a) * d * V.SQ, rand(34, 52), rand(80, 150), P.fire, rand(0.4, 0.6), { vy: -90 });
        }
        if (storm && Math.random() < dt * 12) FX.add({ type: 'vstreak', x: tx + rand(-R, R), y: ty - rand(30, 160), vx: rand(-400, 400), vy: -80, len: rand(40, 90), w: 3, rgb: '255,170,80', life: 0.3 });
      },
    });
    V.decal(tx, ty, R, 'scorch', 4.2);
    V.light(tx, ty - 60, R * 2.6, C.fire, 0.9, 4, { flick: true });
  };
  // หอกธารน้ำแข็ง: a huge spear of ice through the whole line (Lv 5 freezes every one, Lv 10 bursts into shards at the end)
  RUN.am_glacial = function (game, p, lv) {
    castPose(game, p, 0.35);
    const a = p.aim, from = K.tip(p);
    K.shot(game, p, 'am_glacial', { from, ang: a, v: 1300, range: 820, r: 56, pierce: true, rgb: C.ice,
      look(ctx, q) {
        const an = Math.atan2(q.vy, q.vx);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(an);
        ctx.beginPath(); ctx.moveTo(70, 0); ctx.lineTo(-20, -18); ctx.lineTo(-90, -6); ctx.lineTo(-90, 6); ctx.lineTo(-20, 18); ctx.closePath();
        ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE; ctx.stroke(); ctx.fillStyle = '#bfeaff'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(62, 0); ctx.lineTo(-18, -8); ctx.lineTo(-70, -2); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
        V.glow(ctx, q.x, q.y, 110, C.ice, 0.7, true);
      },
      trail(q) { if (Math.random() < 0.7) FX.add({ type: 'shard', x: q.x + rand(-10, 10), y: q.y + rand(-10, 10), vx: rand(-80, 80), vy: rand(-60, 120), life: 0.35 }); },
      hit(e, q) {
        const res = K.hit(game, p, 'am_glacial', e, Math.cos(a) * 180, Math.sin(a) * 120, '190,235,255');
        if (res && !res.miss) { if (lv >= 5) K.freeze(game, e, 1.6); else NC.addStatus(game, e, 'chill', 4); }
        V.sparks(q.x, q.y, 8, C.ice, { size: 0.8 });
      },
      end(q) {
        if (lv < 10) return;
        K.burst(game, q.x, q.y + 45, 170, C.ice, { shake: 6, decal: 'frost', stars: 6 });
        for (let i = 0; i < 14; i++) FX.add({ type: 'shard', x: q.x, y: q.y, vx: rand(-520, 520), vy: rand(-520, 200), life: 0.5 });
        for (const e of K.around(game, q.x, q.y + 45, 170)) K.hit(game, p, 'am_glacial', e, 0, 0, '190,235,255', 0.5);
      } });
    V.flash('200,235,255', 0.08, 0.2);
  };
  // เจ้าแห่งอสนี: a thunderstorm over the spot (Lv 5 strikes more often, Lv 10 the storm cloud follows the hero)
  RUN.am_lordthunder = function (game, p, lv) {
    castPose(game, p, 0.35);
    const [x0, y0] = K.ground(game, p, 440), R = 260, follow = lv >= 10, every = lv >= 5 ? 0.18 : 0.26;
    const at = { x: x0, y: y0 };
    V.circle(x0, y0, R, C.lightning, 3.1, { style: 'arcane', spin: 1, grow: true, follow: follow ? p : null });
    FX.add({ type: 'custom', layer: 'high', x: x0, y: y0, life: 3.1,
      update() { if (follow) { at.x = p.x; at.y = p.y; } },
      draw(ctx, q) { // the cloud over it
        const a = Math.min(1, q.t / 0.3) * (1 - Math.max(0, q.t - 2.7) / 0.4);
        for (let i = 0; i < 7; i++) V.blob(ctx, at.x - R * 0.7 + i * R * 0.23, at.y - 420 + Math.sin(q.t * 2 + i) * 8, 60, i * 7 + 3, '#3a4468', a * 0.85, '#58648e');
      } });
    let acc = 0;
    FX.add({ type: 'timer', layer: 'none', life: 3, x: x0, y: y0,
      update(q, dt) {
        if ((acc += dt) < every) return;
        acc = 0;
        const foes = K.around(game, at.x, at.y, R), e = foes.length ? foes[Math.floor(Math.random() * foes.length)] : null;
        const tx = e ? e.x : at.x + rand(-R, R) * 0.8, ty = e ? e.y : at.y + rand(-R, R) * 0.5;
        V.boltAt(tx + rand(-40, 40), ty - 420, tx, ty - 20, C.lightning, 0.2, { w: 6, jag: 30, seg: 10 });
        V.glowAt(tx, ty - 20, 20, 120, C.lightning, 0.8, 0.25, { hot: true });
        V.light(tx, ty - 60, 320, C.lightning, 0.9, 0.2);
        if (e) { const res = K.hit(game, p, 'am_lordthunder', e, 0, 0, '200,235,255'); if (res && !res.miss && roll(30)) NC.addStatus(game, e, 'shock', 2); }
        V.shake(game, 3);
      } });
  };

  // ================= the rules =================
  // Berserk: basic hits and buffs only (the paladin with Blade of Faith Lv 5 may still raise Aegis)
  let warnT = -9;
  NC.skillLocked = (p, id) => on(p, 'kn_berserk') && !!SK[id] && NC.kindOf(SK[id]) !== 'buff' && !(id === 'pal_aegis' && lvOf(p, 'pal_faithblade') >= 5);
  const baseCast = NC.castSkill;
  NC.castSkill = function (game, p, key) {
    if (game && p === game.player && on(p, 'kn_berserk')) {
      const id = NC.skillForKey(p, key);
      if (id && NC.skillLocked(p, id)) {
        if (game.time - warnT > 1) { warnT = game.time; FX.num(p.x, p.y - 180, 'บ้าคลั่งอยู่! ตีปกติได้อย่างเดียว', { fill: '#ffb0a0', size: 26 }); }
        return false;
      }
    }
    return baseCast.apply(this, arguments);
  };
  // the monk's combo right after a triple attack costs no SP (and closes the window)
  const baseCost = NC.skillCost;
  NC.skillCost = (p, id, lv) => (id === 'mo_combo' && p.comboOpen > (NC.game ? NC.game.time : 0) ? 0 : baseCost(p, id, lv));
  NC.skillCasts.push((game, p, id) => { if (id === 'mo_combo') p.comboOpen = 0; });
  // Inner Eye Lv 10 never misses with a basic hit; Piercing Grace pierces DEF / MDEF
  const baseHH = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    let r = baseHH(d, e, o);
    const G = NC.game, p = G && G.player;
    if (!p || d !== p.d) return r;
    const m = d.mods || {};
    if (r.miss && m.sureBasic && !o.skill) r = baseHH(d, e, Object.assign({}, o, { sure: true }));
    // the element keystones' safety valve: a monster of the line's own element still takes 75% at least
    const el = o.element || d.atkElement, VALVE = { fire: 'valve_fire', water: 'valve_water', wind: 'valve_wind' };
    if (r.dmg > 0 && VALVE[el] && m[VALVE[el]] && r.mod > 0 && r.mod < 0.75) { r.dmg = Math.round((r.dmg * 0.75) / r.mod); r.mod = 0.75; }
    if (r.dmg > 0 && m.frozenDmg && e.frozen > 0) r.dmg = Math.round(r.dmg * (1 + m.frozenDmg / 100));
    if (r.dmg > 0 && m.shockAmp && el === 'wind' && NC.statusOf && NC.statusOf(e, 'shock')) r.dmg = Math.round(r.dmg * (1 + m.shockAmp / 100));
    if (r.dmg > 0 && m.pierceDef && o.kind !== 'magic' && !r.crit && e.def > 0 && e.def < 100) r.dmg = Math.round((r.dmg * (1 - (e.def * (1 - m.pierceDef / 100)) / 100)) / (1 - e.def / 100));
    if (r.dmg > 0 && m.pierceMdef && o.kind === 'magic' && e.mdef > 0 && e.mdef < 100) r.dmg = Math.round((r.dmg * (1 - (e.mdef * (1 - m.pierceMdef / 100)) / 100)) / (1 - e.mdef / 100));
    return r;
  };
  // the venom heart Lv 10: a poisoned monster's hits are softer
  const baseMH = NC.monsterHit;
  NC.monsterHit = function (m, d) {
    const r = baseMH(m, d), G = NC.game;
    if (r.dmg > 0 && m.poison && m.poison.t > 0 && G && d === G.player.d && d.mods && d.mods.venomWeak) r.dmg = Math.max(1, Math.round(r.dmg * (1 - d.mods.venomWeak / 100)));
    return r;
  };
  // Breaking Point: no defence at all, no natural HP recovery
  const baseDerive = NC.derive;
  NC.derive = function (p) {
    const d = baseDerive(p);
    if (d.mods && d.mods.unlimit) { d.def = 0; d.mdef = 0; d.vdef = 0; d.imdef = 0; d.hpRegen = 0; }
    return d;
  };
  // the party buffs speed up the AI friends too (haste)
  const baseFriends = K.buffFriends;
  K.buffFriends = function (game, p, o) {
    baseFriends(game, p, o);
    if (o.haste) for (const a of K.friends(game, p, o.r || 520)) {
      const k = a.hasteUntil > game.time ? Math.max(a.hasteK || 1, o.haste) : o.haste;
      a.hasteUntil = game.time + o.dur; a.hasteK = k;
    }
  };
  const baseSpeed = NC.atkSpeed;
  NC.atkSpeed = (p, w) => baseSpeed(p, w) * (p && p.hasteUntil > (NC.game ? NC.game.time : 0) ? p.hasteK || 1 : 1);
})();
