/* gearopts.js — option rows for every piece of gear, more kinds, a ceiling on each, and gear sold in the players' stalls
   (2026-10-11; the user: "อาวุธอยากให้เป็นสุ่มออฟ ... จะได้มีการหาของมาขายที่หลากหลาย มีเพดานออฟ", then "resistant ...
   เจาะเกราะ เจาะเวท และอื่นๆ"). js/gearbag.js keeps the copies and rolls their rows; this file says which kinds a piece
   may roll and what the new kinds do.
     where          weapons (W): the old 8 + attack + skill kinds · tops / pants (D): defence kinds · hats and glasses (H):
                    resists and stats · accessories (A): skill + defence kinds. Armour now rolls rows too: tops / pants
                    1 / 1 / 2 / 2 by grade, hats 1, accessories 1 (boss pieces +1); old armour copies get theirs once.
     the ceiling    each kind's เทพ top is its full value: "ATK +6% (เต็ม 7)", a full row says "ตัน"; 4 rows a piece and 2 of
                    a kind as before, and one special row at most. Totals have caps too (pierce 50%, element resist 50%
                    each, status resist 80%, cast 70%, after-cast delay 50%, SP steal 10%; js/hstatus.js the defence ones).
     special        drop only (3% a row, when the piece has none): "ไม่ติด X" (immune to a status) on armour, "ตี X% ร่าย…"
                    (a weapon spell) on weapons.
     drop / craft   a drop has a 5% chance of one row more than its grade; a weapon made by ป๋าหมูหริ่ง may lock one row's
                    kind (one more หินออฟ) and carries its maker's name ("ตีโดย X").
     the stalls     js/vend.js sells a copy whole (rows, +refine, ✦, taint, maker): kind 'gear' through NC.VEND_KINDS.
     prices         the merchant pays by the rows' tiers (เทพ and ตัน more, a special row much more).
   The new kinds land in the hero's mods (NC.skillModSources): pen mpen bossDmg sk_<skill> cast acd spLeech rel_<el>
   res_<status> imm_<status> rrace_<race> rboss rmelee rrange, plus the old keys (critDmg matk hit cdr spCost el_<el> hpPct
   spPct hpReg spReg heal flee pdodge spd str..luk). Hooks: NC.heroHit (pierce, bosses, one skill), NC.castTime,
   NC.skillAcdOf, NC.basicHits (SP steal), NC.gearFx (the status and spell rows as js/wabil.js specs), NC.rowText /
   NC.rowsHtml, NC.loadGear (old armour), NC.optPool / optBaseRows / optPriceK / gearMakeHooks (js/gearbag.js), NC.VEND_KINDS.
   NC.optTotals(p): every number with its cap and where it comes from (the status window's ค่าละเอียด). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, SK = NC.SKILLS, W = NC.GEAR, OPT = NC.WOPTS;
  if (!W || !OPT) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const elTh = (el) => (NC.ELEMENT_INFO && NC.ELEMENT_INFO[el] ? NC.ELEMENT_INFO[el].th : el);
  const ST_IDS = ['stun', 'freeze', 'sleep', 'poison', 'bleed', 'burn', 'silence', 'blind', 'slow'];
  const stTh = (s) => (NC.HS && NC.HS.ST[s] ? NC.HS.ST[s].th : s);
  const RES_ELS = ['water', 'earth', 'fire', 'wind', 'poison', 'shadow', 'ghost', 'undead'];
  const ATK_ELS = ['water', 'earth', 'fire', 'wind', 'poison', 'holy', 'shadow', 'ghost', 'undead'];
  const INFLICT = { burn: 'เผา', chill: 'เย็นเฉียบ', shock: 'ช็อต', crack: 'ร้าว', curse: 'คำสาป', poison: 'พิษ', bleed: 'เลือดไหล' };
  const SPELLS = { windline: 'ใบมีดลม', lightning: 'ฟ้าผ่า', spores: 'สปอร์พิษ', bats: 'ฝูงค้างคาว', icespikes: 'หนามน้ำแข็ง', firepillar: 'เสาเพลิง', fireballs: 'ลูกไฟ', crescent: 'คลื่นเสี้ยวจันทร์' };
  const RACES = () => NC.RACES || {};

  // ---------------- the kinds ----------------
  // on: the pools a kind rolls in (W weapon · D top/pants · H hat/glasses · A accessory); g: its group; cap: the most it
  // adds up to on one hero (shown in ค่าละเอียด)
  for (const k of Object.keys(OPT)) { OPT[k].on = OPT[k].on || 'W'; OPT[k].g = OPT[k].g || 'atk'; }
  OPT.stat.on = 'WDHA'; OPT.leech.cap = 10; OPT.stat.cap = 30;
  const pct = (th, tiers, on, g, key, cap, extra) => Object.assign({ th, tiers, on, g, key, cap, text: (r) => `${th} +${r.v}%` }, extra || {});
  Object.assign(OPT, {
    // attack (weapons)
    pen: pct('เจาะเกราะ', [[3, 5], [6, 9], [10, 12]], 'W', 'atk', 'pen', 50, { text: (r) => `เจาะเกราะ ${r.v}%` }),
    mpen: pct('เจาะเวท', [[3, 5], [6, 9], [10, 12]], 'W', 'atk', 'mpen', 50, { text: (r) => `เจาะเวท ${r.v}%` }),
    critDmg: pct('คริแรง', [[4, 6], [7, 10], [11, 15]], 'W', 'atk', 'critDmg', 100, { text: (r) => `ดาเมจคริติคอล +${r.v}%` }),
    boss: pct('แรงกับบอส', [[3, 5], [6, 9], [10, 12]], 'W', 'atk', 'bossDmg'),
    matk: pct('MATK', [[2, 3], [4, 5], [6, 7]], 'W', 'atk', 'matk', 0, { text: (r) => `MATK +${r.v}%` }),
    hit: pct('ความแม่น', [[3, 5], [6, 9], [10, 12]], 'W', 'atk', 'hit', 0, { text: (r) => `HIT +${r.v}` }),
    elDmg: pct('ธาตุแรงขึ้น', [[3, 4], [5, 7], [8, 10]], 'W', 'atk', 'el_', 0, { subs: ATK_ELS, subTh: elTh, text: (r) => `ตีธาตุ${elTh(r.sub)}แรงขึ้น +${r.v}%` }),
    inflict: pct('ตีติดสถานะ', [[2, 2], [3, 4], [5, 5]], 'W', 'atk', null, 0, { subs: Object.keys(INFLICT), subTh: (s) => INFLICT[s], text: (r) => `ตี ${r.v}% ติด${INFLICT[r.sub]}` }),
    spLeech: pct('ดูด SP', [[1, 1], [1, 2], [2, 2]], 'W', 'atk', 'spLeech', 10, { text: (r) => `ตีดูด SP ${r.v}%` }),
    // skills (weapons, accessories)
    cast: pct('ร่ายไว', [[2, 3], [4, 6], [7, 8]], 'WA', 'skill', 'cast', 30, { text: (r) => `ร่ายเร็วขึ้น ${r.v}%` }),
    acd: pct('ดีเลย์หลังร่าย', [[2, 3], [4, 6], [7, 8]], 'WA', 'skill', 'acd', 50, { text: (r) => `ดีเลย์หลังร่าย −${r.v}%` }),
    cdr: pct('คูลดาวน์', [[1, 2], [3, 4], [5, 6]], 'WA', 'skill', 'cdr', 60, { text: (r) => `คูลดาวน์ −${r.v}%` }),
    spCost: pct('ประหยัด SP', [[2, 3], [4, 6], [7, 8]], 'WA', 'skill', 'spCost', 70, { text: (r) => `ใช้ SP น้อยลง ${r.v}%` }),
    skill: pct('สกิล', [[5, 8], [9, 12], [13, 15]], 'W', 'skill', 'sk_', 0, { subsFor: (it) => skillsFor(it), subTh: (s) => (SK[s] ? SK[s].name : s),
      text: (r) => `${SK[r.sub] ? SK[r.sub].name : 'สกิล'} แรงขึ้น +${r.v}%` }),
    // defence (armour, hats, accessories)
    resEl: pct('ต้านธาตุ', [[4, 6], [7, 9], [10, 12]], 'DHA', 'def', 'rel_', 50, { subs: RES_ELS, subTh: elTh, text: (r) => `ต้านธาตุ${elTh(r.sub)} ${r.v}%` }),
    resSt: pct('ต้านสถานะ', [[5, 8], [9, 12], [13, 15]], 'DHA', 'def', 'res_', 80, { subs: ST_IDS, subTh: stTh, text: (r) => `ต้าน${stTh(r.sub)} ${r.v}%` }),
    resRace: pct('ต้านเผ่า', [[3, 5], [6, 8], [9, 10]], 'DA', 'def', 'rrace_', 40, { get subs() { return Object.keys(RACES()); }, subTh: (s) => RACES()[s], text: (r) => `รับดาเมจจากเผ่า${RACES()[r.sub]} −${r.v}%` }),
    resBoss: pct('ต้านบอส', [[2, 4], [5, 6], [7, 8]], 'DA', 'def', 'rboss', 30, { text: (r) => `รับดาเมจจากบอส −${r.v}%` }),
    resMelee: pct('ต้านประชิด', [[2, 4], [5, 6], [7, 8]], 'D', 'def', 'rmelee', 40, { text: (r) => `รับดาเมจประชิด −${r.v}%` }),
    resRange: pct('ต้านระยะไกล', [[2, 4], [5, 6], [7, 8]], 'DA', 'def', 'rrange', 40, { text: (r) => `รับดาเมจระยะไกล −${r.v}%` }),
    hpPct: pct('HP', [[2, 3], [4, 4], [5, 5]], 'DHA', 'def', 'hpPct', 0, { text: (r) => `HP สูงสุด +${r.v}%` }),
    spPct: pct('SP', [[2, 3], [4, 4], [5, 5]], 'DHA', 'def', 'spPct', 0, { text: (r) => `SP สูงสุด +${r.v}%` }),
    hpReg: pct('ฟื้น HP', [[4, 6], [7, 8], [9, 10]], 'DA', 'def', 'hpReg', 0, { text: (r) => `ฟื้น HP +${r.v}%` }),
    spReg: pct('ฟื้น SP', [[4, 6], [7, 8], [9, 10]], 'DA', 'def', 'spReg', 0, { text: (r) => `ฟื้น SP +${r.v}%` }),
    heal: pct('รับฮีล', [[3, 5], [6, 8], [9, 10]], 'DA', 'def', 'heal', 0, { text: (r) => `รับฮีลเพิ่ม +${r.v}%` }),
    flee: pct('FLEE', [[3, 5], [6, 8], [9, 12]], 'DHA', 'def', 'flee', 50, { text: (r) => `FLEE +${r.v}` }),
    pdodge: pct('หลบสมบูรณ์', [[1, 1], [2, 2], [3, 3]], 'HA', 'def', 'pdodge', 10, { text: (r) => `หลบสมบูรณ์ +${r.v}` }),
    spd: pct('วิ่งเร็ว', [[1, 1], [2, 2], [3, 3]], 'DA', 'def', 'spd', 0, { text: (r) => `วิ่งเร็วขึ้น ${r.v}%` }),
    // special: drops only, one a piece
    immune: pct('ไม่ติดสถานะ', [[100, 100], [100, 100], [100, 100]], 'DHA', 'special', 'imm_', 0, { fixedTier: 2, special: true, subs: ST_IDS, subTh: stTh, text: (r) => `◆ ไม่ติด${stTh(r.sub)}` }),
    proc: pct('ร่ายเวท', [[2, 2], [3, 3], [4, 4]], 'W', 'special', null, 0, { special: true, subs: Object.keys(SPELLS), subTh: (s) => SPELLS[s], text: (r) => `◆ ตี ${r.v}% ร่าย${SPELLS[r.sub]}` }),
  });
  const GROUPS = { atk: 'โจมตี', skill: 'สกิล', def: 'ป้องกัน', special: 'พิเศษ' };
  const OLD = new Set(['atk', 'crit', 'aspd', 'leech', 'spKill', 'stat', 'race', 'el']);

  // the damage skills of the jobs that hold this weapon's type (a bow's row names an archer's skill)
  const skCache = {};
  function skillsFor(it) {
    const t = it && NC.wtypeOf ? NC.wtypeOf(it) : null;
    if (!t) return null;
    if (t in skCache) return skCache[t];
    const jobs = new Set(Object.keys(NC.JOB_WEAPONS || {}).filter((j) => (NC.JOB_WEAPONS[j] || []).includes(t)));
    const out = Object.keys(SK).filter((id) => {
      const S = SK[id];
      if (!S || !S.active || S.hidden || S.admin || !(S.type === 'phys' || S.type === 'magic')) return false;
      const j = NC.skillJob ? NC.skillJob(id) : null;
      return j && jobs.has(j);
    });
    return (skCache[t] = out.length ? out : null);
  }

  // ---------------- which kinds a piece rolls ----------------
  const poolOf = (it) => (!it || it.slot === 'weapon' ? 'W' : it.slot === 'acc' ? 'A' : it.slot === 'hat' || it.slot === 'glasses' ? 'H' : 'D');
  const usable = (k, it) => !OPT[k].subsFor || !!OPT[k].subsFor(it);
  NC.optKindsFor = (it, special) => Object.keys(OPT).filter((k) => OPT[k].on.includes(poolOf(it)) && !!OPT[k].special === !!special && usable(k, it));
  const isSpecial = (r) => !!(r && OPT[r.k] && OPT[r.k].special);
  NC.optPool = function (it, rows, o) {
    if (o && o.src === 'drop' && !(rows || []).some(isSpecial) && Math.random() < 0.03) {
      const sp = NC.optKindsFor(it, true);
      if (sp.length) return sp;
    }
    return NC.optKindsFor(it, false);
  };
  NC.optBaseRows = function (it) {
    if (!it || !W.isInst || !it.inst) return 0;
    const pool = poolOf(it), g = W.gradeOf(it), boss = /[DL]/.test(W.kindOf(it)) ? 1 : 0;
    return Math.min(W.MAX_ROWS, (pool === 'D' ? [0, 1, 1, 2, 2][g] || 1 : 1) + boss);
  };
  // a drop may come with one row more; a made one may have a locked kind and its maker
  (NC.gearMakeHooks = NC.gearMakeHooks || []).push((c, it, o) => {
    if (!o) return;
    if (o.src === 'drop' && c.rows.length && c.rows.length < W.MAX_ROWS && Math.random() < 0.05) c.rows.push(W.rollRow(c.rows, undefined, undefined, undefined, it, o));
    if (o.lock && OPT[o.lock] && !OPT[o.lock].special) {
      const row = W.rollRow(c.rows.slice(1), o.lock, o.lockSub, undefined, it);
      if (c.rows.length) c.rows[0] = row; else c.rows.push(row);
    }
    if (o.by) c.by = String(o.by).replace(/[|,~<>"'`]/g, '').slice(0, 24);
  });

  // ---------------- the ceiling, shown ----------------
  const topOf = (k) => OPT[k].tiers[2][1];
  const isFull = (r) => !!(OPT[r.k] && !OPT[r.k].fixedTier && r.v >= topOf(r.k));
  NC.optIsFull = isFull;
  const baseText = NC.rowText;
  NC.rowText = function (r) {
    const t = baseText(r);
    if (!t || !OPT[r.k] || OPT[r.k].fixedTier !== undefined) return t;
    return t + (isFull(r) ? ' · ตัน' : ` (เต็ม ${topOf(r.k)})`);
  };
  NC.optPriceK = (c) => 1 + c.rows.reduce((s, r) => s + (isSpecial(r) ? 1.2 : 0.15 + r.tier * 0.25 + (isFull(r) ? 0.3 : 0)), 0);
  const baseRowsHtml = NC.rowsHtml;
  NC.rowsHtml = function (c, empty) {
    let h = baseRowsHtml.apply(this, arguments);
    if (c.rows.some(isSpecial)) h = h.replace(/(<span class="gb-opt")( style="color:[^"]*">◆)/g, '$1 data-sp="1"$2');
    if (c.by) h += `<span class="gb-opt gb-by">ตีโดย ${esc(c.by)}</span>`;
    return h;
  };

  // ---------------- old armour: its rows, once ----------------
  (NC.loadHooks || (NC.loadHooks = [])).push((game, prm) => {
    const p = game.player;
    let n = 0;
    for (const c of p.bag || []) {
      const it = ITEMS[c.id];
      if (!it || it.slot === 'weapon' || c.rows.length) continue;
      const want = NC.optBaseRows(it);
      for (let i = 0; i < want; i++) c.rows.push(W.rollRow(c.rows, undefined, undefined, undefined, it));
      if (want) n++;
    }
    if (n) { NC.applyGear(game); if (!game.noSave) NC.saveGame(game); }
  });

  // ---------------- what the rows add up to ----------------
  const SLOTS = () => Object.keys((NC.game && NC.game.player && NC.game.player.equip) || {});
  function wornCopies(p) {
    const out = [], seen = new Set();
    for (const key of Object.keys(p.equip || {})) { const c = W.wornIn(p, key); if (c && !seen.has(c)) { seen.add(c); out.push([key, c]); } }
    return out;
  }
  // every row the hero wears, as mods keys (the old weapon kinds stay with js/wabil.js)
  function rowMods(p) {
    const m = {}, add = (k, v) => { m[k] = (m[k] || 0) + v; };
    for (const [key, c] of wornCopies(p))
      for (const r of c.rows) {
        const O = OPT[r.k];
        if (!O) continue;
        if (OLD.has(r.k)) { if (r.k === 'stat' && key !== 'weapon') add(r.sub, r.v); continue; }
        if (!O.key) continue;
        add(O.key.endsWith('_') ? O.key + r.sub : O.key, O.key === 'imm_' ? 1 : r.v);
      }
    for (const k in ROW_CAP) if (m[k] > ROW_CAP[k]) m[k] = ROW_CAP[k];
    return m;
  }
  // what the option rows may add at most on one hero (the balance check of 2026-10-13: FLEE ~+144 put a Lv 99 monster's
  // hit at the 5% floor, perfect dodge ~+24 missed 35% of every hit, magic too, a stat ~+70, cast speed 70% on top of
  // the 60% cast cut left a 3.5 s spell at 0.1-0.5 s)
  const ROW_CAP = { str: 30, agi: 30, vit: 30, int: 30, dex: 30, luk: 30, flee: 50, pdodge: 10, cast: 30, critDmg: 100 };
  NC.OPT_ROW_CAP = ROW_CAP;
  NC.skillModSources.push((p) => (p.kind === 'player' ? rowMods(p) : null));
  // the status and spell rows: js/wabil.js specs (kept as the same objects so its once-per-swing timers hold)
  let specKey = '', specs = [];
  function rowSpecs(p) {
    const list = [];
    for (const [, c] of wornCopies(p)) for (const r of c.rows) if (r.k === 'inflict' || r.k === 'proc') list.push(r);
    const key = list.map((r) => r.k + r.sub + r.v).join(',');
    if (key !== specKey) {
      specKey = key;
      specs = list.map((r) => (r.k === 'inflict' ? { t: 'status', st: r.sub, chance: r.v } : { t: 'proc', fx: r.sub, chance: r.v, mul: 1.5 }));
    }
    return specs;
  }
  const baseGearFx = NC.gearFx;
  NC.gearFx = function (p) {
    const a = baseGearFx ? baseGearFx(p) : [];
    const b = p && p.kind === 'player' ? rowSpecs(p) : [];
    return b.length ? (a || []).concat(b) : a;
  };

  // ---------------- the new kinds at work ----------------
  const isBoss = (e) => !!(e && ((NC.BOSSES && NC.BOSSES[e.type]) || e.boss || e.isBoss));
  const baseHit = NC.heroHit;
  NC.heroHit = function (d, e, o) {
    const m = d && d.mods;
    if (!m || !e || !d.mods || (!m.pen && !m.mpen && !m.bossDmg && !(o && o.sid && m['sk_' + o.sid]))) return baseHit.apply(this, arguments);
    const magic = !!(o && o.kind === 'magic'), pen = Math.min(50, (magic ? m.mpen : m.pen) || 0) / 100;
    const keep = pen > 0 ? [e.def, e.vdef, e.mdef, e.imdef] : null;
    if (keep) {
      if (magic) { if (typeof e.mdef === 'number') e.mdef *= 1 - pen; if (typeof e.imdef === 'number') e.imdef *= 1 - pen; }
      else { if (typeof e.def === 'number') e.def *= 1 - pen; if (typeof e.vdef === 'number') e.vdef *= 1 - pen; }
    }
    let r;
    try { r = baseHit.apply(this, arguments); } finally { if (keep) [e.def, e.vdef, e.mdef, e.imdef] = keep; }
    if (r && r.dmg > 0) {
      let k = 1;
      if (m.bossDmg && isBoss(e)) k *= 1 + m.bossDmg / 100;
      if (o && o.sid && m['sk_' + o.sid]) k *= 1 + m['sk_' + o.sid] / 100;
      if (k !== 1) r.dmg = Math.max(1, Math.round(r.dmg * k));
    }
    return r;
  };
  const md = (p) => (p && p.d && p.d.mods) || {};
  if (NC.castTime) {
    const base = NC.castTime;
    NC.castTime = function (p, id, lv) {
      const t = base.apply(this, arguments), c = Math.min(ROW_CAP.cast, md(p).cast || 0);
      if (!c || !(t > 0)) return t;
      return Math.max(t * (1 - c / 100), (NC.castBase ? NC.castBase(id, lv) : 0) * 0.15); // (never under 15% of the spell's own cast)
    };
  }
  if (NC.skillAcdOf) { const base = NC.skillAcdOf; NC.skillAcdOf = function (p) { const t = base.apply(this, arguments), c = Math.min(50, md(p).acd || 0); return c && typeof t === 'number' ? t * (1 - c / 100) : t; }; }
  if (NC.basicHits) NC.basicHits.push((game, p, e, r) => {
    const v = Math.min(10, md(p).spLeech || 0);
    if (!v || !(r && r.dmg > 0) || p.sp >= p.maxSp) return;
    const got = Math.min(p.maxSp - p.sp, Math.max(1, Math.round(r.dmg * v / 100)), Math.max(2, Math.round(p.maxSp * 0.03)));
    p.sp += got;
  });

  // ---------------- every number with its cap (the status window's ค่าละเอียด) ----------------
  NC.optTotals = function (p) {
    const gear = rowMods(p), all = (p.d && p.d.mods) || {};
    const line = (key, th, cap, unit) => ({ key, th, v: all[key] || 0, gear: gear[key] || 0, cap: cap || 0, unit: unit || '%' });
    return { gear, all, line, OPT, GROUPS, RES_ELS, ST_IDS };
  };

  // ---------------- the players' stalls: a copy sold whole (js/vend.js) ----------------
  // a listing's id carries the copy: g|item|u|ref|sh|taint|by|k~v~tier~sub,... (the buyer's game checks every part)
  const enc = (c) => ['g', c.id, c.u, c.ref || 0, c.sh ? 1 : 0, c.taint || '', c.by || '',
    c.rows.map((r) => [r.k, r.v, r.tier, r.sub || ''].join('~')).join(','), NC.Grade ? NC.Grade.of(c) : ''].join('|'); // (the 9th part: the colour grade, js/gradetier.js)
  function dec(s) {
    if (typeof s !== 'string' || s.length > 400) return null;
    const a = s.split('|');
    if ((a.length !== 8 && a.length !== 9) || a[0] !== 'g') return null;
    const id = a[1], it = ITEMS[id];
    if (!it || !W.isInst(id) || !NC.itemReady(id)) return null;
    const u = Number(a[2]), ref = Number(a[3]), sh = Number(a[4]);
    if (!Number.isFinite(u) || !(ref >= 0 && ref <= 10) || !(sh === 0 || sh === 1)) return null;
    const taint = a[5] && NC.BL && NC.BL.TRAITS && NC.BL.TRAITS[a[5]] ? a[5] : '';
    const rows = [];
    for (const t of a[7] ? a[7].split(',') : []) {
      const [k, v0, t0, sub] = t.split('~'), O = OPT[k], v = Number(v0), tier = Number(t0);
      if (!O || !(tier >= 0 && tier <= 2) || !(v >= O.tiers[0][0] && v <= O.tiers[2][1])) return null;
      const subs = O.subsFor ? O.subsFor(it) : O.subs;
      if (subs && !subs.includes(sub)) return null;
      rows.push(Object.assign({ k, v, tier }, subs ? { sub } : {}));
    }
    if (rows.length > W.MAX_ROWS || rows.filter(isSpecial).length > 1) return null;
    const g = a.length === 9 && /^[0-5]$/.test(a[8]) ? Number(a[8]) : null;
    return Object.assign({ u, id, rows, ref: Math.floor(ref), sh }, taint ? { taint } : {}, a[6] ? { by: a[6].replace(/[<>"'`]/g, '').slice(0, 24) } : {}, g != null ? { g } : {});
  }
  const wornAny = (p, c) => Object.keys(p.equip).some((k) => W.wornIn(p, k) === c);
  const mineOf = (p, s) => { const d = dec(s); return d ? W.bag(p).find((c) => c.u === d.u && c.id === d.id) || null : null; };
  const iconCache = new Map();
  const VK = (NC.VEND_KINDS = NC.VEND_KINDS || {});
  VK.gear = {
    label: 'ของมีออฟ', one: true,
    valid: (s) => !!dec(s),
    name: (s) => { const d = dec(s); return d ? NC.copyName(d) : '?'; },
    sub: (s) => { const d = dec(s); if (!d) return ''; const t = d.taint && NC.BL.TRAITS[d.taint]; return (d.rows.map(NC.rowText).join(' · ') || 'ไม่มีออฟ') + (t ? ` · แปดเปื้อน: ${t.name}` : '') + (d.by ? ` · ตีโดย ${d.by}` : ''); },
    worth: (s) => { const d = dec(s); return d ? W.priceOf(d) : 0; },
    suggest: (s) => { const d = dec(s); return d ? Math.round((W.priceOf(d) * 2) / 100) * 100 || 100 : 100; },
    icon: (s) => { // (kept once the art is in: a streamed sprite not loaded yet draws an empty canvas, ~160 chars, tried again next time)
      const d = dec(s); if (!d) return ''; if (iconCache.has(d.id)) return iconCache.get(d.id);
      let u = ''; try { u = NC.itemIcon(d.id, 96).toDataURL(); } catch (e) { u = ''; }
      if (u.length > 400) iconCache.set(d.id, u);
      return u;
    },
    have: (p, s) => { const c = mineOf(p, s); return c && !wornAny(p, c) ? 1 : 0; },
    take: (game, s) => { const c = mineOf(game.player, s); if (c) W.remove(game, c); },
    give: (game, s) => { const d = dec(s); if (!d) return; d.u = (Date.now() % 1e9) * 100 + Math.floor(Math.random() * 100); W.add(game, d); },
    list: (p) => W.bag(p).filter((c) => ITEMS[c.id] && !c.bd && !wornAny(p, c) && !(NC.invLocked && NC.invLocked(c.id))).map(enc), // (bd: bound pieces stay with their hero, js/rootloot.js)
  };
  NC.gearEnc = enc; NC.gearDec = dec;

  const css = document.createElement('style');
  css.textContent = '.gb-opt[data-sp]{color:#ff9be0!important;font-weight:600}.gb-by{color:#c9b98f;font-size:calc(13*var(--u));font-style:italic}';
  document.head.appendChild(css);
  NC.GEAROPT = { OPT, GROUPS, poolOf, skillsFor, rowMods, isFull, isSpecial, SLOTS };
})();
